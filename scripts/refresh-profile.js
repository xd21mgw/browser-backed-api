import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { BrowserBackedClient } from "../src/browser.js";
import {
  computeAuthState,
  loadRefreshState,
  sanitizeAuthStateOutput,
  saveRefreshState,
  updateOriginWarmState
} from "../src/authState.js";

export async function runRefreshOnce({
  config = loadLiveConfig(),
  browserClient = new BrowserBackedClient(config),
  now = new Date()
} = {}) {
  let refreshState = loadRefreshState(config.stateFile);
  let ok = false;
  let refreshedOriginCount = 0;

  try {
    await browserClient.start();
    const refreshDomains = Object.values(config.domains).filter((item) => item.enabled !== false && item.origin);
    for (const domain of refreshDomains) {
      let result;
      try {
        result = await browserClient.prewarmDomain(domain.key);
      } catch {
        result = {
          key: domain.key,
          origin: domain.origin,
          configured_origin: domain.origin,
          final_origin: null,
          same_origin_actual: false,
          status: "error",
          page_ready: false,
          error_type: "refresh_failed"
        };
      }
      refreshState = updateOriginWarmState(refreshState, domain, result, { now });
      refreshedOriginCount += 1;
    }
    ok = refreshDomains
      .filter((domain) => isRequiredForRefresh(domain))
      .every((domain) => refreshState.origin_status?.[domain.key]?.status === "ready");
  } catch {
    refreshState = {
      ...refreshState,
      last_refresh_at: toIsoString(now),
      last_error_type: "refresh_failed"
    };
  } finally {
    refreshState = {
      ...refreshState,
      refresh_count: (Number(refreshState.refresh_count) || 0) + 1
    };
    refreshState = saveRefreshState(refreshState, config.stateFile);
    await browserClient.close();
  }

  const authSummary = computeAuthState({
    profileDir: config.profileDir,
    stateFile: config.stateFile,
    origins: Object.values(config.domains),
    refreshState,
    nowMs: Date.parse(toIsoString(now))
  });

  return sanitizeRefreshSummary({
    event: "refresh_once_completed",
    ok,
    service_mode: config.mode,
    refreshed_origin_count: refreshedOriginCount,
    auth_summary: authSummary
  });
}

export function sanitizeRefreshSummary(summary) {
  const authSummary = sanitizeAuthStateOutput(summary?.auth_summary || {});
  return {
    event: safeEvent(summary?.event),
    ok: Boolean(summary?.ok),
    service_mode: summary?.service_mode === "live" ? "live" : "mock",
    refreshed_origin_count: safeCount(summary?.refreshed_origin_count),
    ...authSummary
  };
}

export function refreshExitCode(summary) {
  return summary?.ok === true ? 0 : 1;
}

function loadLiveConfig() {
  process.env.SERVICE_MODE = "live";
  return loadConfig();
}

function safeEvent(value) {
  return typeof value === "string" && /^[a-z0-9_:-]{1,80}$/i.test(value)
    ? value
    : "refresh_once_completed";
}

function safeCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function isRequiredForRefresh(domain) {
  return domain?.enabled !== false && domain?.requiredForRefresh !== false && domain?.optional !== true;
}

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const summary = await runRefreshOnce();
  console.log(JSON.stringify(summary, null, 2));
  process.exit(refreshExitCode(summary));
}
