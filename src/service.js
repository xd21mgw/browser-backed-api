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
import { sanitizeErrorMessage, sourceStatusFromErrorType } from "./diagnostics.js";

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
          same_origin_expected: true,
          same_origin_actual: true,
          navigation_status: "simulated",
          status: "simulated",
          warmed: true,
          latency_ms: Date.now() - startedAt,
          error_type: null,
          error_message_sanitized: null,
          warmed_at: new Date().toISOString()
        };
        this.warmState.set(domain.key, result);
        return result;
      }

      const liveResult = await this.browserClient.prewarmDomain(domain.key);
      const warmed = liveResult.status === "ready" && liveResult.same_origin_actual === true;
      const result = {
        ...liveResult,
        status: warmed ? "ready" : "error",
        warmed,
        latency_ms: Date.now() - startedAt,
        error_type: liveResult.error_type || null,
        error_message_sanitized: liveResult.error_message_sanitized || null,
        warmed_at: warmed ? new Date().toISOString() : null
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
        same_origin_expected: true,
        same_origin_actual: false,
        navigation_status: "error",
        status: "error",
        warmed: false,
        latency_ms: Date.now() - startedAt,
        error_type: classifyError(error),
        error_message_sanitized: sanitizeErrorMessage(error),
        warmed_at: null
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

    const originWarmed = Boolean(this.warmState.get(action.domainKey)?.warmed);
    const actionRequest = buildActionBody(action, input);
    const actionDiagnostics = this.browserClient.actionDiagnostics(action, originWarmed);

    if (!actionDiagnostics.origin_match) {
      const errorType = this.warmState.get(action.domainKey)?.error_type || "origin_mismatch";
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics,
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType)
      });
    }

    try {
      const fetchResult = await this.browserClient.runAction(action, actionRequest);
      return buildLiveActionResponse(action, input, this.config, fetchResult, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics
      });
    } catch (error) {
      const errorType = classifyError(error);
      return buildLiveActionFailureResponse(action, input, this.config, {
        latencyMs: Date.now() - startedAt,
        originWarmed,
        actionDiagnostics: this.browserClient.actionDiagnostics(action, originWarmed),
        errorType,
        sourceStatus: sourceStatusFromErrorType(errorType)
      });
    }
  }

  warmedOrigins() {
    return Object.values(this.config.domains).map((domain) => this.warmState.get(domain.key) || defaultWarmState(domain, this.config));
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
    same_origin_expected: true,
    same_origin_actual: false,
    navigation_status: "not_started",
    status: "not_warmed",
    warmed: false,
    latency_ms: null,
    error_type: null,
    error_message_sanitized: null,
    warmed_at: null
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

export function publicError(statusCode, code, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}
