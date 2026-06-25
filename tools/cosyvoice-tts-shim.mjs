// OpenAI-compatible TTS shim for CosyVoice.
//
// IGT's TTS client (lib/cli/tts.mjs) speaks the OpenAI audio protocol:
//   POST /v1/audio/speech  {model, input, voice, response_format, speed}  -> WAV
// The stock CosyVoice FastAPI server speaks its own protocol:
//   POST /inference_zero_shot  (multipart: tts_text, prompt_text, prompt_wav) -> raw int16 PCM stream
//
// This process bridges the two so IGT stays a pure "any OpenAI-compatible
// provider" client. Point IGT_TTS_BASE_URL at this shim's port; it forwards to
// CosyVoice, then wraps the returned raw PCM in a WAV header.
//
// CosyVoice3 here has no preset speakers (/inference_sft returns 0 bytes), so it
// clones a reference clip. Supply one reference voice via env:
//   COSY_PROMPT_WAV  = path to a few-seconds WAV of the target voice
//   COSY_PROMPT_TEXT = exact transcript of that clip
//
// Run:  node tools/cosyvoice-tts-shim.mjs   (keep it running alongside CosyVoice)
//
// Env (all optional except the prompt pair):
//   PORT             shim listen port            (default 8881)
//   COSY_BASE_URL    CosyVoice server            (default http://localhost:50000)
//   COSY_MODE        inference endpoint          (default inference_zero_shot)
//   COSY_PROMPT_WAV  reference voice WAV path    (required for zero_shot/cross_lingual/instruct2)
//   COSY_PROMPT_TEXT reference transcript        (required for zero_shot)
//   COSY_SAMPLE_RATE PCM sample rate from model  (default 24000 — CosyVoice2/3)

import fs from "node:fs";
import http from "node:http";

const PORT = Number(process.env.PORT || 8881);
const COSY_BASE_URL = (process.env.COSY_BASE_URL || "http://localhost:50000").replace(/\/+$/, "");
const COSY_MODE = process.env.COSY_MODE || "inference_zero_shot";
const COSY_PROMPT_WAV = process.env.COSY_PROMPT_WAV || "";
const COSY_PROMPT_TEXT = process.env.COSY_PROMPT_TEXT || "";
const SAMPLE_RATE = Number(process.env.COSY_SAMPLE_RATE || 24000);
// Streaming endpoint on the CosyVoice server (stream=True). Kept separate from
// COSY_MODE so the WAV path stays non-streaming and stable as a fallback.
const COSY_STREAM_PATH = process.env.COSY_STREAM_PATH || `${COSY_MODE}_stream`;

