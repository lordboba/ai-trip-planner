import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { schedulePlanRequestSchema } from "./domain/schedule-plans.ts";
import {
  addSuggestionToSchedulePlan,
  createSchedulePlan,
  getSchedulePlanById,
} from "./services/schedule-plan-service.ts";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readJson<T>(request: IncomingMessage) {
  return new Promise<T>((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function handler(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  if (method === "GET" && pathname === "/healthz") {
    sendJson(response, 200, {
      status: "ok",
      service: "atlas-backend",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/schedule-plans") {
    try {
      const body = await readJson<unknown>(request);
      const parsed = schedulePlanRequestSchema.safeParse(body);

      if (!parsed.success) {
        sendJson(response, 400, { error: "Invalid schedule plan payload." });
        return;
      }

      const stored = await createSchedulePlan(parsed.data);
      sendJson(response, 201, { planId: stored.id });
    } catch {
      sendJson(response, 400, { error: "Unable to parse JSON body." });
    }
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/schedule-plans/")) {
    const suffix = pathname.slice("/api/schedule-plans/".length);
    const stored = getSchedulePlanById(suffix);

    if (!stored) {
      sendJson(response, 404, { error: "Schedule plan not found" });
      return;
    }

    sendJson(response, 200, stored);
    return;
  }

  if (method === "POST" && pathname.startsWith("/api/schedule-plans/")) {
    const match = pathname.slice("/api/schedule-plans/".length).match(/^([^/]+)\/suggestions\/([^/]+)\/add$/);

    if (match) {
      const [, planId, suggestionId] = match;
      const updated = await addSuggestionToSchedulePlan(planId, suggestionId);

      if (!updated) {
        sendJson(response, 404, { error: "Schedule plan or suggestion was not found." });
        return;
      }

      sendJson(response, 200, updated);
      return;
    }
  }

  sendJson(response, 404, { error: "Route not found" });
}

const port = Number(process.env.TRIP_BACKEND_PORT ?? process.env.PORT ?? 8787);
const host = process.env.TRIP_BACKEND_HOST ?? "0.0.0.0";

const server = createServer((request, response) => {
  handler(request, response).catch((error) => {
    console.error("backend_request_failed", error);
    sendJson(response, 500, { error: "Internal server error" });
  });
});

server.listen(port, host, () => {
  console.log(`atlas-backend listening on http://${host}:${port}`);
});
