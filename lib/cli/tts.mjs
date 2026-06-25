// Client-side text-to-speech for /chat. Sends reply text to a local
// Kokoro-FastAPI engine (OpenAI-compatible /v1/audio/speech), then plays the
// returned WAV in the background so the text appears immediately and the voice
// follows without blocking the REPL. No TTS is done here — just HTTP + playback.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
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
    stream: t.Stream === true,
    ffplay: t.FfplayPath || process.env.IGT_TTS_FFPLAY || "ffplay",
    sampleRate: typeof t.StreamSampleRate === "number" ? t.StreamSampleRate : 24000,
  };
}

// Cached one-time check that ffplay is runnable; streaming falls back to the WAV
// path if it isn't (e.g. ffmpeg not installed, or not on this process's PATH yet).
let _ffplayOk;
function ffplayAvailable(ffplay) {
  if (_ffplayOk !== undefined) return _ffplayOk;
  try {
    const r = spawnSync(ffplay, ["-version"], { stdio: "ignore", windowsHide: true });
    _ffplayOk = !r.error && r.status === 0;
  } catch {
    _ffplayOk = false;
  }
  return _ffplayOk;
}

function initEnabled(config) {
  // Opt-in: voice stays off unless config explicitly sets Tts.Enabled = true, so an
  // install without a local TTS service running never reaches out to a missing endpoint.
  if (enabled === undefined) enabled = config?.Tts?.Enabled === true;
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

export async function speak(text, config, { force = false } = {}) {
  initEnabled(config);
  if (!enabled && !force) return; // force = on-demand request (e.g. /review [a] key)
  const input = toSpeech(text);
  if (!input) return;

  const cfg = ttsConfig(config);
  // Stream only longer replies: CosyVoice3 streaming is unreliable on short inputs
  // (near-empty / vocoder crash), and short replies are already fast and reliable on
  // the non-streaming WAV path. Longer replies are where streaming actually helps.
  if (cfg.stream && input.length >= 60 && ffplayAvailable(cfg.ffplay)) {
    if (await speakStream(input, cfg)) return;
    // streaming failed (crash or near-empty) — fall through to the stable WAV path
    // so a failure never means silence.
  }
  const { baseUrl, voice, model, format, speed, leadMs } = cfg;
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

// Low-latency path: stream raw PCM from the shim's /v1/audio/stream (sentence by
// sentence) straight into ffplay, so audio starts after the first sentence rather
// than after the whole reply is synthesized. ffplay plays s16le from stdin and
// buffers, so playback stays continuous as later sentences arrive.
async function speakStream(input, cfg) {
  const { baseUrl, ffplay, sampleRate, leadMs } = cfg;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${baseUrl}/v1/audio/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return false; // let speak() fall back to the WAV path
    stop(); // interrupt any prior clip before starting this one
    const ff = spawn(
      ffplay,
      ["-nodisp", "-autoexit", "-loglevel", "quiet", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", "pipe:0"],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: true },
    );
    currentChild = ff;
    ff.on("error", () => {});
    ff.stdin.on("error", () => {}); // ignore EPIPE if killed mid-stream
    // Prepend a short silence so a waking Windows audio endpoint doesn't clip the
    // first word (same purpose as leadMs on the WAV path).
    const leadBytes = Math.max(0, Math.round(sampleRate * 2 * (leadMs / 1000)));
    if (leadBytes > 1) ff.stdin.write(Buffer.alloc(leadBytes - (leadBytes % 2)));
    const src = Readable.fromWeb(res.body);
    src.on("error", () => {});
    src.pipe(ff.stdin);
    await new Promise((resolve) => {
      const done = () => {
        // Tear the source down cleanly when ffplay exits, otherwise the dangling
        // web-stream handle can trip a libuv assertion on Windows at shutdown.
        try { src.unpipe(ff.stdin); } catch {}
        try { src.destroy(); } catch {}
        try { controller.abort(); } catch {}
        resolve();
      };
      ff.once("close", done);
      ff.once("exit", done);
    });
    return true;
  } catch {
    return false; // network/abort — let the WAV path try (and warn) instead
  } finally {
    clearTimeout(timer);
  }
}

function warnOnce(msg) {
  if (warned) return;
  warned = true;
  process.stdout.write(paint(colors.yellow, `  ${msg}\n`));
}
