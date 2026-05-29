export class BrowserBackedClient {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.pages = new Map();
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
    for (const domain of Object.values(this.config.domains)) {
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
    await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: this.config.browser.requestTimeoutMs
    });

    const currentOrigin = new URL(page.url()).origin;
    if (currentOrigin !== domain.origin) {
      throw new Error(`Prewarm for ${domain.label} ended at ${currentOrigin}; expected ${domain.origin}`);
    }

    return {
      key: domain.key,
      domain: domain.label,
      origin: domain.origin,
      prewarm_path: domain.prewarmPath,
      status: "ready"
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

    const currentOrigin = new URL(page.url()).origin;
    if (currentOrigin !== domain.origin) {
      throw new Error(`Action ${action.name} page is at ${currentOrigin}; expected ${domain.origin}`);
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
