import http from "node:http";
import { URL } from "node:url";
import { ACTIONS } from "./actions.js";
import { loadConfig } from "./config.js";
import { BrowserBackedApiService, publicError } from "./service.js";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

const config = loadConfig();
const service = new BrowserBackedApiService(config);
await service.init();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    writeJson(res, error.statusCode || 500, {
      error: {
        code: error.code || "internal_error",
        message: error.publicMessage || error.message || "Unexpected error"
      }
    });
  });
});

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      event: "browser_backed_api_started",
      mode: config.mode,
      host: config.host,
      port: config.port,
      actions: Object.keys(ACTIONS)
    })
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    return writeJson(res, 200, service.health());
  }

  if (req.method === "GET" && url.pathname === "/actions") {
    return writeJson(res, 200, service.actions());
  }

  if (req.method === "POST" && url.pathname === "/prewarm") {
    const result = await service.prewarm();
    return writeJson(res, 200, result);
  }

  if (req.method === "POST" && (url.pathname === "/actions/batch" || url.pathname === "/actions/multi_source_plan")) {
    const body = await readJsonBody(req);
    const response = await service.executeBatch(body);
    return writeJson(res, 200, response);
  }

  const actionMatch = url.pathname.match(/^\/actions\/([a-z0-9_]+)$/);
  if (req.method === "POST" && actionMatch) {
    const body = await readJsonBody(req);
    const response = await service.executeAction(actionMatch[1], body);
    return writeJson(res, 200, response);
  }

  throw httpError(404, "not_found", "Route not found");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) {
        chunks.push(chunk);
      }
    });

    req.on("end", () => {
      if (tooLarge) {
        reject(httpError(413, "request_too_large", "Request body is too large"));
        return;
      }
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(httpError(400, "invalid_json", "Request body must be valid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function writeJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

function httpError(statusCode, code, publicMessage) {
  return publicError(statusCode, code, publicMessage);
}

async function shutdown() {
  server.close();
  await service.close();
  process.exit(0);
}
