import { _decorator, Component, sys } from "cc";
import {
  CharacterList,
  unlockCharacter,
  resetCharacterUnlocks,
} from "./CharacterData";
import { GameData } from "./GameData";

const { ccclass } = _decorator;

// 存档列表中每条记录的摘要信息
export interface SaveMeta {
  saveId: string;
  playerName: string;
  savedAt: number;
  totalPlayTimeSeconds: number;
  unlockedCount: number;
  isDeath: boolean;
}

// 完整存档数据
export interface SimpleSaveData {
  saveId: string;
  playerName: string;
  currentHp: number;
  unlockedCharacterIds: string[];
  timelineCompleted: boolean;
  totalPlayTimeSeconds: number;
  deathCount: number;
  deathByOvertime: number;
  deathByWrongAccuse: number;
  miniGameSuccessCount: number;
  hasWatchedAd: boolean;
  savedAt: number;
  isDeath: boolean;
}

@ccclass("SimpleSaveSystem")
export class SimpleSaveSystem extends Component {
  private readonly indexKey = "YKW_SAVE_INDEX_V1";
  private readonly oldSaveKey = "YKW_DETECTIVE_SAVE_V1";
  private data: SimpleSaveData | null = null;

  // ─── 存档 Key 管理 ────────────────────────────────────────────

  private getSaveKey(saveId: string): string {
    return `YKW_SAVE_V1_${saveId}`;
  }

  // ─── 存档索引管理 ─────────────────────────────────────────────

  private readIndex(): SaveMeta[] {
    const raw = sys.localStorage.getItem(this.indexKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SaveMeta[];
    } catch {
      return [];
    }
  }

  private writeIndex(metas: SaveMeta[]): void {
    sys.localStorage.setItem(this.indexKey, JSON.stringify(metas));
  }

  private updateIndexEntry(data: SimpleSaveData): void {
    const metas = this.readIndex();
    const meta: SaveMeta = {
      saveId: data.saveId,
      playerName: data.playerName,
      savedAt: data.savedAt,
      totalPlayTimeSeconds: data.totalPlayTimeSeconds,
      unlockedCount: data.unlockedCharacterIds.length,
      isDeath: data.isDeath,
    };
    const idx = metas.findIndex((m) => m.saveId === data.saveId);
    if (idx >= 0) {
      metas[idx] = meta;
    } else {
      metas.push(meta);
    }
    // 按最新保存时间排序
    metas.sort((a, b) => b.savedAt - a.savedAt);
    this.writeIndex(metas);
  }

  private removeFromIndex(saveId: string): void {
    const metas = this.readIndex().filter((m) => m.saveId !== saveId);
    this.writeIndex(metas);
  }

  // ─── 旧格式存档迁移 ───────────────────────────────────────────

  private migrateOldSave(): void {
    const raw = sys.localStorage.getItem(this.oldSaveKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const timestamp = Number(parsed.savedAt || Date.now());
      const name = parsed.playerName || "侦探";
      const saveId = `${name}_${timestamp}`;

      const newData: SimpleSaveData = {
        saveId,
        playerName: name,
        currentHp: this.clampHp(parsed.currentHp ?? 100),
        unlockedCharacterIds: Array.isArray(parsed.unlockedCharacterIds)
          ? parsed.unlockedCharacterIds
          : [],
        timelineCompleted: parsed.timelineCompleted === true,
        totalPlayTimeSeconds: Number(parsed.totalPlayTimeSeconds || 0),
        deathCount: Number(parsed.deathCount || 0),
        deathByOvertime: 0,
        deathByWrongAccuse: 0,
        miniGameSuccessCount: Number(parsed.miniGameSuccessCount || 0),
        hasWatchedAd: false,
        savedAt: timestamp,
        isDeath: parsed.isDeath === true,
      };

      sys.localStorage.setItem(this.getSaveKey(saveId), JSON.stringify(newData));
      this.updateIndexEntry(newData);
      sys.localStorage.removeItem(this.oldSaveKey);

      console.log("[SaveSystem] 旧存档迁移完成:", saveId);
    } catch (e) {
      console.error("[SaveSystem] 旧存档迁移失败:", e);
    }
  }

  // ─── 公开接口 ─────────────────────────────────────────────────

  hasSave(): boolean {
    this.migrateOldSave();
    return this.readIndex().length > 0;
  }

  getAllSaves(): SaveMeta[] {
    return this.readIndex();
  }

