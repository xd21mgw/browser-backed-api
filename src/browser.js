import {
  classifyNavigation,
  isAuthRedirectTarget,
  originFromUrl,
  sanitizeErrorMessage,
  sanitizeUrl
} from "./diagnostics.js";

const LANDING_CLICK_LABELS = Object.freeze(["继续", "下一步", "进入", "Continue", "Next"]);
const MAX_LANDING_CLICKS = 2;
const LANDING_WAIT_MS = 5000;

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

  async prewarmDomain(domainKey) {
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

    const initialResult = buildNavigationDiagnostics({
      domain,
      target,
      page,
      response,
      navigationError
    });
    const authRedirectDetected = initialResult.error_type === "auth_redirect";
    const landingFlow = authRedirectDetected
      ? await this.runLandingFlow(page, domain)
      : defaultLandingFlow(initialResult.final_url, initialResult.final_origin);
    const finalUrl = landingFlow.finalUrl || initialResult.final_url;
    const finalOrigin = landingFlow.finalOrigin || initialResult.final_origin;
    const navigationStatus = landingFlow.navigationStatus ?? initialResult.navigation_status;
    const sameOriginActual = Boolean(finalOrigin && finalOrigin === domain.origin);
    const errorType = sameOriginActual
      ? null
      : landingFlow.errorType ||
        classifyNavigation({
          error: navigationError,
          finalUrl,
          finalOrigin,
          expectedOrigin: domain.origin,
          navigationStatus
        }) ||
        "page_load_error";
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
      landing_flow_status: landingFlow.status
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
      const control = await findAllowedLandingControl(page);
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

    result.status = result.allowedClicksExecuted >= MAX_LANDING_CLICKS ? "max_clicks_exceeded" : "landing_flow_blocked";
    result.errorType = "landing_flow_blocked";
    result.errorMessage = "Auth landing flow did not return to configured origin";
    result.finalUrl = safePageUrl(page);
    result.finalOrigin = originFromUrl(result.finalUrl);
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
      page_ready: Boolean(this.pageReady.get(domainKey) && originMatch)
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
      origin_match: Boolean(state.current_origin && domain?.origin && state.current_origin === domain.origin)
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
      async ({ path, method, body, timeoutMs, maxBodyBytes }) => {
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

          const readResult = await readCappedText(response, maxBodyBytes);
          return {
            completed: true,
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type") || null,
            bodyText: readResult.text,
            bodyTruncated: readResult.truncated,
            observedBytes: readResult.observedBytes
          };
        } finally {
          clearTimeout(timeout);
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
      },
      {
        path: actionRequest.path,
        method: actionRequest.method,
        body: actionRequest.body,
        timeoutMs: this.config.browser.requestTimeoutMs,
        maxBodyBytes: this.config.browser.maxLiveBodyBytes
      }
    );
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

function statusFromPrewarm({ pageReady, errorType }) {
  if (pageReady) {
    return "ready";
  }
  if (["auth_redirect", "login_page", "landing_flow_blocked"].includes(errorType)) {
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

async function findAllowedLandingControl(page) {
  if (typeof page.getByRole !== "function") {
    return null;
  }

  for (const label of LANDING_CLICK_LABELS) {
    const control = page.getByRole("button", { name: exactLabelPattern(label) }).first();
    if (await isSafeLandingControl(control)) {
      return control;
    }
  }
  return null;
}

async function isSafeLandingControl(control) {
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
      return Boolean(safety.isButton && !safety.isSubmit && !safety.inForm && !safety.disabled);
    }
    return true;
  } catch {
    return false;
  }
}

function exactLabelPattern(label) {
  return new RegExp(`^${escapeRegExp(label)}$`, /[a-z]/i.test(label) ? "i" : "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
