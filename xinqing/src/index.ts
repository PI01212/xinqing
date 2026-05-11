/**
 * 心晴——大学生心理健康陪伴助手
 * 主入口文件
 * 
 * 架构：
 * - 第一层：正则快速匹配（零成本）
 * - 第二层：AI意图识别（智谱API）
 * - 第三层：安全检查规则（代码强制执行）
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

// 导入三级架构模块
import { fastMatch, FastMatchResult } from './layer1-fast-match.js';
import { recognizeIntent, IntentResult, UserProfile } from './layer2-intent-recognition.js';
import { safetyCheck, SafetyCheckResult } from './layer3-safety-check.js';

// 导入LLM客户端
import { createZhipuClient, ZhipuClient } from './llm/zhipu-client.js';

// 导入长期记忆和知识库集成服务
import { createMemoryAndKnowledgeService } from './integration/memory-knowledge-service.js';

// 导入情感分析引擎
import { createEmotionAnalyzer, EmotionAnalysisResult } from './emotion/emotion-analyzer.js';

// 导入主动服务模块
import { createProactiveService } from './proactive/proactive-service.js';

// 导入情绪可视化服务
import { createEmotionVisualizationService } from './visualization/emotion-visualization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const PORT = process.env.PORT || 3000;

// 创建Express应用
const app = express();
const server = createServer(app);

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// WebSocket服务器
const wss = new WebSocketServer({ server });

// 存储用户连接
const clients = new Map<string, WebSocket>();

// 存储用户画像（简化版，实际应使用数据库）
const userProfiles = new Map<string, UserProfile>();

// LLM客户端
const llmClient: ZhipuClient = createZhipuClient();
const llmAvailable = llmClient.isAvailable();

// 长期记忆和知识库服务
const memoryKnowledgeService = createMemoryAndKnowledgeService();

// 情感分析引擎
const emotionAnalyzer = createEmotionAnalyzer();

// 主动服务模块
const proactiveService = createProactiveService();

// 情绪可视化服务
const emotionVisualization = createEmotionVisualizationService();

/**
 * 消息类型定义
 */
interface Message {
  type: 'chat' | 'ping' | 'pong';
  text?: string;
  deviceId?: string;
  timestamp?: number;
}

/**
 * 处理WebSocket连接
 */
wss.on('connection', (ws: WebSocket) => {
  const connectionId = uuidv4();
  clients.set(connectionId, ws);

  console.log(`[连接] 客户端已连接: ${connectionId}`);
  console.log(`[状态] 当前连接数: ${clients.size}`);

  // 发送欢迎消息
  const welcomeMessage = llmAvailable
    ? '你好呀！我是**心晴**，你的心理健康陪伴助手。🌟\n\n无论你今天心情如何，我都在这里倾听你、陪伴你。有什么想聊的吗？'
    : '你好！我是心晴，你的心理健康陪伴助手。\n\n⚠️ AI服务暂未配置，请设置ZHIPU_API_KEY环境变量。';

  sendMessage(ws, {
    type: 'chat',
    text: welcomeMessage,
    timestamp: Date.now(),
  });

  // 处理客户端消息
  ws.on('message', async (data: Buffer) => {
    try {
      const message: Message = JSON.parse(data.toString());
      await handleMessage(ws, message, connectionId);
    } catch (error) {
      console.error('[错误] 消息解析失败:', error);
      sendMessage(ws, {
        type: 'chat',
        text: '消息格式错误，请重试。',
        timestamp: Date.now(),
      });
    }
  });

  // 处理断开连接
  ws.on('close', () => {
    clients.delete(connectionId);
    console.log(`[断开] 客户端已断开: ${connectionId}`);
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error(`[错误] WebSocket错误:`, error.message);
  });
});

/**
 * 处理接收到的消息（三级架构核心流程）
 */
