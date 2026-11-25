import { _decorator, Component, ProgressBar, Label, Color } from "cc";
const { ccclass, property } = _decorator;

@ccclass("HpBar")
export class HpBar extends Component {
  @property(ProgressBar)
  progressBar: ProgressBar = null;

  @property(Label)
  hpLabel: Label = null;

  private currentHp: number = 100;
  private maxHp: number = 100;
  private onDeathCallback: (() => void) | null = null;

  start() {
    this.updateUI();
  }

  setHp(hp: number) {
    const oldHp = this.currentHp;
    this.currentHp = Math.max(0, Math.min(hp, this.maxHp));
    this.updateUI();

    if (oldHp > 0 && this.currentHp <= 0 && this.onDeathCallback) {
      this.onDeathCallback();
    }
  }

  addHp(amount: number) {
    this.setHp(this.currentHp + amount);
  }

  reduceHp(amount: number) {
    this.setHp(this.currentHp - amount);
  }

  getHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  // 回满血
  healFull(): void {
    this.setHp(this.maxHp);
  }

  // 注册死亡回调
  setOnDeathCallback(callback: () => void) {
    this.onDeathCallback = callback;
  }

  private updateUI() {
    if (this.progressBar) {
      this.progressBar.progress = this.currentHp / this.maxHp;
    }

    if (this.hpLabel) {
      this.hpLabel.string = `${Math.floor(this.currentHp)}/${this.maxHp}`;
    }

    this.updateBarColor();
  }

  private updateBarColor() {
    if (!this.progressBar) return;

    const percent = this.currentHp / this.maxHp;
    const barSprite = this.progressBar.barSprite;
    if (!barSprite) return;

    if (percent > 0.6) {
      barSprite.color = new Color(0, 255, 0, 255);
    } else if (percent > 0.3) {
      barSprite.color = new Color(255, 255, 0, 255);
    } else {
      barSprite.color = new Color(255, 85, 85, 255);
    }
  }
}
