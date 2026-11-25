import { _decorator, Component } from "cc";
import {
  Character,
  getCharacter,
  unlockCharacter,
  CharacterList,
} from "./CharacterData";
import { GameData } from "./GameData";

const { ccclass } = _decorator;

interface CipherPuzzle {
  title: string;
  lines: ReadonlyArray<string>;
  answer: string;
  answerType: "text" | "integer";
}

// 按已解锁人数选择难度，与推箱子的关卡递进保持一致。
// 答案仅用于本地判题，不会作为提示输出到终端。
const CIPHER_PUZZLES: ReadonlyArray<CipherPuzzle> = [
  {
    title: "凯撒密码（Caesar）",
    lines: ["密文：WUXWK", "加密位移：+3（A → D）。"],
    answer: "TRUTH",
    answerType: "text",
  },
  {
    title: "栅栏密码（Rail Fence）",
    lines: [
      "密文：AICSRHVACSCEE",
      "参数：3 轨，Z 字形，从左上角向下起步。",
    ],
    answer: "ARCHIVEACCESS",
    answerType: "text",
  },
  {
    title: "维吉尼亚密码（Vigenere）",
    lines: ["密文：IOGTRZTCMHYIYMQFE", "密钥：DAVID（循环使用，A=0）。"],
    answer: "FOLLOWTHEEVIDENCE",
    answerType: "text",
  },
  {
    title: "仿射密码（Affine）",
    lines: [
      "密文：KECUZWAVCJCPYILWNW",
      "字母编号：A=0 至 Z=25；已知明文 AB 对应密文 IN。",
    ],
    answer: "QUESTIONEVERYALIBI",
    answerType: "text",
  },
  {
    title: "RSA（无填充）",
    lines: [
      "公钥：n=1022117，e=65537。",
      "密文：c=559671。还原明文整数 m，无需转换成文本。",
    ],
    answer: "2024",
    answerType: "integer",
  },
];

export interface CharacterCallbacks {
  addLine: (text: string, colorHex?: string) => void;
  addRichLine: (text: string, colorHex?: string) => void;
  startMiniGame?: (
    characterId: string,
    onComplete?: (success: boolean) => void,
  ) => void;
  onCharacterUnlocked?: (characterId: string) => void;
}

@ccclass("CharacterSystem")
export class CharacterSystem extends Component {
  private callbacks: CharacterCallbacks = null!;
  private pendingCharacter: string | null = null;
  private unlockStage: "method" | "cipher" = "method";
  private pendingCipherIndex: number | null = null;

  init(callbacks: CharacterCallbacks) {
    this.callbacks = callbacks;
    this.cancelPendingUnlock();
    this.checkSokobanReturn();
  }

  viewCharacter(characterName: string): boolean {
    const character = getCharacter(characterName);

    if (!character) {
      this.callbacks.addRichLine(`未找到人物: ${characterName}`, "#FF5555");
      return false;
    }

    this.cancelPendingUnlock();

    if (character.isUnlocked) {
      this.showCharacterInfo(character);
      return true;
    }

    this.callbacks.addRichLine(`\n【${character.name}】档案已加密。`, "#FF5555");
    this.callbacks.addRichLine(
      `需要完成<color=#CE831E>安全验证</color>才能解锁。`,
      "#FFFFFF",
    );
    this.pendingCharacter = character.id;
    this.showUnlockMethods();
    return true;
  }

  handleUnlockConfirm(input: string): boolean {
    if (!this.pendingCharacter) return false;

    const cmd = input.trim().toLowerCase();

    if (cmd === "no" || cmd === "cancel") {
      this.callbacks.addRichLine("已取消解锁。", "#FF5555");
      this.cancelPendingUnlock();
      return true;
    }

    if (this.unlockStage === "cipher") {
      if (cmd === "back") {
        this.unlockStage = "method";
        this.pendingCipherIndex = null;
        this.showUnlockMethods();
      } else if (cmd === "question" || cmd === "help") {
        this.showCipherPuzzle();
      } else {
        this.checkCipherAnswer(input);
      }
      return true;
    }

    if (cmd === "1" || cmd === "sokoban" || cmd === "推箱子" || cmd === "yes") {
      this.startMiniGameForCharacter(this.pendingCharacter);
      return true;
    }

    if (cmd === "2" || cmd === "cipher" || cmd === "密码" || cmd === "密码题") {
      this.pendingCipherIndex = Math.min(
        this.getUnlockedCount(),
        CIPHER_PUZZLES.length - 1,
      );
      this.unlockStage = "cipher";
      this.showCipherPuzzle();
      return true;
    }

    this.callbacks.addRichLine(
      "请输入 <color=#CE831E>1</color> 选择推箱子，<color=#CE831E>2</color> 选择密码题，或 <color=#CE831E>no</color> 取消。",
      "#FF5555",
    );
    return true;
  }

