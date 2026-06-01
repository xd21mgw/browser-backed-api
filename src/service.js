import {
  ACTIONS,
  buildActionBody,
  buildActionDisabledByPlatformScopeResponse,
  buildActionParameterErrorResponse,
  buildLoginLogsFallbackInput,
  buildLiveActionFailureResponse,
  buildLiveActionResponse,
  buildPassthroughActionResponse,
  buildPassthroughFailureResponse,
  getAction,
  getActionParameterError,
  listActions,
  loginLogsFallbackReason,
  actionResponseMode,
  runMockAction,
  validateActionInput
} from "./actions.js";
import { computeAuthState, loadRefreshState, saveRefreshState, updateOriginWarmState } from "./authState.js";
import { BrowserBackedClient } from "./browser.js";
import { isAuthRedirectTarget, sanitizeErrorMessage, sourceStatusFromErrorType } from "./diagnostics.js";

export class BrowserBackedApiService {
  constructor(config, browserClient = null) {
    this.config = config;
    this.startedAtMs = Date.now();
    this.browserClient = browserClient || (config.mode === "live" ? new BrowserBackedClient(config) : null);
    this.warmState = new Map(Object.values(config.domains).map((domain) => [domain.key, defaultWarmState(domain, config)]));
    this.refreshState = loadRefreshState(config.stateFile);
  }

  async init() {
    if (!this.browserClient) {
      return;
    }

    await this.browserClient.start();
    await this.prewarm();
  }

  health() {
    const browserStatus = this.browserClient ? this.browserClient.status() : null;
    const authState = computeAuthState({
      profileDir: this.config.profileDir,
      stateFile: this.config.stateFile,
      origins: Object.values(this.config.domains),
      refreshState: this.refreshState
    });
    return {
      ok: true,
      service_mode: this.config.mode,
      browser_initialized: Boolean(browserStatus?.browser_initialized),
      context_initialized: Boolean(browserStatus?.context_initialized),
      profile_dir_configured: authState.profile_dir_configured,
      profile_exists: authState.profile_exists,
      state_file_configured: authState.state_file_configured,
      last_refresh_at: authState.last_refresh_at,
      auth_state: authState.auth_state,
      origin_status: authState.origin_status,
      warmed_origins: this.warmedOrigins(),
      uptime_ms: Date.now() - this.startedAtMs,
      action_count: Object.keys(ACTIONS).length
    };
  }

  actions() {
    return {
      actions: listActions(this.config)
    };
  }

  async prewarm() {
    const results = [];
    for (const domain of enabledDomains(this.config)) {
      results.push(await this.prewarmDomain(domain.key));
    }
    this.persistRefreshState({ incrementRefreshCount: this.config.mode === "live" && results.length > 0 });

    return {
      service_mode: this.config.mode,
      results
    };
  }

