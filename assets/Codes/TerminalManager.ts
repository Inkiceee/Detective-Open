import {
  _decorator,
  Component,
  ScrollView,
  EditBox,
  Label,
  Node,
  UITransform,
  Color,
  RichText,
  Font,
  director,
  VideoPlayer,
  VideoClip,
  resources,
  Canvas,
  Widget,
  UIOpacity,
  Vec3,
  Quat,
} from "cc";

import { LoginSystem } from "./LoginSystem";
import { HpBar } from "./HpBar";
import { CharacterSystem } from "./CharacterSystem";
import { GameData } from "./GameData";
import { SimpleSaveSystem } from "./SaveSystem";
import { AccuseSystem } from "./AccuseSystem";
import { AchievementSystem, AchievementId } from "./AchievementSystem";
import {
  InitialEvidenceList,
  getCharacter,
  Character,
  CaseQuizText,
  CaseQuizBlanks,
} from "./CharacterData";

const { ccclass, property } = _decorator;

const CHARACTER_IDS = ["alex", "ben", "cathy", "diana", "elsa"];
type CaseQuizChoice = string;

interface TerminalAiMessage {
  role: "user" | "assistant";
  content: string;
}

interface VideoDisplayState {
  parent: Node | null;
  siblingIndex: number;
  position: Vec3;
  scale: Vec3;
  rotation: Quat;
  layer: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  widgetEnabled: boolean | null;
  opacity: number | null;
  playerEnabled: boolean;
}

@ccclass("TerminalManager")
export class TerminalManager extends Component {
  @property(ScrollView)
  scrollView: ScrollView = null!;

  @property(Node)
  content: Node = null!;

  @property(EditBox)
  inputBox: EditBox = null!;

  @property(Font)
  monospaceFont: Font = null!;

  @property(HpBar)
  hpBar: HpBar = null!;

  @property(Node)
  videoPlayerNode: Node = null!;

  @property(Node)
  gameOverPanel: Node = null!;

  @property(SimpleSaveSystem)
  saveSystem: SimpleSaveSystem = null!;

  @property(AccuseSystem)
  accuseSystem: AccuseSystem = null!;

  @property(AchievementSystem)
  achievementSystem: AchievementSystem = null!;

  terminalFontName: string = "monospace";

  @property({ tooltip: "AI 代理地址。默认连接本机代理；不要在此填写模型 API Key。" })
  aiProxyUrl: string = "http://127.0.0.1:8787/api/chat";

  private prefix = "> ";
  private isFixing = false;

  private gameState: "BOOT" | "LOGIN" | "MAIN" | "GAMEOVER" = "BOOT";

  private loginSystem: LoginSystem = null!;
  private playerName: string = "";

  private characterSystem: CharacterSystem = null!;

  private isAnswerMode: boolean = false;
  private caseQuizAnswers: Record<number, CaseQuizChoice> = {};
  private hasPendingCaseQuizSubmit: boolean = false;

  private videoPlayer: VideoPlayer | null = null;
  private videoList: VideoClip[] = [];
  private isLoadingVideos: boolean = false;
  private isWaitingVideoComplete: boolean = false;
  private hasVideoStarted: boolean = false;
  private videoSessionId: number = 0;
  private videoOverlay: Node | null = null;
  private originalVideoDisplay: VideoDisplayState | null = null;

  private gameStartTime: number = 0;
  private isTiming: boolean = false;
  private isTimelineCompleted: boolean = false;
  private pendingDeleteSaveId: string = "";

  private isAiChatMode: boolean = false;
  private isAiRequestPending: boolean = false;
  private aiHistory: TerminalAiMessage[] = [];
  private aiRequest: XMLHttpRequest | null = null;
  private aiRequestId: number = 0;
  private readonly aiMaxInputChars = 2000;
  private readonly aiMaxHistoryChars = 12000;
  private readonly aiMaxHistoryMessages = 12;

  start() {
    this.initInputBox();
    this.initVideoPlayer();
    this.initSaveSystem();
    this.initAccuseSystem();
    this.initAchievementSystem();
    this.initHpBar();

    if (this.gameOverPanel) {
      this.gameOverPanel.active = false;
    }

    this.loadAllVideos();

    const isReturningFromSokoban =
      GameData.waitingSokobanResult && GameData.sokobanFinished;

    if (isReturningFromSokoban) {
      const hpAfterSokoban = GameData.playerHp;

      // 先读取旧存档恢复已解锁人物、累计时长等，再保留推箱子结算后的血量。
      this.saveSystem.loadGame();
      GameData.setPlayerHp(hpAfterSokoban);

      this.playerName = GameData.terminalPlayerName || this.saveSystem.getPlayerName();
      this.isTimelineCompleted = this.saveSystem.isTimelineCompleted();
      GameData.timelineCompleted = this.isTimelineCompleted;
      this.syncHpBarFromGameData();

      // 先让 CharacterSystem 展示推箱子结算信息，再判断死亡。
      this.initCharacterSystem();

      // 推箱子超时可能导致 HP 归零，先显示扣血信息，再显示死亡信息
      if (!GameData.isPlayerAlive()) {
        GameData.deathReason = "overtime";
        // 显示扣血信息
        this.addRichLine(
          `推箱子超时！体力透支，扣血至 0。`,
          "#FF5555",
        );
        // 再检测死亡
        this.checkAndTriggerDeath();
      }
      
      if (this.gameState === "GAMEOVER") return;

      this.gameState = "MAIN";
      this.addRichLine("", "#FFFFFF");
      this.addRichLine("已返回终端。", "#00FF00");
      this.addRichLine(
        "输入 <color=#CE831E>help</color> 查看可用指令。",
        "#AAAAAA",
      );
      this.syncSaveAfterRuntimeChanged();
      this.resumeTiming();
      return;
    }

    this.initCharacterSystem();
    this.showStartScreen();
  }

  onDestroy() {
    this.exitAiChat(false);
    this.stopSosVideo();
    this.unscheduleAllCallbacks();
    // GAMEOVER 状态下死亡存档已由 onDeath() 写好，不能用 saveGame() 覆盖 isDeath 标记
    if (this.gameState === "GAMEOVER") {
      this.pauseTiming();
    } else {
      this.pauseAndSaveTiming();
    }

    const inputNode = this.inputBox?.node;
    if (inputNode && inputNode.isValid) {
      inputNode.off("editing-return", this.onSubmit, this);
      inputNode.off("text-changed", this.onTextChanged, this);
    }
  }

  private initInputBox() {
    if (!this.inputBox) return;

    this.inputBox.node.on("editing-return", this.onSubmit, this);
    this.inputBox.node.on("text-changed", this.onTextChanged, this);
    this.inputBox.string = this.prefix;
    this.inputBox.focus();
  }

  private initVideoPlayer() {
    if (!this.videoPlayerNode) return;

    // 不能把终端或 Canvas 根节点当作视频节点，否则隐藏视频会连终端一起隐藏。
    let ancestor: Node | null = this.node;
    while (ancestor) {
      if (ancestor === this.videoPlayerNode) {
        console.warn("videoPlayerNode 应绑定独立的视频节点，不能绑定终端根节点。");
        return;
      }
      ancestor = ancestor.parent;
    }

    this.videoPlayer = this.videoPlayerNode.getComponent(VideoPlayer);
    if (this.videoPlayer) {
      this.videoPlayer.playOnAwake = false;
      this.videoPlayer.stop();
    }

    // 不隐藏共享的 UI 父节点；只有独立的视频容器才一并隐藏。
    this.videoPlayerNode.active = false;
    const parent = this.videoPlayerNode.parent;
    if (parent && parent !== this.node && !parent.getComponent(Canvas) && parent.children.length === 1) {
      parent.active = false;
    }
  }

  private initSaveSystem() {
    if (!this.saveSystem) {
      this.saveSystem = this.node.addComponent(SimpleSaveSystem);
    }
  }

  private initAccuseSystem() {
    if (!this.accuseSystem) {
      this.accuseSystem = this.node.addComponent(AccuseSystem);
    }

    this.accuseSystem.init({
      addRichLine: (text: string, color?: string) => {
        this.addRichLine(text, color || "#FFFFFF");
      },
      showGameOver: () => {
        GameData.deathReason = "wrong_accuse";
        this.onPlayerDeath();
      },
      onGameComplete: () => {
        this.gameState = "GAMEOVER";
      },
      getCurrentHp: () => {
        return GameData.playerHp;
      },
    });
  }

  private initAchievementSystem() {
    if (!this.achievementSystem) {
      this.achievementSystem = this.node.addComponent(AchievementSystem);
    }
  }

  private initHpBar() {
    this.syncHpBarFromGameData();

    if (this.hpBar && typeof this.hpBar.setOnDeathCallback === "function") {
      this.hpBar.setOnDeathCallback(() => {
        this.onPlayerDeath();
      });
    }
  }

  private initCharacterSystem() {
    this.characterSystem = this.node.addComponent(CharacterSystem);
    this.characterSystem.init({
      addLine: (text: string, color?: string) => {
        this.addLine(text, color || "#FFFFFF");
      },
      addRichLine: (text: string, color?: string) => {
        this.addRichLine(text, color || "#FFFFFF");
      },
      startMiniGame: (characterId: string) => {
        this.pauseAndSaveTiming();
        this.saveHpToGameData();
        GameData.terminalPlayerName = this.playerName || "侦探";

        this.addRichLine(
          `开始【${characterId}】的推箱子安全验证...`,
          "#CE831E",
        );

        director.loadScene(GameData.sokobanSceneName);
      },
      onCharacterUnlocked: (characterId: string) => {
        this.saveSystem.onCharacterUnlocked(characterId);
        this.checkAllCharactersUnlocked();
        this.handleSave(false); // 解锁人物后自动保存
      },
    });
  }

  private showStartScreen() {
    this.gameState = "BOOT";
    this.isTimelineCompleted = false;
    this.addLine("终端侦探 v1.0 David遇害案");
    this.addLine(
      "2024年12月24日，纳米科技公司CEO David在办公室遇害。有五名嫌疑人。你作为一名侦探进行调查，你必须要进入你的纳米账户，现在请开始登陆.",
    );

    const saveCount = this.saveSystem.getAllSaves().length;
    if (saveCount > 0) {
      this.addRichLine(
        `检测到 <color=#CE831E>${saveCount}</color> 个存档，输入 <color=#CE831E>load</color> 查看存档列表。`,
        "#CE831E",
      );
    }

    this.addRichLine(
      "输入 <color=#CE831E>help</color> 查看可用指令。",
      "#FFFFFF",
    );
  }

  private loadAllVideos() {
    if (this.isLoadingVideos) return;
    this.isLoadingVideos = true;

    resources.loadDir("videos", VideoClip, (err, assets) => {
      this.isLoadingVideos = false;
      if (err) {
        console.warn("加载视频目录失败，请确认 assets/resources/videos 存在", err);
        return;
      }
      this.videoList = assets || [];
      console.log(`成功加载 ${this.videoList.length} 个广告视频`);
    });
  }

  private startTiming() {
    this.gameStartTime = Date.now();
    this.isTiming = true;
  }

  private pauseTiming(): number {
    if (!this.isTiming || this.gameStartTime <= 0) return 0;

    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    this.isTiming = false;
    this.gameStartTime = 0;
    return elapsed;
  }

  private resumeTiming() {
    if (this.isTiming) return;
    this.gameStartTime = Date.now();
    this.isTiming = true;
  }

  private pauseAndSaveTiming() {
    const elapsed = this.pauseTiming();
    if (elapsed > 0 && this.saveSystem) {
      this.saveSystem.saveGame(elapsed);
    }
  }

