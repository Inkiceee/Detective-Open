// GameData.ts
// 全局运行时数据：终端、推箱子、血量、时间线共用。

export class GameData {
  public static waitingSokobanResult: boolean = false;
  public static pendingCharacterId: string = "";
  public static sokobanLevelIndex: number = 0;
  public static sokobanFinished: boolean = false;
  public static sokobanSuccess: boolean = false;
  public static returnSceneName: string = "Terminal";
  public static sokobanSceneName: string = "push boxes";
  public static terminalPlayerName: string = "";
  public static currentSaveId: string = "";

  public static playerMaxHp: number = 100;
  public static playerHp: number = 100;

  public static timelineCompleted: boolean = false;

  public static lastSokobanLevelIndex: number = 0;
  public static lastSokobanElapsedSeconds: number = 0;
  public static lastSokobanOvertimeSeconds: number = 0;
  public static lastSokobanHpDamage: number = 0;

  /** 死亡原因（由触发死亡前的逻辑设置，onPlayerDeath 消费后清空）*/
  public static deathReason: "overtime" | "wrong_accuse" | "" = "";

  public static setPlayerHp(hp: number) {
    this.playerHp = Math.max(0, Math.min(hp, this.playerMaxHp));
  }

  public static reducePlayerHp(amount: number) {
    this.setPlayerHp(this.playerHp - Math.max(0, amount));
  }

  public static addPlayerHp(amount: number) {
    this.setPlayerHp(this.playerHp + Math.max(0, amount));
  }

  public static restorePlayerHp() {
    this.playerHp = this.playerMaxHp;
  }

  public static isPlayerAlive(): boolean {
    return this.playerHp > 0;
  }

  public static clearSokobanResult() {
    this.waitingSokobanResult = false;
    this.pendingCharacterId = "";
    this.sokobanLevelIndex = 0;
    this.sokobanFinished = false;
    this.sokobanSuccess = false;
  }

  public static resetRuntimeForNewGame() {
    this.waitingSokobanResult = false;
    this.pendingCharacterId = "";
    this.sokobanLevelIndex = 0;
    this.sokobanFinished = false;
    this.sokobanSuccess = false;
    this.terminalPlayerName = "";
    this.currentSaveId = "";
    this.playerHp = this.playerMaxHp;
    this.timelineCompleted = false;
    this.lastSokobanLevelIndex = 0;
    this.lastSokobanElapsedSeconds = 0;
    this.lastSokobanOvertimeSeconds = 0;
    this.lastSokobanHpDamage = 0;
    this.deathReason = "";
  }
}
