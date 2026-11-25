import {
  _decorator,
  Component,
  Node,
  Button,
  director,
  Label,
  UITransform,
  Color,
} from "cc";
import { MapManager } from "./MapManager";
import { GameData } from "./GameData";
import { HpBar } from "./HpBar";

import { levelData as level1 } from "../Levels/Level1";
import { levelData as level2 } from "../Levels/Level2";
import { levelData as level3 } from "../Levels/Level3";
import { levelData as level4 } from "../Levels/Level4";
import { levelData as level5 } from "../Levels/Level5";

const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
  @property(MapManager)
  mapManager: MapManager = null!;

  @property(Label)
  timerLabel: Label | null = null;

  @property(HpBar)
  hpBar: HpBar | null = null;

  @property(Node)
  levelSelectPanel: Node | null = null;

  @property(Button)
  level1Btn: Button | null = null;

  @property(Button)
  level2Btn: Button | null = null;

  @property(Button)
  level3Btn: Button | null = null;

  @property(Button)
  level4Btn: Button | null = null;

  @property(Button)
  level5Btn: Button | null = null;

  @property(Button)
  closeBtn: Button | null = null;

  @property(Node)
  victoryPanel: Node | null = null;

  @property(Button)
  nextLevelButton: Button | null = null;

  @property(Button)
  replayButton: Button | null = null;

  private levels: number[][][] = [
    level1,
    level2,
    level3,
    level4,
    level5,
  ];

  private readonly levelTimeLimits: number[] = [180, 180, 240, 240, 300];

  private currentLevelIndex = 0;
  private originalLevelData: number[][] = [];
  private currentLevelData: number[][] = [];

  private elapsedSeconds: number = 0;
  private timerStartTimeMs: number = 0;
  private isLevelRunning: boolean = false;
  private isLevelFinished: boolean = false;
  private hasSettledTimeDamage: boolean = false;

  start() {
    if (this.mapManager) {
      this.mapManager.setOnVictoryCallback(() => {
        this.showVictoryPanel();
      });
    }

    if (GameData.waitingSokobanResult) {
      this.currentLevelIndex = Math.max(
        0,
        Math.min(GameData.sokobanLevelIndex, this.levels.length - 1),
      );
    } else {
      this.currentLevelIndex = 0;
    }

    this.setupTimerLabelLayout();
    this.syncHpBar();
    this.loadLevel(this.levels[this.currentLevelIndex]);

    if (this.levelSelectPanel) this.levelSelectPanel.active = false;
    if (this.victoryPanel) this.victoryPanel.active = false;

    if (this.level1Btn) {
      this.level1Btn.node.on(
        Button.EventType.CLICK,
        () => this.onSelectLevel(0),
        this,
      );
    }

    if (this.level2Btn) {
      this.level2Btn.node.on(
        Button.EventType.CLICK,
        () => this.onSelectLevel(1),
        this,
      );
    }

    if (this.level3Btn) {
      this.level3Btn.node.on(
        Button.EventType.CLICK,
        () => this.onSelectLevel(2),
        this,
      );
    }

    if (this.level4Btn) {
      this.level4Btn.node.on(
        Button.EventType.CLICK,
        () => this.onSelectLevel(3),
        this,
      );
    }

    if (this.level5Btn) {
      this.level5Btn.node.on(
        Button.EventType.CLICK,
        () => this.onSelectLevel(4),
        this,
      );
    }

    if (this.closeBtn) {
      this.closeBtn.node.on(
        Button.EventType.CLICK,
        this.onCloseLevelPanel,
        this,
      );
    }

    if (this.nextLevelButton) {
      this.nextLevelButton.node.on(
        Button.EventType.CLICK,
        this.onNextLevel,
        this,
      );
    }

    if (this.replayButton) {
      this.replayButton.node.on(
        Button.EventType.CLICK,
        this.onReplayClick,
        this,
      );
    }
  }

  onDestroy() {
    this.unschedule(this.onTimerTick);
  }

  private cloneLevel(levelData: number[][]): number[][] {
    return levelData.map((row) => [...row]);
  }

  loadLevel(levelData: number[][]) {
    this.originalLevelData = this.cloneLevel(levelData);
    this.currentLevelData = this.cloneLevel(levelData);

    if (this.mapManager) {
      this.mapManager.loadLevel(this.cloneLevel(this.currentLevelData));
    }

    if (this.victoryPanel) {
      this.victoryPanel.active = false;
    }

    if (this.levelSelectPanel) {
      this.levelSelectPanel.active = false;
    }

    this.startLevelTimer();
  }

  private setupTimerLabelLayout() {
    if (!this.timerLabel) return;

    const timerNode = this.timerLabel.node;
    const transform = timerNode.getComponent(UITransform);

    if (transform) {
      transform.anchorX = 0;
      transform.anchorY = 1;
      transform.width = Math.max(transform.width, 120);
      transform.height = Math.max(transform.height, 40);
    }

    this.timerLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    this.timerLabel.verticalAlign = Label.VerticalAlign.CENTER;

    if (this.timerLabel.fontSize <= 0) {
      this.timerLabel.fontSize = 30;
    }

    const parentTransform = timerNode.parent?.getComponent(UITransform);

    if (parentTransform) {
      timerNode.setPosition(
        -parentTransform.width / 2 + 24,
        parentTransform.height / 2 - 24,
        0,
      );
    }
  }

  private startLevelTimer() {
    this.unschedule(this.onTimerTick);

    this.elapsedSeconds = 0;
    this.timerStartTimeMs = Date.now();
    this.isLevelRunning = true;
    this.isLevelFinished = false;
    this.hasSettledTimeDamage = false;

    GameData.lastSokobanLevelIndex = this.currentLevelIndex;
    GameData.lastSokobanElapsedSeconds = 0;
    GameData.lastSokobanOvertimeSeconds = 0;
    GameData.lastSokobanHpDamage = 0;

    this.updateTimerLabel();
    this.schedule(this.onTimerTick, 1);
  }

  private applyResetTimePenalty() {
  const penaltySeconds = 20;

  if (this.isLevelFinished) {
    this.startLevelTimer();
    return;
  }

  if (!this.isLevelRunning || this.timerStartTimeMs <= 0) {
    this.startLevelTimer();
    return;
  }

  this.refreshElapsedSeconds();

  this.elapsedSeconds += penaltySeconds;
  this.timerStartTimeMs = Date.now() - this.elapsedSeconds * 1000;

  GameData.lastSokobanElapsedSeconds = this.elapsedSeconds;
  GameData.lastSokobanOvertimeSeconds = this.getCurrentOvertimeSeconds();

  this.updateTimerLabel();
}

  private stopLevelTimer() {
    this.refreshElapsedSeconds();
    this.isLevelRunning = false;
    this.isLevelFinished = true;
    this.unschedule(this.onTimerTick);
    this.updateTimerLabel();
  }

  private onTimerTick = () => {
    if (!this.isLevelRunning || this.isLevelFinished) return;

    this.refreshElapsedSeconds();
    this.updateTimerLabel();
  };

  private refreshElapsedSeconds() {
    if (this.timerStartTimeMs <= 0) {
      this.elapsedSeconds = 0;
      return;
    }

    this.elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - this.timerStartTimeMs) / 1000),
    );
  }

  private getCurrentTimeLimit(): number {
    return this.levelTimeLimits[this.currentLevelIndex] ?? 180;
  }

  private getCurrentOvertimeSeconds(): number {
    return Math.max(0, this.elapsedSeconds - this.getCurrentTimeLimit());
  }

  private updateTimerLabel() {
    if (!this.timerLabel) return;

    const limit = this.getCurrentTimeLimit();
    const remaining = limit - this.elapsedSeconds;

    if (remaining > 30) {
      this.timerLabel.string = this.formatTime(remaining);
      this.timerLabel.color = new Color(255, 255, 255, 255);
      return;
    }

    if (remaining >= 0) {
      this.timerLabel.string = this.formatTime(remaining);
      this.timerLabel.color = new Color(255, 216, 77, 255);
      return;
    }

    const overtimeSeconds = Math.abs(remaining);
    this.timerLabel.string = this.formatTime(overtimeSeconds);
    this.timerLabel.color = new Color(255, 80, 80, 255);
  }

  private settleTimeDamage() {
    if (this.hasSettledTimeDamage) return;

    this.refreshElapsedSeconds();

    const overtimeSeconds = this.getCurrentOvertimeSeconds();
    const damage = overtimeSeconds;

    GameData.lastSokobanLevelIndex = this.currentLevelIndex;
    GameData.lastSokobanElapsedSeconds = this.elapsedSeconds;
    GameData.lastSokobanOvertimeSeconds = overtimeSeconds;
    GameData.lastSokobanHpDamage = damage;

    if (damage > 0) {
      GameData.reducePlayerHp(damage);
      this.syncHpBar();
    }

    this.hasSettledTimeDamage = true;
    this.updateTimerLabel();
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const pad2 = (value: number) => (value < 10 ? `0${value}` : `${value}`);

    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  private syncHpBar() {
    if (this.hpBar) {
      this.hpBar.setHp(GameData.playerHp);
    }
  }

  onResetClick() {
  if (this.originalLevelData.length > 0) {
    this.currentLevelData = this.cloneLevel(this.originalLevelData);

    if (this.mapManager) {
      this.mapManager.loadLevel(this.cloneLevel(this.currentLevelData));
    }

    if (this.victoryPanel) {
      this.victoryPanel.active = false;
    }

    this.applyResetTimePenalty();
  }
}

  onReplayClick() {
    this.onResetClick();
  }

  onLevelSelectClick() {
    if (GameData.waitingSokobanResult) {
      return;
    }

    if (this.levelSelectPanel) {
      this.levelSelectPanel.active = true;
    }
  }

  onCloseLevelPanel() {
    if (this.levelSelectPanel) {
      this.levelSelectPanel.active = false;
    }
  }

  onSelectLevel(index: number) {
    if (GameData.waitingSokobanResult) {
      return;
    }

    if (index < 0 || index >= this.levels.length) {
      return;
    }

    this.currentLevelIndex = index;
    this.loadLevel(this.levels[index]);
  }

  showVictoryPanel() {
    this.stopLevelTimer();
    this.settleTimeDamage();

    if (GameData.waitingSokobanResult) {
      GameData.sokobanFinished = true;
      GameData.sokobanSuccess = true;
      director.loadScene(GameData.returnSceneName);
      return;
    }

    if (this.victoryPanel) {
      this.victoryPanel.active = true;
    }
  }

  onNextLevel() {
    this.stopLevelTimer();
    this.settleTimeDamage();

    if (GameData.waitingSokobanResult) {
      GameData.sokobanFinished = true;
      GameData.sokobanSuccess = true;
      director.loadScene(GameData.returnSceneName);
      return;
    }

    this.currentLevelIndex++;

    if (this.currentLevelIndex < this.levels.length) {
      this.loadLevel(this.levels[this.currentLevelIndex]);
    } else {
      console.log("通关！所有关卡已完成！");
    }
  }
}