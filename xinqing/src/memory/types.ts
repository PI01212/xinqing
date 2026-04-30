/**
 * 心晴助手 - 用户数据结构定义
 *
 * 定义长期记忆系统中使用的所有数据结构
 * 遵循"人可读（Markdown）+ 程序可解析（JSON）"的双文件原则
 */

/**
 * =====================================================
 * 用户画像（profile.md / profile.json）
 * =====================================================
 */
export interface UserProfile {
  userId: string;
  createdAt: string;
  updatedAt: string;

  // 基本信息
  basic: {
    age?: string;           // 如"20岁"
    gender?: string;        // 如"女"
    grade?: string;         // 如"大三"
    major?: string;         // 如"计算机科学"
    school?: string;        // 如"某某大学"
  };

  // 心理状态
  psychology: {
    commonStressors: string[];  // 常见压力源
    emotionalTrend: string;    // 近期情绪趋势
    lastEmotion: string;       // 最近情绪
    lastEmotionTime: string;   // 最近情绪时间
    mentalState: '稳定' | '波动' | '低落' | '焦虑';
  };

  // 关注领域
  concerns: string[];

  // 行为阶段（信任等级）
  behaviorStage: '新用户' | '探索期' | '活跃期' | '稳定期' | '休眠期';
  trustLevel: number;  // 1-5

  // 交互统计
  stats: {
    totalConversations: number;
    totalMessages: number;
    lastInteractionTime: string;
    consecutiveDays: number;
  };

  // 偏好设置
  preferences: {
    notificationTime?: string;  // 偏好推送时间
    communicationStyle: '正式' | '轻松' | '温暖';
    responseLength: '简短' | '中等' | '详细';
  };
}

/**
 * =====================================================
 * 情绪记录（emotions/YYYY-MM.json）
 * =====================================================
 */
export interface EmotionRecord {
  id: string;
  userId: string;
  timestamp: string;

  // 核心情绪数据
  emotion: string;         // 情绪类型：焦虑、悲伤、愤怒、恐惧、羞耻、内疚、开心、平静等
  intensity: number;       // 强度 1-10
  trigger?: string;        // 触发事件
  context?: string;       // 背景描述

  // 伴随症状
  physicalSymptoms?: string[];  // 身体症状：失眠、心跳加速、头痛等
  duration?: string;      // 持续时间

  // 元数据
  source: 'llm' | 'regex' | 'manual';  // 数据来源
  intent?: string;       // 对应的意图类型
}

/**
 * =====================================================
 * 压力记录（stress/YYYY-MM.json）
 * =====================================================
 */
export interface StressRecord {
  id: string;
  userId: string;
  timestamp: string;

  // 压力数据
  stressType: '学业压力' | '就业压力' | '人际压力' | '经济压力' | '家庭压力' | '感情压力' | '自我期望压力';
  source: string;         // 具体压力来源
  intensity: number;       // 强度 1-10

  // 影响评估
  impactArea: string[];   // 影响领域：睡眠、学习、社交等
  symptoms?: string[];    // 身心症状

  // 应对方式
  currentCoping?: string;  // 当前应对方式
  supportSystem?: string;  // 社会支持状况

  // 元数据
  source: 'llm' | 'regex' | 'manual';
  intent?: string;
}

/**
 * =====================================================
 * 目标记录（goals/goals.json）
 * =====================================================
 */
export interface GoalRecord {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;

  category: '情绪管理' | '压力缓解' | '自我成长' | '人际关系' | '学业职业';
  title: string;
  description: string;
  deadline?: string;

  // 进度跟踪
  status: '进行中' | '已完成' | '已放弃' | '暂停';
  progress: number;  // 0-100

  // 里程碑
  milestones?: {
    id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
  }[];

  // 反思
  reflection?: string;
}

/**
 * =====================================================
 * 核心记忆（MEMORY.md）
 * =====================================================
 */
export interface MemoryEntry {
  id: string;
  userId: string;
  timestamp: string;

  category: '里程碑' | '重要事件' | '深层动力' | '历史教训' | '用户偏好' | '特殊需求';
  title: string;
  content: string;

  importance: '高' | '中' | '低';
  tags: string[];

  // 来源信息
  source: {
    type: 'ai_extracted' | 'user_told' | 'milestone';
    reference?: string;  // 原始引用
  };
}

/**
 * =====================================================
 * 交互历史（interactions/YYYY-MM.json）
 * =====================================================
 */
export interface InteractionRecord {
  id: string;
  userId: string;
  timestamp: string;

  // 对话摘要
  summary: string;         // AI生成的对话摘要
  topic?: string;         // 主要话题
  sentiment: '正面' | '中性' | '负面';

  // 意图统计
  intents: {
    intent: string;
    subIntent: string;
    count: number;
  }[];

  // 情感变化
  emotionBefore?: string;
  emotionAfter?: string;

  // 关键提取
  keyExtractions: {
    type: string;
    data: Record<string, any>;
  }[];
}

/**
 * =====================================================
 * 用户会话数据（运行时使用）
 * =====================================================
 */
export interface UserSessionData {
  userId: string;
  profile: UserProfile;
  recentEmotions: EmotionRecord[];      // 最近N条情绪记录
  recentStress: StressRecord[];         // 最近N条压力记录
  activeGoals: GoalRecord[];            // 进行中的目标
  recentInteractions: InteractionRecord[];  // 最近N次交互
  memoryEntries: MemoryEntry[];        // 核心记忆

  // 统计摘要
  stats: {
    weeklyEmotionTrend: number[];       // 本周每日情绪评分
    monthlyStressDistribution: Record<string, number>;  // 本月压力类型分布
    goalCompletionRate: number;         // 目标完成率
  };
}

/**
 * =====================================================
 * 辅助函数：创建默认数据
 * =====================================================
 */

/**
 * 创建默认用户画像
 */
export function createDefaultProfile(userId: string): UserProfile {
  const now = new Date().toISOString();
  return {
    userId,
    createdAt: now,
    updatedAt: now,
    basic: {},
    psychology: {
      commonStressors: [],
      emotionalTrend: '数据不足',
      lastEmotion: '',
      lastEmotionTime: '',
      mentalState: '稳定'
    },
    concerns: [],
    behaviorStage: '新用户',
    trustLevel: 1,
    stats: {
      totalConversations: 0,
      totalMessages: 0,
      lastInteractionTime: now,
      consecutiveDays: 0
    },
    preferences: {
      communicationStyle: '温暖',
      responseLength: '中等'
    }
  };
}

/**
 * 创建默认目标
 */
export function createDefaultGoal(userId: string, category: GoalRecord['category'], title: string): GoalRecord {
  const now = new Date().toISOString();
  return {
    id: `goal_${Date.now()}`,
    userId,
    createdAt: now,
    updatedAt: now,
    category,
    title,
    description: '',
    status: '进行中',
    progress: 0,
    milestones: []
  };
}