  /** 直接从存档文件读取 isDeath，绕过索引缓存 */
  readIsDeath(saveId: string): boolean {
    const raw = sys.localStorage.getItem(this.getSaveKey(saveId));
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed.isDeath === true;
    } catch {
      return false;
    }
  }

  newGame(playerName: string): void {
    resetCharacterUnlocks();
    GameData.resetRuntimeForNewGame();
    GameData.terminalPlayerName = playerName;

    const saveId = `${playerName}_${Date.now()}`;
    GameData.currentSaveId = saveId;

    this.data = {
      saveId,
      playerName,
      currentHp: GameData.playerHp,
      unlockedCharacterIds: [],
      timelineCompleted: false,
      totalPlayTimeSeconds: 0,
      deathCount: 0,
      deathByOvertime: 0,
      deathByWrongAccuse: 0,
      miniGameSuccessCount: 0,
      hasWatchedAd: false,
      savedAt: Date.now(),
      isDeath: false,
    };

    this.write();
    this.updateIndexEntry(this.data);
  }

  saveGame(elapsedSeconds: number = 0): SimpleSaveData {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }

    this.data.totalPlayTimeSeconds += Math.max(0, elapsedSeconds);
    this.data.currentHp = GameData.playerHp;
    this.data.unlockedCharacterIds = this.getUnlockedIdsFromCharacters();
    this.data.timelineCompleted = GameData.timelineCompleted;
    this.data.savedAt = Date.now();
    // isDeath 只由 onDeath() 设置，saveGame() 不覆盖

    this.write();
    this.updateIndexEntry(this.data);
    return this.data;
  }

  /** 加载当前会话存档（用于推箱子返回等场景）*/
  loadGame(): SimpleSaveData | null {
    const targetId = GameData.currentSaveId;
    if (targetId) {
      const result = this.loadGameById(targetId);
      if (result) return result;
    }
    // 回退：加载最新存档
    const metas = this.readIndex();
    if (metas.length === 0) return null;
    return this.loadGameById(metas[0].saveId);
  }

  /** 按存档 ID 加载指定存档 */
  loadGameById(saveId: string): SimpleSaveData | null {
    const raw = sys.localStorage.getItem(this.getSaveKey(saveId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SimpleSaveData;
      GameData.currentSaveId = saveId;

      this.data = {
        saveId,
        playerName: parsed.playerName || "侦探",
        currentHp: this.clampHp(parsed.currentHp ?? 100),
        unlockedCharacterIds: Array.isArray(parsed.unlockedCharacterIds)
          ? parsed.unlockedCharacterIds
          : [],
        timelineCompleted: parsed.timelineCompleted === true,
        totalPlayTimeSeconds: Number(parsed.totalPlayTimeSeconds || 0),
        deathCount: Number(parsed.deathCount || 0),
        deathByOvertime: Number(parsed.deathByOvertime || 0),
        deathByWrongAccuse: Number(parsed.deathByWrongAccuse || 0),
        miniGameSuccessCount: Number(parsed.miniGameSuccessCount || 0),
        hasWatchedAd: parsed.hasWatchedAd === true,
        savedAt: Number(parsed.savedAt || Date.now()),
        isDeath: parsed.isDeath === true,
      };

      this.applyToRuntime();
      return this.data;
    } catch (err) {
      console.error("读取存档失败", err);
      return null;
    }
  }

  /** 删除当前存档 */
  deleteSave(): void {
    const saveId = GameData.currentSaveId || this.data?.saveId;
    if (saveId) {
      sys.localStorage.removeItem(this.getSaveKey(saveId));
      this.removeFromIndex(saveId);
    }
    this.data = null;
    GameData.currentSaveId = "";
  }

  /** 按 ID 删除指定存档 */
  deleteSaveById(saveId: string): void {
    sys.localStorage.removeItem(this.getSaveKey(saveId));
    this.removeFromIndex(saveId);
    if (GameData.currentSaveId === saveId) {
      this.data = null;
      GameData.currentSaveId = "";
    }
  }

  updateHp(hp: number): void {
    if (!this.data) return;
    this.data.currentHp = this.clampHp(hp);
    GameData.setPlayerHp(this.data.currentHp);
    this.write();
    this.updateIndexEntry(this.data);
  }

  onCharacterUnlocked(characterId: string): void {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }

    if (!this.data.unlockedCharacterIds.includes(characterId)) {
      this.data.unlockedCharacterIds.push(characterId);
      this.data.miniGameSuccessCount += 1;
    }

    this.data.currentHp = GameData.playerHp;
    this.write();
    this.updateIndexEntry(this.data);
  }

  setTimelineCompleted(completed: boolean): void {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }

    this.data.timelineCompleted = completed;
    GameData.timelineCompleted = completed;
    this.write();
    this.updateIndexEntry(this.data);
  }

  onDeath(cause: "overtime" | "wrong_accuse" | "" = ""): void {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }

    this.data.deathCount += 1;
    if (cause === "overtime") this.data.deathByOvertime += 1;
    if (cause === "wrong_accuse") this.data.deathByWrongAccuse += 1;

    this.data.currentHp = 0;
    this.data.isDeath = true;
    GameData.setPlayerHp(0);
    this.write();
    this.updateIndexEntry(this.data);
  }

  setHasWatchedAd(): void {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }
    if (this.data.hasWatchedAd) return;
    this.data.hasWatchedAd = true;
    this.write();
    this.updateIndexEntry(this.data);
  }

  // ─── Getter ───────────────────────────────────────────────────

  getIsDeath(): boolean {
    return this.data?.isDeath === true;
  }

  getPlayerName(): string {
    return this.data?.playerName || GameData.terminalPlayerName || "侦探";
  }

  getCurrentHp(): number {
    return this.data?.currentHp ?? GameData.playerHp;
  }

  getUnlockedCount(): number {
    if (this.data) return this.data.unlockedCharacterIds.length;
    return this.getUnlockedIdsFromCharacters().length;
  }

  getTotalPlayTimeSeconds(): number {
    return this.data?.totalPlayTimeSeconds || 0;
  }

  getDeathCount(): number {
    return this.data?.deathCount || 0;
  }

  getMiniGameSuccessCount(): number {
    return this.data?.miniGameSuccessCount || 0;
  }

  isTimelineCompleted(): boolean {
    return this.data?.timelineCompleted === true || GameData.timelineCompleted;
  }

  getFormattedPlayTime(): string {
    return this.formatTime(this.getTotalPlayTimeSeconds());
  }

  getCurrentSaveId(): string {
    return this.data?.saveId || GameData.currentSaveId || "";
  }

  clearDeathState(): void {
    if (!this.data) {
      this.data = this.createDataFromCurrentRuntime();
    }

    this.data.isDeath = false;
    this.data.currentHp = GameData.playerHp;
    this.write();
    this.updateIndexEntry(this.data);
  }

  // ─── 私有辅助 ─────────────────────────────────────────────────

  private createDataFromCurrentRuntime(): SimpleSaveData {
    const saveId =
      GameData.currentSaveId ||
      `${GameData.terminalPlayerName || "侦探"}_${Date.now()}`;
    GameData.currentSaveId = saveId;

    return {
      saveId,
      playerName: GameData.terminalPlayerName || "侦探",
      currentHp: GameData.playerHp,
      unlockedCharacterIds: this.getUnlockedIdsFromCharacters(),
      timelineCompleted: GameData.timelineCompleted,
      totalPlayTimeSeconds: 0,
      deathCount: 0,
      deathByOvertime: 0,
      deathByWrongAccuse: 0,
      miniGameSuccessCount: 0,
      hasWatchedAd: false,
      savedAt: Date.now(),
      isDeath: false,
    };
  }

  private applyToRuntime(): void {
    if (!this.data) return;

    resetCharacterUnlocks();
    this.data.unlockedCharacterIds.forEach((id) => unlockCharacter(id));

    GameData.terminalPlayerName = this.data.playerName;
    GameData.setPlayerHp(this.data.currentHp);
    GameData.timelineCompleted = this.data.timelineCompleted;
    GameData.currentSaveId = this.data.saveId;
  }

  private write(): void {
    if (!this.data) return;
    sys.localStorage.setItem(
      this.getSaveKey(this.data.saveId),
      JSON.stringify(this.data),
    );
  }

  private getUnlockedIdsFromCharacters(): string[] {
    return CharacterList.filter((character) => character.isUnlocked).map(
      (character) => character.id,
    );
  }

  private clampHp(value: number): number {
    return Math.max(0, Math.min(value, GameData.playerMaxHp));
  }

  private formatTime(totalSeconds: number): string {
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor((totalSeconds / 60) % 60);
    const hours = Math.floor(totalSeconds / 3600);

    if (hours > 0) {
      return `${hours}小时${minutes}分${seconds}秒`;
    }

    return `${minutes}分${seconds}秒`;
  }
}
