#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_ALLOWLIST } from "../src/actions.js";
import { buildServicePrewarmRefreshSummary } from "./refresh-daemon.js";

const command = process.argv[2] || "status";
const port = Number(process.env.PORT || 8787);
const localBaseUrl = `http://127.0.0.1:${port}`;
const exposePort = Number(process.env.BROWSER_BACKED_EXPOSE_PORT || 9787);
const exposeHost = process.env.BROWSER_BACKED_EXPOSE_HOST || "0.0.0.0";
const proxyMaxRequestBytes = Number(process.env.BROWSER_BACKED_WORKER_PROXY_MAX_REQUEST_BYTES || 2 * 1024 * 1024);
const proxyLocalBaseUrl = `http://127.0.0.1:${exposePort}`;
const runtimeDir = process.env.BROWSER_BACKED_WORKER_RUNTIME_DIR ||
  path.join(os.homedir(), ".dennis-browser-backed");
const pidFile = process.env.BROWSER_BACKED_WORKER_PID_FILE ||
  path.join(runtimeDir, "worker.pid");
const proxyPidFile = process.env.BROWSER_BACKED_WORKER_PROXY_PID_FILE ||
  path.join(runtimeDir, "worker-proxy.pid");
const refreshDaemonPidFile = process.env.BROWSER_BACKED_REFRESH_DAEMON_PID_FILE ||
  path.join(runtimeDir, "refresh-daemon.pid");
const logFile = process.env.BROWSER_BACKED_WORKER_LOG_FILE ||
  path.join(runtimeDir, "worker.log");
const proxyLogFile = process.env.BROWSER_BACKED_WORKER_PROXY_LOG_FILE ||
  path.join(runtimeDir, "worker-proxy.log");
const refreshDaemonLogFile = process.env.BROWSER_BACKED_REFRESH_DAEMON_LOG_FILE ||
  path.join(runtimeDir, "refresh-daemon.log");
const profileDir = process.env.BROWSER_BACKED_PROFILE_DIR ||
  path.join(os.homedir(), ".dennis-browser-backed", "profile");
const dedicatedProfileDir = path.join(os.homedir(), ".dennis-browser-backed", "profile");
const dailyChromeProfileDir = path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
const PROFILE_LOCK_FILE_PATTERN = /^(Singleton|lockfile)/i;

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

const CLOSED_BROWSER_CONTEXT_PATTERN = /Target page, context or browser has been closed|browser has been closed|context has been closed|page has been closed/i;