  private getCurrentTotalPlayTimeSeconds(): number {
    let currentTimeSeconds = this.saveSystem.getTotalPlayTimeSeconds();
    if (this.isTiming && this.gameStartTime > 0) {
      currentTimeSeconds += (Date.now() - this.gameStartTime) / 1000;
    }
    return currentTimeSeconds;
  }

  onTextChanged() {
    if (this.isFixing || !this.inputBox) return;

    const text = this.inputBox.string;

    if (!text.startsWith(this.prefix)) {
      this.isFixing = true;
      const userInput = text.replace(/^>?\s*/, "");
      this.inputBox.string = this.prefix + userInput;
      this.isFixing = false;
    }
  }

  onSubmit() {
    if (!this.inputBox) return;

    if (this.isWaitingVideoComplete) {
      this.addRichLine("正在播放广告，请稍候...", "#FF5555");
      this.resetInputBox();
      return;
    }

    const fullText = this.inputBox.string;
    const cmd = fullText.startsWith(this.prefix)
      ? fullText.substring(this.prefix.length)
      : fullText;

    if (cmd.trim() === "") return;

    this.addLine(`> ${cmd}`, "#FFFF55");

    // AI 模式优先于彩蛋、确认框和所有游戏指令；quit 在等待回答时也能立即退出。
    const normalizedCmd = cmd.trim().normalize("NFKC");
    if (this.isAiChatMode) {
      this.handleAiChatInput(cmd.trim());
      this.resetInputBox();
      return;
    }

    if (normalizedCmd === "喵") {
      this.enterAiChat();
      this.resetInputBox();
      return;
    }

// 终端小彩蛋：左边是玩家输入，右边是系统回复
const easterEggs: Record<string, string> = {
  "?": "感到疑惑是正常的，送你一个这个：¿",
  "Wonderhoy!":"Won~Won~Wonderhoy!\nTRUTH\nARCHIVEACCESS\nFOLLOWTHEEVIDENCE\nQUESTIONEVERYALIBI\n2024\ncbcdc dbacb cbcad",
  "David":"早死何尝不是一种快活！",
  "福尔摩斯":"他的电脑技术或许在你之下。",
  "":"大脑放空中……",
  "我爱你":"我也爱你❤",
  "12345":"上山打老虎",
  "abcde":"我胡言乱语就这样",
  "豆包":"我一口吃了这个豆包",
  "gpt":"感谢它，整个项目最伟大的功臣",
};

const eggInput = cmd.trim().normalize("NFKC");
const eggReply = easterEggs[eggInput];

if (typeof eggReply === "string") {
  this.addRichLine(eggReply, "#CE831E");
  this.resetInputBox();
  return; // 彩蛋触发后，不再继续处理普通指令
}

    // 删除存档确认拦截（登录流程中不介入）
    if (this.gameState !== "LOGIN" && this.checkDeleteConfirm(cmd.trim())) {
      this.resetInputBox();
      return;
    }

    if (this.gameState === "GAMEOVER") {
      this.processGameOverCommand(cmd.trim());
    } else if (this.gameState === "MAIN") {
      this.processMainCommand(cmd);
    } else if (this.gameState === "LOGIN") {
      this.loginSystem.processInput(cmd.trim());
    } else {
      this.processBootCommand(cmd.trim());
    }

    this.resetInputBox();
  }

  private enterAiChat() {
    if (!this.aiProxyUrl.trim()) {
      this.addRichLine("AI 代理地址尚未配置，请在 TerminalManager 中填写 aiProxyUrl。", "#FF5555");
      return;
    }
    this.isAiChatMode = true;
    this.aiHistory = [];
    this.addRichLine("喵～AI 对话已开启。", "#CE831E");
    this.addRichLine("句末加“喵”才会让 AI 回复。输入 <color=#CE831E>quit</color> 退出并返回原来的终端状态。", "#FFFFFF");
  }

  private exitAiChat(showMessage: boolean = true) {
    const wasActive = this.isAiChatMode;
    this.isAiChatMode = false;
    this.isAiRequestPending = false;
    this.aiHistory = [];
    this.aiRequestId++;
    const request = this.aiRequest;
    this.aiRequest = null;
    if (request) {
      request.onload = null;
      request.onerror = null;
      request.ontimeout = null;
      request.onabort = null;
      try { request.abort(); } catch { /* 场景销毁时忽略已经结束的原生请求。 */ }
    }
    if (showMessage && wasActive) this.addRichLine("已退出 AI 对话，恢复终端操作。", "#00FF00");
  }

  private handleAiChatInput(input: string) {
    const message = input.trim();
    if (message.normalize("NFKC").toLowerCase() === "quit") {
      this.exitAiChat();
      return;
    }
    // 固定回复由游戏本地完成，不创建请求，也不加入后续聊天历史。
    if (!message.endsWith("喵")) {
      this.addLine("听不懂喵", "#CE831E");
      this.scrollView?.scrollToBottom(0.1);
      return;
    }
    if (this.isAiRequestPending) {
      this.addRichLine("AI 正在思考，请稍候；也可输入 <color=#CE831E>quit</color> 取消并退出。", "#AAAAAA");
      return;
    }
    if (message.length > this.aiMaxInputChars) {
      this.addRichLine(`每条消息最多 ${this.aiMaxInputChars} 个字符，请分成几次发送。`, "#FF5555");
      return;
    }
    this.sendAiMessage(message);
  }

  private trimAiHistory(messages: TerminalAiMessage[]): TerminalAiMessage[] {
    const history = messages.slice(-this.aiMaxHistoryMessages);
    const charCount = () => history.reduce((sum, message) => sum + message.content.length, 0);
    // 整轮移除较早的对话；保留最新一条用户消息，且不以 assistant 开头。
    while (history.length > 1 && charCount() > this.aiMaxHistoryChars) {
      history.shift();
      while (history.length > 1 && history[0].role === "assistant") history.shift();
    }
    while (history.length > 0 && history[0].role === "assistant") history.shift();
    return history;
  }

