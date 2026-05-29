import path from "node:path";

const DEFAULT_USER_DATA_DIR = "/Users/pengcheng/chrome-agent-auth-profile";

export function loadConfig(env = process.env) {
  const mode = env.SERVICE_MODE || "mock";
  if (!["mock", "live"].includes(mode)) {
    throw new Error("SERVICE_MODE must be either mock or live");
  }

  const config = {
    mode,
    port: parsePort(env.PORT || "8787"),
    host: env.HOST || "127.0.0.1",
    userDataDir: path.resolve(env.USER_DATA_DIR || DEFAULT_USER_DATA_DIR),
    browser: {
      headless: env.BROWSER_HEADLESS !== "false",
      channel: env.PLAYWRIGHT_CHANNEL || "chrome",
      requestTimeoutMs: parsePositiveInt(env.REQUEST_TIMEOUT_MS || "15000", "REQUEST_TIMEOUT_MS"),
      maxLiveBodyBytes: parsePositiveInt(env.MAX_LIVE_BODY_BYTES || "65536", "MAX_LIVE_BODY_BYTES")
    },
    domains: {
      rcp: domainConfig("rcp", "RCP", env.RCP_ORIGIN, env.RCP_PREWARM_PATH || "/"),
      weapon: domainConfig("weapon", "Weapon", env.WEAPON_ORIGIN, env.WEAPON_PREWARM_PATH || "/"),
      login_logs: domainConfig("login_logs", "Login Logs", env.LOGIN_LOGS_ORIGIN, env.LOGIN_LOGS_PREWARM_PATH || "/"),
      track_analysis: domainConfig(
        "track_analysis",
        "Track Analysis",
        env.TRACK_ANALYSIS_ORIGIN,
        env.TRACK_ANALYSIS_PREWARM_PATH || "/"
      )
    }
  };

  if (mode === "live") {
    validateLiveDomains(config.domains);
  }

  return config;
}

function parsePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parsePositiveInt(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function domainConfig(key, label, rawOrigin, rawPrewarmPath) {
  return {
    key,
    label,
    origin: rawOrigin ? normalizeOrigin(rawOrigin, `${key.toUpperCase()}_ORIGIN`) : null,
    prewarmPath: normalizeRelativePath(rawPrewarmPath, `${key.toUpperCase()}_PREWARM_PATH`)
  };
}

function validateLiveDomains(domains) {
  const missing = Object.values(domains)
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