  async prewarmDomain(domainKey) {
    const domain = this.config.domains[domainKey];
    if (!domain) {
      throw publicError(404, "unknown_origin", "Unknown origin");
    }
    if (this.config.mode === "live" && !isPlatformEnabled(this.config, domain.key)) {
      const result = disabledWarmState(domain, this.config);
      this.warmState.set(domain.key, result);
      return result;
    }

    const startedAt = Date.now();
    try {
      if (this.config.mode === "mock") {
        const result = {
          key: domain.key,
          domain: domain.label,
          origin: "mock",
          configured_origin: "mock",
          prewarm_path: domain.prewarmPath,
          initial_url: "mock:/",
          final_url: "mock:/",
          final_origin: "mock",
          current_origin: "mock",
          same_origin_expected: true,
          same_origin_actual: true,
          navigation_status: "simulated",
          status: "simulated",
          warmed: true,
          page_ready: true,
          latency_ms: Date.now() - startedAt,
          error_type: null,
          error_message_sanitized: null,
          warmed_at: new Date().toISOString(),
          last_prewarm_at: new Date().toISOString(),
          last_error_type: null,
          last_landing_flow_status: "not_needed",
          auth_redirect_detected: false,
          landing_flow_attempted: false,
          allowed_clicks_executed: 0,
          final_origin_after_landing: "mock"
        };
        this.warmState.set(domain.key, result);
        this.recordOriginWarmState(domain, result);
        return result;
      }

      const liveResult = await this.browserClient.prewarmDomain(domain.key);
      const warmed = liveResult.status === "ready" && liveResult.page_ready === true;
      const prewarmAt = new Date().toISOString();
      const result = {
        ...liveResult,
        status: warmed ? "ready" : liveResult.status || "error",
        warmed,
        current_origin: liveResult.final_origin || null,
        page_ready: warmed,
        latency_ms: Date.now() - startedAt,
        error_type: liveResult.error_type || null,
        error_message_sanitized: liveResult.error_message_sanitized || null,
        warmed_at: warmed ? prewarmAt : null,
        last_prewarm_at: prewarmAt,
        last_error_type: liveResult.error_type || null,
        last_landing_flow_status: liveResult.landing_flow_status || "not_needed"
      };
      this.warmState.set(domain.key, result);
      this.recordOriginWarmState(domain, result);
      return result;
    } catch (error) {
      const result = {
        key: domain.key,
        domain: domain.label,
        origin: domain.origin || "unconfigured",
        configured_origin: domain.origin || "unconfigured",
        prewarm_path: domain.prewarmPath,
        initial_url: null,
        final_url: null,
        final_origin: null,
        current_origin: null,
        same_origin_expected: true,
        same_origin_actual: false,
        navigation_status: "error",
        status: "error",
        warmed: false,
        page_ready: false,
        latency_ms: Date.now() - startedAt,
        error_type: classifyError(error),
        error_message_sanitized: sanitizeErrorMessage(error),
        warmed_at: null,
        last_prewarm_at: new Date().toISOString(),
        last_error_type: classifyError(error),
        last_landing_flow_status: "error",
        auth_redirect_detected: false,
        landing_flow_attempted: false,
        allowed_clicks_executed: 0,
        final_origin_after_landing: null
      };
      this.warmState.set(domain.key, result);
      this.recordOriginWarmState(domain, result);
      return result;
    }
  }

  async executeAction(actionName, input) {
    const action = getAction(actionName);
    if (!action) {
      throw publicError(404, "unknown_action", "Unknown action");
    }

    validateActionInput(input);
    const responseMode = actionResponseMode(input || {}, action);
    // @deprecated The non-passthrough branch is a legacy migration fallback for
    // old compat_summary consumers. Do not add new summary/source_card/
    // source_quality behavior here; new actions must be passthrough-only. This
    // branch is scheduled for removal after passthrough-only cutover.
    const passthrough = responseMode === "passthrough";

    const startedAt = Date.now();
    if (this.config.mode === "live" && !isPlatformEnabled(this.config, action.domainKey)) {
      if (passthrough) {
        return buildPassthroughFailureResponse(action, input, {
          latencyMs: Date.now() - startedAt,
          errorType: "platform_not_enabled"
        });
      }
      return buildActionDisabledByPlatformScopeResponse(action, this.config, {
        latencyMs: Date.now() - startedAt,
        outputScope: input?.output_scope
      });
    }

    const parameterError = getActionParameterError(action, input);
    if (parameterError) {
      const originWarmed = Boolean(this.warmState.get(action.domainKey)?.warmed);
      if (passthrough) {
        return buildPassthroughFailureResponse(action, input, {
          latencyMs: Date.now() - startedAt,
          errorType: parameterError.errorType || "parameter_error"
        });
      }
      return buildActionParameterErrorResponse(action, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        outputScope: input?.output_scope,
        parameterError
      });
    }

