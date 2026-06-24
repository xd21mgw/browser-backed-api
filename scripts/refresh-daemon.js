import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
import { DEFAULT_REFRESH_TTL_MS } from "../src/originRegistry.js";
import { runRefreshOnce, sanitizeRefreshSummary } from "./refresh-profile.js";

export function parseRefreshIntervalMs(env = process.env) {
  const rawMinutes = env.REFRESH_INTERVAL_MINUTES;
  if (rawMinutes !== undefined && rawMinutes !== null && rawMinutes !== "") {
    const minutes = Number(rawMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new Error("REFRESH_INTERVAL_MINUTES must be a positive integer");
    }
    return minutes * 60 * 1000;
  }
  const raw = env.BROWSER_BACKED_REFRESH_INTERVAL_MS;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_REFRESH_TTL_MS;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("BROWSER_BACKED_REFRESH_INTERVAL_MS must be a positive integer");
  }
  return value;
}

export function buildRefreshDaemonEvent(event, refreshSummary = {}) {
  const sanitized = sanitizeRefreshSummary({
    ...refreshSummary,
    event,
    auth_summary: refreshSummary.auth_summary || refreshSummary
  });
  const pendingManualLogin = isManualLoginRequiredSummary(refreshSummary) || isManualLoginRequiredSummary(sanitized);
  return {
    ...sanitized,
    pending_manual_login: pendingManualLogin,
    next_step: pendingManualLogin ? "Run npm run worker:start when a user is available to complete profile interaction." : null
  };
}

export function buildServicePrewarmRefreshSummary({ prewarmBody = null, healthBody = null } = {}) {
  const results = Array.isArray(prewarmBody?.results) ? prewarmBody.results : [];
  const authSummary = healthBody && typeof healthBody === "object"
    ? healthBody
    : {
        auth_state: "unknown",
        auth_state_expired: true,
        origin_ready_state_stale: true,
        pending_manual_login: false,
        last_error_type: "service_prewarm_failed",
        origin_status: {}
      };
  const refreshedOriginCount = results.filter((item) => item?.status === "ready").length;
  return sanitizeRefreshSummary({
    event: "service_prewarm_completed",
    ok: Boolean(
      healthBody?.ok === true &&
      healthBody?.auth_state === "ready" &&
      healthBody?.auth_state_expired !== true &&
      healthBody?.origin_ready_state_stale !== true &&
      healthBody?.pending_manual_login !== true
    ),
    service_mode: healthBody?.service_mode === "live" ? "live" : "mock",
    refreshed_origin_count: refreshedOriginCount,
    auth_summary: authSummary
  });
}

export async function runRefreshDaemon({
  env = process.env,
  refreshOnce = runRefreshOnce,
  servicePrewarm = defaultServicePrewarm,
  writeLine = (line) => console.log(line)
} = {}) {
  const intervalMs = parseRefreshIntervalMs(env);
  let timer = null;
  let running = false;

  async function tick() {
    if (running) {
      return;
    }
    running = true;
    try {
      const serviceSummary = await servicePrewarm(env);
      const summary = serviceSummary?.service_reachable === true
        ? serviceSummary.summary
        : await refreshOnce();
      writeLine(JSON.stringify(buildRefreshDaemonEvent("refresh_daemon_tick_completed", summary)));
    } catch {
      writeLine(JSON.stringify(buildRefreshDaemonEvent("refresh_daemon_tick_failed", {
        ok: false,
        service_mode: "live",
        refreshed_origin_count: 0,
        auth_summary: {
          profile_dir_configured: true,
          profile_exists: false,
          state_file_configured: true,
          auth_state: "unknown",
          last_error_type: "refresh_failed"
        }
      })));
    } finally {
      running = false;
    }
  }

  await tick();
  timer = setInterval(tick, intervalMs);

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };
}

export async function defaultServicePrewarm(env = process.env) {
  const port = Number(env.PORT || 8787);
  const baseUrl = env.BROWSER_BACKED_SERVICE_BASE_URL || `http://127.0.0.1:${port}`;
  const prewarm = await requestJson(`${baseUrl}/prewarm`, { method: "POST", timeoutMs: 120000 });
  if (!prewarm.ok) {
    return { service_reachable: false, summary: null };
  }
  const health = await requestJson(`${baseUrl}/health`, { method: "GET", timeoutMs: 5000 });
  return {
    service_reachable: true,
    summary: buildServicePrewarmRefreshSummary({
      prewarmBody: prewarm.body,
      healthBody: health.body
    })
  };
}

export function isManualLoginRequiredSummary(summary) {
  const errorType = summary?.last_error_type;
  return summary?.pending_manual_login === true ||
    summary?.auth_state === "auth_required" ||
    [
      "manual_login_required",
      "auth_required",
      "two_factor_required",
      "captcha_required",
      "password_required",
      "qr_required",
      "landing_flow_blocked",
      "auth_flow_not_completed_in_bound_context"
    ].includes(errorType);
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

function requestJson(url, { method = "GET", timeoutMs = 5000 } = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return Promise.resolve({ ok: false, status: null, body: null });
  }
  const transport = parsedUrl.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const request = transport.request(parsedUrl, { method }, (response) => {
      let chunks = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        chunks += chunk;
      });
      response.on("end", () => {
        try {
          const body = JSON.parse(chunks);
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body });
        } catch {
          resolve({ ok: false, status: response.statusCode ?? null, body: null });
        }
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("request_timeout"));
    });
    request.on("error", () => {
      resolve({ ok: false, status: null, body: null });
    });
    request.end();
  });
}

if (isDirectRun()) {
  const daemon = await runRefreshDaemon();
  const shutdown = () => {
    daemon.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
