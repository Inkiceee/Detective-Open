import { _decorator, Component, sys } from "cc";

const { ccclass } = _decorator;

export type AchievementId =
  | "speed_30"
  | "speed_40"
  | "speed_60"
  | "speed_over_60"
  | "wrong_accuse"
  | "watch_ad"
  | "all_guilty";

export interface AchievementInfo {
  id: AchievementId;
  title: string;
  condition: string;
  description: string;
}

export const AchievementList: AchievementInfo[] = [
  {
    id: "speed_30",
    title: "天眼",
    condition: "30分钟内通关",
    description: "关了吧没意思（）",
  },
  {
    id: "speed_40",
    title: "神探",
    condition: "40分钟内通关",
    description: "速度与准确率我全都要",
  },
  {
    id: "speed_60",
    title: "合格的侦探",
    condition: "60分钟内通关",
    description: "作为侦探你及格了",
  },
  {
    id: "speed_over_60",
    title: "持之以恒",
    condition: "60分钟以上通关",
    description: "耐心是你众多优点中的一项",
  },
  {
    id: "wrong_accuse",
    title: "一步之遥",
    condition: "指认错误",
    description: "真相就在眼前，却永远够不到",
  },
  {
    id: "watch_ad",
    title: "游戏支持者",
    condition: "观看广告",
    description: "感谢支持开发者的咖啡钱❤",
  },
  {
    id: "all_guilty",
    title: "全员有罪",
    condition: "指认正确",
    description: "你看透了真相",
  },
];

@ccclass("AchievementSystem")
export class AchievementSystem extends Component {
  private readonly storageKey = "YKW_DETECTIVE_ACHIEVEMENTS_V1";

  unlock(id: AchievementId): boolean {
    const unlocked = this.getUnlockedIds();

    if (unlocked.includes(id)) {
      return false;
    }

    unlocked.push(id);
    sys.localStorage.setItem(this.storageKey, JSON.stringify(unlocked));
    return true;
  }

  isUnlocked(id: AchievementId): boolean {
    return this.getUnlockedIds().includes(id);
  }

  getUnlockedIds(): AchievementId[] {
    const raw = sys.localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((id) =>
        AchievementList.some((achievement) => achievement.id === id),
      ) as AchievementId[];
    } catch {
      return [];
    }
  }

  getAllAchievements() {
    const unlockedIds = this.getUnlockedIds();

    return AchievementList.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.includes(achievement.id),
    }));
  }

  getAchievement(id: AchievementId): AchievementInfo | null {
    return AchievementList.find((achievement) => achievement.id === id) || null;
  }

  unlockByClearTime(totalSeconds: number): AchievementId {
    let id: AchievementId;

    if (totalSeconds <= 30 * 60) {
      id = "speed_30";
    } else if (totalSeconds <= 40 * 60) {
      id = "speed_40";
    } else if (totalSeconds <= 60 * 60) {
      id = "speed_60";
    } else {
      id = "speed_over_60";
    }

    this.unlock(id);
    return id;
  }

  clearAchievements() {
    sys.localStorage.removeItem(this.storageKey);
  }
}