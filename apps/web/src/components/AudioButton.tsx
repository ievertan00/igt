import { useEffect, useRef, useState } from "react";
import { webApi } from "../api/client";
import { IconButton } from "./IconButton";

export function AudioButton({
  text,
  small,
  reviewPrompt = false,
}: {
  text: string;
  small?: boolean;
  reviewPrompt?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const releaseAudio = (audio: HTMLAudioElement) => {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.removeAttribute("src");
    if (audioRef.current === audio) audioRef.current = undefined;
  };
  useEffect(
    () => () => {
      if (audioRef.current) releaseAudio(audioRef.current);
    },
    [],
  );
  function playBrowserSpeech() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return Promise.reject(new Error("Browser speech is unavailable"));
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    return new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser speech playback failed"));
      window.speechSynthesis.speak(utterance);
    });
  }
  async function fallbackToBrowserSpeech(message: string) {
    try {
      await playBrowserSpeech();
    } catch (fallbackError: any) {
      setError(`${message}；${fallbackError.message || "Browser speech is unavailable"}`);
    } finally {
      setBusy(false);
    }
  }
  async function play() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const audio = await webApi.speakWord(text);
      audioRef.current = audio;
      audio.onended = () => {
        const tooShort =
          Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 0.2;
        releaseAudio(audio);
        if (tooShort) void fallbackToBrowserSpeech("The audio was empty");
        else setBusy(false);
      };
      audio.onerror = () => {
        releaseAudio(audio);
        void fallbackToBrowserSpeech("The audio could not be played");
      };
      await audio.play();
    } catch (e: any) {
      if (audioRef.current) releaseAudio(audioRef.current);
      await fallbackToBrowserSpeech(e.message || "Audio playback failed");
    }
  }
  if (!text) return null;
  return (
    <span className="audio-control">
      <IconButton
        icon="volume"
        quiet={small}
        pending={busy}
        caption={reviewPrompt ? (busy ? "Playing…" : "Audio hint") : undefined}
        className={`audio-btn${small ? " audio-btn-sm" : ""}${error ? " audio-err" : ""}`}
        onClick={play}
        label={
          busy ? "Playing…" : reviewPrompt ? "Listen to the English word" : `Read aloud: ${text}`
        }
        title={busy ? "Playing…" : error || "Read aloud"}
      />
      {error && (
        <span className="audio-error" role="status" aria-live="polite">
          Playback failed: {error}
        </span>
      )}
    </span>
  );
}
