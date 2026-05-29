import assert from "node:assert/strict";
import test from "node:test";
import { ACTIONS, ACTION_ALLOWLIST, buildLiveActionResponse } from "../src/actions.js";
import { BrowserBackedClient } from "../src/browser.js";
import { loadConfig } from "../src/config.js";
import { BrowserBackedApiService } from "../src/service.js";

function createService() {
  const config = loadConfig({
    SERVICE_MODE: "mock",
    HOST: "127.0.0.1",
    PORT: "8787"
  });
  return new BrowserBackedApiService(config);
}

function createLiveConfig() {
  return loadConfig({
    SERVICE_MODE: "live",
    HOST: "127.0.0.1",
    PORT: "8787",
    RCP_ORIGIN: "https://rcp.example.test",
    WEAPON_ORIGIN: "https://weapon.example.test",
    LOGIN_LOGS_ORIGIN: "https://user-center-workbench.example.test",
    TRACK_ANALYSIS_ORIGIN: "https://track-analysis.example.test"
  });
}

test("health exposes Dennis runtime readiness fields", () => {
  const service = createService();
  const health = service.health();

  assert.equal(health.ok, true);
  assert.equal(health.service_mode, "mock");
  assert.equal(health.browser_initialized, false);
  assert.equal(health.context_initialized, false);
  assert.equal(typeof health.uptime_ms, "number");
  assert.equal(health.warmed_origins.length, 4);
  assert.ok(health.warmed_origins.every((origin) => origin.status === "not_warmed"));
});

test("actions endpoint exposes the fixed allowlist only", () => {
  const service = createService();
  const actions = service.actions().actions.map((action) => action.name);

  assert.deepEqual(actions, ACTION_ALLOWLIST);
  assert.deepEqual(actions, [
    "rcp_snapshot",
    "weapon_inventory",
    "login_logs_search",
    "track_analysis_summary"
  ]);
});

test("prewarm reports per-origin status, latency, and error type", async () => {
  const service = createService();
  const prewarm = await service.prewarm();

  assert.equal(prewarm.service_mode, "mock");
  assert.equal(prewarm.results.length, 4);

  for (const result of prewarm.results) {
    assert.equal(result.status, "simulated");
    assert.equal(result.warmed, true);
    assert.equal(typeof result.latency_ms, "number");
    assert.equal(result.same_origin_expected, true);
    assert.equal(result.same_origin_actual, true);
    assert.equal(result.navigation_status, "simulated");
    assert.equal(result.error_type, null);
    assert.equal(result.error_message_sanitized, null);
  }
});

test("each action returns source card, source quality, latency, warm state, and sensitivity flag", async () => {
  const service = createService();
  await service.prewarm();

  for (const actionName of ACTION_ALLOWLIST) {
    const response = await service.executeAction(actionName, {
      accountId: "demo",
      workspaceId: "workspace",
      trackId: "track",
      query: "sample",
      limit: 10
    });

    assert.equal(response.action, actionName);
    assert.equal(response.mode, "mock");
    assert.equal(typeof response.latency_ms, "number");
    assert.equal(response.origin_warmed, true);
    assert.equal(response.sensitive_output, false);
    assert.ok(response.source_card);
    assert.ok(response.source_quality);
    assert.equal(response.source_card.body_policy.raw_response_full_body_returned, false);
    assert.equal(response.source_card.body_policy.cookie_token_session_header_plaintext_read, false);
    assert.equal(response.source_quality.checks.some((check) => check.name === "fixed_action_registry" && check.passed), true);
  }
});

test("arbitrary URL input is forbidden", async () => {
  const service = createService();

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { url: "https://example.com/api" }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );
});

test("raw header and cookie inputs are forbidden", async () => {
  const service = createService();

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { headers: { authorization: "Bearer x" } }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { cookie: "sid=x" }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );
});

test("prewarm origin mismatch returns final URL, final origin, and classified error type", async () => {
  const config = createLiveConfig();
  const client = new BrowserBackedClient(config);
  const page = {
    async goto() {
      return { status: () => 200 };
    },
    url() {
      return "https://sso.example.test/login?ticket=redacted-by-test";
    }
  };
  client.start = async () => {};
  client.context = { newPage: async () => page };

  const result = await client.prewarmDomain("rcp");

  assert.equal(result.configured_origin, "https://rcp.example.test");
  assert.equal(result.initial_url, "https://rcp.example.test/");
  assert.equal(result.final_url, "https://sso.example.test/login?[redacted_query]");
  assert.equal(result.final_origin, "https://sso.example.test");
  assert.equal(result.same_origin_expected, true);
  assert.equal(result.same_origin_actual, false);
  assert.equal(result.navigation_status, 200);
  assert.equal(result.error_type, "auth_redirect");
});

