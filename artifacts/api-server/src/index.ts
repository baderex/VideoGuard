import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

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

function resolveDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.dirname(process.argv[1] ?? process.cwd());
  }
}

const selfDir = resolveDir();
const workspaceRoot = path.resolve(selfDir, "../../..");
const pythonScript = path.join(workspaceRoot, "artifacts/yolo-service/main.py");

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

if (!existsSync(pythonScript)) {
  throw new Error(`Python API script not found at ${pythonScript}`);
}

const python = findPython();
if (!python) {
  throw new Error("Python 3 not found");
}

const requirementsFile = path.join(
  workspaceRoot,
  "artifacts/yolo-service/requirements.txt",
);
if (existsSync(requirementsFile)) {
  try {
    console.log("[API] Ensuring Python dependencies are installed...");
    execSync(`"${python}" -m pip install -q -r "${requirementsFile}"`, {
      stdio: "inherit",
    });
    console.log("[API] Python dependencies ready.");
  } catch (e) {
    console.warn(
      "[API] pip install failed:",
      (e as Error).message,
    );
  }
}

console.log(
  `[API] Launching unified Python API service on port ${port}...`,
);

const proc = spawn(python, [pythonScript], {
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
  detached: false,
});

proc.on("error", (err) => {
  console.error("[API] Failed to start Python service:", err.message);
  process.exit(1);
});

proc.on("close", (code) => {
  process.exit(code ?? 0);
});

process.on("exit", () => {
  try {
    proc.kill();
  } catch {
    // ignore
  }
});

process.on("SIGTERM", () => {
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore
  }
});

process.on("SIGINT", () => {
  try {
    proc.kill("SIGINT");
  } catch {
    // ignore
  }
});
