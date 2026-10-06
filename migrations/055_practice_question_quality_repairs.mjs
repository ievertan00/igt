// Repair reviewed Practice answer, prompt, context, target and hint issues.
// Content preimages are hashed against the database state after migration 054.
import crypto from "node:crypto";

export const FIXES = {
  "depth-054-023": {
    reference_answer: "This procedure requires workers to wear safety goggles.",
    practice_fields_json: {
      primary_target: ["require-object-to-infinitive"],
      learning_goal: ["Use require + object + to-infinitive to state a workplace safety rule."],
      learning_rationale: ["The object + to-infinitive pattern clearly identifies who must carry out a required action."],
      grammar_point: ["Require + object + to-infinitive"],
    },
    hint_json: {
      simple: "这是一条工作场所的强制安全要求。",
      intermediate: "require 后可直接接被要求的人，再用 to + 动词原形；也可用 require that + 主语 + 动词原形。",
      complete: "This procedure requires workers _____ safety goggles.",
    },
  },
  "depth-054-036": {
    reference_answer: "He eats more than I do, but he never gains weight.",
    practice_fields_json: {
      learning_goal: ["Compare quantities with than + pronoun + auxiliary, then contrast with a result using but."],
    },
    hint_json: {
      simple: "比较两个人吃的量，再说明他体重没有增加。",
      intermediate: "前半句用 more than + 代词 + do；后半句用 never + 动词表达从未发生。",
      complete: "He eats more than I _____, but he never _____ weight.",
    },
  },
  "depth-054-041": {
    reference_answer: "Call me when you get to the airport; my phone will be on.",
    practice_fields_json: {
      primary_target: ["future-time-clause"],
      learning_goal: ["Use when + present simple for a future event and give reassurance about a future state."],
      learning_rationale: ["Future time clauses use the present simple after when, while the main clause can describe a future state."],
      grammar_point: ["When + present simple for future time", "Imperative"],
    },
    hint_json: {
      simple: "让对方到机场后再联络，并说明手机会保持开机。",
      intermediate: "when 从句用一般现在时；主句可以说明届时的状态。",
      complete: "Call me when you _____ to the airport; my phone _____ be on.",
    },
  },
  "depth-054-056": {
    reference_answer: "Could you turn the thermostat up a little? This room is freezing.",
    practice_fields_json: {
      primary_target: ["polite-request-with-reason"],
      learning_goal: ["Make a polite request to raise the thermostat setting and give a reason."],
      learning_rationale: ["Naming the thermostat makes the requested temperature change clear and avoids confusing temperature with cooling output."],
      grammar_point: ["Could you + base verb for a polite request", "Thermostat adjustment"],
    },
    hint_json: {
      simple: "礼貌地请对方调高温度设定，因为房间很冷。",
      intermediate: "用 Could you + 动词原形提出请求；明确调高的是 thermostat 的设定。",
      complete: "Could you turn the thermostat _____ a little? This room is _____.",
    },
  },
  "fill-053-004": { reference_answer: "The heating system was inspected yesterday as part of its annual maintenance; however, if residents find their room temperature is still below eighteen degrees Celsius, they should report it to property management immediately." },
  "fill-053-023": { reference_answer: "This coupon gives you thirty yuan off when you spend two hundred yuan, but the small print says sale items are excluded." },
  "fill-053-026": { reference_answer: "Please complete this form and hand it in at reception by the end of the workday on Friday. If you make any corrections, sign beside them." },
  "fill-053-036": { reference_answer: "The air conditioning in the meeting room is broken. Facilities says they can't send anyone until this afternoon, so let's move the morning presentation online." },
  "fill-053-053": { reference_answer: "If you don't mind, I could put two tables together for you by the window." },
  "fill-053-059": { reference_answer: "The show starts at seven thirty, but it's best to arrive twenty minutes early — there'll be a queue to have tickets checked at the entrance." },
  "fill-053-078": { reference_answer: "This mountain doesn't look that high, but it takes at least two hours to reach the top." },
  "language-g01.1-c3": { reference_answer: "The kitchen, study and balcony lights are all on, but the living-room light has been broken for six months and still hasn't been fixed." },
  "language-g01.1-2": { practice_fields_json: { sentence_structure: ["simple"] } },
  "language-g01.2-1": { practice_fields_json: { tense_aspect: ["present simple"] } },
  "language-g01.2-2": { practice_fields_json: { tense_aspect: ["past simple"] } },
  "language-g01.2-3": {
    practice_fields_json: { register: ["neutral"], sentence_structure: ["simple"] },
    remove_fields: ["clause_type", "conjunction_type", "non_finite", "tense_aspect"],
  },
  "language-g01.3-2": { practice_fields_json: { tense_aspect: ["present simple"] } },
  "language-g01.3-3": {
    practice_fields_json: { voice: ["active"] },
    remove_fields: ["non_finite"],
  },
  "language-g01.4-2": {
    practice_fields_json: { register: ["neutral"] },
    remove_fields: ["tense_aspect", "non_finite"],
  },
  "language-g01.5-1": { practice_fields_json: { tense_aspect: ["past simple"] } },
  "language-g01.5-3": { remove_fields: ["tense_aspect"] },
  "language-g01.3-c2": { reference_answer: "The system is stable at peak times, but once the number of records exceeds thirty million, it is hard to say whether it will remain stable." },
  "language-g01.4-c3": { reference_answer: "As long as the board gives us a clear list of priorities by next Friday, we can lock in the development schedule two weeks ahead of time." },
  "language-g01.6-c2": { reference_answer: "At these meetings, there have always been two opposing views, but nobody has been willing to put the disagreement on the table first." },
  "language-g02.1-c2": { reference_answer: "Could you confirm whether these samples were re-inspected against the latest standard before being sent for testing?" },
  "language-g02.3-c3": { reference_answer: "Which delays, and at what stages, actually cost us an entire delivery window?" },
  "language-g02.5-c1": { reference_answer: "Not all employees who have received training can carry out their tasks without making mistakes, but that doesn't mean the training itself has no value." },
  "language-g03.2-c2": { reference_answer: "The issue remained unresolved throughout the meeting, because nobody was willing to be the first to admit that the plan itself might be flawed." },
  "language-g03.2-c3": { reference_answer: "I don't doubt the supplier's professional expertise, but their delivery schedule makes it hard for us to plan production." },
  "language-g03.8-c1": { reference_answer: "According to the schedule confirmed so far, Monday's demo is scheduled for ten in the morning, though we can move it an hour earlier if the client makes a last-minute change." },
  "language-g03.9-c2": { reference_answer: "The team had planned to finish the refactoring before the end of the year, but as things stand, they'll either have to push it into next year or sacrifice half the tests." },
  "language-g04.1-c2": {
    prompt_zh: "没有人能在两天之内读完这套系统的文档，并向董事会讲清它的全部风险。",
    reference_answer: "Nobody can finish reading this system's documentation in two days and explain all its risks to the board.",
  },
  "language-g04.3-c1": { reference_answer: "According to the latest industry regulations, anyone carrying out an operation involving users' private data must obtain written approval in advance and keep a record of the operation for at least three years." },
  "language-g04.6-1": { reference_answer: "You should get to bed earlier." },
  "language-g04.6-c2": { reference_answer: "Rather than explaining the requirements to your manager again and again, build out the parts you can deliver first, then use the evidence to make a case for the remaining resources." },
  "language-g04.8-c1": { reference_answer: "The server has been unresponsive since two in the morning; either the hardware must have failed or someone must have changed the configuration without authorisation." },
  "language-g04.8-c3": { reference_answer: "The crowd near the exit suddenly stopped moving; the gate ahead must have malfunctioned." },
  "language-g05.4-c2": { reference_answer: "If the team had scheduled the migration window for the weekend, the customers would have been less affected." },
  "language-g05.4-c9": { reference_answer: "If the hotel had not booked the wrong room for us, we would not have had to switch to another hotel at the last minute last night." },
  "language-g05.5-c1": { reference_answer: "If I had stayed in that stable job instead of starting a business ten years ago, I would have savings and a steady income now, and I wouldn't have to look after my elderly parents as well." },
  "language-g05.7-c1": { reference_answer: "I regret not standing my ground at the time and instead agreeing to that clearly flawed plan because I was afraid of offending people." },
  "language-g06.1-c1": { reference_answer: "Although an investigation has been launched, no suspects have yet been formally charged, and the relevant evidence is still being verified piece by piece." },
  "language-g06.2-c1": { reference_answer: "People long believed this disease was incurable, but the latest research has overturned that conclusion." },
  "language-g06.3-4": { reference_answer: "This problem must be solved by the end of this week." },
  "language-g06.3-c2": { reference_answer: "If your luggage is sent to the wrong place during a transfer, it should be available for collection at the service desk in the arrivals hall." },
  "language-g06.4-3": { reference_answer: "It is thought that this reform will reduce costs, but we don't have any data to support that yet." },
  "language-g07.3-4": {
    prompt_zh: "我们新来的同事小王刚从美国留学回来，最近正在慢慢适应新岗位。",
    reference_answer: "Our new colleague Xiao Wang, who has just returned from studying in the US, is settling in well.",
  },
  "language-g07.5-c2": { reference_answer: "Once the client confirms the final version, we'll lock in the production schedule, and any changes after that will have to go through the change process." },
  "language-g07.6-c1": { reference_answer: "Because poor communication caused several delays during our last collaboration, we've decided to establish a detailed reporting system before this project starts." },
  "language-g07.8-c3": { reference_answer: "We tuned the test environment to match production exactly, and as a result, the real performance problems surfaced sooner." },
  "language-g08.4-c1": { reference_answer: "Responding to a crisis of this scale must never depend on one or two people's judgment alone; the entire leadership team must be involved in discussing every key step." },
  "language-g08.5-c1": { reference_answer: "I remember locking the contract in the cabinet, but I don't remember checking whether all the pages were there before I locked it." },
  "language-g09.1-4": {
    prompt_zh: "桌子上有两样东西：一本书和一支笔。",
    reference_answer: "There are two things on the desk: a book and a pen.",
    practice_fields_json: {
      primary_target: ["existential-there"],
      grammar_point: ["Existential there with plural information", "Indefinite articles for first mention"],
      learning_goal: ["Use there are with plural information and a/an to introduce new singular items."],
      learning_rationale: ["This sentence practises plural agreement in an existential construction while introducing two new objects."],
      sentence_structure: ["simple"],
    },
    hint_json: {
      simple: "先说明桌上有几样东西，再列出它们。",
      intermediate: "复数信息用 there are；首次提到的单数可数名词用 a/an。",
      complete: "There are two things on the desk: a/an [物品] and a/an [物品].",
    },
  },
  "language-g09.5-c2": { reference_answer: "Documenting every detail mentioned at the meeting sounds simple, but it takes a full two days in practice." },
  "language-g09.6-c3": {
    prompt_zh: "请把两位负责人的联系方式发给客户，但不要把内部对接群聊转发出去。",
    reference_answer: "Send the two contacts' details to the client, but don't forward the internal group chat to them.",
  },
  "language-g10.4-c2": { reference_answer: "It's not so much that the new version is faster than the old one as that it's much more stable over long periods of use." },
  "language-g10.4-c3": { reference_answer: "This is the project with the highest communication overhead of the three I've been involved in." },
  "language-g11.1-c2": { reference_answer: "Since last Wednesday's system upgrade, more than three hundred support tickets have mentioned the same error." },
  "language-g11.5-c3": { reference_answer: "To avoid affecting the live service, the team chose to roll out the change to a small test group first and then expand it in batches, rather than switching everyone over at once." },
  "language-g11.6-c3": { reference_answer: "The client cares less about the price than about whether we can give a firm delivery date." },
  "language-g11.6-c12": { reference_answer: "The plants in the garden are harmless to pets, but pets should be kept away from soil that has just been fertilised." },
  "language-g11.6-x1": { reference_answer: "She is good at calming anxious children but isn't used to speaking in front of groups." },
  "language-g12.1-4": { reference_answer: "In this role, a sense of responsibility is more important than experience." },
  "language-g12.3-4": { reference_answer: "It was at this meeting that they agreed in principle to cooperate." },
  "language-g12.5-4": { reference_answer: "I've been to Japan, but he hasn't." },
  "language-p02-c1": { reference_answer: "While we are very interested in this collaboration opportunity, our thorough internal review found that the current proposal does not align with this year's strategic direction. We are therefore unable to move forward now, though we would be happy to reassess in six months." },
  "language-p03-3": {
    practice_fields_json: { voice: ["active"], non_finite: ["infinitive"] },
    remove_values: { non_finite: ["participle-past"] },
  },
  "language-p03-4": {
    reference_answer: "I understand your concerns, but the current data do not support this conclusion.",
    practice_fields_json: { voice: ["active"] },
  },
  "language-p07-c2": { reference_answer: "If you'd like, I can turn the review notes into a list of key points and send them for you to review before tomorrow morning." },
  "language-v01-c2": { reference_answer: "Because the budget was cut, we had to move the in-person training online and reduce the cost to a third of its original amount." },
  "language-v02-c2": { reference_answer: "At the meeting, Finance spelled out the reason for the budget overrun for the first time, more directly than before." },
  "language-v03-1": { reference_answer: "I borrowed my sister's bicycle." },
  "language-v04-c2": { reference_answer: "As regulatory requirements continue to tighten, the company's compliance spending is now more than twice what it was three years ago." },
  "language-v06-3": { reference_answer: "This box is heavier than I expected." },
  "native-027-indirect-question-09": { reference_answer: "I don't know how much farther I have to walk on this trail to reach the waterfall." },
  "native-027-mandative-01": { context: "work-study" },
  "native-027-not-until-01": { reference_answer: "Not until the neighbour knocked did I realise that the bathtub was overflowing." },
  "native-027-not-until-03": { reference_answer: "Not until the train left the platform did I realise I was on the wrong train." },
  "native-027-not-until-07": { reference_answer: "Not until I grew vegetables myself did I understand how important daily watering is." },
  "native-027-not-until-09": { reference_answer: "Not until the host sent me a photo did I recognise the door with no number on it." },
  "native-027-perfect-participle-01": { reference_answer: "Having counted all the loose change, she realised she was still two yuan short." },
  "native-027-perfect-participle-04": { reference_answer: "Having moved house three times, I know it's best to label the boxes first." },
  "native-027-perfect-participle-07": { reference_answer: "Having cleaned the borrowed tools, he returned them to his neighbour." },
  "native-027-relative-03": { reference_answer: "I'd like to book a room that overlooks the harbour." },
  "native-027-relative-10": { reference_answer: "The award recognises teams that improve public services." },
  "native-027-ongoing-07": { reference_answer: "The neighbours have been tending this garden together for the past few months." },
  "native-027-ongoing-09": { reference_answer: "I've been practising ordering food in the local language for the past few days." },
  "native-027-past-passive-06": { reference_answer: "The morning sailing was cancelled because of rough seas." },
  "native-027-past-passive-07": { reference_answer: "The roof of the community centre was repaired by a licensed contractor last year." },
  "native-027-mandative-07": { reference_answer: "The residents demanded that a pedestrian crossing be added at the entrance to the neighbourhood." },
};

