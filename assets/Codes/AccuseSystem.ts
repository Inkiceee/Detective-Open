import { _decorator, Component } from "cc";
import { AccuseEndings, AccuseEndingMap } from "./CharacterData";

const { ccclass } = _decorator;

export interface AccuseCallbacks {
  addRichLine: (text: string, color?: string) => void;
  showGameOver: () => void;
  onGameComplete: () => void;
  getCurrentHp: () => number;
}

@ccclass("AccuseSystem")
export class AccuseSystem extends Component {
  private callbacks: AccuseCallbacks = null!;

  init(callbacks: AccuseCallbacks) {
    this.callbacks = callbacks;
  }

  showAccuseMenu() {
    this.callbacks.addRichLine("", "#FFFFFF");
    this.callbacks.addRichLine("========== 指认真凶 =========", "#00FF00");

    AccuseEndings.forEach((ending) => {
  const color = ending.isCancel ? "#AAAAAA" : "#FFFFFF";
  this.callbacks.addRichLine(`${ending.id}. ${ending.title}`, color);
});

    this.callbacks.addRichLine(
      `输入 <color=#CE831E>accuse 1-${this.getMaxChoice()}</color> 进行选择。`,
      "#CE831E",
    );
  }

  handleAccuse(choice: number) {
    if (!Number.isInteger(choice)) {
      this.showInvalidChoiceMessage();
      return;
    }

    const ending = AccuseEndingMap[choice];

    if (!ending) {
      this.showInvalidChoiceMessage();
      return;
    }

    this.callbacks.addRichLine("", "#FFFFFF");
    this.callbacks.addRichLine("========================================", "#00FF00");
    this.callbacks.addRichLine(`  ${ending.title}`, "#00FF00");
    this.callbacks.addRichLine("========================================", "#00FF00");

    this.addParagraphText(ending.resultText, "#FFFFFF");

    if (ending.isCancel) {
      return;
    }

    if (ending.isBestEnding) {
      this.callbacks.addRichLine("", "#00FF00");
      this.callbacks.addRichLine("Game Win", "#00FF00");
      this.callbacks.onGameComplete();
      return;
    }

    if (ending.isPartialEnding) {
      this.callbacks.addRichLine("", "#CE831E");
      this.callbacks.addRichLine(
        "案件已被迫结案，但这不是最完整的答案。",
        "#CE831E",
      );
      this.callbacks.onGameComplete();
      return;
    }

    this.callbacks.addRichLine("", "#FF5555");
    this.callbacks.addRichLine("指认失败。调查声誉受损。", "#FF5555");
    this.callbacks.showGameOver();
    this.callbacks.onGameComplete();
  }

  handleAccuseInput(cmd: string): boolean {
    const input = cmd.trim().toLowerCase();

    if (input === "accuse") {
      this.showAccuseMenu();
      return true;
    }

    const match = input.match(/^accuse\s+(\d+)$/);

    if (!match) {
      this.showInvalidChoiceMessage();
      return true;
    }

    const choice = Number(match[1]);
    this.handleAccuse(choice);
    return true;
  }

  private showInvalidChoiceMessage() {
    this.callbacks.addRichLine(
      `请输入 <color=#CE831E>accuse 1-${this.getMaxChoice()}</color> 进行选择。`,
      "#FF5555",
    );
  }

  private getMaxChoice(): number {
    return AccuseEndings.length;
  }

  private addParagraphText(text: string, color: string) {
    const paragraphs = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    paragraphs.forEach((paragraph, index) => {
      this.callbacks.addRichLine(paragraph, color);

      if (index < paragraphs.length - 1) {
        this.callbacks.addRichLine("", color);
      }
    });
  }
}