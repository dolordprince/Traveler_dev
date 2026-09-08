import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(compression());
app.disable("x-powered-by");
app.use(morgan("tiny"));

// Proxy /api/* and /health to the FastAPI backend
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

app.use(
  ["/api", "/health"],
  createProxyMiddleware({
    target: FASTAPI_URL,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        console.error("[proxy error]", err.message);
        res.status(502).json({ error: "Backend unavailable", detail: err.message });
      },
    },
  })
);

// Serve Remix static assets with long-lived cache
app.use(
  "/assets",
  express.static("build/client/assets", { immutable: true, maxAge: "1y" })
);

// Serve other public static files
app.use(express.static("build/client", { maxAge: "1h" }));

// Handle all other requests with Remix SSR
const MODE = process.env.NODE_ENV || "production";

app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
    mode: MODE,
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Traveler Dev] Remix app running on http://localhost:${PORT}`);
  console.log(`[Traveler Dev] API proxying to ${FASTAPI_URL}`);
});