// SHA-256 preimage fingerprints from the reviewed live bank after migration 054.
export const EXPECTED_PREIMAGES = {
  "depth-054-023": "b086d731a6ee07c193c96ed95c7f8f845a18e3abe0e77939aa935fa551013dd0",
  "depth-054-036": "f057a75d4e3c3bd39c825fdfc6126061b93161aa3cc36d18679e83fe1d3afb06",
  "depth-054-041": "5bce019d5e175532ee850eb4cdd2713bdf6bf041c63c5172bf81653d72c528af",
  "depth-054-056": "83835f8ec27ee499a871d583301d6a62f9f5a80bb6bdd45f3fbcd9c262ccf92a",
  "fill-053-004": "e85043a9a6f23b968d81f4633b9fb75c4b149e4c5a67987afbf456c92e886581",
  "fill-053-023": "fb7a11af9abd9690120a82afd56f6598a92f9cdebeaeac9b1ca0c5d1c9c38be6",
  "fill-053-026": "b706918a070ed29ed4bb2bbd08414e13617a582df2e73cb346f98d2efb761d1a",
  "fill-053-036": "040408072755157f6f2eed0dca0cc555f284f7f91d7a7aec65047e4e2b7940c6",
  "fill-053-053": "137b65159bd8e0044bc370f77164926f3e668dc84f9bd3360e6979d4a4e22c26",
  "fill-053-059": "10de5d61b616de8d67e3b091fae8e4b1e7a82ab7fab93ff420f0a2d2f0b86ef4",
  "fill-053-078": "c047a97e3e54a2736de9d3578cebe74a1ed1073cadc1548582f87efd4ea9ca52",
  "language-g01.1-c3": "0d3d6d9446f9f15247b87f4dfdfe6944cb2707c37af2511266075c0781f8a62b",
  "language-g01.1-2": "b88b1d2e161b99e8651612b269d5230ee9f5ef48735bf747e0074a1c89066d85",
  "language-g01.2-1": "2a2ef0e04752cd3f349d51200abe11979178da1ea7a9c7dcf319b7904c2b6db3",
  "language-g01.2-2": "f425a730cbe8c4bfc12a8dffea17b1b2bade18467b98007d64f6cb6b26b603c6",
  "language-g01.2-3": "e8fec8a122886b085a4c863cab13468e43b91c6bbf20d701d9e519bba0664993",
  "language-g01.3-2": "029ea2483daecdcedac61e0869fa0baf0cf4066625279e8c8f9b352fd161ab24",
  "language-g01.3-3": "5b0f86163e6de651783f850db707c461640bf2ab58265d73d4472ded7c364d4f",
  "language-g01.4-2": "1bcabc1ebcc21d910956d4970a98720c1f1776f0631474740a703ecd057d6f06",
  "language-g01.5-1": "801243536365155a7879321954bd6fe5c2c3f4f29d4e3a0be24f3f5d28c09c6e",
  "language-g01.5-3": "e4dc808e6585b7489c3dc7bcd778b7cf7734ff14fb28e800cae39ce9d20bcb3e",
  "language-g01.3-c2": "6029f9b5e211d0dd78635063ee4db32beda8b9cea0b0aba33887ac6ca8d46aec",
  "language-g01.4-c3": "a76e9276709c8ab3997029e8c3d458dc7389de86f3f36595d7951c617a19effa",
  "language-g01.6-c2": "c35d197e631b301fb1d16a091c694fc28f66accb600c57e9a4bf20e4fc6af15c",
  "language-g02.1-c2": "09b69c0e439bf61146a8c42766b8601be8c35b8e1ba21ed7a672fc5df9fb45de",
  "language-g02.3-c3": "dc137c400110490aa39f176b54fdfde4b8f7932a9e1cef5fb6ea2df0715b692b",
  "language-g02.5-c1": "1baec74cb3ac83478b88bdb6516f3ea4a10215237dc1cc15f6d662f212094cfa",
  "language-g03.2-c2": "96029d94dbd67f58183a9a40afc12fd7a5154ceb8bff07b02a7146fa15727e87",
  "language-g03.2-c3": "d2ec25c5b2bdf412288d6275d4aa2ede3264047ff0a590a2e756ff0d69858d36",
  "language-g03.8-c1": "2950aea9d9af83542f1ddabd410d52b60422911883f99bcbe432b6e3e1ecb94c",
  "language-g03.9-c2": "28900aeaad203295e20821a2686e93d38e6d13ca2296f3313a574064ce008311",
  "language-g04.1-c2": "7ecd3e650271109adb3e7d13dae6bff5f00475900bfc7650fc5401304ec5f156",
  "language-g04.3-c1": "ec1cd5fa29124db53ee6619b50f716b612f7ef7bd603e08062484a5bec2745da",
  "language-g04.6-1": "69a36a98fa92ae1916f6464c29c4c1abdb36c7dadd0bce85ea40637822bf5e60",
  "language-g04.6-c2": "70cbafb86536cd41e7b6abbc09900f8951e4b7684a09ef65a1f9b6461101fb0b",
  "language-g04.8-c1": "070d9f4ec34cf70f223b48672b5bf72398152ea81e6ac8c6e60233151ac5b4d1",
  "language-g04.8-c3": "004d74e29a403154b3bc2d05021b6810f98222e589a078d760b64fde587544b7",
  "language-g05.4-c2": "b40fc6873b03f3edf497ad32173b59a7f3b145c085d18fa7663f113d62e52617",
  "language-g05.4-c9": "90826ecf31e7887fa4c836561e07e9472baa31a60dab8354b3c72cf326252f7a",
  "language-g05.5-c1": "4a49b3a381baf6c561589875bce22722fb5fba7f3f21f39865fe46c31561fd92",
  "language-g05.7-c1": "8f67e795de4672a2148af1e00f0209a7592b340dc0eb032619aacea9db66ae8a",
  "language-g06.1-c1": "ac31304a41ad4befbee83ddb37201490e549a7132338a89d7271e403fa3189fe",
  "language-g06.2-c1": "61f565e8c485a928962c98394d9a539012c3c8959b51dfeaf2098f0520d6f03d",
  "language-g06.3-4": "75f352fff92ba91ad99f4ba871522fbea4aaf51aeb5b49ff1a7e51e4c676cf83",
  "language-g06.3-c2": "7c58b3206ff82bbc624bf407f41e585115eee01fe3de4bb237ce3f869e2e4c80",
  "language-g06.4-3": "4bcddb2782c1d88ec0f0d77fb2fda5fd15af89c7cc5d7b8cfffa286fe3584ad2",
  "language-g07.3-4": "9f898142aaf9d9cf5028fdcf3c25851889675ee868093ffc969fbb96ed2fe0b5",
  "language-g07.5-c2": "fcc1ebe78cfcd5e62aa366f4f64fc98435fce3c4fdc387a9a23b33462b256e3e",
  "language-g07.6-c1": "5fa3f80f55eea3de3ec387ae8df1f60768bf61f407a97d25d0fe872bbdca2fa1",
  "language-g07.8-c3": "e69697a19461eff1a1315a663852fdf2266f16cc5360f9b46fb206e30b079046",
  "language-g08.4-c1": "af023f08df55cf90f79847e917906794571a95df112a03e418004d6f410ea9ad",
  "language-g08.5-c1": "fc4b2f6667e1fc97f9ac3132b5e8fb9bab0215ef6b18355311da959cc48cb5bc",
  "language-g09.1-4": "9f5e181289964fd0383ae61d8bcc37401b8b33907b8259799eb39e48273bc56d",
  "language-g09.5-c2": "801506d00a36102aba234d010b21e1b81c180fc716e2d35b2911a115ce4ae194",
  "language-g09.6-c3": "76c6155c991f1cdacdddabba3d4c8a860ab5b87cea999fe52e134bc486d652af",
  "language-g10.4-c2": "45aba8bb04b059f359f2a922d06f35553eba99c7dd6684d992413e5fd1374bd5",
  "language-g10.4-c3": "132bd320b86824c59a1ef04af10befac9efdbe51e4b4b832da52c24338546734",
  "language-g11.1-c2": "1994687854b3cb8c38ebdc890955cb2b263754713093a7c157ed24d71410ecf1",
  "language-g11.5-c3": "f50aed7e7402cced37b8c026c5d020a3c4dda69376825aeccfbebe0631e06505",
  "language-g11.6-c3": "bc685b02242888d929f3c7107386520b240f89eb85f1763e4c7c10bc5fce8aff",
  "language-g11.6-c12": "3cf16ff9d6478c72ac9f80b1a9796a0b915fcffe1c4e84fb92af1821322461ba",
  "language-g11.6-x1": "cb5edf4883549207170f9b68f47eafb8053b9d14025ee799fde79cfaa6c4e6b9",
  "language-g12.1-4": "fe0d08755ffafd745684b8f30a6224ec60d7d9de7fd0ecc4248fb841c505c279",
  "language-g12.3-4": "37b7a19a33b49409c807df968d82c08795342e66512284dae132a4f974808883",
  "language-g12.5-4": "3f59f87fc6d7fe4a7c4312cbae46be2ff49365096ae39dee66f459738900c210",
  "language-p02-c1": "f0ec5bbd84e0a1e7742c2e3df86078fec843c8369c50312b28f828f37c096957",
  "language-p03-3": "016b1a5d3551ad5013a8fa4b7977939f8ad52e584d7e50090626c6960a338db4",
  "language-p03-4": "00342e4c26b030f70aaf99af0a671ef7f99c4c5f6d48e4665638a2f28aae8a6d",
  "language-p07-c2": "dfa0b3e1c3fbb0e72fa23f7c6f6b46b4b2c5dec1e38c7636e010ba56ba3bd117",
  "language-v01-c2": "9802b082e70df554a0e93c6e97929024b2c36e364ff0e2761ae9efb93b238aa5",
  "language-v02-c2": "9e081d99c612c33d4dbd9e359e92f8ed7e007b120bf98d0d02bd01ed868ffb07",
  "language-v03-1": "1c8629712675d90b6745063c7c42f3c0a46540d061f90092635703083d1d6f29",
  "language-v04-c2": "354892f883773ffc255c17a5e7975f05bad0f681d183d4601acad698414bf9fc",
  "language-v06-3": "dd985dde567cd8d20d6302aff5920d2caada6e77729a35ef2991ae6034f091d9",
  "native-027-indirect-question-09": "b0f0d34ced61dcc332ec06181e09defd462c43718435498051fcbf6e00f918a5",
  "native-027-mandative-01": "a6facf34f3653442338dbf8394508ab92085ee7080f407ea936bab488f5e0d8d",
  "native-027-not-until-01": "306e72b5fc830c010336ecabb532ac2d6910b233141fcbd511ae41002c5ae3a1",
  "native-027-not-until-03": "490606f4b28650e70a82318f6d5fb25b9b291c994c3c35ca89ec1d8a849f4709",
  "native-027-not-until-07": "d209ffba3bf9d57b32a1aecad0016d5417d25968577d60270b32776f8e3f972b",
  "native-027-not-until-09": "50100ad4acd7b962e34c51de966b744c829d8986ac2b8ab354f241ba4ba5e3c4",
  "native-027-perfect-participle-01": "6da02e100dfb2c98c9d71ed13b18abd1d52f8267f9ef30704a631ccb2d5d719c",
  "native-027-perfect-participle-04": "70602b3b0a4c5bdb79a1bca2931cc6a7748e843498b9a3f59cb9c85a75138abb",
  "native-027-perfect-participle-07": "ea10181f49cbaf58c9e53e0cf03681bb37d2f9eb553110a60c1b71f944e5748a",
  "native-027-relative-03": "f914225d586eff0109423d8128562365e8296e1e15a948c6796a4b4725439506",
  "native-027-relative-10": "7fbea8a7dd8f6f5f773d6dbb2cb6fb2f7e6eb59a133e2ef0257f321b0821d061",
  "native-027-ongoing-07": "7f7440888ce66ace7ec1a025f43951ffaad05b3f76e8be307332a54f7fd0c2cb",
  "native-027-ongoing-09": "fdf3e9e2704e157e8db0ffa511d10409f23bff5baa3d25e94a6f0fed29e1501d",
  "native-027-past-passive-06": "74bafccb806fc8e5de7c748abcdc0d4ae6bba9397e14041785cfc53f2da6b919",
  "native-027-past-passive-07": "3ab9d0894c12e13c5430ca314dfc727ddaede7de10c3f1181c89cc425b03f7f1",
  "native-027-mandative-07": "308d7b8103e803218bb857282830c7168cbcb155c76d6586ee273efe5bae1fec",
};

