#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2] || "status";
const port = Number(process.env.PORT || 8787);
const localBaseUrl = `http://127.0.0.1:${port}`;
const runtimeDir = process.env.BROWSER_BACKED_WORKER_RUNTIME_DIR ||
  path.join(os.homedir(), ".dennis-browser-backed");
const pidFile = process.env.BROWSER_BACKED_WORKER_PID_FILE ||
  path.join(runtimeDir, "worker.pid");
const logFile = process.env.BROWSER_BACKED_WORKER_LOG_FILE ||
  path.join(runtimeDir, "worker.log");
const profileDir = process.env.BROWSER_BACKED_PROFILE_DIR ||
  path.join(os.homedir(), ".dennis-browser-backed", "profile");

const MANUAL_LOGIN_ERROR_TYPES = Object.freeze([
  "manual_login_required",
  "auth_required",
  "two_factor_required",
  "captcha_required",
  "password_required",
  "qr_required",
  "landing_flow_blocked",
  "auth_flow_not_completed_in_bound_context"
]);

export async function runMacWorkerCommand(selectedCommand = command) {
  try {
    if (selectedCommand === "start") {
      await startWorker();
    } else if (selectedCommand === "status") {
      await printStatus();
    } else if (selectedCommand === "stop") {
      await stopWorker();
    } else if (selectedCommand === "doctor") {
      await doctor();
    } else {
      printJson({
        ok: false,
        error_type: "unknown_worker_command",
        allowed_commands: ["start", "status", "stop", "doctor"]
      });
      process.exitCode = 1;
    }
  } catch (error) {
    printJson({
      ok: false,
      error_type: "worker_command_failed",
      error_message_sanitized: sanitizeMessage(error)
    });
    process.exitCode = 1;
  }
}

export function planWorkerStart({ serviceReachable, authState, refreshSummary, postOpenRefreshSummary } = {}) {
  if (serviceReachable && authState === "ready") {
    return ["return_ready"];
  }
  const steps = ["refresh_once"];
  if (refreshSummary && needsManualLogin(refreshSummary)) {
    steps.push("open_profile", "refresh_once_after_open_profile");
    if (postOpenRefreshSummary?.ok) {
      steps.push(serviceReachable ? "return_existing_service" : "start_service");
    } else {
      steps.push("manual_login_pending");
    }
    return steps;
  }
  if (refreshSummary?.ok) {
    steps.push(serviceReachable ? "return_existing_service" : "start_service");
  } else if (refreshSummary) {
    steps.push("refresh_failed");
  }
  return steps;
}

export function needsManualLogin(summary) {
  if (!summary || typeof summary !== "object") {
    return false;
  }
  if (summary.auth_state === "auth_required") {
    return true;
  }
  if (MANUAL_LOGIN_ERROR_TYPES.includes(summary.last_error_type) || MANUAL_LOGIN_ERROR_TYPES.includes(summary.error_type)) {
    return true;
  }
  const statuses = summary.origin_status && typeof summary.origin_status === "object"
    ? Object.values(summary.origin_status)
    : [];
  return statuses.some((entry) => {
    const status = entry?.status;
    const errorType = entry?.error_type || entry?.last_error_type;
    return status === "auth_required" || MANUAL_LOGIN_ERROR_TYPES.includes(errorType);
  });
}

async function startWorker() {
  const existing = await fetchHealth();
  if (existing.ok && existing.body?.auth_state === "ready") {
    printJson({
      ok: true,
      command: "worker:start",
      service_already_running: true,
      auth_recovery_attempted: false,
      service_base_url: localBaseUrl,
      health: summarizeHealth(existing.body)
    });
    return;
  }

  const firstRefresh = runRefreshOnceCommand();
  if (needsManualLogin(firstRefresh.summary)) {
    const openProfile = runOpenProfileCommand();
    const secondRefresh = openProfile.ok ? runRefreshOnceCommand() : { ok: false, summary: null };
    if (!secondRefresh.ok || !secondRefresh.summary?.ok) {
      printJson({
        ok: false,
        command: "worker:start",
        service_base_url: localBaseUrl,
        auth_recovery_attempted: true,
        open_profile_attempted: true,
        open_profile_ok: openProfile.ok,
        pending_manual_login: true,
        refresh_summary: sanitizeWorkerRefreshSummary(secondRefresh.summary || firstRefresh.summary),
        next_step: "Complete manual login in open:profile, then run npm run worker:start again.",
        credential_material_output: false
      });
      process.exitCode = 1;
      return;
    }
    await startOrReuseService({
      serviceAlreadyReachable: existing.ok,
      authRecoveryAttempted: true,
      openProfileAttempted: true,
      refreshSummary: secondRefresh.summary
    });
    return;
  }

  if (!firstRefresh.ok || !firstRefresh.summary?.ok) {
    printJson({
      ok: false,
      command: "worker:start",
      service_base_url: localBaseUrl,
      auth_recovery_attempted: true,
      open_profile_attempted: false,
      pending_manual_login: false,
      refresh_summary: sanitizeWorkerRefreshSummary(firstRefresh.summary),
      next_step: "Run npm run worker:doctor. If auth is required, run npm run worker:start again to enter open:profile.",
      credential_material_output: false
    });
    process.exitCode = 1;
    return;
  }

  await startOrReuseService({
    serviceAlreadyReachable: existing.ok,
    authRecoveryAttempted: true,
    openProfileAttempted: false,
    refreshSummary: firstRefresh.summary
  });
}

