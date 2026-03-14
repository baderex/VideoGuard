import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { createProxyMiddleware } from "http-proxy-middleware";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const YOLO_PORT = process.env["YOLO_PORT"] || "6000";

// Express strips the "/api/yolo" mount prefix before passing req.url to the middleware,
// so req.url arrives as "/health", "/stream/1", etc. Prepend "/yolo" to match FastAPI routes.
app.use(
  "/api/yolo",
  createProxyMiddleware({
    target: `http://localhost:${YOLO_PORT}`,
    changeOrigin: true,
    pathRewrite: { "^/": "/yolo/" },
    on: {
      error: (_err, _req, res) => {
        if ("status" in res) {
          (res as express.Response).status(503).json({ error: "YOLO service unavailable" });
        }
      },
    },
  })
);

app.use("/api", router);

export default app;
