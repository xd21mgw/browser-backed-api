import {
  classifyNavigation,
  isAuthRedirectTarget,
  originFromUrl,
  sanitizeErrorMessage,
  sanitizeUrl
} from "./diagnostics.js";

const DEFAULT_LANDING_CLICK_LABELS = Object.freeze(["下一步", "继续", "确认", "进入系统", "登录", "Continue", "Next", "Confirm"]);
const MAX_LANDING_CLICKS = 2;
const LANDING_WAIT_MS = 5000;
const LANDING_SETTLE_MS = 800;

export class BrowserBackedClient {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.pages = new Map();
    this.pageReady = new Map();
    this.browserInitialized = false;
  }

  async start() {
    if (this.context) {
      return;
    }

    const { chromium } = await import("playwright");
    this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
      channel: this.config.browser.channel,
      headless: this.config.browser.headless,
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: false
    });
    this.browserInitialized = true;
  }

  async prewarmAll() {
    await this.start();

    const results = [];
    for (const domain of Object.values(this.config.domains).filter((item) => item.enabled !== false)) {
      results.push(await this.prewarmDomain(domain.key));
    }
    return results;
  }

  async prewarmDomain(domainKey, { allowLandingFlow = true } = {}) {
    await this.start();

    const domain = this.config.domains[domainKey];
    if (!domain || !domain.origin) {
      throw new Error(`No fixed origin configured for domain ${domainKey}`);
    }

    const page = this.pages.get(domainKey) || (await this.context.newPage());
    this.pages.set(domainKey, page);

    const target = new URL(domain.prewarmPath, domain.origin).toString();
    let response = null;
    let navigationError = null;

    try {
      response = await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: this.config.browser.requestTimeoutMs
      });
    } catch (error) {
      navigationError = error;
    }

    if (domain.landingFlow?.sameOriginActivation || domain.key === "login_logs") {
      await waitForLandingSettle(page, this.config.browser.requestTimeoutMs);
    }

    const initialResult = buildNavigationDiagnostics({
      domain,
      target,
      page,
      response,
      navigationError
    });
    const authRedirectDetected = initialResult.error_type === "auth_redirect";
    const landingFlow = authRedirectDetected
      ? allowLandingFlow
        ? await this.runLandingFlow(page, domain)
        : manualLandingFlow(page, "manual_login_required")
      : allowLandingFlow
        ? await this.runSameOriginLandingFlow(page, domain, initialResult)
        : await this.observeSameOriginLandingFlow(page, domain, initialResult);
    const finalUrl = landingFlow.finalUrl || initialResult.final_url;
    const finalOrigin = landingFlow.finalOrigin || initialResult.final_origin;
    const navigationStatus = landingFlow.navigationStatus ?? initialResult.navigation_status;
    const sameOriginActual = Boolean(finalOrigin && finalOrigin === domain.origin);
    const errorType = landingFlow.errorType ||
      (sameOriginActual
        ? null
        :
        classifyNavigation({
          error: navigationError,
          finalUrl,
          finalOrigin,
          expectedOrigin: domain.origin,
          navigationStatus
        }) ||
        "page_load_error");
    const pageReady = Boolean(sameOriginActual && !errorType);
    this.pageReady.set(domain.key, pageReady);

    const errorMessage = navigationError
      ? sanitizeErrorMessage(navigationError)
      : errorType
        ? landingFlow.errorMessage || `Navigation ended outside configured origin`
        : null;

    return {
      key: domain.key,
      domain: domain.label,
      origin: domain.origin,
      configured_origin: domain.origin,
      prewarm_path: domain.prewarmPath,
      initial_url: initialResult.initial_url,
      final_url: sanitizeUrl(finalUrl),
      final_origin: finalOrigin,
      same_origin_expected: true,
      same_origin_actual: sameOriginActual,
      navigation_status: navigationStatus,
      status: statusFromPrewarm({ pageReady, errorType }),
      error_type: errorType,
      error_message_sanitized: errorMessage,
      auth_redirect_detected: authRedirectDetected,
      landing_flow_attempted: landingFlow.attempted,
      allowed_clicks_executed: landingFlow.allowedClicksExecuted,
      final_origin_after_landing: finalOrigin,
      page_ready: pageReady,
      landing_flow_status: landingFlow.status,
      landing_flow_root_cause: landingFlow.rootCause || null,
      landing_flow_observation: landingFlow.observation || null
    };
  }

  async runLandingFlow(page, domain) {
    const waitMs = Math.min(this.config.browser.requestTimeoutMs, LANDING_WAIT_MS);
    const result = {
      attempted: true,
      allowedClicksExecuted: 0,
      status: "waiting_for_auto_return",
      finalUrl: safePageUrl(page),
      finalOrigin: originFromUrl(safePageUrl(page)),
      navigationStatus: null,
      errorType: null,
      errorMessage: null
    };

    if (await waitForConfiguredOrigin(page, domain.origin, waitMs)) {
      result.finalUrl = safePageUrl(page);
      result.finalOrigin = originFromUrl(result.finalUrl);
      result.status = "auto_returned";
      return result;
    }

    for (let index = 0; index < MAX_LANDING_CLICKS; index += 1) {
      const observation = await observeLandingFlow(page, domain);
      result.observation = observation.summary;
      result.rootCause = observation.rootCause === "not_landing" ? null : observation.rootCause;
      if (isManualLandingRootCause(observation.rootCause)) {
        applyManualLandingResult(result, page, observation);
        return result;
      }

      const control = await findAllowedLandingControl(page, {
        allowedLabels: landingLabelsForDomain(domain),
        allowFormSubmit: Boolean(domain.landingFlow?.sameOriginActivation)
      });
      if (!control) {
        break;
      }

      await control.click({ timeout: waitMs });
      result.allowedClicksExecuted += 1;
      result.finalUrl = safePageUrl(page);
      result.finalOrigin = originFromUrl(result.finalUrl);

      if (await waitForConfiguredOrigin(page, domain.origin, waitMs)) {
        result.finalUrl = safePageUrl(page);
        result.finalOrigin = originFromUrl(result.finalUrl);
        result.status = "allowed_click_returned";
        return result;
      }

      result.finalUrl = safePageUrl(page);
      result.finalOrigin = originFromUrl(result.finalUrl);
      if (!isAuthRedirectTarget({ origin: result.finalOrigin, url: result.finalUrl })) {
        break;
      }
    }

    const manualRequired = Boolean(domain.landingFlow?.sameOriginActivation && result.allowedClicksExecuted === 0);
    result.status = manualRequired
      ? "manual_login_required"
      : result.allowedClicksExecuted >= MAX_LANDING_CLICKS
        ? "max_clicks_exceeded"
        : "landing_flow_blocked";
    result.errorType = manualRequired ? "manual_login_required" : "landing_flow_blocked";
    result.errorMessage = manualRequired
      ? "Manual profile activation is required for this landing flow"
      : "Auth landing flow did not return to configured origin";
    result.finalUrl = safePageUrl(page);
    result.finalOrigin = originFromUrl(result.finalUrl);
    result.rootCause = manualRequired ? "manual_login_required" : result.rootCause;
    return result;
  }

  async runSameOriginLandingFlow(page, domain, initialResult) {
    if (!domain.landingFlow?.sameOriginActivation || initialResult.final_origin !== domain.origin) {
      return defaultLandingFlow(initialResult.final_url, initialResult.final_origin);
    }

    const waitMs = Math.min(this.config.browser.requestTimeoutMs, LANDING_WAIT_MS);
    const result = {
      attempted: false,
      allowedClicksExecuted: 0,
      status: "not_needed",
      finalUrl: safePageUrl(page),
      finalOrigin: originFromUrl(safePageUrl(page)),
      navigationStatus: initialResult.navigation_status,
      errorType: null,
      errorMessage: null,
      rootCause: null,
      observation: null
    };

    let observation = await observeLandingFlow(page, domain);
    result.observation = observation.summary;
    result.rootCause = observation.rootCause === "not_landing" ? null : observation.rootCause;
    if (observation.rootCause === "not_landing") {
      return result;
    }

    result.attempted = true;
    if (observation.rootCause !== "lightweight_confirm_needed") {
      applyManualLandingResult(result, page, observation);
      return result;
    }

    const maxClicks = landingMaxClicksForDomain(domain);
    for (let index = 0; index < maxClicks; index += 1) {
      const control = await findAllowedLandingControl(page, {
        allowedLabels: landingLabelsForDomain(domain),
        allowFormSubmit: true
      });
      if (!control) {
        break;
      }

      await control.click({ timeout: waitMs });
      result.allowedClicksExecuted += 1;
      await waitForLandingSettle(page, waitMs);
      result.finalUrl = safePageUrl(page);
      result.finalOrigin = originFromUrl(result.finalUrl);

      observation = await observeLandingFlow(page, domain);
      result.observation = observation.summary;
      result.rootCause = observation.rootCause === "not_landing" ? "lightweight_confirm_needed" : observation.rootCause;

      if (observation.rootCause === "not_landing") {
        result.status = "completed";
        result.errorType = null;
        result.errorMessage = null;
        return result;
      }
      if (observation.rootCause !== "lightweight_confirm_needed") {
        applyManualLandingResult(result, page, observation);
        return result;
      }
    }

    result.status = "blocked";
    result.errorType = "auth_flow_not_completed_in_bound_context";
    result.errorMessage = "Archives landing flow remained in the bound origin after allowed confirmation clicks";
    result.finalUrl = safePageUrl(page);
    result.finalOrigin = originFromUrl(result.finalUrl);
    result.rootCause = "lightweight_confirm_needed";
    return result;
  }

  async observeSameOriginLandingFlow(page, domain, initialResult) {
    if (!domain.landingFlow?.sameOriginActivation || initialResult.final_origin !== domain.origin) {
      return defaultLandingFlow(initialResult.final_url, initialResult.final_origin);
    }

    const result = defaultLandingFlow(safePageUrl(page), originFromUrl(safePageUrl(page)));
    result.navigationStatus = initialResult.navigation_status;
    const observation = await observeLandingFlow(page, domain);
    result.observation = observation.summary;
    result.rootCause = observation.rootCause === "not_landing" ? null : observation.rootCause;
    if (observation.rootCause === "not_landing") {
      return result;
    }

    result.attempted = false;
    result.status = "manual_login_required";
    result.errorType = observation.rootCause === "lightweight_confirm_needed"
      ? "manual_login_required"
      : errorTypeForLandingRootCause(observation.rootCause);
    result.errorMessage = "Manual profile activation is required for this landing flow";
    return result;
  }

  domainState(domainKey) {
    const domain = this.config.domains[domainKey];
    const page = this.pages.get(domainKey) || null;
    const currentUrl = page ? safePageUrl(page) : null;
    const currentOrigin = originFromUrl(currentUrl);
    const originMatch = Boolean(currentOrigin && domain?.origin && currentOrigin === domain.origin);

    return {
      current_origin: currentOrigin,
      current_url: sanitizeUrl(currentUrl),
      page_ready: Boolean(this.pageReady.get(domainKey) && originMatch),
      auth_redirect_detected: isAuthRedirectTarget({ origin: currentOrigin, url: currentUrl })
    };
  }

  actionDiagnostics(action, originWarmed = false) {
    const domain = this.config.domains[action.domainKey];
    const state = this.domainState(action.domainKey);

    return {
      action_name: action.name,
      expected_origin: domain?.origin || null,
      bound_page_origin: state.current_origin,
      origin_warmed: Boolean(originWarmed),
      page_ready: state.page_ready,
      origin_match: Boolean(state.current_origin && domain?.origin && state.current_origin === domain.origin),
      auth_redirect_detected: Boolean(state.auth_redirect_detected)
    };
  }

  async runAction(action, actionRequest) {
    await this.start();

    const domain = this.config.domains[action.domainKey];
    let page = this.pages.get(action.domainKey);
    if (!page) {
      await this.prewarmDomain(action.domainKey);
      page = this.pages.get(action.domainKey);
    }

    const diagnostics = this.actionDiagnostics(action, true);
    if (!diagnostics.origin_match || !diagnostics.page_ready) {
      const error = new Error(`Action page origin mismatch for ${action.name}`);
      error.code = "origin_mismatch";
      error.diagnostics = diagnostics;
      throw error;
    }

    if (actionRequest.followUp?.type === "weapon_graph_risk") {
      return page.evaluate(
        async ({ graphPath, riskDataPath, product, includeRiskData, maxDeviceIds, timeoutMs, maxBodyBytes }) => {
          const graph = await fetchCapped(graphPath, "GET", null, timeoutMs, maxBodyBytes);
          const graphParsed = parseJson(graph.text);
          if (!graphParsed.ok) {
            return {
              completed: true,
              ok: graph.ok,
              status: graph.status,
              contentType: graph.contentType,
              bodyText: graph.text,
              bodyTruncated: graph.truncated,
              observedBytes: graph.observedBytes
            };
          }

          const deviceIds = extractDeviceIds(graphParsed.value).slice(0, maxDeviceIds);
          const riskDataResults = [];
          let riskDataStatus = "not_executed_missing_device_id";
          let observedBytes = graph.observedBytes;
          let bodyTruncated = graph.truncated;

          if (!includeRiskData) {
            riskDataStatus = "not_requested";
          } else if (deviceIds.length > 0) {
            riskDataStatus = "completed";
            for (const deviceId of deviceIds) {
              const params = new URLSearchParams({ product, deviceIds: deviceId });
              const riskPath = `${riskDataPath}?${params.toString()}`;
              try {
                const risk = await fetchCapped(riskPath, "GET", null, timeoutMs, maxBodyBytes);
                observedBytes += risk.observedBytes;
                bodyTruncated = bodyTruncated || risk.truncated;
                const parsedRisk = parseJson(risk.text);
                if (!parsedRisk.ok) {
                  riskDataStatus = "risk_partial_failed";
                  riskDataResults.push({
                    ok: risk.ok,
                    status: risk.status,
                    parse_error: true,
                    body: null
                  });
                  continue;
                }
                if (!risk.ok) {
                  riskDataStatus = "risk_partial_failed";
                }
                riskDataResults.push({
                  ok: risk.ok,
                  status: risk.status,
                  body: parsedRisk.value
                });
              } catch {
                riskDataStatus = "risk_partial_failed";
                riskDataResults.push({
                  ok: false,
                  status: null,
                  error_type: "network_error",
                  body: null
                });
              }
            }
          }

          return {
            completed: true,
            ok: graph.ok,
            status: graph.status,
            contentType: "application/json",
            bodyText: JSON.stringify({
              graphData: graphParsed.value,
              riskDataResults,
              weapon_chain: {
                graphData_status: graph.ok ? "completed" : "platform_error",
                riskData_status: riskDataStatus,
                selected_device_count: deviceIds.length
              }
            }),
            bodyTruncated,
            observedBytes
          };

          async function fetchCapped(path, method, body, timeout, maxBytes) {
            const controller = new AbortController();
            const timeoutHandle = setTimeout(() => controller.abort(), timeout);
            try {
              const response = await fetch(path, {
                method,
                credentials: "include",
                headers: {
                  accept: "application/json",
                  "content-type": "application/json"
                },
                body: method === "GET" ? undefined : JSON.stringify(body || {}),
                signal: controller.signal
              });
              const readResult = await readCappedText(response, maxBytes);
              return {
                ok: response.ok,
                status: response.status,
                contentType: response.headers.get("content-type") || null,
                text: readResult.text,
                truncated: readResult.truncated,
                observedBytes: readResult.observedBytes
              };
            } finally {
              clearTimeout(timeoutHandle);
            }
          }

          async function readCappedText(response, maxBytes) {
            if (!response.body) {
              const text = await response.text();
              return {
                text: text.slice(0, maxBytes),
                truncated: text.length > maxBytes,
                observedBytes: Math.min(text.length, maxBytes)
              };
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const chunks = [];
            let observedBytes = 0;
            let truncated = false;

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              if (observedBytes + value.byteLength > maxBytes) {
                const remaining = Math.max(maxBytes - observedBytes, 0);
                if (remaining > 0) {
                  chunks.push(value.slice(0, remaining));
                  observedBytes += remaining;
                }
                truncated = true;
                await reader.cancel();
                break;
              }

              chunks.push(value);
              observedBytes += value.byteLength;
            }

            const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
            return { text, truncated, observedBytes };
          }

          function parseJson(text) {
            try {
              return { ok: true, value: JSON.parse(text) };
            } catch {
              return { ok: false, value: null };
            }
          }

          function extractDeviceIds(value) {
            const payload = value && typeof value === "object" && value.data && typeof value.data === "object"
              ? value.data
              : value;
            const pointInfoMap = payload && typeof payload === "object" && !Array.isArray(payload)
              ? payload.pointInfoMap
              : null;
            if (!pointInfoMap || typeof pointInfoMap !== "object" || Array.isArray(pointInfoMap)) {
              return [];
            }
            const ids = [];
            for (const [key, node] of Object.entries(pointInfoMap)) {
              if (isDeviceId(key)) {
                ids.push(key);
              }
              collectStrings(node, ids, 0);
            }
            return [...new Set(ids.filter(isDeviceId))];
          }

          function collectStrings(value, output, depth) {
            if (depth > 4 || value === null || value === undefined) {
              return;
            }
            if (typeof value === "string" || typeof value === "number") {
              output.push(String(value));
              return;
            }
            if (Array.isArray(value)) {
              for (const item of value.slice(0, 100)) {
                collectStrings(item, output, depth + 1);
              }
              return;
            }
            if (typeof value === "object") {
              for (const [key, child] of Object.entries(value).slice(0, 100)) {
                output.push(String(key));
                collectStrings(child, output, depth + 1);
              }
            }
          }

          function isDeviceId(value) {
            return /^(ANDROID|IOS)_[A-Za-z0-9_.:-]+$/.test(String(value || ""));
          }
        },
        {
          graphPath: actionRequest.path,
          riskDataPath: actionRequest.followUp.riskDataPath,
          product: actionRequest.followUp.product,
          includeRiskData: actionRequest.followUp.includeRiskData,
          maxDeviceIds: actionRequest.followUp.maxDeviceIds,
          timeoutMs: this.config.browser.requestTimeoutMs,
          maxBodyBytes: this.config.browser.maxLiveBodyBytes
        }
      );
    }

    return page.evaluate(
      async ({ path, method, body, timeoutMs, maxBodyBytes, responseBodyCap }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(path, {
            method,
            credentials: "include",
            headers: {
              accept: "application/json",
              "content-type": "application/json"
            },
            body: method === "GET" ? undefined : JSON.stringify(body || {}),
            signal: controller.signal
          });

          const contentType = response.headers.get("content-type") || null;
          const readResult = await readCappedText(response, maxBodyBytes, responseBodyCap, contentType);
          return {
            completed: true,
            ok: response.ok,
            status: response.status,
            contentType,
            bodyText: readResult.text,
            bodyTruncated: readResult.truncated,
            observedBytes: readResult.observedBytes,
            returnedBytes: readResult.returnedBytes,
            jsonArrayCap: readResult.jsonArrayCap || null
          };
        } finally {
          clearTimeout(timeout);
        }

        async function readCappedText(response, maxBytes, cap, contentType) {
          if (cap && cap.kind === "json_array" && /\bjson\b/i.test(String(contentType || ""))) {
            const text = await response.text();
            const observedBytes = byteLength(text);
            const capped = buildJsonArrayCappedText(text, cap, maxBytes);
            if (capped.ok) {
              return capped;
            }
            if (observedBytes <= maxBytes) {
              return {
                text,
                truncated: false,
                observedBytes,
                returnedBytes: observedBytes,
                jsonArrayCap: {
                  attempted: true,
                  ok: false,
                  errorType: capped.errorType || "json_array_path_not_found",
                  path: cap.pathLabel || String(cap.path || "")
                }
              };
            }
            const snippet = text.slice(0, maxBytes);
            return {
              text: snippet,
              truncated: true,
              observedBytes,
              returnedBytes: byteLength(snippet),
              jsonArrayCap: {
                attempted: true,
                ok: false,
                errorType: capped.errorType || "json_parse_error",
                path: cap.pathLabel || String(cap.path || "")
              }
            };
          }

          if (!response.body) {
            const text = await response.text();
            return {
              text: text.slice(0, maxBytes),
              truncated: text.length > maxBytes,
              observedBytes: text.length,
              returnedBytes: Math.min(text.length, maxBytes)
            };
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const chunks = [];
          let observedBytes = 0;
          let truncated = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            if (observedBytes + value.byteLength > maxBytes) {
              const remaining = Math.max(maxBytes - observedBytes, 0);
              if (remaining > 0) {
                chunks.push(value.slice(0, remaining));
                observedBytes += remaining;
              }
              truncated = true;
              await reader.cancel();
              break;
            }

            chunks.push(value);
            observedBytes += value.byteLength;
          }

          const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
          return { text, truncated, observedBytes, returnedBytes: byteLength(text) };
        }

        function buildJsonArrayCappedText(text, cap, maxBytes) {
          let value;
          try {
            value = JSON.parse(text);
          } catch {
            return { ok: false, errorType: "json_parse_error" };
          }

          const path = Array.isArray(cap.path) ? cap.path : [];
          const target = valueAtPath(value, path);
          if (!Array.isArray(target)) {
            return { ok: false, errorType: "json_array_path_not_found" };
          }

          const maxRecords = clampPositiveInteger(cap.maxRecords, 300, 300);
          const observedRecords = target.length;
          const targetRecords = Math.min(observedRecords, maxRecords);
          const best = fitJsonArrayCapToBytes(value, path, target, targetRecords, maxBytes);
          const returnedRecords = best.returnedRecords;
          const missingRecords = Math.max(observedRecords - returnedRecords, 0);
          const capReason = missingRecords > 0
            ? returnedRecords < targetRecords
              ? "byte_limit"
              : observedRecords > maxRecords
                ? "record_limit"
                : "response_too_large"
            : null;
          return {
            ok: true,
            text: best.text,
            truncated: missingRecords > 0,
            observedBytes: byteLength(text),
            returnedBytes: byteLength(best.text),
            jsonArrayCap: {
              attempted: true,
              ok: true,
              path: cap.pathLabel || path.join("."),
              observedRecords,
              returnedRecords,
              missingRecords,
              maxRecords,
              capReason,
              rawBodyHandling: missingRecords > 0 ? "json_array_capped" : "visible"
            }
          };
        }

        function fitJsonArrayCapToBytes(value, path, records, targetRecords, maxBytes) {
          let low = 0;
          let high = targetRecords;
          let best = buildCappedJsonText(value, path, records, 0);

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const candidate = buildCappedJsonText(value, path, records, mid);
            if (byteLength(candidate) <= maxBytes || mid === 0) {
              best = candidate;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          return {
            text: best,
            returnedRecords: valueAtPath(JSON.parse(best), path).length
          };
        }

        function buildCappedJsonText(value, path, records, count) {
          const cappedValue = JSON.parse(JSON.stringify(value));
          setValueAtPath(cappedValue, path, records.slice(0, count));
          return JSON.stringify(cappedValue);
        }

        function valueAtPath(value, path) {
          let cursor = value;
          for (const key of path) {
            if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !Object.prototype.hasOwnProperty.call(cursor, key)) {
              return undefined;
            }
            cursor = cursor[key];
          }
          return cursor;
        }

        function setValueAtPath(value, path, nextValue) {
          let cursor = value;
          for (const key of path.slice(0, -1)) {
            cursor = cursor[key];
          }
          cursor[path[path.length - 1]] = nextValue;
        }

        function clampPositiveInteger(value, fallback, max) {
          const number = Number(value);
          if (!Number.isFinite(number) || number <= 0) {
            return fallback;
          }
          return Math.min(Math.trunc(number), max);
        }

        function byteLength(text) {
          return new TextEncoder().encode(String(text || "")).byteLength;
        }
      },
      {
        path: actionRequest.path,
        method: actionRequest.method,
        body: actionRequest.body,
        timeoutMs: this.config.browser.requestTimeoutMs,
        maxBodyBytes: this.config.browser.maxLiveBodyBytes,
        responseBodyCap: actionRequest.responseBodyCap || null
      }
    );
  }

  async runActionWithContextRequest(action, actionRequest) {
    await this.start();

    const domain = this.config.domains[action.domainKey];
    const requestUrl = sameOriginActionUrl(domain, actionRequest.path);
    const method = actionRequest.method || action.method || "GET";
    const response = await this.context.request.fetch(requestUrl, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      data: method === "GET" ? undefined : JSON.stringify(actionRequest.body || {}),
      timeout: this.config.browser.requestTimeoutMs,
      failOnStatusCode: false
    });
    const body = await response.body();
    const maxBytes = this.config.browser.maxLiveBodyBytes;
    const readResult = readBoundedBuffer(body, maxBytes, actionRequest.responseBodyCap, response.headers()["content-type"] || null);

    return {
      completed: true,
      ok: response.ok(),
      status: response.status(),
      contentType: response.headers()["content-type"] || null,
      bodyText: readResult.text,
      bodyTruncated: readResult.truncated,
      observedBytes: readResult.observedBytes,
      returnedBytes: readResult.returnedBytes,
      jsonArrayCap: readResult.jsonArrayCap || null
    };
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.pages.clear();
      this.pageReady.clear();
    }
    this.browserInitialized = false;
  }

  status() {
    return {
      browser_initialized: this.browserInitialized,
      context_initialized: Boolean(this.context)
    };
  }
}

