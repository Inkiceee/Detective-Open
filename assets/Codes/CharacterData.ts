// 人物档案数据

export interface CharacterEvidence {
  id: string; // 证物编号，例如 A、B、C
  text: string; // 证物内容
}

export interface Character {
  id: string; // 角色ID (alex, ben, cathy, diana, elsa)
  name: string; // 显示名称
  nameEn: string; // 英文名（用于命令输入）
  role: string; // 身份
  motive: string; // 动机
  secret: string; // 秘密/隐藏信息
  description: string; // 档案描述
  testimony: string; // 证词
  evidence: CharacterEvidence[]; // 证物
  isUnlocked: boolean; // 是否已解锁
}

export interface InitialEvidence {
  title: string;
  content: string;
}

export interface CaseQuizOption {
  key: "A" | "B" | "C" | "D";
  text: string;
}

export interface CaseQuizBlank {
  id: number;
  options: CaseQuizOption[];
  answer: "A" | "B" | "C" | "D";
  answerText: string;
}

export interface AccuseEnding {
  id: number;
  title: string;
  isCancel?: boolean;
  isBestEnding?: boolean;
  isPartialEnding?: boolean;
  resultText: string;
}

// 初始案件背景
export const CaseBackground: string =
  "科技公司YKW创始人David被发现死在自己的办公室内，尸检结果为非自然死亡。正值新应用上市，公司决定一切调查低调进行，因此并未报警，而只请了一名退休法医进行简单尸检。玩家作为精通电脑技术的新时代侦探，被聘请调查这桩案子。需要注意的是：由于条件不够，许多微小剂量的药物难以检测。";

// 初始证物
export const InitialEvidenceList: InitialEvidence[] = [
  {
    title: "David的尸检报告",
    content:
      "死者姓名David，年龄42岁，男性。发现时间为当日12:40，尸检时间为当日13:00。尸体俯卧于办公桌面，面部压于左臂，尸僵轻度形成，体表无外伤。但右手食指、中指指尖有轻微擦伤，指甲内嵌有少量木质纤维，疑似桌面刮擦。死亡时间推断为上午10:00-10:30。",
  },
  {
    title: "基础毒理试纸检测",
    content:
      "酒精唾液试纸阳性，约0.04%，符合前夜饮酒。阿片类尿液试纸阴性。苯二氮䓬类尿液试纸阳性，但仅为筛查阳性，不能确认具体药物、剂量和摄入时间。氰化物和有机磷因无试剂未检测。受限于条件，仅能进行基础毒理试纸检测；微小剂量药物仍可能难以确认。",
  },
  {
    title: "胃内容物检查",
    content:
      "经口腔及咽部残留液体取样，获得少量疑似胃内容物，约5ml，外观为褐色液体。可闻到咖啡味与柑橘类气味。未见完整药片、胶囊或明显沉淀物，无蒜臭、杏仁味等毒物特征气味。报告出具人为Dr. Dollar。",
  },
];

