import focuses from "./language-focuses.json" with { type: "json" };

// Authored Chinese prompts, references and three hints. No runtime question generation.
// Each focus has clear-cue, contrast and transfer variants, in that order.
// Fields: Chinese ~ reference ~ meaning cue ~ construction cue ~ open pattern ~ situation/genre/register/tone.
const authored = String.raw`
G01.1
孩子们每天在院子里玩耍。~The children play in the yard every day.~谁在活动，多久发生一次？~复数主语配一般现在时，不需要宾语。~[复数主语] + V + [地点] + [频率]~ECnf
昨晚婴儿睡得很好。~The baby slept well last night.~动作发生在已经结束的时间里。~不及物动词用过去式，方式放在动词后。~[主语] + [动词过去式] + [方式副词] + [过去时间]~ECno
火车到站后，乘客们下了车。~After the train arrived, the passengers got off.~先后发生的两个动作是谁做的？~时间从句和主句都用过去时；get off 可不带宾语。~After [主语] + [过去式], [另一主语] + got off~TCno
G01.2
我每天读一份报纸。~I read a newspaper every day.~找出读的对象。~一般现在时中，把宾语放在动作后。~[主语] + read + [宾语] + [频率]~ECno
她昨天买了两张票。~She bought two tickets yesterday.~数量和购买时间都要保留。~buy 的过去式是 bought，数词后用复数。~[主语] + bought + [数量及对象] + [过去时间]~TXno
请在会议前检查这份报告。~Please check this report before the meeting.~这里要求对方做什么？~祈使句省略主语，check 后直接接对象。~Please + check + [宾语] + before [时间名词]~WNfd
G01.3
这碗汤很热。~This soup is very hot.~描述的是汤的状态。~be 后用形容词，汤作不可数名词。~[主语] + is + [程度副词] + [形容词]~ECno
他听起来很担心。~He sounds worried.~听起来如何，不是怎样发出声音。~sound 作系动词，后接形容词。~[主语] + sounds + [状态形容词]~SCnf
虽然任务很难，她仍然很冷静。~Although the task is difficult, she remains calm.~难度和人的状态形成对照。~remain 作系动词，后接状态形容词。~Although [分句], [主语] + remains + [形容词]~WRno
G01.4
我昨天给她寄了一张明信片。~I sent her a postcard yesterday.~谁收到了什么？~send 可先接人再接物。~[主语] + sent + [收件人] + [物品] + [时间]~TMnf
请把更新后的文件发给我。~Please send the updated file to me.~文件是发出的对象，我是接收者。~先说物品，再用 to 引出接收者。~Please + send + [文件] + to [接收者]~WEfd
你到家后，能给我发条消息吗？~Could you send me a message when you get home?~请求和到家的时间都要保留。~情态问句中 send 用原形；时间从句用现在时。~Could you + send + [接收者] + [物品] + when [陈述]?~SMct
G01.5
这个消息让我很开心。~The news made me happy.~消息改变了谁的感受？~make 的过去式后接宾语和形容词。~[原因] + made + [宾语] + [状态形容词]~SCnf
大家都叫他小李。~Everyone calls him Little Li.~称呼是在补充谁的名称？~call 后保留宾语，再接名称。~[主语] + calls + [宾语] + [名称]~SCcf
请把门保持打开，让空气流通。~Please keep the door open to let the air circulate.~门要保持什么状态，目的是什么？~keep + 宾语 + 形容词；to 引出目的。~Please + keep + [对象] + [状态] + to [目的动作]~ENnd
G01.6
门口有一位客人在等你。~There is a guest waiting for you at the door.~引出一个此前未提到的人。~there is 后接单数名词，再补等待信息。~There is + [单数名词] + waiting for [人] + [地点]~ECno
桌上没有任何干净的杯子。~There aren't any clean cups on the table.~表达不存在，注意复数。~否定存在句用 there aren't any。~There aren't any + [复数名词] + [地点]~ECnd
如果有空房，我们想再住一晚。~If there is a room available, we'd like to stay one more night.~存在条件决定后面的愿望。~if 中用 there is；愿望可用 would like to。~If there is + [单数名词] + [状态], we'd like to + [动作]~TXnt
G01.7
外面现在很冷。~It is very cold outside now.~天气不需要一个具体的人作主语。~天气用形式主语 it。~It is + [程度] + [天气形容词] + [地点/时间]~ECno
对我来说，按时完成这项任务很重要。~It is important for me to finish this task on time.~评价的是做这件事。~it 作形式主语，for 引出执行者。~It is + [评价形容词] + for [人] + to [动作]~WRno
你能帮忙真是太好了。~It is kind of you to help.~评价的是对方的行为品质。~kind 后用 of 表示被评价的人。~It is + kind + of [人] + to [动作]~SCnf
G02.1
你每天坐公交车上班吗？~Do you take the bus to work every day?~确认一种日常习惯是否成立。~实义动词的一般疑问句用 do。~Do + [主语] + V + [其他信息]?~ECno
她今天在办公室吗？~Is she in the office today?~这里问的是位置状态。~be 自身提前，不再添加 do。~Is + [主语] + [地点] + [时间]?~WCno
我们能在登机前买些水吗？~Can we buy some water before boarding?~问是否可以做这件事。~can 提到主语前，后接动词原形。~Can + [主语] + V + [宾语] + before V-ing?~TCnt
G02.2
你把钥匙放在哪里了？~Where did you put the keys?~未知信息是位置。~过去时间用 did，后面的动词用原形。~Where + did + [主语] + V + [宾语]?~ECno
会议为什么取消了？~Why was the meeting cancelled?~问的是原因，不是执行者。~过去被动问句用 was + 主语 + 过去分词。~Why + was + [主语] + V3?~WCno
你打算什么时候提交申请？~When are you going to submit the application?~要问计划中的时间。~疑问词放在 be going to 问句前。~When + be + [主语] + going to + V + [宾语]?~WEfn
G02.3
谁住在楼上？~Who lives upstairs?~未知的是居住的人。~who 作主语，不另加 do。~Who + [第三人称单数动词] + [地点]?~ECno
什么导致了这次延误？~What caused this delay?~问导致事情发生的因素。~what 作主语，动词直接用过去式。~What + [动词过去式] + [宾语]?~WMno
谁能帮我搬这些箱子？~Who can help me move these boxes?~未知的是有能力帮忙的人。~who 后直接接 can；help 后可用原形。~Who + can + help [人] + V + [对象]?~SCnt
G02.4
你知道她住在哪里吗？~Do you know where she lives?~问题藏在另一个问题里面。~where 后用陈述语序。~Do you know + where + [主语] + [谓语]?~SCnt
请告诉我这个预订是否可以取消。~Please tell me whether this booking can be cancelled.~询问的是能否取消，而不是取消方法。~whether 引出是非问题，后接陈述语序。~Please tell me + whether + [主语] + can be + V3~XEft
我想确认一下，会议几点开始。~I'd like to check what time the meeting starts.~礼貌地核对一个时间。~what time 后不倒装；固定安排用现在时。~I'd like to check + what time + [主语] + [谓语]~WEft
G02.5
并非所有学生都喜欢在线学习。~Not all students enjoy learning online.~只否定全部，不否定每一个。~not all 表示部分否定。~Not all + [复数名词] + [谓语]~WRno
这些建议我一个也没采纳。~I didn't adopt any of these suggestions.~这里否定的是整个集合。~not any 表示全体否定，不用 not all。~[主语] + did not + V + any of [集合]~WMnd
虽然大家都收到了邮件，但并非人人都回复了。~Although everyone received the email, not everyone replied.~收到邮件和回复邮件的范围不同。~not everyone 保留部分否定；两件事用过去时。~Although [全体陈述], not everyone + [过去式]~WRno
G02.6
我周末不工作。~I don't work at weekends.~这是对习惯的否定。~实义动词前加 don't，动词用原形。~[主语] + don't + V + [时间]~ECnd
她现在不在家。~She isn't at home now.~否定的是位置状态。~be 后直接加 not，不使用 do。~[主语] + is not + [地点] + [时间]~SCno
如果没有票，你就不能上车。~If you don't have a ticket, you can't get on the bus.~条件和结果各需一个否定。~have 用 don't；can 后直接加 not。~If [主语] + don't have + [对象], [主语] + can't + V~TNnd
G03.1
他每天早上喝一杯咖啡。~He drinks a cup of coffee every morning.~这是固定习惯。~第三人称单数的现在时动词加 s。~[主语] + V-s + [宾语] + [频率]~ECno
我通常周末做饭，但今天准备出去吃。~I usually cook at weekends, but today I'm going to eat out.~习惯和今天的计划不同。~习惯用一般现在时，计划用 going to。~[主语] + usually + V + [时间], but today [主语] + be going to + V~ECcf
除非下雨，她每天都走路上班。~Unless it rains, she walks to work every day.~习惯有一个例外条件。~unless 相当于 if not，习惯仍用现在时。~Unless [条件现在时], [主语] + V-s + [频率]~ECno
G03.2
我相信她说的话。~I believe what she says.~这是一种想法状态。~believe 在此不用进行时。~[主语] + believe + what [主语] + [谓语]~SCnf
这件外套属于我，不属于我姐姐。~This coat belongs to me, not to my sister.~表达归属而非正在发生的动作。~belong to 通常用简单时态。~[物品] + belongs to [人], not to [另一人]~ECnd
我现在需要帮助，因为我不懂这些说明。~I need help now because I don't understand these instructions.~现在的需求和理解状态都是重点。~need 和 understand 在状态含义下用一般现在时。~[主语] + need + [宾语] + because [主语] + don't understand + [对象]~XCnt
G03.3
她现在正在做饭。~She is cooking now.~动作此刻正在进行。~现在进行时用 is + V-ing。~[主语] + is + V-ing + [时间]~ECno
你打电话时，我正在洗澡。~I was taking a shower when you called.~过去某个动作发生时，另一个动作正在进行。~背景动作用过去进行时，短动作用过去时。~[主语] + was + V-ing + when [主语] + [过去式]~SCno
我们正在讨论是否推迟会议。~We are discussing whether to postpone the meeting.~正在进行的是讨论，不是推迟。~主句用进行时，whether to 引出讨论的选择。~[主语] + are + V-ing + whether to V + [对象]~WMno
G03.4
我昨天去了一趟银行。~I went to the bank yesterday.~时间已经结束。~go 的过去式是 went。~[主语] + went to [地点] + [过去时间]~ECno
她上周没参加培训。~She didn't attend the training last week.~既要表达过去，也要表达否定。~didn't 后用 attend 原形。~[主语] + didn't + V + [宾语] + [过去时间]~WRno
我们到达机场后，买了些食物。~After we arrived at the airport, we bought some food.~两件事按先后顺序发生。~两项已结束的动作都用过去时。~After [主语] + [过去式] + [地点], [主语] + [过去式] + [宾语]~TCno
G03.5
我已经把报告发给你了，请查收。~I've already sent you the report. Please check your inbox.~过去的发送与现在查收相关。~already 常配现在完成时；send 的过去分词是 sent。~[主语] + have/has already + V3 + [对象]; Please + [查收动作]~WEno
我去年去过伦敦，但今年还没去过。~I went to London last year, but I haven't been there this year yet.~结束的年份和尚未结束的年份不同。~last year 用过去时，this year yet 可用现在完成时。~[过去事件], but [主语] + haven't + V3 + [本年时间] + yet~TCno
钥匙丢了，所以我现在进不了家门。~I've lost my keys, so I can't get into my home now.~过去的丢失留下现在的结果。~lose 用现在完成时，结果用现在的能力否定。~[主语] + have/has + lost + [物品], so [主语] + can't + V + [地点]~ECno
G03.6
我在这里住了五年，现在还住在这里。~I've lived here for five years and still live here.~状态从过去持续到现在。~live 用现在完成时，for 后接时长。~[主语] + have/has lived + [地点] + for [时长] + and [当前状态]~ECno
她从早上起一直在修电脑，到现在还没修好。~She's been repairing the computer since this morning and hasn't finished yet.~活动持续进行，尚未完成。~持续动作用完成进行时，since 后接起点。~[主语] + has been + V-ing + [宾语] + since [起点], and hasn't + V3 + yet~WCno
自从我们开始合作以来，我就一直认识这位经理。~I've known this manager since we started working together.~持续的是认识，不是动态过程。~know 用现在完成时，不用完成进行时。~[主语] + have known + [人] + since [过去时分句]~WRno
G03.7
我们到电影院时，电影已经开始了。~The film had already started when we arrived at the cinema.~哪个动作发生得更早？~先发生的事件用 had + V3。~[较早事件主语] + had already + V3 + when [较晚事件]~SCno
他告诉我，他以前从未坐过飞机。~He told me he had never flown before.~没有经历是在过去谈话之前。~过去的参照点之前用过去完成时。~[主语] + told [人] + [主语] + had never + V3 + before~TCno
因为她提前准备好了材料，会议进行得很顺利。~Because she had prepared the materials in advance, the meeting went smoothly.~准备在会议之前完成。~原因中的较早动作用过去完成时。~Because [主语] + had + V3 + [宾语], [主语] + [过去式] + [方式]~WRno
G03.8
我明天下午三点要见牙医，预约已经确认了。~I'm seeing the dentist at three tomorrow afternoon; the appointment is confirmed.~这是已有预约的安排。~已确认的个人安排可用现在进行时。~[主语] + be + V-ing + [对象] + [未来时间]; [确认状态]~XCno
按照时刻表，火车明早六点发车。~According to the timetable, the train leaves at six tomorrow morning.~固定时刻表不同于个人预约。~列车时刻表用一般现在时。~According to [依据], [主语] + V-s + at [未来时间]~TRno
我们周五已约好吃午饭，你要一起吗？~We're having lunch on Friday. Would you like to join us?~确定的安排之后是邀请。~安排用现在进行时，邀请用 would like to。~[主语] + be having + [活动] + [未来时间]; Would you like to + V?~SMcf
G03.9
我已经决定，这周末要整理房间。~I've decided that I'm going to tidy my room this weekend.~打算已经形成。~已有意图用 be going to。~[决定说明] + [主语] + be going to + V + [对象/时间]~ECno
电话响了，我来接。~The phone is ringing. I'll answer it.~这是当场作出的决定。~即时决定可用 will。~[当前情况]; [主语] + will + V + [代词宾语]~ECcf
我打算申请这份工作，但还没开始写简历。~I'm going to apply for this job, but I haven't started writing my CV yet.~已有打算与尚未开始并存。~意图用 going to，尚未开始用完成时否定。~[主语] + be going to + V + [对象], but [主语] + haven't started + V-ing + yet~WCno
G03.10
我想他们明天会赢。~I think they'll win tomorrow.~这是个人预测。~一般预期可用 will，保留 think 的语气。~I think + [主语] + will + V + [未来时间]~SCcn
看看这些乌云，马上要下雨了。~Look at those dark clouds. It's going to rain soon.~预测有眼前迹象。~有可见证据时可用 going to。~Look at [迹象]; it is going to + [天气动作] + [时间]~ECno
如果交通像今天这样，我们明天可能会迟到。~If the traffic is like this, we may be late tomorrow.~预测带有条件和不确定性。~if 从句用现在时，结果用 may 保留可能程度。~If [现在时条件], [主语] + may + be + [状态] + [未来时间]~TCnn
G04.1
她能游一千米。~She can swim a thousand metres.~说的是能力，不是许可。~can 后接动词原形。~[主语] + can + V + [距离]~ECno
去年受伤后，我有三个月不能走路。~After my injury last year, I couldn't walk for three months.~能力限制发生在过去。~过去的一般能力否定用 couldn't。~After [过去事件], [主语] + couldn't + V + for [时长]~ECno
如果提前练习，你就能独立完成这项任务。~If you practise beforehand, you'll be able to complete this task on your own.~未来能力取决于准备。~未来能力用 will be able to，不用 will can。~If [现在时条件], [主语] + will be able to + V + [对象/方式]~WCnf
G04.2
我可以坐在这里吗？~May I sit here?~这是在请求许可。~may 放在主语前，后接原形。~May + [主语] + V + [地点]?~TXnt
你可以用我的电脑，但不能安装软件。~You may use my computer, but you may not install software.~允许和不允许的范围不同。~may 和 may not 分别说明许可范围。~[主语] + may + V + [对象], but [主语] + may not + V + [对象]~WCnd
如果家长同意，学生可以提前离开。~Students may leave early if their parents agree.~许可受一个条件限制。~许可用 may，条件从句用一般现在时。~[主语] + may + V + [方式] + if [现在时条件]~WNfd
G04.3
我今天必须交房租。~I have to pay the rent today.~今天有必须履行的责任。~have to 后接动词原形。~[主语] + have to + V + [对象] + [时间]~ECnd
我们昨天必须重新提交申请。~We had to resubmit the application yesterday.~必要性发生在过去。~过去的必须用 had to，不能直接把 must 当过去式。~[主语] + had to + V + [对象] + [过去时间]~WRno
所有访客都必须在进入实验室前登记。~All visitors must register before entering the laboratory.~这是对所有访客的要求。~must 表义务，before 后可接 V-ing。~All [人员] + must + V + before V-ing [地点]~WNfd
G04.4
你明天不必来办公室。~You don't have to come to the office tomorrow.~没有必要，不是不允许。~don't have to 表示无义务。~[主语] + don't have to + V + [地点/时间]~WMnf
这项活动可以参加，也可以不参加。~You don't have to take part in this activity.~参与是可选择的。~无义务不能用 mustn't。~[主语] + don't have to + take part in [活动]~WNno
如果在线付款，就不必在柜台排队了。~If you pay online, you don't have to queue at the counter.~条件成立后，必要性消失。~条件用现在时，结果用 don't have to。~If [现在时条件], [主语] + don't have to + V + [地点]~XNnd
G04.5
这里禁止吸烟。~You must not smoke here.~行为不被允许。~must not 表禁止。~[主语] + must not + V + [地点]~TNfd
你可以拍照，但不能使用闪光灯。~You can take photos, but you can't use a flash.~许可有明确限制。~can 与 can't 对照表达允许和禁止。~[主语] + can + V + [对象], but [主语] + can't + V + [对象]~TNnd
未经允许，不得分享这些文件。~You must not share these files without permission.~禁止有一个例外条件。~must not 后用原形，without 后接名词。~[主语] + must not + V + [对象] + without [许可名词]~WNfd
G04.6
你应该早点休息。~You should get some rest early.~这是建议，不是强制命令。~should 后接动词原形。~[主语] + should + V + [其他信息]~SCnf
你不应该跳过早餐。~You shouldn't skip breakfast.~建议避免某种行为。~否定建议用 shouldn't。~[主语] + shouldn't + V + [对象]~SCnf
如果你不确定，最好先问老师。~If you're not sure, you should ask the teacher first.~建议适用于一个条件。~if 后保留状态，建议用 should。~If [不确定状态], [主语] + should + V + [对象] + first~WCnf
G04.7
她可能还在办公室。~She may still be in the office.~当前情况并不确定。~现在的可能性用 may + 原形。~[主语] + may still + be + [地点]~WCnn
他可能没看到昨天的邮件。~He might not have seen yesterday's email.~不确定的是过去是否发生。~过去可能性用 might have + V3，not 放在 might 后。~[主语] + might not have + V3 + [对象]~WEfn
如果我们现在出发，也许还能赶上末班车。~If we leave now, we might still catch the last bus.~结果只是可能，不是保证。~条件用现在时，结果用 might still。~If [现在时条件], [主语] + might still + V + [对象]~TCnn
G04.8
灯还亮着，她一定还没睡。~The light is still on; she must still be awake.~根据迹象作出强肯定推断。~推断用 must，不是义务。~[证据]; [主语] + must still + be + [状态]~SCna
他不可能已经到了，飞机还没起飞呢。~He can't have arrived yet; the plane hasn't taken off.~对过去完成的事情作强否定推断。~can't have + V3 表过去不可能。~[主语] + can't have + V3 + yet; [证据]~TCna
她一定忘了我们的约定，因为她一直没来。~She must have forgotten our arrangement because she hasn't shown up.~推断的是过去的遗漏，依据是现在的结果。~过去肯定推断用 must have + V3。~[主语] + must have + V3 + [对象] + because [证据]~SCnn
G04.9
我愿意帮你整理这些资料。~I'm willing to help you organise these materials.~表达自愿协助。~be willing to 后接原形。~[主语] + be willing to + help [人] + V + [对象]~WCnf
他不肯告诉我原因。~He won't tell me the reason.~这里是拒绝透露，不是将来预测。~won't 可表示不愿意。~[主语] + won't + V + [人] + [内容]~SCnd
只要时间合适，我愿意参加讨论。~I'm willing to join the discussion as long as the time works for me.~意愿有明确条件。~willing to 表意愿，as long as 表条件。~[主语] + be willing to + V + [活动] + as long as [条件]~WMnt
G05.1
水结冰时，体积会膨胀。~When water freezes, it expands.~这是通常成立的规律。~条件和结果都用一般现在时。~When [主语] + V-s, [主语] + V-s~WRno
如果我睡得不够，就很难集中注意力。~If I don't get enough sleep, I find it hard to concentrate.~反复成立的条件和结果。~一般条件用现在时，不必用 will。~If [现在时条件], [主语] + find it + [形容词] + to V~ECno
除非经常练习，否则技能会退步。~Unless you practise regularly, your skills deteriorate.~规律中包含一个例外条件。~unless 相当于 if not，结果用现在时。~Unless [现在时条件], [主语] + [现在时谓语]~WRnd
G05.2
如果明天下雨，我们就待在家里。~If it rains tomorrow, we'll stay at home.~将来的条件仍然可能实现。~if 从句用现在时，结果用 will。~If [现在时条件] + [未来时间], [主语] + will + V + [地点]~SMno
除非你现在出发，否则你会错过火车。~Unless you leave now, you'll miss the train.~结果发生在条件不满足时。~unless 表 if not，结果用 will。~Unless [现在时条件], [主语] + will + V + [对象]~TCnd
只要你在周五前确认，我们就可以保留预订。~We can hold the reservation provided that you confirm by Friday.~未来安排有一个必要条件。~provided that 后用现在时，by 标截止时间。~[主语] + can + V + [对象] + provided that [现在时条件] + by [截止时间]~XEft
G05.3
如果我有更多时间，我会学吉他。~If I had more time, I would learn to play the guitar.~假设与现在的时间状况不同。~过去形式表示现实距离，结果用 would。~If [主语] + had + [资源], [主语] + would + V~SCcn
如果我住得近一些，就能每天走路上班。~If I lived closer, I could walk to work every day.~假想距离改变现在的能力。~条件用过去式，能力结果用 could。~If [主语] + [过去式] + [比较信息], [主语] + could + V + [频率]~ECnn
如果我是你，我不会仓促决定。~If I were you, I wouldn't rush into a decision.~借假设给出建议。~if I were you 常用于建议，结果用 wouldn't。~If I were [人], [主语] + wouldn't + V + [其他信息]~WMnt
G05.4
如果我昨天早点出门，就不会迟到了。~If I had left earlier yesterday, I wouldn't have been late.~过去已经结束，设想另一个结果。~条件用 had + V3，结果用 wouldn't have + V3。~If [主语] + had + V3 + [过去时间], [主语] + wouldn't have + V3~ECnn
要不是你提醒我，我就错过截止日期了。~If you hadn't reminded me, I would have missed the deadline.~取消过去的帮助，想象后果。~否定过去条件用 hadn't，结果用 would have。~If [主语] + hadn't + V3 + [对象], [主语] + would have + V3 + [对象]~WMnf
如果我们提前订票，原本可以省些钱。~If we had booked in advance, we could have saved some money.~过去没实现的是一种可能收益。~could have 表原本可能做到，不必加强成必然。~If [主语] + had + V3 + [方式], [主语] + could have + V3 + [对象]~TCnn
G05.5
如果我当初接受了那份工作，现在就住在北京了。~If I had accepted that job, I would be living in Beijing now.~过去选择对应现在状态。~过去条件用 had V3，现在结果用 would be V-ing。~If [主语] + had + V3 + [对象], [主语] + would be + V-ing + [地点] + now~SCnn
如果我会法语，昨天就能帮你翻译那封信了。~If I knew French, I could have helped you translate that letter yesterday.~现在持续的能力对应过去结果。~状态条件用过去形式，过去结果用 could have。~If [主语] + [过去形式状态], [主语] + could have + V3 + [过去动作]~WCnn
如果他昨晚休息好了，现在就不会这么累。~If he had rested well last night, he wouldn't be so tired now.~昨晚原因与当前结果相连。~条件用过去完成时，当前状态用 wouldn't be。~If [主语] + had + V3 + [过去时间], [主语] + wouldn't be + [状态] + now~SCnn
G05.6
我希望自己现在有更多耐心。~I wish I had more patience.~愿望与当前状态不同。~wish 后用过去形式表达现在。~[主语] + wish + [主语] + had + [期望资源]~SCnn
真希望我能参加明天的聚会。~I wish I could come to tomorrow's party.~希望改变当前受限的能力。~wish 后用 could，不是过去参加。~[主语] + wish + [主语] + could + V + [未来活动]~SMcf
我希望办公室安静一点，这样就能专心工作了。~I wish the office were quieter so that I could concentrate on my work.~现在环境和期望结果不同。~wish 后用 were，假想能力用 could。~[主语] + wish + [场所] + were + [比较级] + so that [主语] + could + V~WMnn
G05.7
真希望我昨天没说那句话。~I wish I hadn't said that yesterday.~想改变已经发生的话。~过去遗憾用 wish + had not + V3。~[主语] + wish + [主语] + hadn't + V3 + [对象/过去时间]~SCnp
早知道就提前备份文件了。~If only I had backed up the files in advance.~遗憾的是过去没有做的动作。~if only 后用过去完成时。~If only [主语] + had + V3 + [对象] + [方式]~WCnp
我希望当时听了你的建议，那样就不会损失这么多钱。~I wish I had taken your advice; then I wouldn't have lost so much money.~过去遗憾还带着假想后果。~wish 后用 had V3，后果用 wouldn't have。~[主语] + wish + [过去完成时]; then [主语] + wouldn't have + V3 + [数量及对象]~SCnp
G06.1
这座桥是十年前建成的。~This bridge was built ten years ago.~重点是桥，而非谁建造。~过去被动用 was + V3。~[承受者] + was + V3 + [过去时间]~TRno
工程师昨天修好了电梯。~The engineer repaired the lift yesterday.~原句明确说谁完成动作。~保留主动主语，用过去时。~[执行者] + [动词过去式] + [对象] + [时间]~XRno
虽然道路已被封闭，救护车仍然获准通行。~Although the road has been closed, the ambulance is still allowed through.~两个承受者有不同状态。~已完成的封闭用完成时被动，许可用 be allowed。~Although [对象] + has been + V3, [对象] + is still + V3 + [补充]~TRno
G06.2
我的钱包昨晚被偷了。~My wallet was stolen last night.~不知道执行者，不必编造。~过去被动可不加 by。~[承受者] + was + V3 + [过去时间]~TCno
会议已取消，原因稍后公布。~The meeting has been cancelled; the reason will be announced later.~两项信息都不需要说执行者。~完成时被动与将来被动分别表达时间。~[对象] + has been + V3; [对象] + will be + V3 + later~WEno
收到付款后，收据会自动发出。~Once payment is received, a receipt will be sent automatically.~处理流程强调结果而非人物。~条件与结果都可省略被动执行者。~Once [对象] + is + V3, [对象] + will be + V3 + [方式]~XNfo
G06.3
这些文件必须妥善保存。~These documents must be stored safely.~文件受到保存要求。~情态被动用 must be + V3。~[承受者] + must be + V3 + [方式]~WNfd
这张票不能转让。~This ticket cannot be transferred.~票受到明确限制。~否定情态被动用 cannot be + V3。~[承受者] + cannot be + V3~TNfd
如果包装完好，商品可以在七天内退回。~If the packaging is intact, the goods can be returned within seven days.~许可有状态和时间限制。~结果用 can be V3，within 标期限内。~If [状态条件], [承受者] + can be + V3 + within [期限]~XNfd
G06.4
据说这位作家住在附近。~The writer is said to live nearby.~转述的是目前的情况。~is said to 后用原形表达同时状态。~[主语] + is said to + V + [地点]~SRno
据说这位作家去年搬到了这里。~The writer is said to have moved here last year.~报道发生在现在，搬家更早。~早于报道的动作可用 to have V3。~[主语] + is said to have + V3 + [地点/过去时间]~SRno
人们认为这项改革会降低成本，但尚无数据证实。~It is thought that this reform will reduce costs, but no data has confirmed this yet.~转述判断，保留证据不足。~it is thought that 后接完整陈述。~It is thought that [判断], but [证据不足的陈述]~WRfn
G06.5
我昨天请人修了自行车。~I had my bicycle repaired yesterday.~主语安排别人修，不是亲自修。~have + 对象 + V3，用过去式 had。~[主语] + had + [对象] + V3 + [过去时间]~ECno
她正在找人安装新的窗户。~She's getting new windows installed.~安装由别人完成，目前在进行。~get 的进行时后接对象和过去分词。~[主语] + be getting + [对象] + V3~ECno
出发前，我们需要请人检查汽车。~We need to have the car checked before we leave.~安排检查发生在出发之前。~need to have 后接对象和 V3。~[主语] + need to have + [对象] + V3 + before [陈述]~TCnd
G06.6
老师让我们重写作文。~The teacher made us rewrite the essay.~动作是被要求完成的。~主动 make 后用宾语 + 原形。~[主语] + made + [人] + V + [对象]~WCnd
父母允许我周末外出。~My parents let me go out at weekends.~这是允许，不是强迫。~let 后用宾语 + 原形，不加 to。~[主语] + let + [人] + V + [时间]~SCnf
我终于说服他在会议前检查数据。~I finally got him to check the data before the meeting.~促成对方行动，且有时间要求。~get someone to do 与 make someone do 不同。~[主语] + finally got + [人] + to V + [对象] + before [时间]~WCno
G07.1
我想喝茶，而她想喝咖啡。~I want tea, but she wants coffee.~两个偏好形成对照。~but 连接两个完整分句。~[主语] + [谓语及宾语], but [主语] + [谓语及宾语]~SCcf
你可以今天提交，也可以明天提交。~You can submit it today or tomorrow.~这是两种可选择的时间。~or 可以连接时间短语，不必重复分句。~[主语] + can + V + [对象] + [时间A] + or [时间B]~WCnd
我检查了文件并发给了客户，但忘了附件。~I checked the document and sent it to the client, but forgot the attachment.~动作有顺序，最后有转折。~同一主语可共用，and 与 but 表不同关系。~[主语] + [过去动作A] + and [过去动作B], but [过去动作C]~WRno
G07.2
站在门口的那个人是我的老师。~The person who is standing at the door is my teacher.~门口的信息确定是哪一个人。~who 作关系从句主语，不重复 he。~The [人] + who [识别分句] + is [身份]~SCno
这是我昨天买的书。~This is the book that I bought yesterday.~后面的动作限定是哪一本书。~that 作宾语，也可以省略。~This is the [物] + (that) [主语] + [过去式] + [时间]~ECno
我们需要一位能用英语解释结果的同事。~We need a colleague who can explain the results in English.~要求限定合适的人选。~关系从句中 who 后直接接 can。~[主语] + need + [人] + who can + V + [对象/方式]~WMno
G07.3
我姐姐住在上海，她是一名医生。（补充居住地点）~My sister, who lives in Shanghai, is a doctor.~姐姐已明确，地点是附加信息。~补充关系从句用逗号和 who。~[明确的人], who [补充陈述], [主句谓语]~SCno
这座博物馆建于1920年，目前正在修缮。（补充建造年份）~The museum, which was built in 1920, is being renovated.~年份不用于区分哪座博物馆。~非限制性从句用 which，不用 that。~[明确的物], which was + V3 + [时间], [现在状态]~TRno
李女士负责预算，她今天无法参加会议。（补充职责）~Ms Li, who is responsible for the budget, cannot attend the meeting today.~人物职责是补充，缺席是主要消息。~逗号隔开的 who 从句补充职责。~[人名], who is responsible for [事项], cannot + V + [活动/时间]~WEfo
G07.4
我知道她已经回家了。~I know that she has gone home.~知道的内容是一个完整事实。~that 引出宾语从句。~[主语] + know that + [完整陈述]~SCno
我们还没决定是否继续这个项目。~We haven't decided whether to continue this project.~未决定的是是非选择。~whether to 后接原形表达选择。~[主语] + haven't decided + whether to V + [对象]~WRnn
他建议我们在发布前再测试一次。~He suggested that we test it again before release.~转述建议，不是已完成的事实。~suggest that 后可用主语 + 原形表达建议。~[主语] + suggested that + [主语] + V + [其他信息]~WMnt
G07.5
吃饭前请洗手。~Please wash your hands before you eat.~动作顺序很明确。~before 后接完整现在时分句。~Please + V + [对象] + before [主语] + V~ENnd
当我到家时，大家正在吃晚饭。~When I got home, everyone was having dinner.~短动作发生在持续动作中。~when 从句用过去时，背景用过去进行时。~When [过去事件], [主语] + was + V-ing~SCno
等你收到消息后，我们再开始。~We'll start after you receive the message.~未来行动等条件时间满足。~时间从句用现在时，不因将来加 will。~[主语] + will + V + after [主语] + V + [对象]~WMnd
G07.6
因为下雨，我们留在了家里。~We stayed at home because it was raining.~给出已经发生的原因。~because 后接分句。~[结果过去时] + because [原因分句]~ECno
由于大雨，比赛取消了。~The match was cancelled because of the heavy rain.~原因是一个名词短语。~because of 后不直接接完整分句。~[结果] + because of [原因名词短语]~SRno
由于我还没收到数据，目前无法完成报告。~Because I haven't received the data yet, I can't finish the report at present.~过去未完成导致当前限制。~原因用完成时否定，结果用 can't。~Because [主语] + haven't + V3 + yet, [当前结果]~WEfo
G07.7
我去超市买牛奶。~I went to the supermarket to buy some milk.~去超市是为了什么？~同一执行者的目的可用 to V。~[主语] + [过去动作] + to V + [对象]~ECno
请小声一点，让孩子能睡觉。~Please keep your voice down so that the child can sleep.~目的动作由另一个人完成。~so that 后接不同主语和 can。~Please + [行动] + so that [主语] + can + V~ECnt
为了避免错过转机，我们订了较早的航班。~We booked an earlier flight in order to avoid missing the connection.~选择航班是为了避免后果。~in order to avoid 后可接 V-ing。~[主语] + [过去动作] + in order to avoid + V-ing [对象]~TRno
G07.8
她太累了，走不动了。~She was so tired that she couldn't walk any further.~程度造成了结果。~so 修饰形容词，that 后接结果。~[主语] + was so + [形容词] + that [结果]~ECno
那是一场非常有趣的讲座，大家都忘了时间。~It was such an interesting lecture that everyone lost track of time.~程度修饰的是带名词的短语。~such a/an + 形容词 + 单数名词。~It was such an + [形容词] + [名词] + that [结果]~WRno
交通堵得太严重，我们不得不步行去车站。~The traffic was so heavy that we had to walk to the station.~结果是过去的必要行动。~so + 形容词，结果用 had to。~[原因主语] + was so + [形容词] + that [主语] + had to + V~TCno
G07.9
虽然很累，她还是完成了作业。~Although she was tired, she finished her homework.~结果与通常预期不同。~although 连接分句，不再加 but。~Although [状态分句], [结果分句]~WCno
尽管下着大雨，他们仍然出发了。~Despite the heavy rain, they still set off.~让步原因可以用名词表达。~despite 后接名词，不直接接分句。~Despite [名词短语], [主语] + still + [过去式]~TCno
虽然方案并不完美，但它足够实用。~Although the plan isn't perfect, it is practical enough.~承认不足，同时作出肯定评价。~although 后接分句，enough 放在形容词后。~Although [不足], [主语] + be + [形容词] + enough~WMnt
G07.10
你越早出发，就越快到达。~The earlier you leave, the sooner you arrive.~两个程度同步变化。~用 the + 比较级重复结构。~The [比较级] + [分句], the [比较级] + [分句]~ECno
她跑得比我想象的快。~She runs faster than I expected.~比较对象是一种预期。~than 后接完整过去时分句。~[主语] + V + [比较级] + than [主语] + [过去式]~SCno
无论你计划得多仔细，都可能出现变化。~However carefully you plan, changes may occur.~程度不能排除结果。~however + 副词 + 主语谓语表达不论程度。~However [副词] + [主语] + V, [主语] + may + V~WRnn
G07.11
请按我示范的方式做。~Please do it as I showed you.~动作方式来自示范。~as 引出方式分句。~Please + V + [对象] + as [主语] + [过去式]~WNnd
她看着我，好像认识我一样。~She looked at me as if she knew me.~描述似乎存在的状态。~as if 后可用过去形式表示假想。~[主语] + [过去动作] + as if [主语] + [过去形式状态]~SCnn
请按照说明上的要求填写表格。~Please fill in the form as the instructions require.~方式是已明确的要求。~as 后保留要求的主语和谓语。~Please + [行动] + as [要求来源] + [谓语]~XNfd
G07.12
门口等候的人都是来参加面试的。~The people waiting at the door are all here for interviews.~后面的信息修饰人。~主动进行的修饰可用 V-ing。~The [复数名词] + V-ing [地点] + are [说明]~WRno
昨天发送的文件包含新价格。~The document sent yesterday contains the new prices.~文件承受发送动作。~被动修饰用过去分词，不用 sending。~The [名词] + V3 [时间] + [主句谓语]~WEfo
她是第一个完成测试的人。~She was the first person to finish the test.~顺序词限定后面的动作。~the first 后可用 to-infinitive 修饰名词。~[主语] + was the first [名词] + to V + [对象]~WRno
G07.13
走进房间时，我注意到窗户开着。~Entering the room, I noticed that the window was open.~进入和注意到由同一人完成。~句首 V-ing 的隐含主语须对应主句主语。~V-ing [对象/地点], [同一主语] + [过去式] + [内容]~ECno
由于担心延误，她提前两小时出发。~Worried about delays, she left two hours early.~担心的是人，不是出发动作。~状态分词短语的主语与主句一致。~Worried about [事项], [同一主语] + [过去式] + [时间]~TCno
完成所有检查后，团队提交了报告。~Having completed all the checks, the team submitted the report.~检查先完成，提交发生在后。~having V3 表先完成，两动作主语一致。~Having + V3 + [对象], [同一主语] + [过去式] + [对象]~WRfo
G08.1
我决定明天开始锻炼。~I decided to start exercising tomorrow.~决定后面是打算做的动作。~decide 后接 to-infinitive。~[主语] + decided to + V + [未来时间]~ECno
她答应不再迟到。~She promised not to be late again.~否定的是所承诺的动作。~not 放在 to 前，promise 后不用 V-ing。~[主语] + promised not to + V + [其他信息]~SCnf
我们希望在月底前完成项目。~We hope to finish the project by the end of the month.~希望对应目标和截止时间。~hope 后接 to V，by 表截止。~[主语] + hope to + V + [对象] + by [截止时间]~WRnn
G08.2
我喜欢在周末做饭。~I enjoy cooking at weekends.~享受的是一种活动。~enjoy 后接 V-ing。~[主语] + enjoy + V-ing + [时间]~ECcf
请避免在会议中查看手机。~Please avoid checking your phone during the meeting.~要避免的是一个动作。~avoid 后接 V-ing，不用 to V。~Please + avoid + V-ing + [对象/时间]~WNnd
她建议我们先核对数据再讨论。~She suggested checking the data before discussing it.~建议的内容是一组有顺序的动作。~suggest 后可用 V-ing，before 后也用 V-ing。~[主语] + suggested + V-ing [对象] + before V-ing [对象]~WMnt
G08.3
老师要求我们安静地阅读。~The teacher asked us to read quietly.~动作由被要求的人完成。~ask someone to do；动作前保留人。~[主语] + asked + [人] + to V + [方式]~WCnd
父母不允许我独自旅行。~My parents don't allow me to travel alone.~否定的是允许关系。~allow + 人 + to V；don't 否定主句。~[主语] + don't allow + [人] + to V + [方式]~SCnd
经理提醒我在离开前锁门。~The manager reminded me to lock the door before leaving.~提醒针对某人的待办动作。~remind someone to do，不用 remind doing。~[主语] + reminded + [人] + to V + [对象] + before V-ing~WCnd
G08.4
我们正在等公交车。~We're waiting for the bus.~动作指向等待的对象。~wait for 是动词和介词的搭配。~[主语] + be waiting for + [对象]~TCno
她向我道歉，因为她忘了约会。~She apologised to me for forgetting our appointment.~道歉对象和原因要分开。~apologise to 人，for 后接 V-ing。~[主语] + apologised to [人] + for V-ing [事项]~SCnp
这个结果取决于你投入多少时间。~The result depends on how much time you put in.~依赖关系后面是嵌入的数量问题。~depend on 后可接 how much 引导的陈述语序。~[主语] + depends on + how much [名词] + [主语谓语]~WRno
G08.5
他停下来喝了点水。~He stopped to drink some water.~停止原来的活动，是为了喝水。~stop to V 表停下来做另一件事。~[主语] + stopped to + V + [对象]~ECno
他已经不再喝含糖饮料了。~He has stopped drinking sugary drinks.~停止的是饮用这件事本身。~stop V-ing 表不再做该动作。~[主语] + has stopped + V-ing + [对象]~ECno
我记得锁过门，但还是回去检查了一下。~I remembered locking the door, but went back to check anyway.~记得的是已发生的动作。~remember V-ing 表回忆；不是提醒自己待办。~[主语] + remembered + V-ing [对象], but [过去动作]~ECno
G09.1
我买了一把伞，那把伞很轻。~I bought an umbrella. The umbrella is very light.~首次引入和再次指称不同。~元音音素前用 an，再次指称用 the。~[主语] + [过去式] + an [名词]; The [同一名词] + [状态]~ECno
她是一名工程师，在一家医院工作。~She is an engineer and works at a hospital.~职业和未特指的机构都需处理冠词。~单数职业用不定冠词，按发音选 a/an。~[主语] + is an [职业] + and [谓语] + at a [机构]~SCno
知识很重要，但这份报告中的信息不够准确。~Knowledge is important, but the information in this report isn't accurate enough.~泛指抽象概念与限定信息不同。~泛指不可数名词通常零冠词，明确限定可用 the。~[抽象名词] + [评价], but the [限定名词] + [评价]~WRno
G09.2
你能给我一些建议吗？~Could you give me some advice?~数量并未指定到一条。~advice 不可数，用 some，不加复数 s。~Could you give [人] + some [不可数名词]?~SCnt
她给了我三条有用的建议。~She gave me three useful pieces of advice.~中文的条需要英语中的计量表达。~pieces of advice 表可数单位。~[主语] + gave [人] + [数量] + [形容词] + pieces of advice~WCnf
我们需要更多信息，而不是更多表格。~We need more information, not more forms.~两个宾语的可数性不同。~information 不加 s，form 可变复数。~[主语] + need more [不可数名词], not more [复数名词]~WMnd
G09.3
桌上有两本书。~There are two books on the table.~明确是两个对象。~数词后用复数，存在句用 are。~There are + [数量] + [复数名词] + [地点]~ECno
每个孩子都有一个书包。~Every child has a schoolbag.~每一个按单数处理。~every 后用单数，谓语用 has。~Every [单数名词] + has + [单数对象]~WCno
这些箱子比那个箱子重。~These boxes are heavier than that box.~两边的数量不同。~these 配复数，that 配单数。~These [复数名词] + are + [比较级] + than that [单数名词]~ECno
G09.4
这份文件是新的，那份是旧的。~This document is new; that one is old.~近指和远指需要区分。~this 与 that 对应单数名词。~This [名词] + is [状态]; that one + is [状态]~WCno
你可以选这两个座位中的任何一个。~You can choose either of these two seats.~选择范围限定为两个。~either of + 复数集合，表示任一。~[主语] + can + V + either of [两个对象]~TXnd
并非每份申请都需要同样的材料。~Not every application requires the same documents.~限定词还影响否定范围。~not every 配单数名词及单数谓语。~Not every [单数名词] + V-s + the same [复数对象]~XNfo
G09.5
我有几个朋友住在附近。~I have a few friends living nearby.~数量虽少，但确实有一些。~a few 配可数复数，带肯定意味。~[主语] + have a few + [复数名词] + [修饰信息]~SCnf
剩下的时间很少，我们得快点。~There's little time left; we need to hurry.~数量不足的意味要保留。~little 配不可数名词，与 a little 不同。~There's little + [不可数名词] + left; [必要行动]~TCnd
虽然参与者不多，但我们收到了一些有用的反馈。~Although there were few participants, we received a little useful feedback.~前半说不足，后半说仍有收获。~few 配复数，a little 配不可数反馈。~Although there were few [人], [主语] + received a little [反馈]~WRno
G09.6
这是我哥哥的自行车。~This is my brother's bicycle.~说明谁拥有物品。~单数人的所有格用 's。~This is + [所有者]'s + [物品]~ECno
老师们的办公室在二楼。~The teachers' office is on the second floor.~所有者不止一位。~以 s 结尾的复数所有格在 s 后加撇号。~The [复数所有者]' + [地点名词] + is [位置]~WCno
我忘了带自己的钥匙，所以借了她的。~I forgot my keys, so I borrowed hers.~前面带名词，后面不重复名词。~my 是限定词，hers 是独立物主代词。~[主语] + [过去动作] + my [物品], so [主语] + [过去动作] + hers~SCno
G09.7
丽娜找到了钥匙，并把它们放进包里。~Lina found the keys and put them in her bag.~代词所指的物品是复数。~用 them 回指 keys。~[人名] + [过去动作] + [复数对象] + and [过去动作] + them + [地点]~ECno
小王告诉小李，小王自己会完成报告。~Wang told Li that Wang himself would finish the report.~两个人都可能是他，需要消除歧义。~必要时重复人名，himself 强调同一人。~[人A] + told [人B] + that [人A] himself + would + V + [对象]~WMno
这些说明很清楚，但它们没有回答我的问题。~These instructions are clear, but they don't answer my question.~同一组说明贯穿两个分句。~复数名词用 they 回指。~These [复数名词] + are [评价], but they + don't + V + [对象]~XEft
G10.1
她说话很轻。~She speaks quietly.~描述的是说话方式。~修饰动词用副词。~[主语] + V-s + [方式副词]~SCno
这位司机很小心，开车也很小心。~The driver is careful and drives carefully.~人的性质与动作方式不同。~be 后用形容词，drive 后用副词。~[主语] + is [形容词] + and V-s [副词]~TRno
请仔细阅读，这些信息很重要。~Please read carefully; this information is important.~要求动作方式，同时评价信息。~carefully 修饰 read，important 作表语。~Please + V + [副词]; [对象] + is [形容词]~WNnd
G10.2
我通常在午饭后散步。~I usually take a walk after lunch.~频率修饰整个日常动作。~频率副词通常放在实义动词前。~[主语] + usually + V + [其他信息]~ECno
只有她同意这个方案。~Only she agrees with this plan.~限制的是谁，不是同意的对象。~only 紧邻被限定的主语。~Only + [主语] + V-s + [对象]~WMnd
她只在周末查看工作邮件。~She checks work emails only at weekends.~限制的是时间，不是邮件种类。~only 放在时间短语前，避免改成主语范围。~[主语] + V-s + [对象] + only [时间短语]~WCnd
G10.3
这箱子太重了，我搬不动。~The box is too heavy for me to lift.~程度超出行动能力。~too + 形容词 + for 人 + to V。~[主语] + is too [形容词] + for [人] + to V~ECno
房间很小，但够我们两个人住。~The room is small, but big enough for the two of us to stay in.~小不等于不够用。~enough 放在形容词后。~[状态], but [形容词] + enough for [人] + to V + [必要介词]~TXno
如果水不够热，请再等一会儿。~If the water isn't hot enough, please wait a little longer.~条件检查是否达到程度。~否定 be + 形容词 + enough。~If [主语] + isn't [形容词] + enough, please [动作]~XNnd
G10.4
这条路比那条路短。~This route is shorter than that one.~比较两个对象。~比较级后用 than。~[对象A] + is [比较级] + than [对象B]~TCno
这是这家店最便宜的手机。~This is the cheapest phone in the shop.~在一组对象中比较。~最高级通常用 the，范围用 in。~This is the [最高级] + [名词] + in [范围]~XCnt
新方案比旧方案更可靠，但也更贵。~The new plan is more reliable than the old one, but also more expensive.~两个比较维度同时存在。~长形容词用 more，保持比较结构一致。~[对象A] + is more [形容词A] + than [对象B], but also more [形容词B]~WMno
G10.5
她和哥哥一样高。~She is as tall as her brother.~两者程度相等。~as + 形容词原级 + as。~[主语] + is as [形容词] + as [比较对象]~SCno
今天没有昨天那么冷。~Today isn't as cold as yesterday.~否定相等，表达程度较低。~not as + 原级 + as。~[主语] + isn't as [形容词] + as [比较对象]~ECno
这个方法和原来的方法一样有效，但更容易操作。~This method is as effective as the original one, but easier to use.~一方面相等，另一方面不同。~相等用 as...as，另一点可用比较级。~[对象] + is as [形容词] + as [对象], but [比较级] + to V~WRno
G10.6
我对这个故事很感兴趣。~I'm interested in this story.~兴趣是人的感受。~人的感受用 interested in。~[体验者] + be interested in + [事物]~SCnf
这场讲座很无聊，我听得很厌烦。~The lecture was boring, and I felt bored.~事物引起感受，人与事物角色不同。~boring 描述讲座，bored 描述感受。~[事物] + was [V-ing形容词], and [人] + felt [V3形容词]~WCno
虽然结果令人失望，但团队并不气馁。~Although the result was disappointing, the team wasn't discouraged.~引发的感受与实际感受不同。~结果用 disappointing，团队用 discouraged。~Although [事物] + was [V-ing形容词], [人] + wasn't [V3形容词]~WRno
G11.1
请在周五之前把文件发给我。~Please send me the document by Friday.~这是完成动作的截止时间。~by 标最迟完成的时间。~Please + [行动] + by [截止时间]~WEfd
我会在这里待到周五。~I'll stay here until Friday.~状态持续到某个时间。~until 表持续终点，与 by 不同。~[主语] + will + V + [地点] + until [终点]~TCno
虽然路上堵车，我们还是及时赶上了航班。~Although the traffic was heavy, we arrived in time to catch the flight.~赶得上事件，不只是符合时刻表。~in time to V 表来得及做；on time 表准时。~Although [困难], [主语] + [过去式] + in time to V + [对象]~TCno
G11.2
钥匙在抽屉里。~The keys are in the drawer.~物品位于容器内部。~内部位置用 in。~[物品] + are in [容器]~ECno
照片挂在墙上。~The photo is on the wall.~物品接触一个表面。~墙面位置用 on。~[物品] + is on [表面]~ECno
我们在车站入口等你。~We'll wait for you at the station entrance.~把入口视作具体会合点。~会合点用 at。~[主语] + will wait for [人] + at [会合点]~TMnf
G11.3
她走进了房间。~She walked into the room.~动作从外面到里面。~方向变化用 into，不是静态 in。~[主语] + [过去式] + into [地点]~ECno
他跑过了马路。~He ran across the road.~从一边到另一边。~跨越表面用 across。~[主语] + [过去式] + across [表面]~TCno
出了车站后，沿着河走到桥边。~After leaving the station, walk along the river to the bridge.~路径和终点都要保留。~along 表沿线，to 表终点。~After V-ing [地点], V + along [路径] + to [终点]~TNnd
G11.4
我学英语已经三年了。~I've studied English for three years.~给出的是一段时长。~for 后接时长，可配现在完成时。~[主语] + have/has + V3 + [对象] + for [时长]~WCno
自从去年九月起，她一直住在这里。~She's lived here since last September.~给出的是开始时间。~since 后接时间起点。~[主语] + have/has + V3 + [地点] + since [起点]~ECno
会议期间，请把手机调成静音。~Please silence your phone during the meeting.~动作要求适用于某一事件期间。~during 后接事件名词，不是时长数量。~Please + [行动] + during [事件]~WNnd
G11.5
我每天骑自行车上学。~I go to school by bike every day.~说的是交通方式。~by + 交通工具一般不加冠词。~[主语] + V + [目的地] + by [交通工具] + [频率]~WCno
请用这把钥匙打开门。~Please open the door with this key.~这里给出的是具体工具。~with 引出具体工具，不能直接换成 by。~Please + V + [对象] + with [工具]~ECnd
我们步行去了车站，然后坐火车到市中心。~We went to the station on foot, then travelled to the city centre by train.~两种方式用不同搭配。~步行用 on foot，火车用 by train。~[主语] + [过去动作] + on foot, then [过去动作] + by [交通工具]~TCno
G11.6
她对自己的成绩很满意。~She is pleased with her results.~形容词需要合适的介词对象。~pleased with 表满意。~[主语] + be pleased with + [对象]~WCnf
我担心明天的面试，但也很期待它。~I'm worried about tomorrow's interview, but I'm also looking forward to it.~两个态度词各有搭配。~worried about；look forward to 后接名词或代词。~[主语] + be worried about [事项], but [主语] + be looking forward to [事项]~WCnn
你负责核对数据，而我负责写报告。~You're responsible for checking the data, while I'm responsible for writing the report.~职责分配给不同的人。~responsible for 后接 V-ing。~[人A] + be responsible for V-ing [对象], while [人B] + be responsible for V-ing [对象]~WMnd
G12.1
我们已经确定了日期，尚未确定的是地点。（重点是地点）~We've agreed on the date; what remains undecided is the venue.~前面是已知内容，句末给出新重点。~可用 what 从句作主语，把地点放在后面。~[已知信息]; what remains [状态] + is [新重点]~WMno
问题不在预算，而在时间安排。（重点是时间安排）~The problem isn't the budget; it's the schedule.~两项对比中哪一项是要说明的问题？~先排除已知猜测，再把新的重点留在句末。~The problem isn't [排除项]; it's [新重点]~WMnd
报告已经写完了，我们现在需要的是你的反馈。（重点是反馈）~The report is finished; what we need now is your feedback.~先交代进展，再提供新的需求。~what we need now 作已知框架，后面放需求。~[进展]; what [主语] + need now + is [新信息]~WEft
G12.2
这本书我读过，那本还没读。（把两本书作为对比话题）~This book, I've read; that one, I haven't read yet.~两个对象要各自作为话题出现。~宾语可前置，主语和谓语不用倒装。~[对象A], [主语] + have + V3; [对象B], [主语] + haven't + V3 + yet~SCnd
价格我们可以再谈，但质量不能妥协。（以价格和质量为对比话题）~The price, we can discuss further; quality, we cannot compromise on.~把可谈和不可让步的对象先说。~对象前置后保留动词所需介词。~[对象A], [主语] + can + V; [对象B], [主语] + cannot + V + [所需介词]~WMfd
至于昨天那份提案，我会在看完数据后回复。（以提案为话题）~As for yesterday's proposal, I'll respond after reviewing the data.~先提出话题，再说明后续动作。~as for 引出话题，after 可接 V-ing。~As for [话题], [主语] + will + V + after V-ing [对象]~WEfo
G12.3
是小李修好了电脑，不是我。（强调执行者）~It was Li who fixed the computer, not me.~纠正的是谁做了这件事。~it was...who 强调执行者。~It was [执行者] + who [其余动作], not [排除的人]~WCnd
让我担心的是时间安排，而不是费用。（强调担心的对象）~What worries me is the schedule, not the cost.~强调引起担心的具体事项。~what 从句作主语，is 后接重点。~What [谓语] + [人] + is [重点], not [排除项]~WMnn
直到收到确认邮件，我才取消了旧预订。（强调时间界限）~It wasn't until I received the confirmation email that I cancelled the old booking.~行动在该时间之前没有发生。~it wasn't until...that 强调时间，不要省略否定。~It wasn't until [时间分句] + that [主句动作]~TXno
G12.4
她既会唱歌，也会弹钢琴。~She can both sing and play the piano.~两个能力需要平行表达。~both 与 and 后接对应的动词结构。~[主语] + can both + V + and V + [对象]~SCnf
我们可以今天讨论，也可以明天讨论。~We can discuss it either today or tomorrow.~两个可选时间承担相同作用。~either...or 连接平行的时间表达。~[主语] + can + V + [对象] + either [时间A] + or [时间B]~WMno
新流程不仅节省时间，也减少错误。~The new process not only saves time but also reduces errors.~两个好处都用动作表示。~not only...but also 后保持动词结构平行。~[主语] + not only V-s [对象A] + but also V-s [对象B]~WRna
G12.5
我喜欢这本书，她也喜欢。~I like this book, and she does too.~后一分句重复相同的喜好。~一般现在时用 does 代替谓语。~[第一分句], and [另一主语] + does too~SCnf
我没看到通知，他也没看到。~I didn't see the notice, and he didn't either.~两个人都是否定。~过去否定省略用 didn't either，不用 too。~[第一否定分句], and [另一主语] + didn't either~WCno
她已经提交了申请，但我还没有。~She has submitted the application, but I haven't yet.~已完成与尚未完成相对照。~完成时省略保留 have/has。~[主语] + has + V3 + [对象], but [另一主语] + haven't yet~WRno
G12.6
正在门外等候的顾客需要帮助。（简洁表达等候信息）~The customer waiting outside needs help.~修饰者和等候动作是主动关系。~可把 who is waiting 压缩成 waiting。~The [人] + V-ing [地点] + [主句谓语]~XRno
在昨天会议上提出的建议已被采纳。（简洁表达提出信息）~The suggestion raised at yesterday's meeting has been adopted.~建议承受提出动作。~可把 which was raised 压缩成 raised。~The [物] + V3 [时间/地点] + has been V3~WRfo
已经完成培训的员工可以使用设备。（明确表达完成条件）~Employees who have completed the training may use the equipment.~完成状态决定许可，不能仅表达正在培训。~用关系从句保留完成时，避免压缩丢失时间。~[人] + who have V3 [对象] + may V [设备]~WNfd
V01
我们这周取得了很大进步。~We've made great progress this week.~自然表达取得进步。~progress 常与 make 搭配，不用复数。~[主语] + have made + [程度形容词] + progress + [时间]~WRna
团队没能赶上截止日期。~The team failed to meet the deadline.~自然表达按期完成这个目标。~meet the deadline 是常见搭配。~[主语] + failed to meet + [截止目标]~WRno
如果你有顾虑，请在会议上提出来。~If you have concerns, please raise them at the meeting.~顾虑不是提高数值，需要表达提出。~raise a concern 表提出顾虑，代词要回指正确。~If [条件], please raise + [顾虑/代词] + [地点]~WMnt
V02
我们把会议推迟到下周了。~We've put off the meeting until next week.~改变的是举行时间。~put off 表推迟，可以接名词宾语。~[主语] + have put off + [事项] + until [时间]~WEfo
这个邀请我已经拒绝了。~I've already turned it down.~代词指的是前面已知的邀请。~turn down 的代词宾语放在两词中间。~[主语] + have already turned + [代词] + down~SMnd
如果周五前还没回复，请跟进这个请求。~If there's no reply by Friday, please follow up on the request.~跟进以未回复为条件。~follow up on 后接事项，不能漏 on。~If [条件], please follow up on + [事项]~WEfd
V03
我向姐姐借了她的自行车。~I borrowed my sister's bicycle from her.~物品是借入，不是借出。~borrow from 表借入来源。~[主语] + borrowed + [物品] + from [人]~SCno
她告诉我，她找到了一份新工作。~She told me she had found a new job.~告诉有听者，工作指职位。~tell 后接人；一个职位用 a job。~[主语] + told [人] + [主语] + had found a new job~SMnf
我今天工作很多，不能把电脑借给你。~I have a lot of work today, so I can't lend you my computer.~工作量与借出方向要区别。~work 不可数；lend 表借出，可接人和物。~[主语] + have a lot of work + [时间], so [主语] + can't lend [人] [物]~WCnd
V04
这次活动非常成功。~The event was very successful.~评价性质，需要形容词。~success 的形容词形式是 successful。~[活动] + was very + [形容词形式]~WRna
他们成功地解决了问题。~They solved the problem successfully.~修饰完成动作的方式。~修饰 solved 用 successfully。~[主语] + [过去式] + [对象] + [副词形式]~WRna
如果我们合作，就更有可能成功。~If we work together, we're more likely to succeed.~成功是将要做到的动作。~likely to 后用动词 succeed，不用名词 success。~If [条件], [主语] + be more likely to + [动词形式]~WMnf
V05
抱歉让你等了这么久，我刚刚才收到消息。~Sorry to keep you waiting so long; I've only just received the message.~道歉针对让人等待。~keep someone waiting 是常用表达。~Sorry to keep [人] + waiting [时长]; [解释]~SCnp
周四下午三点见面，你方便吗？~Would meeting at three on Thursday afternoon work for you?~自然核对安排是否合适。~work for someone 可表示安排合适。~Would + [安排的V-ing短语] + work for [人]?~WEft
谢谢你提醒我截止日期，真的帮了大忙。~Thanks for reminding me of the deadline; that really helped.~表达感谢及实际帮助。~thanks for 后接 V-ing，remind 人 of 事项。~Thanks for V-ing [人] of [事项]; [帮助评价]~SMcf
V06
我觉得用英语解释这件事很难。~I find it difficult to explain this in English.~英文可让体验者作主语。~find it + 形容词 + to V。~[体验者] + find it [评价] + to V + [对象/方式]~WCno
她很难集中注意力。~She has difficulty concentrating.~困难可以作为拥有的状态表达。~have difficulty 后接 V-ing，不用 to V。~[主语] + has difficulty + V-ing~WCno
这个箱子搬起来比我想的重。~This box is heavier to lift than I expected.~以物品作主语表达动作体验。~形容词后用 to V，比较预期用 than 从句。~[物品] + is [比较级] + to V + than [预期分句]~ECno
P01
你能把窗户关上吗？有点冷。~Could you close the window? It's a little cold.~这是请求，不是询问能力。~could you 可软化请求，保留原有原因。~Could you + V + [对象]? [原因]~SCnt
您介意把确认邮件再发一次吗？~Would you mind sending the confirmation email again?~礼貌请求对方重复动作。~would you mind 后接 V-ing。~Would you mind V-ing + [对象] + again?~XEft
如果方便，能请您在周三前给我反馈吗？~If it's convenient, could you give me feedback by Wednesday?~条件和截止时间都要保留。~if 引出便利条件，could you 发出请求。~If [方便条件], could you V + [必要内容] + by [时间]?~WEft
P02
谢谢邀请，但我今晚没法参加。~Thanks for inviting me, but I'm afraid I can't come tonight.~感谢之后明确拒绝。~I'm afraid 可引出委婉拒绝，不添加新理由。~[感谢], but I'm afraid [主语] + can't V + [时间]~SMct
很抱歉，今天来不及处理，但我明天可以看。~I'm sorry, I can't deal with it today, but I can look at it tomorrow.~限制明确，替代时间已有。~can't 与 can 对比，不额外承诺结果。~I'm sorry, [今天的拒绝], but [明天能做的事]~WEft
我们理解您的要求，但无法接受这个价格。~We understand your request, but we cannot accept this price.~尊重要求不等于接受条件。~先回应理解，再明确 cannot accept。~[理解回应], but [主语] + cannot accept + [条件]~XEft
P03
我理解你的想法，但我觉得这个办法风险太大。~I understand your idea, but I think this approach is too risky.~理解观点，同时保留不同判断。~understand 不等于 agree，用 but 转入判断。~[理解表达], but I think [不同判断]~WMnt
这个方案有优点，不过目前的预算恐怕不够。~The plan has merits, but I'm afraid the current budget isn't sufficient.~认可优点后提出实际限制。~认可和异议都要保留，I'm afraid 可缓和语气。~[真实认可], but I'm afraid [预算限制]~WMft
我不确定这些数据是否足以支持这个结论。~I'm not sure whether these data are sufficient to support this conclusion.~以证据不足表达谨慎异议。~not sure whether 后接陈述语序，不编造认同。~I'm not sure whether [证据] + be sufficient to V + [结论]~WRfn
P04
抱歉，我忘了把附件发给你。~I'm sorry I forgot to send you the attachment.~承认自己遗漏的动作。~I forgot 明确承担责任，不改成无主语被动。~I'm sorry [主语] + forgot to V + [对象]~WEfp
这次延误是我的责任，我会今天补交。~I take responsibility for the delay; I'll submit it later today.~责任和补救都已说明。~take responsibility for 后接事项，补救用 will。~I take responsibility for [事项]; [已有补救承诺]~WEfp
对于未及时告知变更，我向您道歉。~I apologise for not informing you of the change promptly.~道歉针对未及时完成的告知。~for 后用 not V-ing，inform 人 of 事项。~I apologise for not V-ing [人] of [事项] + [方式]~XEfp
P05
我不确定她今天是否有空。~I'm not sure whether she's available today.~把握不足，不能说成确定。~not sure whether 后接陈述语序。~I'm not sure whether [主语] + be [状态] + [时间]~SCnn
这个数字可能不准确，我们最好再核对一下。~This figure may be inaccurate; we'd better check it again.~怀疑与建议都要保留。~may 表可能，had better 后用原形。~[对象] + may be [评价]; [主语] + had better V [对象]~WMnn
从目前的信息来看，似乎还不能作出结论。~Based on the information available, it seems too early to draw a conclusion.~根据有限信息谨慎判断。~it seems + 评价保持不确定，不加强成绝对禁止。~Based on [信息], it seems [评价] + to V + [对象]~WRfn
P06
我可以帮你检查，但不能替你完成作业。~I can help you check it, but I can't do the homework for you.~帮助有明确边界。~can 与 can't 区分可做和不可做。~I can [帮助], but I can't [越界动作]~SCnd
只要提前一天通知，我就可以参加。~I can attend provided that you let me know a day in advance.~愿意参加，但有必要条件。~provided that 表明边界，不添加额外条件。~I can V + provided that [原有条件]~WEft
工作时间之外，我不会回复非紧急消息。~I won't reply to non-urgent messages outside working hours.~限制针对时间和消息类型。~won't 表意愿边界，保留 non-urgent 的范围。~I won't V + [受限对象] + outside [时间范围]~WEfd
P07
要我帮你提这个箱子吗？~Would you like me to carry this box for you?~主动提供帮助，不要求对方提箱子。~would you like me to 指向我的行动。~Would you like me to V + [对象] + for [人]?~TCnf
如果你需要，我可以把笔记发给你。~I can send you my notes if you need them.~提供帮助，以对方需要为条件。~I can 表供给，if 保留原有条件。~I can V + [人] + [对象] + if [需要条件]~SMnf
我可以先解释流程，再回答您的问题，您看这样合适吗？~I can explain the process first and then answer your questions. Would that work for you?~提出帮助顺序并核对合适与否。~offer 后接确认安排的问句，不增加承诺。~I can [动作A] + first and then [动作B]; Would that work for [人]?~XCft
`;

