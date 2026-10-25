const IRREGULAR_VERBS = {
  pay: ["paid"],
  take: ["took", "taken"],
  make: ["made"],
  go: ["went", "gone"],
  do: ["did", "done"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  find: ["found"],
  keep: ["kept"],
  bring: ["brought"],
  catch: ["caught"],
  hold: ["held"],
  fall: ["fell", "fallen"],
  run: ["ran"],
  throw: ["threw", "thrown"],
  leave: ["left"],
  write: ["wrote", "written"],
  speak: ["spoke", "spoken"],
  tell: ["told"],
  buy: ["bought"],
  think: ["thought"],
  seek: ["sought"],
  lead: ["led"],
  lose: ["lost"],
  send: ["sent"],
  spend: ["spent"],
  build: ["built"],
  understand: ["understood"],
  hear: ["heard"],
  mean: ["meant"],
  meet: ["met"],
  grow: ["grew", "grown"],
  show: ["showed", "shown"],
  draw: ["drew", "drawn"],
  fly: ["flew", "flown"],
  choose: ["chose", "chosen"],
  know: ["knew", "known"],
  begin: ["began", "begun"],
  sing: ["sang", "sung"],
  swim: ["swam", "swum"],
  drink: ["drank", "drunk"],
  break: ["broke", "broken"],
  steal: ["stole", "stolen"],
  wear: ["wore", "worn"],
  tear: ["tore", "torn"],
  swear: ["swore", "sworn"],
  forget: ["forgot", "forgotten"],
  shake: ["shook", "shaken"],
  ride: ["rode", "ridden"],
  rise: ["rose", "risen"],
  drive: ["drove", "driven"],
  eat: ["ate", "eaten"],
  forgive: ["forgave", "forgiven"],
  bite: ["bit", "bitten"],
  hide: ["hid", "hidden"],
  freeze: ["froze", "frozen"],
  slide: ["slid"],
  strike: ["struck"],
  light: ["lit", "lighted"],
  shoot: ["shot"],
  sell: ["sold"],
  bind: ["bound"],
  grind: ["ground"],
  wind: ["wound"],
  dig: ["dug"],
  spin: ["spun"],
  cling: ["clung"],
  fling: ["flung"],
  sling: ["slung"],
  sting: ["stung"],
  string: ["strung"],
  swing: ["swung"],
  wring: ["wrung"],
  bleed: ["bled"],
  feed: ["fed"],
  flee: ["fled"],
  speed: ["sped"],
  deal: ["dealt"],
  feel: ["felt"],
  sleep: ["slept"],
  sweep: ["swept"],
  weep: ["wept"],
  bend: ["bent"],
  lend: ["lent"],
  burn: ["burnt", "burned"],
  dream: ["dreamt", "dreamed"],
  learn: ["learnt", "learned"],
  smell: ["smelt", "smelled"],
  spill: ["spilt", "spilled"],
  spoil: ["spoilt", "spilled"],
};

export function maskTerm(example, term) {
  if (!example || !term) return example;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = escaped.split(/\s+/);
  if (parts.length === 1) {
    const base = parts[0].toLowerCase();
    const alternates = [base];
    if (IRREGULAR_VERBS[base]) {
      alternates.push(...IRREGULAR_VERBS[base]);
    }
    const regex = new RegExp(`\\b(?:${alternates.join("|")})(s|es|ed|ing|ly)?\\b`, "gi");
    return example.replace(regex, "___");
  } else {
    const baseFirst = parts[0].toLowerCase();
    const alternates = [baseFirst];
    if (IRREGULAR_VERBS[baseFirst]) {
      alternates.push(...IRREGULAR_VERBS[baseFirst]);
    }
    const first = `(?:${alternates.join("|")})`;
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1);
    const middlePattern = middle.length > 0 ? middle.join("\\s+") + "\\s+" : "";
    const pattern = `\\b${first}(s|es|ed|ing|d)?\\s+${middlePattern}${last}(s|es)?\\b`;
    let masked = example.replace(new RegExp(pattern, "gi"), "___");
    if (masked === example) {
      masked = example.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "___");
    }
    return masked;
  }
}