async function startOrReuseService({ serviceAlreadyReachable, authRecoveryAttempted, openProfileAttempted, refreshSummary }) {
  const postRefreshHealth = await fetchHealth();
  if (postRefreshHealth.ok && postRefreshHealth.body?.auth_state === "ready") {
    printJson({
      ok: true,
      command: "worker:start",
      service_already_running: true,
      auth_recovery_attempted: Boolean(authRecoveryAttempted),
      open_profile_attempted: Boolean(openProfileAttempted),
      service_base_url: localBaseUrl,
      refresh_summary: sanitizeWorkerRefreshSummary(refreshSummary),
      health: summarizeHealth(postRefreshHealth.body),
      next_step: "Service is ready. Call allowlisted actions through service_base_url.",
      credential_material_output: false
    });
    return;
  }

  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  const logFd = fs.openSync(logFile, "a", 0o600);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, SERVICE_MODE: "live", PORT: String(port) },
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid), { mode: 0o600 });

  const health = await waitForHealth(15000);
  printJson({
    ok: Boolean(health.ok),
    command: "worker:start",
    service_already_running: Boolean(serviceAlreadyReachable),
    service_started: Boolean(health.ok),
    auth_recovery_attempted: Boolean(authRecoveryAttempted),
    open_profile_attempted: Boolean(openProfileAttempted),
    service_base_url: localBaseUrl,
    pid_file: pidFile,
    log_file: logFile,
    refresh_summary: sanitizeWorkerRefreshSummary(refreshSummary),
    health: health.ok ? summarizeHealth(health.body) : null,
    next_step: health.ok ? "Use worker:status or call service actions." : "Check worker:doctor and log_file."
  });
  if (!health.ok) {
    process.exitCode = 1;
  }
}

async function printStatus() {
  const health = await fetchHealth();
  const actions = health.ok ? await fetchActions() : { ok: false, body: null };
  printJson({
    ok: Boolean(health.ok),
    command: "worker:status",
    service_base_url: localBaseUrl,
    health: health.ok ? summarizeHealth(health.body) : null,
    actions: actions.ok ? summarizeActions(actions.body) : null,
    credential_material_output: false
  });
  if (!health.ok) {
    process.exitCode = 1;
  }
}

async function stopWorker() {
  const pid = readPid();
  if (!pid) {
    const health = await fetchHealth();
    printJson({
      ok: !health.ok,
      command: "worker:stop",
      pid_file_found: false,
      service_still_reachable: Boolean(health.ok),
      message: health.ok
        ? "Service is reachable but no worker pid file exists; stop the owning terminal/process manually."
        : "No worker pid file and service is not reachable.",
      credential_material_output: false
    });
    process.exitCode = health.ok ? 1 : 0;
    return;
  }

  let signalSent = false;
  try {
    process.kill(pid, "SIGTERM");
    signalSent = true;
  } catch {}

  await sleep(1200);
  const health = await fetchHealth();
  if (!health.ok) {
    removePidFile();
  }

  printJson({
    ok: !health.ok,
    command: "worker:stop",
    pid,
    signal_sent: signalSent,
    service_still_reachable: Boolean(health.ok),
    profile_deleted: false,
    state_deleted: false,
    credential_material_output: false
  });
  if (health.ok) {
    process.exitCode = 1;
  }
}