// 人物数据
export const CharacterList: Character[] = [
  {
    id: "alex",
    name: "Alex",
    nameEn: "alex",
    role: "与YKW公司有版权纠纷的开发者",
    motive:
      "被David哄骗签下不公平合同，长期维权，希望取回原件合同并通过合法手段夺回技术权益。",
    secret:
      "案发当天与David发生激烈争吵，使David情绪激动、身体负担加重。但监控与随身物品检查均不支持其直接投药或杀人。",
    description:
      "Alex毕业于审臻大学计算机专业，现以自媒体维权为主。他认为YKW公司新应用的核心技术来自自己的毕设成果，案发当天9:20进入David办公室，与David争吵后于9:30愤怒离开。",
    testimony:
      "我毕业于审臻大学，对，就是那个以计算机专业闻名的，我就是冲着这个专业入学的，但现在主业应该算是自媒体（苦笑）。你既然是来调查我的，应该也看过我的维权视频，YKW公司新推出的产品核心技术就是我的毕设，David骗我签下的那份合同与技术带来的收益完全不对等！他也没考虑过后续的维护优化！只想赚快钱的家伙！\n\n我知道作为刚毕业的学生，和这么大的公司作对吃力不讨好。我就应该把这件事咽下去，吸取教训，再好好找份工作。但我就是不服！那份合同是有漏洞的，只要我能拿到原件，我就能通过法律手段取回属于我的东西，顺便让那个奸商吃个教训。\n\n所以我至始至终的诉求都是以合法手段解决问题，杀了David对我一点好处没有，你看现在，哪怕我拿到合同，公司也会把责任推到死人身上，这不是我想看到的结果，一群秃鹫！\n\n那天我和David约了会面，公司受不了那些视频引发的舆论，你知道他们给我发了几张律师函吗？他在邮件里说想和我重拟合同，我可不想再和这种家伙合作！我过去是想趁此机会拿回原件合同，结果那家伙说话颠三倒四的。你想想，一场受害者抗争大半年得来的会面，加害者就这样不把对方放在眼里，我要是不生气换我去抱耶稣得了！所以我骂了他一顿，清醒点后才反应过来他这个状态不对劲，鬼知道他是吸了还是喝了，怕他碰瓷，我就走了。",
    evidence: [
      {
        id: "A",
        text: "一份监控回放，与Alex所说一致。",
      },
      {
        id: "B",
        text: "一个空的西柚汁饮料罐：发现于David办公室垃圾桶内，罐口有David唾液痕迹。",
      },
      {
        id: "C",
        text: "Alex的自媒体维权视频：内容集中于合同纠纷、版权收益和技术归属，早期视频常常控制不好愤怒情绪，后期视频则较冷静，语言更锋利。",
      },
      {
        id: "D",
        text: "David办公桌抽屉锁扣有轻微撬动痕迹，但痕迹较旧，无法确认是否为案发当天形成。",
      },
      {
        id: "E",
        text: "Alex随身物品检查：未发现药物、注射器、可疑粉末或饮料容器，仅有电脑、手机和纸质资料。",
      },
    ],
    isUnlocked: false,
  },
  {
    id: "ben",
    name: "Ben",
    nameEn: "ben",
    role: "David的秘书",
    motive:
      "与Alex是隐蔽旧友，想帮Alex处理不公平合同；同时掌握David日程、文件和电子合同系统权限。",
    secret:
      "案发当天9:50左右访问过公司电子合同系统，并打开Alex相关合同页面。碎纸机残片显示其可能处理过合同复印件或草案，但没有证据证明他直接杀害David。",
    description:
      "Ben负责David的日程和文件管理。案发当天8:55进入办公室送咖啡，9:40再次进入整理会面资料，9:50左右访问Alex相关合同页面，12:40返回时发现David死亡。",
    testimony:
      "我是David先生的秘书，负责他的日程和文件管理，……毕竟他更擅长社交场上的事。当天早上快9点他到达公司，我知道他昨晚有宴会，待会儿还有会面，就给他送了杯咖啡。Alex的会面是David先生亲自安排的，我只是按日程执行。至于我和Alex以前认不认识……我对他没印象，但同校圈子就那么大，见过几次也不奇怪。他们之间的纠纷已经影响到公司风评，公司内部认为还是尽快解决的好。\n\n9:20左右，Alex进入办公室，还是我给开的门。里面很快传出争吵声，我知道这两个人肯定会吵起来，办公室有监控，出不了什么事。大概9:30，Alex摔门出来，气得脸通红。我看他脸色很差，肯定没沟通好，也没想这时候去触两人霉头。\n\n9:40左右，我进去收拾会面资料。David先生趴在桌上，我以为他只是喝多了或者犯困——他经常这样，见怪不怪了。我叫了他一声，他没应，但身体还有呼吸的起伏。打扰他休息他要发脾气，所以我把散落的文件整理了一下就走了。\n\n中午我去吃饭，12:40回来后发现他还保持差不多的姿势，我觉得不对才走近查看，结果发现他已经……没呼吸了。公司决定低调处理，我只是按上级要求联系了法医。\n\n我没有任何理由杀他，虽然他不算好上司，但给我的酬劳挺丰厚的。",
    evidence: [
      {
        id: "A",
        text: "办公室门禁记录：Ben于8:55进入David办公室，8:58离开；9:40再次进入，9:47离开；12:40进入后匆匆冲出门外。",
      },
      {
        id: "B",
        text: "咖啡杯残留物：杯中有残余的咖啡液，死者应只喝了上层含奶部分，未检出其余成分。",
      },
      {
        id: "C",
        text: "Ben电脑操作记录：9:50左右访问过公司电子合同系统，并打开Alex相关合同页面。",
      },
      {
        id: "D",
        text: "碎纸机残片：其中有一部分为合同复印件或草案页，内容与Alex版权纠纷相关，但未找到完整原件。",
      },
      {
        id: "E",
        text: "Ben的午餐支付记录：11:55—12:35期间在公司附近餐厅消费。",
      },
      {
        id: "F",
        text: "门禁记录补充：Ben于9:47离开David办公室后，直到12:40才再次进入。",
      },
    ],
    isUnlocked: false,
  },
  {
    id: "cathy",
    name: "Cathy",
    nameEn: "cathy",
    role: "David的情人，Elsa的同学",
    motive:
      "与David是各取所需的关系，缺少直接杀人动机，但她是案发前夜饮酒场所的提供者。",
    secret:
      "David案发前夜在她家饮用Elsa送来的红酒后昏睡。Cathy没有直接下药证据，但她没有追问David明显异常的状态。",
    description:
      "Cathy与David存在情人关系，并与Elsa是同学。案发前夜David于2:17进入Cathy公寓，8:02离开；她家中留下红酒瓶、搜索记录和David昏睡痕迹。",
    testimony:
      "我和David的关系：各取所需啊，他图我漂亮，我图他有钱，多简单。\n\n前一天晚上我们都参加了聚会，聚会上他忙着和别人聊天。喝了多少我就不清楚了。结束之后，大概凌晨2点？他来了我家。\n\n我们又喝了点红酒，那瓶酒是Elsa之前送我的。她说那酒“很适合约会”，让我别浪费。嘛，我也没多想，最多就是让人意乱情迷吧，我是这样想的。\n\nDavid喝了几杯后状态就很奇怪，先是脸红，然后说热，接着开始犯困。我本来很无语，因为他之前说了做了很多，嗯，你懂的，结果没多久就睡过去了。我没管他，让他在客厅沙发上睡了。早上7点多他醒来，说自己还要去公司，简单洗了脸就走了。\n\n他妻子Diana？还有Elsa？我对她们怎么想的？不认识的女人，和很有趣的朋友。就这样。虽然我确实是通过Elsa认识的David，他和我在一起应该也有气Elsa的成分在，那种眼神我熟得很，但我不介意。他出手真挺阔绰的，也还算绅士，作为约会对象相当不错。\n\nElsa确实和我玩得很好，她知道我是什么人，我以为她把David介绍给我时就默认了会发生这种事，事实上她也没表示过什么。\n\n我知道的就这样，我没有任何杀他的理由。甚至我还挺可惜的，这样的可不好找，……私家侦探的工作报酬是不是挺高的？我看你长得也在我点上。",
    evidence: [
      {
        id: "A",
        text: "公寓门口监控：David于凌晨2:17进入Cathy公寓，8:02离开。",
      },
      {
        id: "B",
        text: "打车记录：David于8:05从Cathy家附近上车，8:50左右到达YKW公司。",
      },
      {
        id: "C",
        text: "Cathy家中红酒瓶：瓶底有少量残留，检测无药物残留，度数较高。",
      },
      {
        id: "D",
        text: "Cathy搜索记录：凌晨3点左右搜索过“红酒有助眠作用吗”“男的什么年龄会力不从心”。",
      },
      {
        id: "E",
        text: "客厅沙发靠垫上检出David头发与唾液痕迹，符合其曾在Cathy家昏睡的说法。",
      },
      {
        id: "F",
        text: "调查宴会监控，确认David并未过量饮酒；加上Cathy家那一瓶，结合David过往历史，当晚酒精摄入应该在David酒量范围内，不至于控制不住地昏睡。参与宴会的人均未表现不适。",
      },
    ],
    isUnlocked: false,
  },
  {
    id: "diana",
    name: "Diana",
    nameEn: "diana",
    role: "David的妻子",
    motive:
      "婚姻早已只剩利益关系，David死亡对她有复杂影响，但她没有明确的直接作案机会。",
    secret:
      "对David的混乱私生活早已冷漠，也知道Elsa厌恶David。她不是传统意义上悲痛的妻子，但现有证据不支持其直接参与案发。",
    description:
      "Diana是David的妻子，也是Elsa的姐姐。她和David的婚姻主要维系在家族合作、公司股权与体面形象上。案发上午她一直待在家中，没有进入公司。",
    testimony:
      "是的。我是David的妻子。先说明一点，我们的婚姻早就只剩利益关系。他需要一个稳定体面的家庭形象，而我刚好到了适婚年龄，家里刚好和他有合作，我们就这样被撮合在一起了。最开始他还算模范丈夫，后来装不住了我也闹过，但，没有结果，也没有意义。他更喜欢去社交场广结人脉，猎艳，而不是参与具体的公司管理，家里劝我把心思放在看得见的利益上，我听从了。至少我的工作成果不会跑到别人手里。\n\n最后一次见他是在案发前一天晚上。他说要参加聚会，之后不回家。这是常事了，我没有追问。那晚我熬夜处理工作，隔天请了假，没去公司。David的死对我当然有影响，但并不全是坏事。这样说也许冷血，可这是事实。\n\n如果你要怀疑我，我能理解，总有人觉得我应该恨他报复他，但……现在的我不会做高风险低回报的事。David活着，对我来说有用；David死了，公司反而会变得麻烦。",
    evidence: [
      {
        id: "A",
        text: "Diana当天上午行程记录：一直待在家中，有监控证明。",
      },
      {
        id: "B",
        text: "Diana与律师的邮件往来：近期曾咨询婚内财产分割与公司股权保护问题，但没有正式提出离婚。",
      },
      {
        id: "C",
        text: "保险文件：David名下确有高额保险，但受益人并非Diana个人，而是公司关联信托与家庭共同基金。",
      },
    ],
    isUnlocked: false,
  },
  {
    id: "elsa",
    name: "Elsa",
    nameEn: "elsa",
    role: "Diana的妹妹，Cathy的同学",
    motive:
      "厌恶David背叛姐姐，并反感David试图引诱自己后又接近Cathy；想用红酒恶作剧让David出丑。",
    secret:
      "将高度数红酒送给Cathy，并曾购买含苯海拉明的助眠药、搜索苯海拉明与酒精相关信息。她声称只是恶作剧，但这是死亡链条的关键开端。",
    description:
      "Elsa是Diana的妹妹，与Cathy是同学。她强烈厌恶David，并在案发前把一瓶红酒送给Cathy，暗示这瓶酒很适合约会。案发上午她未到YKW公司。",
    testimony:
      "我承认我讨厌David，非常讨厌。他对不起我姐姐，还试图把他的那套把戏用到我身上。我拒绝之后，他莫名其妙地顶替司机去学校接送我，在Cathy面前我没把话说得太难听，他也装得像个人。……说真的我也没想到事情会变成那样，噢我没有指责Cathy的意思，她个性如此，只是被David诱骗了，仗着社会阅历哄骗学生的恶心家伙。\n\n那瓶红酒是我送给Cathy的。我说它“有用”，是因为那瓶红酒挺有名的，你可以查一下，少见的高度数又不明显的酒。只是一个恶作剧，他仗着自己酒量不错相当嗜酒，我想让他体验一下饮酒过度性无能，隔天宿醉的头痛而已。我不知道他在宴会喝了酒，回家还喝，大早上又喝了咖啡，这家伙真的不是死于酒精中毒吗？\n\n我没有进过YKW公司，更没接触过他的咖啡、办公室或者文件。David死了之后，我一开始确实很意外，因为我知道那瓶酒有问题，但不该致死的。听了其他人说的时间线我反而觉得，他这算自杀吧？我没有推卸责任的意思，但我确实不认为责任在我身上。",
    evidence: [
      {
        id: "A",
        text: "药店购买记录：Elsa在案发前两天购买过含苯海拉明的助眠药。",
      },
      {
        id: "B",
        text: "Elsa手机搜索记录：案发前搜索过“苯海拉明 副作用”“苯海拉明 酒”等内容。",
      },
      {
        id: "C",
        text: "Elsa案发当天上午定位：一直在住处和附近咖啡店之间活动，未到YKW公司。",
      },
      {
        id: "D",
        text: "Elsa与Diana聊天记录：多次表达对David的不满，包括“他迟早会遭报应”，但Diana未回应过她的抱怨，只是让她专注学习。",
      },
    ],
    isUnlocked: false,
  },
];