async function handleMessage(ws: WebSocket, message: Message, connectionId: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[消息] 收到消息: "${message.text}"`);
  console.log(`[设备ID] ${message.deviceId}`);

  if (!message.text) {
    sendMessage(ws, {
      type: 'chat',
      text: '消息内容不能为空',
      timestamp: Date.now(),
    });
    return;
  }

  try {
    // ════════════════════════════════════════════════════════
    // 第一层：快速匹配（正则，零成本，<5ms）
    // ════════════════════════════════════════════════════════
    const fastResult: FastMatchResult | null = fastMatch(message.text);
    
    if (fastResult && fastResult.matched) {
      console.log(`[第一层✅] 命中类型: ${fastResult.type} (无需调用AI)`);
      sendMessage(ws, {
        type: 'chat',
        text: fastResult.response,
        timestamp: Date.now(),
      });
      return;
    }

    console.log(`[第一层❌] 未匹配，进入第二层`);

    // 检查LLM是否可用
    if (!llmAvailable) {
      sendMessage(ws, {
        type: 'chat',
        text: `❌ AI服务未配置。\n\n请设置环境变量后重启服务：\n\n` +
              `智谱ChatGLM(推荐)：设置 \`ZHIPU_API_KEY\`\n` +
              `获取地址：https://open.bigmodel.cn/`,
        timestamp: Date.now(),
      });
      return;
    }

    // 获取或创建用户画像
    const userProfile = getOrCreateUserProfile(message.deviceId || connectionId);

    // ════════════════════════════════════════════════════════
    // 第二层：AI意图识别（500ms-1s）
    // ════════════════════════════════════════════════════════
    console.log('[第二层] 正在进行AI意图识别...');
    const intentResult: IntentResult = await recognizeIntent(
      message.text,
      userProfile,
      (msg) => llmClient.simpleChat(msg)
    );

    console.log(`[第二层✅] 识别结果:`);
    console.log(`  - 意图: ${intentResult.intent}/${intentResult.subIntent}`);
    console.log(`  - 置信度: ${intentResult.confidence}`);
    console.log(`  - 危机级别: ${intentResult.crisisLevel}`);

    // ════════════════════════════════════════════════════════
    // 2.5层：情感分析（实时分析用户情感状态）
    // ════════════════════════════════════════════════════════
    const emotionAnalysis = emotionAnalyzer.analyzeAndRecord(
      message.deviceId || connectionId,
      message.text
    );

    console.log(`[2.5层✅] 情感分析结果:`);
    console.log(`  - 极性: ${emotionAnalysis.sentiment} (${emotionAnalysis.score})`);
    console.log(`  - 主要情绪: ${emotionAnalysis.primaryEmotion}`);
    console.log(`  - 强度: ${emotionAnalysis.intensity}/10`);
    console.log(`  - 危机级别: ${emotionAnalysis.crisisLevel}`);

    // 如果检测到危机信号，触发主动服务预警
    if (emotionAnalysis.crisisLevel === 'urgent' || emotionAnalysis.crisisLevel === 'warning') {
      await proactiveService.triggerCrisisAlert(
        message.deviceId || connectionId,
        emotionAnalysis
      );
    }

    // ════════════════════════════════════════════════════════
    // 第三层：安全检查（代码强制执行，<1ms）
    // ════════════════════════════════════════════════════════
    const safetyResult: SafetyCheckResult = safetyCheck(intentResult, message.text);
    
    console.log(`[第三层] 安全检查结果:`);
    console.log(`  - 级别: ${safetyResult.level}`);
    console.log(`  - 通过: ${safetyResult.pass}`);

    // 根据安全检查结果决定响应策略
    let finalResponse: string;

    if (!safetyResult.pass && safetyResult.level === 'BLOCK') {
      // 🔴 BLOCK：拦截，返回危机干预信息
      console.log(`[🔴 BLOCK] 拦截消息，返回危机干预信息`);
      finalResponse = safetyResult.response!;
    } else if (safetyResult.level === 'WARN' || safetyResult.level === 'URGENT') {
      // ⚠️ WARN / 🟠 URGENT：正常回复 + 附加提示
      console.log(`[${safetyResult.level === 'WARN' ? '⚠️ WARN' : '🟠 URGENT'}] 附加安全提示`);

      // 生成正常的对话回复（使用增强提示词）
      const { enhancedPrompt } = await memoryKnowledgeService.buildContext(
        message.deviceId || connectionId,
        message.text,
        intentResult
      );
      const chatResponse = await llmClient.simpleChat(enhancedPrompt);

      // 合并安全提示
      const extraTip = safetyResult.warningResponse || safetyResult.suggestionResponse;
      finalResponse = `${chatResponse}\n\n───\n\n${extraTip}`;
    } else {
      // ✅ PASS：正常生成回复（使用增强提示词）
      console.log(`[✅ PASS] 生成正常回复（增强版）`);

      const { enhancedPrompt } = await memoryKnowledgeService.buildContext(
        message.deviceId || connectionId,
        message.text,
        intentResult
      );
      finalResponse = await llmClient.simpleChat(enhancedPrompt);
    }

    // 更新用户画像（简化版）
    updateUserProfile(message.deviceId || connectionId, intentResult);

    // 记录到长期记忆
    await memoryKnowledgeService.processAndRecord(
      message.deviceId || connectionId,
      intentResult,
      message.text
    );

    // 发送最终回复（包含情感分析结果）
    sendMessage(ws, {
      type: 'chat',
      text: finalResponse,
      reply: finalResponse,  // 前端使用
      emotionAnalysis: {      // 情感分析数据（前端用于显示）
        sentiment: emotionAnalysis.sentiment,
        score: emotionAnalysis.score,
        primaryEmotion: emotionAnalysis.primaryEmotion,
        intensity: emotionAnalysis.intensity,
        crisisLevel: emotionAnalysis.crisisLevel,
        needsAttention: emotionAnalysis.needsAttention
      },
      timestamp: Date.now(),
    });

    console.log(`[完成] 回复已发送`);

  } catch (error) {
    console.error('[错误] 处理消息失败:', error);
    sendMessage(ws, {
      type: 'chat',
      text: '抱歉，处理您的消息时出现了错误。请稍后再试。',
      timestamp: Date.now(),
    });
  }
}