    if (this.config.mode === "mock") {
      const originWarmed = Boolean(this.warmState.get(action.domainKey)?.warmed);
      return runMockAction(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed
      });
    }

    if (!this.warmState.get(action.domainKey)?.warmed) {
      await this.prewarmDomain(action.domainKey);
    }

    let originWarmed = Boolean(this.warmState.get(action.domainKey)?.warmed);
    const actionRequest = buildActionBody(action, input);
    let actionDiagnostics = this.browserClient.actionDiagnostics(action, originWarmed);
    const lazyMeta = {
      lazyRewarmAttempted: false,
      lazyRewarmStatus: "not_attempted",
      pageReadyBeforeFetch: Boolean(actionDiagnostics.page_ready),
      boundPageOriginBeforeRewarm: actionDiagnostics.bound_page_origin || null,
      boundPageOriginAfterRewarm: actionDiagnostics.bound_page_origin || null
    };

    if (shouldLazyRewarm(actionDiagnostics)) {
      lazyMeta.lazyRewarmAttempted = true;
      const rewarmResult = await this.prewarmDomain(action.domainKey);
      lazyMeta.lazyRewarmStatus = rewarmResult.warmed ? "ready" : rewarmResult.error_type || rewarmResult.status || "failed";
      originWarmed = Boolean(rewarmResult.warmed);
      actionDiagnostics = this.browserClient.actionDiagnostics(action, originWarmed);
      lazyMeta.boundPageOriginAfterRewarm = actionDiagnostics.bound_page_origin || null;
      lazyMeta.pageReadyBeforeFetch = Boolean(actionDiagnostics.page_ready);
    }

    if (!actionDiagnostics.origin_match || !actionDiagnostics.page_ready) {
      const errorType = this.warmState.get(action.domainKey)?.error_type || "origin_mismatch";
      if (passthrough) {
        return buildPassthroughFailureResponse(action, input, {
          latencyMs: Date.now() - startedAt,
          errorType
        });
      }
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics,
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType),
        requestPath: actionRequest.displayPath || actionRequest.path,
        requestMethod: actionRequest.method,
        ...lazyMeta
      });
    }

    try {
      const fetchResult = await this.browserClient.runAction(action, actionRequest);
      if (passthrough) {
        return buildPassthroughActionResponse(action, input, fetchResult, {
          latencyMs: Date.now() - startedAt
        });
      }
      const fallbackReason = loginLogsFallbackReason(action, input, fetchResult);
      if (fallbackReason) {
        const firstAttemptResponse = buildLiveActionResponse(action, input, this.config, fetchResult, {
          latencyMs: Date.now() - startedAt,
          originWarmed,
          actionDiagnostics,
          requestPath: actionRequest.displayPath || actionRequest.path,
          requestMethod: actionRequest.method,
          ...lazyMeta
        });
        const fallbackInput = buildLoginLogsFallbackInput(input);
        const fallbackRequest = buildActionBody(action, fallbackInput);
        const fallbackFetchResult = await this.browserClient.runAction(action, fallbackRequest);
        return buildLiveActionResponse(action, fallbackInput, this.config, fallbackFetchResult, {
          latencyMs: Date.now() - startedAt,
          originWarmed,
          actionDiagnostics,
          requestPath: fallbackRequest.displayPath || fallbackRequest.path,
          requestMethod: fallbackRequest.method,
          loginLogsFallbackAttempted: true,
          loginLogsFallbackReason: fallbackReason,
          loginLogsInitialDiagnostics: firstAttemptResponse.data?.response_summary?.login_logs?.diagnostics || null,
          ...lazyMeta
        });
      }
      return buildLiveActionResponse(action, input, this.config, fetchResult, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics,
        requestPath: actionRequest.displayPath || actionRequest.path,
        requestMethod: actionRequest.method,
        ...lazyMeta
      });
    } catch (error) {
      const errorType = classifyError(error);
      if (passthrough) {
        return buildPassthroughFailureResponse(action, input, {
          latencyMs: Date.now() - startedAt,
          errorType
        });
      }
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics: this.browserClient.actionDiagnostics(action, originWarmed),
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType),
        requestPath: actionRequest.displayPath || actionRequest.path,
        requestMethod: actionRequest.method,
        ...lazyMeta
      });
    }
  }

  async executeBatch(input = {}) {
    const startedAt = Date.now();
    const plan = buildBatchPlan(input);
    const sourceResults = {};
    const groupResults = [];

    for (const group of plan.groups) {
      const groupStartedAt = Date.now();
      const sources = isParallelExecution(group.execution)
        ? await Promise.all(group.sources.map((source) => this.executeBatchSource(source, plan)))
        : await executeSerial(group.sources, (source) => this.executeBatchSource(source, plan));

      for (const sourceResult of sources) {
        sourceResults[sourceResult.source_id] = sourceResult;
      }

      groupResults.push({
        group_id: group.group_id,
        execution: group.execution,
        dependency_group_ids: group.depends_on,
        source_ids: group.sources.map((source) => source.source_id),
        latency_ms: Date.now() - groupStartedAt,
        completed_at: new Date().toISOString()
      });
    }

    const sourceQualityMatrix = buildSourceQualityMatrix(sourceResults);
    const classifications = buildBatchClassifications(sourceQualityMatrix);
    const missingEvidence = buildMissingEvidence(sourceQualityMatrix);

    return {
      ok: true,
      request_id: plan.request_id,
      response_mode: "controlled_batch_passthrough",
      batch_status: batchStatus(classifications, sourceQualityMatrix),
      service_mode: this.config.mode,
      execution_started_at: plan.started_at,
      latency_ms: Date.now() - startedAt,
      scheduler: {
        execution_model: "controlled_parallel",
        group_count: plan.groups.length,
        source_count: plan.source_count,
        default_source_timeout_ms: plan.default_timeout_ms,
        max_source_timeout_ms: MAX_BATCH_SOURCE_TIMEOUT_MS,
        raw_body_output: false
      },
      execution_groups: groupResults,
      source_results: sourceResults,
      source_quality_matrix: sourceQualityMatrix,
      classifications,
      evidence_card_inputs: {
        generated_by: "browser_backed_batch_executor",
        final_risk_judgement: false,
        raw_body_suppressed: true,
        source_statuses: Object.values(sourceQualityMatrix).map((quality) => ({
          source_id: quality.source_id,
          action: quality.action,
          category: quality.category,
          source_status: quality.source_status,
          error_type: quality.error_type
        })),
        missing_evidence: missingEvidence
      },
      missing_evidence: missingEvidence,
      safety: batchSafety()
    };
  }

  async executeBatchSource(source, plan) {
    const startedAt = Date.now();
    if (source.validation_error) {
      return buildBatchSourceResult({
        source,
        plan,
        category: "blocked",
        sourceStatus: "parameter_error",
        errorType: source.validation_error.error_type,
        latencyMs: Date.now() - startedAt,
        response: null,
        validationError: source.validation_error
      });
    }

    if (plan.dry_run) {
      return buildBatchSourceResult({
        source,
        plan,
        category: "planned",
        sourceStatus: "planned",
        errorType: null,
        latencyMs: Date.now() - startedAt,
        response: null
      });
    }

    try {
      const response = await withSourceTimeout(
        () => this.executeAction(source.action, source.params),
        source.timeout_ms
      );
      if (response?.timed_out) {
        return buildBatchSourceResult({
          source,
          plan,
          category: "timeout",
          sourceStatus: "timeout",
          errorType: "timeout",
          latencyMs: Date.now() - startedAt,
          response: null,
          timedOut: true
        });
      }

      return buildBatchSourceResult({
        source,
        plan,
        category: classifyBatchSourceResult(response),
        sourceStatus: sourceStatusFromBatchResponse(response),
        errorType: errorTypeFromBatchResponse(response),
        latencyMs: Date.now() - startedAt,
        response
      });
    } catch (error) {
      return buildBatchSourceResult({
        source,
        plan,
        category: "blocked",
        sourceStatus: "blocked",
        errorType: classifyError(error),
        latencyMs: Date.now() - startedAt,
        response: null,
        exceptionMessage: sanitizeErrorMessage(error)
      });
    }
  }

  warmedOrigins() {
    return Object.values(this.config.domains).map((domain) => {
      const state = this.warmState.get(domain.key) || defaultWarmState(domain, this.config);
      if (this.browserClient?.domainState && this.config.mode === "live") {
        const browserState = this.browserClient.domainState(domain.key);
        return {
          ...state,
          current_origin: browserState.current_origin,
          page_ready: browserState.page_ready,
          last_error_type: state.error_type || state.last_error_type || null,
          last_landing_flow_status: state.last_landing_flow_status || "not_started"
        };
      }
      return state;
    });
  }

  async close() {
    if (this.browserClient) {
      await this.browserClient.close();
    }
  }

  recordOriginWarmState(domain, result) {
    if (this.config.mode !== "live") {
      return;
    }
    this.refreshState = updateOriginWarmState(this.refreshState, domain, result);
    this.persistRefreshState();
  }

  persistRefreshState({ incrementRefreshCount = false } = {}) {
    if (this.config.mode !== "live") {
      return;
    }
    if (incrementRefreshCount) {
      this.refreshState = {
        ...this.refreshState,
        refresh_count: (Number(this.refreshState.refresh_count) || 0) + 1
      };
    }
    this.refreshState = saveRefreshState(this.refreshState, this.config.stateFile);
  }
}