export async function runMacWorkerCommand(selectedCommand = command) {
  try {
    if (selectedCommand === "start") {
      await startWorker();
    } else if (selectedCommand === "status") {
      await printStatus();
    } else if (selectedCommand === "expose") {
      await exposeWorker();
    } else if (selectedCommand === "proxy") {
      await runProxyServer();
    } else if (selectedCommand === "stop") {
      await stopWorker();
    } else if (selectedCommand === "doctor") {
      await doctor();
    } else {
      printJson({
        ok: false,
        error_type: "unknown_worker_command",
        allowed_commands: ["start", "status", "expose", "stop", "doctor"]
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

export function classifyProxyRequest(method, rawUrl, actionNames = ACTION_ALLOWLIST) {
  let url;
  try {
    url = new URL(rawUrl || "/", "http://worker.local");
  } catch {
    return { allowed: false, reason: "invalid_url", upstreamPath: null };
  }

  const pathname = url.pathname;
  const methodUpper = String(method || "").toUpperCase();
  if (pathname === "/health") {
    return methodUpper === "GET"
      ? { allowed: true, reason: null, upstreamPath: "/health" }
      : { allowed: false, reason: "method_not_allowed", upstreamPath: null };
  }
  if (pathname === "/actions") {
    return methodUpper === "GET"
      ? { allowed: true, reason: null, upstreamPath: "/actions" }
      : { allowed: false, reason: "method_not_allowed", upstreamPath: null };
  }
  if (pathname === "/actions/batch" || pathname === "/actions/multi_source_plan") {
    return methodUpper === "POST"
      ? { allowed: true, reason: null, upstreamPath: pathname }
      : { allowed: false, reason: "method_not_allowed", upstreamPath: null };
  }

  const match = pathname.match(/^\/actions\/([A-Za-z0-9_:-]+)$/);
  if (!match) {
    return { allowed: false, reason: "path_not_allowed", upstreamPath: null };
  }
  const actionName = match[1];
  if (!actionNames.includes(actionName)) {
    return { allowed: false, reason: "action_not_allowlisted", upstreamPath: null };
  }
  return methodUpper === "POST"
    ? { allowed: true, reason: null, upstreamPath: `/actions/${actionName}` }
    : { allowed: false, reason: "method_not_allowed", upstreamPath: null };
}

export function buildExposeSummary({ proxyStatus, serviceBaseUrl, health, actions }) {
  return {
    proxy_status: proxyStatus,
    local_service: localBaseUrl,
    service_base_url: serviceBaseUrl,
    action_count: health?.action_count ?? actions?.action_count ?? null,
    auth_state: health?.auth_state || null,
    allowed_paths: ["/health", "/actions", "/actions/batch", "/actions/multi_source_plan", "/actions/<allowlisted_action>"],
    security_todo: [
      "Restrict access to trusted internal network or approved Mac node channel.",
      "Do not expose arbitrary URL fetch.",
      "Do not expose Chrome profile, cookies, tokens, sessions, headers, or browser storage."
    ],
    credential_material_output: false
  };
}

export function planWorkerStart({ serviceReachable, authState, refreshSummary, postOpenRefreshSummary, profileLockStatus } = {}) {
  if (serviceReachable && authState === "ready") {
    return ["return_ready"];
  }
  const autoClearStaleLock = !serviceReachable && profileLockStatus === "stale_profile_lock";
  if (!serviceReachable && blockingProfileLockStatus(profileLockStatus) && !autoClearStaleLock) {
    return ["profile_lock_blocked"];
  }
  const steps = autoClearStaleLock ? ["clear_stale_profile_lock", "refresh_once"] : ["refresh_once"];
  if (refreshSummary && needsInteractiveRecovery(refreshSummary)) {
    if (serviceReachable) {
      steps.push("stop_service_for_manual_login");
    }
    steps.push("open_profile", "refresh_once_after_open_profile");
    if (postOpenRefreshSummary?.ok) {
      steps.push("start_service");
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

export function blockingProfileLockStatus(status) {
  return [
    "dedicated_profile_live_lock",
    "daily_chrome_profile_in_use",
    "stale_profile_lock",
    "unknown_lock"
  ].includes(status);
}

export function canClearStaleProfileLock(profileLock) {
  return profileLock?.status === "stale_profile_lock" && profileLock?.clear_stale_lock_allowed === true;
}

export function clearDedicatedStaleProfileLock(profileLock, targetProfileDir = profileDir) {
  if (!canClearStaleProfileLock(profileLock)) {
    return {
      ok: false,
      stale_lock_cleared: false,
      stale_lock_clear_error: "clear-stale-lock is allowed only for stale locks in the dedicated browser-backed profile",
      cleared_lock_files: [],
      auto_kill_chrome: false,
      profile_deleted: false,
      credential_material_output: false
    };
  }

  const lockFiles = listProfileLockFiles(targetProfileDir);
  try {
    for (const file of lockFiles) {
      fs.rmSync(file.path, { force: true, recursive: false });
    }
    return {
      ok: true,
      stale_lock_cleared: true,
      stale_lock_clear_error: null,
      cleared_lock_files: lockFiles.map((file) => file.name),
      auto_kill_chrome: false,
      profile_deleted: false,
      credential_material_output: false
    };
  } catch (error) {
    return {
      ok: false,
      stale_lock_cleared: false,
      stale_lock_clear_error: sanitizeMessage(error),
      cleared_lock_files: [],
      auto_kill_chrome: false,
      profile_deleted: false,
      credential_material_output: false
    };
  }
}

export function buildProfileLockBlockedStartOutput(lockDiagnosis) {
  const lockPids = Array.isArray(lockDiagnosis?.lock_pids) ? lockDiagnosis.lock_pids : [];
  const pidExists = lockPids.some((item) => item?.pid_exists === true);
  const isStaleProfileLock = lockDiagnosis?.status === "stale_profile_lock";
  return {
    ok: false,
    command: "worker:start",
    service_base_url: localBaseUrl,
    service_ready: false,
    blocking_issue: lockDiagnosis?.blocking_issue || lockDiagnosis?.status || "profile_lock_blocked",
    lock_type: lockDiagnosis?.status || "unknown_lock",
    profile_path: profileDir,
    pid_exists: pidExists,
    dennis_should_continue_live: false,
    profile_lock: lockDiagnosis,
    refresh_attempted: false,
    service_started: false,
    auto_kill_chrome: false,
    auto_delete_lock: false,
    next_step: isStaleProfileLock
      ? "Dedicated stale lock auto-clear failed or did not resolve the lock. Run npm run worker:doctor -- --explain-lock before retrying worker:start."
      : lockDiagnosis?.next_step || "Run npm run worker:doctor and resolve the profile lock before retrying worker:start.",
    credential_material_output: false
  };
}

export function classifyProfileLockState({
  profileDir: rawProfileDir = profileDir,
  lockFiles = [],
  processRows = [],
  pidExists = () => false
} = {}) {
  const normalizedProfile = normalizePath(rawProfileDir);
  const dedicated = pathEquals(normalizedProfile, dedicatedProfileDir);
  const dailyProfileConfigured = pathEquals(normalizedProfile, dailyChromeProfileDir) ||
    pathInside(normalizedProfile, dailyChromeProfileDir);
  const chromeProcesses = processRows
    .filter((row) => isChromeLikeCommand(row.command))
    .map((row) => ({
      pid: Number(row.pid) || null,
      command_summary: summarizeProcessCommand(row.command),
      user_data_dir: extractUserDataDir(row.command),
      uses_configured_profile: pathEquals(extractUserDataDir(row.command), normalizedProfile),
      uses_daily_chrome_profile: !extractUserDataDir(row.command)
        ? isDailyChromeCommand(row.command)
        : pathEquals(extractUserDataDir(row.command), dailyChromeProfileDir) || pathInside(extractUserDataDir(row.command), dailyChromeProfileDir)
    }));
  const configuredProfileProcesses = chromeProcesses.filter((item) => item.uses_configured_profile);
  const dailyChromeProcesses = chromeProcesses.filter((item) => item.uses_daily_chrome_profile);
  const lockPidEntries = lockFiles
    .map((file) => ({
      name: file.name,
      path: file.path,
      pid: file.pid ?? parsePidFromLockTarget(file.link_target || file.content || "")
    }))
    .filter((item) => Number.isInteger(item.pid) && item.pid > 0)
    .map((item) => ({
      ...item,
      pid_exists: Boolean(pidExists(item.pid))
    }));
  const liveLockPids = lockPidEntries.filter((item) => item.pid_exists);
  const lockPresent = lockFiles.length > 0;

  let status = "no_lock";
  let blockingIssue = null;
  if (dailyProfileConfigured) {
    status = "daily_chrome_profile_in_use";
    blockingIssue = "daily_chrome_profile_in_use";
  } else if (configuredProfileProcesses.length > 0 || liveLockPids.length > 0) {
    status = dedicated ? "dedicated_profile_live_lock" : "unknown_lock";
    blockingIssue = status;
  } else if (lockPresent) {
    status = dedicated ? "stale_profile_lock" : "unknown_lock";
    blockingIssue = status;
  }

  return {
    status,
    blocking_issue: blockingIssue,
    profile_dir_configured: true,
    profile_dir_is_dedicated_default: dedicated,
    daily_chrome_profile_configured: dailyProfileConfigured,
    daily_chrome_in_use: dailyChromeProcesses.length > 0,
    lock_files_present: lockPresent,
    lock_files: lockFiles.map((file) => file.name),
    lock_pids: lockPidEntries.map((item) => ({
      name: item.name,
      pid: item.pid,
      pid_exists: item.pid_exists
    })),
    configured_profile_processes: configuredProfileProcesses.map(publicProcessSummary),
    daily_chrome_processes: dailyChromeProcesses.map(publicProcessSummary),
    action_allowed: status === "no_lock",
    clear_stale_lock_allowed: status === "stale_profile_lock" && dedicated,
    auto_kill_allowed: false,
    auto_delete_lock_allowed: false,
    next_step: profileLockNextStep(status)
  };
}

export function needsManualLogin(summary) {
  if (!summary || typeof summary !== "object") {
    return false;
  }
  if (summary.pending_manual_login === true || summary.auth_state === "auth_required") {
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

export function needsInteractiveRecovery(summary) {
  if (needsManualLogin(summary)) {
    return true;
  }
  if (!summary || typeof summary !== "object") {
    return false;
  }
  const authExpired = summary.auth_state === "expired" || summary.auth_state_expired === true;
  const originStale = summary.origin_ready_state_stale === true;
  const statuses = summary.origin_status && typeof summary.origin_status === "object"
    ? Object.values(summary.origin_status)
    : [];
  const failedOriginRefresh = statuses.some((entry) => {
    const status = entry?.status;
    return status === "failed" || status === "optional_failed" || status === "auth_required";
  });
  return authExpired && originStale && failedOriginRefresh;
}

export function serviceHealthReady(summary) {
  if (!summary || typeof summary !== "object") {
    return false;
  }
  return summary.ok === true &&
    summary.auth_state === "ready" &&
    summary.auth_state_expired !== true &&
    summary.origin_ready_state_stale !== true &&
    summary.pending_manual_login !== true;
}

export function classifyWorkerPid(pid, pidExistsFn = processExists) {
  if (!pid) {
    return { status: "missing", pid: null, pid_exists: false };
  }
  const pidExists = pidExistsFn(pid);
  return {
    status: pidExists ? "live" : "stale",
    pid,
    pid_exists: pidExists
  };
}

export function shouldStartNewService({ postRefreshHealthOk, serviceAlreadyReachable }) {
  return postRefreshHealthOk !== true && serviceAlreadyReachable !== true;
}

export function shouldStartRefreshDaemon(pid, pidExistsFn = processExists) {
  return classifyWorkerPid(pid, pidExistsFn).status !== "live";
}

export function serviceRebuildReason(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  if (summary.browser_initialized === false || summary.context_initialized === false) {
    return "browser_context_not_initialized";
  }
  const diagnosticText = [
    summary.error_type,
    summary.error_message,
    ...Object.values(summary.origin_status || {}).flatMap((entry) => [
      entry?.status,
      entry?.error_type,
      entry?.last_error_type,
      entry?.error_message
    ]),
    ...(Array.isArray(summary.warmed_origins) ? summary.warmed_origins.flatMap((entry) => [
      entry?.status,
      entry?.error_type,
      entry?.last_error_type,
      entry?.error_message
    ]) : [])
  ].filter(Boolean).join("\n");
  if (CLOSED_BROWSER_CONTEXT_PATTERN.test(diagnosticText)) {
    return "browser_context_closed";
  }
  return null;
}

export function serviceNeedsProcessRebuild(summary) {
  return serviceRebuildReason(summary) !== null;
}

async function startWorker() {
  const staleWorkerPid = cleanupStaleWorkerPid();
  let existing = await fetchHealth();
  let profileLockRecovery = null;
  let serviceProcessRecovery = null;
  if (existing.ok && serviceHealthReady(existing.body)) {
    const refreshDaemon = ensureRefreshDaemon();
    printJson({
      ok: true,
      command: "worker:start",
      service_already_running: true,
      stale_worker_pid_cleared: staleWorkerPid.cleared,
      auth_recovery_attempted: false,
      service_base_url: localBaseUrl,
      refresh_daemon: refreshDaemon,
      health: summarizeHealth(existing.body)
    });
    return;
  }

  if (existing.ok && serviceNeedsProcessRebuild(existing.body)) {
    serviceProcessRecovery = await stopReachableServiceForRecovery(serviceRebuildReason(existing.body));
    if (!serviceProcessRecovery.ok) {
      printJson({
        ok: false,
        command: "worker:start",
        service_base_url: localBaseUrl,
        service_ready: false,
        blocking_issue: "service_rebuild_failed",
        service_process_recovery: serviceProcessRecovery,
        health: summarizeHealth(existing.body),
        next_step: "Run npm run worker:stop, then npm run worker:start. If this persists, inspect the worker log.",
        auto_kill_chrome: false,
        profile_deleted: false,
        credential_material_output: false
      });
      process.exitCode = 1;
      return;
    }
    existing = { ok: false, body: null };
  }

  if (!existing.ok) {
    let lockDiagnosis = diagnoseProfileLock();
    if (lockDiagnosis.status === "stale_profile_lock" && canClearStaleProfileLock(lockDiagnosis)) {
      const clearResult = clearDedicatedStaleProfileLock(lockDiagnosis);
      profileLockRecovery = {
        stale_lock_auto_clear_attempted: true,
        stale_lock_auto_cleared: Boolean(clearResult.ok),
        cleared_lock_files: clearResult.cleared_lock_files || [],
        stale_lock_clear_error: clearResult.stale_lock_clear_error || null,
        auto_kill_chrome: false,
        profile_deleted: false,
        credential_material_output: false
      };
      if (!clearResult.ok) {
        printJson({
          ...buildProfileLockBlockedStartOutput(lockDiagnosis),
          blocking_issue: "stale_profile_lock_clear_failed",
          profile_lock_recovery: profileLockRecovery
        });
        process.exitCode = 1;
        return;
      }
      lockDiagnosis = diagnoseProfileLock();
    }
    if (blockingProfileLockStatus(lockDiagnosis.status)) {
      printJson({
        ...buildProfileLockBlockedStartOutput(lockDiagnosis),
        profile_lock_recovery: profileLockRecovery
      });
      process.exitCode = 1;
      return;
    }
  }

  let firstRefresh = existing.ok ? await runServicePrewarmCommand() : runRefreshOnceCommand();
  if (existing.ok) {
    const postPrewarmHealth = await fetchHealth();
    if (postPrewarmHealth.ok && serviceNeedsProcessRebuild(postPrewarmHealth.body)) {
      serviceProcessRecovery = await stopReachableServiceForRecovery(serviceRebuildReason(postPrewarmHealth.body));
      if (!serviceProcessRecovery.ok) {
        printJson({
          ok: false,
          command: "worker:start",
          service_base_url: localBaseUrl,
          service_ready: false,
          blocking_issue: "service_rebuild_failed_after_prewarm",
          service_process_recovery: serviceProcessRecovery,
          refresh_summary: sanitizeWorkerRefreshSummary(firstRefresh.summary),
          health: summarizeHealth(postPrewarmHealth.body),
          next_step: "Run npm run worker:stop, then npm run worker:start. If this persists, inspect the worker log.",
          auto_kill_chrome: false,
          profile_deleted: false,
          credential_material_output: false
        });
        process.exitCode = 1;
        return;
      }
      existing = { ok: false, body: null };
      firstRefresh = runRefreshOnceCommand();
    }
  }
  if (needsInteractiveRecovery(firstRefresh.summary)) {
    let manualLoginServiceRelease = null;
    if (existing.ok) {
      manualLoginServiceRelease = await stopManagedServiceForManualLogin();
      if (!manualLoginServiceRelease.ok && manualLoginServiceRelease.reason === "missing_worker_pid_file") {
        manualLoginServiceRelease = await stopReachableServiceForRecovery("service_stopped_for_profile_interaction");
      }
      if (!manualLoginServiceRelease.ok) {
        printJson({
          ok: false,
          command: "worker:start",
          service_base_url: localBaseUrl,
          auth_recovery_attempted: true,
          open_profile_attempted: false,
          pending_manual_login: true,
          blocking_issue: "service_profile_locked_for_manual_login",
          manual_login_service_release: manualLoginServiceRelease,
          profile_lock_recovery: profileLockRecovery,
          stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
          refresh_summary: sanitizeWorkerRefreshSummary(firstRefresh.summary),
          next_step: "Run npm run worker:stop, then npm run worker:start. The worker will not kill Chrome or delete the profile.",
          credential_material_output: false
        });
        process.exitCode = 1;
        return;
      }
    }
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
        profile_lock_recovery: profileLockRecovery,
        manual_login_service_release: manualLoginServiceRelease,
        stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
        refresh_summary: sanitizeWorkerRefreshSummary(secondRefresh.summary || firstRefresh.summary),
        next_step: "Complete manual login in open:profile, then run npm run worker:start again.",
        credential_material_output: false
      });
      process.exitCode = 1;
      return;
    }
    await startOrReuseService({
      serviceAlreadyReachable: existing.ok && !manualLoginServiceRelease?.ok,
      authRecoveryAttempted: true,
      openProfileAttempted: true,
      refreshSummary: secondRefresh.summary,
      profileLockRecovery,
      serviceProcessRecovery,
      manualLoginServiceRelease,
      staleWorkerPid
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
      profile_lock_recovery: profileLockRecovery,
      service_process_recovery: serviceProcessRecovery,
      stale_worker_pid_cleared: staleWorkerPid.cleared,
      stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
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
    refreshSummary: firstRefresh.summary,
    profileLockRecovery,
    serviceProcessRecovery,
    staleWorkerPid
  });
}

async function startOrReuseService({
  serviceAlreadyReachable,
  authRecoveryAttempted,
  openProfileAttempted,
  refreshSummary,
  profileLockRecovery = null,
  serviceProcessRecovery = null,
  manualLoginServiceRelease = null,
  staleWorkerPid = { cleared: false }
}) {
  const postRefreshHealth = await fetchHealth();
  if (postRefreshHealth.ok && serviceHealthReady(postRefreshHealth.body)) {
    const refreshDaemon = ensureRefreshDaemon();
    printJson({
      ok: true,
      command: "worker:start",
      service_already_running: true,
      auth_recovery_attempted: Boolean(authRecoveryAttempted),
      open_profile_attempted: Boolean(openProfileAttempted),
      service_base_url: localBaseUrl,
      refresh_daemon: refreshDaemon,
      profile_lock_recovery: profileLockRecovery,
      service_process_recovery: serviceProcessRecovery,
      manual_login_service_release: manualLoginServiceRelease,
      stale_worker_pid_cleared: Boolean(staleWorkerPid.cleared),
      stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
      auto_kill_chrome: false,
      profile_deleted: false,
      refresh_summary: sanitizeWorkerRefreshSummary(refreshSummary),
      health: summarizeHealth(postRefreshHealth.body),
      next_step: "Service is ready. Call allowlisted actions through service_base_url.",
      credential_material_output: false
    });
    return;
  }

  if (!shouldStartNewService({ postRefreshHealthOk: postRefreshHealth.ok, serviceAlreadyReachable })) {
    printJson({
      ok: false,
      command: "worker:start",
      service_already_running: Boolean(serviceAlreadyReachable || postRefreshHealth.ok),
      service_started: false,
      service_ready: false,
      auth_recovery_attempted: Boolean(authRecoveryAttempted),
      open_profile_attempted: Boolean(openProfileAttempted),
      service_base_url: localBaseUrl,
      profile_lock_recovery: profileLockRecovery,
      service_process_recovery: serviceProcessRecovery,
      manual_login_service_release: manualLoginServiceRelease,
      stale_worker_pid_cleared: Boolean(staleWorkerPid.cleared),
      stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
      auto_kill_chrome: false,
      profile_deleted: false,
      refresh_summary: sanitizeWorkerRefreshSummary(refreshSummary),
      health: postRefreshHealth.ok ? summarizeHealth(postRefreshHealth.body) : null,
      blocking_issue: "service_running_but_not_ready",
      next_step: "Run npm run worker:status. If manual login is required, run npm run worker:start after completing profile interaction.",
      credential_material_output: false
    });
    process.exitCode = 1;
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

  const health = await waitForServiceReady(15000);
  const refreshDaemon = health.ok && serviceHealthReady(health.body)
    ? ensureRefreshDaemon()
    : { running: false, started: false, pid: null };
  printJson({
    ok: Boolean(health.ok && serviceHealthReady(health.body)),
    command: "worker:start",
    service_already_running: Boolean(serviceAlreadyReachable),
    service_started: Boolean(health.ok),
    service_ready: Boolean(health.ok && serviceHealthReady(health.body)),
    auth_recovery_attempted: Boolean(authRecoveryAttempted),
    open_profile_attempted: Boolean(openProfileAttempted),
    service_base_url: localBaseUrl,
    refresh_daemon: refreshDaemon,
    pid_file: pidFile,
    log_file: logFile,
    profile_lock_recovery: profileLockRecovery,
    service_process_recovery: serviceProcessRecovery,
    manual_login_service_release: manualLoginServiceRelease,
    stale_worker_pid_cleared: Boolean(staleWorkerPid.cleared),
    stale_lock_auto_cleared: Boolean(profileLockRecovery?.stale_lock_auto_cleared),
    auto_kill_chrome: false,
    profile_deleted: false,
    refresh_summary: sanitizeWorkerRefreshSummary(refreshSummary),
    health: health.ok ? summarizeHealth(health.body) : null,
    next_step: health.ok && serviceHealthReady(health.body)
      ? "Use worker:status or call service actions."
      : "Run npm run worker:start after completing any pending manual login."
  });
  if (!health.ok || !serviceHealthReady(health.body)) {
    process.exitCode = 1;
  }
}

async function stopManagedServiceForManualLogin() {
  const pid = readPid();
  if (!pid) {
    return {
      ok: false,
      reason: "missing_worker_pid_file",
      signal_sent: false,
      service_still_reachable: Boolean((await fetchHealth()).ok),
      auto_kill_chrome: false,
      profile_deleted: false,
      credential_material_output: false
    };
  }

  let signalSent = false;
  try {
    process.kill(pid, "SIGTERM");
    signalSent = true;
  } catch {}

  const deadline = Date.now() + 8000;
  let health = await fetchHealth();
  while (health.ok && Date.now() < deadline) {
    await sleep(500);
    health = await fetchHealth();
  }
  if (!health.ok) {
    removePidFile();
  }

  return {
    ok: !health.ok,
    reason: health.ok ? "service_still_reachable" : "service_stopped_for_manual_login",
    pid,
    signal_sent: signalSent,
    service_still_reachable: Boolean(health.ok),
    auto_kill_chrome: false,
    profile_deleted: false,
    credential_material_output: false
  };
}

async function stopReachableServiceForRecovery(reason) {
  const stopped = [];
  const failed = [];
  const pidCandidates = [];
  const pid = readPid();
  if (pid) {
    pidCandidates.push({ pid, source: "pid_file" });
  }
  for (const listener of listServiceListenerPids()) {
    if (!pidCandidates.some((item) => item.pid === listener.pid)) {
      pidCandidates.push({ ...listener, source: "port_listener" });
    }
  }

  for (const candidate of pidCandidates) {
    const commandLine = commandForPid(candidate.pid);
    if (!isManagedServiceProcess(commandLine)) {
      failed.push({
        pid: candidate.pid,
        source: candidate.source,
        reason: "not_browser_backed_service_process",
        command_summary: summarizeProcessCommand(commandLine)
      });
      continue;
    }
    try {
      process.kill(candidate.pid, "SIGTERM");
      stopped.push({
        pid: candidate.pid,
        source: candidate.source,
        signal_sent: true,
        command_summary: summarizeProcessCommand(commandLine)
      });
    } catch (error) {
      failed.push({
        pid: candidate.pid,
        source: candidate.source,
        reason: "signal_failed",
        error_message_sanitized: sanitizeMessage(error),
        command_summary: summarizeProcessCommand(commandLine)
      });
    }
  }

  const deadline = Date.now() + 8000;
  let health = await fetchHealth();
  while (health.ok && Date.now() < deadline) {
    await sleep(500);
    health = await fetchHealth();
  }
  if (!health.ok) {
    removePidFile();
  }

  return {
    ok: !health.ok,
    reason,
    stopped_processes: stopped,
    skipped_processes: failed,
    service_still_reachable: Boolean(health.ok),
    auto_kill_chrome: false,
    profile_deleted: false,
    credential_material_output: false
  };
}

function listServiceListenerPids() {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) {
    return [];
  }
  return String(result.stdout || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ pid: Number(parts[1]), command: parts[0] }))
    .filter((item) => Number.isInteger(item.pid) && item.pid > 0);
}

function commandForPid(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function isManagedServiceProcess(commandLine) {
  const text = String(commandLine || "");
  return /\bnode\b|\bnode[0-9.]*\b/.test(path.basename(text.split(/\s+/)[0] || "node")) && /(?:^|\s)src\/server\.js(?:\s|$)/.test(text);
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

async function exposeWorker() {
  const health = await fetchHealth();
  const actions = health.ok ? await fetchActions() : { ok: false, body: null };
  if (!health.ok) {
    printJson({
      ok: false,
      command: "worker:expose",
      proxy_status: "not_started",
      local_service: localBaseUrl,
      service_base_url: null,
      next_step: "Run npm run worker:start on the Mac first.",
      credential_material_output: false
    });
    process.exitCode = 1;
    return;
  }

  const serviceBaseUrl = serviceBaseUrlForExpose();
  const existingProxy = await fetchProxyHealth();
  if (!existingProxy.ok) {
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    const logFd = fs.openSync(proxyLogFile, "a", 0o600);
    const child = spawn(process.execPath, ["scripts/mac-worker.js", "proxy"], {
      cwd: process.cwd(),
      detached: true,
      env: {
        ...process.env,
        PORT: String(port),
        BROWSER_BACKED_EXPOSE_PORT: String(exposePort),
        BROWSER_BACKED_EXPOSE_HOST: exposeHost
      },
      stdio: ["ignore", logFd, logFd]
    });
    child.unref();
    fs.writeFileSync(proxyPidFile, String(child.pid), { mode: 0o600 });
  }

  const proxyHealth = await waitForProxyHealth(8000);
  printJson({
    ok: Boolean(proxyHealth.ok),
    command: "worker:expose",
    ...buildExposeSummary({
      proxyStatus: proxyHealth.ok ? "running" : "failed",
      serviceBaseUrl,
      health: summarizeHealth(health.body),
      actions: summarizeActions(actions.body)
    }),
    proxy_pid_file: proxyPidFile,
    proxy_log_file: proxyLogFile,
    next_step: proxyHealth.ok
      ? "Set BROWSER_BACKED_SERVICE_BASE_URL to service_base_url in the remote main agent."
      : "Check proxy_log_file and confirm port 9787 is available."
  });
  if (!proxyHealth.ok) {
    process.exitCode = 1;
  }
}

async function runProxyServer() {
  const server = http.createServer(async (request, response) => {
    const classification = classifyProxyRequest(request.method, request.url);
    if (!classification.allowed) {
      sendJson(response, classification.reason === "method_not_allowed" ? 405 : 404, {
        ok: false,
        error_type: classification.reason,
        allowed_paths: ["/health", "/actions", "/actions/batch", "/actions/multi_source_plan", "/actions/<allowlisted_action>"],
        arbitrary_url_fetch_enabled: false,
        credential_material_output: false
      });
      return;
    }

    let body = "";
    try {
      body = await readProxyBody(request, proxyMaxRequestBytes);
      const upstream = await fetch(`${localBaseUrl}${classification.upstreamPath}`, {
        method: request.method,
        headers: request.method === "POST" ? { "content-type": "application/json" } : undefined,
        body: request.method === "POST" ? body : undefined
      });
      const text = await upstream.text();
      response.statusCode = upstream.status;
      response.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
      response.end(text);
    } catch (error) {
      sendJson(response, error.statusCode || 502, {
        ok: false,
        error_type: error.code || "worker_proxy_failed",
        error_message_sanitized: sanitizeMessage(error),
        credential_material_output: false
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(exposePort, exposeHost, resolve);
  });
  printJson({
    ok: true,
    command: "worker:proxy",
    proxy_status: "running",
    listen_host: exposeHost,
    listen_port: exposePort,
    local_service: localBaseUrl,
    allowed_paths: ["/health", "/actions", "/actions/<allowlisted_action>"],
    credential_material_output: false
  });
}

async function stopWorker() {
  const pid = readPid();
  const proxyPid = readProxyPid();
  const refreshDaemonPid = readRefreshDaemonPid();
  let proxySignalSent = false;
  let refreshDaemonSignalSent = false;
  if (refreshDaemonPid) {
    try {
      process.kill(refreshDaemonPid, "SIGTERM");
      refreshDaemonSignalSent = true;
    } catch {}
    await sleep(500);
    if (!classifyWorkerPid(refreshDaemonPid).pid_exists) {
      removeRefreshDaemonPidFile();
    }
  }
  if (proxyPid) {
    try {
      process.kill(proxyPid, "SIGTERM");
      proxySignalSent = true;
    } catch {}
    await sleep(500);
    const proxyHealth = await fetchProxyHealth();
    if (!proxyHealth.ok) {
      removeProxyPidFile();
    }
  }

  const pidState = classifyWorkerPid(pid);
  if (pidState.status === "stale") {
    removePidFile();
  }

  if (!pid || pidState.status === "stale") {
    const health = await fetchHealth();
    const proxyHealth = await fetchProxyHealth();
    printJson({
      ok: !health.ok && !proxyHealth.ok,
      command: "worker:stop",
      pid_file_found: Boolean(pid),
      stale_worker_pid_cleared: pidState.status === "stale",
      stale_worker_pid: pidState.status === "stale" ? pid : null,
      proxy_pid_file_found: Boolean(proxyPid),
      proxy_signal_sent: proxySignalSent,
      refresh_daemon_pid_file_found: Boolean(refreshDaemonPid),
      refresh_daemon_signal_sent: refreshDaemonSignalSent,
      service_still_reachable: Boolean(health.ok),
      proxy_still_reachable: Boolean(proxyHealth.ok),
      message: health.ok
        ? "Service is reachable but no worker pid file exists; stop the owning terminal/process manually."
        : "No worker pid file and service is not reachable.",
      credential_material_output: false
    });
    process.exitCode = health.ok || proxyHealth.ok ? 1 : 0;
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
    proxy_pid: proxyPid,
    signal_sent: signalSent,
    proxy_signal_sent: proxySignalSent,
    refresh_daemon_pid_file_found: Boolean(refreshDaemonPid),
    refresh_daemon_signal_sent: refreshDaemonSignalSent,
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
  const flags = new Set(process.argv.slice(3));
  const clearStaleLock = flags.has("--clear-stale-lock");
  const showProfileProcesses = flags.has("--show-profile-processes") || flags.has("--explain-lock") || clearStaleLock;
  const health = await fetchHealth();
  const proxyHealth = await fetchProxyHealth();
  const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" });
  const packageInstalled = fs.existsSync(path.join(process.cwd(), "node_modules"));
  const profileExists = fs.existsSync(profileDir);
  const profileLock = diagnoseProfileLock();
  let staleLockCleared = false;
  let staleLockClearError = null;
  if (clearStaleLock) {
    const clearResult = clearDedicatedStaleProfileLock(profileLock);
    staleLockCleared = Boolean(clearResult.stale_lock_cleared);
    staleLockClearError = clearResult.stale_lock_clear_error;
  }
  const postClearProfileLock = staleLockCleared ? diagnoseProfileLock() : profileLock;

  printJson({
    ok: staleLockClearError === null,
    command: "worker:doctor",
    node_version: process.version,
    npm_available: npmVersion.status === 0,
    npm_version: npmVersion.status === 0 ? npmVersion.stdout.trim() : null,
    package_installed: packageInstalled,
    service_base_url: localBaseUrl,
    expose_service_base_url: serviceBaseUrlForExpose(),
    port_reachable: Boolean(health.ok),
    proxy_port_reachable: Boolean(proxyHealth.ok),
    health: health.ok ? summarizeHealth(health.body) : null,
    profile_dir_configured: Boolean(profileDir),
    profile_exists: profileExists,
    profile_lock_files_present: postClearProfileLock.lock_files_present,
    profile_lock_file_names: postClearProfileLock.lock_files,
    profile_lock: showProfileProcesses
      ? postClearProfileLock
      : {
        status: postClearProfileLock.status,
        blocking_issue: postClearProfileLock.blocking_issue,
        daily_chrome_in_use: postClearProfileLock.daily_chrome_in_use,
        lock_files_present: postClearProfileLock.lock_files_present,
        action_allowed: postClearProfileLock.action_allowed,
        clear_stale_lock_allowed: postClearProfileLock.clear_stale_lock_allowed,
        auto_kill_allowed: false,
        auto_delete_lock_allowed: false,
        next_step: postClearProfileLock.next_step
      },
    stale_lock_clear_requested: clearStaleLock,
    stale_lock_cleared: staleLockCleared,
    stale_lock_clear_error: staleLockClearError,
    pid_file_exists: fs.existsSync(pidFile),
    proxy_pid_file_exists: fs.existsSync(proxyPidFile),
    next_steps: suggestNextSteps({ healthOk: health.ok, packageInstalled, profileExists, profileLock: postClearProfileLock }),
    auto_kill_chrome: false,
    auto_delete_lock: false,
    credential_material_output: false
  });
  if (staleLockClearError) {
    process.exitCode = 1;
  }
}

async function fetchHealth() {
  return fetchJson(`${localBaseUrl}/health`, 3000);
}

async function fetchActions() {
  return fetchJson(`${localBaseUrl}/actions`, 3000);
}

async function fetchPrewarm() {
  return fetchJson(`${localBaseUrl}/prewarm`, 120000, { method: "POST" });
}

async function fetchProxyHealth() {
  return fetchJson(`${proxyLocalBaseUrl}/health`, 3000);
}

async function fetchJson(url, timeoutMs, { method = "GET" } = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, status: null, body: null };
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

async function waitForServiceReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastHealth = { ok: false, body: null };
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (health.ok) {
      lastHealth = health;
      if (serviceHealthReady(health.body)) {
        return health;
      }
    }
    await sleep(500);
  }
  return lastHealth;
}

async function waitForProxyHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchProxyHealth();
    if (health.ok) {
      return health;
    }
    await sleep(300);
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
    auth_state_expired: Boolean(body.auth_state_expired),
    origin_ready_state_stale: Boolean(body.origin_ready_state_stale),
    pending_manual_login: Boolean(body.pending_manual_login),
    next_step: typeof body.next_step === "string" ? body.next_step : null,
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

function suggestNextSteps({ healthOk, packageInstalled, profileExists, profileLock }) {
  if (!packageInstalled) {
    return ["Run npm install."];
  }
  if (!profileExists) {
    return ["Run npm run worker:start to enter open:profile when needed."];
  }
  if (profileLock?.status === "daily_chrome_profile_in_use") {
    return ["BROWSER_BACKED_PROFILE_DIR points at the daily Chrome profile. Do not close daily Chrome; switch to ~/.dennis-browser-backed/profile."];
  }
  if (profileLock?.status === "dedicated_profile_live_lock" && !healthOk) {
    return ["The dedicated browser-backed profile is in use. Ask the user to close the browser-backed profile window or stop the owning worker; do not kill Chrome automatically."];
  }
  if (profileLock?.status === "stale_profile_lock" && !healthOk) {
    return ["Dedicated profile has stale lock files. Run npm run worker:start to auto-clear dedicated stale locks and continue; use npm run worker:doctor -- --explain-lock if auto-clear fails."];
  }
  if (profileLock?.status === "unknown_lock" && !healthOk) {
    return ["Profile lock source is unknown. Stop and ask the user to inspect profile ownership; do not delete locks or kill Chrome."];
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

async function runServicePrewarmCommand() {
  const prewarm = await fetchPrewarm();
  const health = await fetchHealth();
  const summary = buildServicePrewarmRefreshSummary({
    prewarmBody: prewarm.body,
    healthBody: health.body
  });
  return {
    ok: prewarm.ok && health.ok && summary?.ok === true,
    status: prewarm.status,
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
    auth_state_expired: Boolean(summary.auth_state_expired),
    origin_ready_state_stale: Boolean(summary.origin_ready_state_stale),
    pending_manual_login: Boolean(summary.pending_manual_login),
    next_step: typeof summary.next_step === "string" ? summary.next_step : null,
    last_error_type: typeof summary.last_error_type === "string" ? summary.last_error_type : null,
    refreshed_origin_count: Number.isInteger(summary.refreshed_origin_count) ? summary.refreshed_origin_count : 0,
    origin_status: summary.origin_status && typeof summary.origin_status === "object"
      ? Object.fromEntries(Object.entries(summary.origin_status).map(([key, value]) => [
        key,
        {
          status: typeof value?.status === "string" ? value.status : null,
          page_ready: Boolean(value?.page_ready),
          current_origin: typeof value?.current_origin === "string" ? value.current_origin : null,
          final_origin: typeof value?.final_origin === "string" ? value.final_origin : null,
          error_type: typeof value?.error_type === "string" ? value.error_type : null,
          origin_freshness_age_ms: Number.isInteger(value?.origin_freshness_age_ms) ? value.origin_freshness_age_ms : null,
          origin_freshness_ttl_ms: Number.isInteger(value?.origin_freshness_ttl_ms) ? value.origin_freshness_ttl_ms : null,
          origin_ready_state_stale: Boolean(value?.origin_ready_state_stale),
          pending_manual_login: Boolean(value?.pending_manual_login)
        }
      ]))
      : {}
  };
}

function diagnoseProfileLock() {
  return classifyProfileLockState({
    profileDir,
    lockFiles: listProfileLockFiles(profileDir),
    processRows: listProcessRows(),
    pidExists: processExists
  });
}

function listProfileLockFiles(targetProfileDir) {
  try {
    if (!fs.existsSync(targetProfileDir)) {
      return [];
    }
    return fs.readdirSync(targetProfileDir)
      .filter((name) => PROFILE_LOCK_FILE_PATTERN.test(name))
      .slice(0, 50)
      .map((name) => {
        const filePath = path.join(targetProfileDir, name);
        let linkTarget = null;
        let content = null;
        try {
          const stat = fs.lstatSync(filePath);
          if (stat.isSymbolicLink()) {
            linkTarget = fs.readlinkSync(filePath);
          } else if (stat.isFile() && stat.size <= 4096) {
            content = fs.readFileSync(filePath, "utf8");
          }
        } catch {}
        return {
          name,
          path: filePath,
          link_target: linkTarget,
          content
        };
      });
  } catch {
    return [];
  }
}

function listProcessRows() {
  const result = spawnSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  if (result.status !== 0) {
    return [];
  }
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : null;
    })
    .filter(Boolean);
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

export function extractUserDataDir(command) {
  const text = String(command || "");
  const equalsMatch = text.match(/--user-data-dir=(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
  if (equalsMatch) {
    return normalizePath(equalsMatch[1] || equalsMatch[2] || equalsMatch[3]);
  }
  const spacedMatch = text.match(/--user-data-dir\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
  if (spacedMatch) {
    return normalizePath(spacedMatch[1] || spacedMatch[2] || spacedMatch[3]);
  }
  return null;
}

function parsePidFromLockTarget(value) {
  const text = String(value || "");
  const matches = [...text.matchAll(/(?:^|[^0-9])(\d{2,10})(?:$|[^0-9])/g)]
    .map((match) => Number(match[1]))
    .filter((pid) => Number.isInteger(pid) && pid > 1);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function isChromeLikeCommand(command) {
  const text = String(command || "");
  return /Google Chrome|Chromium|chrome(?!driver)|msedge|playwright/i.test(text);
}

function isDailyChromeCommand(command) {
  const text = String(command || "");
  return /Google Chrome/i.test(text) && !/--user-data-dir/.test(text);
}

function summarizeProcessCommand(command) {
  const text = String(command || "").replace(/\s+/g, " ").trim();
  return text
    .replace(/--user-data-dir=(?:"[^"]+"|'[^']+'|[^\s]+)/g, "--user-data-dir=[path]")
    .replace(/--user-data-dir\s+(?:"[^"]+"|'[^']+'|[^\s]+)/g, "--user-data-dir [path]")
    .slice(0, 220);
}

function publicProcessSummary(item) {
  return {
    pid: item.pid,
    command_summary: item.command_summary,
    user_data_dir_present: Boolean(item.user_data_dir),
    uses_configured_profile: Boolean(item.uses_configured_profile),
    uses_daily_chrome_profile: Boolean(item.uses_daily_chrome_profile)
  };
}

function normalizePath(value) {
  if (!value) {
    return null;
  }
  const text = String(value);
  const expanded = text.startsWith("~/") ? path.join(os.homedir(), text.slice(2)) : text;
  return path.resolve(expanded);
}

function pathEquals(left, right) {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function pathInside(child, parent) {
  const normalizedChild = normalizePath(child);
  const normalizedParent = normalizePath(parent);
  if (!normalizedChild || !normalizedParent || normalizedChild === normalizedParent) {
    return false;
  }
  const relative = path.relative(normalizedParent, normalizedChild);
  return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function profileLockNextStep(status) {
  if (status === "daily_chrome_profile_in_use") {
    return "Do not close daily Chrome. Configure BROWSER_BACKED_PROFILE_DIR to ~/.dennis-browser-backed/profile.";
  }
  if (status === "dedicated_profile_live_lock") {
    return "Ask the user to close the browser-backed dedicated profile window or stop the owning worker; do not kill Chrome automatically.";
  }
  if (status === "stale_profile_lock") {
    return "Run npm run worker:start to auto-clear dedicated stale locks and continue; use npm run worker:doctor -- --explain-lock if auto-clear fails.";
  }
  if (status === "unknown_lock") {
    return "Stop and ask the user to inspect the profile lock. Do not delete lock files or kill Chrome.";
  }
  return "No profile lock blocker detected.";
}

function readPid() {
  return readPidFile(pidFile);
}

function cleanupStaleWorkerPid() {
  const pid = readPid();
  const pidState = classifyWorkerPid(pid);
  if (pidState.status === "stale") {
    removePidFile();
    return { cleared: true, pid };
  }
  return { cleared: false, pid: pidState.pid };
}

function readProxyPid() {
  return readPidFile(proxyPidFile);
}

function readRefreshDaemonPid() {
  return readPidFile(refreshDaemonPidFile);
}

function readPidFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
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

function removeProxyPidFile() {
  try {
    fs.unlinkSync(proxyPidFile);
  } catch {}
}

function removeRefreshDaemonPidFile() {
  try {
    fs.unlinkSync(refreshDaemonPidFile);
  } catch {}
}

function ensureRefreshDaemon() {
  const pid = readRefreshDaemonPid();
  const pidState = classifyWorkerPid(pid);
  if (pidState.status === "live") {
    return {
      running: true,
      started: false,
      pid,
      log_file: refreshDaemonLogFile
    };
  }
  if (pidState.status === "stale") {
    removeRefreshDaemonPidFile();
  }

  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  const logFd = fs.openSync(refreshDaemonLogFile, "a", 0o600);
  const child = spawn(process.execPath, ["scripts/refresh-daemon.js"], {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, SERVICE_MODE: "live", PORT: String(port) },
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  fs.writeFileSync(refreshDaemonPidFile, String(child.pid), { mode: 0o600 });
  return {
    running: true,
    started: true,
    pid: child.pid,
    stale_pid_cleared: pidState.status === "stale",
    log_file: refreshDaemonLogFile
  };
}

function serviceBaseUrlForExpose() {
  const configured = process.env.BROWSER_BACKED_SERVICE_BASE_URL;
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  return `http://${firstPrivateIpv4Address()}:${exposePort}`;
}

function firstPrivateIpv4Address() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return "127.0.0.1";
}

function readProxyBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        const error = new Error("Proxy request body too large");
        error.statusCode = 413;
        error.code = "request_too_large";
        reject(error);
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(`${JSON.stringify(value, null, 2)}\n`);
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
