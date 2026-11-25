# 终端侦探 · Cyber Detective 2.0

一款用 Cocos Creator 制作的中文推理游戏。你将在终端里查阅人物档案、梳理事件时间线并提交指控。调查过程中还会遇到推箱子关卡，可以用 `W`、`A`、`S`、`D` 或方向键移动。

## 网页试玩

**[在 itch.io 在线试玩](https://inkiceee.itch.io/cyber-detective)**，用桌面浏览器打开即可游玩。

### 下载到本机

1. 从 [最新发布页](https://github.com/Inkiceee/Detective-Open/releases/latest) 下载 `CyberDetective-v2.0.1-web.zip` 并解压。
2. 在含有 `index.html` 的目录打开 PowerShell 或终端。如果电脑装有 Python 3，运行以下命令启动本地静态服务器。

   ```sh
   python -m http.server 8000 --bind 127.0.0.1
   ```

3. 用桌面浏览器打开 `http://127.0.0.1:8000`。在游戏终端输入 `help` 查看当前可用的命令，输入 `login` 开始调查，或输入 `load` 查看已有存档。

登录时可使用角色昵称和虚构生日。存档保存在当前浏览器中。继续游戏时请使用同一个浏览器配置和网页地址。

## 打开与构建工程

1. 克隆本仓库，或从发布页下载 `Source code (zip)` 并解压。
2. 在 Cocos Dashboard 中安装 **Cocos Creator 3.8.8**，导入含有 `package.json` 的工程目录。
3. 打开 `assets/Scenes/MainMenu.scene`，点击编辑器顶部的预览按钮。
4. 构建网页时，在构建发布面板选择 **Web Desktop**，将 `MainMenu` 设为启动场景，并纳入 `MainMenu`、`Terminal` 和 `push boxes` 三个场景。默认输出目录为 `build/web-desktop/`。

| 目录 | 内容 |
| --- | --- |
| `assets/Scenes/` | 主菜单、调查终端和推箱子场景 |
| `assets/Codes/` | 终端、案件、存档和成就等游戏逻辑 |
| `assets/Levels/` | 推箱子关卡数据 |
| `assets/resources/`、`assets/UI/` | 视频和界面资源 |
| `terminal-ai/` | 可选的 AI 对话代理与配置模板 |

## 「喵」AI 对话

在游戏终端输入 `喵` 开启对话。以 `喵` 结尾的提问会通过配置的代理发往外部模型服务，例如 `你好喵`。对话中请避免填写个人信息。输入 `quit` 返回游戏终端。网页构建沿用工程里配置的远程代理，AI 回复受服务可用性和用量限额影响。常规调查、存档和推箱子无需配置 AI。

如需在本机运行代理或配置自己的服务，请参阅 [AI 配置指南](terminal-ai/README.md)。版本内容见 [更新记录](CHANGELOG.md)。

## 共同开发

### [@continue-sun-coder](https://github.com/continue-sun-coder)

- 设计并实现终端核心框架 `TerminalManager`，包括状态机、命令分发、计时系统、SOS 视频播放、死亡和重启流程。
- 实现 `LoginSystem` 登录系统、`HpBar` 生命值组件、`SaveSystem` 多存档系统及 `VideoPlayer` 广告视频封装。
- 设计 `CharacterData` 静态数据层并搭建初始结构，完成 `CharacterSystem` 人物档案系统的初版。
- 实现 `MainMenu` 主菜单，搭建 `MainMenu.scene` 和 `Terminal.scene` 并完成组件绑定。

### [@Inkiceee](https://github.com/Inkiceee)

- 完整实现推箱子小游戏，包括 `GameManager`、`MapManager`、`PlayerInputs`、`push boxes.scene` 以及 `Level1` 至 `Level5` 的关卡数据。
- 实现 `AccuseSystem` 真凶指认和 7 种结局判定，以及 `AchievementSystem` 成就系统和成就解锁逻辑。
- 后续完善并接入 `CharacterSystem` 人物档案系统，完整实现时间线答题系统。
- 录入剧情、证物、证词、时间线题库和结局文案，后续开发并接入「喵」AI 对话功能。

## 许可证

项目原创代码使用 [MIT 许可证](LICENSE)。字体、Cocos Creator 运行时和游戏素材按各自的授权条款提供，详见 [第三方许可与素材说明](THIRD_PARTY_NOTICES.md)。