export { focuses as LANGUAGE_FOCUSES };

const situations = { E: "daily-life", S: "social-relationships", W: "work-study", X: "services-transactions", T: "travel-public-life" };
const genres = { C: "conversation-chat", E: "email-message", R: "report-explanation", N: "instruction-notice", X: "service-exchange" };
const styles = { c: "casual", n: "neutral", f: "formal" };
const tones = { f: "friendly-warm", t: "courteous-tactful", d: "direct-firm", n: "cautious-tentative", a: "confident-assertive", p: "apologetic-conciliatory", o: "detached-objective" };
const purposes = {
  inform: "inform-update", describe: "describe-narrate", explain: "explain-justify", ask: "ask-clarify",
  request: "request-instruct", advise: "suggest-advise", offer: "offer-invite-arrange",
  evaluate: "agree-disagree-evaluate", negotiate: "accept-refuse-negotiate", repair: "apologise-repair",
  thank: "thank-acknowledge", reflect: "predict-speculate-reflect",
};
function purposeFor(id) {
  if (id.startsWith("G02.")) return purposes.ask;
  if (id.startsWith("G05.") || ["G03.10", "G04.7", "G04.8", "P05"].includes(id)) return purposes.reflect;
  if (["G03.8", "G03.9", "G04.9", "P07"].includes(id)) return purposes.offer;
  if (["G04.6", "G08.2", "G08.3"].includes(id)) return purposes.advise;
  if (["P01", "G04.2", "G04.3", "G04.4", "G04.5", "G06.3"].includes(id)) return purposes.request;
  if (["P02", "P06"].includes(id)) return purposes.negotiate;
  if (id === "P03" || id.startsWith("G10.")) return purposes.evaluate;
  if (id === "P04") return purposes.repair;
  if (["G07.6", "G07.7", "G07.8", "V06"].includes(id)) return purposes.explain;
  if (id.startsWith("G03.") || id.startsWith("G06.") || id.startsWith("G12.") || id.startsWith("V")) return purposes.inform;
  return purposes.describe;
}
const purposeOverrides = {
  "G01.2-3": "request", "G01.4-2": "request", "G01.4-3": "request", "G01.5-3": "request",
  "G02.5-1": "inform", "G02.5-2": "inform", "G02.5-3": "inform",
  "G02.6-1": "describe", "G02.6-2": "inform", "G02.6-3": "request",
  "G01.7-3": "thank", "G07.4-3": "advise", "G07.5-1": "request",
  "G07.7-2": "request", "G07.11-1": "request", "G07.11-3": "request",
  "G08.2-1": "describe", "G08.2-2": "request", "G08.3-1": "request", "G08.3-2": "request", "G08.3-3": "request",
  "G09.2-1": "request", "G09.7-3": "evaluate", "G10.1-3": "request", "G10.3-3": "request",
  "G11.1-1": "request", "G11.3-3": "request", "G11.4-3": "request", "G11.5-2": "request",
  "V01-3": "request", "V02-3": "request", "V03-3": "negotiate", "V05-1": "repair", "V05-2": "offer", "V05-3": "thank",
};
function relationshipFor(id, version) {
  if (id.startsWith("G05.") || ["G04.2", "G04.4", "G04.5", "P06"].includes(id)) return "condition-exception";
  if (id.startsWith("G03.") || ["G07.5", "G11.1", "G11.4"].includes(id)) return "time-duration";
  if (id === "G07.6") return "cause-reason";
  if (id === "G07.7") return "purpose";
  if (id === "G07.8") return "result-consequence";
  if (["G07.9", "P03", "P02"].includes(id)) return "contrast-concession";
  if (id.startsWith("G10.") || id === "G07.10") return "comparison-degree";
  if (["G07.1", "G12.4"].includes(id) && version === 2) return "alternative-choice";
  if (["G07.1", "G12.4", "G12.5", "P07"].includes(id)) return "addition-sequence";
  return "elaboration-identification";
}
const relationships = {
  "G01.1-3": "time-duration", "G01.4-3": "time-duration", "G01.5-3": "purpose", "G01.6-3": "condition-exception",
  "G02.6-3": "condition-exception", "G04.1-3": "condition-exception", "G04.9-3": "condition-exception",
  "G06.1-3": "contrast-concession", "G06.2-3": "time-duration", "G06.3-3": "condition-exception",
  "G07.1-1": "contrast-concession", "G07.10-3": "contrast-concession", "G07.13-1": "time-duration",
  "G07.13-2": "cause-reason", "G07.13-3": "time-duration", "G08.2-3": "time-duration", "G08.3-3": "time-duration",
  "G08.5-1": "purpose", "G08.5-3": "contrast-concession", "G09.2-3": "contrast-concession",
  "G09.5-3": "contrast-concession", "G09.6-3": "result-consequence", "G09.7-3": "contrast-concession",
  "G10.6-1": "elaboration-identification", "G10.6-2": "addition-sequence", "G10.6-3": "contrast-concession",
  "G11.1-3": "contrast-concession", "G11.5-3": "addition-sequence", "G11.6-2": "contrast-concession",
  "G11.6-3": "contrast-concession", "G12.1-1": "contrast-concession", "G12.1-2": "contrast-concession",
  "G12.2-1": "contrast-concession", "G12.2-2": "contrast-concession", "G12.2-3": "time-duration",
  "G12.3-1": "contrast-concession", "G12.3-2": "contrast-concession", "G12.3-3": "time-duration",
  "G12.5-3": "contrast-concession", "G12.6-3": "condition-exception", "V01-3": "condition-exception",
  "V02-3": "condition-exception", "V03-3": "result-consequence", "V04-3": "condition-exception",
  "V05-3": "cause-reason", "V06-3": "comparison-degree", "P01-1": "cause-reason", "P01-3": "condition-exception",
  "P05-2": "result-consequence", "P07-2": "condition-exception",
};
// Review question demands individually; hint stage and authoring variant are not difficulty bands.
const difficultyOverrides = {
  "G04.7-1": "standard", "G04.7-3": "standard", "G04.8-1": "standard",
  "G01.1-3": "standard", "G01.2-3": "standard", "G01.3-3": "standard", "G01.6-3": "standard",
  "G02.1-3": "standard", "G02.2-2": "standard", "G02.2-3": "standard", "G02.3-3": "standard",
  "G02.6-3": "standard", "G03.1-2": "standard", "G03.1-3": "standard", "G03.3-3": "standard",
  "G04.1-3": "standard", "G04.2-3": "standard", "G04.5-3": "standard", "G04.6-3": "standard",
  "G05.1-2": "standard", "G05.1-3": "standard", "G07.1-3": "standard", "G07.5-2": "standard",
  "G07.5-3": "standard", "G07.6-3": "standard", "G08.1-3": "standard", "G08.2-3": "standard",
  "G09.3-3": "standard", "G09.6-3": "standard", "G10.1-3": "standard", "G10.3-3": "standard",
  "G10.4-3": "standard", "G10.5-3": "standard", "G11.3-3": "standard", "G07.10-3": "challenge",
};
const variants = ["clear-cue", "contrast", "transfer"];
const counts = new Map();
let focus;
export const LANGUAGE_PRACTICE_QUESTIONS = [];
for (const line of authored.trim().split("\n")) {
  if (/^(G\d{2}\.\d+|V\d{2}|P\d{2})$/.test(line)) {
    focus = focuses.find(item => item.id === line);
    if (!focus) throw new Error(`Unknown language focus: ${line}`);
    continue;
  }
  const fields = line.split("~");
  if (!focus || fields.length !== 6 || fields.some(field => !field.trim())) throw new Error(`Invalid authored question: ${line}`);
  const [prompt_zh, reference_answer, simple, intermediate, complete, code] = fields;
  const version = (counts.get(focus.id) || 0) + 1;
  counts.set(focus.id, version);
  const key = `${focus.id}-${version}`;
  const [situation, genre, style, tone] = code;
  const metadata = {
    situation: situations[situation],
    genre: genre === "M" ? (situation === "W" ? "meeting-contribution" : "email-message") : genres[genre],
    tone: tones[tone],
    purpose: purposes[purposeOverrides[key]] || purposeFor(focus.id),
    meaning_relationship: relationships[key] || relationshipFor(focus.id, version),
    register: style === "c" ? "informal" : styles[style],
  };
  if (code.length !== 4 || Object.values(metadata).some(value => !value) || !styles[style]) throw new Error(`Invalid categories: ${key}`);
  LANGUAGE_PRACTICE_QUESTIONS.push({
    id: `language-${key.toLowerCase()}`, prompt_zh, reference_answer,
    difficulty: difficultyOverrides[key] || focus.difficulty, style: styles[style],
    context: situation === "W" ? "work" : situation === "T" ? "travel" : "everyday",
    focus_id: focus.id, focus: focus.name, error_type: `${focus.id}: ${focus.name}`,
    variant: variants[version - 1], hints: { simple, intermediate, complete }, metadata,
    alternative_note: `Guided construction: ${intermediate} The pattern illustrates this focus; accept other natural translations that preserve meaning, scope, time and tone. Describe any difference in practising the focus without calling equivalent English incorrect.`,
  });
}
if (focuses.length !== 101 || focuses.some(item => counts.get(item.id) !== 3)) throw new Error("The language bank must cover 101 focuses with three questions each.");
if (new Set(LANGUAGE_PRACTICE_QUESTIONS.map(q => q.prompt_zh)).size !== 303) throw new Error("Language prompts must be unique.");