const BATCH_EXECUTION_MODES = Object.freeze([
  "independent_parallel",
  "dependency_serial",
  "large_response_serial",
  "auth_sensitive_serial"
]);
const DEFAULT_BATCH_SOURCE_TIMEOUT_MS = 30_000;
const MAX_BATCH_SOURCE_TIMEOUT_MS = 120_000;
const MAX_BATCH_GROUPS = 12;
const MAX_BATCH_SOURCES = 30;
const SAFE_BATCH_ID_PATTERN = /^[A-Za-z0-9_:-]{1,96}$/;

function buildBatchPlan(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw publicError(400, "invalid_batch_request", "Batch request body must be an object");
  }
  validateActionInput(input);

  const groupsInput = Array.isArray(input.execution_groups)
    ? input.execution_groups
    : Array.isArray(input.sources)
      ? [{ group_id: "default_parallel", execution: "independent_parallel", sources: input.sources }]
      : null;
  if (!groupsInput || groupsInput.length === 0) {
    throw publicError(400, "invalid_batch_request", "Batch request must include execution_groups or sources");
  }
  if (groupsInput.length > MAX_BATCH_GROUPS) {
    throw publicError(400, "invalid_batch_request", `Batch can include at most ${MAX_BATCH_GROUPS} groups`);
  }

  const requestId = safeBatchId(input.request_id, batchRequestId());
  const defaultTimeoutMs = boundedTimeout(input.default_timeout_ms, DEFAULT_BATCH_SOURCE_TIMEOUT_MS);
  const groupIds = new Set();
  const sourceIds = new Set();
  let sourceCount = 0;

  const groups = groupsInput.map((groupInput, groupIndex) => {
    if (!groupInput || typeof groupInput !== "object" || Array.isArray(groupInput)) {
      throw publicError(400, "invalid_batch_request", "Each execution group must be an object");
    }
    const groupId = safeBatchId(groupInput.group_id, `group_${groupIndex + 1}`);
    if (groupIds.has(groupId)) {
      throw publicError(400, "invalid_batch_request", `Duplicate group_id: ${groupId}`);
    }
    groupIds.add(groupId);

    const execution = groupInput.execution || "independent_parallel";
    if (!BATCH_EXECUTION_MODES.includes(execution)) {
      throw publicError(400, "invalid_batch_request", `Unsupported execution mode: ${execution}`);
    }
    const sourcesInput = groupInput.sources;
    if (!Array.isArray(sourcesInput) || sourcesInput.length === 0) {
      throw publicError(400, "invalid_batch_request", `Group ${groupId} must include sources`);
    }

    const sources = sourcesInput.map((sourceInput, sourceIndex) => {
      const source = normalizeBatchSource(sourceInput, {
        groupId,
        groupIndex,
        sourceIndex,
        defaultTimeoutMs
      });
      if (sourceIds.has(source.source_id)) {
        throw publicError(400, "invalid_batch_request", `Duplicate source_id: ${source.source_id}`);
      }
      sourceIds.add(source.source_id);
      return source;
    });

    sourceCount += sources.length;
    if (sourceCount > MAX_BATCH_SOURCES) {
      throw publicError(400, "invalid_batch_request", `Batch can include at most ${MAX_BATCH_SOURCES} sources`);
    }

    return {
      group_id: groupId,
      execution,
      depends_on: normalizeDependsOn(groupInput.depends_on),
      sources
    };
  });

  const groupIndexById = new Map(groups.map((group, index) => [group.group_id, index]));
  for (const [groupIndex, group] of groups.entries()) {
    for (const dependency of group.depends_on) {
      if (!groupIds.has(dependency)) {
        throw publicError(400, "invalid_batch_request", `Unknown dependency group_id: ${dependency}`);
      }
      if ((groupIndexById.get(dependency) ?? Number.POSITIVE_INFINITY) >= groupIndex) {
        throw publicError(
          400,
          "invalid_batch_request",
          `Dependency group_id must appear before dependent group: ${dependency}`
        );
      }
    }
  }

  return {
    request_id: requestId,
    dry_run: input.dry_run === true,
    started_at: new Date().toISOString(),
    default_timeout_ms: defaultTimeoutMs,
    source_count: sourceCount,
    groups
  };
}

