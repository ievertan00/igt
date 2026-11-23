import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import { resolveAskTargetDir } from "../../features/ask/save-handler.mjs";
import { resolvePracticePath } from "../../application/practice.mjs";
import { resolveVocabularyPath } from "../../shared/vocabulary-source.mjs";
import { resolveCoachReportsPath } from "../../application/coach-report-store.mjs";
import { isRemoteMode } from "../request-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PATH_FIELDS = {
  vaultDir: { env: "IGT_VAULT_PATH", label: "Obsidian vault folder" },
  reviewLog: { env: "IGT_REVIEW_FILE", label: "Review log file" },
  vocabularyFile: { env: "IGT_VOCABULARY_FILE", label: "Vocabulary file" },
  practiceLog: { env: "IGT_PRACTICE_FILE", label: "Practice log file" },
  askNotesDir: { env: "IGT_ASK_PATH", label: "Ask notes folder" },
  handbookReports: { env: "IGT_COACH_REPORTS_PATH", label: "Coach reports folder" },
};

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
}

function getPaths(config) {
  return {
    vaultDir: config.VaultDir ? resolveProjectPath(config.VaultDir) : "",
    reviewLog: resolveProjectPath(config.ReviewPath || "00_Review_logs.md"),
    vocabularyFile: resolveVocabularyPath(config),
    practiceLog: resolvePracticePath(config),
    askNotesDir: resolveAskTargetDir(config),
    handbookReports: resolveCoachReportsPath(config),
  };
}

function safePath(value, label) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw Object.assign(new Error(`${label} must be a text path`), {
      status: 400,
      code: "INVALID_REQUEST",
    });
  }
  const result = value.trim();
  if (result.length > 2048 || /[\r\n\0]/.test(result)) {
    throw Object.assign(new Error(`${label} is too long or contains invalid characters`), {
      status: 400,
      code: "INVALID_REQUEST",
    });
  }
  if (result && !path.isAbsolute(result)) {
    throw Object.assign(new Error(`${label} must be an absolute path`), { status: 400, code: "INVALID_REQUEST" });
  }
  return result ? path.normalize(result) : "";
}

function envPathValue(value) {
  if (!value.includes("#")) return value;
  const quote = ["'", "`", '"'].find(candidate => !value.includes(candidate));
  if (!quote) {
    throw Object.assign(new Error("The path cannot be represented in .env"), { status: 400, code: "INVALID_REQUEST" });
  }
  const escaped = quote === '"' && process.platform === "win32" ? value.replaceAll("\\", "/") : value;
  return `${quote}${escaped}${quote}`;
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function chooseWindowsPath(kind) {
  const picker = kind === "folder"
    ? "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Choose a folder'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }"
    : "$dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Title = 'Choose a Markdown file'; $dialog.Filter = 'Markdown files (*.md)|*.md|All files (*.*)|*.*'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }";
  const encoded = Buffer.from(`Add-Type -AssemblyName System.Windows.Forms; ${picker}`, "utf16le").toString("base64");

  return new Promise((resolve, reject) => {
    const process = spawn("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encoded], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    process.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
    process.stderr.setEncoding("utf8").on("data", (chunk) => { errors += chunk; });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code !== 0) reject(new Error(errors.trim() || "The Windows path picker could not be opened"));
      else resolve(output.trim());
    });
  });
}

export function registerFileSettingsRoutes({ config, loader = configLoader, host }) {
  register("POST", "/settings/files/pick", async (req, res, { body }) => {
    if (body?.kind !== "file" && body?.kind !== "folder") {
      return json(res, 400, errorPayload("INVALID_REQUEST", "Choose a file or folder"));
    }
    if (isRemoteMode(host)) {
      return json(res, 403, errorPayload("PICKER_UNAVAILABLE", "The native path picker opens on the server desktop and is disabled in remote mode. Type the server path instead."));
    }
    if (process.platform !== "win32") {
      return json(res, 501, errorPayload("PICKER_UNAVAILABLE", "The native path picker is currently available on Windows"));
    }
    try {
      const selectedPath = await chooseWindowsPath(body.kind);
      json(res, 200, { path: selectedPath });
    } catch (error) {
      json(res, 500, errorPayload("PICKER_FAILED", error.message || "Could not open the path picker", true));
    }
  });

  register("GET", "/settings/files", async (req, res) => {
    const resolved = loader.load();
    json(res, 200, { paths: getPaths(resolved) });
  });

  register("POST", "/settings/files", async (req, res, { body }) => {
    try {
      const submittedPaths = body?.paths && typeof body.paths === "object" ? body.paths : {};
      const updates = {};
      for (const [field, spec] of Object.entries(PATH_FIELDS)) {
        if (!Object.hasOwn(submittedPaths, field)) continue;
        updates[spec.env] = envPathValue(safePath(submittedPaths[field], spec.label));
      }

      loader.updateEnv(updates);
      const resolved = loader.load();
      Object.assign(config, resolved);
      json(res, 200, { ok: true, paths: getPaths(resolved) });
    } catch (error) {
      json(res, error.status || 500, errorPayload(
        error.code || "INTERNAL_ERROR",
        error.message || "Unable to save Markdown file locations",
        error.status >= 500,
      ));
    }
  });
}