test("action origin mismatch returns source metadata instead of throwing a bare service error", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      rcp: prewarmResult(config, "rcp", {
        finalOrigin: "https://sso.example.test",
        errorType: "auth_redirect"
      })
    },
    diagnostics: {
      rcp: {
        bound_page_origin: "https://sso.example.test",
        origin_match: false
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("rcp_snapshot", { accountId: "demo" });

  assert.equal(response.action, "rcp_snapshot");
  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_redirect");
  assert.equal(typeof response.latency_ms, "number");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(response.action_diagnostics.action_name, "rcp_snapshot");
  assert.equal(response.action_diagnostics.expected_origin, "https://rcp.example.test");
  assert.equal(response.action_diagnostics.bound_page_origin, "https://sso.example.test");
  assert.equal(response.action_diagnostics.origin_match, false);
});

test("action execution uses the warmed page for the matching fixed origin", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      weapon: prewarmResult(config, "weapon")
    },
    diagnostics: {
      weapon: {
        bound_page_origin: "https://weapon.example.test",
        origin_match: true
      }
    },
    fetchResults: {
      weapon_inventory: {
        completed: true,
        ok: true,
        status: 200,
        bodyText: JSON.stringify({ count: 1, items: [{ id: "shape-only" }] }),
        bodyTruncated: false,
        observedBytes: 48
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("weapon_inventory", { workspaceId: "demo" });

  assert.deepEqual(fakeClient.prewarmCalls, ["weapon"]);
  assert.equal(fakeClient.runCalls.length, 1);
  assert.equal(fakeClient.runCalls[0].domainKey, "weapon");
  assert.equal(fakeClient.runCalls[0].actionName, "weapon_inventory");
  assert.equal(response.status, "ok");
  assert.equal(response.source_card.action_diagnostics.expected_origin, "https://weapon.example.test");
});

test("forbidden action input terms still return 400", async () => {
  const service = createService();
  for (const key of ["url", "path", "header", "cookie", "token", "session", "secret"]) {
    await assert.rejects(
      () => service.executeAction("rcp_snapshot", { [key]: "blocked" }),
      (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
    );
  }
});

test("live response shape summary does not include raw response body values", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    { accountId: "demo" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        visible_key: "raw-body-value",
        nested: { token: "never-output" }
      }),
      bodyTruncated: false,
      observedBytes: 80
    },
    {
      latencyMs: 12,
      originWarmed: true,
      actionDiagnostics: {
        action_name: "rcp_snapshot",
        expected_origin: "https://rcp.example.test",
        bound_page_origin: "https://rcp.example.test",
        origin_warmed: true,
        origin_match: true
      }
    }
  );

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("raw-body-value"), false);
  assert.equal(serialized.includes("never-output"), false);
  assert.equal(response.sensitive_output, false);
  assert.equal(response.source_card.body_policy.raw_response_full_body_returned, false);
});

class FakeBrowserClient {
  constructor(config, options = {}) {
    this.config = config;
    this.prewarmResults = options.prewarmResults || {};
    this.diagnostics = options.diagnostics || {};
    this.fetchResults = options.fetchResults || {};
    this.prewarmCalls = [];
    this.runCalls = [];
  }

  status() {
    return {
      browser_initialized: true,
      context_initialized: true
    };
  }

  async start() {}

  async prewarmDomain(domainKey) {
    this.prewarmCalls.push(domainKey);
    return this.prewarmResults[domainKey] || prewarmResult(this.config, domainKey);
  }

  actionDiagnostics(action, originWarmed) {
    const domain = this.config.domains[action.domainKey];
    const diagnostics = this.diagnostics[action.domainKey] || {
      bound_page_origin: domain.origin,
      origin_match: true
    };

    return {
      action_name: action.name,
      expected_origin: domain.origin,
      bound_page_origin: diagnostics.bound_page_origin,
      origin_warmed: Boolean(originWarmed),
      origin_match: diagnostics.origin_match
    };
  }

  async runAction(action, actionRequest) {
    this.runCalls.push({
      actionName: action.name,
      domainKey: action.domainKey,
      path: actionRequest.path
    });
    return this.fetchResults[action.name] || {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "{}",
      bodyTruncated: false,
      observedBytes: 2
    };
  }
}

function prewarmResult(config, domainKey, overrides = {}) {
  const domain = config.domains[domainKey];
  const finalOrigin = overrides.finalOrigin || domain.origin;
  const errorType = overrides.errorType || null;
  return {
    key: domain.key,
    domain: domain.label,
    origin: domain.origin,
    configured_origin: domain.origin,
    prewarm_path: domain.prewarmPath,
    initial_url: `${domain.origin}${domain.prewarmPath}`,
    final_url: `${finalOrigin}${domain.prewarmPath}`,
    final_origin: finalOrigin,
    same_origin_expected: true,
    same_origin_actual: finalOrigin === domain.origin,
    navigation_status: 200,
    status: errorType ? "error" : "ready",
    error_type: errorType,
    error_message_sanitized: errorType ? "Navigation ended outside configured origin" : null
  };
}