function normalizeBatchSource(sourceInput, { groupId, sourceIndex, defaultTimeoutMs }) {
  if (!sourceInput || typeof sourceInput !== "object" || Array.isArray(sourceInput)) {
    throw publicError(400, "invalid_batch_request", `Source ${groupId}/${sourceIndex + 1} must be an object`);
  }
  validateActionInput(sourceInput);

  const actionName = sourceInput.action || sourceInput.action_name;
  if (typeof actionName !== "string" || !SAFE_BATCH_ID_PATTERN.test(actionName)) {
    throw publicError(400, "invalid_batch_request", "Each source must include an allowlisted action");
  }
  const action = getAction(actionName);
  if (!action) {
    throw publicError(400, "unknown_action", `Unknown action in batch: ${actionName}`);
  }

  const rawParams = sourceInput.params && typeof sourceInput.params === "object" && !Array.isArray(sourceInput.params)
    ? sourceInput.params
    : {};
  validateActionInput(rawParams);

  const params = {
    ...rawParams,
    response_mode: "passthrough"
  };
  const sourceId = safeBatchId(sourceInput.source_id, `${actionName}_${sourceIndex + 1}`);
  const timeoutMs = boundedTimeout(sourceInput.timeout_ms, defaultTimeoutMs);
  const validationError = rawParams.response_mode && rawParams.response_mode !== "passthrough"
    ? {
        error_type: "invalid_parameter",
        message: "Batch sources must use response_mode=passthrough"
      }
    : null;

  return {
    source_id: sourceId,
    action: action.name,
    origin_key: action.domainKey,
    params,
    timeout_ms: timeoutMs,
    validation_error: validationError
  };
}

