import { register } from "../server/router.mjs";
import { getDueCards, getCardById, updateAfterGrading, deleteCard } from "../db/srs-cards.mjs";
import { grade as gradeCard, QUALITY_CORRECT, QUALITY_WRONG } from "../srs.mjs";

function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:'"()\-]/g, "");
}

export function registerSrsRoutes({ getLLMManager }) {
  register("GET", (url) => url.startsWith("/review/due"), async (req, res) => {
    const params = new URL(req.url, "http://x").searchParams;
    const limit = parseInt(params.get("limit") ?? "10", 10) || 10;
    const type = params.get("type") || "all";
    const cards = await getDueCards({ limit, type });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ cards }));
  });

  register("POST", "/review/grade", async (req, res, { body }) => {
    const { card_id, response, correct: correctOverride } = body;
    const card = await getCardById(card_id);
    if (!card) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "card not found" }));
      return;
    }
    let correct, judgement;
    if (typeof correctOverride === "boolean") {
      correct = correctOverride;
      judgement = "self-report";
    } else {
      const exactMatch = normalize(response) === normalize(card.answer);
      correct = exactMatch;
      judgement = exactMatch ? "exact" : null;
      if (!exactMatch) {
        const llm = await getLLMManager();
        const prompt = `Card prompt: ${card.prompt}\nExpected answer: ${card.answer}\nUser answer: ${response}\n\nIs the user's answer semantically equivalent to the expected answer for this English-grammar flashcard? Reply with exactly "YES" or "NO" followed by one short reason.`;
        try {
          const text = await llm.generateWithFallback(prompt, "You are an English grammar grader.", { taskType: "grammar" });
          correct = /^\s*yes\b/i.test(text);
          judgement = text.trim().slice(0, 200);
        } catch {
          judgement = "llm-unavailable";
          correct = false;
        }
      }
    }
    const next = gradeCard({
      ease: card.ease, intervalDays: card.interval_days,
      totalReviews: card.total_reviews, correctStreak: card.correct_streak,
    }, correct ? QUALITY_CORRECT : QUALITY_WRONG);
    await updateAfterGrading(card.id, next);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ correct, judgement, next: { intervalDays: next.intervalDays, dueDate: next.dueDate, ease: next.ease } }));
  });

  register("POST", "/review/delete", async (req, res, { body }) => {
    const changes = await deleteCard(body.card_id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ deleted: changes > 0 }));
  });
}
