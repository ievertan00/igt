import fs from "node:fs";
import path from "node:path";
const [runArg,ballotArg] = process.argv.slice(2);
if (!runArg) throw Error("Usage: node score.mjs RUN_DIRECTORY [BALLOT_FILE]");
const run = path.resolve(runArg);
const read = file => JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));
const settings = read(path.join(run,"private","settings.json"));
const review = read(path.join(run,"review.json"));
const ballots = read(ballotArg || path.join(run,"ballot.json"));
const expected = new Set(review.map(c=>c.id));
if (!Array.isArray(ballots) || ballots.length !== expected.size) throw Error("Ballot count mismatch");
const armStats = () => ({successful:0,firstPass:0,calls:0,ms:0,inputTokens:0,outputTokens:0,usageComplete:true,severe:0});
const groups = {};
for (const vote of ballots) {
  if (!expected.delete(vote.id)) throw Error("Unexpected or duplicate id: "+vote.id);
  if (!["left","right","tie"].includes(vote.winner) || typeof vote.severeLeft !== "boolean" || typeof vote.severeRight !== "boolean" || !vote.reason?.trim()) throw Error("Incomplete ballot: "+vote.id);
  const {left,outputs,task} = read(path.join(run,"private",vote.id+".json"));
  const right = left==="A"?"B":"A";
  const forced = outputs[left].ok === outputs[right].ok ? (outputs[left].ok ? null : "tie") : (outputs[left].ok ? "left" : "right");
  if (forced && forced !== vote.winner) throw Error("Score delivery failures according to the rubric: "+vote.id);
  const g = groups[task] ??= {pairs:0,Awin:0,Bwin:0,tie:0,modelMismatch:0,newSevereB:0,A:armStats(),B:armStats()};
  g.pairs++;
  const models = new Set(Object.values(outputs).flatMap(o=>o.calls.map(c=>c.model).filter(Boolean)));
  if (models.size>1) g.modelMismatch++;
  else if (vote.winner==="tie") g.tie++;
  else g[(vote.winner==="left"?left:right)+"win"]++;
  const severe = {[left]:vote.severeLeft,[right]:vote.severeRight};
  if (severe.B && !severe.A) g.newSevereB++;
  for (const arm of ["A","B"]) {
    const s=g[arm], o=outputs[arm];
    s.severe+=Number(severe[arm]);
    s.successful+=Number(o.ok);
    s.firstPass+=Number(o.ok && o.calls.length===1);
    s.calls+=o.calls.length;
    s.ms+=o.ms;
    for (const c of o.calls) {
      if (Number.isFinite(c.usage?.prompt_tokens) && Number.isFinite(c.usage?.completion_tokens)) {
        s.inputTokens+=c.usage.prompt_tokens;
        s.outputTokens+=c.usage.completion_tokens;
      } else s.usageComplete=false;
    }
  }
}
// Two-sided 95% Clopper–Pearson interval conditional on a non-tie.
function lower(k,n) {
  if (!k) return 0;
  let lo=0, hi=1;
  for (let i=0;i<55;i++) {
    const p=(lo+hi)/2;
    let tail=0, choose=1;
    for (let j=0;j<=n;j++) {
      if (j>=k) tail+=choose*p**j*(1-p)**(n-j);
      choose*= (n-j)/(j+1);
    }
    if (tail<0.025) lo=p; else hi=p;
  }
  return (lo+hi)/2;
}
for (const g of Object.values(groups)) {
  const n=g.Bwin+g.Awin;
  g.netWinRate=(g.Bwin-g.Awin)/g.pairs;
  g.nonTieB95=n?[lower(g.Bwin,n),1-lower(g.Awin,n)]:null;
  for (const s of [g.A,g.B]) {
    s.avgMs=s.ms/g.pairs;
    s.firstPassRate=s.firstPass/g.pairs;
    s.finalSuccessRate=s.successful/g.pairs;
    s.costPerUsable=s.successful && s.usageComplete && settings.inputPrice && settings.outputPrice
      ? (s.inputTokens*Number(settings.inputPrice)+s.outputTokens*Number(settings.outputPrice))/1e6/s.successful : null;
    if (!s.usageComplete) s.inputTokens=s.outputTokens=null;
  }
  g.screen=settings.mode!=="live" || settings.split!=="formal" ? "仅供校准或演练"
    : g.modelMismatch ? "异模型配对须补测" : g.netWinRate>=0.2 && !g.newSevereB ? "可进入独立确认轮" : "保留 A";
}
console.log(JSON.stringify({mode:settings.mode,split:settings.split,groups},null,2));
