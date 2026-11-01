import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { test } from "node:test";
import { deleteAskNote, listAskNotes } from "../lib/application/ask-notes.mjs";
import { registerAskRoutes } from "../lib/server/routes/ask.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { serveStatic } from "../lib/server/static.mjs";

test("deleting an Ask note removes only that Markdown file and permits a safe retry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-delete-note-"));
  try {
    const directory = path.join(root, "notes");
    fs.mkdirSync(directory);
    const config = { AskDir: directory };
    fs.writeFileSync(path.join(directory, "Selected.md"), "# Selected\nExplanation");
    fs.writeFileSync(path.join(directory, "Keep.md"), "# Keep\nKeep this explanation");
    fs.writeFileSync(path.join(root, "Outside.md"), "Protected");
    fs.mkdirSync(path.join(directory, "Folder.md"));
    for (const id of [undefined, "", "../Outside.md", "..\\Outside.md", "C:Outside.md", "Keep.txt", "Keep.md\0"]) {
      assert.throws(() => deleteAskNote(id, config), error => error.status === 400);
    }
    assert.throws(() => deleteAskNote("Folder.md", config), error => error.status === 400);
    assert.deepEqual(deleteAskNote("Selected.md", config), { deleted: true, id: "Selected.md" });
    assert.equal(fs.existsSync(path.join(directory, "Selected.md")), false);
    assert.deepEqual(listAskNotes(config).notes.map(note => note.id), ["Keep.md"]);
    assert.equal(fs.readFileSync(path.join(directory, "Keep.md"), "utf8"), "# Keep\nKeep this explanation");
    assert.equal(fs.readFileSync(path.join(root, "Outside.md"), "utf8"), "Protected");
    assert.equal(deleteAskNote("Selected.md", config).deleted, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the runtime HTTP route deletes a saved note and subsequent listing stays empty", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "igt-delete-note-http-"));
  const config = { AskDir: directory };
  registerAskRoutes({ config, getLLMManager: () => { throw new Error("Deletion must not call an LLM"); } });
  const server = http.createServer((req, res) => {
    if (!serveStatic(req, res)) void dispatch(req, res);
  });
  try {
    fs.writeFileSync(path.join(directory, "Example.md"), "# Example\nSaved explanation");
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const remove = id => fetch(`${base}/ask/notes/delete`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    assert.equal((await (await fetch(`${base}/ask/notes`)).json()).notes.length, 1);
    const invalid = await remove("../Example.md");
    assert.equal(invalid.status, 400);
    assert.equal(fs.existsSync(path.join(directory, "Example.md")), true);
    const deleted = await remove("Example.md");
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { deleted: true, id: "Example.md" });
    assert.equal(fs.existsSync(path.join(directory, "Example.md")), false);
    assert.deepEqual((await (await fetch(`${base}/ask/notes`)).json()).notes, []);
    assert.equal((await fetch(`${base}/ask/notes/read?id=Example.md`)).status, 404);
    assert.equal((await remove("Example.md")).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
