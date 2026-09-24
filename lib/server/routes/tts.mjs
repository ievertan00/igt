import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";

function ttsConfig() {
  const config = configLoader.load();
  const t = config?.Tts || {};
  return {
    baseUrl: (t.BaseUrl || "http://localhost:8880").replace(/\/+$/, ""),
    voice: t.Voice || "af_heart",
    model: t.Model || "kokoro",
    format: t.Format || "wav",
    speed: typeof t.Speed === "number" ? t.Speed : 1.0,
    enabled: t.Enabled === true,
  };
}

// Kokoro streams its WAV response with 0xFFFFFFFF chunk-size placeholders and
// extra chunks before `data`. Browsers reject this; rebuild a canonical header.
function normalizeWav(buf) {
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
    if (size === 0xffffffff) break;
    off = body + size + (size % 2);
  }
  if (!fmt || !data) return buf;
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

export function registerTtsRoutes() {
  register("POST", "/tts/speak", async (req, res, { body }) => {
    const cfg = ttsConfig();
    if (!cfg.enabled) {
      res.writeHead(503, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "TTS is not enabled" }));
      return;
    }

    const text = String(body?.text || "").trim();
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Missing 'text' field" }));
      return;
    }

    const voice = body.voice || cfg.voice;
    const speed = typeof body.speed === "number" ? body.speed : cfg.speed;
    const format = body.format || cfg.format;

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const ttsRes = await fetch(`${cfg.baseUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: cfg.model, input: text, voice, response_format: format, speed }),
          signal: controller.signal,
        });

        if (!ttsRes.ok) {
          let detail = `${ttsRes.status}`;
          try { const body = await ttsRes.text(); if (body) detail = body.slice(0, 200); } catch {}
          lastError = { status: 502, message: `TTS service returned ${detail}` };
          clearTimeout(timer);
          continue;
        }

        let audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
        if (format === "wav" || format == null) audioBuffer = normalizeWav(audioBuffer);
        const contentType = format === "mp3" ? "audio/mpeg" : "audio/wav";

        clearTimeout(timer);
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": audioBuffer.length,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
        });
        res.end(audioBuffer);
        return;
      } catch (err) {
        clearTimeout(timer);
        if (err?.name === "AbortError") {
          lastError = { status: 504, message: "TTS request timed out" };
        } else {
          lastError = { status: 502, message: `Cannot reach TTS service: ${err.message}` };
        }
      }
    }
    res.writeHead(lastError.status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: lastError.message }));
  });
}