async function doctor() {
  const health = await fetchHealth();
  const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" });
  const packageInstalled = fs.existsSync(path.join(process.cwd(), "node_modules"));
  const profileExists = fs.existsSync(profileDir);
  const lockFiles = profileExists
    ? fs.readdirSync(profileDir).filter((name) => /^Singleton|^lockfile$/i.test(name)).slice(0, 20)
    : [];

  printJson({
    ok: true,
    command: "worker:doctor",
    node_version: process.version,
    npm_available: npmVersion.status === 0,
    npm_version: npmVersion.status === 0 ? npmVersion.stdout.trim() : null,
    package_installed: packageInstalled,
    service_base_url: localBaseUrl,
    port_reachable: Boolean(health.ok),
    health: health.ok ? summarizeHealth(health.body) : null,
    profile_dir_configured: Boolean(profileDir),
    profile_exists: profileExists,
    profile_lock_files_present: lockFiles.length > 0,
    profile_lock_file_names: lockFiles,
    pid_file_exists: fs.existsSync(pidFile),
    next_steps: suggestNextSteps({ healthOk: health.ok, packageInstalled, profileExists, lockFiles }),
    credential_material_output: false
  });
}

async function fetchHealth() {
  return fetchJson(`${localBaseUrl}/health`, 3000);
}

async function fetchActions() {
  return fetchJson(`${localBaseUrl}/actions`, 3000);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json();
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: null, body: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (health.ok) {
      return health;
    }
    await sleep(500);
  }
  return { ok: false, body: null };
}

function summarizeHealth(body) {
  if (!body || typeof body !== "object") {
    return null;
  }
  return {
    ok: Boolean(body.ok),
    service_mode: body.service_mode || null,
    auth_state: body.auth_state || null,
    action_count: body.action_count ?? null,
    origin_status: body.origin_status || null,
    warmed_origins: body.warmed_origins || null,
    credential_material_output: false
  };
}

function summarizeActions(body) {
  const actions = Array.isArray(body?.actions) ? body.actions : [];
  return {
    action_count: actions.length,
    action_names: actions.map((action) => action.name || action.action_name).filter(Boolean),
    credential_material_output: false
  };
}

function suggestNextSteps({ healthOk, packageInstalled, profileExists, lockFiles }) {
  if (!packageInstalled) {
    return ["Run npm install."];
  }
  if (!profileExists) {
    return ["Run npm run worker:start to enter open:profile when needed."];
  }
  if (lockFiles.length > 0 && !healthOk) {
    return ["A profile lock exists. Stop start:live, refresh:daemon, open:profile, or Chrome using this profile, then retry."];
  }
  if (!healthOk) {
    return ["Run npm run worker:start."];
  }
  return ["Service is reachable. Use worker:status or call allowlisted actions."];
}

function runRefreshOnceCommand() {
  const result = spawnSync(process.execPath, ["scripts/refresh-profile.js"], {
    cwd: process.cwd(),
    env: { ...process.env, SERVICE_MODE: "live" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  const summary = parseJsonOutput(result.stdout);
  return {
    ok: result.status === 0 && summary?.ok === true,
    status: result.status,
    summary: sanitizeWorkerRefreshSummary(summary)
  };
}

function runOpenProfileCommand() {
  const result = spawnSync(process.execPath, ["scripts/open-profile.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  return {
    ok: result.status === 0,
    status: result.status
  };
}

function parseJsonOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
  }
  return null;
}

function sanitizeWorkerRefreshSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  return {
    ok: Boolean(summary.ok),
    auth_state: typeof summary.auth_state === "string" ? summary.auth_state : null,
    last_error_type: typeof summary.last_error_type === "string" ? summary.last_error_type : null,
    refreshed_origin_count: Number.isInteger(summary.refreshed_origin_count) ? summary.refreshed_origin_count : 0,
    origin_status: summary.origin_status && typeof summary.origin_status === "object"
      ? Object.fromEntries(Object.entries(summary.origin_status).map(([key, value]) => [
        key,
        {
          status: typeof value?.status === "string" ? value.status : null,
          page_ready: Boolean(value?.page_ready),
          error_type: typeof value?.error_type === "string" ? value.error_type : null
        }
      ]))
      : {}
  };
}

function readPid() {
  try {
    const raw = fs.readFileSync(pidFile, "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function removePidFile() {
  try {
    fs.unlinkSync(pidFile);
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeMessage(error) {
  return String(error?.message || error || "unknown").replace(/[\r\n]+/g, " ").slice(0, 300);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  await runMacWorkerCommand();
}
