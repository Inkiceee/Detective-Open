import { _decorator, Component, Button, director } from "cc";
import { SimpleSaveSystem } from "./SaveSystem";

const { ccclass, property } = _decorator;

@ccclass("MainMenu")
export class MainMenu extends Component {
  @property(Button)
  newGameBtn: Button = null;

  @property(Button)
  continueBtn: Button = null;

  private saveSystem: SimpleSaveSystem = null;

  start() {
    // 初始化存档系统
    this.saveSystem = this.node.addComponent(SimpleSaveSystem);

    // 检查是否有存档，设置继续按钮是否可用
    const hasSave = this.saveSystem.hasSave();
    if (this.continueBtn) {
      this.continueBtn.interactable = hasSave;
    }

    // 绑定按钮事件
    if (this.newGameBtn) {
      this.newGameBtn.node.on(Button.EventType.CLICK, this.onNewGame, this);
    }

    if (this.continueBtn) {
      this.continueBtn.node.on(Button.EventType.CLICK, this.onContinue, this);
    }
  }

  // 新游戏
  onNewGame() {
    // 不删除旧存档，Terminal 登录后会创建新存档
    director.loadScene("Terminal");
  }

  // 继续游戏
  onContinue() {
    // 直接加载游戏场景（Terminal 会自动加载存档并跳过登录）
    director.loadScene("Terminal");
  }

}