// 案件梳理填空文本
export const CaseQuizText: string =
  "请根据已解锁的人物档案、证词与证物，补全以下案件经过。每个空只有一个正确答案。\n\n" +
  "YKW公司创始人David于当日中午被发现死在办公室内。尸检显示，他的死亡时间大约在上午【空1】之间。尸体俯卧于办公桌面，体表无明显外伤，但右手指尖有轻微擦伤，指甲内嵌有木质纤维，说明他死亡前可能曾在不适中抓挠或支撑过桌面。\n\n" +
  "案发前一晚，David参加聚会，期间饮酒。聚会结束后，他于凌晨约【空2】前往【空3】家中，并饮用【空4】送的红酒。她因厌恶David并想让他出丑，在酒中加入了【空5】。\n\n" +
  "David在【空3】家中饮酒后，很快出现脸红、发热、困倦等反应，并在客厅昏睡。第二天早上，David从【空3】家离开，随后乘车前往YKW公司，并于【空6】左右到达公司。\n\n" +
  "到达公司后，【空7】给David送入咖啡。根据证词，他负责David的日程与文件管理，也知道David当天要与【空8】会面。虽然咖啡杯残留物未检出明确异常，但由于检测条件有限，不能完全排除微量药物混入的可能。\n\n" +
  "上午【空9】左右，【空8】进入David办公室。两人因版权合同纠纷发生激烈争吵。【空8】认为David骗他签下不公平合同，并想通过合法方式拿回原件合同。约【空10】，【空8】愤怒离开办公室。监控回放与其证词基本一致，其随身物品中也未发现药物、可疑粉末或饮料容器。\n\n" +
  "争吵结束后，David状态明显异常。他感到困倦、燥热，并喝下办公室冰箱中的【空11】。该饮料空罐后来在David办公室垃圾桶内被发现，罐口带有David唾液痕迹。尸检中，David胃内容物也同时出现咖啡味与柑橘类气味。而【空11】可抑制肝脏CYP3A4酶，影响多种药物代谢，导致药物在体内浓度异常升高，与药物同用，会增加嗜睡、协调障碍、呼吸困难等风险。\n\n" +
  "约【空12】，【空7】再次进入办公室。他声称自己只是进去收拾会面资料，发现David趴在桌上，以为他只是喝多或犯困。此后，【空7】在9:50左右访问过公司电子合同系统，并打开了与【空8】相关的合同页面。碎纸机残片中也发现了相关合同复印件或草案页。\n\n" +
  "David最终在睡梦中死亡。中午12:40，【空7】再次进入办公室，发现David已经没有呼吸，于是通知公司并联系法医。\n\n" +
  "综合来看，本案并非典型的单一凶手投毒案，而是多重因素叠加导致死亡：前夜的酒精与苯海拉明、早晨的咖啡、David争吵后的疲惫，以及之后饮用【空11】共同放大了身体负担。几名嫌疑人均对David感情不深，动机也不充分，目前看获利最大的【空13】更是毫无可指摘的地方。尽管如此，意外还是发生了。值得一提的是，【空7】与【空14】、【空3】与【空15】的关系或许比表面上密切得多，感情啊，真是复杂的东西。\n" +
  "或许我应该想想，要给出什么样的答案，而他们又应该迎来怎样的结局呢？";

