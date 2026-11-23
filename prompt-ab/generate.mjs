import fs from "node:fs";
import path from "node:path";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import cases from "./cases.mjs";
import { analyzeGrammar } from "../lib/application/grammar.mjs";
import { askStateless } from "../lib/application/ask.mjs";
import { generateCoachReport } from "../lib/application/coach-report.mjs";
import { parseDiagnosis } from "../lib/domain/parse-diagnosis.mjs";
import * as errorTypes from "../lib/domain/error-types.mjs";
import configLoader from "../lib/shared/config-loader.mjs";
import { resolveModel } from "../lib/server/llm/model-resolver.mjs";

const dir = import.meta.dirname;
const { values } = parseArgs({options:{ live:{type:"boolean"}, ollama:{type:"boolean"}, candidate:{type:"string"}, pilot:{type:"boolean"}, split:{type:"string",default:"calibration"}, task:{type:"string",default:"all"} }});
if (!["calibration","formal"].includes(values.split) || !["all","grammar","ask","coach"].includes(values.task)) throw Error("Invalid split or task");
const pool = cases.filter(c => c.split === values.split && (values.task === "all" || c.task === values.task));
const selected = values.pilot ? pool.filter((c,i)=>pool.findIndex(other=>other.task===c.task && other.group===c.group)===i) : pool;
const variants = values.candidate ? JSON.parse(fs.readFileSync(path.join(dir,"candidates.json"),"utf8"))[values.candidate] : JSON.parse(fs.readFileSync(path.join(dir,"variants.json"),"utf8"));
if (!variants?.grammar || !variants.ask || !variants.coach) throw Error("Unknown candidate");
const config = configLoader.load();
const grammarPrompt = config.Prompts?.SystemPrompt || fs.readFileSync(path.resolve(dir,"..",config.SystemPromptPath || "system_prompt.txt"),"utf8");
const envFile = path.join(dir,".env");
const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const live = Boolean(values.live || values.ollama);
if (live && !values.ollama && !(env.AB_BASE_URL && env.AB_MODEL)) throw Error("Set AB_BASE_URL and AB_MODEL in prompt-ab/.env");
for (const field of ["AB_INPUT_PRICE","AB_OUTPUT_PRICE"]) {
  if (env[field] && !(Number.isFinite(Number(env[field])) && Number(env[field]) >= 0)) throw Error("Invalid " + field);
}
const run = path.join(dir,"runs",(live?"live-":"mock-")+randomUUID());
fs.mkdirSync(path.join(run,"private"),{recursive:true});
const save = (file,data) => fs.writeFileSync(path.join(run,file),JSON.stringify(data,null,2)+"\n");
const model = values.ollama ? resolveModel("ollama","handbook",config).model : live ? env.AB_MODEL : "mock";
const fingerprint = text => createHash("sha256").update(text).digest("hex");
save("private/settings.json",{mode:live?"live":"mock",split:values.pilot?"pilot":values.split,candidate:values.candidate,model,endpointHash:live?fingerprint(values.ollama?config.OllamaBaseUrl:env.AB_BASE_URL):null,temperature:0,variants,inputPrice:values.ollama?null:env.AB_INPUT_PRICE || null,outputPrice:values.ollama?null:env.AB_OUTPUT_PRICE || null});
console.log(run);
function mock(c) {
  if (c.task === "grammar") return JSON.stringify({correction:"",refine:"An alternative wording.",evaluate:"Fixture evaluation.",diagnoses:[],remember:""});
  if (c.task === "ask") return JSON.stringify({question:c.input.question,title:"示例",answer:"Fixture answer.",tags:[],related:[],category:"Other"});
  return ["## 1. 概览","写作资料有限。[S1]","## 2. 范围","## 3. 能力","## 4. 诊断",...Array.from({length:8},(_,i)=>"### 4."+(i+1)+". 观察"),"## 5. 建议"].join("\n");
}
async function execute(c, arm) {
  const calls = [];
  const started = Date.now();
  const llm = {
    config:values.ollama?config:{CoachOutputTokens:config.CoachOutputTokens,CoachReportTimeoutMs:config.CoachReportTimeoutMs},
    getCurrentProviderName:()=>values.ollama?"ollama":"custom",getCurrentProvider:()=>({getModelName:()=>model}),
    async generateWithFallback(input, baseline, options) {
      const system = arm === "B" ? baseline+"\n\n"+variants[c.task] : baseline;
      const request = {model,temperature:0,messages:[{role:"system",content:system},{role:"user",content:input}]};
      if (options.jsonSchema) request.response_format = {type:"json_schema",json_schema:{name:c.task,schema:options.jsonSchema}};
      if (options.maxOutputTokens) request.max_tokens = options.maxOutputTokens;
      const call = {request,systemHash:fingerprint(system),baselineHash:fingerprint(baseline)};
      calls.push(call);
      if (!live) return call.raw = mock(c);
      if (values.ollama) {
        const body = {model,system,prompt:input,think:false,stream:false,options:{temperature:0,num_ctx:Number(config.CoachOllamaContextTokens)||16384,num_predict:options.maxOutputTokens || 2048}};
        if (options.jsonSchema) body.format = options.jsonSchema;
        call.ollamaOptions = body.options;
        const res = await fetch(new URL("/api/generate",config.OllamaBaseUrl),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:options.signal || AbortSignal.timeout(300000)});
        if (!res.ok) throw Error("Ollama HTTP "+res.status);
        const data = await res.json();
        call.model=data.model;
        call.usage={prompt_tokens:data.prompt_eval_count,completion_tokens:data.eval_count};
        if (!data.model || typeof data.response!=="string" || data.done_reason==="length") throw Error("Incomplete Ollama response");
        return call.raw=data.response;
      }
      const response = await fetch(env.AB_BASE_URL.replace(/\/+$/,"")+"/chat/completions",{
        method:"POST",headers:{"Content-Type":"application/json",...(env.AB_API_KEY?{Authorization:"Bearer "+env.AB_API_KEY}:{})},
        body:JSON.stringify(request),signal:options.signal || AbortSignal.timeout(120000)
      });
      if (!response.ok) throw Error("HTTP "+response.status);
      const payload = await response.json();
      call.model = payload.model;
      call.usage = payload.usage;
      if (!payload.model || typeof payload.choices?.[0]?.message?.content !== "string") throw Error("Missing model identity or text");
      return call.raw = payload.choices[0].message.content;
    }
  };
  let answer, error;
  try {
    const deps = {getLLMManager:async()=>llm};
    if (c.task === "grammar") {
      const result = await analyzeGrammar({...deps,text:c.input.text,systemPrompt:grammarPrompt,parseDiagnosis:raw=>parseDiagnosis(raw,errorTypes)});
      answer = result.response.result;
      const parsed = JSON.parse(calls.at(-1).raw.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^\s*```(?:json)?|```\s*$/g,"").trim());
      if (!["correction","refine","evaluate","remember"].every(k=>typeof parsed[k]==="string") || !Array.isArray(parsed.diagnoses)
        || !parsed.diagnoses.every(d=>d && typeof d.error_type==="string" && typeof d.explanation==="string" && ["Minor","Moderate","Major"].includes(d.severity))) throw Error("Invalid Grammar fields");
      if (!answer.refine.trim()) throw Error("Missing refine");
    } else if (c.task === "ask") {
      const result = await askStateless({...c.input,llm,config});
      const raw = JSON.parse(calls.at(-1).raw.replace(/^\s*```(?:json)?|```\s*$/g,"").trim());
      const schema = calls.at(-1).request.response_format.json_schema.schema;
      if (!schema.required.every(k=>Object.hasOwn(raw,k)) || !schema.properties.category.enum.includes(raw.category)
        || ![raw.question,raw.answer,raw.title].every(s=>typeof s==="string" && s.trim())
        || ![raw.tags,raw.related].every(a=>Array.isArray(a) && a.every(x=>typeof x==="string"))) throw Error("Invalid Ask fields");
      answer = result.response.data;
    } else {
      const result = await generateCoachReport({language:c.input.language,refresh:true},{...deps,loadData:()=>c.input,now:Date.UTC(2026,1,1)});
      answer = result.markdown;
    }
  } catch(e) { error = e.code || e.message; }
  return {answer,error,ok:!error,ms:Date.now()-started,calls};
}
function shuffle(items) {
  for (let i=items.length-1;i>0;i--) {const j=randomInt(i+1); [items[i],items[j]]=[items[j],items[i]];}
  return items;
}
const review = [], ballots = [];
for (const c of shuffle([...selected])) {
  const outputs = {};
  for (const arm of shuffle(["A","B"])) outputs[arm] = await execute(c,arm);
  const left = randomInt(2) ? "A":"B";
  const right = left==="A"?"B":"A";
  save(path.join("private",c.id+".json"),{id:c.id,task:c.task,left,outputs});
  const display = arm => outputs[arm].ok ? outputs[arm].answer : "（生成或格式校验失败）";
  review.push({...c,left:display(left),right:display(right)});
  ballots.push({id:c.id,winner:"",severeLeft:null,severeRight:null,reason:""});
  console.log(c.id,outputs.A.ok && outputs.B.ok?"OK":"CHECK");
}
save("review.json",review);
save("ballot.json",ballots);
