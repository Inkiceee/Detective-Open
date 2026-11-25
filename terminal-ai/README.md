# 「喵」AI 对话配置

代理使用 Node.js 22 或更新版本，无需安装 npm 依赖。示例配置使用 AMD Radeon Cloud 的 `Gemma-4-31B-IT` 模型。

## 本机运行

在仓库根目录打开 PowerShell，复制配置模板。

```powershell
Copy-Item .\terminal-ai\ai-config.example.json .\terminal-ai\ai-config.json
```

在 `terminal-ai/ai-config.json` 中填写自己的 `apiKey`，或在启动代理前设置当前终端的 `AI_API_KEY` 环境变量。密钥由代理使用，请保存在本机配置或服务端环境变量中。

```powershell
node .\terminal-ai\terminal-ai-proxy.mjs
```

访问 `http://127.0.0.1:8787/health` 检查代理是否启动。`ready: true` 表示代理可以接收请求，模型账号是否有效要通过一次实际提问确认。

在 Cocos Creator 中打开 `assets/Scenes/Terminal.scene`，选中挂有 `TerminalManager` 的节点，将 **Ai Proxy Url** 改为 `http://127.0.0.1:8787/api/chat`，然后从 `MainMenu` 预览。已有网页包使用构建时的地址，更新场景后需要重新构建网页包。

## 对话操作

1. 在游戏终端输入 `喵` 开启对话。
2. 输入 `你好喵` 发送提问。消息最后一个非空白字符必须是 `喵`。其他消息会收到本地回复「听不懂喵」。
3. 输入 `quit` 退出对话并恢复原来的游戏状态。等待回复时也可以退出。

代理向模型发送对话记录。需要讨论案件时，可以在提问中提供已找到的线索。默认每次生成上限为 10,000 token，代理请求超时为 120 秒。

## 托管代理

将代理部署到自己的 HTTPS 服务，将实际使用的网页来源填入 `allowedOrigins`，并在服务端设置访问控制和用量限制。部署平台需要监听外部接口时，按平台要求配置 `host` 和 `port`。在场景里将 **Ai Proxy Url** 指向该服务的 `/api/chat`，保存后重新构建。
