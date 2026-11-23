// Case-level aggregation and a two-sided exact sign test over decisive cases.
// No external dependencies: the binomial tail is computed directly.
function logChoose(n, k) {
  let total = 0;
  for (let i = 1; i <= k; i++) total += Math.log(n - k + i) - Math.log(i);
  return total;
}

export function signTestPValue(wins, losses) {
  const n = wins + losses;
  if (n === 0) return 1;
  const k = Math.min(wins, losses);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

// majority across repeats; an equal split is a tie for that case.
export function caseWinner(verdicts) {
  let a = 0, b = 0;
  for (const verdict of verdicts) {
    if (verdict.winner === "a") a++;
    else if (verdict.winner === "b") b++;
  }
  if (a > b) return "a";
  if (b > a) return "b";
  return "tie";
}

export function aggregatePair({ caseResults, humanVerdicts = {} }) {
  const cases = [];
  for (const [caseId, repeats] of Object.entries(caseResults)) {
    const judged = caseWinner(repeats.map(item => item.judgment).filter(Boolean));
    const human = humanVerdicts[caseId];
    const winner = human && ["a", "b", "tie"].includes(human.winner) ? human.winner : judged;
    cases.push({
      caseId,
      winner,
      source: human ? "human" : "judge",
      judgedWinner: judged,
      repeats: repeats.map(item => ({
        winner: item.judgment?.winner ?? "unjudged",
        consistent: item.judgment?.consistent ?? null,
        hardFailA: item.a?.checks?.filter(check => check.level === "hard" && !check.pass).map(check => check.id) || [],
        hardFailB: item.b?.checks?.filter(check => check.level === "hard" && !check.pass).map(check => check.id) || [],
      })),
    });
  }
  // A = baseline, B = candidate; wins/losses are from the candidate's perspective.
  const wins = cases.filter(item => item.winner === "b").length;
  const losses = cases.filter(item => item.winner === "a").length;
  const ties = cases.filter(item => item.winner === "tie").length;
  const pValue = signTestPValue(wins, losses);
  const hardFailDelta = cases.reduce((total, item) => {
    const last = item.repeats.at(-1);
    return total + (last ? last.hardFailB.length - last.hardFailA.length : 0);
  }, 0);
  let recommendation;
  if (hardFailDelta > 0) recommendation = "reject: candidate breaks more hard contracts than baseline";
  else if (wins > losses && pValue <= 0.1) recommendation = "promote: candidate wins consistently (sign test p <= 0.10)";
  else if (wins > losses) recommendation = "candidate leads but not significant yet — add repeats or cases";
  else if (losses > wins) recommendation = "keep baseline: candidate loses";
  else recommendation = "no difference detected";
  return { wins, losses, ties, decisive: wins + losses, pValue, hardFailDelta, recommendation, cases };
}

export function dimensionBreakdown(pairJudgments) {
  const tally = {};
  for (const judgment of pairJudgments) {
    if (!judgment?.judgments) continue;
    for (const order of judgment.judgments) {
      for (const dimension of order.dimensions || []) {
        const entry = tally[dimension.name] || (tally[dimension.name] = { a: 0, b: 0, tie: 0 });
        // order "ab": slot1=a; order "ba": slot1=b.
        const slotIsA = order.order === "ab";
        if (dimension.winner === "tie") entry.tie++;
        else if ((dimension.winner === "1") === slotIsA) entry.a++;
        else entry.b++;
      }
    }
  }
  return tally;
}