// 案件梳理填空选项与答案
export const CaseQuizBlanks: CaseQuizBlank[] = [
  {
    id: 1,
    options: [
      { key: "A", text: "8:50-9:20" },
      { key: "B", text: "9:30-10:00" },
      { key: "C", text: "10:00-10:30" },
      { key: "D", text: "11:00-11:30" },
    ],
    answer: "C",
    answerText: "10:00-10:30",
  },
  {
    id: 2,
    options: [
      { key: "A", text: "0:30" },
      { key: "B", text: "2:00" },
      { key: "C", text: "2:30" },
      { key: "D", text: "3:00" },
    ],
    answer: "B",
    answerText: "2:00",
  },
  {
    id: 3,
    options: [
      { key: "A", text: "Diana" },
      { key: "B", text: "Elsa" },
      { key: "C", text: "Cathy" },
      { key: "D", text: "Ben" },
    ],
    answer: "C",
    answerText: "Cathy",
  },
  {
    id: 4,
    options: [
      { key: "A", text: "Alex" },
      { key: "B", text: "Diana" },
      { key: "C", text: "Ben" },
      { key: "D", text: "Elsa" },
    ],
    answer: "D",
    answerText: "Elsa",
  },
  {
    id: 5,
    options: [
      { key: "A", text: "砒霜" },
      { key: "B", text: "比沙可啶" },
      { key: "C", text: "苯海拉明" },
      { key: "D", text: "地西泮" },
    ],
    answer: "C",
    answerText: "苯海拉明",
  },
  {
    id: 6,
    options: [
      { key: "A", text: "7:30" },
      { key: "B", text: "8:00" },
      { key: "C", text: "8:30" },
      { key: "D", text: "8:50" },
    ],
    answer: "D",
    answerText: "8:50",
  },
  {
    id: 7,
    options: [
      { key: "A", text: "Alex" },
      { key: "B", text: "Ben" },
      { key: "C", text: "Cathy" },
      { key: "D", text: "Elsa" },
    ],
    answer: "B",
    answerText: "Ben",
  },
  {
    id: 8,
    options: [
      { key: "A", text: "Alex" },
      { key: "B", text: "Ben" },
      { key: "C", text: "Diana" },
      { key: "D", text: "Cathy" },
    ],
    answer: "A",
    answerText: "Alex",
  },
  {
    id: 9,
    options: [
      { key: "A", text: "8:00" },
      { key: "B", text: "8:55" },
      { key: "C", text: "9:20" },
      { key: "D", text: "9:40" },
    ],
    answer: "C",
    answerText: "9:20",
  },
  {
    id: 10,
    options: [
      { key: "A", text: "8:50" },
      { key: "B", text: "9:30" },
      { key: "C", text: "9:50" },
      { key: "D", text: "10:15" },
    ],
    answer: "B",
    answerText: "9:30",
  },
  {
    id: 11,
    options: [
      { key: "A", text: "红酒" },
      { key: "B", text: "咖啡" },
      { key: "C", text: "西柚汁" },
      { key: "D", text: "茶" },
    ],
    answer: "C",
    answerText: "西柚汁",
  },
  {
    id: 12,
    options: [
      { key: "A", text: "8:55" },
      { key: "B", text: "9:40" },
      { key: "C", text: "10:30" },
      { key: "D", text: "12:40" },
    ],
    answer: "B",
    answerText: "9:40",
  },
  {
    id: 13,
    options: [
      { key: "A", text: "Alex" },
      { key: "B", text: "Ben" },
      { key: "C", text: "Diana" },
      { key: "D", text: "Cathy" },
    ],
    answer: "C",
    answerText: "Diana",
  },
  {
    id: 14,
    options: [
      { key: "A", text: "Ben" },
      { key: "B", text: "Cathy" },
      { key: "C", text: "Diana" },
      { key: "D", text: "Elsa" },
    ],
    answer: "A",
    answerText: "Ben",
  },
  {
    id: 15,
    options: [
      { key: "A", text: "Ben" },
      { key: "B", text: "Cathy" },
      { key: "C", text: "Diana" },
      { key: "D", text: "Elsa" },
    ],
    answer: "D",
    answerText: "Elsa",
  },
];