// Wrap raw 16-bit mono little-endian PCM in a canonical WAV header so the client
// (Windows SoundPlayer, via igt's tts.mjs) accepts it.
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const blockAlign = channels * (bits / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildForm(ttsText) {
  const form = new FormData();
  form.set("tts_text", ttsText);
  if (COSY_MODE === "inference_zero_shot" || COSY_MODE === "inference_instruct2") {
    if (!COSY_PROMPT_WAV) throw new Error("COSY_PROMPT_WAV not set");
    // CosyVoice3's LLM (llm.py) asserts the <|endofprompt|> token (151646) is present
    // in the tokenized prompt_text, splitting the prompt there. text_normalize preserves
    // the literal marker (it disables the text frontend when it sees <|...|>), and the
    // tokenizer encodes it as a special token. Harmless if the marker is already present.
    if (COSY_MODE === "inference_zero_shot") {
      const pt = COSY_PROMPT_TEXT.includes("<|endofprompt|>") ? COSY_PROMPT_TEXT : `${COSY_PROMPT_TEXT}<|endofprompt|>`;
      form.set("prompt_text", pt);
    }
    const wav = fs.readFileSync(COSY_PROMPT_WAV);
    form.set("prompt_wav", new Blob([wav], { type: "audio/wav" }), "prompt.wav");
  } else if (COSY_MODE === "inference_cross_lingual") {
    if (!COSY_PROMPT_WAV) throw new Error("COSY_PROMPT_WAV not set");
    const wav = fs.readFileSync(COSY_PROMPT_WAV);
    form.set("prompt_wav", new Blob([wav], { type: "audio/wav" }), "prompt.wav");
  }
  return form;
}

async function fetchPcm(ttsText) {
  const res = await fetch(`${COSY_BASE_URL}/${COSY_MODE}`, { method: "POST", body: buildForm(ttsText) });
  if (!res.ok) throw new Error(`CosyVoice ${res.status} ${await res.text().catch(() => "")}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synth(ttsText) {
  const pcm = await fetchPcm(ttsText);
  if (pcm.length === 0) throw new Error("CosyVoice returned 0 bytes (check model/prompt)");
  return pcmToWav(pcm, SAMPLE_RATE);
}

const server = http.createServer(async (req, res) => {
  // Streaming endpoint: forward CosyVoice's raw s16le PCM straight through as it
  // arrives, no WAV header — the client feeds it into `ffplay -f s16le`. The whole
  // reply is one inference (stable; splitting it per-sentence triggers CosyVoice3's
  // near-empty-generation glitch). With the container patched to stream=True the
  // first chunk lands in ~0.5s; without it CosyVoice yields one chunk at the end
  // (correct, just no latency win) — either way no content is lost.
  if (req.method === "POST" && req.url.startsWith("/v1/audio/stream")) {
    let started = false;
    try {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const input = String(body.input || "").trim();
      if (!input) {
        res.writeHead(400).end("empty input");
        return;
      }
      const r = await fetch(`${COSY_BASE_URL}/${COSY_STREAM_PATH}`, { method: "POST", body: buildForm(input) });
      if (!r.ok || !r.body) throw new Error(`CosyVoice ${r.status} ${await r.text().catch(() => "")}`);
      // CosyVoice3 streaming intermittently yields a near-empty clip (a known model
      // glitch). Buffer until we have a confidently-real amount of audio before
      // sending 200; if the whole stream stays under that, fail with 502 so the
      // client falls back to the stable non-streaming WAV path. The first real chunk
      // is large, so this adds no latency in the normal case.
      const minGood = Math.round(SAMPLE_RATE * 2 * 0.3); // ~0.3s of PCM
      let pending = [];
      let pendingLen = 0;
      for await (const chunk of r.body) {
        const buf = Buffer.from(chunk);
        if (!buf.length) continue;
        if (!started) {
          pending.push(buf);
          pendingLen += buf.length;
          if (pendingLen < minGood) continue;
          res.writeHead(200, { "Content-Type": "audio/L16; rate=" + SAMPLE_RATE + "; channels=1", "Cache-Control": "no-cache" });
          started = true;
          for (const b of pending) if (!res.write(b)) await new Promise((rr) => res.once("drain", rr));
          pending = null;
          continue;
        }
        if (!res.write(buf)) await new Promise((rr) => res.once("drain", rr));
      }
      if (!started) res.writeHead(502).end("near-empty generation");
      else res.end();
    } catch (err) {
      process.stderr.write(`[shim] stream ${err.message}\n`);
      if (!started) { try { res.writeHead(502).end(String(err.message || err)); } catch {} }
      else { try { res.end(); } catch {} }
    }
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/v1/audio/speech")) {
    try {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const input = String(body.input || "").trim();
      if (!input) {
        res.writeHead(400).end("empty input");
        return;
      }
      const wav = await synth(input);
      res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": wav.length });
      res.end(wav);
    } catch (err) {
      process.stderr.write(`[shim] ${err.message}\n`);
      res.writeHead(502).end(String(err.message || err));
    }
    return;
  }
  res.writeHead(404).end("not found");
});

server.on("error", (err) => {
  // igt may spawn this sidecar while a previous instance still holds the port.
  // Exit quietly rather than crash-spamming — the existing instance keeps serving.
  if (err.code === "EADDRINUSE") {
    process.stdout.write(`CosyVoice TTS shim: port ${PORT} already in use — another instance is serving.\n`);
    process.exit(0);
  }
  process.stderr.write(`[shim] server error: ${err.message}\n`);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(
    `CosyVoice TTS shim on http://127.0.0.1:${PORT}/v1/audio/speech -> ${COSY_BASE_URL}/${COSY_MODE}\n`,
  );
  if (!COSY_PROMPT_WAV) process.stdout.write("  ! COSY_PROMPT_WAV not set — zero_shot will fail until you supply a reference clip.\n");
});
