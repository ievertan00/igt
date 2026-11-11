import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize,summarize,matches,previousWindow,trend,validateSnapshot,diagnosis,wallTime,utcTime } from './dist/model.mjs';
import { getErrorTypesByCategory } from '../../lib/domain/error-types.mjs';
import { taxonomy } from './dist/taxonomy.mjs';

const fixture = () => ({ format:'clearwrite-growth',version:1,exportedAt:'2026-11-11T03:00:00Z',taxonomy,
  coverage:[],cards:[],words:[],notes:[],reports:[],practiceLog:[],practiceTargets:{},reviews:[],attempts:[] });
const review = (id,source='grammar',type='Grammar / Verb Tense') => ({entryId:id,source,timestamp:'2026-11-10T10:00:00Z',userInput:'I go yesterday.',correction:'I went yesterday.',formatSupported:true,diagnoses:[{error_type:type},{error_type:type}]});
const attempt = (id,feedback,extra={}) => ({id,activity_type:'review-vocabulary',created_at:'2026-11-10 03:00:00',score:100,prompt:'word',target_pattern:'word',learner_answer:'word',reference_answer:'word',feedback:JSON.stringify(feedback),...extra});
test('taxonomy matches all 28 live project definitions',()=>{assert.deepEqual(taxonomy,getErrorTypesByCategory());assert.equal(Object.values(taxonomy).flat().length,28);});
test('diagnoses deduplicate per record and exclude unrelated, unsupported and duplicate sources',()=>{
  const data=fixture();data.reviews=[review('1'),review('1'),review('2','text'),{...review('3'),isDuplicate:true},{...review('4'),formatSupported:false}];
  const summary=summarize(normalize(data),taxonomy);assert.equal(summary.grammar.length,1);assert.equal(summary.counts[0].count,1);assert.equal(summary.categories.find(r=>r.category==='Grammar').count,1);
});
test('unknown labels remain raw and do not become inferred concrete types',()=>{
  const data=fixture();data.reviews=[review('1','grammar','Style'),review('2','grammar','Countability')];const rows=normalize(data),s=summarize(rows,taxonomy);assert.equal(s.counts.length,0);assert.equal(s.affected,1);assert.equal(rows.find(r=>r.key==='grammar:2').raw.diagnoses[0].error_type,'Countability');
});
test('recall accuracy uses explicit correctness and audio provenance, never score or rating',()=>{
  const data=fixture();data.attempts=[attempt(1,{correct:true,audioPlayed:false}),attempt(2,{correct:false,audioPlayed:false}),attempt(3,{correct:true,audioPlayed:true}),attempt(4,{rating:'easy'}),attempt(5,{correct:true})];
  const s=summarize(normalize(data),taxonomy);assert.equal(s.recall,75);assert.equal(s.independentRecall,50);assert.equal(s.unaided.length,2);assert.equal(s.review.length,4);
});
test('practice targets are opportunities and Markdown is not counted a second time',()=>{
  const data=fixture();data.attempts=[attempt(1,{hints_used:2},{activity_type:'practice-sentence',score:80})];data.practiceTargets={1:['Verb Tense']};data.practiceLog=[{entryId:'log',timestamp:'2026-11-10T10:00:00Z',userInput:'answer',practice:{prompt:'中文',referenceAnswer:'answer'}}];
  const rows=normalize(data),s=summarize(rows,taxonomy);assert.equal(s.practiceScore,80);assert.equal(s.practice.length,1);assert.equal(s.counts.length,0);assert.deepEqual(rows.find(r=>r.kind==='practice').targets,['Verb Tense']);
  const f={start:'2026-11-01',end:'2026-11-11',module:'all',category:'Grammar',errorType:'Verb Tense',status:'all',search:''};assert.equal(rows.filter(r=>matches(r,f,taxonomy)).length,1);
});
test('Beijing wall clocks and UTC attempt timestamps are handled differently',()=>{
  assert.equal(wallTime('2026-11-10T10:00:00Z'),Date.parse('2026-11-10T02:00:00Z'));assert.equal(utcTime('2026-11-10 03:00:00'),Date.parse('2026-11-10T03:00:00Z'));
});
test('previous comparison uses equal inclusive windows crossing months',()=>{
  assert.deepEqual(previousWindow('2026-11-01','2026-11-10'),{start:'2026-10-22',end:'2026-10-31'});
});
test('missing observations remain null rather than manufactured zeros',()=>{
  assert.ok(trend([],'2026-11-01','2026-11-11').every(p=>p.value===null&&p.denominator===0));
});
test('undated notes stay separate from dated timelines, current retention is not inferred from scheduling',()=>{
  const data=fixture();data.notes=[{id:'中文笔记.md',title:'wrong title',modifiedAt:'2026-11-10T00:00:00Z',content:'No saved date'}];data.words=[{id:'word',word:'word',added:'2026-10-01',learningStatus:'insufficient-history',srs:{interval_days:100}}];
  const rows=normalize(data),f={start:'2026-11-01',end:'2026-11-11',module:'all',category:'all',errorType:'all',status:'all',search:''};assert.equal(rows.filter(r=>matches(r,f,taxonomy)).length,0);assert.equal(rows.filter(r=>matches(r,{...f,includeUndated:true},taxonomy)).length,1);assert.equal(rows.find(r=>r.kind==='note').title,'中文笔记');assert.equal(rows.find(r=>r.kind==='word').status,'insufficient-history');
});
test('invalid snapshot is rejected and diagnosis does not invent proficiency',()=>{
  assert.throws(()=>validateSnapshot({}),/version 1/);const s=summarize([],taxonomy);assert.match(diagnosis(s),/缺少/);assert.doesNotMatch(diagnosis(s),/B2|精通|每天/);
});
test('hosted asset bundle contains no learning snapshot or server secrets',()=>{
  const entries=fs.readdirSync(new URL('./dist/',import.meta.url));assert.deepEqual(entries.sort(),['app.mjs','index.html','model.mjs','styles.css','taxonomy.mjs'].sort());
});
