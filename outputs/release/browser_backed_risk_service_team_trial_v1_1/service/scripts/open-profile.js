import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "../src/config.js";
import { sanitizeErrorMessage, sanitizeUrl } from "../src/diagnostics.js";

process.env.SERVICE_MODE = "live";
process.env.BROWSER_HEADLESS = "false";

const config = loadConfig();
const { chromium } = await import("playwright");

let context = null;
let shuttingDown = false;

process.on("SIGINT", () => {
  shutdown(130).catch(() => process.exit(130));
});
process.on("SIGTERM", () => {
  shutdown(143).catch(() => process.exit(143));
});

try {
  context = await chromium.launchPersistentContext(config.profileDir, {
    channel: config.browser.channel,
    headless: false,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false
  });

  for (const domain of Object.values(config.domains).filter((item) => item.enabled !== false && item.origin)) {
    const page = await context.newPage();
    const target = new URL(domain.prewarmPath, domain.origin).toString();
    try {
      await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: config.browser.requestTimeoutMs
      });
      console.log(`${domain.label}: opened ${sanitizeUrl(target)}`);
    } catch (error) {
      console.log(`${domain.label}: opened with navigation warning: ${sanitizeErrorMessage(error)}`);
    }
  }

  console.log("");
  console.log("Complete SSO or landing steps manually in the opened browser windows.");
  console.log("No cookies, tokens, sessions, headers, DOM, localStorage, or response bodies are read by this script.");

  const rl = createInterface({ input, output });
  await rl.question("Press Enter here when manual profile activation is complete...");
  rl.close();
  await shutdown(0);
} catch (error) {
  console.error(`open:profile failed: ${sanitizeErrorMessage(error)}`);
  await shutdown(1);
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (context) {
    await context.close();
    context = null;
  }
  process.exit(exitCode);
}