export const CaseQuizAnswerMap: Record<number, "A" | "B" | "C" | "D"> =
  CaseQuizBlanks.reduce(
    (map, blank) => {
      map[blank.id] = blank.answer;
      return map;
    },
    {} as Record<number, "A" | "B" | "C" | "D">
  );

// 指认真凶结局文案
export const AccuseEndings: AccuseEnding[] = [
  {
    id: 1,
    title: "Alex",
    resultText:
      "你认为Alex是造成David情绪过度激动、致其死亡的元凶。\n\n然而YKW公司对这个判断不大满意。鉴于过去Alex引发的舆论，他们并不想再卷入其中。最后，他们选择息事宁人，让相关人员签署保密协议，将此定性为一场意外。事实上，在签完保密协议后，Alex告诉你，他得知你的推断后，仅思考 0.1 秒就决定将其作为下期视频的素材。\n\n“早知道网络侦探这么好干，我也去分一份羹了。”面对他的嘲讽，你勃然小怒。\n\n此次案件指认降低了你的声誉。鲁莽的侦探，请再想一想吧。",
  },
  {
    id: 2,
    title: "Ben",
    resultText:
      "你认为Ben是忽视David身体异常、致其死亡的元凶。\n\n按你的推断，Ben与Alex是故交。为了帮助Alex，Ben给疲惫的David端了咖啡，甚至咖啡中用于拉花的奶液或许被混入了镇定类药物，刺激了David本就衰弱的神经。之后，Ben又因心虚而对David的昏睡视而不见，最终酿成了这场悲剧。\n\n然而动机与证据均不充分。YKW公司不想因为这种不成型的推断损失一名优秀员工，于是选择息事宁人，让相关人员签署保密协议，将此定性为一场意外。事实上，在签署保密协议时，Ben全程没有看你一眼，平静得仿佛被指认的不是他。只是不知为何，你的案源自那之后减少了大半。\n\n此次案件指认降低了你的声誉。鲁莽的侦探，请再想一想吧。",
  },
  {
    id: 3,
    title: "Cathy",
    resultText:
      "你认为Cathy是在发现David异常后放任不管、致其死亡的元凶。\n\n按你的推断，David前夜在Cathy家中饮酒，酒中Elsa所下的苯海拉明，使David出现了脸发热、困倦等异常表现，但Cathy对此毫无反应，任由他在客厅沙发上昏睡。\n\n然而这个判断缺乏决定性证据。Cathy矢口否认红酒有问题，表示红酒瓶中剩余的液体明明毫无问题。她也没有理由预见David隔天会继续饮用咖啡和西柚汁，更无法控制他之后在公司发生的一切。在辩解完后，她拿出手机，表示若继续纠缠她，一些关于David的隐私信息或许将被公之于众。\n\nYKW公司不愿再卷入舆论，最终选择息事宁人，让相关人员签署保密协议，将此定性为一场意外。事实上，Cathy签完保密协议后，临走前还留给你一句话：“我改主意了，不是很想和蠢人约会呢，加钱也不行。”\n\n此次案件指认降低了你的声誉。鲁莽的侦探，请再想一想吧。",
  },
  {
    id: 4,
    title: "Diana",
    resultText:
      "你认为Diana是David死后获利最大的人，因此她才是真正的幕后元凶。\n\n按你的推断，David死后，名存实亡的婚姻、财产纠葛和公司权力问题都会往有利于她的方向倾斜，升官发财死老公，你见过太多这种豪门戏码。\n\n然而Diana案发上午一直待在家中，有明确的不在场证明。利润最大的保险受益人也并非她个人，而是公司关联信托与家庭共同基金。单凭所谓动机便草率指认一名受伤的妻子、YKW公司现任管理层，公司对此极为不满，最终选择息事宁人，让相关人员签署保密协议，将此定性为一场意外。事实上，Diana签保密协议时依旧面无表情，仿佛没有什么事能再使她动摇。\n\n此次案件指认降低了你的声誉。鲁莽的侦探，请再想一想吧。",
  },
  {
    id: 5,
    title: "Elsa",
    isPartialEnding: true,
    resultText:
      "你认为Elsa是给红酒下药、导致David死亡的元凶。\n\n她讨厌David，有明确的情绪动机；将高度数的红酒送给Cathy，并暗示其与David共饮。甚至根据搜索记录，你怀疑红酒中还加入了苯海拉明，只是Cathy与Elsa均表示酒是正常的。\n\n然而证据并不充足，一瓶只是高度数的红酒并不能作为凶器，后续发生的一系列事情也无法指认是Elsa有意安排。YKW公司为你的推断开了一场内部会议，创始人被妻妹谋杀绝对会令公司陷入舆论，同时Diana据理力争表示这一推断并不严谨，对公司更是有弊无利。最终公司选择息事宁人，让相关人员签署保密协议，将此定性为一场意外。事实上，签署完保密协议，走出公司时，Elsa对你做了个鬼脸：“再见了，可怜的失败者。”\n\n此次案件指认半成立，但你并不满意这样的结局。",
  },
  {
    id: 6,
    title: "全员有罪，但……",
    isBestEnding: true,
    resultText:
      "你认为没有任何一个人是清白的，但无法划分责任。\n\nAlex的争吵刺激了David，Ben延误了发现时机，Cathy没有理会David身体的异常，Diana长期放任David的胡作非为，Elsa的红酒恶作剧也是关键的一环。\n\n从证物证言上看，这个判断逻辑通顺。每个人都在David走向死亡的路上推了一把。但从案件结论上看，这过于宽泛。它不能解释具体因果，也无法指出谁的行为真正跨过了犯罪边界。\n\nYKW公司对这个结论没有表示反对，却也没有采纳。最终公司选择息事宁人，让相关人员签署保密协议，将此定性为一场意外，并从David的遗产中划出一笔，作为付给你的额外报酬。\n\n或许每个人对自己的所作所为都心有所感，只是故作不知。\n\nAlex拿回了自己的成果与应得的分红，将其开源发布后，利用做自媒体期间积累的人脉拉起了一个小团队，开始开发新项目，尽管坎坷，他的热情依旧燃烧着。\n\nBen成为了新任CEO的秘书，说他冷漠、没人情的风言风语都被他无可指摘的业务能力压下，再无人敢多说闲话，最多有人调侃，流水的CEO，铁打的秘书。\n\nCathy的空窗期持续了很久，她的朋友纷纷为此困惑，但当她宣布与Elsa交往时，这一切都说得通了。谁也说不清这段恋情会持续多久，谁能流住一捧水呢？\n\nDiana的事业可谓蒸蒸日上，丧夫的悲伤并未影响她清点利益、收拢权力，等众人回过神时，她已经拿下战略投资总监的职位，而生活上，她也不必再听从谁的安排。\n\nElsa毕业后进入了YKW公司，被分配到Diana手下当牛马使，以惊人的速度成长着，并在忍无可忍跳槽后向Cathy提出了交往请求。虽然姐姐既不看好她的事业选择，也不看好她的恋情，但她向来我行我素。\n\n而你，聪明的侦探，下一个有趣的案子正等着你。",
  },
  {
    id: 7,
    title: "暂不指认",
    isCancel: true,
    resultText:
      "你选择暂不指认任何人。\n\n案件暂未结束。请继续调查，或在准备充分后重新输入accuse进行指认。",
  },
];

