import { colors, paint } from "../ui/index.mjs";
import { speak, stop, toggle, isEnabled } from "../tts.mjs";

let lastEnglish = "";

export function rememberEnglish(text) {
  if (typeof text === "string" && text.trim()) lastEnglish = text.trim();
}

export function runListen(args, ctx) {
  if (args.length === 1 && args[0] === "--stop") {
    stop();
    return;
  }
  const text = args.join(" ").trim() || lastEnglish;
  if (!text) {
    process.stdout.write(paint(colors.gray, "Check or translate a sentence first, or use /listen <English text>.\n"));
    return;
  }
  rememberEnglish(text);
  process.stdout.write(paint(colors.gray, "Listen, then repeat aloud. /listen --stop stops playback.\n"));
  speak(text, ctx.config, { force: true }).catch((error) => {
    process.stdout.write(paint(colors.yellow, "Audio unavailable: " + error.message + "\n"));
  });
}

export function runVoice(args, ctx) {
  const mode = (args[0] || "").toLowerCase();
  if (args.length > 1 || !["", "on", "off", "status"].includes(mode)) {
    process.stdout.write(paint(colors.yellow, "Usage: /voice [on|off|status]\n"));
    return;
  }
  let on = isEnabled(ctx.config);
  if (!mode || (mode === "on" && !on) || (mode === "off" && on)) on = toggle(ctx.config);
  process.stdout.write(paint(colors.gray, "Chat voice " + (on ? "on" : "off") + ". /listen plays English on demand.\n"));
}