function buildNavigationDiagnostics({ domain, target, page, response, navigationError }) {
  const finalUrl = safePageUrl(page);
  const finalOrigin = originFromUrl(finalUrl);
  const navigationStatus = navigationError ? "error" : response?.status() ?? "no_response";
  const sameOriginActual = Boolean(finalOrigin && finalOrigin === domain.origin);
  const errorType = classifyNavigation({
    error: navigationError,
    finalUrl,
    finalOrigin,
    expectedOrigin: domain.origin,
    navigationStatus
  });

  return {
    initial_url: sanitizeUrl(target),
    final_url: sanitizeUrl(finalUrl),
    final_origin: finalOrigin,
    same_origin_actual: sameOriginActual,
    navigation_status: navigationStatus,
    error_type: errorType
  };
}

function safePageUrl(page) {
  try {
    return page.url();
  } catch {
    return null;
  }
}

function sameOriginActionUrl(domain, rawPath) {
  if (!domain?.origin || typeof rawPath !== "string" || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    const error = new Error("Invalid fixed action path for context request");
    error.code = "origin_mismatch";
    throw error;
  }

  const url = new URL(rawPath, domain.origin);
  if (url.origin !== domain.origin) {
    const error = new Error("Context request URL must remain on the configured origin");
    error.code = "origin_mismatch";
    throw error;
  }

  return url.toString();
}

