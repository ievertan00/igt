import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import { resolveAskTargetDir } from "../../features/ask/save-handler.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PATH_FIELDS = {
  vaultDir: { env: "IGT_VAULT_DIR", label: "Obsidian vault folder" },
  reviewLog: { env: "IGT_REVIEW_PATH", label: "Review log path" },
  vocabularyFile: { env: "IGT_VOCAB_PATH", label: "Vocabulary file path" },
  practiceLog: { env: "IGT_PRACTICE_PATH", label: "Practice log path" },
  handbookReports: { env: "IGT_REPORT_PATH", label: "Coach reports folder" },
};

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
}

function resolveAskNotesDir(config) {
  return resolveAskTargetDir(config);
}

function getPaths(config) {
  const contentRoot = config.VaultDir || "docs";
  const vocabularyFile = config.VocabFile || "IGT Vocabulary.md";
  const practiceFile = config.PracticeFile || "IGT Practice.md";
  const vocabularyPath = config.VocabularyPath || (
    path.isAbsolute(vocabularyFile)
      ? vocabularyFile
      : path.join(contentRoot, vocabularyFile)
  );
  const practicePath = config.PracticePath || (
    path.isAbsolute(practiceFile)
      ? practiceFile
      : path.join(contentRoot, practiceFile)
  );

  return {
    vaultDir: config.VaultDir ? resolveProjectPath(config.VaultDir) : "",
    reviewLog: resolveProjectPath(config.ReviewPath || "00_Review_logs.md"),
    vocabularyFile: resolveProjectPath(vocabularyPath),
    practiceLog: resolveProjectPath(practicePath),
    askNotesDir: resolveAskNotesDir(config),
    handbookReports: resolveProjectPath(config.CoachReportsDir || config.ReportPath || "."),
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
  return result;
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
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

export function registerFileSettingsRoutes({ config }) {
  register("POST", "/settings/files/pick", async (req, res, { body }) => {
    if (body?.kind !== "file" && body?.kind !== "folder") {
      return json(res, 400, errorPayload("INVALID_REQUEST", "Choose a file or folder"));
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
    const resolved = configLoader.load();
    json(res, 200, { paths: getPaths(resolved) });
  });

  register("POST", "/settings/files", async (req, res, { body }) => {
    try {
      const submittedPaths = body?.paths && typeof body.paths === "object" ? body.paths : {};
      const updates = {};
      for (const [field, spec] of Object.entries(PATH_FIELDS)) {
        if (!Object.hasOwn(submittedPaths, field)) continue;
        updates[spec.env] = safePath(submittedPaths[field], spec.label);
        if (field === "handbookReports") updates.IGT_COACH_REPORTS_DIR = updates[spec.env];
      }
      if (Object.hasOwn(submittedPaths, "askNotesDir")) {
        const askDir = safePath(submittedPaths.askNotesDir, "Ask notes folder");
        // The CLI and Web Ask save flows read different legacy path fields.
        updates.IGT_ASK_PATH = askDir;
        updates.IGT_ASK_DIR = askDir;
      }

      configLoader.updateEnv(updates);
      const resolved = configLoader.load();
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
