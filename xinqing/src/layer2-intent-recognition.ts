/**
 * 心晴助手 - 第二层：AI意图识别执行模块
 * 
 * 功能：
 * - 调用LLM进行意图识别
 * - 解析AI返回的JSON结果
 * - 容错处理和降级策略
 */

import { IntentResult, UserProfile, buildPrompt } from './layer2-intent-prompt.js';

/**
 * 调用LLM进行意图识别
 * @param userMessage 用户原始消息
 * @param userProfile 用户画像
 * @param llmSimpleChat LLM简单聊天函数
 * @returns 意图识别结果
 */
export async function recognizeIntent(
  userMessage: string,
  userProfile: UserProfile,
  llmSimpleChat: (message: string) => Promise<string>
): Promise<IntentResult> {
  try {
    // 1. 构建提示词（填充用户画像变量）
    const prompt = buildPrompt(userMessage, userProfile);

    // 2. 调用大模型
    console.log('[第二层] 正在调用AI进行意图识别...');
    const response = await llmSimpleChat(prompt);

    // 3. 解析JSON输出
    const result = parseJSONResponse(response);

    // 4. 后处理校验
    return postProcessResult(result);

  } catch (error) {
    console.error('[第二层] 意图识别失败:', error);
    // 解析失败时的降级处理
    return getFallbackResult(userMessage);
  }
}

/**
 * 解析大模型的JSON响应（带容错处理）
 */
function parseJSONResponse(content: string): IntentResult {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取JSON部分（处理模型输出的多余文字）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析JSON响应');
  }
}

/**
 * 后处理校验
 */
function postProcessResult(result: IntentResult): IntentResult {
  // 校验必要字段
  if (!result.intent || !result.subIntent) {
    throw new Error('缺少必要字段');
  }

  // 置信度低于阈值时，降低为通用意图
  if (result.confidence < 0.7) {
    console.warn(`[第二层] 低置信度: ${result.confidence}, 降级为通用意图`);
    result.subIntent = 'chat';
    result.reasoning += '（因置信度较低，降级为普通对话处理）';
  }

  // 危机级别标准化
  if (!['none', 'low', 'medium', 'high'].includes(result.crisisLevel)) {
    result.crisisLevel = 'none';
  }

  return result;
}

/**
 * 降级结果（当AI调用失败时）
 */
function getFallbackResult(message: string): IntentResult {
  return {
    intent: 'chat',
    subIntent: 'chat',
    confidence: 0.3,
    reasoning: '意图识别服务暂时不可用，降级为普通对话处理',
    crisisLevel: 'none',
    extractedData: {},
    safetyCheck: {
      needReview: false,
      warning: null,
      suggestedAction: 'normal'
    }
  };
}
