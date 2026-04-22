/**
 * 心晴助手 - 第三层：安全检查模块（代码强制执行）
 * 
 * 功能：
 * - 独立于AI判断的强制性安全规则
 * - 三级风险分类：BLOCK / WARN / URGENT
 * - 89个安全关键词覆盖
 * - 危机干预资源提供
 */

import { IntentResult } from './layer2-intent-prompt.js';

export interface SafetyCheckResult {
  pass: boolean;
  level: 'BLOCK' | 'WARN' | 'URGENT' | 'PASS';
  response?: string;
  warningResponse?: string;
  suggestionResponse?: string;
  reason: string;
  shouldAlertHuman?: boolean;
}

// ─────────────────────────────────────────────────────────
// 安全规则配置表
// ─────────────────────────────────────────────────────────

const SAFETY_RULES = {
  // ════════════════════════════════════════════════════════
  // 绝对禁止关键词（BLOCK级别）- 43个
  // ════════════════════════════════════════════════════════
  absoluteForbidden: {
    suicide: [
      '想死', '不想活了', '活着没意思', '去死', '自杀',
      '割腕', '跳楼', '吃药自杀', '离开这个世界',
      '不想在这个世界待了', '结束生命', '了结自己',
      '不想再活', '活得累不如死了', '想解脱'
    ],
    psychosis: [
      '听到声音', '有人要害我', '控制不了自己',
      '脑子里有声音', '有人跟踪我', '世界是假的',
      '有人在监视我', '脑电波控制'
    ],
    harmOthers: [
      '想杀人', '想报复', '想伤害别人',
      '毁了他', '毁了她', '让他付出代价',
      '想炸', '想动手'
    ],
    severe: [
      '彻底完了', '没救了', '一切都毁了', '人生没有希望',
      '生不如死', '与其活着不如死', '不想存在于这个世界上',
      '准备后事', '写遗书', '买安眠药', '怎么死不痛苦'
    ]
  },

  // ════════════════════════════════════════════════════════
  // 条件警告关键词（WARN级别）- 33个
  // ════════════════════════════════════════════════════════
  conditionalWarning: {
    depression: {
      keywords: ['抑郁', '没兴趣', '什么都不想做', '活着好累',
                 '总是想哭', '睡不着', '失眠', '不想吃东西',
                 '觉得自己没用', '没有价值', '前途无望'],
      responseTemplate: (keyword: string) =>
        `我注意到你提到了「${keyword}」，这听起来让你很辛苦。\n\n` +
        `1. 有这些感受并不是你的错\n` +
        `2. 如果这种感觉已持续超过两周并影响日常生活，建议咨询学校心理咨询中心\n` +
        `3. 我会一直在这里陪你聊 💙`
    },
    anxiety: {
      keywords: ['焦虑', '很焦虑', '心慌', '心跳快', '停不下来想',
                 '害怕', '恐惧', '手抖', '发抖', '呼吸困难',
                 '总觉得要发生坏事', '坐立难安'],
      responseTemplate: (keyword: string) =>
        `听起来你现在感到${keyword === '焦虑' ? '焦虑' : '紧张'}，这种感受确实让人不舒服。\n\n` +
        `🫁 可以试试4-7-8呼吸法：吸气4秒，屏息7秒，呼气8秒\n` +
        `⚠️ 如果这种感觉经常出现（每周多次），建议去学校心理咨询中心聊聊`
    },
    acuteStress: {
      keywords: ['刚经历', '刚刚发生', '创伤', 'PTSD',
                 '噩梦连连', '做噩梦', '闪回', '突然想起来',
                 '出事了', '事故'],
      responseTemplate: () =>
        `听起来你刚经历了一件很难的事情。你现在安全吗？身边有人可以陪伴你？\n\n` +
        `⚠️ 如果这件事对你冲击很大，强烈建议联系学校心理咨询中心或当地精神卫生中心`
    }
  },

  // ════════════════════════════════════════════════════════
  // 建议就医关键词（URGENT级别）- 13个
  // ════════════════════════════════════════════════════════
  suggestProfessionalHelp: [
    '想去看心理医生', '吃过抗抑郁药', '以前住过院',
    '医生说我有', '药吃完了', '停药了', '症状又出现了',
    '持续两周以上', '影响正常生活', '无法集中注意力',
    '记忆力下降', '体重明显变化', '确诊', '诊断'
  ],

  // ════════════════════════════════════════════════════════
  // 危机干预资源
  // ════════════════════════════════════════════════════════
  crisisResources: {
    hotlines: [
      { name: '全国希望24热线', number: '400-161-9995', hours: '24小时' },
      { name: '北京心理危机干预中心', number: '010-82951332', hours: '24小时' },
      { name: '各地12320卫生热线', number: '12320', hours: '24小时' },
    ]
  }
};

