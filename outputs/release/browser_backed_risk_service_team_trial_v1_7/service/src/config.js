import fs from "node:fs";
import { getProfileDir, getStateFile } from "./authState.js";
import { ORIGIN_REGISTRY, listEnabledOriginKeys, listOriginDefinitions, listOriginKeys } from "./originRegistry.js";

const DEFAULT_MAX_LIVE_BODY_BYTES = 5 * 1024 * 1024;

export function loadConfig(env = process.env, options = {}) {
  const effectiveEnv = env === process.env ? loadLocalEnv(env) : env;
  const originRegistry = options.originRegistry || ORIGIN_REGISTRY;
  const platformKeys = listOriginKeys(originRegistry);
  const defaultEnabledPlatforms = listEnabledOriginKeys(originRegistry);
  const mode = effectiveEnv.SERVICE_MODE || "mock";
  if (!["mock", "live"].includes(mode)) {
    throw new Error("SERVICE_MODE must be either mock or live");
  }

  const enabledPlatforms = mode === "live"
    ? parseEnabledPlatforms(effectiveEnv.ENABLED_PLATFORMS, platformKeys, defaultEnabledPlatforms)
    : [...defaultEnabledPlatforms];
  const enabledPlatformSet = new Set(enabledPlatforms);
  const profileDir = getProfileDir(effectiveEnv);
  const stateFile = getStateFile(effectiveEnv);
  const config = {
    mode,
    enabledPlatforms,
    enabledPlatformsExplicit: mode === "live" && typeof effectiveEnv.ENABLED_PLATFORMS === "string",
    port: parsePort(effectiveEnv.PORT || "8787"),
    host: parseHost(effectiveEnv.HOST || "127.0.0.1"),
    userDataDir: profileDir,
    profileDir,
    stateFile,
    auth: {
      profileDir,
      stateFile
    },
    browser: {
      headless: effectiveEnv.BROWSER_HEADLESS !== "false",
      channel: effectiveEnv.PLAYWRIGHT_CHANNEL || "chrome",
      requestTimeoutMs: parsePositiveInt(effectiveEnv.REQUEST_TIMEOUT_MS || "15000", "REQUEST_TIMEOUT_MS"),
      maxLiveBodyBytes: parsePositiveInt(effectiveEnv.MAX_LIVE_BODY_BYTES || String(DEFAULT_MAX_LIVE_BODY_BYTES), "MAX_LIVE_BODY_BYTES")
    },
    concurrency: {
      actionGlobalMax: parsePositiveInt(effectiveEnv.ACTION_GLOBAL_MAX_CONCURRENCY || "4", "ACTION_GLOBAL_MAX_CONCURRENCY")
    },
    originRegistry,
    domains: buildDomainConfigs(originRegistry, effectiveEnv, enabledPlatformSet)
  };

  if (mode === "live") {
    validateLiveDomains(config.domains, enabledPlatforms);
  }

  return config;
}

function loadLocalEnv(env) {
  const localEnv = parseDotEnv(".env");
  return { ...localEnv, ...env };
}

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    parsed[key] = stripOptionalQuotes(value);
  }
  return parsed;
}

function stripOptionalQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parsePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parseHost(raw) {
  if (raw !== "127.0.0.1") {
    throw new Error("HOST must be 127.0.0.1");
  }
  return raw;
}

function parsePositiveInt(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function buildDomainConfigs(originRegistry, env, enabledPlatformSet) {
  const domains = {};
  for (const definition of listOriginDefinitions(originRegistry)) {
    const enabled = definition.enabled !== false && enabledPlatformSet.has(definition.name);
    domains[definition.name] = domainConfig(definition, env, enabled);
  }
  return domains;
}

function domainConfig(definition, env, enabled = true) {
  const rawOrigin = env[definition.envVar] || definition.defaultOrigin;
  const warmupEnvVar = definition.warmupEnvVar || definition.envVar.replace(/_ORIGIN$/, "_PREWARM_PATH");
  const rawPrewarmPath = env[warmupEnvVar] || definition.warmupPath || "/";
  return {
    key: definition.name,
    name: definition.name,
    label: definition.label || definition.name,
    envVar: definition.envVar,
    defaultOrigin: definition.defaultOrigin,
    actions: [...(definition.actions || [])],
    requiredForActions: [...(definition.requiredForActions || definition.actions || [])],
    requiredForHealth: definition.requiredForHealth !== false,
    requiredForRefresh: definition.requiredForRefresh !== false,
    optional: Boolean(definition.optional),
    refreshTtlMs: definition.refreshTtlMs,
    landingFlow: definition.landingFlow ? { ...definition.landingFlow } : null,
    enabled,
    origin: enabled && rawOrigin ? normalizeOrigin(rawOrigin, definition.envVar) : null,
    prewarmPath: enabled ? normalizeRelativePath(rawPrewarmPath, warmupEnvVar) : "/",
    warmupPath: enabled ? normalizeRelativePath(rawPrewarmPath, warmupEnvVar) : "/"
  };
}

function parseEnabledPlatforms(rawValue, platformKeys, defaultEnabledPlatforms = platformKeys) {
  if (rawValue === undefined || rawValue === null) {
    return [...defaultEnabledPlatforms];
  }

  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new Error("ENABLED_PLATFORMS must be a comma-separated list of supported platform keys");
  }

  const requested = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const unknown = requested.filter((item) => !platformKeys.includes(item));
  if (requested.length === 0 || unknown.length > 0) {
    throw new Error(`ENABLED_PLATFORMS must only include: ${platformKeys.join(", ")}`);
  }

  return [...new Set(requested)];
}

function validateLiveDomains(domains, enabledPlatforms) {
  const enabledSet = new Set(enabledPlatforms);
  const missing = Object.values(domains)
    .filter((domain) => enabledSet.has(domain.key))
    .filter((domain) => !domain.origin)
    .map((domain) => `${domain.key.toUpperCase()}_ORIGIN`);

  if (missing.length > 0) {
    throw new Error(`SERVICE_MODE=live requires fixed origins: ${missing.join(", ")}`);
  }
}

function normalizeOrigin(rawOrigin, name) {
  let parsed;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new Error(`${name} must be a valid URL origin`);
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an origin only, for example https://example.com`);
  }

  return parsed.origin;
}

export function normalizeRelativePath(rawPath, name = "path") {
  if (!rawPath || typeof rawPath !== "string") {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    throw new Error(`${name} must be a same-origin relative path starting with /`);
  }
  if (rawPath.includes("..")) {
    throw new Error(`${name} must not contain path traversal segments`);
  }

  return rawPath;
}
