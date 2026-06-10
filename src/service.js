import {
  ACTIONS,
  buildActionBody,
  buildLiveActionResponse,
  buildPassthroughFailureResponse,
  getAction,
  getActionParameterError,
  listActions,
  runMockAction,
  validateActionInput
} from "./actions.js";
import {
  computeAuthState,
  loadRefreshState,
  originFreshness,
  saveRefreshState,
  updateOriginWarmState
} from "./authState.js";
import { BrowserBackedClient } from "./browser.js";
import { isAuthRedirectTarget, sanitizeErrorMessage } from "./diagnostics.js";

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
    const originStatus = this.overlayLiveOriginStatus(authState.origin_status);
    const pendingManualLogin = authState.pending_manual_login === true || hasPendingManualLogin(originStatus);
    const authStateValue = pendingManualLogin ? "auth_required" : authState.auth_state;
    return {
      ok: true,
      service_mode: this.config.mode,
      browser_initialized: Boolean(browserStatus?.browser_initialized),
      context_initialized: Boolean(browserStatus?.context_initialized),
      profile_dir_configured: authState.profile_dir_configured,
      profile_exists: authState.profile_exists,
      state_file_configured: authState.state_file_configured,
      last_refresh_at: authState.last_refresh_at,
      auth_state: authStateValue,
      auth_status: authStateValue === "auth_required" ? "missing" : authStateValue,
      auth_state_expired: authStateValue === "expired" || authState.auth_state_expired,
      pending_manual_login: pendingManualLogin,
      next_step: pendingManualLogin ? "npm run worker:start" : authState.next_step,
      origin_ready_state_stale: authState.origin_ready_state_stale || Object.values(originStatus).some((entry) => entry.origin_ready_state_stale === true),
      origin_status: originStatus,
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

  async prewarmDomain(domainKey, options = {}) {
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

      const liveResult = await this.browserClient.prewarmDomain(domain.key, options);
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

    const startedAt = Date.now();
    if (this.config.mode === "live" && !isPlatformEnabled(this.config, action.domainKey)) {
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType: "platform_not_enabled",
        platformError: "platform_not_enabled"
      });
    }

    const parameterError = getActionParameterError(action, input);
    if (parameterError) {
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType: parameterError.errorType || "parameter_error",
        invalidParams: true,
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

    const freshnessResult = await this.ensureOriginFresh(action);
    if (!freshnessResult.ok) {
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType: freshnessResult.errorType,
        platformError: freshnessResult.platformError,
        authRedirectDetected: Boolean(freshnessResult.meta.auth_redirect_detected),
        ...freshnessResult.meta
      });
    }

    let originWarmed = Boolean(freshnessResult.originWarmed);
    const actionRequest = buildActionBody(action, input);
    let actionDiagnostics = this.browserClient.actionDiagnostics(action, originWarmed);
    const lazyMeta = {
      ...freshnessResult.meta,
      lazyRewarmAttempted: false,
      lazyRewarmStatus: "not_attempted",
      pageReadyBeforeFetch: Boolean(actionDiagnostics.page_ready),
      boundPageOriginBeforeRewarm: actionDiagnostics.bound_page_origin || null,
      boundPageOriginAfterRewarm: actionDiagnostics.bound_page_origin || null
    };

    const actionSessionRewarmAlreadyDone = freshnessResult.meta.freshness_rewarm_attempted === true &&
      freshnessResult.meta.freshness_rewarm_status === "ready";
    const forceActionRewarm = shouldForceActionRewarm(action) && !actionSessionRewarmAlreadyDone;
    if (originWarmed && (forceActionRewarm || shouldLazyRewarm(action, actionDiagnostics))) {
      lazyMeta.lazyRewarmAttempted = true;
      lazyMeta.lazyRewarmReason = forceActionRewarm
        ? "action_requires_fresh_page_session"
        : "page_not_ready_or_origin_mismatch";
      const rewarmResult = await this.prewarmDomain(action.domainKey, actionStagePrewarmOptions(action));
      lazyMeta.lazyRewarmStatus = rewarmResult.warmed ? "ready" : rewarmResult.error_type || rewarmResult.status || "failed";
      originWarmed = Boolean(rewarmResult.warmed);
      Object.assign(lazyMeta, this.freshnessMeta(action.domainKey, {
        freshness_check_attempted: true,
        freshness_rewarm_attempted: true,
        freshness_rewarm_status: lazyMeta.lazyRewarmStatus
      }));
      actionDiagnostics = this.browserClient.actionDiagnostics(action, originWarmed);
      lazyMeta.boundPageOriginAfterRewarm = actionDiagnostics.bound_page_origin || null;
      lazyMeta.pageReadyBeforeFetch = Boolean(actionDiagnostics.page_ready);
    }

    if (!actionDiagnostics.origin_match || !actionDiagnostics.page_ready) {
      const errorType = this.warmState.get(action.domainKey)?.error_type || "origin_mismatch";
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType,
        authRedirectDetected: Boolean(actionDiagnostics.auth_redirect_detected),
        ...lazyMeta
      });
    }

    try {
      if (isContextRequestAction(action, this.browserClient)) {
        try {
          const fetchResult = await this.browserClient.runActionWithContextRequest(action, actionRequest);
          const response = buildLiveActionResponse(action, input, this.config, fetchResult, {
            latencyMs: Date.now() - startedAt,
            authRedirectDetected: Boolean(actionDiagnostics.auth_redirect_detected),
            ...lazyMeta
          });
          if (shouldRetryAfterRecoverableResponse(action, response)) {
            if (action.domainKey === "archives") {
              return this.retryAfterPageSessionRefresh({
                action,
                input,
                actionRequest,
                startedAt,
                baseMeta: lazyMeta,
                reason: response.safe_reason || response.error_type || "recoverable_business_auth_required"
              });
            }
            return this.retryAfterContextRequestRecovery({
              action,
              input,
              actionRequest,
              startedAt,
              baseMeta: lazyMeta,
              reason: response.safe_reason || response.error_type || "recoverable_business_auth_required"
            });
          }
          return response;
        } catch (error) {
          const failure = classifyActionFetchFailure(error, action, actionDiagnostics);
          const errorType = failure.errorType;
          if (shouldRetryAfterContextRequestError(errorType)) {
            return this.retryAfterContextRequestRecovery({
              action,
              input,
              actionRequest,
              startedAt,
              baseMeta: lazyMeta,
              reason: failure.safeReason || errorType
            });
          }
          return buildPassthroughFailureResponse(action, input, {
            latencyMs: Date.now() - startedAt,
            errorType,
            safe_reason: failure.safeReason,
            platformError: failure.platformError,
            timeoutStage: timeoutStageForFetchError(errorType, "api_fetch_timeout"),
            ...lazyMeta
          });
        }
      }

      const fetchResult = await this.browserClient.runAction(action, actionRequest);
      const response = buildLiveActionResponse(action, input, this.config, fetchResult, {
        latencyMs: Date.now() - startedAt,
        authRedirectDetected: Boolean(actionDiagnostics.auth_redirect_detected),
        ...lazyMeta
      });
      if (shouldRetryAfterRecoverableResponse(action, response)) {
        return this.retryAfterPageSessionRefresh({
          action,
          input,
          actionRequest,
          startedAt,
          baseMeta: lazyMeta,
          reason: response.safe_reason || response.error_type || "recoverable_business_auth_required"
        });
      }
      if (shouldRetryAfterPageSessionResponse(action, response)) {
        return this.retryAfterPageSessionRefresh({
          action,
          input,
          actionRequest,
          startedAt,
          baseMeta: lazyMeta,
          reason: pageSessionRetryReason(response)
        });
      }
      return response;
    } catch (error) {
      const failure = classifyActionFetchFailure(error, action, actionDiagnostics);
      const errorType = failure.errorType;
      if (shouldRetryAfterPageSessionError(action, errorType)) {
        return this.retryAfterPageSessionRefresh({
          action,
          input,
          actionRequest,
          startedAt,
          baseMeta: lazyMeta,
          reason: failure.safeReason || timeoutStageForFetchError(errorType, defaultTimeoutStageForAction(action)) || errorType
        });
      }
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType,
        safe_reason: failure.safeReason,
        platformError: failure.platformError,
        timeoutStage: timeoutStageForFetchError(errorType, defaultTimeoutStageForAction(action)),
        ...lazyMeta
      });
    }
  }

  async retryAfterPageSessionRefresh({ action, input, actionRequest, startedAt, baseMeta, reason }) {
    const staleSafeReason = pageSessionStaleSafeReason(action, reason);
    const retryMeta = {
      ...baseMeta,
      page_context_retry_attempted: true,
      page_context_retry_reason: staleSafeReason,
      page_context_retry_status: "not_attempted"
    };
    const rewarmResult = await this.prewarmDomain(action.domainKey, actionStagePrewarmOptions(action));
    retryMeta.page_context_retry_status = rewarmResult.warmed
      ? "ready"
      : rewarmResult.error_type || rewarmResult.status || "failed";
    Object.assign(retryMeta, this.freshnessMeta(action.domainKey, {
      freshness_check_attempted: true,
      freshness_rewarm_attempted: true,
      freshness_rewarm_status: retryMeta.page_context_retry_status,
      auth_redirect_detected: Boolean(rewarmResult.auth_redirect_detected),
      landing_flow_status: rewarmResult.last_landing_flow_status || rewarmResult.landing_flow_status || null
    }));

    if (!rewarmResult.warmed || retryMeta.origin_ready_state_stale === true) {
      const errorType = rewarmFailureErrorType(rewarmResult);
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType,
        platformError: errorType,
        authRedirectDetected: Boolean(rewarmResult.auth_redirect_detected),
        safe_reason: staleSafeReason,
        nextStep: "npm run worker:start",
        ...retryMeta
      });
    }

    try {
      const retryFetchResult = isContextRequestAction(action, this.browserClient)
        ? await this.browserClient.runActionWithContextRequest(action, actionRequest)
        : await this.browserClient.runAction(action, actionRequest);
      return buildLiveActionResponse(action, input, this.config, retryFetchResult, {
        latencyMs: Date.now() - startedAt,
        authRedirectDetected: false,
        ...retryMeta
      });
    } catch (error) {
      const errorType = classifyError(error);
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType,
        timeoutStage: timeoutStageForFetchError(errorType, defaultTimeoutStageForAction(action)),
        safe_reason: staleSafeReason,
        ...retryMeta
      });
    }
  }

  async retryAfterContextRequestRecovery({ action, input, actionRequest, startedAt, baseMeta, reason }) {
    const retryMeta = {
      ...baseMeta,
      context_request_recovery_attempted: true,
      context_request_recovery_reason: reason || "network_error",
      context_request_recovery_status: "not_attempted"
    };

    try {
      if (typeof this.browserClient?.close === "function") {
        await this.browserClient.close();
      }
      if (typeof this.browserClient?.start === "function") {
        await this.browserClient.start();
      }
      const rewarmResult = await this.prewarmDomain(action.domainKey, actionStagePrewarmOptions(action));
      retryMeta.context_request_recovery_status = rewarmResult.warmed
        ? "ready"
        : rewarmResult.error_type || rewarmResult.status || "failed";
      Object.assign(retryMeta, this.freshnessMeta(action.domainKey, {
        freshness_check_attempted: true,
        freshness_rewarm_attempted: true,
        freshness_rewarm_status: retryMeta.context_request_recovery_status,
        auth_redirect_detected: Boolean(rewarmResult.auth_redirect_detected),
        landing_flow_status: rewarmResult.last_landing_flow_status || rewarmResult.landing_flow_status || null
      }));

      if (!rewarmResult.warmed || retryMeta.origin_ready_state_stale === true) {
        const errorType = rewarmFailureErrorType(rewarmResult);
        return buildPassthroughFailureResponse(action, input, {
          latencyMs: Date.now() - startedAt,
          errorType,
          platformError: errorType,
          authRedirectDetected: Boolean(rewarmResult.auth_redirect_detected),
          safe_reason: "context_request_not_recovered",
          nextStep: "npm run worker:start",
          ...retryMeta
        });
      }

      const retryFetchResult = await this.browserClient.runActionWithContextRequest(action, actionRequest);
      return buildLiveActionResponse(action, input, this.config, retryFetchResult, {
        latencyMs: Date.now() - startedAt,
        authRedirectDetected: false,
        ...retryMeta
      });
    } catch (error) {
      const failure = classifyActionFetchFailure(error, action, this.browserClient.actionDiagnostics(action, false));
      const errorType = failure.errorType;
      return buildPassthroughFailureResponse(action, input, {
        latencyMs: Date.now() - startedAt,
        errorType,
        safe_reason: failure.safeReason || "context_request_not_recovered",
        platformError: failure.platformError,
        timeoutStage: timeoutStageForFetchError(errorType, "api_fetch_timeout"),
        ...retryMeta
      });
    }
  }

  async executeBatch(input = {}) {
    const startedAt = Date.now();
    const plan = buildBatchPlan(input);
    const sourceResults = {};
    const groupResults = [];

    for (const group of plan.groups) {
      if (batchDeadlineExceeded(plan)) {
        const timedOutSources = group.sources.map((source) => buildBatchDeadlineTimeoutResult(source, plan));
        for (const sourceResult of timedOutSources) {
          sourceResults[sourceResult.source_id] = sourceResult;
        }
        groupResults.push({
          group_id: group.group_id,
          execution: group.execution,
          dependency_group_ids: group.depends_on,
          source_ids: group.sources.map((source) => source.source_id),
          latency_ms: 0,
          completed_at: new Date().toISOString(),
          skipped_by_batch_deadline: true
        });
        continue;
      }
      const groupStartedAt = Date.now();
      const sources = isParallelExecution(group.execution)
        ? await executeConflictAwareParallel(group.sources, (source) => this.executeBatchSource(source, plan))
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

    const transportStatusMatrix = buildTransportStatusMatrix(sourceResults);
    const classifications = buildBatchClassifications(transportStatusMatrix);
    const missingOrFailedSources = buildMissingOrFailedSources(transportStatusMatrix);

    return {
      ok: true,
      request_id: plan.request_id,
      response_mode: "controlled_batch_passthrough",
      batch_status: batchStatus(classifications, transportStatusMatrix),
      service_mode: this.config.mode,
      execution_started_at: plan.started_at,
      latency_ms: Date.now() - startedAt,
      scheduler: {
        execution_model: "controlled_parallel",
        group_count: plan.groups.length,
        source_count: plan.source_count,
        default_source_timeout_ms: plan.default_timeout_ms,
        max_source_timeout_ms: MAX_BATCH_SOURCE_TIMEOUT_MS,
        batch_deadline_ms: plan.batch_deadline_ms,
        upstream_business_body_output: "bounded"
      },
      batch_payload_shape: summarizeBatchPlanShape(plan),
      execution_groups: groupResults,
      source_results: sourceResults,
      transport_status_matrix: transportStatusMatrix,
      completed_count: classifications.completed.length,
      no_data_count: classifications.no_data.length,
      partial_count: classifications.partial.length,
      auth_failed_count: classifications.auth_failed.length,
      blocked_count: classifications.blocked.length,
      timeout_count: classifications.timeout.length,
      parse_error_count: classifications.parse_error.length,
      planned_count: classifications.planned.length,
      failed_count: classifications.auth_failed.length +
        classifications.blocked.length +
        classifications.timeout.length +
        classifications.parse_error.length,
      classifications,
      missing_or_failed_sources: missingOrFailedSources,
      safety: batchSafety()
    };
  }

  async executeBatchSource(source, plan) {
    const startedAt = Date.now();
    const remainingMs = remainingBatchTimeMs(plan);
    if (remainingMs <= BATCH_DEADLINE_MARGIN_MS) {
      return buildBatchDeadlineTimeoutResult(source, plan);
    }
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
      const effectiveTimeoutMs = Math.max(
        MIN_BATCH_SOURCE_TIMEOUT_MS,
        Math.min(source.timeout_ms, remainingMs - BATCH_DEADLINE_MARGIN_MS)
      );
      const response = await withSourceTimeout(
        () => this.executeAction(source.action, source.params),
        effectiveTimeoutMs
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
          timedOut: true,
          timeoutStage: effectiveTimeoutMs < source.timeout_ms ? "batch_deadline" : "source_timeout"
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

  async ensureOriginFresh(action) {
    const domain = this.config.domains[action.domainKey];
    const beforeMeta = this.freshnessMeta(action.domainKey, {
      freshness_check_attempted: true,
      freshness_rewarm_attempted: false,
      freshness_rewarm_status: "not_needed"
    });
    const originWarmed = Boolean(this.warmState.get(action.domainKey)?.warmed);
    const needsRewarm = !originWarmed || beforeMeta.auth_state_expired === true || beforeMeta.origin_ready_state_stale === true;
    if (!needsRewarm) {
      return {
        ok: true,
        originWarmed,
        meta: beforeMeta
      };
    }

    const rewarmResult = await this.prewarmDomain(action.domainKey, actionStagePrewarmOptions(action));
    const afterMeta = this.freshnessMeta(action.domainKey, {
      freshness_check_attempted: true,
      freshness_rewarm_attempted: true,
      freshness_rewarm_status: rewarmResult.warmed ? "ready" : rewarmResult.error_type || rewarmResult.status || "failed",
      auth_redirect_detected: Boolean(rewarmResult.auth_redirect_detected),
      landing_flow_status: rewarmResult.last_landing_flow_status || rewarmResult.landing_flow_status || null
    });
    const targetFresh = rewarmResult.warmed === true && afterMeta.origin_ready_state_stale !== true;
    if (targetFresh) {
      return {
        ok: true,
        originWarmed: true,
        meta: afterMeta
      };
    }

    const errorType = rewarmFailureErrorType(rewarmResult);
    return {
      ok: false,
      originWarmed: false,
      errorType,
      platformError: errorType,
      meta: {
        ...afterMeta,
        safe_reason: "origin_ready_state_stale",
        nextStep: "npm run worker:start"
      }
    };
  }

  freshnessMeta(domainKey, extra = {}) {
    const domain = this.config.domains[domainKey];
    const authState = computeAuthState({
      profileDir: this.config.profileDir,
      stateFile: this.config.stateFile,
      origins: Object.values(this.config.domains),
      refreshState: this.refreshState
    });
    const freshness = domain
      ? originFreshness(domain, this.refreshState)
      : {
          origin_ready_state_stale: true,
          origin_freshness_age_ms: null,
          origin_freshness_ttl_ms: null
        };
    return {
      auth_state: authState.auth_state,
      auth_state_expired: authState.auth_state === "expired",
      origin_ready_state_stale: freshness.origin_ready_state_stale,
      origin_freshness_age_ms: freshness.origin_freshness_age_ms,
      origin_freshness_ttl_ms: freshness.origin_freshness_ttl_ms,
      pending_manual_login: authState.pending_manual_login,
      nextStep: authState.pending_manual_login ? "npm run worker:start" : null,
      ...extra
    };
  }

  overlayLiveOriginStatus(originStatus = {}) {
    const output = { ...originStatus };
    if (!this.browserClient?.domainState || this.config.mode !== "live") {
      return output;
    }
    for (const domain of Object.values(this.config.domains)) {
      if (!domain?.key || domain.enabled === false) {
        continue;
      }
      const browserState = this.browserClient.domainState(domain.key);
      if (!browserState?.current_origin) {
        continue;
      }
      const currentOrigin = browserState.current_origin;
      const base = output[domain.key] || {};
      const authRedirect = isAuthRedirectTarget({
        origin: currentOrigin,
        url: browserState.current_url || currentOrigin
      });
      const originMatch = currentOrigin === domain.origin;
      if (browserState.page_ready === true && originMatch) {
        output[domain.key] = {
          ...base,
          current_origin: currentOrigin,
          final_origin: base.final_origin || currentOrigin,
          page_ready: true
        };
        continue;
      }
      output[domain.key] = {
        ...base,
        current_origin: currentOrigin,
        final_origin: currentOrigin,
        status: authRedirect ? "auth_required" : base.status || "failed",
        error_type: authRedirect ? "auth_redirect" : base.error_type || "origin_mismatch",
        last_error_type: authRedirect ? "auth_redirect" : base.last_error_type || "origin_mismatch",
        page_ready: false,
        warmed: false,
        origin_ready_state_stale: true,
        pending_manual_login: authRedirect || base.pending_manual_login === true,
        next_step: authRedirect ? "npm run worker:start" : base.next_step || null
      };
    }
    return output;
  }

  warmedOrigins() {
    return Object.values(this.config.domains).map((domain) => {
      const state = this.warmState.get(domain.key) || defaultWarmState(domain, this.config);
      if (this.browserClient?.domainState && this.config.mode === "live") {
        const browserState = this.browserClient.domainState(domain.key) || {};
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
const MIN_BATCH_SOURCE_TIMEOUT_MS = 100;
const BATCH_DEADLINE_MARGIN_MS = 1_000;
const DEFAULT_BATCH_DEADLINE_OVERHEAD_MS = 10_000;
const MAX_BATCH_DEADLINE_MS = 115_000;
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
  let maxSourceTimeoutMs = defaultTimeoutMs;

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
      maxSourceTimeoutMs = Math.max(maxSourceTimeoutMs, source.timeout_ms);
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
    deadline_started_at_ms: Date.now(),
    default_timeout_ms: defaultTimeoutMs,
    batch_deadline_ms: boundedBatchDeadline(input.batch_timeout_ms, maxSourceTimeoutMs),
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
    fetch_mode: action.fetchMode || "context_request",
    params,
    timeout_ms: timeoutMs,
    validation_error: validationError
  };
}

function summarizeBatchPlanShape(plan) {
  return {
    request_id: plan.request_id,
    group_count: plan.groups.length,
    source_count: plan.source_count,
    groups: plan.groups.map((group) => ({
      group_id: group.group_id,
      execution: group.execution,
      dependency_group_ids: group.depends_on,
      source_count: group.sources.length,
      sources: group.sources.map((source) => ({
        source_id: source.source_id,
        action: source.action
      }))
    }))
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

function boundedBatchDeadline(value, maxSourceTimeoutMs) {
  const fallback = Math.min(
    MAX_BATCH_DEADLINE_MS,
    Math.max(maxSourceTimeoutMs + DEFAULT_BATCH_DEADLINE_OVERHEAD_MS, 20_000)
  );
  if (value === undefined || value === null) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw publicError(400, "invalid_batch_request", "batch_timeout_ms must be a positive number");
  }
  return Math.min(Math.max(Math.trunc(number), 1_000), MAX_BATCH_DEADLINE_MS);
}

function remainingBatchTimeMs(plan) {
  return Math.max(0, plan.deadline_started_at_ms + plan.batch_deadline_ms - Date.now());
}

function batchDeadlineExceeded(plan) {
  return remainingBatchTimeMs(plan) <= BATCH_DEADLINE_MARGIN_MS;
}

function buildBatchDeadlineTimeoutResult(source, plan) {
  return buildBatchSourceResult({
    source,
    plan,
    category: "timeout",
    sourceStatus: "timeout",
    errorType: "batch_deadline_exceeded",
    latencyMs: 0,
    response: null,
    timedOut: true,
    timeoutStage: "batch_deadline"
  });
}

function isParallelExecution(execution) {
  return execution === "independent_parallel";
}

function actionStagePrewarmOptions(action) {
  return action?.domainKey === "archives" ? { allowLandingFlow: true } : {};
}

async function executeSerial(sources, runner) {
  const results = [];
  for (const source of sources) {
    results.push(await runner(source));
  }
  return results;
}

async function executeConflictAwareParallel(sources, runner) {
  const lanes = new Map();
  for (const source of sources) {
    const laneKey = batchConflictLaneKey(source);
    if (!lanes.has(laneKey)) {
      lanes.set(laneKey, []);
    }
    lanes.get(laneKey).push(source);
  }
  const laneResults = await Promise.all(
    [...lanes.values()].map((laneSources) => executeSerial(laneSources, runner))
  );
  return laneResults.flat();
}

function batchConflictLaneKey(source) {
  if (source.fetch_mode === "page_followup" || source.origin_key === "archives") {
    return "browser_session_exclusive";
  }
  return `parallel:${source.source_id}`;
}

function pageSessionStaleSafeReason(action, fallback) {
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback;
  }
  switch (action?.domainKey) {
    case "login_logs":
      return "login_logs_page_context_stale";
    case "weapon":
      return "weapon_page_context_stale";
    case "archives":
      return "archives_page_context_stale";
    default:
      return "page_context_stale";
  }
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
  timeoutStage = null,
  validationError = null,
  exceptionMessage = null
}) {
  const upstream = summarizeBatchUpstream(response);
  const sourceTimeoutStage = timedOut ? (timeoutStage || "source_timeout") : response?.timeout_stage || upstream.timeout_stage || timeoutStage || null;
  return {
    source_id: source.source_id,
    action: source.action,
    action_name: source.action,
    origin: source.origin_key,
    platform: source.origin_key,
    request_mode: "fixed_action",
    response_mode: "passthrough",
    category,
    source_status: sourceStatus,
    error_type: errorType,
    ok: category === "completed" || category === "no_data" || category === "partial" || category === "planned",
    timed_out: timedOut,
    timeout_stage: sourceTimeoutStage,
    timeout_ms: source.timeout_ms,
    latency_ms: latencyMs,
    http_status: upstream.status,
    content_type: upstream.content_type,
    body_present: upstream.body_present,
    body_truncated: upstream.body_truncated,
    safe_reason: upstream.safe_reason || response?.safe_reason || null,
    observed_bytes: upstream.observed_bytes,
    elapsed_ms: latencyMs,
    transport_error: timedOut ? "timeout" : null,
    platform_error: upstream.platform_error || null,
    invalid_params: Boolean(validationError || response?.invalid_params),
    timeout: timedOut,
    auth_redirect_detected: false,
    raw_body_handling: upstream.raw_body_handling,
    upstream,
    raw_body_suppressed: upstream.raw_body_suppressed,
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
      body_present: Boolean(upstream.body_present),
      body_omitted: Boolean(upstream.body_omitted),
      body_truncated: Boolean(upstream.body_truncated),
      response_too_large: Boolean(upstream.response_too_large),
      observed_bytes: upstream.observed_bytes ?? null,
      returned_bytes: upstream.returned_bytes ?? null,
      platform_error: response?.platform_error || null,
      error_type: upstream.error_type || null,
      safe_reason: response?.safe_reason || upstream.safe_reason || null,
      raw_body_handling: upstream.raw_body_handling || "omitted",
      raw_body_suppressed: Boolean(upstream.body_omitted && !Object.hasOwn(upstream, "body") && !Object.hasOwn(upstream, "body_snippet") && !Object.hasOwn(upstream, "capped_body")),
      ...(Object.hasOwn(upstream, "capped_json_path") ? { capped_json_path: upstream.capped_json_path } : {}),
      ...(Object.hasOwn(upstream, "observed_records") ? { observed_records: upstream.observed_records } : {}),
      ...(Object.hasOwn(upstream, "returned_records") ? { returned_records: upstream.returned_records } : {}),
      ...(Object.hasOwn(upstream, "missing_records") ? { missing_records: upstream.missing_records } : {}),
      ...(Object.hasOwn(upstream, "missing_body_reason") ? { missing_body_reason: upstream.missing_body_reason } : {}),
      ...(Object.hasOwn(upstream, "timeout_stage") ? { timeout_stage: upstream.timeout_stage } : {}),
      ...(Object.hasOwn(upstream, "body") ? { body: upstream.body } : {}),
      ...(Object.hasOwn(upstream, "body_snippet") ? { body_snippet: upstream.body_snippet } : {}),
      ...(Object.hasOwn(upstream, "capped_body") ? { capped_body: upstream.capped_body } : {})
    };
  }
  return {
    status: response?.http_status ?? null,
    content_type: null,
    body_present: Boolean(response?.body_present),
    body_omitted: true,
    body_truncated: Boolean(response?.body_truncated),
    response_too_large: Boolean(response?.body_truncated),
    observed_bytes: response?.observed_bytes ?? null,
    returned_bytes: null,
    platform_error: response?.platform_error || null,
    error_type: response?.error_type || null,
    safe_reason: response?.safe_reason || null,
    timeout_stage: response?.timeout_stage || null,
    raw_body_handling: response?.raw_body_handling || "omitted",
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
    if (response.ok === true && response.upstream.body_present === false) {
      return "no_data";
    }
    if (response.upstream.response_too_large) {
      return "partial";
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

function buildTransportStatusMatrix(sourceResults) {
  return Object.fromEntries(
    Object.values(sourceResults).map((sourceResult) => [
      sourceResult.source_id,
      {
        source_id: sourceResult.source_id,
        action: sourceResult.action,
        origin: sourceResult.origin,
        platform: sourceResult.platform,
        category: sourceResult.category,
        source_status: sourceResult.source_status,
        error_type: sourceResult.error_type,
        safe_reason: sourceResult.safe_reason,
        http_status: sourceResult.http_status,
        content_type: sourceResult.content_type,
        body_present: sourceResult.body_present,
        body_truncated: sourceResult.body_truncated,
        response_too_large: Boolean(sourceResult.upstream?.response_too_large),
        observed_bytes: sourceResult.observed_bytes,
        returned_bytes: sourceResult.upstream?.returned_bytes ?? null,
        elapsed_ms: sourceResult.elapsed_ms,
        timeout_ms: sourceResult.timeout_ms,
        timeout_stage: sourceResult.timeout_stage,
        timed_out: Boolean(sourceResult.timed_out),
        transport_error: sourceResult.transport_error,
        platform_error: sourceResult.platform_error,
        invalid_params: sourceResult.invalid_params,
        raw_body_handling: sourceResult.raw_body_handling
      }
    ])
  );
}

function buildBatchClassifications(transportStatusMatrix) {
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
  for (const status of Object.values(transportStatusMatrix)) {
    if (!classifications[status.category]) {
      classifications[status.category] = [];
    }
    classifications[status.category].push(status.source_id);
  }
  return classifications;
}

function buildMissingOrFailedSources(transportStatusMatrix) {
  return Object.values(transportStatusMatrix)
    .filter((status) => status.category !== "completed" && status.category !== "planned")
    .map((status) => ({
      source_id: status.source_id,
      action: status.action,
      category: status.category,
      error_type: status.error_type,
      reason: missingOrFailedReason(status)
    }));
}

function missingOrFailedReason(status) {
  if (status.category === "no_data") {
    return "source_returned_no_data";
  }
  if (status.category === "partial") {
    return "source_response_limited";
  }
  if (status.category === "auth_failed") {
    return "auth_or_permission_flow_blocked";
  }
  if (status.category === "timeout") {
    return "source_timed_out";
  }
  if (status.category === "parse_error") {
    return "source_response_parse_error";
  }
  return "source_not_completed";
}

function batchStatus(classifications, transportStatusMatrix) {
  const total = Object.keys(transportStatusMatrix).length;
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
    transport_auth_material_output: false,
    upstream_business_body_visible: true,
    raw_upstream_body_output: "bounded",
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
  if (error?.name === "TimeoutError" || /timeout|timed\s+out/i.test(error?.message || "")) {
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

function classifyActionFetchFailure(error, action, actionDiagnostics = {}) {
  const message = String(error?.message || "");
  const lowered = message.toLowerCase();
  if (error?.name === "TimeoutError" || /timeout|timed\s+out/i.test(message)) {
    return {
      errorType: "navigation_timeout",
      safeReason: action?.fetchMode === "page_followup" ? "page_followup_timeout" : "api_fetch_timeout",
      platformError: null
    };
  }
  if (actionDiagnostics?.auth_redirect_detected) {
    return {
      errorType: "auth_flow_not_completed_in_bound_context",
      safeReason: "auth_redirected_before_api_fetch",
      platformError: "auth_failed"
    };
  }
  if (actionDiagnostics?.origin_match === false) {
    return {
      errorType: "origin_mismatch",
      safeReason: "same_origin_context_not_ready",
      platformError: "page_context_not_ready"
    };
  }
  if (actionDiagnostics?.page_ready === false) {
    return {
      errorType: "page_load_error",
      safeReason: "page_context_not_ready",
      platformError: "page_context_not_ready"
    };
  }
  if (/target page, context or browser has been closed|browser has been closed|context closed|execution context was destroyed/i.test(lowered)) {
    return {
      errorType: "page_load_error",
      safeReason: "browser_context_closed",
      platformError: "page_context_not_ready"
    };
  }
  if (/err_name_not_resolved|dns|host resolver/i.test(lowered)) {
    return {
      errorType: "network_error",
      safeReason: "dns_or_host_resolution_failed",
      platformError: null
    };
  }
  if (/proxy|tunnel|certificate|ssl/i.test(lowered)) {
    return {
      errorType: "network_error",
      safeReason: "proxy_or_tls_network_failure",
      platformError: null
    };
  }
  if (/connection refused|econnrefused|connection reset|failed to fetch|fetch failed|net::|network/i.test(lowered)) {
    return {
      errorType: "network_error",
      safeReason: action?.fetchMode === "page_followup" ? "page_followup_fetch_failed" : "browser_context_request_failed",
      platformError: null
    };
  }
  if (/origin/i.test(lowered)) {
    return {
      errorType: "origin_mismatch",
      safeReason: "same_origin_context_not_ready",
      platformError: "page_context_not_ready"
    };
  }
  return {
    errorType: "page_load_error",
    safeReason: "unexpected_fetch_failure",
    platformError: null
  };
}

function shouldLazyRewarm(action, actionDiagnostics) {
  if (action?.fetchMode === "page_followup" && (!actionDiagnostics.origin_match || !actionDiagnostics.page_ready)) {
    return true;
  }
  return Boolean(
    (!actionDiagnostics.origin_match || !actionDiagnostics.page_ready) &&
      isAuthRedirectTarget({
        origin: actionDiagnostics.bound_page_origin,
        url: actionDiagnostics.bound_page_origin
      })
  );
}

function shouldForceActionRewarm(action) {
  return action?.name === "login_logs_search" || action?.domainKey === "archives";
}

function shouldRetryAfterPageSessionResponse(action, response) {
  if (action?.name !== "login_logs_search") {
    return false;
  }
  return [
    "unexpected_html_response",
    "auth_state_expired_or_api_session_not_ready",
    "login_logs_page_context_stale"
  ].includes(response?.error_type);
}

function shouldRetryAfterPageSessionError(action, errorType) {
  if (action?.name === "login_logs_search" && /timeout|navigation_timeout/i.test(String(errorType || ""))) {
    return true;
  }
  return action?.fetchMode === "page_followup" && /timeout|navigation_timeout|network_error|page_load_error/i.test(String(errorType || ""));
}

function shouldRetryAfterContextRequestError(errorType) {
  return /network_error|page_load_error/i.test(String(errorType || ""));
}

function shouldRetryAfterRecoverableResponse(action, response) {
  if (!response || response.ok !== false) {
    return false;
  }
  if (action?.domainKey === "archives" && response.safe_reason === "upstream_business_auth_required") {
    return true;
  }
  return false;
}

function pageSessionRetryReason(response) {
  if (response?.upstream?.response_body_kind === "html_page") {
    return "unexpected_html_response";
  }
  return response?.error_type || "login_logs_page_context_stale";
}

function rewarmFailureErrorType(rewarmResult) {
  const errorType = rewarmResult?.error_type || rewarmResult?.last_error_type || rewarmResult?.status;
  if ([
    "manual_login_required",
    "auth_required",
    "two_factor_required",
    "captcha_required",
    "permission_blocked"
  ].includes(errorType)) {
    return errorType;
  }
  return "origin_refresh_failed";
}

function hasPendingManualLogin(originStatus = {}) {
  return Object.values(originStatus).some((entry) => (
    entry?.pending_manual_login === true ||
    entry?.status === "auth_required" ||
    [
      "manual_login_required",
      "auth_required",
      "two_factor_required",
      "captcha_required",
      "password_required",
      "qr_required",
      "landing_flow_blocked",
      "auth_flow_not_completed_in_bound_context",
      "auth_redirect",
      "login_page"
    ].includes(entry?.error_type || entry?.last_error_type)
  ));
}

function isContextRequestAction(action, browserClient) {
  return Boolean(action?.fetchMode === "context_request" && typeof browserClient?.runActionWithContextRequest === "function");
}

function timeoutStageForFetchError(errorType, stage) {
  return /timeout|navigation_timeout/i.test(String(errorType || "")) ? stage : null;
}

function defaultTimeoutStageForAction(action) {
  if (action?.name === "login_logs_search") {
    return "api_fetch_timeout";
  }
  return action?.fetchMode === "page_followup" ? "page_followup_timeout" : null;
}

export function publicError(statusCode, code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}