// ─────────────────────────────────────────────────────────
// 第三层：安全检查主函数
// ─────────────────────────────────────────────────────────

/**
 * 第三层安全检查（代码强制执行，独立于AI判断）
 */
export function safetyCheck(
  intentResult: IntentResult,
  userMessage: string
): SafetyCheckResult {
  const { absoluteForbidden, conditionalWarning, suggestProfessionalHelp, crisisResources } = SAFETY_RULES;

  // ════════════════════════════════════════════════════════
  // Step 1: 绝对禁止检查（最高优先级）
  // ════════════════════════════════════════════════════════
  const blockResult = checkAbsoluteForbidden(userMessage);
  if (blockResult.blocked) {
    logSecurityEvent('BLOCK', userMessage, blockResult);
    return {
      pass: false,
      level: 'BLOCK',
      response: generateCrisisResponse(blockResult.type, crisisResources),
      reason: blockResult.reason,
      shouldAlertHuman: true
    };
  }

  // ════════════════════════════════════════════════════════
  // Step 2: 条件警告检查
  // ════════════════════════════════════════════════════════
  const warnResult = checkConditionalWarning(userMessage, conditionalWarning);
  if (warnResult.warning) {
    logSecurityEvent('WARN', userMessage, warnResult);
    return {
      pass: true,
      level: 'WARN',
      warningResponse: warnResult.response,
      reason: warnResult.reason
    };
  }

  // ════════════════════════════════════════════════════════
  // Step 3: 建议就医检查
  // ════════════════════════════════════════════════════════
  const urgentResult = checkUrgentCare(userMessage, suggestProfessionalHelp);
  if (urgentResult.needSuggestion) {
    logSecurityEvent('URGENT', userMessage, urgentResult);
    return {
      pass: true,
      level: 'URGENT',
      suggestionResponse: generateProfessionalHelpResponse(),
      reason: urgentResult.reason
    };
  }

  // ════════════════════════════════════════════════════════
  // Step 4: AI安全检查结果复核
  // ════════════════════════════════════════════════════════
  if (intentResult?.safetyCheck?.needReview === true &&
      intentResult?.safetyCheck?.warning) {
    if (intentResult.safetyCheck.warning.includes('【必须拦截】')) {
      logSecurityEvent('AI_BLOCK', userMessage, intentResult.safetyCheck);
      return {
        pass: false,
        level: 'BLOCK',
        response: generateCrisisResponse('ai_detected', crisisResources),
        reason: 'AI识别到严重安全风险：' + intentResult.safetyCheck.warning
      };
    }
    return {
      pass: true,
      level: 'WARN',
      warningResponse: `⚠️ ${intentResult.safetyCheck.warning}`,
      reason: 'AI识别到潜在风险'
    };
  }

  // ════════════════════════════════════════════════════════
  // Step 5: 全部通过
  // ════════════════════════════════════════════════════════
  return {
    pass: true,
    level: 'PASS',
    reason: '安全检查通过'
  };
}

// ─────────────────────────────────────────────────────────
// 各检查子函数
// ─────────────────────────────────────────────────────────

