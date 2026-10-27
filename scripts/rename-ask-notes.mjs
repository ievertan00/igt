import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import configLoader from "../lib/shared/config-loader.mjs";
import { listAskNotes } from "../lib/application/ask-notes.mjs";

const mode = process.argv[2];
const root = process.argv[3];
if (!["prepare", "apply", "verify"].includes(mode) || !root || !path.isAbsolute(root)) throw new Error("Usage: prepare|apply|verify ABSOLUTE_BACKUP_DIRECTORY");
const backupRoot = path.resolve(root);
if (!backupRoot.startsWith(path.join(process.cwd(), "artifacts") + path.sep)) throw new Error("Backup must be in workspace artifacts.");
const config = configLoader.load();
const library = listAskNotes(config);
const directory = fs.realpathSync(library.directory);
const manifestPath = path.join(backupRoot, "rename-manifest.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const target = (name) => {
  if (name !== path.basename(name)) throw new Error("Invalid filename.");
  const file = path.resolve(directory, name);
  if (path.dirname(file) !== directory) throw new Error("Path outside Ask directory.");
  return file;
};
if (mode === "prepare") {
  if (fs.existsSync(manifestPath)) throw new Error("Rename manifest already exists.");
  const prior = JSON.parse(fs.readFileSync(path.join(backupRoot, "manifest.json"), "utf8"));
  const entries = library.notes.map((note) => {
    const original = prior.entries.find((entry) => entry.id === note.id);
    const bytes = fs.readFileSync(target(note.id));
    if (!original || hash(bytes) !== original.afterHash) throw new Error(`File changed since backup: ${note.id}`);
    const title = note.title.split(" / ")[0].trim();
    if (!/[\p{Script=Han}]/u.test(title) || /[\\/:*?"<>|\u0000-\u001f]/u.test(title) || /[. ]$/.test(title)) throw new Error(`Invalid Chinese title: ${title}`);
    const to = `${title}.md`;
    if (to !== note.id && fs.existsSync(target(to))) throw new Error(`Destination exists: ${to}`);
    return { from: note.id, to, hash: hash(bytes) };
  });
  if (new Set(entries.map((entry) => entry.to.toLocaleLowerCase())).size !== entries.length) throw new Error("Duplicate filenames.");
  fs.writeFileSync(manifestPath, JSON.stringify({ directory, entries }, null, 2), { flag: "wx" });
  console.log(JSON.stringify(entries.map(({from,to}) => ({from,to})), null, 2));
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.directory !== directory) throw new Error("Ask directory changed.");
  for (const entry of manifest.entries) {
    const source = target(entry.from), destination = target(entry.to);
    const file = fs.existsSync(source) ? source : destination;
    if (fs.lstatSync(file).isSymbolicLink() || hash(fs.readFileSync(file)) !== entry.hash) throw new Error(`Content changed: ${entry.from}`);
    if (source !== destination && fs.existsSync(source) && fs.existsSync(destination)) throw new Error(`Destination exists: ${entry.to}`);
    if (mode === "verify" && source !== destination && fs.existsSync(source)) throw new Error(`Not renamed: ${entry.from}`);
  }
  if (mode === "apply") for (const entry of manifest.entries) {
    const source = target(entry.from), destination = target(entry.to);
    if (source !== destination && fs.existsSync(source)) {
      if (fs.existsSync(destination) || hash(fs.readFileSync(source)) !== entry.hash) throw new Error("File changed during rename.");
      fs.renameSync(source, destination);
    }
  }
  const after = listAskNotes(config);
  if (after.notes.length !== manifest.entries.length) throw new Error("Unexpected note count.");
  for (const entry of manifest.entries) {
    if (!after.notes.some((note) => note.id === entry.to) || hash(fs.readFileSync(target(entry.to))) !== entry.hash) throw new Error(`Verification failed: ${entry.to}`);
  }
  console.log(JSON.stringify({ mode, verified: after.notes.length, unchangedContents: true, manifestPath }, null, 2));
}
