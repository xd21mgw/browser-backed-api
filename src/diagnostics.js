const SENSITIVE_NAME_PATTERN = /(authorization|cookie|token|secret|session|password|credential|csrf|jwt|header)/i;
const SENSITIVE_NAME_GLOBAL_PATTERN = /(authorization|cookie|token|secret|session|password|credential|csrf|jwt|header)/gi;
const FIXED_AUTH_REDIRECT_ORIGINS = new Set([
  "https://sso.corp.kuaishou.com",
  "https://account.p.adm-corp.kuaishou.com",
  "https://account.p5.adm-corp.kuaishou.com"
]);

export function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "[invalid_url]";
  }

  if (parsed.protocol === "about:") {
    return parsed.href;
  }

  const authority = parsed.origin === "null" ? `${parsed.protocol}//${parsed.host}` : parsed.origin;
  const path = sanitizePathname(parsed.pathname || "/");
  const query = parsed.search ? "?[redacted_query]" : "";
  const hash = parsed.hash ? "#[redacted_hash]" : "";
  return `${authority}${path}${query}${hash}`;
}

export function originFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  try {
    const origin = new URL(rawUrl).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

export function sanitizeErrorMessage(errorOrMessage) {
  const raw = typeof errorOrMessage === "string" ? errorOrMessage : errorOrMessage?.message || "";
  if (!raw) {
    return null;
  }

  return raw
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi, (url) => sanitizeUrl(url))
    .replace(SENSITIVE_NAME_GLOBAL_PATTERN, "[redacted_sensitive_name]")
    .slice(0, 500);
}

export function classifyNavigation({ error = null, finalUrl = null, finalOrigin = null, expectedOrigin = null, navigationStatus = null } = {}) {
  const message = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  const normalizedUrl = String(finalUrl || "").toLowerCase();

  if (name.includes("timeout") || /timeout|timed out|aborted/.test(message)) {
    return "navigation_timeout";
  }

  if (/net::|err_name_not_resolved|dns|connection|tunnel|proxy|certificate|ssl|host resolver|network/.test(message)) {
    return "network_error";
  }

  if (finalOrigin && expectedOrigin && finalOrigin !== expectedOrigin) {
    if (isKnownAuthRedirectOrigin(finalOrigin) || looksAuthRedirect(normalizedUrl)) {
      return "auth_redirect";
    }
    if (looksLoginPage(normalizedUrl)) {
      return "login_page";
    }
    return "origin_mismatch";
  }

  if (looksLoginPage(normalizedUrl)) {
    return "login_page";
  }

  if (typeof navigationStatus === "number" && navigationStatus >= 400) {
    return "page_load_error";
  }

  if (error) {
    return "page_load_error";
  }

  return null;
}

export function sourceStatusFromErrorType(errorType) {
  switch (errorType) {
    case "auth_redirect":
    case "auth_failed":
    case "auth_flow_not_completed_in_bound_context":
    case "captcha_required":
    case "login_page":
    case "landing_flow_blocked":
    case "manual_login_required":
    case "two_factor_required":
      return "auth_failed";
    case "permission_blocked":
      return "blocked";
    case "navigation_timeout":
    case "timeout":
      return "timeout";
    case "parse_error":
      return "parse_error";
    case "parameter_error":
      return "parameter_error";
    case "network_error":
    case "page_load_error":
    case "origin_mismatch":
    default:
      return "blocked";
  }
}

export function isKnownAuthRedirectOrigin(origin) {
  return FIXED_AUTH_REDIRECT_ORIGINS.has(origin);
}

export function isAuthRedirectTarget({ origin = null, url = null } = {}) {
  return Boolean(isKnownAuthRedirectOrigin(origin) || looksAuthRedirect(String(url || "").toLowerCase()));
}

export function classifyHttpStatus(status) {
  if (status === 400 || status === 422) {
    return "parameter_error";
  }
  if (status === 401 || status === 403) {
    return "auth_failed";
  }
  if (status === 408 || status === 504) {
    return "timeout";
  }
  if (typeof status === "number" && status >= 500) {
    return "platform_error";
  }
  if (typeof status === "number" && status >= 400) {
    return "platform_error";
  }
  return null;
}

function sanitizePathname(pathname) {
  return pathname
    .split("/")
    .map((segment) => {
      if (!segment) {
        return segment;
      }
      const decoded = safeDecode(segment);
      if (SENSITIVE_NAME_PATTERN.test(decoded) || decoded.length > 96) {
        return "[redacted_segment]";
      }
      return segment;
    })
    .join("/");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksAuthRedirect(url) {
  return /(sso|oauth|cas|idp|passport|auth|account\.p5?\.adm-corp\.kuaishou\.com)/i.test(url);
}

function looksLoginPage(url) {
  return /(login|signin|sign-in|logon)/i.test(url);
}
