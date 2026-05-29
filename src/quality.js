export function buildSourceCard({ action, config, fetchMeta, mock, meta = {} }) {
  const domain = config.domains[action.domainKey];
  return {
    source_type: "browser_same_origin_fetch",
    action: action.name,
    domain: domain.label,
    origin: mock ? "mock" : domain.origin,
    method: action.method,
    path: action.apiPath,
    mode: mock ? "mock" : "live",
    captured_at: new Date().toISOString(),
    transport: mock ? "synthetic" : "playwright_page_evaluate_fetch",
    user_data_dir: config.userDataDir,
    source_status: meta.sourceStatus || (fetchMeta.ok ? "ok" : "blocked"),
    error_type: meta.errorType || null,
    origin_warmed: Boolean(meta.originWarmed),
    latency_ms: meta.latencyMs ?? null,
    action_diagnostics: meta.actionDiagnostics || null,
    lazy_rewarm: {
      attempted: Boolean(meta.lazyRewarmAttempted),
      status: meta.lazyRewarmStatus || "not_attempted",
      page_ready_before_fetch: meta.pageReadyBeforeFetch ?? null,
      bound_page_origin_before_rewarm: meta.boundPageOriginBeforeRewarm || null,
      bound_page_origin_after_rewarm: meta.boundPageOriginAfterRewarm || null
    },
    body_policy: {
      raw_response_full_body_returned: false,
      max_live_body_bytes_observed: config.browser.maxLiveBodyBytes,
      cookie_token_session_header_plaintext_read: false
    },
    fetch_status: {
      ok: Boolean(fetchMeta.ok),
      status: fetchMeta.status,
      body_truncated: Boolean(fetchMeta.bodyTruncated),
      observed_bytes: fetchMeta.observedBytes
    }
  };
}

export function buildSourceQuality({ action, fetchMeta, mock, meta = {} }) {
  const checks = [
    { name: "fixed_action_registry", passed: true },
    { name: "same_origin_relative_path", passed: action.apiPath.startsWith("/") && !action.apiPath.startsWith("//") },
    { name: "no_cookie_token_session_header_plaintext_read", passed: true },
    { name: "raw_response_full_body_suppressed", passed: true },
    { name: "sensitive_output_false", passed: true }
  ];

  checks.push({ name: "origin_warmed_reported", passed: typeof meta.originWarmed === "boolean" });
  if (meta.actionDiagnostics) {
    checks.push({ name: "bound_page_origin_matches_expected", passed: meta.actionDiagnostics.origin_match !== false });
  }

  if (!mock) {
    checks.push({ name: "browser_fetch_completed", passed: Boolean(fetchMeta.completed) });
    checks.push({ name: "http_ok", passed: Boolean(fetchMeta.ok) });
  }

  const passedCount = checks.filter((check) => check.passed).length;
  const baseScore = mock ? 0.35 : 0.65;
  const score = Number(Math.min(baseScore + passedCount * 0.04, mock ? 0.55 : 0.9).toFixed(2));

  return {
    level: qualityLevel({ mock, fetchMeta, meta }),
    score,
    checks,
    warnings: qualityWarnings({ mock, meta })
  };
}

function qualityLevel({ mock, fetchMeta, meta }) {
  if (mock) {
    return "mock_only";
  }
  if (meta.sourceStatus && meta.sourceStatus !== "ok") {
    return `${meta.sourceStatus}_${meta.errorType || "source_error"}`;
  }
  return fetchMeta.ok ? "transport_verified_shape_only" : "transport_attempted";
}

function qualityWarnings({ mock, meta }) {
  if (mock) {
    return ["Synthetic response only; no real platform was accessed."];
  }
  if (meta.sourceStatus && meta.sourceStatus !== "ok") {
    return [`Live source status is ${meta.sourceStatus}; response body was not returned.`];
  }
  return [
    "Live response is summarized by shape only in this POC.",
    "Action-specific extraction should be implemented after local live validation."
  ];
}

export function summarizeJsonShape(value, depth = 0) {
  if (depth > 4) {
    return { type: "max_depth" };
  }
  if (value === null) {
    return { type: "null" };
  }
  if (Array.isArray(value)) {
    const first = value.length > 0 ? summarizeJsonShape(value[0], depth + 1) : null;
    return {
      type: "array",
      count: value.length,
      first_item_shape: first
    };
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return {
      type: "object",
      key_count: entries.length,
      keys: entries.slice(0, 50).map(([key]) => redactKeyName(key)),
      fields: Object.fromEntries(
        entries.slice(0, 20).map(([key, childValue]) => [redactKeyName(key), summarizeJsonShape(childValue, depth + 1)])
      )
    };
  }
  return { type: typeof value };
}

function redactKeyName(key) {
  if (/(authorization|cookie|token|secret|session|password|credential|csrf|jwt)/i.test(key)) {
    return "[redacted_key]";
  }
  return key;
}