function readBoundedBuffer(buffer, maxBytes, responseBodyCap, contentType) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  if (responseBodyCap?.kind === "json_array" && /\bjson\b/i.test(String(contentType || ""))) {
    const text = bytes.toString("utf8");
    const capped = buildJsonArrayCappedTextForNode(text, responseBodyCap, maxBytes);
    if (capped.ok) {
      return capped;
    }

    if (bytes.byteLength <= maxBytes) {
      return {
        text,
        truncated: false,
        observedBytes: bytes.byteLength,
        returnedBytes: bytes.byteLength,
        jsonArrayCap: {
          attempted: true,
          ok: false,
          errorType: capped.errorType || "json_array_path_not_found",
          path: responseBodyCap.pathLabel || String(responseBodyCap.path || "")
        }
      };
    }

    const snippet = bytes.subarray(0, maxBytes).toString("utf8");
    return {
      text: snippet,
      truncated: true,
      observedBytes: bytes.byteLength,
      returnedBytes: Buffer.byteLength(snippet, "utf8"),
      jsonArrayCap: {
        attempted: true,
        ok: false,
        errorType: capped.errorType || "json_parse_error",
        path: responseBodyCap.pathLabel || String(responseBodyCap.path || "")
      }
    };
  }

  const bodyTruncated = bytes.byteLength > maxBytes;
  const cappedBody = bodyTruncated ? bytes.subarray(0, maxBytes) : bytes;
  const text = cappedBody.toString("utf8");
  return {
    text,
    truncated: bodyTruncated,
    observedBytes: bytes.byteLength,
    returnedBytes: Buffer.byteLength(text, "utf8")
  };
}

