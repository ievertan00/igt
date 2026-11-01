import fs from "node:fs";
import path from "node:path";
import { resolveAskTargetDir } from "../features/ask/save-handler.mjs";
import { readAskMetadata } from "../features/ask/metadata.mjs";

const maxNoteBytes = 1024 * 1024;
const maxLibraryBytes = 10 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status, code: "ASK_NOTES_ERROR" });

export function deleteAskNote(id, config = {}) {
  if (typeof id !== "string" || !id || /[\\/:\0]/.test(id) || id !== path.basename(id) || !/\.md$/i.test(id)) {
    throw fail(400, "Choose a valid Ask note.");
  }
  try {
    const directory = fs.realpathSync(resolveAskTargetDir(config));
    const file = path.join(directory, id);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(fs.realpathSync(file)) !== directory) {
      throw fail(400, "This Ask note is unavailable.");
    }
    fs.unlinkSync(file);
    return { deleted: true, id };
  } catch (error) {
    if (error.status) throw error;
    // Retrying after a lost response is safe when the note is already gone.
    if (error.code === "ENOENT") return { deleted: true, id };
    throw fail(503, "This Ask note could not be deleted. Try again.");
  }
}

export function listAskNotes(config = {}) {
  const directory = resolveAskTargetDir(config);
  if (!fs.existsSync(directory)) return { directory, notes: [] };
  const realDirectory = fs.realpathSync(directory);
  let libraryBytes = 0;
  const notes = fs.readdirSync(realDirectory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) return [];
    const file = path.join(realDirectory, entry.name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(fs.realpathSync(file)) !== realDirectory) return [];
    if (stat.size > maxNoteBytes) throw fail(413, `Ask note “${entry.name}” exceeds the 1 MB display limit.`);
    libraryBytes += stat.size;
    if (libraryBytes > maxLibraryBytes) throw fail(413, "The Ask notes folder exceeds the 10 MB display limit.");
    const content = fs.readFileSync(file, "utf8");
    const { body, ...metadata } = readAskMetadata(content);
    return [{ id: entry.name, modifiedAt: stat.mtime.toISOString(), bytes: stat.size, content, ...metadata }];
  }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.id.localeCompare(b.id));
  return { directory, notes };
}

export function readAskNote(id, config = {}) {
  if (typeof id !== "string" || !id || id !== path.basename(id) || !/\.md$/i.test(id)) {
    throw fail(400, "Choose a valid Ask note.");
  }
  try {
    const directory = resolveAskTargetDir(config);
    const realDirectory = fs.realpathSync(directory);
    const file = path.join(realDirectory, id);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(fs.realpathSync(file)) !== realDirectory) {
      throw fail(400, "This Ask note is unavailable.");
    }
    if (stat.size > maxNoteBytes) throw fail(413, "This Ask note is over the 1 MB display limit.");
    return { id, content: fs.readFileSync(file, "utf8"), bytes: stat.size };
  } catch (error) {
    if (error.status) throw error;
    throw fail(error.code === "ENOENT" ? 404 : 503, "This Ask note could not be read. Refresh the list and try again.");
  }
}
