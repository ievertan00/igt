export const DAY = 86400000;
export const parseJSON = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
export const day = time => Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0, 10) : '';
export const utcTime = value => Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value || '') ? value : String(value || '').replace(' ', 'T') + 'Z');
export const wallTime = value => Date.parse(String(value || '').replace(' ', 'T').replace(/Z$/, '') + (/([+-]\d\d:\d\d)$/.test(value || '') ? '' : '+08:00'));
export const ratio = (a,b) => b ? a / b * 100 : null;
export const percent = value => value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
export const canonical = (value,taxonomy) => Object.values(taxonomy).flat().find(type => type === String(value || '').replace(/^(Grammar|Vocabulary|Mechanics|Style|Clarity)\s*\/\s*/, '').trim()) || null;
export const categoryOf = (type,taxonomy) => Object.keys(taxonomy).find(category => taxonomy[category].includes(type));

export function validateSnapshot(data) {
  if (!data || data.format !== 'clearwrite-growth' || data.version !== 1 || !Number.isFinite(Date.parse(data.exportedAt))) throw new Error('请选择由项目导出的 ClearWrite 数据文件（version 1）。');
  for (const key of ['reviews','attempts','words','cards','notes','reports','practiceLog','coverage']) if (!Array.isArray(data[key])) throw new Error(`数据文件缺少 ${key} 列表，请重新导出。`);
  if (!data.taxonomy || !['Grammar','Vocabulary','Mechanics','Style','Clarity'].every(k=> Array.isArray(data.taxonomy[k]) && data.taxonomy[k].every(t=>typeof t==='string'))) throw new Error('数据文件缺少现有错误分类。');
  return data;
}
export function normalize(data) {
  validateSnapshot(data);
  const taxonomy = data.taxonomy, records = [], seen = new Set();
  const add = record => { if (!seen.has(record.key)) { records.push(record); seen.add(record.key); } };
  for (const r of data.reviews) {
    if (r.isDuplicate) continue;
    const types = [...new Set((r.diagnoses || []).map(x => canonical(x.error_type,taxonomy)).filter(Boolean))];
    const categories = [...new Set([...(r.diagnoses || []).map(x => categoryOf(canonical(x.error_type,taxonomy),taxonomy) || (Object.keys(taxonomy).includes(x.error_type) ? x.error_type : null)).filter(Boolean)])];
    add({ key:`grammar:${r.entryId}`, kind:'grammar', module:r.source === 'grammar' ? 'grammar' : r.source === 'text' ? 'text' : 'unclassified', date:wallTime(r.timestamp), title:r.userInput, original:r.userInput, correction:r.correction, types,categories, raw:r });
  }
  for (const r of data.attempts) {
    const f = parseJSON(r.feedback), review = r.activity_type === 'review-vocabulary';
    const type = canonical(r.target_error_type,taxonomy);
    const targets = [...new Set([...(data.practiceTargets?.[r.id] || []), ...(type ? [type] : [])])];
    add({ key:`attempt:${r.id}`, kind:review ? 'review' : 'practice', module:review ? 'review' : r.activity_type === 'practice-sentence' ? 'practice' : r.activity_type, date:utcTime(r.created_at),title:review ? (r.target_pattern || r.prompt) : r.prompt,original:r.learner_answer,correction:f.corrected_answer || r.reference_answer,prompt:r.prompt,types:[],categories:review ? ['Vocabulary'] : [...new Set(targets.map(t=>categoryOf(t,taxonomy)).filter(Boolean))], targets, feedback:f, correct:typeof f.correct === 'boolean' ? f.correct : null,score:typeof r.score === 'number' ? r.score : null,cardId:f.cardId,hints:f.hints_used,raw:r });
  }
  const words = new Map(data.words.map(w=>[w.srs?.id,w]));
  for (const r of records.filter(r=>r.kind==='review')) r.word = words.get(r.cardId);
  for (const w of data.words) add({ key:`word:${w.id}`,kind:'word',module:'vocabulary',date:wallTime(w.added ? `${w.added}T00:00:00` : ''),title:w.word,original:w.meaning,categories:['Vocabulary'],types:[],status:w.learningStatus,raw:w });
  for (const n of data.notes) {
    const date = n.content?.match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/m)?.[1];
    add({key:`note:${n.id}`,kind:'note',module:'ask',date:date ? wallTime(date) : NaN,title:n.id.replace(/\.md$/i,''),content:n.content,categories:[],types:[],raw:n});
  }
  for (const r of data.reports) add({key:`report:${r.savedId}`,kind:'report',module:'coach',date:utcTime(r.generatedAt),title:'English skills report',content:r.markdown,categories:[],types:[],raw:r});
  // Markdown logs are a separate source. Do not inflate database attempt counts.
  for (const r of data.practiceLog) add({key:`log:${r.entryId}`,kind:'practice-log',module:'practice-log',date:wallTime(r.timestamp),title:r.practice.prompt,original:r.userInput,correction:r.practice.referenceAnswer,prompt:r.practice.prompt,content:r.practice.feedback,types:[],categories:[],raw:r});
  return records.sort((a,b)=>(b.date || 0)-(a.date || 0));
}
export function inWindow(record, start, end) {
  const key = day(record.date);
  return Boolean(key && key >= start && key <= end);
}
export function matches(record, filters, taxonomy, {ignoreType=false, ignoreModule=false,ignoreSearch=false}={}) {
  if (!ignoreModule && filters.module !== 'all' && record.module !== filters.module) return false;
  if (!ignoreType && filters.category !== 'all' && !record.categories.includes(filters.category)) return false;
  if (!ignoreType && filters.errorType !== 'all' && !(record.types.includes(filters.errorType) || record.targets?.includes(filters.errorType))) return false;
  if (filters.status !== 'all' && record.status !== filters.status && record.word?.learningStatus !== filters.status) return false;
  if (!ignoreSearch && filters.search && !JSON.stringify(record.raw).toLowerCase().includes(filters.search.toLowerCase())) return false;
  return inWindow(record,filters.start,filters.end) || (filters.includeUndated && !Number.isFinite(record.date));
}
export function summarize(records, taxonomy) {
  const grammar = records.filter(r=>r.kind==='grammar' && r.module === 'grammar' && r.raw.formatSupported !== false);
  const review = records.filter(r=>r.kind==='review' && typeof r.correct === 'boolean');
  const unaided = review.filter(r=>r.feedback.audioPlayed === false);
  const practice = records.filter(r=>r.module==='practice' && r.kind==='practice' && r.score !== null);
  const counts = Object.values(taxonomy).flat().map(type=>({type,category:categoryOf(type,taxonomy),count:grammar.filter(r=>r.types.includes(type)).length,
    distinct:new Set(grammar.filter(r=>r.types.includes(type)).map(r=>r.original?.trim().replace(/\s+/g,' ').toLowerCase())).size})).filter(x=>x.count).sort((a,b)=>b.count-a.count);
  return { grammar,review,unaided,practice,counts,recall:ratio(review.filter(r=>r.correct).length,review.length), independentRecall:ratio(unaided.filter(r=>r.correct).length,unaided.length),practiceScore:practice.length ? practice.reduce((a,r)=>a+r.score,0)/practice.length : null,affected:grammar.filter(r=>r.types.length || r.categories.length).length,
    categories:Object.keys(taxonomy).map(category=>({category,count:grammar.filter(r=>r.categories.includes(category)).length})),
    words:records.filter(r=>r.kind==='word'), saved:records.filter(r=>['word','grammar','note','report'].includes(r.kind)) };
}
export function previousWindow(start,end) {
  const a=Date.parse(`${start}T00:00:00Z`), b=Date.parse(`${end}T00:00:00Z`), length=b-a+DAY;
  return {start:new Date(a-length).toISOString().slice(0,10),end:new Date(a-DAY).toISOString().slice(0,10)};
}
export function diagnosis(summary) {
  const top=summary.counts.filter(x=>x.distinct>=2).slice(0,2);
  const parts=[];
  if(top.length) parts.push(`当前保存的诊断中，${top.map(x=>`${x.type}（${x.count} 条记录、${x.distinct} 个不同输入）`).join('、')}较突出。可关注这些规则在不同语境中的适用条件，并核对原句与修正是否保留原意。`);
  else if(summary.grammar.length) parts.push('当前已保存的诊断尚不足以确认反复出现的具体错误模式；可先核对例句和修正理由。');
  if(summary.unaided.length) parts.push(`无音频提示的词汇回忆正确率为 ${percent(summary.independentRecall)}（${summary.unaided.filter(r=>r.correct).length}/${summary.unaided.length} 次），可关注回忆失败词的拼写与词义关联。`);
  if(!parts.length) return '当前筛选范围缺少可诊断的纠错或回忆证据。可扩大时间范围或导入最新记录。';
  return parts.join(' ')+' 这些结果仅描述已记录的表现，不证明长期掌握；模型反馈仍需核对。';
}
export function trend(records,start,end,metric='recall') {
  const count = Math.round((Date.parse(end)-Date.parse(start))/DAY)+1;
  const size=Math.max(1,Math.ceil(count/12)); const points=[];
  for(let i=0;i<count;i+=size) {
    const a=new Date(Date.parse(start)+i*DAY).toISOString().slice(0,10), b=new Date(Math.min(Date.parse(end),Date.parse(start)+(i+size-1)*DAY)).toISOString().slice(0,10);
    const group=records.filter(r=>inWindow(r,a,b));
    let value=null,numerator=null,denominator=0;
    if(metric==='recall') { const rows=group.filter(r=>r.kind==='review' && r.correct !== null && r.feedback.audioPlayed === false);denominator=rows.length;numerator=rows.filter(r=>r.correct).length;value=ratio(numerator,denominator); }
    if(metric==='score') { const rows=group.filter(r=>r.module==='practice' && r.kind==='practice' && r.score!==null);denominator=rows.length;value=rows.length ? rows.reduce((a,r)=>a+r.score,0)/rows.length:null; }
    if(metric==='errors') { const rows=group.filter(r=>r.kind==='grammar' && r.module==='grammar' && r.raw.formatSupported!==false);denominator=rows.length;numerator=rows.filter(r=>r.types.length || r.categories.length).length;value=ratio(numerator,denominator); }
    points.push({start:a,end:b,value,numerator,denominator});
  }
  return points;
}
