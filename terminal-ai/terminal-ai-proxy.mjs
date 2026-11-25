import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const MAX_GENERATED_TOKENS = 10000;
const MAX_BODY_BYTES = 65536;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 12000;
const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_REPLY_CHARS = 40000;
const SYSTEM_PROMPT = "你是游戏终端中的猫咪 AI 助手喵。用简洁、友善的中文回答，可以偶尔以喵结尾。你没有游戏背景资料，只能依据玩家提供的信息讨论游戏剧情；不知道的设定直接说明，不要编造真凶、线索或人物经历。你无法读取游戏文件、存档或执行游戏指令，不要声称修改了游戏。不输出内部推理过程。";

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function normalizeConfig(raw = {}) {
  const apiKey = String(raw.apiKey || "").trim();
  const model = String(raw.model || "").trim();
  if (!apiKey || !model) throw new Error("请先在 ai-config.json 中填写 apiKey 和 model，或设置 AI_API_KEY / AI_MODEL 环境变量。");
  let endpoint;
  try {
    const url = String(raw.baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
    endpoint = new URL(url.endsWith("/chat/completions") ? url : `${url}/chat/completions`);
  } catch { throw new Error("baseUrl 不是有效的 API 地址。"); }
  if (!["https:", "http:"].includes(endpoint.protocol)) throw new Error("API 地址必须使用 http 或 https。");
  const tokenLimitParameter = raw.tokenLimitParameter || "max_completion_tokens";
  if (!["max_completion_tokens", "max_tokens"].includes(tokenLimitParameter)) {
    throw new Error("tokenLimitParameter 只能是 max_completion_tokens 或 max_tokens；必须确认所选平台会限制隐藏思考与回答的总生成量。");
  }
  const requestedLimit = Number(raw.maxGeneratedTokens ?? MAX_GENERATED_TOKENS);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error("maxGeneratedTokens 必须是正整数。");
  const timeoutMs = Math.min(Math.max(Number(raw.timeoutMs) || 120000, 1000), 120000);
  return {
    apiKey, model, endpoint: endpoint.toString(), tokenLimitParameter,
    maxGeneratedTokens: Math.min(requestedLimit, MAX_GENERATED_TOKENS),
    host: String(raw.host || "127.0.0.1"), port: Number(raw.port ?? 8787), timeoutMs,
    allowedOrigins: Array.isArray(raw.allowedOrigins) ? raw.allowedOrigins.filter(x => typeof x === "string") : [],
  };
}

export function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_HISTORY_MESSAGES) {
    throw new RequestError(400, "对话记录数量不正确，请退出 AI 后重新开启。");
  }
  let chars = 0;
  const messages = value.map((message, index) => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (!message || message.role !== role || typeof message.content !== "string" || !message.content.trim()) {
      throw new RequestError(400, "对话记录格式不正确，只能交替发送用户消息与 AI 回答。");
    }
    if ((role === "user" && message.content.length > MAX_USER_MESSAGE_CHARS) || message.content.length > MAX_REPLY_CHARS) {
      throw new RequestError(400, "消息过长，请缩短后再发送。");
    }
    chars += message.content.length;
    return { role, content: message.content };
  });
  if (messages.at(-1).role !== "user" || chars > MAX_HISTORY_CHARS) {
    throw new RequestError(400, "对话上下文过长或缺少最新问题，请退出 AI 后重新开启。");
  }
  return messages;
}

function isAllowedOrigin(origin, config) {
  if (!origin) return true; // 原生客户端没有浏览器 Origin。
  if (config.allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0, rejected = false;
    req.on("data", chunk => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(new RequestError(413, "请求过大，请缩短消息后重试。"));
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      if (rejected) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new RequestError(400, "请求必须是有效的 JSON。")); }
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new RequestError(400, "请求已取消。")));
  });
}