  hasPendingUnlock(): boolean {
    return this.pendingCharacter !== null;
  }

  // 切换存档、重新开始或解锁完成时，清理未完成的终端验证。
  cancelPendingUnlock() {
    this.pendingCharacter = null;
    this.pendingCipherIndex = null;
    this.unlockStage = "method";
  }

  private showUnlockMethods() {
    this.callbacks.addRichLine("请选择解锁方式：", "#FFFFFF");
    this.callbacks.addRichLine(
      "  <color=#CE831E>1</color> / <color=#CE831E>sokoban</color> - 推箱子小游戏",
      "#FFFFFF",
    );
    this.callbacks.addRichLine(
      "  <color=#CE831E>2</color> / <color=#CE831E>cipher</color>  - 终端密码题",
      "#FFFFFF",
    );
    this.callbacks.addRichLine(
      "输入选项开始，或输入 <color=#CE831E>no</color> 取消。",
      "#AAAAAA",
    );
  }

  private showCipherPuzzle() {
    if (this.pendingCipherIndex === null) return;

    const puzzle = CIPHER_PUZZLES[this.pendingCipherIndex];
    this.callbacks.addRichLine(
      `\n【密码验证 ${this.pendingCipherIndex + 1}/${CIPHER_PUZZLES.length}：${puzzle.title}】`,
      "#CE831E",
    );
    puzzle.lines.forEach((line) => this.callbacks.addRichLine(line, "#FFFFFF"));
    this.callbacks.addRichLine(
      puzzle.answerType === "integer"
        ? "请直接输入十进制明文整数。"
        : "请直接输入英文明文，忽略大小写和空格。",
      "#FFFFFF",
    );
    this.callbacks.addRichLine("可自行查阅资料或使用工具。", "#AAAAAA");
    this.callbacks.addRichLine(
      "<color=#CE831E>question</color> 重看题目 / <color=#CE831E>back</color> 重选方式 / <color=#CE831E>no</color> 取消。",
      "#AAAAAA",
    );
  }

  private checkCipherAnswer(input: string) {
    if (this.pendingCipherIndex === null || !this.pendingCharacter) return;

    const puzzle = CIPHER_PUZZLES[this.pendingCipherIndex];
    let answer = input.replace(/\s+/g, "").toUpperCase();
    if (puzzle.answerType === "integer" && /^\d+$/.test(answer)) {
      answer = answer.replace(/^0+(?=\d)/, "");
    }

    if (answer !== puzzle.answer) {
      this.callbacks.addRichLine("答案不正确，请重试。", "#FF5555");
      return;
    }

    this.completeUnlock(this.pendingCharacter, "cipher");
  }

  private startMiniGameForCharacter(characterId: string) {
    const character = getCharacter(characterId);
    if (!character) return;

    if (!this.callbacks.startMiniGame) {
      this.callbacks.addRichLine("未配置推箱子场景跳转，请选择其他解锁方式。", "#FF5555");
      return;
    }

    this.callbacks.addRichLine(
      `\n正在为【${character.name}】启动安全验证...`,
      "#00FF00",
    );
    this.callbacks.addRichLine("请完成推箱子小游戏以解锁档案。", "#FFFFFF");

    const unlockedCount = this.getUnlockedCount();
    const levelIndex = Math.min(unlockedCount, 4);

    GameData.waitingSokobanResult = true;
    GameData.pendingCharacterId = characterId;
    GameData.sokobanLevelIndex = levelIndex;
    GameData.sokobanFinished = false;
    GameData.sokobanSuccess = false;
    GameData.returnSceneName = "Terminal";
    GameData.sokobanSceneName = "push boxes";

    this.cancelPendingUnlock();
    this.callbacks.startMiniGame(characterId);
  }

  private checkSokobanReturn() {
    if (!GameData.waitingSokobanResult) return;
    if (!GameData.sokobanFinished) return;

    const characterId = GameData.pendingCharacterId;
    const success = GameData.sokobanSuccess;

    if (success) {
      this.completeUnlock(characterId, "sokoban");
    } else {
      this.onMiniGameFail(characterId);
    }

    GameData.clearSokobanResult();
  }

