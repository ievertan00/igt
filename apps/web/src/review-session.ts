import { useEffect, useRef, useState } from "react";
import { webApi } from "./api/client";

export const REVIEW_SESSION_KEY = "igt.review.daily-session.v2";
export type ReviewRating = "again" | "hard" | "good" | "easy";
type ReviewResult = {
  correct: boolean;
  judgement?: string;
  rating?: ReviewRating | null;
  ratings?: Record<ReviewRating, { intervalDays: number; dueDate: string }>;
  next?: { intervalDays: number; dueDate?: string; ease?: number };
  persistence?: { saved: boolean };
};
type ReviewSession = {
  version: 2; day: string; id: string; limit: number; cards: any[]; index: number;
  answer: string | null; result: ReviewResult | null; audioPlayed: boolean;
  correct: number; wrong: number;
  pendingRating?: ReviewRating | null;
};
export function reviewDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}
function readSession(day: string): ReviewSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(REVIEW_SESSION_KEY) || "null");
    if (value?.version !== 2 || value.day !== day || typeof value.id !== "string" || !Array.isArray(value.cards)
      || !value.cards.every((card: any) => card && Number.isInteger(card.id)) || !Number.isInteger(value.index)
      || value.index < 0 || value.index > value.cards.length || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 100
      || !(value.answer === null || typeof value.answer === "string")
      || !(value.result === null || typeof value.result?.correct === "boolean")
      || !(value.pendingRating == null || ["again", "hard", "good", "easy"].includes(value.pendingRating))
      || !Number.isInteger(value.correct) || !Number.isInteger(value.wrong)) return null;
    return value;
  } catch { return null; }
}
export function useDailyReviewSession() {
  const [session, setSession] = useState<ReviewSession | null>(() => readSession(reviewDay()));
  const current = useRef(session);
  const mounted = useRef(false);
  const locked = useRef(false);
  const [loading, setLoading] = useState(!session);
  const [grading, setGrading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [notice, setNotice] = useState("");
  const [limit, setLimit] = useState(session?.limit ?? 20);
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const refresh = useRef<(fresh?: boolean) => void>(() => {});
  function update(next: ReviewSession) {
    current.current = next;
    try { localStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(next)); if (mounted.current) setNotice(""); }
    catch { if (mounted.current) setNotice("Progress could not be kept after a refresh. Keep this page open to finish."); }
    if (mounted.current) setSession(next);
  }
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let fetching = false;
    async function synchronize(fresh = false) {
      const day = reviewDay();
      if (cancelled || locked.current || fetching || (!fresh && current.current?.day === day)) return;
      if (!fresh) {
        const stored = readSession(day);
        if (stored) { current.current = stored; setSession(stored); setLoading(false); return; }
      }
      const requestedLimit = limitRef.current;
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
        setStartError("Choose between 1 and 100 cards."); return;
      }
      fetching = true;
      locked.current = true;
      if (fresh) { setStarting(true); setStartError(""); }
      else { current.current = null; setSession(null); setLoading(true); }
      setError("");
      try {
        const response = await webApi.getReviewDue(requestedLimit);
        if (!cancelled && day === reviewDay()) update((fresh ? null : readSession(day)) || {
          version: 2, day, id: crypto.randomUUID(), limit: requestedLimit, cards: response.cards || [], index: 0,
          answer: null, result: null, audioPlayed: false, correct: 0, wrong: 0,
        });
      } catch (e: any) {
        if (!cancelled) { if (fresh) setStartError(e.message); else setError(e.message); }
      } finally {
        fetching = false;
        if (!cancelled) { locked.current = false; setLoading(false); setStarting(false); }
      }
    }
    refresh.current = (fresh = false) => { void synchronize(fresh); };
    function onFocus() { void synchronize(); }
    function onStorage(event: StorageEvent) {
      if (event.key !== REVIEW_SESSION_KEY || locked.current) return;
      const stored = readSession(reviewDay());
      if (stored) { current.current = stored; setSession(stored); setError(""); }
    }
    void synchronize();
    const timer = window.setInterval(onFocus, 30_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => { cancelled = true; mounted.current = false; locked.current = false; window.clearInterval(timer);
      window.removeEventListener("focus", onFocus); window.removeEventListener("storage", onStorage); };
  }, []);
  async function submit(answer: string) {
    const value = current.current;
    if (!value || value.day !== reviewDay()) { refresh.current(); return; }
    const card = value.cards[value.index];
    if (!card || value.result || locked.current) return;
    locked.current = true; setGrading(true); setError("");
    const submitted = { ...value, answer: value.answer ?? answer.trim() };
    update(submitted); // Freeze the answer and id before issuing a retryable request.
    try {
      const result = await webApi.checkReview(card.id, submitted.answer!);
      if (reviewDay() === value.day) update({ ...submitted, result });
    } catch (e: any) { if (mounted.current) setError(e.message); }
    finally { locked.current = false; if (mounted.current) { setGrading(false); refresh.current(); } }
  }
  async function rate(rating: ReviewRating) {
    const value = current.current;
    if (value?.day !== reviewDay()) { refresh.current(); return; }
    if (!value?.result || value.result.persistence?.saved || locked.current
      || (value.pendingRating && value.pendingRating !== rating)) return;
    const card = value.cards[value.index];
    if (!card) return;
    locked.current = true; setGrading(true); setError("");
    const submitted = { ...value, pendingRating: rating };
    update(submitted);
    try {
      const result = await webApi.gradeReview(card.id, value.answer!, `${value.id}-${value.index}`, value.audioPlayed, rating);
      if (result.persistence?.saved !== true) throw new Error("The review was not confirmed saved. Retry the same rating.");
      if (reviewDay() === value.day) update({ ...submitted, pendingRating: null,
        result: { ...value.result, ...result },
        cards: rating === "again" ? [...value.cards, card] : value.cards,
        correct: value.correct + Number(result.correct),
        wrong: value.wrong + Number(!result.correct),
      });
    } catch (e: any) { if (mounted.current) setError(e.message); }
    finally { locked.current = false; if (mounted.current) { setGrading(false); refresh.current(); } }
  }
  function next() {
    const value = current.current;
    if (value?.day !== reviewDay()) { refresh.current(); return; }
    if (value?.result?.persistence?.saved && !locked.current) update({ ...value, index: value.index + 1, answer: null, result: null, audioPlayed: false, pendingRating: null });
  }
  async function remove() {
    const value = current.current;
    if (value?.day !== reviewDay()) { refresh.current(); return; }
    if (!value?.result || locked.current) return;
    locked.current = true; setGrading(true); setError("");
    try { await webApi.deleteReview(value.cards[value.index].id);
      // Keep saved attempts in the summary; an unrated deletion is not a review.
      const saved = Boolean(value.result.persistence?.saved);
      update({ ...value, cards: value.cards.filter((card, index) => index < value.index
        || (saved && index === value.index) || card.id !== value.cards[value.index].id),
        index: value.index + (saved ? 1 : 0), answer: null, result: null, audioPlayed: false, pendingRating: null });
    } catch (e: any) { if (mounted.current) setError(e.message); }
    finally { locked.current = false; if (mounted.current) setGrading(false); }
  }
  function markAudio() {
    const value = current.current;
    if (value && value.answer === null && !locked.current) update({ ...value, audioPlayed: true });
  }
  return { cards: session?.cards || [], index: session?.index || 0, revealed: Boolean(session?.result),
    answer: session?.answer, result: session?.result, correct: session?.correct || 0, wrong: session?.wrong || 0,
    loading, grading, starting, error, startError, notice, limit, setLimit, submit, rate, next, remove, markAudio,
    pendingRating: session?.pendingRating,
    retry: () => refresh.current(), startNew: () => refresh.current(true) };
}