function checkAbsoluteForbidden(message: string): { blocked: boolean; type: string; reason: string } {
  const text = message.toLowerCase();

  // 检查自伤/自杀
  for (const keyword of SAFETY_RULES.absoluteForbidden.suicide) {
    if (text.includes(keyword)) {
      return {
        blocked: true,
        type: 'suicide',
        reason: `检测到自伤/自杀意念关键词：「${keyword}」`
      };
    }
  }

  // 检查精神病性症状
  for (const keyword of SAFETY_RULES.absoluteForbidden.psychosis) {
    if (text.includes(keyword)) {
      return {
        blocked: true,
        type: 'psychosis',
        reason: `检测到可能的精神病性症状关键词：「${keyword}」，需要立即专业干预`
      };
    }
  }

  // 检查伤害他人
  for (const keyword of SAFETY_RULES.absoluteForbidden.harmOthers) {
    if (text.includes(keyword)) {
      return {
        blocked: true,
        type: 'harmOthers',
        reason: `检测到伤害他人意向关键词：「${keyword}」`
      };
    }
  }

  // 检查其他高危
  for (const keyword of SAFETY_RULES.absoluteForbidden.severe) {
    if (text.includes(keyword)) {
      return {
        blocked: true,
        type: 'severe',
        reason: `检测到高危表达：「${keyword}」`
      };
    }
  }

  return { blocked: false, type: '', reason: '' };
}

function checkConditionalWarning(
  message: string,
  rules: typeof SAFETY_RULES.conditionalWarning
): { warning: boolean; category: string; keyword: string; response: string; reason: string } | { warning: false } {
  // 检查抑郁症状
  for (const keyword of rules.depression.keywords) {
    if (message.includes(keyword)) {
      return {
        warning: true,
        category: 'depression',
        keyword: keyword,
        response: rules.depression.responseTemplate(keyword),
        reason: `检测到可能的抑郁症状关键词：「${keyword}」`
      };
    }
  }

  // 检查焦虑症状
  for (const keyword of rules.anxiety.keywords) {
    if (message.includes(keyword)) {
      return {
        warning: true,
        category: 'anxiety',
        keyword: keyword,
        response: rules.anxiety.responseTemplate(keyword),
        reason: `检测到可能的焦虑症状关键词：「${keyword}」`
      };
    }
  }

  // 检查急性应激
  for (const keyword of rules.acuteStress.keywords) {
    if (message.includes(keyword)) {
      return {
        warning: true,
        category: 'acuteStress',
        keyword: keyword,
        response: rules.acuteStress.responseTemplate(),
        reason: `检测到可能的急性应激反应关键词：「${keyword}」`
      };
    }
  }

  return { warning: false };
}

function checkUrgentCare(
  message: string,
  keywords: string[]
): { needSuggestion: boolean; keyword: string; reason: string } | { needSuggestion: false } {
  for (const keyword of keywords) {
    if (message.includes(keyword)) {
      return {
        needSuggestion: true,
        keyword: keyword,
        reason: `检测到建议专业帮助的关键词：「${keyword}」`
      };
    }
  }
  return { needSuggestion: false };
}

function generateCrisisResponse(type: string, resources: typeof SAFETY_RULES.crisisResources): string {
  const hotlinesList = resources.hotlines
    .map(h => `- ${h.name}：${h.number}（${h.hours}）`)
    .join('\n');

  return `🚨 **我非常关心你的安全**

我注意到你刚才的话让我很担心。请你先停下来，听我说几句话：

**你的生命非常重要，这个世界需要你。**

如果你现在有伤害自己的念头，请立即：

📞 **拨打24小时心理危机干预热线**：
${hotlinesList}

🏥 **或者前往最近的医院急诊科**

🤝 **联系你信任的人**：家人、朋友、辅导员、老师

我虽然是一个AI，但我真心希望你平安。请给自己一个机会，去寻求帮助，好吗？

这里有一些人愿意倾听和支持你 ❤️`;
}

function generateProfessionalHelpResponse(): string {
  return `💙 **小提示**：基于你提到的内容，我想真诚地建议你考虑寻求专业帮助：

🏥 **推荐渠道**：
• 学校心理咨询中心：免费且方便，很多同学都在那里获得过帮助
• 当地精神卫生中心/心理医院：如果有更严重的症状
• 全国心理援助热线：400-161-9995（24小时）

**这不是说你有'问题'，而是就像感冒要看医生一样，情绪上的困扰也需要专业的支持。** 寻求帮助是勇敢的表现，不是软弱 💪

当然，我也会继续在这里陪着你。你想聊聊怎么迈出这一步吗？`;
}

function logSecurityEvent(level: string, message: string, details: any): void {
  const event = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    details: details
  };

  console.log(`[第三层-安全检查-${level}]`, JSON.stringify(event, null, 2));
}