function reply(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export function createAiProxy(rawConfig, { fetchImpl = globalThis.fetch } = {}) {
  const config = normalizeConfig(rawConfig);
  let activeRequests = 0;
  let tokenLimitViolation = false;
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin, config)) { reply(res, 403, { error: "当前页面未获准访问 AI 代理，请配置 allowedOrigins。" }); return; }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const pathname = (req.url || "").split("?")[0];
    if (req.method === "GET" && pathname === "/health") {
      reply(res, 200, { ready: !tokenLimitViolation, maxGeneratedTokens: config.maxGeneratedTokens });
      return;
    }
    if (pathname !== "/api/chat" || req.method !== "POST") { reply(res, 404, { error: "接口不存在，请使用 POST /api/chat。" }); return; }
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      reply(res, 415, { error: "请使用 application/json 请求格式。" }); return;
    }
    let messages;
    try {
      const body = await readJsonBody(req);
      messages = validateMessages(body?.messages);
    } catch (error) {
      reply(res, error instanceof RequestError ? error.status : 400, {
        error: error instanceof RequestError ? error.message : "无法读取聊天消息。",
      });
      return;
    }
    if (req.aborted || res.destroyed || res.writableEnded) return;
    // 服务端也检查触发词；未触发的消息不占模型并发、不调用 AMD。
    if (!messages.at(-1).content.trimEnd().endsWith("喵")) {
      reply(res, 200, {
        reply: "听不懂喵", limitReached: false, tokenLimit: config.maxGeneratedTokens,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
      return;
    }
    if (tokenLimitViolation) { reply(res, 503, { error: "上游曾超出设置的 token 上限，已停用此代理。请核对平台参数后重启代理。" }); return; }
    if (activeRequests >= 2) { reply(res, 429, { error: "AI 服务正在处理其他请求，请稍后再试。" }); return; }
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    req.on("aborted", cancel);
    res.on("close", cancel); // 玩家 quit / 关闭页面后，取消向模型发出的请求。
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
    activeRequests++;
    try {
      if (controller.signal.aborted) throw new Error("cancelled");
      // 模型、Key 和额度都由代理决定；客户端无法覆盖这些字段，也不会自动无上限重试。
      const payload = {
        model: config.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: false,
        n: 1,
        [config.tokenLimitParameter]: config.maxGeneratedTokens,
      };
      const upstream = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      if (!upstream.ok) {
        // 不把上游原始报错/鉴权头转发到游戏；不自动更换 token 参数或重试扣费。
        await upstream.body?.cancel();
        const message = upstream.status === 401 || upstream.status === 403
          ? "模型 API 鉴权失败，请检查代理中的 API Key。"
          : upstream.status === 429
            ? "模型 API 额度不足或请求过多，请检查账户后稍后重试。"
            : upstream.status === 400
              ? "模型 API 拒绝了请求，请检查模型名、接口地址和 tokenLimitParameter 是否受支持；未进行无上限重试。"
              : `模型 API 请求失败（HTTP ${upstream.status}），请查看服务商状态。`;
        throw new RequestError(502, message);
      }
      const data = await upstream.json();
      const choice = data?.choices?.[0];
      if (!choice?.message) throw new RequestError(502, "模型 API 返回格式不兼容，请确认接口使用 Chat Completions 格式。");
      const generated = data.usage?.completion_tokens;
      const reasoning = data.usage?.completion_tokens_details?.reasoning_tokens;
      if ((typeof generated === "number" && generated > config.maxGeneratedTokens)
        || (typeof reasoning === "number" && reasoning > config.maxGeneratedTokens)) {
        tokenLimitViolation = true;
        throw new RequestError(502, "上游返回的生成用量超过配置上限，已停用后续请求。请核对该平台的额度参数。");
      }
      const content = choice.message.content ?? choice.message.refusal ?? "";
      if (typeof content !== "string" || content.length > MAX_REPLY_CHARS) {
        throw new RequestError(502, "模型 API 返回的文字格式不正确或过长。");
      }
      const limitReached = ["length", "max_tokens"].includes(choice.finish_reason)
        || (typeof generated === "number" && generated >= config.maxGeneratedTokens);
      const usage = data.usage && typeof data.usage === "object" ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens,
      } : null;
      reply(res, 200, { reply: content, limitReached, tokenLimit: config.maxGeneratedTokens, usage });
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      if (timedOut) reply(res, 504, { error: "AI 生成超时，已取消本次请求。请缩小问题后重试。" });
      else if (controller.signal.aborted) reply(res, 499, { error: "AI 请求已取消。" });
      else if (error instanceof RequestError) reply(res, error.status, { error: error.message });
      else reply(res, 502, { error: "无法连接模型 API 或上游返回无效 JSON，请检查代理配置和网络。" });
    } finally {
      clearTimeout(timeout);
      req.off("aborted", cancel); res.off("close", cancel);
      activeRequests--;
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  return server;
}

function main() {
  try {
    const configPath = process.env.AI_CONFIG_PATH || fileURLToPath(new URL("./ai-config.json", import.meta.url));
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    if (process.env.AI_API_KEY) raw.apiKey = process.env.AI_API_KEY;
    if (process.env.AI_MODEL) raw.model = process.env.AI_MODEL;
    if (process.env.AI_BASE_URL) raw.baseUrl = process.env.AI_BASE_URL;
    const config = normalizeConfig(raw);
    const server = createAiProxy(raw);
    server.on("error", error => { console.error(`AI 代理启动失败：${error.message}`); process.exitCode = 1; });
    server.listen(config.port, config.host, () => {
      console.log(`喵 AI 代理已启动：http://${config.host}:${config.port}/api/chat`);
      console.log(`每次生成上限：${config.maxGeneratedTokens} token；参数：${config.tokenLimitParameter}。`);
      console.log("句末加“喵”才调用模型；只发送玩家聊天记录，不读取背景文件。");
      console.log("Key 保留在代理中；按 Ctrl+C 停止服务。");
    });
    const stop = () => {
      server.close(() => process.exit(0));
      server.closeAllConnections();
    };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch (error) {
    console.error(`AI 代理未启动：${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