  private completeUnlock(characterId: string, method: "sokoban" | "cipher") {
    const character = getCharacter(characterId);
    if (!character) return;

    const wasLocked = !character.isUnlocked;
    unlockCharacter(characterId);

    this.callbacks.addRichLine(
      `\n<color=#00FF00>安全验证通过！</color>`,
      "#00FF00",
    );
    this.callbacks.addRichLine(`【${character.name}】档案已解锁。`, "#00FF00");

    if (method === "sokoban") this.showSokobanTimeResult();
    this.showCharacterInfo(character);

    this.cancelPendingUnlock();

    this.callbacks.addRichLine(
      `\n获得新证物和证词！输入 <color=#CE831E>thing</color> / <color=#CE831E>word</color> 查看。`,
      "#CE831E",
    );

    if (wasLocked && this.callbacks.onCharacterUnlocked) {
      this.callbacks.onCharacterUnlocked(characterId);
    }

    if (this.isAllUnlocked() && !GameData.timelineCompleted) {
      this.callbacks.addRichLine(
        `\n所有人物档案均已解锁。输入 <color=#CE831E>answer</color> 进行案件时间线梳理。`,
        "#00FF00",
      );
    }
  }

  private showSokobanTimeResult() {
    const overtimeSeconds = GameData.lastSokobanOvertimeSeconds;
    const hpDamage = GameData.lastSokobanHpDamage;

    this.callbacks.addRichLine("", "#FFFFFF");
    this.callbacks.addRichLine("【推箱子计时结算】", "#CE831E");

    if (overtimeSeconds <= 0) {
      this.callbacks.addRichLine("在限制时间内完成，未扣除生命值。", "#00FF00");
      return;
    }

    this.callbacks.addRichLine(
      `超时 ${this.formatTime(overtimeSeconds)}，生命值 -${hpDamage}。`,
      "#FF5555",
    );
    this.callbacks.addRichLine(
      `当前生命值：${GameData.playerHp}/${GameData.playerMaxHp}`,
      "#FFFFFF",
    );
  }

  private onMiniGameFail(characterId: string) {
    const character = getCharacter(characterId);
    if (!character) return;

    this.callbacks.addRichLine(
      `\n<color=#FF5555>安全验证失败！</color>`,
      "#FF5555",
    );
    this.callbacks.addRichLine(`未能解锁【${character.name}】档案。`, "#FF5555");
    this.callbacks.addRichLine("请稍后再试。", "#FFFFFF");

    this.cancelPendingUnlock();
  }

  private showCharacterInfo(character: Character) {
    this.callbacks.addRichLine("", "#FFFFFF");
    this.callbacks.addRichLine("=========================================", "#00FF00");
    this.callbacks.addRichLine(`  ${character.name} - ${character.role}`, "#00FF00");
    this.callbacks.addRichLine("=========================================", "#00FF00");

    if (GameData.timelineCompleted) {
      this.callbacks.addRichLine(`【动机】${character.motive}`, "#FFFFFF");
      this.callbacks.addRichLine(`【秘密】${character.secret}`, "#CE831E");
    } else {
      this.callbacks.addRichLine(
        "【动机 / 秘密】暂未开放。完成最终时间线梳理后显示。",
        "#AAAAAA",
      );
    }

    this.callbacks.addRichLine(`【描述】${character.description}`, "#FFFFFF");
    this.callbacks.addRichLine("=========================================", "#00FF00");
    this.callbacks.addRichLine("", "#FFFFFF");
  }

  getUnlockedCount(): number {
    return CharacterList.filter((c) => c.isUnlocked).length;
  }

  getUnlockedCharacterList(): Character[] {
    return CharacterList.filter((c) => c.isUnlocked);
  }

  isAllUnlocked(): boolean {
    return CharacterList.every((c) => c.isUnlocked);
  }

  getLockedCharacters(): string[] {
    return CharacterList.filter((c) => !c.isUnlocked).map((c) => c.nameEn);
  }

  private padNumber(value: number, length: number): string {
    const str = value.toString();
    return str.length >= length ? str : "0".repeat(length - str.length) + str;
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${this.padNumber(minutes, 2)}:${this.padNumber(seconds, 2)}`;
  }
}