function normalizeDependsOn(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => safeBatchId(item, null)).filter(Boolean);
}

function safeBatchId(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!SAFE_BATCH_ID_PATTERN.test(trimmed)) {
    throw publicError(400, "invalid_batch_request", "Batch ids must contain only letters, numbers, underscore, colon, or hyphen");
  }
  return trimmed;
}

function boundedTimeout(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw publicError(400, "invalid_batch_request", "timeout_ms must be a positive number");
  }
  return Math.min(Math.max(Math.trunc(number), 100), MAX_BATCH_SOURCE_TIMEOUT_MS);
}

function isParallelExecution(execution) {
  return execution === "independent_parallel";
}

async function executeSerial(sources, runner) {
  const results = [];
  for (const source of sources) {
    results.push(await runner(source));
  }
  return results;
}

function withSourceTimeout(runner, timeoutMs) {
  let timer = null;
  return Promise.race([
    Promise.resolve().then(runner),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timed_out: true }), timeoutMs);
    })
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function buildBatchSourceResult({
  source,
  category,
  sourceStatus,
  errorType,
  latencyMs,
  response,
  timedOut = false,
  validationError = null,
  exceptionMessage = null
}) {
  const upstream = summarizeBatchUpstream(response);
  return {
    source_id: source.source_id,
    action: source.action,
    origin: source.origin_key,
    response_mode: "passthrough",
    category,
    source_status: sourceStatus,
    error_type: errorType,
    ok: category === "completed" || category === "no_data" || category === "partial" || category === "planned",
    timed_out: timedOut,
    timeout_ms: source.timeout_ms,
    latency_ms: latencyMs,
    upstream,
    normalized_observation: buildBatchObservation(source, response, category, sourceStatus, errorType, upstream),
    evidence_card_inputs: {
      action: source.action,
      origin: source.origin_key,
      category,
      source_status: sourceStatus,
      error_type: errorType,
      raw_body_suppressed: true
    },
    raw_body_suppressed: true,
    source_quality: buildBatchSourceQuality({
      source,
      category,
      sourceStatus,
      errorType,
      latencyMs,
      upstream,
      timedOut
    }),
    ...(validationError ? { validation_error: validationError } : {}),
    ...(exceptionMessage ? { error_message_sanitized: exceptionMessage } : {})
  };
}