function buildJsonArrayCappedTextForNode(text, responseBodyCap, maxBytes) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errorType: "json_parse_error" };
  }

  const path = Array.isArray(responseBodyCap.path) ? responseBodyCap.path : [];
  const target = valueAtPath(value, path);
  if (!Array.isArray(target)) {
    return { ok: false, errorType: "json_array_path_not_found" };
  }

  const maxRecords = clampPositiveInteger(responseBodyCap.maxRecords, 300, 300);
  const observedRecords = target.length;
  const targetRecords = Math.min(observedRecords, maxRecords);
  const best = fitJsonArrayCapToBytes(value, path, target, targetRecords, maxBytes);
  const returnedRecords = best.returnedRecords;
  const cappedText = best.text;
  const missingRecords = Math.max(observedRecords - returnedRecords, 0);
  const capReason = missingRecords > 0
    ? returnedRecords < targetRecords
      ? "byte_limit"
      : observedRecords > maxRecords
        ? "record_limit"
        : "response_too_large"
    : null;
  return {
    ok: true,
    text: cappedText,
    truncated: missingRecords > 0,
    observedBytes: Buffer.byteLength(text, "utf8"),
    returnedBytes: Buffer.byteLength(cappedText, "utf8"),
    jsonArrayCap: {
      attempted: true,
      ok: true,
      path: responseBodyCap.pathLabel || path.join("."),
      observedRecords,
      returnedRecords,
      missingRecords,
      maxRecords,
      capReason,
      rawBodyHandling: missingRecords > 0 ? "json_array_capped" : "visible"
    }
  };
}

