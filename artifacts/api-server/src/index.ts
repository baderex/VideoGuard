import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { autoSeedIfEmpty } from "./lib/auto-seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../..");
const yoloScript = path.join(workspaceRoot, "artifacts/yolo-service/main.py");
const python = "/home/runner/workspace/.pythonlibs/bin/python3";

const yoloPort = process.env["YOLO_PORT"] || "6000";

console.log(`[YOLO] Spawning detection service on port ${yoloPort}...`);
const yoloProc = spawn(python, [yoloScript], {
  env: { ...process.env, PORT: yoloPort },
  stdio: "inherit",
  detached: false,
});

yoloProc.on("error", (err) => {
  console.error("[YOLO] Failed to start Python service:", err.message);
});

yoloProc.on("close", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[YOLO] Process exited with code ${code}`);
  }
});

process.on("exit", () => {
  yoloProc.kill();
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  autoSeedIfEmpty().catch((err) => console.error("[seed] Error:", err));
});