/**
 * 获取或创建用户画像
 */
function getOrCreateUserProfile(deviceId: string): UserProfile {
  if (userProfiles.has(deviceId)) {
    return userProfiles.get(deviceId)!;
  }

  const newProfile: UserProfile = {
    userId: deviceId,
    ageGroup: '18-25岁',
    grade: '未知',
    emotionTrend: '数据不足',
    commonStressors: [],
    interactionSummary: '首次交互'
  };

  userProfiles.set(deviceId, newProfile);
  return newProfile;
}

/**
 * 更新用户画像
 */
function updateUserProfile(deviceId: string, intentResult: IntentResult): void {
  const profile = userProfiles.get(deviceId);
  if (!profile) return;

  // 更新最后记录的情绪
  if (intentResult.extractedData?.emotion) {
    profile.lastEmotion = intentResult.extractedData.emotion;
    profile.lastEmotionTime = new Date().toLocaleString();
  }

  // 更新交互摘要
  profile.interactionSummary = `最近一次交互：${intentResult.intent}/${intentResult.subIntent}`;
}

/**
 * 发送消息给客户端
 */
function sendMessage(ws: WebSocket, message: Message): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    llmAvailable: llmAvailable,
    timestamp: Date.now(),
  });
});

// 注册情绪可视化API路由
app.use(emotionVisualization.getRouter());

// 静态文件服务（提供前端页面）- 使用已声明的 __dirname
app.use(express.static(path.join(__dirname, '../public')));

// 根路径重定向到index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 启动服务器
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                                                  ║');
  console.log('║     🌟 心晴 —— 大学生心理健康陪伴助手 🌟         ║');
  console.log('║                                                  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  const portStr = String(PORT);
  console.log(`║  服务器地址: http://localhost:${portStr.padEnd(24)}║`);
  console.log(`║  WebSocket:   ws://localhost:${portStr.padEnd(27)}║`);
  console.log(`║  健康检查:   http://localhost:${portStr}/health`.padEnd(47) + '║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  LLM状态: ${llmAvailable ? '✅ 已配置' : '❌ 未配置'.padEnd(38)}║`);
  
  if (llmAvailable) {
    const modelInfo = llmClient.getModelInfo();
    console.log(`║  LLM模型: ${`${modelInfo.provider}/${modelInfo.model}`.padEnd(38)}║`);
  } else {
    console.log('║                                                  ║');
    console.log('║  ⚠️  请设置环境变量启动AI功能：                    ║');
    console.log('║     $env:ZHIPU_API_KEY="your_key"                ║');
    console.log('║     获取地址: https://open.bigmodel.cn/           ║');
  }
  
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  核心功能模块：                                    ║');
  console.log('║  ✅ 三级架构（正则匹配+AI识别+安全检查）          ║');
  console.log('║  ✅ 情感分析引擎（实时情绪识别与追踪）            ║');
  console.log('║  ✅ 长期记忆系统（用户画像与核心记忆）             ║');
  console.log('║  ✅ 知识库检索（RAG增强回复）                      ║');
  console.log('║  ✅ 主动服务模块（定时关怀推送）                   ║');
  console.log('║  ✅ 情绪可视化API（趋势图表数据接口）              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 前端页面: http://localhost:${portStr}`.padEnd(47) + '║');
  console.log('║  API端点：                                         ║');
  console.log(`║    健康检查:   /health`.padEnd(47) + '║');
  console.log(`║    情绪趋势:   /api/emotion/trend/:userId`.padEnd(47) + '║');
  console.log(`║    数据仪表盘: /api/emotion/dashboard/:userId`.padEnd(47) + '║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
