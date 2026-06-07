// Client-side text-to-speech for /chat. Sends reply text to a local
// Kokoro-FastAPI engine (OpenAI-compatible /v1/audio/speech), then plays the
// returned WAV in the background so the text appears immediately and the voice
// follows without blocking the REPL. No TTS is done here — just HTTP + playback.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { colors, paint } from "./ui/index.mjs";

let enabled; // undefined until first init from config
let currentChild = null;
let currentFile = null;
let warned = false;

function ttsConfig(config) {
  const t = config?.Tts || {};
  return {
    baseUrl: (t.BaseUrl || "http://localhost:8880").replace(/\/+$/, ""),
    voice: t.Voice || "af_heart",
    model: t.Model || "kokoro",
    format: t.Format || "wav",
    speed: typeof t.Speed === "number" ? t.Speed : 1.0,
    leadMs: typeof t.LeadMs === "number" ? t.LeadMs : 300,
  };
}

function initEnabled(config) {
  if (enabled === undefined) enabled = config?.Tts?.Enabled !== false;
}

export function isEnabled(config) {
  initEnabled(config);
  return enabled;
}

export function toggle(config) {
  initEnabled(config);
  enabled = !enabled;
  if (!enabled) stop();
  return enabled;
}

// Kokoro streams its WAV response, so the RIFF/data chunk sizes are left as
// 0xFFFFFFFF placeholders and extra chunks may sit before `data`. Tolerant
// players cope, but Windows SoundPlayer rejects it as "not a valid wave file".
// Rebuild a canonical header (fmt + data only, correct sizes) so it plays.
// leadMs prepends that many milliseconds of silence to the audio. Windows audio
// endpoints can drop the first fraction of a second while waking from idle, which
// clips the opening words; a silent lead-in absorbs that wake-up window.
function normalizeWav(buf, leadMs = 0) {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return buf;
  }
  let fmt = null;
  let data = null;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "data") {
      if (size === 0xffffffff || size === 0 || body + size > buf.length) size = buf.length - body;
      data = buf.subarray(body, body + size);
      break;
    }
    if (id === "fmt ") {
      if (body + size > buf.length) size = buf.length - body;
      fmt = buf.subarray(body, body + size);
    }
    if (size === 0xffffffff) break; // malformed non-data chunk — bail, play as-is
    off = body + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) return buf;
  if (leadMs > 0 && fmt.length >= 16) {
    const channels = fmt.readUInt16LE(2) || 1;
    const sampleRate = fmt.readUInt32LE(4) || 24000;
    const blockAlign = (channels * ((fmt.readUInt16LE(14) || 16) / 8)) || 2;
    let lead = Math.round(sampleRate * blockAlign * (leadMs / 1000));
    lead -= lead % blockAlign; // keep sample-aligned
    if (lead > 0) data = Buffer.concat([Buffer.alloc(lead), data]);
  }
  const out = Buffer.alloc(12 + 8 + fmt.length + 8 + data.length);
  let p = 0;
  out.write("RIFF", p); p += 4;
  out.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, p); p += 4;
  out.write("WAVE", p); p += 4;
  out.write("fmt ", p); p += 4;
  out.writeUInt32LE(fmt.length, p); p += 4;
  fmt.copy(out, p); p += fmt.length;
  out.write("data", p); p += 4;
  out.writeUInt32LE(data.length, p); p += 4;
  data.copy(out, p);
  return out;
}

// Strip markdown so the speech doesn't read out asterisks, backticks, hashes.
function toSpeech(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stop() {
  if (currentChild) {
    try { currentChild.kill(); } catch {}
    currentChild = null;
  }
  if (currentFile) {
    try { fs.unlinkSync(currentFile); } catch {}
    currentFile = null;
  }
}

function play(file) {
  stop(); // kill any prior clip and remove its temp file
  currentFile = file;
  // SoundPlayer.PlaySync keeps the process alive for the clip's duration, so the
  // detached child can be killed to interrupt playback. unref() lets igt exit.
  const esc = file.replace(/'/g, "''");
  const ps = `(New-Object System.Media.SoundPlayer '${esc}').PlaySync()`;
  try {
    currentChild = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", ps],
      { stdio: "ignore", windowsHide: true },
    );
    currentChild.on("error", () => {});
    currentChild.unref();
  } catch {
    currentChild = null;
  }
}

export async function speak(text, config) {
  initEnabled(config);
  if (!enabled) return;
  const input = toSpeech(text);
  if (!input) return;

  const { baseUrl, voice, model, format, speed, leadMs } = ttsConfig(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input, voice, response_format: format, speed }),
      signal: controller.signal,
    });
    if (!res.ok) {
      warnOnce(`Voice off — TTS service returned ${res.status}. Use /voice to retry.`);
      return;
    }
    let buf = Buffer.from(await res.arrayBuffer());
    if (format === "wav") buf = normalizeWav(buf, leadMs);
    const file = path.join(os.tmpdir(), `igt-tts-${Date.now()}.${format}`);
    fs.writeFileSync(file, buf);
    play(file);
  } catch (err) {
    if (err?.name !== "AbortError") {
      warnOnce(`Voice off — can't reach TTS at ${baseUrl}. Is kokoro-engine running? Use /voice to retry.`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function warnOnce(msg) {
  if (warned) return;
  warned = true;
  process.stdout.write(paint(colors.yellow, `  ${msg}\n`));
}
