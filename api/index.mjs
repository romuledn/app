import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../dist/server/server.js");

let serverModule;

async function getServer() {
  if (!serverModule) {
    serverModule = await import(pathToFileURL(serverPath).href);
  }
  return serverModule.default ?? serverModule;
}

export default async function handler(req, res) {
  try {
    const server = await getServer();

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise((resolve) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          })
        : undefined;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      duplex: "half",
    });

    const response = await server.fetch(request, {}, {});

    res.statusCode = response.status;
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("SSR handler error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/html");
    res.end("<h1>Server Error</h1><pre>" + (err.stack || err.message) + "</pre>");
  }
}