function contentHash(row) {
  return crypto.createHash("sha256").update(JSON.stringify([
    row.id, row.prompt_zh, row.reference_answer, row.difficulty, row.context,
    row.practice_fields_json, row.hint_json, row.generated_by,
  ])).digest("hex");
}

function repairedHash(row, fix) {
  const fields = JSON.parse(row.practice_fields_json);
  for (const [key, value] of Object.entries(fix.practice_fields_json || {})) fields[key] = value;
  for (const key of fix.remove_fields || []) delete fields[key];
  for (const [key, values] of Object.entries(fix.remove_values || {})) {
    if (Array.isArray(fields[key])) {
      fields[key] = fields[key].filter((value) => !values.includes(value));
      if (fields[key].length === 0) delete fields[key];
    }
  }
  return contentHash({
    ...row,
    prompt_zh: fix.prompt_zh ?? row.prompt_zh,
    reference_answer: fix.reference_answer ?? row.reference_answer,
    difficulty: fix.difficulty ?? row.difficulty,
    context: fix.context ?? row.context,
    practice_fields_json: JSON.stringify(fields),
    hint_json: fix.hint_json ? JSON.stringify(fix.hint_json) : row.hint_json,
  });
}

export function up(db) {
  return db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const put = db.prepare(`UPDATE practice_questions SET
      prompt_zh = ?, reference_answer = ?, difficulty = ?, context = ?,
      practice_fields_json = ?, hint_json = ?, generated_by = ? WHERE id = ?`);
    let updated = 0;
    for (const [id, fix] of Object.entries(FIXES)) {
      const row = get.get(id);
      if (!row) throw new Error(`Quality repair target missing: ${id}`);
      const expected = EXPECTED_PREIMAGES[id];
      if (!expected) throw new Error(`Quality repair has no preimage guard: ${id}`);
      const currentHash = contentHash(row);
      if (currentHash === repairedHash(row, fix)) continue;
      if (currentHash !== expected) throw new Error(`Quality repair preimage conflict: ${id}`);

      const fields = JSON.parse(row.practice_fields_json);
      for (const [key, value] of Object.entries(fix.practice_fields_json || {})) fields[key] = value;
      for (const key of fix.remove_fields || []) delete fields[key];
      for (const [key, values] of Object.entries(fix.remove_values || {})) {
        if (Array.isArray(fields[key])) {
          fields[key] = fields[key].filter((value) => !values.includes(value));
          if (fields[key].length === 0) delete fields[key];
        }
      }
      put.run(
        fix.prompt_zh ?? row.prompt_zh,
        fix.reference_answer ?? row.reference_answer,
        fix.difficulty ?? row.difficulty,
        fix.context ?? row.context,
        JSON.stringify(fields),
        fix.hint_json ? JSON.stringify(fix.hint_json) : row.hint_json,
        row.generated_by,
        id,
      );
      updated++;
    }
    return { updated };
  })();
}

export function down() {
  throw new Error("Quality repairs are not automatically reversible; restore the verified pre-repair database backup.");
}

export default { up, down };
