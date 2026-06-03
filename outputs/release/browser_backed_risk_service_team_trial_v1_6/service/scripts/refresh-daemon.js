import path from "node:path";
import { fileURLToPath } from "node:url";
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
    event
  });
  const pendingManualLogin = isManualLoginRequiredSummary(refreshSummary) || isManualLoginRequiredSummary(sanitized);
  return {
    ...sanitized,
    pending_manual_login: pendingManualLogin,
    next_step: pendingManualLogin ? "Run npm run worker:start when a user is available to complete profile interaction." : null
  };
}

export async function runRefreshDaemon({
  env = process.env,
  refreshOnce = runRefreshOnce,
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
      const summary = await refreshOnce();
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

export function isManualLoginRequiredSummary(summary) {
  const errorType = summary?.last_error_type;
  return summary?.auth_state === "auth_required" ||
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

if (isDirectRun()) {
  const daemon = await runRefreshDaemon();
  const shutdown = () => {
    daemon.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