function fitJsonArrayCapToBytes(value, path, records, targetRecords, maxBytes) {
  let low = 0;
  let high = targetRecords;
  let best = buildCappedJsonText(value, path, records, 0);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildCappedJsonText(value, path, records, mid);
    if (Buffer.byteLength(candidate, "utf8") <= maxBytes || mid === 0) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    text: best,
    returnedRecords: valueAtPath(JSON.parse(best), path).length
  };
}

function buildCappedJsonText(value, path, records, count) {
  const cappedValue = cloneJson(value);
  setValueAtPath(cappedValue, path, records.slice(0, count));
  return JSON.stringify(cappedValue);
}

function valueAtPath(value, path) {
  let cursor = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !Object.prototype.hasOwnProperty.call(cursor, key)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function setValueAtPath(value, path, nextValue) {
  let cursor = value;
  for (const key of path.slice(0, -1)) {
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = nextValue;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampPositiveInteger(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(number), max);
}

function defaultLandingFlow(finalUrl, finalOrigin) {
  return {
    attempted: false,
    allowedClicksExecuted: 0,
    status: "not_needed",
    finalUrl,
    finalOrigin,
    navigationStatus: null,
    errorType: null,
    errorMessage: null
  };
}

function manualLandingFlow(page, rootCause = "manual_login_required") {
  return {
    attempted: false,
    allowedClicksExecuted: 0,
    status: "manual_login_required",
    finalUrl: safePageUrl(page),
    finalOrigin: originFromUrl(safePageUrl(page)),
    navigationStatus: null,
    errorType: errorTypeForLandingRootCause(rootCause),
    errorMessage: "Manual profile activation is required for this landing flow",
    rootCause,
    observation: null
  };
}

function statusFromPrewarm({ pageReady, errorType }) {
  if (pageReady) {
    return "ready";
  }
  if ([
    "auth_redirect",
    "login_page",
    "landing_flow_blocked",
    "auth_flow_not_completed_in_bound_context",
    "manual_login_required",
    "two_factor_required",
    "captcha_required",
    "permission_blocked"
  ].includes(errorType)) {
    return "auth_failed";
  }
  return "error";
}

async function waitForConfiguredOrigin(page, configuredOrigin, timeout) {
  const currentOrigin = originFromUrl(safePageUrl(page));
  if (currentOrigin === configuredOrigin) {
    return true;
  }
  if (typeof page.waitForURL !== "function") {
    return false;
  }

  try {
    await page.waitForURL((url) => originFromUrl(String(url)) === configuredOrigin, {
      waitUntil: "domcontentloaded",
      timeout
    });
    return originFromUrl(safePageUrl(page)) === configuredOrigin;
  } catch {
    return false;
  }
}

async function findAllowedLandingControl(page, { allowedLabels = DEFAULT_LANDING_CLICK_LABELS, allowFormSubmit = false } = {}) {
  if (typeof page.getByRole === "function") {
    for (const label of allowedLabels) {
      const control = page.getByRole("button", { name: looseLabelPattern(label) }).first();
      if (await isSafeLandingControl(control, { allowFormSubmit })) {
        return control;
      }
    }
  }

  if (typeof page.evaluate === "function") {
    const clickPreview = await evaluateLandingPage(page, {
      allowedLabels,
      allowFormSubmit,
      mode: "click_preview"
    });
    if (clickPreview?.clickable) {
      return {
        async click({ timeout: _timeout } = {}) {
          const clickResult = await evaluateLandingPage(page, {
            allowedLabels,
            allowFormSubmit,
            mode: "click"
          });
          if (!clickResult?.clicked) {
            throw new Error("Allowed landing control disappeared before click");
          }
        }
      };
    }
  }
  return null;
}

async function isSafeLandingControl(control, { allowFormSubmit = false } = {}) {
  try {
    if ((await control.count()) < 1) {
      return false;
    }
    if (typeof control.isVisible === "function" && !(await control.isVisible({ timeout: 500 }))) {
      return false;
    }
    if (typeof control.isEnabled === "function" && !(await control.isEnabled({ timeout: 500 }))) {
      return false;
    }
    if (typeof control.evaluate === "function") {
      const safety = await control.evaluate((element) => {
        const tagName = element.tagName || "";
        const type = element.getAttribute?.("type") || "";
        const ariaDisabled = element.getAttribute?.("aria-disabled") || "";
        return {
          isButton: tagName.toLowerCase() === "button",
          isSubmit: type.toLowerCase() === "submit",
          inForm: Boolean(element.closest?.("form")),
          disabled: Boolean(element.disabled || ariaDisabled.toLowerCase() === "true")
        };
      });
      return Boolean(
        safety.isButton &&
        !safety.disabled &&
        (allowFormSubmit || (!safety.isSubmit && !safety.inForm))
      );
    }
    return true;
  } catch {
    return false;
  }
}

async function observeLandingFlow(page, domain) {
  const fallback = {
    rootCause: "not_landing",
    summary: {
      current_origin: originFromUrl(safePageUrl(page)),
      current_path: safePathFromUrl(safePageUrl(page)),
      title_present: false,
      allowed_button_labels: [],
      username_input_present: false,
      username_prefilled: false,
      password_input_present: false,
      two_factor_signal: false,
      captcha_signal: false,
      qr_signal: false,
      permission_blocked_signal: false
    }
  };
  if (typeof page.evaluate !== "function") {
    return fallback;
  }

  try {
    const snapshot = await evaluateLandingPage(page, {
      allowedLabels: landingLabelsForDomain(domain),
      allowFormSubmit: true,
      mode: "snapshot"
    });
    return landingObservationFromSnapshot(page, domain, snapshot);
  } catch {
    return fallback;
  }
}

function landingObservationFromSnapshot(page, domain, snapshot) {
  const summary = {
    current_origin: originFromUrl(safePageUrl(page)),
    current_path: safePathFromUrl(safePageUrl(page)),
    title_present: Boolean(snapshot?.titlePresent),
    allowed_button_labels: sanitizeButtonLabels(snapshot?.allowedButtonLabels),
    allowed_control_kinds: sanitizeButtonLabels(snapshot?.allowedControlKinds),
    allowlisted_clickable_control_present: Boolean(snapshot?.allowlistedClickableControlPresent),
    username_input_present: Boolean(snapshot?.usernameInputPresent),
    username_prefilled: Boolean(snapshot?.usernamePrefilled),
    account_display_present: Boolean(snapshot?.accountDisplayPresent),
    password_input_present: Boolean(snapshot?.passwordInputPresent),
    two_factor_signal: Boolean(snapshot?.twoFactorSignal),
    captcha_signal: Boolean(snapshot?.captchaSignal),
    qr_signal: Boolean(snapshot?.qrSignal),
    permission_blocked_signal: Boolean(snapshot?.permissionBlockedSignal)
  };

  if (summary.permission_blocked_signal) {
    return { rootCause: "permission_blocked", summary };
  }
  if (summary.password_input_present) {
    return { rootCause: "password_required", summary };
  }
  if (summary.two_factor_signal || summary.qr_signal) {
    return { rootCause: "two_factor_required", summary };
  }
  if (summary.captcha_signal) {
    return { rootCause: "captcha_required", summary };
  }
  if (summary.username_input_present && !summary.username_prefilled) {
    return { rootCause: "manual_login_required", summary };
  }
  if (!isRecognizedLandingContext(summary, snapshot, domain)) {
    return { rootCause: "not_landing", summary };
  }
  if (
    summary.allowlisted_clickable_control_present &&
    (summary.username_prefilled || summary.account_display_present)
  ) {
    return { rootCause: "lightweight_confirm_needed", summary };
  }
  return { rootCause: "manual_login_required", summary };
}

async function evaluateLandingPage(page, { allowedLabels, allowFormSubmit, mode }) {
  return page.evaluate(({ allowedLabels: rawAllowedLabels, allowFormSubmit: rawAllowFormSubmit, mode: rawMode }) => {
    const allowedLabels = rawAllowedLabels.map(normalizeText).filter(Boolean);
    const allowFormSubmit = Boolean(rawAllowFormSubmit);
    const mode = rawMode || "snapshot";

    const visible = (element) => {
      if (!element) {
        return false;
      }
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.pointerEvents !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
    };
    const normalize = (value) => normalizeText(String(value || ""));
    const textOf = (element) => normalize(
      element.innerText ||
      element.textContent ||
      element.value ||
      element.getAttribute?.("aria-label") ||
      element.getAttribute?.("title") ||
      element.getAttribute?.("value") ||
      ""
    );
    const labelAllowed = (label) => {
      const normalized = normalize(label);
      return Boolean(normalized && allowedLabels.some((allowed) => normalized.includes(allowed)));
    };
    const disabled = (element) => {
      const ariaDisabled = String(element.getAttribute?.("aria-disabled") || "").toLowerCase();
      return Boolean(element.disabled || ariaDisabled === "true" || element.getAttribute?.("disabled") !== null);
    };
    const elementKind = (element, fallback = "clickable_text") => {
      const tagName = String(element.tagName || "").toLowerCase();
      const role = String(element.getAttribute?.("role") || "").toLowerCase();
      const type = String(element.getAttribute?.("type") || "").toLowerCase();
      if (tagName === "button") {
        return "button";
      }
      if (tagName === "input" && type === "submit") {
        return "input_submit";
      }
      if (tagName === "input" && type === "button") {
        return "input_button";
      }
      if (tagName === "a" && role === "button") {
        return "a_role_button";
      }
      if (role === "button") {
        return "role_button";
      }
      return fallback;
    };
    const candidates = [];
    const seen = new Set();
    const addCandidate = (element, kind, priority) => {
      if (!element || seen.has(element) || !visible(element) || disabled(element)) {
        return;
      }
      const tagName = String(element.tagName || "").toLowerCase();
      const type = String(element.getAttribute?.("type") || "").toLowerCase();
      const label = textOf(element);
      if (!labelAllowed(label)) {
        return;
      }
      if (!allowFormSubmit && (type === "submit" || Boolean(element.closest?.("form")))) {
        return;
      }
      seen.add(element);
      const rect = element.getBoundingClientRect();
      candidates.push({
        element,
        kind: kind || elementKind(element),
        label,
        priority,
        area: rect.width * rect.height,
        tagName
      });
    };

    for (const element of document.querySelectorAll("button")) {
      addCandidate(element, "button", 10);
    }
    for (const element of document.querySelectorAll("input[type='submit'],input[type='button']")) {
      addCandidate(element, elementKind(element), 20);
    }
    for (const element of document.querySelectorAll("a[role='button'],[role='button']")) {
      addCandidate(element, elementKind(element), 30);
    }
    for (const form of document.querySelectorAll("form")) {
      const submitControls = Array.from(form.querySelectorAll("button,input[type='submit'],input[type='button']"))
        .filter((element) => visible(element) && !disabled(element));
      const allowedSubmitControls = submitControls.filter((element) => labelAllowed(textOf(element)));
      if (allowedSubmitControls.length === 1) {
        addCandidate(allowedSubmitControls[0], "form_unique_submit", 40);
      }
    }
    for (const element of document.querySelectorAll("a,[onclick],[tabindex],[class*='button'],[class*='btn'],[class*='next'],[class*='confirm']")) {
      addCandidate(element, elementKind(element, "clickable_text"), 50);
    }
    for (const element of document.querySelectorAll("body *")) {
      const style = window.getComputedStyle(element);
      const childText = Array.from(element.children || []).map((child) => textOf(child)).filter(Boolean);
      const label = textOf(element);
      const childHasSameText = childText.some((text) => text === label);
      if (style.cursor === "pointer" && !childHasSameText) {
        addCandidate(element, elementKind(element, "clickable_text"), 60);
      }
    }

    candidates.sort((left, right) => left.priority - right.priority || left.area - right.area);
    if (mode === "click_preview") {
      const candidate = candidates[0] || null;
      return {
        clickable: Boolean(candidate),
        label: candidate?.label || null,
        kind: candidate?.kind || null
      };
    }
    if (mode === "click") {
      const candidate = candidates[0] || null;
      if (!candidate) {
        return { clicked: false };
      }
      candidate.element.click();
      return {
        clicked: true,
        label: candidate.label,
        kind: candidate.kind
      };
    }

    const allText = String(document.body?.innerText || "").slice(0, 5000);
    const title = String(document.title || "").trim();
    const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
    const usernameInputs = inputs.filter((input) => {
      const type = String(input.getAttribute("type") || "text").toLowerCase();
      const combined = [
        input.getAttribute("name"),
        input.getAttribute("id"),
        input.getAttribute("autocomplete"),
        input.getAttribute("placeholder"),
        input.getAttribute("aria-label")
      ].filter(Boolean).join(" ").toLowerCase();
      return ["text", "email", "tel"].includes(type) &&
        /(user|account|email|phone|mobile|login|username|账号|账户|用户名|手机号|邮箱|工号)/i.test(combined);
    });
    const passwordInputs = inputs.filter((input) => String(input.getAttribute("type") || "").toLowerCase() === "password");
    const textSignals = `${title}\n${allText}`;
    const accountDisplayPresent = /(当前账号|登录账号|账号[:：]|账户[:：]|用户名[:：]|current account|signed in as|login account)/i.test(textSignals);
    return {
      titlePresent: title.length > 0,
      allowedButtonLabels: candidates.map((item) => item.label),
      allowedControlKinds: candidates.map((item) => item.kind),
      allowlistedClickableControlPresent: candidates.length > 0,
      usernameInputPresent: usernameInputs.length > 0,
      usernamePrefilled: usernameInputs.length > 0 && usernameInputs.every((input) => String(input.value || "").trim().length > 0),
      accountDisplayPresent,
      passwordInputPresent: passwordInputs.length > 0,
      twoFactorSignal: /(otp|2fa|mfa|two[- ]?factor|verification code|one[- ]?time|动态码|二次验证|安全验证|短信验证码|手机验证码)/i.test(textSignals),
      captchaSignal: /(captcha|验证码|滑块|人机验证|安全校验)/i.test(textSignals),
      qrSignal: /(qr|二维码|扫码|扫一扫)/i.test(textSignals),
      permissionBlockedSignal: /(permission denied|forbidden|not authorized|无权限|没有权限|权限不足|无访问权限)/i.test(textSignals),
      landingSignal: /(sso|login|auth|account|confirm|认证|登录|账号|账户|身份|确认)/i.test(textSignals)
    };

    function normalizeText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }
  }, { allowedLabels, allowFormSubmit, mode });
}

function isRecognizedLandingContext(summary, snapshot, domain) {
  const currentOrigin = summary.current_origin;
  if (currentOrigin === domain.origin) {
    return Boolean(snapshot?.landingSignal || summary.username_input_present || summary.allowlisted_clickable_control_present);
  }
  return Boolean(
    domain.key === "archives" &&
    isAuthRedirectTarget({ origin: currentOrigin, url: currentOrigin })
  );
}

function applyManualLandingResult(result, page, observation) {
  result.status = "manual_login_required";
  result.errorType = errorTypeForLandingRootCause(observation.rootCause);
  result.errorMessage = "Manual profile activation is required for this landing flow";
  result.finalUrl = safePageUrl(page);
  result.finalOrigin = originFromUrl(result.finalUrl);
  result.rootCause = observation.rootCause;
  result.observation = observation.summary;
}

function isManualLandingRootCause(rootCause) {
  return [
    "manual_login_required",
    "password_required",
    "two_factor_required",
    "captcha_required",
    "permission_blocked"
  ].includes(rootCause);
}

function errorTypeForLandingRootCause(rootCause) {
  if (rootCause === "permission_blocked") {
    return "permission_blocked";
  }
  if (rootCause === "two_factor_required") {
    return "two_factor_required";
  }
  if (rootCause === "captcha_required") {
    return "captcha_required";
  }
  return "manual_login_required";
}

async function waitForLandingSettle(page, timeout) {
  if (typeof page.waitForLoadState === "function") {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeout, LANDING_SETTLE_MS) });
    } catch {}
  }
  if (typeof page.waitForTimeout === "function") {
    await page.waitForTimeout(LANDING_SETTLE_MS);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, LANDING_SETTLE_MS));
}

function landingLabelsForDomain(domain) {
  const labels = Array.isArray(domain?.landingFlow?.allowedLabels)
    ? domain.landingFlow.allowedLabels
    : DEFAULT_LANDING_CLICK_LABELS;
  return labels.filter((label) => typeof label === "string" && label.length > 0);
}

function landingMaxClicksForDomain(domain) {
  const value = Number(domain?.landingFlow?.maxClicks);
  if (!Number.isInteger(value) || value <= 0) {
    return MAX_LANDING_CLICKS;
  }
  return Math.min(value, MAX_LANDING_CLICKS);
}

function sanitizeButtonLabels(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    .map((item) => item.slice(0, 40));
}

function safePathFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }
  try {
    return new URL(rawUrl).pathname || "/";
  } catch {
    return null;
  }
}

function looseLabelPattern(label) {
  return new RegExp(escapeRegExp(label), /[a-z]/i.test(label) ? "i" : "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