export const AccuseEndingMap: Record<number, AccuseEnding> =
  AccuseEndings.reduce(
    (map, ending) => {
      map[ending.id] = ending;
      return map;
    },
    {} as Record<number, AccuseEnding>
  );

// 获取角色信息
export function getCharacter(id: string): Character | null {
  return (
    CharacterList.find((c) => c.id === id || c.nameEn === id.toLowerCase()) ||
    null
  );
}

// 检查是否已解锁
export function isUnlocked(id: string): boolean {
  const character = getCharacter(id);
  return character ? character.isUnlocked : false;
}

// 解锁角色
export function unlockCharacter(id: string): boolean {
  const character = getCharacter(id);
  if (character && !character.isUnlocked) {
    character.isUnlocked = true;
    return true;
  }
  return false;
}

// 获取已解锁角色列表
export function getUnlockedCharacters(): Character[] {
  return CharacterList.filter((c) => c.isUnlocked);
}

// 获取未解锁角色列表
export function getLockedCharacters(): Character[] {
  return CharacterList.filter((c) => !c.isUnlocked);
}

// 重置所有角色为未解锁状态，调试或重新开始游戏时可用
export function resetCharacterUnlocks(): void {
  CharacterList.forEach((c) => {
    c.isUnlocked = false;
  });
}

// 检查案件梳理填空答案
export function checkCaseQuizAnswer(
  blankId: number,
  answer: "A" | "B" | "C" | "D"
): boolean {
  return CaseQuizAnswerMap[blankId] === answer;
}

// 检查整套案件梳理答案
export function checkCaseQuizAnswers(
  answers: Record<number, "A" | "B" | "C" | "D">
): boolean {
  return CaseQuizBlanks.every((blank) => answers[blank.id] === blank.answer);
}