function summarizeBatchUpstream(response) {
  const upstream = response?.upstream || null;
  if (upstream) {
    return {
      status: upstream.status ?? null,
      content_type: upstream.content_type ?? null,
      body_present: upstream.body !== undefined && upstream.body !== null,
      body_omitted: Boolean(upstream.body_omitted),
      response_too_large: Boolean(upstream.response_too_large),
      error_type: upstream.error_type || null,
      raw_body_suppressed: true
    };
  }
  const data = response?.data || null;
  return {
    status: data?.http_status ?? null,
    content_type: null,
    body_present: Boolean(data?.response_summary),
    body_omitted: Boolean(data?.body_truncated),
    response_too_large: Boolean(data?.body_truncated),
    error_type: response?.error_type || null,
    raw_body_suppressed: true
  };
}

function buildBatchObservation(source, response, category, sourceStatus, errorType, upstream) {
  return {
    action: source.action,
    origin: source.origin_key,
    category,
    source_status: sourceStatus,
    error_type: errorType,
    upstream_status: upstream.status,
    upstream_content_type: upstream.content_type,
    upstream_body_present: upstream.body_present,
    upstream_body_omitted: upstream.body_omitted,
    raw_body_suppressed: true,
    source_quality_available: true,
    final_risk_judgement: false,
    output_contains_credential_material: false,
    safety: response?.safety || batchSafety()
  };
}

function buildBatchSourceQuality({ source, category, sourceStatus, errorType, latencyMs, upstream, timedOut }) {
  return {
    source_id: source.source_id,
    action: source.action,
    origin: source.origin_key,
    category,
    source_status: sourceStatus,
    error_type: errorType,
    upstream_status: upstream.status,
    latency_ms: latencyMs,
    timeout_ms: source.timeout_ms,
    timed_out: Boolean(timedOut),
    completed: category === "completed",
    no_data: category === "no_data",
    partial: category === "partial",
    auth_failed: category === "auth_failed",
    blocked: category === "blocked",
    parse_error: category === "parse_error",
    raw_body_suppressed: true
  };
}

function classifyBatchSourceResult(response) {
  const errorType = errorTypeFromBatchResponse(response);
  const status = sourceStatusFromBatchResponse(response);
  if (errorType) {
    return categoryFromErrorType(errorType);
  }
  if (/no[_-]?data|no[_-]?hit|completed_no_data/i.test(status)) {
    return "no_data";
  }
  if (/partial/i.test(status)) {
    return "partial";
  }
  if (/auth/i.test(status)) {
    return "auth_failed";
  }
  if (/blocked|denied|disabled|parameter/i.test(status)) {
    return "blocked";
  }
  if (/timeout/i.test(status)) {
    return "timeout";
  }
  if (/parse/i.test(status)) {
    return "parse_error";
  }
  if (response?.upstream) {
    if (response.upstream.body_omitted || response.upstream.response_too_large) {
      return "partial";
    }
    if (response.ok === true && response.upstream.body === null) {
      return "no_data";
    }
    if (response.ok === true) {
      return "completed";
    }
  }
  return response?.ok === false ? "blocked" : "completed";
}

function categoryFromErrorType(errorType) {
  if (/timeout|navigation_timeout/i.test(errorType)) {
    return "timeout";
  }
  if (/auth|landing|login/i.test(errorType)) {
    return "auth_failed";
  }
  if (/parse/i.test(errorType)) {
    return "parse_error";
  }
  if (/response_too_large|truncated/i.test(errorType)) {
    return "partial";
  }
  if (/blocked|denied|disabled|parameter|origin_mismatch|credential_material/i.test(errorType)) {
    return "blocked";
  }
  return "blocked";
}

function sourceStatusFromBatchResponse(response) {
  if (!response) {
    return "not_available";
  }
  return response.source_status || response.status || (response.ok === true ? "completed" : "failed");
}

function errorTypeFromBatchResponse(response) {
  return response?.error_type || response?.upstream?.error_type || null;
}

function buildSourceQualityMatrix(sourceResults) {
  return Object.fromEntries(
    Object.values(sourceResults).map((sourceResult) => [sourceResult.source_id, sourceResult.source_quality])
  );
}

function buildBatchClassifications(sourceQualityMatrix) {
  const classifications = {
    completed: [],
    no_data: [],
    partial: [],
    auth_failed: [],
    blocked: [],
    timeout: [],
    parse_error: [],
    planned: []
  };
  for (const quality of Object.values(sourceQualityMatrix)) {
    if (!classifications[quality.category]) {
      classifications[quality.category] = [];
    }
    classifications[quality.category].push(quality.source_id);
  }
  return classifications;
}

