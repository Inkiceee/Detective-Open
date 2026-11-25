import {
  _decorator,
  Component,
  Node,
  UITransform,
  Sprite,
  SpriteFrame,
  Button,
  director,
} from "cc";

const { ccclass, property } = _decorator;

// 视频播放完成回调类型
export type VideoCompleteCallback = () => void;

@ccclass("VideoPlayer")
export class VideoPlayer extends Component {
  @property(Node)
  videoPanel: Node = null; // 视频面板节点

  @property(Sprite)
  videoSprite: Sprite = null; // 用于显示视频的精灵（如果使用序列帧）

  private completeCallback: VideoCompleteCallback | null = null;
  private videoDuration: number = 5000; // 视频时长（毫秒），默认5秒
  private timer: any = null;

  start() {
    // 初始隐藏视频面板
    if (this.videoPanel) {
      this.videoPanel.active = false;
    }
  }

  // 播放视频（可传入自定义时长）
  playVideo(callback: VideoCompleteCallback, duration: number = 5000) {
    this.completeCallback = callback;
    this.videoDuration = duration;

    // 显示视频面板
    if (this.videoPanel) {
      this.videoPanel.active = true;
    }

    // 开始播放视频（实际项目中这里应该是播放视频文件）
    // 这里模拟视频播放：显示提示文字，用户等待

    // 添加提示文字（如果你有UI文字节点）
    this.showVideoPlayingTip();

    // 设置定时器模拟视频播放完成
    this.timer = setTimeout(() => {
      this.onVideoComplete();
    }, this.videoDuration);
  }

  private showVideoPlayingTip() {
    // 方案1：如果需要显示简单的文字提示，可以在界面上添加一个Label
    console.log("[Video] 正在播放广告视频...");

    // 如果有视频文本节点，可以这样设置
    // if (this.videoTipLabel) {
    //     this.videoTipLabel.string = "正在播放广告... 请稍候";
    // }
  }

  private onVideoComplete() {
    // 清除定时器
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // 隐藏视频面板
    if (this.videoPanel) {
      this.videoPanel.active = false;
    }

    // 调用完成回调
    if (this.completeCallback) {
      this.completeCallback();
      this.completeCallback = null;
    }
  }

  // 手动关闭（如果用户想提前关闭，但根据需求不可退出，所以这个方法可能需要限制）
  // 如果确实需要强制结束，可以调用这个方法
  forceComplete() {
    this.onVideoComplete();
  }

  onDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
