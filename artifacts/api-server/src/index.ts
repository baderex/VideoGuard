import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
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

// CJS-safe __dirname: esbuild injects __importMetaUrl via banner so
// import.meta.url works in the CommonJS bundle. Fallback to process.argv[1].
function resolveDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.dirname(process.argv[1] ?? process.cwd());
  }
}

const selfDir = resolveDir();
// From artifacts/api-server/src (dev) or artifacts/api-server/dist (prod),
// go up 3 levels to reach the workspace root.
const workspaceRoot = path.resolve(selfDir, "../../..");
const yoloScript = path.join(workspaceRoot, "artifacts/yolo-service/main.py");

// Resolve the Python 3 executable: prefer the Replit-local install, then PATH.
function findPython(): string | null {
  const candidates = [
    process.env["PYTHON"] ?? "",
    path.join(workspaceRoot, ".pythonlibs/bin/python3"),
    "/home/runner/workspace/.pythonlibs/bin/python3",
    "python3",
    "python",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, { stdio: "ignore" });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

const yoloPort = process.env["YOLO_PORT"] || "6000";

if (!existsSync(yoloScript)) {
  console.warn(
    `[YOLO] Detection script not found at ${yoloScript} — skipping YOLO service.`,
  );
} else {
  const python = findPython();
  if (!python) {
    console.warn("[YOLO] Python 3 not found — skipping YOLO service.");
  } else {
    // Install Python dependencies before spawning so the service starts cleanly
    // in any environment (dev, production, fresh clone, CI, etc.)
    const requirementsFile = path.join(
      workspaceRoot,
      "artifacts/yolo-service/requirements.txt",
    );
    if (existsSync(requirementsFile)) {
      try {
        console.log("[YOLO] Ensuring Python dependencies are installed...");
        execSync(`"${python}" -m pip install -q -r "${requirementsFile}"`, {
          stdio: "inherit",
        });
        console.log("[YOLO] Python dependencies ready.");
      } catch (e) {
        console.warn(
          "[YOLO] pip install failed — service may not start correctly:",
          (e as Error).message,
        );
      }
    }

    console.log(
      `[YOLO] Spawning detection service (python=${python}) on port ${yoloPort}...`,
    );

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
      try {
        yoloProc.kill();
      } catch {
        // ignore
      }
    });
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  autoSeedIfEmpty().catch((err) => console.error("[seed] Error:", err));
});