  private sendAiMessage(input: string) {
    const messages = this.trimAiHistory([
      ...this.aiHistory,
      { role: "user", content: input } as TerminalAiMessage,
    ]);
    let request: XMLHttpRequest;
    try { request = new XMLHttpRequest(); }
    catch {
      this.addLine("当前运行环境不支持网络请求。请用浏览器预览，或输入 quit 退出。", "#FF5555");
      return;
    }
    const requestId = ++this.aiRequestId;
    this.aiRequest = request;
    this.isAiRequestPending = true;
    this.addRichLine("AI 正在思考……（输入 quit 可随时退出）", "#AAAAAA");

    const isCurrent = () => this.isAiChatMode && requestId === this.aiRequestId;
    const finishRequest = () => {
      this.isAiRequestPending = false;
      this.aiRequest = null;
      request.onload = null;
      request.onerror = null;
      request.ontimeout = null;
      request.onabort = null;
    };
    const fail = (message: string) => {
      if (!isCurrent()) return;
      finishRequest();
      this.addLine(message, "#FF5555");
      this.scrollView?.scrollToBottom(0.1);
    };

    request.onload = () => {
      if (!isCurrent()) return;
      let data: any;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        fail("AI 服务返回了无法识别的内容，请检查代理地址；输入 quit 可退出。");
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const error = typeof data?.error === "string" ? data.error : `AI 服务请求失败（HTTP ${request.status}）。`;
        fail(error);
        return;
      }
      if (typeof data?.reply !== "string" || data.reply.length > 40000) {
        fail("AI 回答格式不正确或过长，请检查代理服务。输入 quit 可退出。");
        return;
      }
      finishRequest();
      const reply = data.reply.trim();
      if (reply) {
        this.aiHistory = this.trimAiHistory([
          ...messages,
          { role: "assistant", content: reply } as TerminalAiMessage,
        ]);
        // 模型文字按普通文本显示，避免把内容误当作富文本标签或游戏指令。
        this.addLine("AI：", "#CE831E");
        for (let offset = 0; offset < reply.length; offset += 1000) {
          this.addLine(reply.slice(offset, offset + 1000), "#FFFFFF");
        }
      } else if (!data.limitReached) {
        this.addLine("AI 没有返回文字，可以换个问题重试。", "#AAAAAA");
      }
      if (data.limitReached === true) {
        this.addLine("本轮已达到生成额度上限，已停止。可以缩小问题后继续，或输入 quit 退出。", "#FFFF55");
      }
      const used = data.usage?.completion_tokens;
      if (typeof used === "number" && Number.isFinite(used) && used >= 0) {
        this.addLine(`本轮生成用量：${used} token（含思考与回答）。`, "#AAAAAA");
      }
      this.scrollView?.scrollToBottom(0.1);
    };
    request.onerror = () => fail("无法连接 AI 代理，请确认代理已启动、地址正确且允许当前页面跨域访问。输入 quit 可退出。");
    request.ontimeout = () => fail("AI 请求超时，已停止等待。可以重试，或输入 quit 退出。");
    request.onabort = () => fail("AI 请求已取消，可以继续提问或输入 quit 退出。");
    try {
      request.open("POST", this.aiProxyUrl.trim(), true);
      request.timeout = 130000;
      request.setRequestHeader("Content-Type", "application/json");
      request.send(JSON.stringify({ messages }));
    } catch {
      fail("AI 请求未能发出，请检查代理地址。输入 quit 可退出。");
    }
  }

  private processGameOverCommand(cmd: string) {
  const lower = cmd.toLowerCase();

  if (lower === "restart" || lower === "new") {
    this.restartGame();
  } else if (lower === "load" || lower === "continue") {
    this.showSaveList();
  } else if (lower.startsWith("load ")) {
    this.handleLoadByNumber(lower);
  } else if (lower === "delete" || lower === "del") {
    this.addRichLine(
      "请指定要删除的存档：<color=#CE831E>delete 1</color> 或 <color=#CE831E>delete 玩家名</color>",
      "#AAAAAA",
    );
  } else if (lower.startsWith("delete ") || lower.startsWith("del ")) {
    this.handleDeleteSave(lower);
  } else if (lower === "sos") {
    this.handleSos();
  } else if (lower === "status") {
    this.showGameStatus();
  } else if (lower === "achievement" || lower === "achievements") {
    this.showAchievements();
  } else if (lower === "quit" || lower === "exit") {
    this.addRichLine("返回主菜单...", "#00FF00");
    this.scheduleOnce(() => {
      director.loadScene("MainMenu");
    }, 1);
  } else if (lower === "help") {
    this.addRichLine("游戏结束后可用命令：", "#FFFF55");
    this.addRichLine("  <color=#CE831E>restart</color>        - 开始新游戏", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>load</color>           - 查看存档列表", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>load 1</color>         - 按编号读取存档", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>load 玩家名</color>    - 按姓名读取存档", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>delete 1</color>       - 按编号删除存档", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>delete 玩家名</color>  - 按姓名删除存档", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>sos</color>             - 看广告复活", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>status</color>         - 查看本局统计", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>achievement</color>    - 查看成就系统", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>喵</color>             - 开启 AI 对话（quit 退出）", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>quit</color>           - 返回主菜单", "#FFFFFF");
  } else {
    this.addRichLine(
      "<color=#FF5555>游戏已结束。</color>可用命令：<color=#CE831E>restart / load / delete / sos / status / achievement / quit</color>",
    );
  }
}

  private resetInputBox() {
    if (!this.inputBox) return;

    this.inputBox.string = this.prefix;

    this.scheduleOnce(() => {
      if (this.inputBox && this.inputBox.enabled) {
        this.inputBox.focus();
      }
    }, 0.05);

    this.scheduleOnce(() => {
      if (this.scrollView) {
        this.scrollView.scrollToBottom(0.1);
      }
    }, 0.05);
  }

  processBootCommand(cmd: string) {
    const lowerCmd = cmd.toLowerCase();

    if (lowerCmd === "help") {
      this.showBootHelp();
    } else if (lowerCmd === "password") {
      this.addRichLine("<color=#CE831E>YKW2024</color>");
    } else if (lowerCmd === "login") {
      this.startLogin();
    } else if (lowerCmd === "load") {
      this.showSaveList();
    } else if (lowerCmd.startsWith("load ")) {
      this.handleLoadByNumber(lowerCmd);
    } else if (lowerCmd === "delete" || lowerCmd === "del") {
      this.addRichLine(
        "请指定要删除的存档：<color=#CE831E>delete 1</color> 或 <color=#CE831E>delete 玩家名</color>",
        "#AAAAAA",
      );
    } else if (lowerCmd.startsWith("delete ") || lowerCmd.startsWith("del ")) {
      this.handleDeleteSave(lowerCmd);
    } else {
      this.addRichLine(
        `<color=#FF5555>未知指令: ${cmd}</color>，输入<color=#CE831E>help</color>查看可用指令`,
      );
    }
  }

  showBootHelp() {
    this.addRichLine("========== 可用指令 ==========", "#00FF00");
    this.addRichLine("  <color=#CE831E>login</color>          - 登录系统");
    this.addRichLine("  <color=#CE831E>load</color>           - 查看存档列表");
    this.addRichLine("  <color=#CE831E>load 1</color>         - 按编号读取存档");
    this.addRichLine("  <color=#CE831E>load 玩家名</color>    - 按姓名读取存档");
    this.addRichLine("  <color=#CE831E>delete 1</color>       - 按编号删除存档");
    this.addRichLine("  <color=#CE831E>delete 玩家名</color>  - 按姓名删除存档");
    this.addRichLine("  <color=#CE831E>password</color>       - 获取临时密码");
    this.addRichLine("  <color=#CE831E>help</color>           - 显示此帮助");
    this.addRichLine("  <color=#CE831E>喵</color>             - 开启 AI 对话（quit 退出）");
  }

  startLogin() {
    if (!this.loginSystem) {
      this.loginSystem = this.node.addComponent(LoginSystem);
    }

    this.gameState = "LOGIN";

    this.loginSystem.init({
      onPrompt: (text: string, color?: string) => {
        this.addRichLine(text, color || "#FFFFFF");
      },
      onError: (text: string) => {
        this.addRichLine(text, "#FF5555");
      },
      onSuccess: (username: string, birthday: string) => {
        this.characterSystem.cancelPendingUnlock();
        this.gameState = "MAIN";
        this.playerName = username;
        this.isTimelineCompleted = false;
        this.isAnswerMode = false;
        this.caseQuizAnswers = {};
        this.hasPendingCaseQuizSubmit = false;

        this.saveSystem.newGame(username);
        this.syncHpBarFromGameData();

        this.showTerminalMain();
        this.startTiming();
      },
      onCancel: () => {
        this.gameState = "BOOT";
        this.addRichLine(
          "已返回初始终端。输入 <color=#CE831E>login</color> 可重新登录。",
          "#AAAAAA",
        );
      },
    });
  }

  // ─── 多存档：展示列表 ──────────────────────────────────────────

  private showSaveList() {
    const saves = this.saveSystem.getAllSaves();

    if (saves.length === 0) {
      this.addRichLine("没有找到存档。输入 <color=#CE831E>login</color> 开始新游戏。", "#FF5555");
      return;
    }

    this.addRichLine("", "#FFFFFF");
    this.addRichLine("========== 存档列表 ==========", "#00FF00");

    saves.forEach((meta, idx) => {
      const dateStr = this.formatSaveDate(meta.savedAt);
      const timeStr = this.formatPlayTimeShort(meta.totalPlayTimeSeconds);
      // 直接从存档文件读 isDeath，索引值可能因历史问题不准确
      const isDead = this.saveSystem.readIsDeath(meta.saveId);
      const deathTag = isDead ? " <color=#FF5555>[死亡]</color>" : "";
      this.addRichLine(
        `${idx + 1}. <color=#CE831E>${meta.playerName}</color>  解锁 ${meta.unlockedCount}/5  ${timeStr}  ${dateStr}${deathTag}`,
      );
    });

    this.addRichLine("", "#FFFFFF");
    this.addRichLine(
      `输入 <color=#CE831E>load 1</color>~<color=#CE831E>${saves.length}</color> 加载对应存档，输入 <color=#CE831E>login</color> 新建存档。`,
      "#AAAAAA",
    );
  }

  private handleLoadByNumber(cmd: string) {
    const arg = cmd.replace(/^load\s+/i, "").trim();
    const saves = this.saveSystem.getAllSaves();

    if (saves.length === 0) {
      this.addRichLine("没有找到存档。输入 <color=#CE831E>login</color> 开始新游戏。", "#FF5555");
      return;
    }

    // 纯数字 → 按编号加载
    if (/^\d+$/.test(arg)) {
      const num = parseInt(arg, 10);
      if (num < 1 || num > saves.length) {
        this.addRichLine(
          `存档编号超出范围 (1-${saves.length})。输入 <color=#CE831E>load</color> 查看列表。`,
          "#FF5555",
        );
        return;
      }
      this.pauseAndSaveTiming();
      this.loadGameAndStartById(saves[num - 1].saveId);
      return;
    }

    // 按玩家姓名匹配（取最新一条）
    const match = saves.find(
      (m) => m.playerName.toLowerCase() === arg.toLowerCase(),
    );
    if (!match) {
      this.addRichLine(
        `未找到名为"${arg}"的存档。输入 <color=#CE831E>load</color> 查看列表。`,
        "#FF5555",
      );
      return;
    }
    this.pauseAndSaveTiming();
    this.loadGameAndStartById(match.saveId);
  }

  // ─── 删除存档 ────────────────────────────────────────────────────

  private handleDeleteSave(cmd: string) {
    const arg = cmd.replace(/^(delete|del)\s+/i, "").trim();
    const saves = this.saveSystem.getAllSaves();

    if (saves.length === 0) {
      this.addRichLine("没有可删除的存档。", "#FF5555");
      return;
    }

    if (!arg) {
      this.addRichLine(
        "请指定要删除的存档：<color=#CE831E>delete 1</color> 或 <color=#CE831E>delete 玩家名</color>",
        "#FF5555",
      );
      return;
    }

    let targetMeta = null;
    if (/^\d+$/.test(arg)) {
      const num = parseInt(arg, 10);
      if (num >= 1 && num <= saves.length) {
        targetMeta = saves[num - 1];
      }
    } else {
      targetMeta = saves.find(
        (m) => m.playerName.toLowerCase() === arg.toLowerCase(),
      );
    }

    if (!targetMeta) {
      this.addRichLine(
        `未找到存档"${arg}"。输入 <color=#CE831E>load</color> 查看列表。`,
        "#FF5555",
      );
      return;
    }

    this.pendingDeleteSaveId = targetMeta.saveId;
    const dateStr = this.formatSaveDate(targetMeta.savedAt);
    this.addRichLine(
      `确认删除 <color=#CE831E>${targetMeta.playerName}</color> 的存档（${dateStr}）？`,
      "#FF5555",
    );
    this.addRichLine(
      `输入 <color=#CE831E>yes</color> 确认，输入其他任意指令取消。`,
      "#FFAA00",
    );
  }

  private checkDeleteConfirm(cmd: string): boolean {
    if (!this.pendingDeleteSaveId) return false;

    if (cmd.toLowerCase() === "yes") {
      const saveId = this.pendingDeleteSaveId;
      this.pendingDeleteSaveId = "";
      this.saveSystem.deleteSaveById(saveId);
      this.addRichLine("存档已删除。", "#00FF00");
      const remaining = this.saveSystem.getAllSaves();
      if (remaining.length > 0) {
        this.showSaveList();
      } else {
        this.addRichLine(
          "暂无存档。输入 <color=#CE831E>login</color> 开始新游戏。",
          "#AAAAAA",
        );
      }
    } else {
      this.pendingDeleteSaveId = "";
      this.addRichLine("已取消删除。", "#AAAAAA");
    }
    return true;
  }

  // ─── 按 ID 加载指定存档 ─────────────────────────────────────────

  private loadGameAndStartById(saveId: string) {
    const saveData = this.saveSystem.loadGameById(saveId);
    if (!saveData) {
      this.addRichLine("存档加载失败，文件可能已损坏。", "#FF5555");
      return;
    }

    this.exitAiChat(false);
    this.stopSosVideo();
    this.characterSystem.cancelPendingUnlock();
    this.playerName = this.saveSystem.getPlayerName();
    this.isTimelineCompleted = this.saveSystem.isTimelineCompleted();
    GameData.timelineCompleted = this.isTimelineCompleted;

    // 死亡存档检测：先设 GAMEOVER 再同步血条，防止死亡回调触发死锁
    if (saveData.isDeath || GameData.playerHp <= 0) {
      this.gameState = "GAMEOVER";
      if (this.content) this.content.removeAllChildren();
      this.syncHpBarFromGameData();

      if (this.gameOverPanel) {
        this.gameOverPanel.active = true;
      }

      this.addRichLine("", "#FF5555");
      this.addRichLine("========================================", "#FF5555");
      this.addRichLine(`  侦探 ${this.playerName} — 上次调查以失败告终`, "#FF5555");
      this.addRichLine("========================================", "#FF5555");
      this.addRichLine(`已解锁人物: ${this.saveSystem.getUnlockedCount()}/5`, "#CE831E");
      this.addRichLine(`累计游戏时长: ${this.saveSystem.getFormattedPlayTime()}`, "#CE831E");
      this.addRichLine(`总死亡次数: ${this.saveSystem.getDeathCount()}`, "#CE831E");
      this.addRichLine("", "#FFFFFF");
      this.addRichLine("========== 可用命令 ==========", "#FFFF55");
      this.addRichLine("  <color=#CE831E>restart</color>  - 开始新游戏", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>load</color>     - 查看其他存档", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>quit</color>     - 返回主菜单", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>sos</color>      - 看广告复活", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>delete</color>   - 删除存档", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>status</color>   - 查看状态", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>achievements</color> - 查看成就", "#FFFFFF");
      this.addRichLine("  <color=#CE831E>help</color>     - 查看帮助", "#FFFFFF");
      this.addRichLine("==============================", "#FFFF55");
      return;
    }

    this.syncHpBarFromGameData();

    this.gameState = "MAIN";
    this.isAnswerMode = false;
    this.hasPendingCaseQuizSubmit = false;

    if (this.content) {
      this.content.removeAllChildren();
    }

    this.showTerminalMain();

    this.addRichLine("存档加载成功。", "#00FF00");
    this.addRichLine(
      `游戏时长: ${this.saveSystem.getFormattedPlayTime()}`,
      "#CE831E",
    );
    this.addRichLine(
      `已解锁人物: ${this.saveSystem.getUnlockedCount()}/5`,
      "#CE831E",
    );
    this.addRichLine(
      `当前生命值: ${GameData.playerHp}/${GameData.playerMaxHp}`,
      "#FFFF55",
    );

    if (this.isTimelineCompleted) {
      this.addRichLine(
        "时间线已完成，输入 <color=#CE831E>accuse</color> 进行指认。",
        "#CE831E",
      );
    }

    this.startTiming();
  }

  // ─── 格式化辅助（存档列表显示用）──────────────────────────────────

  private formatSaveDate(timestamp: number): string {
    const d = new Date(timestamp);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours();
    const rawMin = d.getMinutes();
    const min = rawMin < 10 ? `0${rawMin}` : `${rawMin}`;
    return `${m}/${day} ${h}:${min}`;
  }

  private formatPlayTimeShort(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h${mins}m`;
    }
    return `${minutes}m${secs}s`;
  }

  showTerminalMain() {
    this.addLine("");
    this.addLine("=========================================", "#00FF00");
    this.addLine("  YKW 内部调查系统 - 已授权访问", "#00FF00");
    this.addLine("=========================================", "#00FF00");
    this.addLine("");
    this.addLine(`欢迎，侦探 ${this.playerName || "侦探"}。`);
    this.addLine("");
    this.addLine("案件: David遇害案");
    this.addLine("时间: 2024年12月24日");
    this.addLine("");
    this.addLine("五名嫌疑人: Alex, Ben, Cathy, Diana, Elsa");
    this.addLine("");
    this.addRichLine(
      "输入 <color=#CE831E>help</color> 查看可用指令。",
      "#FFFFFF",
    );
  }

  processMainCommand(cmd: string) {
    const rawCmd = cmd.trim();
    const lowerCmd = rawCmd.toLowerCase();

    // 解锁方式选择和密码作答都由 CharacterSystem 持续接管输入，直到完成或取消。
    if (this.characterSystem && this.characterSystem.hasPendingUnlock()) {
      this.characterSystem.handleUnlockConfirm(rawCmd);
      return;
    }

    if (this.isAnswerMode) {
      this.handleAnswerModeInput(rawCmd);
      return;
    }

    if (CHARACTER_IDS.includes(lowerCmd)) {
      this.characterSystem.viewCharacter(lowerCmd);
      return;
    }

    if (lowerCmd === "help") {
      this.showMainHelp();
    } else if (lowerCmd === "help -v" || lowerCmd === "help --all" || lowerCmd === "help all") {
      this.showMainHelpVerbose();
    } else if (lowerCmd === "thing" || lowerCmd.startsWith("thing ")) {
      this.handleThingCommand(lowerCmd);
    } else if (lowerCmd === "word" || lowerCmd.startsWith("word ")) {
      this.handleWordCommand(lowerCmd);
    } else if (lowerCmd === "answer" || lowerCmd === "timeline") {
      this.startCaseQuiz();
    } else if (lowerCmd === "accuse") {
      this.handleAccuseCommand();
    } else if (lowerCmd.startsWith("accuse ")) {
      this.handleAccuseChoice(lowerCmd);
    } else if (lowerCmd === "save") {
      this.handleSave();
    } else if (lowerCmd === "load") {
      this.handleLoad();
    } else if (lowerCmd.startsWith("load ")) {
      this.handleLoadByNumber(lowerCmd);
    } else if (lowerCmd === "delete" || lowerCmd === "del") {
      this.addRichLine(
        "请指定要删除的存档：<color=#CE831E>delete 1</color> 或 <color=#CE831E>delete 玩家名</color>",
        "#AAAAAA",
      );
    } else if (lowerCmd.startsWith("delete ") || lowerCmd.startsWith("del ")) {
      this.handleDeleteSave(lowerCmd);
    } else if (lowerCmd === "exit") {
      this.handleExit();
    } else if (lowerCmd === "status") {
      this.showGameStatus();
    } else if (lowerCmd === "bag") {
      this.showBag();
    } else if (lowerCmd === "sos") {
      this.handleSos();
    } else if (lowerCmd === "achievement" || lowerCmd === "achievements") {
      this.showAchievements();
    } else if (lowerCmd === "testhurt") {
      this.handleTestHurt();
    } else if (lowerCmd === this.playerName.toLowerCase()) {
      this.addRichLine("<color=#CE831E>*** 彩蛋触发 ***</color>");
      this.addRichLine(`“${this.playerName}侦探，看来你已经发现了这个秘密...”`);
      this.addRichLine("你会成为YKW的新任CEO吗？");
    } else if (lowerCmd === "password") {
      this.addRichLine("你已经登录了，不需要再次获取密码。");
    } else if (lowerCmd === "login") {
      this.addRichLine("你已经登录了。如需重新开始，请先输入 exit 保存退出。", "#AAAAAA");
    } else {
      this.addRichLine(
        `<color=#FF5555>未知指令: ${rawCmd}</color>，输入<color=#CE831E>help</color>查看可用指令`,
      );
    }
  }

  showMainHelp() {
    const unlocked = this.characterSystem ? this.characterSystem.getUnlockedCount() : 0;
    const step = this.isTimelineCompleted || GameData.timelineCompleted
      ? "输入 <color=#CE831E>accuse</color> 指认真凶"
      : unlocked >= 5
        ? "输入 <color=#CE831E>answer</color> 整理时间线"
        : `解锁人物 (${unlocked}/5)：输入 <color=#CE831E>Alex / Ben / Cathy / Diana / Elsa</color>`;

    this.addRichLine("========== 核心指令 ==========", "#00FF00");
    this.addRichLine(`当前任务：${step}`, "#FFFF55");
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>[人物名]</color>        - 查看档案 / 选择推箱子或密码题解锁");
    this.addRichLine("  <color=#CE831E>thing / word</color>    - 证物列表 / 证词列表");
    this.addRichLine("  <color=#CE831E>answer</color>          - 案件时间线梳理（全部解锁后）");
    this.addRichLine("  <color=#CE831E>accuse</color>          - 指认真凶（时间线完成后）");
    this.addRichLine("  <color=#CE831E>achievement</color>     - 查看成就系统");
    this.addRichLine("  <color=#CE831E>喵</color>              - 开启 AI 对话（quit 退出）");
    this.addRichLine("  <color=#CE831E>status</color>          - 游戏状态 / 生命值");
    this.addRichLine("  <color=#CE831E>bag</color>             - 背包");
    this.addRichLine("  <color=#CE831E>sos</color>             - 看广告回满血");
    this.addRichLine("  <color=#CE831E>load</color>            - 查看存档列表");
    this.addRichLine("  <color=#CE831E>save / exit</color>     - 保存 / 保存并退出");
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("输入 <color=#CE831E>help -v</color> 查看完整指令说明。", "#AAAAAA");
  }

  private showMainHelpVerbose() {
    this.addRichLine("========== 完整指令列表 ==========", "#00FF00");
    this.addRichLine("  <color=#CE831E>help</color>               - 精简帮助  |  <color=#CE831E>help -v</color> - 完整帮助");
    this.addRichLine("  <color=#CE831E>[人物名]</color>           - 查看/解锁档案 Alex / Ben / Cathy / Diana / Elsa");
    this.addRichLine("    解锁方式：<color=#CE831E>1</color> 推箱子 / <color=#CE831E>2</color> 密码题 / <color=#CE831E>no</color> 取消");
    this.addRichLine("    密码作答：直接输入明文；<color=#CE831E>question</color> 重看题目 / <color=#CE831E>back</color> 重选方式");
    this.addRichLine("  <color=#CE831E>thing</color>              - 证物列表（简述）");
    this.addRichLine("  <color=#CE831E>thing Alex</color>         - Alex 的具体证物");
    this.addRichLine("  <color=#CE831E>thing all</color>          - 所有已解锁人物的具体证物");
    this.addRichLine("  <color=#CE831E>word</color>               - 证词列表（简述）");
    this.addRichLine("  <color=#CE831E>word Alex</color>          - Alex 的具体证词");
    this.addRichLine("  <color=#CE831E>word all</color>           - 所有已解锁人物的具体证词");
    this.addRichLine("  <color=#CE831E>answer</color>             - 全部人物解锁后进行时间线梳理");
    this.addRichLine("  <color=#CE831E>accuse</color>             - 时间线完成后指认真凶");
    this.addRichLine("  <color=#CE831E>accuse 1-7</color>         - 直接指认对应编号的嫌疑人");
    this.addRichLine("  <color=#CE831E>achievement</color>        - 查看成就系统");
    this.addRichLine("  <color=#CE831E>喵</color>                 - 开启 AI 对话（quit 退出）");
    this.addRichLine("  <color=#CE831E>save</color>               - 保存当前进度");
    this.addRichLine("  <color=#CE831E>load</color>               - 查看存档列表");
    this.addRichLine("  <color=#CE831E>load 1</color>             - 按编号读取存档");
    this.addRichLine("  <color=#CE831E>load 玩家名</color>        - 按姓名读取存档");
    this.addRichLine("  <color=#CE831E>delete 1</color>           - 按编号删除存档");
    this.addRichLine("  <color=#CE831E>delete 玩家名</color>      - 按姓名删除存档");
    this.addRichLine("  <color=#CE831E>status</color>             - 查看游戏状态与统计");
    this.addRichLine("  <color=#CE831E>bag</color>                - 查看背包");
    this.addRichLine("  <color=#CE831E>sos</color>                - 观看广告并回满生命值");
    this.addRichLine("  <color=#CE831E>exit</color>               - 保存并返回主菜单");
    this.addRichLine("  <color=#CE831E>[你的名字]</color>         - ???");
  }

  private handleThingCommand(cmd: string) {
    const parts = cmd.trim().split(/\s+/);
    const target = parts[1]?.toLowerCase();

    if (!target) {
      this.showThingList();
      return;
    }

    if (target === "all") {
      this.showAllThings();
      return;
    }

    this.showCharacterThing(target);
  }

  private handleWordCommand(cmd: string) {
    const parts = cmd.trim().split(/\s+/);
    const target = parts[1]?.toLowerCase();

    if (!target) {
      this.showWordList();
      return;
    }

    if (target === "all") {
      this.showAllWords();
      return;
    }

    this.showCharacterWord(target);
  }

  showThingList() {
    this.addRichLine("证物列表与简述：", "#00FF00");
    this.addRichLine("");
    this.addRichLine("【初始证物】", "#CE831E");

    InitialEvidenceList.forEach((item, index) => {
      const mark = String.fromCharCode("A".charCodeAt(0) + index);
      this.addRichLine(`${mark}. ${item.title}：${this.getShortText(item.content, 54)}`, "#FFFFFF");
    });

    this.addRichLine("");
    this.addRichLine("【人物相关证物】", "#CE831E");

    CHARACTER_IDS.forEach((id) => {
      const character = getCharacter(id);
      if (!character) return;

      if (character.isUnlocked) {
        this.addRichLine(`【${character.name}】已解锁：${character.description}`, "#FFFFFF");
        this.addRichLine(
          `输入 <color=#CE831E>thing ${character.name}</color> 查看具体证物。`,
          "#AAAAAA",
        );
      } else {
        this.addRichLine(
          `【${character.name}】未解锁。输入 <color=#CE831E>${character.name}</color> 完成安全验证后查看。`,
          "#AAAAAA",
        );
      }
    });

    this.addRichLine("");
    this.addRichLine(
      "输入 <color=#CE831E>thing all</color> 可查看所有已解锁人物的具体证物。",
      "#CE831E",
    );
  }

  showWordList() {
    this.addRichLine("证词列表与简述：", "#00FF00");

    CHARACTER_IDS.forEach((id) => {
      const character = getCharacter(id);
      if (!character) return;

      this.addRichLine("");

      if (character.isUnlocked) {
        this.addRichLine(`【${character.name}】${character.role}（已解锁）`, "#CE831E");
        this.addRichLine(`简述：${character.description}`, "#FFFFFF");
        this.addRichLine(
          `输入 <color=#CE831E>word ${character.name}</color> 查看具体证词。`,
          "#AAAAAA",
        );
      } else {
        this.addRichLine(
          `【${character.name}】未解锁。输入 <color=#CE831E>${character.name}</color> 完成安全验证后查看。`,
          "#AAAAAA",
        );
      }
    });

    this.addRichLine("");
    this.addRichLine(
      "输入 <color=#CE831E>word all</color> 可查看所有已解锁人物的具体证词。",
      "#CE831E",
    );
  }

  private showCharacterThing(target: string) {
    const character = this.getUnlockedCharacterByTarget(target, "证物");
    if (!character) return;

    this.addRichLine("");
    this.addRichLine(`【${character.name}】具体证物：`, "#00FF00");

    character.evidence.forEach((evidence) => {
      this.addParagraphText(`${evidence.id}. ${evidence.text}`, "#FFFFFF");
    });
  }

  private showCharacterWord(target: string) {
    const character = this.getUnlockedCharacterByTarget(target, "证词");
    if (!character) return;

    this.addRichLine("");
    this.addRichLine(`【${character.name}】具体证词：`, "#00FF00");
    this.addParagraphText(character.testimony, "#FFFFFF");
  }

  private showAllThings() {
    this.addRichLine("全部具体证物：", "#00FF00");

    this.addRichLine("");
    this.addRichLine("【初始证物】", "#CE831E");

    InitialEvidenceList.forEach((item, index) => {
      const mark = String.fromCharCode("A".charCodeAt(0) + index);
      this.addRichLine(`${mark}. ${item.title}`, "#FFFFFF");
      this.addParagraphText(item.content, "#AAAAAA");
    });

    const unlocked = this.characterSystem.getUnlockedCharacterList();

    if (unlocked.length === 0) {
      this.addRichLine("", "#FFFFFF");
      this.addRichLine("暂无已解锁人物证物。输入人物名并完成安全验证后查看。", "#FF5555");
      return;
    }

    unlocked.forEach((character) => {
      this.addRichLine("", "#FFFFFF");
      this.addRichLine(`【${character.name}】具体证物：`, "#CE831E");
      character.evidence.forEach((evidence) => {
        this.addParagraphText(`${evidence.id}. ${evidence.text}`, "#FFFFFF");
      });
    });
  }

  private showAllWords() {
    this.addRichLine("全部具体证词：", "#00FF00");

    const unlocked = this.characterSystem.getUnlockedCharacterList();

    if (unlocked.length === 0) {
      this.addRichLine(
        "暂无已解锁证词。输入 Alex / Ben / Cathy / Diana / Elsa 并完成安全验证后查看。",
        "#FF5555",
      );
      return;
    }

    unlocked.forEach((character) => {
      this.addRichLine("", "#FFFFFF");
      this.addRichLine(`【${character.name}】${character.role}`, "#CE831E");
      this.addParagraphText(character.testimony, "#FFFFFF");
    });
  }

  private getUnlockedCharacterByTarget(
    target: string,
    dataName: "证物" | "证词",
  ): Character | null {
    const character = getCharacter(target.toLowerCase());

    if (!character) {
      this.addRichLine(
        `未找到人物：${target}。可用人物名：Alex / Ben / Cathy / Diana / Elsa`,
        "#FF5555",
      );
      return null;
    }

    if (!character.isUnlocked) {
      this.addRichLine(
        `【${character.name}】尚未解锁，无法查看${dataName}。输入 <color=#CE831E>${character.name}</color> 完成安全验证后查看。`,
        "#FF5555",
      );
      return null;
    }

    return character;
  }

  private startCaseQuiz() {
    if (!this.characterSystem.isAllUnlocked()) {
      this.addRichLine("证据不足。请先解锁所有嫌疑人档案。", "#FF5555");
      this.addRichLine(
        `当前已解锁：${this.characterSystem.getUnlockedCount()}/5`,
        "#FFFF55",
      );
      return;
    }

    if (GameData.timelineCompleted || this.isTimelineCompleted) {
      this.addRichLine("案件时间线已经完成。", "#00FF00");
      this.addRichLine(
        "输入 <color=#CE831E>accuse</color> 进行最终指认。",
        "#CE831E",
      );
      return;
    }

    this.isAnswerMode = true;
    this.hasPendingCaseQuizSubmit = false;

    this.addRichLine("", "#FFFFFF");
    this.addRichLine("案件时间线梳理已启动。", "#00FF00");
    this.addRichLine("填写方式支持三种：", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>方式1</color>：顺序填充 - 直接输入一串字母 <color=#CE831E>ABCDABCDABC</color>", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>方式2</color>：按空号填 - 输入空号+选项 <color=#CE831E>1A 2B 3C</color> 或 <color=#CE831E>1A2B3C</color>", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>方式3</color>：删除/清空 - 输入 <color=#CE831E>-3</color> 或 <color=#CE831E>3-</color> 删除第3空", "#FFFFFF");
    this.addRichLine(
      "提示：用空格、_ 或 - 在顺序模式中跳过某一空，例如 <color=#CE831E>ABCD ABCDAB</color>",
      "#FFFFFF",
    );
    this.addRichLine(
      "输入后系统会显示已填好的完整时间线，并给出当前分数、答错数量和未填写数量。",
      "#FFFFFF",
    );
    this.addRichLine(
      "确认提交时输入 <color=#CE831E>submit</color>。提交后将标红错误答案，并按错误题数扣血：<color=#FF5555>每个错误 -5 血</color>，答对及未填不扣分。",
      "#FFFFFF",
    );
    this.addRichLine("输入 <color=#CE831E>exit</color> 可退出案件梳理。", "#AAAAAA");

    this.showCaseQuiz();
  }

  private showCaseQuizInputGuide() {
    this.addRichLine("时间线模式支持三种输入格式：", "#FF5555");
    this.addRichLine(
      "1. 顺序填充：<color=#CE831E>ABCDABCDABC</color>（直接输入字母，可用空格/_ /- 跳过）",
      "#FFFF55",
    );
    this.addRichLine(
      "2. 按空号填：<color=#CE831E>1A 2B 3C</color> 或 <color=#CE831E>1A2B3C</color>（指定空号和答案）",
      "#FFFF55",
    );
    this.addRichLine(
      "3. 删除/清空：<color=#CE831E>-3</color> 或 <color=#CE831E>3-</color>（删除第3空的答案）",
      "#FFFF55",
    );
    this.addRichLine(
      "命令：<color=#CE831E>exit</color>/<color=#CE831E>quit</color>/<color=#CE831E>cancel</color> 退出 | <color=#CE831E>answer</color> 查看题目 | <color=#CE831E>preview</color> 预览答案 | <color=#CE831E>submit</color> 提交结算",
      "#AAAAAA",
    );
  }

  private showCaseQuiz() {
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【案件经过】", "#00FF00");
    this.addParagraphText(CaseQuizText, "#FFFFFF");

    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【填空选项】", "#00FF00");

    CaseQuizBlanks.forEach((blank) => {
      const optionText = blank.options
        .map((option) => `${option.key}. ${option.text}`)
        .join("    ");
      this.addRichLine(`空${blank.id}：${optionText}`, "#FFFFFF");
    });

    this.showCaseQuizProgress();
  }

  private handleAnswerModeInput(input: string) {
    const rawInput = input.replace(/\t/g, " ");
    const command = rawInput.trim().toLowerCase();

    if (command === "exit" || command === "quit" || command === "cancel") {
      this.isAnswerMode = false;
      this.hasPendingCaseQuizSubmit = false;
      this.addRichLine("已退出案件时间线梳理。当前答案会暂时保留。", "#CE831E");
      return;
    }

    if (command === "answer" || command === "timeline") {
      this.showCaseQuiz();
      return;
    }

    if (command === "progress" || command === "status" || command === "preview") {
      this.showCaseQuizAttemptResult();
      return;
    }

    if (command === "submit" || command === "check" || command === "yes") {
      this.submitCaseQuizAnswers();
      return;
    }

    this.applyCaseQuizAnswerSequence(rawInput);
  }

  private applyCaseQuizAnswerSequence(input: string) {
    const total = CaseQuizBlanks.length;
    const nextAnswers: Record<number, CaseQuizChoice> = { ...this.caseQuizAnswers };
    const trimmedInput = input.trim();

    // 检测输入格式：是否为"数字字母"格式（如 1A 2B 3C）或标准字母序列
    const isNumberFormat = /\d+[A-Da-d]|^\d+\-|\s\d+[A-Da-d]|\s\d+\-/.test(trimmedInput);

    try {
      if (isNumberFormat) {
        // 处理"数字字母"或"删除"格式：1A 2B -3 或 1A2B3C-4
        this.parseNumberedAnswerFormat(trimmedInput, nextAnswers, total);
      } else {
        // 处理传统的字母序列格式：ABCDABCDABC
        this.parseSequentialAnswerFormat(trimmedInput, nextAnswers, total);
      }

      this.caseQuizAnswers = nextAnswers;
      this.hasPendingCaseQuizSubmit = true;

      this.addRichLine("", "#FFFFFF");
      this.addRichLine("本次答案已记录。", "#00FF00");

      this.showCaseQuizAttemptResult();
    } catch (error) {
      this.addRichLine("", "#FFFFFF");
      this.addRichLine(`输入格式错误：${error}`, "#FF5555");
      this.showCaseQuizInputGuide();
    }
  }

  private parseNumberedAnswerFormat(input: string, answers: Record<number, CaseQuizChoice>, total: number) {
    // 解析"1A"、"2B"、"-3"等格式
    // 支持有空格或无空格：1A 2B 3C 或 1A2B3C
    // 删除格式：-3 或 3-
    
    let current = "";
    const patterns: Array<{ id: number; action: "set" | "delete"; value?: string }> = [];

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      const next = input[i + 1];

      if (ch === " " || ch === "\t") {
        if (current) {
          this.parseNumberedToken(current, patterns, total);
          current = "";
        }
        continue;
      }

      if (ch === "-") {
        if (current) {
          this.parseNumberedToken(current, patterns, total);
          current = "";
        }
        // 收集数字作为删除项
        let num = "";
        let j = i + 1;
        while (j < input.length && /\d/.test(input[j])) {
          num += input[j];
          j++;
        }
        if (num) {
          const blankId = parseInt(num, 10);
          patterns.push({ id: blankId, action: "delete" });
          i = j - 1;
        }
        continue;
      }

      current += ch;
    }

    if (current) {
      this.parseNumberedToken(current, patterns, total);
    }

    // 应用所有操作
    patterns.forEach((p) => {
      if (p.action === "delete") {
        delete answers[p.id];
      } else if (p.value) {
        answers[p.id] = p.value;
      }
    });
  }

  private parseNumberedToken(token: string, patterns: Array<any>, total: number) {
    // 解析单个 token，如"1A"、"2B"、"10C"等
    const match = token.match(/^(\d+)([A-Da-d])$/);
    if (!match) {
      throw new Error(`无法解析 "${token}"，应为"空号+选项"格式，如"1A"或"2B"`);
    }

    const blankId = parseInt(match[1], 10);
    const answer = match[2].toUpperCase();

    if (blankId < 1 || blankId > total) {
      throw new Error(`空号 ${blankId} 超出范围（1-${total}）`);
    }

    patterns.push({ id: blankId, action: "set", value: answer });
  }

  private parseSequentialAnswerFormat(input: string, answers: Record<number, CaseQuizChoice>, total: number) {
    // 解析传统的顺序字母格式
    const chars = Array.from(input);
    const invalidChars: string[] = [];

    chars.forEach((ch) => {
      if (ch !== " " && ch !== "_" && ch !== "-" && !/^[ABCD]$/i.test(ch)) {
        invalidChars.push(ch);
      }
    });

    if (invalidChars.length > 0) {
      throw new Error(`发现非 A/B/C/D 的字符：${invalidChars.join(" ")}`);
    }

    // 重置答案为新的顺序填充
    const newAnswers: Record<number, CaseQuizChoice> = {};
    let answerIndex = 0;

    for (let i = 0; i < chars.length && answerIndex < total; i++) {
      const ch = chars[i];

      if (ch === " " || ch === "_" || ch === "-") {
        answerIndex++;
        continue;
      }

      const blankId = CaseQuizBlanks[answerIndex].id;
      newAnswers[blankId] = ch.toUpperCase();
      answerIndex++;
    }

    // 合并到现有答案（只覆盖前 answerIndex 个）
    for (let i = 0; i < answerIndex; i++) {
      const blankId = CaseQuizBlanks[i].id;
      newAnswers[blankId] = newAnswers[blankId] || answers[blankId];
    }

    Object.assign(answers, newAnswers);

    if (chars.length > total) {
      this.addRichLine(`提示：答案串超过 ${total} 个空，超出的内容已忽略。`, "#FFFF55");
    }
  }

  private submitCaseQuizAnswers() {
    if (!this.hasPendingCaseQuizSubmit) {
      this.addRichLine("还没有本次作答。请先输入答案串。", "#FF5555");
      return;
    }

    const stats = this.getCaseQuizStats();

    if (stats.wrongCount === 0 && stats.missingCount === 0) {
      this.isAnswerMode = false;
      this.hasPendingCaseQuizSubmit = false;
      this.isTimelineCompleted = true;
      GameData.timelineCompleted = true;
      this.saveSystem.setTimelineCompleted(true);
      this.handleSave(false);

      this.addRichLine("", "#00FF00");
      this.addRichLine("案件时间线梳理完成。", "#00FF00");
      this.addRichLine("Game Win", "#00FF00");
      this.addRichLine(
        "人物档案中的【动机 / 秘密】已开放。输入 <color=#CE831E>accuse</color> 进行最终指认。",
        "#CE831E",
      );
      return;
    }

    this.settleTimelineHp(stats);
    this.hasPendingCaseQuizSubmit = false;
  }

  private settleTimelineHp(stats: {
    total: number;
    correctCount: number;
    wrongCount: number;
    missingCount: number;
  }) {
    const hpPerWrong = 5;
    const totalErrorCount = stats.wrongCount + stats.missingCount;
    const loss = totalErrorCount * hpPerWrong;

    if (loss > 0) {
      GameData.reducePlayerHp(loss);
      this.addRichLine(
        `时间线结算：答对 ${stats.correctCount} 空 0 分，答错 ${stats.wrongCount} 空 -${stats.wrongCount * hpPerWrong} 血，未填 ${stats.missingCount} 空 -${stats.missingCount * hpPerWrong} 血，共计 -${loss} 血。`,
        "#FF5555",
      );
    } else {
      this.addRichLine(
        `时间线结算：答对 ${stats.correctCount} 空、答错 ${stats.wrongCount} 空、未填 ${stats.missingCount} 空，无扣分。`,
        "#00FF00",
      );
    }

    this.addRichLine(
      `当前生命值：${GameData.playerHp}/${GameData.playerMaxHp}`,
      "#FFFFFF",
    );
    this.addRichLine(
      `还有 ${totalErrorCount} 空未填对，请继续填写直到全部正确。`,
      "#CE831E",
    );

    this.syncHpBarFromGameData();
    this.saveSystem.updateHp(GameData.playerHp);
    
    // 显示详细的答题对比（错误答案标红）
    this.showCorrectCaseQuizAnswers();
    
    // 最后检查死亡，确保死亡信息在答题详情之后显示
    this.checkAndTriggerDeath();
  }

  private showCaseQuizAttemptResult() {
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【当前填空后的时间线】", "#00FF00");
    this.addParagraphText(this.getFilledCaseQuizText(false), "#FFFFFF");

    const stats = this.getCaseQuizStats();

    this.addRichLine("", "#FFFFFF");
    this.addRichLine(
      `当前分数：正确 ${stats.correctCount}/${stats.total}；答错 ${stats.wrongCount} 个空；未填写 ${stats.missingCount} 个空。`,
      stats.wrongCount === 0 && stats.missingCount === 0 ? "#00FF00" : "#CE831E",
    );
    this.addRichLine(
      "输入 <color=#CE831E>submit</color> 提交结算，或重新输入答案串覆盖本次作答。",
      "#AAAAAA",
    );
  }

  private showCorrectCaseQuizAnswers() {
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【你的答案（错误标红）】", "#FFFF55");

    const userAnswerLine = CaseQuizBlanks.map((blank) => {
      const answer = this.caseQuizAnswers[blank.id];
      if (!answer) {
        return `空${blank.id}:_`;
      }
      const option = blank.options.find((item) => item.key === answer);
      const text = option ? option.text : `选项${answer}`;
      
      if (answer !== blank.answer) {
        return `空${blank.id}:<color=#FF5555>${answer}.${text}</color>`;
      } else {
        return `空${blank.id}:${answer}.${text}`;
      }
    }).join("  ");

    this.addParagraphText(userAnswerLine, "#FFFFFF");

    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【你的答题时间线（错误标红）】", "#FFFF55");
    this.addParagraphText(this.getFilledCaseQuizText(false, true), "#FFFFFF");
  }

  private getCaseQuizStats(): {
    total: number;
    correctCount: number;
    wrongCount: number;
    missingCount: number;
  } {
    let correctCount = 0;
    let wrongCount = 0;
    let missingCount = 0;

    CaseQuizBlanks.forEach((blank) => {
      const answer = this.caseQuizAnswers[blank.id];

      if (!answer) {
        missingCount++;
      } else if (answer === blank.answer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    return {
      total: CaseQuizBlanks.length,
      correctCount,
      wrongCount,
      missingCount,
    };
  }

  private getFilledCaseQuizText(useCorrectAnswers: boolean, markErrors: boolean = false): string {
    let text = CaseQuizText;

    CaseQuizBlanks.forEach((blank) => {
      const answer = useCorrectAnswers ? blank.answer : this.caseQuizAnswers[blank.id];
      let replacement = `【空${blank.id}】`;

      if (answer) {
        const option = blank.options.find((item) => item.key === answer);
        const displayText = option ? option.text : `选项${answer}`;
        
        if (markErrors && !useCorrectAnswers && answer !== blank.answer) {
          // 标红错误答案
          replacement = `【<color=#FF5555>${displayText}</color>】`;
        } else {
          replacement = `【${displayText}】`;
        }
      }

      text = text.replace(new RegExp(`【空${blank.id}】`, "g"), replacement);
    });

    return text;
  }

  private showCaseQuizProgress() {
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("【当前填写进度】", "#CE831E");

    const progress = CaseQuizBlanks.map((blank) => {
      const answer = this.caseQuizAnswers[blank.id] || "_";
      return `空${blank.id}:${answer}`;
    }).join("  ");

    this.addParagraphText(progress, "#AAAAAA");
  }

  private handleAccuseCommand() {
    if (!this.isTimelineCompleted && !GameData.timelineCompleted) {
      this.addRichLine("证据不足，无法指认真凶。请先完成时间线整理。", "#FF5555");
      this.addRichLine("输入 <color=#CE831E>answer</color> 进行时间线整理。", "#FFFF55");
      return;
    }

    this.accuseSystem.showAccuseMenu();
  }

  private handleAccuseChoice(cmd: string) {
  if (!GameData.timelineCompleted) {
    this.addRichLine(
      "请先完成案件时间线梳理，再进行最终指认。",
      "#FF5555",
    );
    return;
  }

  if (!this.accuseSystem) {
    this.addRichLine("指认系统未初始化。", "#FF5555");
    return;
  }

  const choiceText = cmd.substring("accuse ".length).trim();
  const choice = Number(choiceText);

  if (!Number.isInteger(choice) || choice < 1 || choice > 7) {
    this.addRichLine("请输入 accuse 1-7 进行指认。", "#FF5555");
    return;
  }

  // 成就触发：错误指认
  // 1-4 是明确错误指认；5 是 Elsa 半成立结局，依旧计入“一步之遥”。
  if (choice >= 1 && choice <= 5) {
    this.unlockAchievement("wrong_accuse");
  }

  // 成就触发：选择“全员有罪”完整结局，并结算通关时间成就。
  if (choice === 6) {
    this.unlockAchievement("all_guilty");
    this.unlockClearTimeAchievement();
  }

  this.accuseSystem.handleAccuse(choice);
}

  private checkAllCharactersUnlocked() {
    const unlockedCount = this.characterSystem.getUnlockedCount();
    if (unlockedCount >= 5 && !this.isTimelineCompleted && !GameData.timelineCompleted) {
      this.addRichLine("", "#00FF00");
      this.addRichLine("========================================", "#00FF00");
      this.addRichLine("  所有嫌疑人档案已解锁", "#00FF00");
      this.addRichLine("  现在可以进行案件时间线梳理", "#FFFF55");
      this.addRichLine("========================================", "#00FF00");
      this.addRichLine(
        "输入 <color=#CE831E>answer</color> 开始整理时间线。",
        "#CE831E",
      );
    }
  }

  showAchievements() {
    if (!this.achievementSystem) {
      this.initAchievementSystem();
    }

    const achievements = this.achievementSystem.getAllAchievements();
    const unlockedCount = achievements.filter((item) => item.unlocked).length;

    this.addRichLine("========== 成就系统 ==========", "#00FF00");
    this.addRichLine(`已解锁：${unlockedCount}/${achievements.length}`, "#CE831E");

    achievements.forEach((achievement) => {
      if (achievement.unlocked) {
        this.addRichLine(
          `【已解锁】${achievement.title} - ${achievement.condition}`,
          "#FFD84D",
        );
        this.addRichLine(`  "${achievement.description}"`, "#FFFFFF");
      } else {
        this.addRichLine(
          `【未解锁】??? - ${achievement.condition}`,
          "#AAAAAA",
        );
      }
    });

    this.addRichLine("==============================", "#00FF00");
  }

  private unlockAchievement(id: AchievementId) {
    if (!this.achievementSystem) {
      this.initAchievementSystem();
    }

    const isNew = this.achievementSystem.unlock(id);
    if (!isNew) return;

    const info = this.achievementSystem.getAchievement(id);
    if (!info) return;

    this.addRichLine("========== 成就解锁 ==========", "#FFD84D");
    this.addRichLine(`【${info.title}】${info.condition}`, "#FFD84D");
    this.addRichLine(`"${info.description}"`, "#FFFFFF");
    this.addRichLine("==============================", "#FFD84D");
  }

  private unlockClearTimeAchievement() {
    if (!this.achievementSystem) {
      this.initAchievementSystem();
    }

    const totalSeconds = this.getCurrentTotalPlayTimeSeconds();
    const before = this.achievementSystem.getUnlockedIds();
    const id = this.achievementSystem.unlockByClearTime(totalSeconds);

    if (before.includes(id)) return;

    const info = this.achievementSystem.getAchievement(id);
    if (!info) return;

    this.addRichLine("========== 成就解锁 ==========", "#FFD84D");
    this.addRichLine(`【${info.title}】${info.condition}`, "#FFD84D");
    this.addRichLine(`"${info.description}"`, "#FFFFFF");
    this.addRichLine("==============================", "#FFD84D");
  }


  showBag() {
    this.addRichLine("背包：", "#00FF00");
    this.addRichLine("1. 临时调查权限");
    this.addRichLine("2. David的初步尸检报告");
    this.addRichLine("3. YKW内部终端访问记录");
    this.addRichLine(`4. 已解锁人物档案数量：${this.characterSystem.getUnlockedCount()}/5`);
    this.addRichLine("5. 输入 thing 查看证物列表；输入 thing Alex / thing all 查看详情");
    this.addRichLine("6. 输入 word 查看证词列表；输入 word Alex / word all 查看详情");
    this.addRichLine("7. 全部人物解锁后，输入 answer 进行案件时间线梳理");
    this.addRichLine("8. 时间线完成后，输入 accuse 进行最终指认");
  }

  handleSos() {
    if (this.isWaitingVideoComplete) {
      this.addRichLine("广告正在加载或播放，请稍候。", "#FFFF55");
      return;
    }

    const currentHp = GameData.playerHp;
    const maxHp = GameData.playerMaxHp;

    if (currentHp >= maxHp) {
      this.addRichLine("生命值已满，无需恢复。", "#FF5555");
      return;
    }

    if (!this.videoPlayer) {
      this.addRichLine("视频播放器未配置，无法播放广告。", "#FF5555");
      return;
    }

    if (this.videoList.length === 0) {
      this.addRichLine("广告视频加载中，或 resources/videos 中暂无视频。", "#FFFF55");
      this.loadAllVideos();
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.videoList.length);
    const selectedVideo = this.videoList[randomIndex];

    this.addRichLine(
      `正在加载广告视频... (${randomIndex + 1}/${this.videoList.length})`,
      "#FFFF55",
    );
    this.addRichLine("若未自动播放，请点击视频画面。", "#FFFF55");

    this.isWaitingVideoComplete = true;
    this.hasVideoStarted = false;
    this.videoSessionId++;

    try {
      this.videoPlayer.stop();
      if (!this.prepareOriginalVideoDisplay()) {
        this.failSosVideo("无法显示广告：请确认视频节点具有 UITransform，且终端位于已启用的 Canvas 下。");
        return;
      }

      // 先绑定事件，再切换资源，避免遗漏加载完成或加载失败的回调。
      this.bindSosVideoEvents();
      this.scheduleOnce(this.onSosVideoStartTimeout, 15);
      this.videoPlayer.resourceType = VideoPlayer.ResourceType.LOCAL;
      this.videoPlayer.clip = selectedVideo;
      if (!this.isWaitingVideoComplete) return;

      this.videoPlayer.currentTime = 0;
      this.videoPlayer.loop = false;
      this.videoPlayer.stayOnBottom = false;

      // 保留视频原始尺寸，仅把播放位置移到屏幕中央。
      this.setupOriginalSizeVideo(selectedVideo);
      this.tryPlaySosVideo();
    } catch (error) {
      this.onSosVideoError(error);
    }
  }

  private bindSosVideoEvents() {
    if (!this.videoPlayer) return;
    const node = this.videoPlayer.node;
    node.on(VideoPlayer.EventType.PLAYING, this.onSosVideoPlaying, this);
    node.on(VideoPlayer.EventType.COMPLETED, this.onVideoCompleteForSos, this);
    node.on(VideoPlayer.EventType.ERROR, this.onSosVideoError, this);
    node.on(VideoPlayer.EventType.META_LOADED, this.refreshSosVideoSize, this);
    node.on(VideoPlayer.EventType.READY_TO_PLAY, this.onSosVideoReady, this);
    node.on(VideoPlayer.EventType.CLICKED, this.tryPlaySosVideo, this);
  }

  private tryPlaySosVideo() {
    if (!this.isWaitingVideoComplete || this.hasVideoStarted || !this.videoPlayer) return;
    try {
      this.videoPlayer.play();
    } catch (error) {
      this.onSosVideoError(error);
    }
  }

  private onSosVideoReady() {
    this.refreshSosVideoSize();
    this.tryPlaySosVideo();
  }

  private refreshSosVideoSize() {
    if (!this.isWaitingVideoComplete) return;
    const size = this.getVideoSizeFromPlayer();
    if (size) this.applyVideoOriginalSize(size.width, size.height);
  }

  private onSosVideoPlaying() {
    if (!this.isWaitingVideoComplete || this.hasVideoStarted) return;
    this.hasVideoStarted = true;
    this.unschedule(this.onSosVideoStartTimeout);
    this.refreshSosVideoSize();
    this.addRichLine("广告正在播放，播放完成后恢复生命值。", "#00FF00");
  }

  private onSosVideoError(error?: unknown) {
    if (!this.isWaitingVideoComplete) return;
    console.error("广告视频播放失败", error);
    this.failSosVideo("广告播放失败，已恢复终端。请检查视频文件或浏览器播放权限，再输入 sos 重试。");
  }

  private onSosVideoStartTimeout() {
    if (!this.isWaitingVideoComplete || this.hasVideoStarted) return;
    this.failSosVideo("广告未能在 15 秒内开始播放，已恢复终端。请检查视频或播放权限后重试 sos。");
  }

  private failSosVideo(message: string) {
    if (!this.isWaitingVideoComplete) return;
    this.stopSosVideo();
    this.addRichLine(message, "#FF5555");
    this.resetInputBox();
  }

  private stopSosVideo() {
    this.isWaitingVideoComplete = false;
    this.hasVideoStarted = false;
    this.videoSessionId++;
    this.unschedule(this.onSosVideoStartTimeout);
    if (this.videoPlayer?.isValid && this.videoPlayer.node.isValid) {
      const node = this.videoPlayer.node;
      node.off(VideoPlayer.EventType.PLAYING, this.onSosVideoPlaying, this);
      node.off(VideoPlayer.EventType.COMPLETED, this.onVideoCompleteForSos, this);
      node.off(VideoPlayer.EventType.ERROR, this.onSosVideoError, this);
      node.off(VideoPlayer.EventType.META_LOADED, this.refreshSosVideoSize, this);
      node.off(VideoPlayer.EventType.READY_TO_PLAY, this.onSosVideoReady, this);
      node.off(VideoPlayer.EventType.CLICKED, this.tryPlaySosVideo, this);
      try {
        this.videoPlayer.stop();
      } catch (error) {
        console.warn("停止广告播放器失败", error);
      }
    }
    this.restoreOriginalVideoDisplay();
  }

  private prepareOriginalVideoDisplay(): boolean {
    if (!this.videoPlayerNode || !this.videoPlayer) return false;

    let canvasNode: Node | null = null;
    for (const startNode of [this.node, this.videoPlayerNode]) {
      let current: Node | null = startNode;
      while (current) {
        if (current.getComponent(Canvas) && current.activeInHierarchy) {
          canvasNode = current;
          break;
        }
        current = current.parent;
      }
      if (canvasNode) break;
    }

    const videoNode = this.videoPlayerNode;
    const transform = videoNode.getComponent(UITransform);
    const canvasTransform = canvasNode?.getComponent(UITransform);
    if (!canvasNode || !canvasTransform || !transform) return false;

    const widget = videoNode.getComponent(Widget);
    const opacity = videoNode.getComponent(UIOpacity);
    this.originalVideoDisplay = {
      parent: videoNode.parent,
      siblingIndex: videoNode.getSiblingIndex(),
      position: videoNode.getPosition(),
      scale: videoNode.getScale(),
      rotation: videoNode.getRotation(),
      layer: videoNode.layer,
      width: transform.width,
      height: transform.height,
      anchorX: transform.anchorX,
      anchorY: transform.anchorY,
      widgetEnabled: widget ? widget.enabled : null,
      opacity: opacity ? opacity.opacity : null,
      playerEnabled: this.videoPlayer.enabled,
    };

    // 放到 Canvas 下的独立前景层，避开终端裁切、隐藏的祖先节点和死亡面板遮挡。
    const overlay = new Node("SosVideoOverlay");
    this.videoOverlay = overlay;
    overlay.layer = canvasNode.layer;
    overlay.addComponent(UITransform).setContentSize(canvasTransform.width, canvasTransform.height);
    overlay.parent = canvasNode;
    overlay.setPosition(
      canvasTransform.width * (0.5 - canvasTransform.anchorX),
      canvasTransform.height * (0.5 - canvasTransform.anchorY),
      0,
    );
    overlay.setSiblingIndex(canvasNode.children.length - 1);

    this.videoPlayer.playOnAwake = false;
    this.videoPlayer.stayOnBottom = false;
    videoNode.active = false;
    if (widget) widget.enabled = false;
    if (opacity) opacity.opacity = 255;
    videoNode.parent = overlay;
    videoNode.layer = canvasNode.layer;
    videoNode.setPosition(0, 0, 0);
    videoNode.setRotationFromEuler(0, 0, 0);
    videoNode.setScale(1, 1, 1);
    transform.anchorX = 0.5;
    transform.anchorY = 0.5;
    if (transform.width <= 0 || transform.height <= 0) transform.setContentSize(640, 360);
    videoNode.active = true;
    this.videoPlayer.enabled = true;
    return true;
  }

  private applyVideoOriginalSize(videoWidth: number, videoHeight: number) {
    if (!this.videoPlayerNode || !Number.isFinite(videoWidth) || !Number.isFinite(videoHeight)) return;
    if (videoWidth <= 0 || videoHeight <= 0) return;
    this.videoPlayerNode.getComponent(UITransform)?.setContentSize(
      Math.round(videoWidth),
      Math.round(videoHeight),
    );
  }

  private getVideoSizeFromClip(clip: VideoClip): { width: number; height: number } | null {
    const rawClip = clip as any;

    const candidates = [
      rawClip,
      rawClip?._nativeAsset,
      rawClip?.nativeAsset,
      rawClip?._meta,
      rawClip?.meta,
      rawClip?._nativeAsset?._video,
      rawClip?.nativeAsset?._video,
    ];

    for (const item of candidates) {
      if (!item) continue;

      const width = Number(item.width ?? item.videoWidth ?? item._width ?? item.originalWidth ?? item.naturalWidth);
      const height = Number(item.height ?? item.videoHeight ?? item._height ?? item.originalHeight ?? item.naturalHeight);

      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    return null;
  }

  private getVideoSizeFromPlayer(): { width: number; height: number } | null {
    if (!this.videoPlayer) return null;

    const rawPlayer = this.videoPlayer as any;

    const candidates = [
      rawPlayer,
      rawPlayer.nativeVideo,
      rawPlayer._impl,
      rawPlayer._impl?._video,
      rawPlayer._impl?.video,
      rawPlayer._impl?._videoPlayer,
      rawPlayer._impl?._videoPlayer?._video,
      rawPlayer._impl?._videoPlayer?.video,
      rawPlayer._video,
      rawPlayer.video,
      rawPlayer._element,
      rawPlayer.videoElement,
      rawPlayer._videoElement,
    ];

    for (const item of candidates) {
      if (!item) continue;

      const width = Number(item.videoWidth ?? item.width ?? item.naturalWidth);
      const height = Number(item.videoHeight ?? item.height ?? item.naturalHeight);

      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    return null;
  }

  private getVideoNativeUrl(clip: VideoClip): string {
    const rawClip = clip as any;
    return String(rawClip?.nativeUrl || rawClip?._nativeUrl || rawClip?.url || "");
  }

  private loadVideoSizeFromHtml(
    clip: VideoClip,
    callback: (size: { width: number; height: number } | null) => void,
  ) {
    if (typeof document === "undefined") {
      callback(null);
      return;
    }

    const url = this.getVideoNativeUrl(clip);
    if (!url) {
      callback(null);
      return;
    }

    const video = document.createElement("video");
    let finished = false;

    const finish = (size: { width: number; height: number } | null) => {
      if (finished) return;

      finished = true;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();

      callback(size);
    };

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      finish(width > 0 && height > 0 ? { width, height } : null);
    };

    video.onerror = () => {
      finish(null);
    };

    video.src = url;
    video.load();

    setTimeout(() => {
      finish(null);
    }, 1500);
  }

  private setupOriginalSizeVideo(selectedVideo: VideoClip) {
    if (this.videoPlayer) {
      this.videoPlayer.keepAspectRatio = true;
      this.videoPlayer.fullScreenOnAwake = false;
    }

    const sessionId = this.videoSessionId;
    const applySize = (size: { width: number; height: number } | null) => {
      if (!size) return;
      if (!this.isWaitingVideoComplete) return;
      if (sessionId !== this.videoSessionId) return;
      if (this.videoPlayer?.clip !== selectedVideo) return;

      this.applyVideoOriginalSize(size.width, size.height);
    };

    // 优先直接读取 VideoClip 的导入元数据。
    applySize(this.getVideoSizeFromClip(selectedVideo));

    // 后续播放器尺寸由 META_LOADED / READY_TO_PLAY 回调更新。
    // Web 环境再读取真实 metadata；会话编号防止上一次广告的回调改动新广告。
    this.loadVideoSizeFromHtml(selectedVideo, applySize);
  }

  private restoreOriginalVideoDisplay() {
    const state = this.originalVideoDisplay;
    this.originalVideoDisplay = null;
    const videoNode = this.videoPlayerNode;
    if (videoNode?.isValid && state) {
      videoNode.active = false;
      videoNode.parent = state.parent?.isValid ? state.parent : null;
      if (videoNode.parent) videoNode.setSiblingIndex(state.siblingIndex);
      videoNode.layer = state.layer;
      videoNode.setPosition(state.position);
      videoNode.setScale(state.scale);
      videoNode.setRotation(state.rotation);
      const transform = videoNode.getComponent(UITransform);
      if (transform) {
        transform.anchorX = state.anchorX;
        transform.anchorY = state.anchorY;
        transform.setContentSize(state.width, state.height);
      }
      const widget = videoNode.getComponent(Widget);
      if (widget && state.widgetEnabled !== null) widget.enabled = state.widgetEnabled;
      const opacity = videoNode.getComponent(UIOpacity);
      if (opacity && state.opacity !== null) opacity.opacity = state.opacity;
      if (this.videoPlayer?.isValid) this.videoPlayer.enabled = state.playerEnabled;
    }
    if (this.videoOverlay?.isValid) this.videoOverlay.destroy();
    this.videoOverlay = null;
  }

  private onVideoCompleteForSos() {
    if (!this.isWaitingVideoComplete) return;
    this.stopSosVideo();
    const oldHp = GameData.playerHp;
    GameData.restorePlayerHp();
    this.syncHpBarFromGameData();
    this.saveSystem.updateHp(GameData.playerHp);

    this.addRichLine("广告播放完毕。", "#00FF00");
    this.addRichLine(`生命值已恢复 ${GameData.playerHp - oldHp} 点。`, "#00FF00");
    this.addRichLine(`当前生命值: ${GameData.playerHp}/${GameData.playerMaxHp}`, "#00FF00");

    // 如果是游戏结束状态，需要恢复游戏
    if (this.gameState === "GAMEOVER") {
      // 清除死亡状态
      this.saveSystem.clearDeathState();
      
      // 恢复计时
      this.resumeTiming();
      
      // 切换回 MAIN 状态
      this.gameState = "MAIN";
      this.isAnswerMode = false;
      this.hasPendingCaseQuizSubmit = false;
      
      // 关闭 gameOverPanel
      if (this.gameOverPanel) {
        this.gameOverPanel.active = false;
      }
      
      // 清空死亡界面
      if (this.content) {
        this.content.removeAllChildren();
      }
      
      // 重新显示主终端
      this.showTerminalMain();
      this.addRichLine("神奇力量介入中！继续调查吧，幸运的侦探。", "#00FF00");
    }

    this.saveSystem.setHasWatchedAd();
    this.unlockAchievement("watch_ad");

    this.handleSave(false); // SOS 恢复后自动保存

    this.scheduleOnce(() => {
      if (this.inputBox && this.inputBox.enabled) {
        this.inputBox.focus();
      }
    }, 0.1);
  }

  private handleSave(showMessage: boolean = true) {
    const elapsed = this.pauseTiming();
    this.saveHpToGameData();
    this.saveSystem.saveGame(elapsed);

    if (showMessage) {
      this.addRichLine(
        `游戏已保存。游戏时长: ${this.saveSystem.getFormattedPlayTime()}`,
        "#00FF00",
      );
    }

    this.resumeTiming();
  }

  private handleLoad() {
    this.pauseAndSaveTiming();
    this.showSaveList();
  }

  private handleExit() {
    this.pauseAndSaveTiming();
    this.addRichLine(
      `游戏已保存。游戏时长: ${this.saveSystem.getFormattedPlayTime()}`,
      "#00FF00",
    );
    this.addRichLine("返回主菜单...", "#00FF00");

    this.scheduleOnce(() => {
      director.loadScene("MainMenu");
    }, 1);
  }

  private showGameStatus() {
    const totalSeconds = this.getCurrentTotalPlayTimeSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const displayTime = `${minutes}分${secs}秒`;

    this.addRichLine("========== 游戏状态 =========", "#00FF00");
    this.addRichLine(`游戏时长: ${displayTime}`, "#FFFFFF");
    this.addRichLine(`死亡次数: ${this.saveSystem.getDeathCount()}`, "#FFFFFF");
    this.addRichLine(`小游戏完成: ${this.saveSystem.getMiniGameSuccessCount()}次`, "#FFFFFF");
    this.addRichLine(`已解锁人物: ${this.characterSystem.getUnlockedCount()}/5`, "#FFFFFF");
    this.addRichLine(`当前生命值: ${GameData.playerHp}/${GameData.playerMaxHp}`, "#FFFFFF");
    this.addRichLine(`时间线状态: ${GameData.timelineCompleted ? "已完成" : "未完成"}`, "#FFFFFF");
    this.addRichLine("==============================", "#00FF00");
  }

  private handleTestHurt() {
    GameData.reducePlayerHp(30);
    this.syncHpBarFromGameData();
    this.saveSystem.updateHp(GameData.playerHp);
    this.addRichLine("测试：扣除30点生命值。", "#FF5555");
    this.addRichLine(`当前生命值: ${GameData.playerHp}/${GameData.playerMaxHp}`, "#FFFF55");
    this.checkAndTriggerDeath();
  }

  private checkAndTriggerDeath() {
    if (!GameData.isPlayerAlive() && this.gameState !== "GAMEOVER") {
      this.onPlayerDeath();
    }
  }

  private onPlayerDeath() {
    if (this.gameState === "GAMEOVER") return;

    this.exitAiChat(false);
    this.characterSystem?.cancelPendingUnlock();
    this.gameState = "GAMEOVER";
    this.pauseTiming(); // 死亡后停止计时，防止 onDestroy 再次写档覆盖 isDeath
    GameData.setPlayerHp(0);
    this.syncHpBarFromGameData();

    const cause = GameData.deathReason;
    GameData.deathReason = "";
    this.saveSystem.onDeath(cause);

    this.addRichLine("", "#FF5555");
    this.addRichLine("========================================", "#FF5555");
    this.addRichLine("  游戏结束", "#FF5555");
    this.addRichLine("========================================", "#FF5555");

    if (cause === "wrong_accuse") {
      this.addRichLine("指认错误，真凶依然逍遥法外。", "#FF5555");
      this.addRichLine("也许再仔细整理一下线索...", "#FF5555");
    } else if (cause === "overtime") {
      this.addRichLine("推箱子耗时过长，体力透支，调查失败。", "#FF5555");
      this.addRichLine("真相永远留在了迷雾之中...", "#FF5555");
    } else {
      this.addRichLine("你的生命值已归零，调查失败。", "#FF5555");
      this.addRichLine("真相永远留在了迷雾之中...", "#FF5555");
    }
    this.addRichLine("", "#FFFFFF");
    this.addRichLine("========== 可用命令 ==========", "#FFFF55");
    this.addRichLine("  <color=#CE831E>restart</color>  - 开始新游戏", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>load</color>     - 读取存档", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>status</color>   - 查看本局统计", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>quit</color>     - 返回主菜单", "#FFFFFF");
    this.addRichLine("  <color=#CE831E>sos</color>     - 复活", "#FFFFFF");
    this.addRichLine("==============================", "#FFFF55");

    if (this.gameOverPanel) {
      this.gameOverPanel.active = true;
    }

    if (this.inputBox) {
      this.inputBox.string = this.prefix;
    }
  }

  public restartGame() {
    this.exitAiChat(false);
    this.stopSosVideo();
    this.characterSystem?.cancelPendingUnlock();
    GameData.resetRuntimeForNewGame();
    this.syncHpBarFromGameData();

    this.gameState = "BOOT";
    this.isWaitingVideoComplete = false;
    this.isTimelineCompleted = false;
    this.isAnswerMode = false;
    this.caseQuizAnswers = {};
    this.hasPendingCaseQuizSubmit = false;
    this.pendingDeleteSaveId = "";

    if (this.gameOverPanel) {
      this.gameOverPanel.active = false;
    }

    if (this.content) {
      this.content.removeAllChildren();
    }

    if (this.inputBox) {
      this.inputBox.enabled = true;
      this.inputBox.string = this.prefix;
      this.inputBox.focus();
    }

    this.showStartScreen();
  }

  private syncSaveAfterRuntimeChanged() {
    this.saveHpToGameData();
    this.saveSystem.saveGame(0);
  }

  private syncHpBarFromGameData() {
    if (this.hpBar) {
      this.hpBar.setHp(GameData.playerHp);
    }
  }

  private saveHpToGameData() {
    if (this.hpBar) {
      GameData.setPlayerHp(this.hpBar.getHp());
    }
  }

  private getShortText(text: string, maxLength: number): string {
    const cleanText = text.replace(/\n/g, " ").trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + "...";
  }

  private addParagraphText(text: string, colorHex: string = "#FFFFFF") {
    const paragraphs = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    paragraphs.forEach((paragraph, index) => {
      this.addRichLine(paragraph, colorHex);
      if (index < paragraphs.length - 1) this.addRichLine("");
    });
  }

  addLine(text: string, colorHex: string = "#FFFFFF") {
    if (!this.content) return;

    const transform = this.content.getComponent(UITransform);
    let contentWidth = transform ? transform.width : 600;
    if (contentWidth <= 0) contentWidth = 600;

    const lineWidth = contentWidth - 20;
    const fontSize = 24;
    const lineHeight = 32;
    const height = this.estimateTextHeight(text, lineWidth, fontSize, lineHeight);

    const lineNode = new Node("HistoryLine");
    const uiTransform = lineNode.addComponent(UITransform);
    uiTransform.anchorX = 0;
    uiTransform.anchorY = 0.5;
    uiTransform.width = lineWidth;
    uiTransform.height = height;

    const label = lineNode.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.TOP;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.color = this.hexToColor(colorHex);

    if (this.monospaceFont) {
      label.font = this.monospaceFont;
    }

    lineNode.setPosition(10, 0, 0);
    lineNode.parent = this.content;
  }

  addRichLine(text: string, colorHex: string = "#FFFFFF") {
    if (!this.content) return;

    const transform = this.content.getComponent(UITransform);
    let contentWidth = transform ? transform.width : 600;
    if (contentWidth <= 0) contentWidth = 600;

    const lineWidth = contentWidth - 20;
    const fontSize = 24;
    const lineHeight = 32;
    const visibleText = this.stripRichTextTags(text);
    const height = this.estimateTextHeight(visibleText, lineWidth, fontSize, lineHeight);

    const lineNode = new Node("RichLine");
    const uiTransform = lineNode.addComponent(UITransform);
    uiTransform.anchorX = 0;
    uiTransform.anchorY = 0.5;
    uiTransform.width = lineWidth;
    uiTransform.height = height;

    const richText = lineNode.addComponent(RichText);
    richText.fontSize = fontSize;
    richText.lineHeight = lineHeight;
    richText.fontFamily = this.terminalFontName;
    richText.maxWidth = lineWidth;
    richText.string = text.includes("<color=")
      ? text
      : `<color=${colorHex}>${text}</color>`;

    lineNode.setPosition(10, 0, 0);
    lineNode.parent = this.content;
  }

  private stripRichTextTags(text: string): string {
    return text.replace(/<[^>]+>/g, "");
  }

  private estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number): number {
    if (!text || text.trim() === "") return lineHeight;

    const averageCharWidth = fontSize * 0.9;
    const maxCharsPerLine = Math.max(1, Math.floor(width / averageCharWidth));
    const lines = text.split("\n");
    let lineCount = 0;

    lines.forEach((line) => {
      lineCount += Math.max(1, Math.ceil(line.length / maxCharsPerLine));
    });

    return Math.max(lineHeight, lineCount * lineHeight + 8);
  }

  hexToColor(hex: string): Color {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return new Color(r, g, b, 255);
  }
}
