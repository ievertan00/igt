import { LIFE_SITUATIONS } from "./life-situations.mjs";
import { normalizePracticeContext } from "./contexts.mjs";

export const SITUATION_IDS = LIFE_SITUATIONS.map(({ id }) => id);
const legacyCategoricalContexts = new Set([
  "home-routines", "restaurants-cafes", "supermarkets-shopping",
  "cinema-entertainment", "friends-social", "health-pharmacy",
  "work-study", "commuting-transit", "travel-accommodation",
  "appointments-services",
]);

const rules = [
  ["health-pharmacy", /doctor|clinic|pharmac|medicine|medicin|pill|symptom|dentist|hospital|prescription|药|医生|诊所|医院|症状|牙医|药剂师|处方/i],
  ["restaurants-cafes", /restaurant|cafe|coffee|menu|waiter|server|bill|dish|meal|food|餐厅|咖啡|菜单|服务员|账单|点菜|吃饭/i],
  ["cinema-entertainment", /cinema|movie|film|theatre|theater|concert|show|museum|ticket|电影院|电影|演出|音乐会|博物馆|门票/i],
  ["supermarkets-shopping", /supermarket|grocery|shop|store|buy|bought|price|cashier|refund|shopping|超市|购物|商店|买|价格|收银|退货/i],
  ["commuting-transit", /bus|train|station|subway|underground|commut|traffic|transit|公交|地铁|火车|车站|通勤|交通|换乘/i],
  ["travel-accommodation", /travel|trip|flight|airport|hotel|booking|reservation|luggage|passport|旅|机场|酒店|预订|行李|护照|登机/i],
  ["appointments-services", /appointment|plumber|repair|post office|library|landlord|haircut|service desk|预约|维修|邮局|图书馆|房东|理发|服务台/i],
  ["friends-social", /friend|party|invite|picnic|brunch|birthday|neighbour|neighbor|聚会|朋友|邀请|野餐|生日|邻居/i],
];

export function inferPracticeSituation(row) {
  if (legacyCategoricalContexts.has(row.context)) return normalizePracticeContext(row.context);
  const data = row.metadata_json ? (() => { try { return JSON.parse(row.metadata_json); } catch { return {}; } })() : (row.metadata || {});
  const tagged = String(data.situation || "").toLowerCase();
  const corpus = `${row.prompt_zh || ""} ${row.reference_answer || ""} ${row.focus || ""} ${tagged}`;
  for (const [id, pattern] of rules) if (pattern.test(corpus)) return normalizePracticeContext(id);
  if (/work|work-study|education|study|meeting|office|class|assignment|project|报告|工作|会议|同事|上课|作业|客户|项目|培训|员工/i.test(`${row.context} ${corpus}`)) return "work";
  if (row.context === "travel") return "travel";
  return "home";
}
