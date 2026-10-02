import { useEffect, useRef, useState } from "react";
import { webApi } from "./api/client";

export const REVIEW_SESSION_KEY = "igt.review.daily-session.v1";

type ReviewSession = {
  version: 1;
  day: string;
  cards: any[];
  index: number;
  revealed: boolean;
};

// Match the Beijing calendar day used by the learning records and SRS dates.
export function reviewDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

function readSession(day: string): ReviewSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(REVIEW_SESSION_KEY) || "null");
    if (session?.version !== 1 || session.day !== day || !Array.isArray(session.cards)
      || !session.cards.every((card: any) => card && Number.isInteger(card.id))
      || !Number.isInteger(session.index) || session.index < 0 || session.index > session.cards.length
      || typeof session.revealed !== "boolean") return null;
    return session;
  } catch {
    return null;
  }
}

export function useDailyReviewSession() {
  const [session, setSession] = useState<ReviewSession | null>(() => readSession(reviewDay()));
  const sessionRef = useRef(session);
  const [loading, setLoading] = useState(!session);
  const [grading, setGrading] = useState(false);
  const gradingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [startError, setStartError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const refresh = useRef<() => void>(() => {});
  const startNew = useRef<() => void>(() => {});

  function update(next: ReviewSession) {
    sessionRef.current = next;
    try {
      localStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(next));
      if (mounted.current) setNotice("");
    } catch {
      if (mounted.current) setNotice("Your progress could not be kept after a refresh. Keep this page open to finish your review.");
    }
    if (mounted.current) setSession(next);
  }

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let fetchingDay = "";
    async function synchronize(fresh = false) {
      const day = reviewDay();
      if (cancelled || gradingRef.current || fetchingDay || (!fresh && sessionRef.current?.day === day)) return;
      const stored = fresh ? null : readSession(day);
      if (stored) {
        sessionRef.current = stored;
        setSession(stored);
        setLoading(false);
        setError("");
        return;
      }
      fetchingDay = day;
      if (fresh) {
        startingRef.current = true;
        setStarting(true);
        setStartError("");
      } else {
        sessionRef.current = null;
        setSession(null);
        setLoading(true);
      }
      setError("");
      try {
        const response = await webApi.getReviewDue();
        if (cancelled || fetchingDay !== day) return;
        if (reviewDay() === day) {
          // Another tab may have created today's session while this request was pending.
          update((fresh ? null : readSession(day)) || { version: 1, day, cards: response.cards || [], index: 0, revealed: false });
        }
      } catch (e: any) {
        if (!cancelled && fetchingDay === day) {
          if (fresh) setStartError(e.message);
          else setError(e.message);
        }
      } finally {
        if (!cancelled && fetchingDay === day) {
          fetchingDay = "";
          setLoading(false);
          startingRef.current = false;
          setStarting(false);
        }
      }
    }
    refresh.current = () => { void synchronize(); };
    startNew.current = () => { void synchronize(true); };
    function onStorage(event: StorageEvent) {
      if (event.key !== REVIEW_SESSION_KEY || gradingRef.current || startingRef.current) return;
      const stored = readSession(reviewDay());
      if (stored) {
        sessionRef.current = stored;
        setSession(stored);
        setError("");
      }
    }
    void synchronize();
    const timer = window.setInterval(() => { void synchronize(); }, 30_000);
    window.addEventListener("focus", refresh.current);
    window.addEventListener("storage", onStorage);
    const onFocus = refresh.current;
    return () => {
      cancelled = true;
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function reveal() {
    const current = sessionRef.current;
    if (!current || current.day !== reviewDay()) { refresh.current(); return; }
    if (!gradingRef.current && !startingRef.current && current.cards[current.index]) update({ ...current, revealed: true });
  }

  async function grade(rating: string) {
    const current = sessionRef.current;
    if (!current || current.day !== reviewDay()) { refresh.current(); return; }
    const card = current.cards[current.index];
    if (!card || !current.revealed || gradingRef.current || startingRef.current) return;
    gradingRef.current = true;
    setGrading(true);
    setError("");
    try {
      await webApi.gradeReview(card.id, rating);
      // Commit progress only after the rating succeeds; failed ratings remain retryable.
      update({ ...current, index: current.index + 1, revealed: false });
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      gradingRef.current = false;
      if (mounted.current) {
        setGrading(false);
        refresh.current();
      }
    }
  }

  return { cards: session?.cards || [], index: session?.index || 0, revealed: session?.revealed || false,
    loading, grading, starting, startError, error, notice, reveal, grade,
    startNew: () => startNew.current(), retry: () => refresh.current() };
}