function buildMissingEvidence(sourceQualityMatrix) {
  return Object.values(sourceQualityMatrix)
    .filter((quality) => quality.category !== "completed" && quality.category !== "planned")
    .map((quality) => ({
      source_id: quality.source_id,
      action: quality.action,
      category: quality.category,
      error_type: quality.error_type,
      reason: missingEvidenceReason(quality)
    }));
}

function missingEvidenceReason(quality) {
  if (quality.category === "no_data") {
    return "source_returned_no_data";
  }
  if (quality.category === "partial") {
    return "source_partial_or_response_limited";
  }
  if (quality.category === "auth_failed") {
    return "auth_or_permission_flow_blocked";
  }
  if (quality.category === "timeout") {
    return "source_timed_out";
  }
  if (quality.category === "parse_error") {
    return "source_response_parse_error";
  }
  return "source_not_completed";
}

function batchStatus(classifications, sourceQualityMatrix) {
  const total = Object.keys(sourceQualityMatrix).length;
  if (classifications.planned.length === total) {
    return "planned";
  }
  if (classifications.completed.length === total) {
    return "completed";
  }
  if (classifications.completed.length > 0 || classifications.no_data.length > 0 || classifications.partial.length > 0) {
    return "partial";
  }
  return "failed";
}

function batchSafety() {
  return {
    credential_material_output: false,
    request_headers_output: false,
    browser_profile_material_output: false,
    raw_upstream_body_output: false,
    arbitrary_url_fetch: false
  };
}

function batchRequestId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `batch_${Date.now().toString(36)}_${random}`;
}

function defaultWarmState(domain, config) {
  return {
    key: domain.key,
    domain: domain.label,
    platform_enabled: domain.enabled !== false,
    origin: config.mode === "mock" ? "mock" : domain.origin || "unconfigured",
    configured_origin: config.mode === "mock" ? "mock" : domain.origin || "unconfigured",
    prewarm_path: domain.prewarmPath,
    initial_url: null,
    final_url: null,
    final_origin: null,
    current_origin: null,
    same_origin_expected: true,
    same_origin_actual: false,
    navigation_status: "not_started",
    status: "not_warmed",
    warmed: false,
    page_ready: false,
    latency_ms: null,
    error_type: null,
    error_message_sanitized: null,
    warmed_at: null,
    last_prewarm_at: null,
    last_error_type: null,
    last_landing_flow_status: "not_started",
    auth_redirect_detected: false,
    landing_flow_attempted: false,
    allowed_clicks_executed: 0,
    final_origin_after_landing: null
  };
}

function disabledWarmState(domain, config) {
  return {
    ...defaultWarmState(domain, config),
    status: "disabled",
    navigation_status: "disabled",
    error_type: "platform_not_enabled",
    error_message_sanitized: "Platform disabled by ENABLED_PLATFORMS",
    last_error_type: "platform_not_enabled"
  };
}

function enabledDomains(config) {
  if (config.mode !== "live") {
    return Object.values(config.domains);
  }
  return Object.values(config.domains).filter((domain) => isPlatformEnabled(config, domain.key));
}

function isPlatformEnabled(config, domainKey) {
  if (config.mode !== "live") {
    return true;
  }
  return Array.isArray(config.enabledPlatforms) && config.enabledPlatforms.includes(domainKey);
}

function classifyError(error) {
  if (error?.name === "TimeoutError" || /timeout/i.test(error?.message || "")) {
    return "navigation_timeout";
  }
  if (/origin/i.test(error?.message || "")) {
    return "origin_mismatch";
  }
  if (/net::|navigation|fetch|connection|dns|host/i.test(error?.message || "")) {
    return "network_error";
  }
  return "page_load_error";
}

function shouldLazyRewarm(actionDiagnostics) {
  return Boolean(
    (!actionDiagnostics.origin_match || !actionDiagnostics.page_ready) &&
      isAuthRedirectTarget({
        origin: actionDiagnostics.bound_page_origin,
        url: actionDiagnostics.bound_page_origin
      })
  );
}

export function publicError(statusCode, code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}
