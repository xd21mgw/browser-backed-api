import {
  ACTIONS,
  buildActionBody,
  buildLiveActionFailureResponse,
  buildLiveActionResponse,
  getAction,
  listActions,
  runMockAction,
  validateActionInput
} from "./actions.js";
import { BrowserBackedClient } from "./browser.js";
import { isAuthRedirectTarget, sanitizeErrorMessage, sourceStatusFromErrorType } from "./diagnostics.js";

export class BrowserBackedApiService {
  constructor(config, browserClient = null) {
    this.config = config;
    this.startedAtMs = Date.now();
    this.browserClient = browserClient || (config.mode === "live" ? new BrowserBackedClient(config) : null);
    this.warmState = new Map(Object.values(config.domains).map((domain) => [domain.key, defaultWarmState(domain, config)]));
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
    return {
      ok: true,
      service_mode: this.config.mode,
      browser_initialized: Boolean(browserStatus?.browser_initialized),
      context_initialized: Boolean(browserStatus?.context_initialized),
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
    for (const domain of Object.values(this.config.domains)) {
      results.push(await this.prewarmDomain(domain.key));
    }

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
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics,
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType),
        ...lazyMeta
      });
    }

    try {
      const fetchResult = await this.browserClient.runAction(action, actionRequest);
      return buildLiveActionResponse(action, input, this.config, fetchResult, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics,
        ...lazyMeta
      });
    } catch (error) {
      const errorType = classifyError(error);
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics: this.browserClient.actionDiagnostics(action, originWarmed),
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType),
        ...lazyMeta
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
}

function defaultWarmState(domain, config) {
  return {
    key: domain.key,
    domain: domain.label,
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
