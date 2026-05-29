import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_ALLOWLIST } from "../src/actions.js";
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
    assert.equal(result.error_type, null);
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
