/**
 * 心晴助手 - 主动服务模块
 * 
 * 功能：
 * - 定时关怀推送（早晚问候、学习提醒）
 * - 基于用户情绪状态的个性化建议
 * - 季节性心理健康提示
 * - 危机预警主动介入
 */

import { EmotionAnalyzer, EmotionAnalysisResult, createEmotionAnalyzer } from '../emotion/emotion-analyzer.js';
import { createMemoryAndKnowledgeService } from '../integration/memory-knowledge-service.js';

export interface CareMessage {
  id: string;
  type: 'morning' | 'evening' | 'emotion_check' | 'crisis_alert' | 'seasonal' | 'study_reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  content: string;
  timestamp: string;
  userId: string;
  triggeredBy: string;
}

export interface PushRule {
  id: string;
  name: string;
  type: CareMessage['type'];
  schedule: {
    hour: number;
    minute: number;
    days?: number[]; // 0=周日, 1=周一, ..., 6=周六
  };
  condition?: (userId: string) => Promise<boolean>;
  messageTemplate: (context: any) => string;
  enabled: boolean;
}

export interface UserPushSettings {
  userId: string;
  morningGreeting: boolean;
  eveningCare: boolean;
  emotionCheck: boolean;
  studyReminder: boolean;
  quietHoursStart: number; // 安静时段开始（小时）
  quietHoursEnd: number;   // 安静时段结束（小时）
  lastPushTime: string | null;
  pushCountToday: number;
  maxPushPerDay: number;
}

export class ProactiveService {
  private emotionAnalyzer: EmotionAnalyzer;
  private memoryService: ReturnType<typeof createMemoryAndKnowledgeService>;
  private userSettings: Map<string, UserPushSettings> = new Map();
  private pushRules: PushRule[];
  private pushHistory: CareMessage[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.emotionAnalyzer = createEmotionAnalyzer();
    this.memoryService = createMemoryAndKnowledgeService();
    
    this.pushRules = this.initializePushRules();
  }

  /**
   * 启动定时推送服务
   */
  start(checkIntervalMinutes: number = 5): void {
    console.log(`[主动服务] 🚀 启动定时推送服务 (检查间隔: ${checkIntervalMinutes}分钟)`);
    
    this.intervalId = setInterval(async () => {
      await this.checkAndExecutePushes();
    }, checkIntervalMinutes * 60 * 1000);

    // 立即执行一次检查
    this.checkAndExecutePushes();
  }

  /**
   * 停止定时推送服务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[主动服务] ⏹️ 定时推送服务已停止');
    }
  }

  /**
   * 初始化推送规则
   */
  private initializePushRules(): PushRule[] {
    return [
      {
        id: 'morning-001',
        name: '早安问候',
        type: 'morning',
        schedule: { hour: 8, minute: 0 },
        messageTemplate: (ctx) => this.generateMorningMessage(ctx),
        enabled: true
      },
      {
        id: 'evening-001',
        name: '晚安关怀',
        type: 'evening',
        schedule: { hour: 22, minute: 30 },
        messageTemplate: (ctx) => this.generateEveningMessage(ctx),
        enabled: true
      },
      {
        id: 'emotion-001',
        name: '情绪检查',
        type: 'emotion_check',
        schedule: { hour: 14, minute: 0 },
        condition: async (userId) => {
          const trend = this.emotionAnalyzer.getEmotionTrend(userId, 3);
          return trend.averageScore < -2 || trend.crisisCount > 0;
        },
        messageTemplate: (ctx) => this.generateEmotionCheckMessage(ctx),
        enabled: true
      },
      {
        id: 'study-001',
        name: '学习提醒',
        type: 'study_reminder',
        schedule: { hour: 21, minute: 0 },
        days: [0, 1, 2, 3, 4], // 周日到周四
        condition: async (userId) => {
          const settings = this.getUserSettings(userId);
          return settings.studyReminder;
        },
        messageTemplate: (ctx) => this.generateStudyReminder(ctx),
        enabled: true
      }
    ];
  }

  /**
   * 检查并执行推送
   */
  private async checkAndExecutePushes(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay();

    for (const rule of this.pushRules) {
      if (!rule.enabled) continue;

      // 检查时间是否匹配（±5分钟容差）
      const timeMatch = Math.abs(currentHour - rule.schedule.hour) === 0 && 
                        Math.abs(currentMinute - rule.schedule.minute) <= 5;
      
      // 检查星期几（如果指定了）
      const dayMatch = !rule.schedule.days || rule.schedule.days.includes(currentDay);

      if (timeMatch && dayMatch) {
        // 获取所有活跃用户
        const activeUsers = this.getActiveUsers();

        for (const userId of activeUsers) {
          try {
            // 检查条件（如果有）
            if (rule.condition) {
              const shouldPush = await rule.condition(userId);
              if (!shouldPush) continue;
            }

            // 检查用户设置
            const settings = this.getUserSettings(userId);
            if (!this.shouldPushToUser(settings, rule.type, now)) continue;

            // 构建上下文并生成消息
            const context = await this.buildPushContext(userId, rule.type);
            const content = rule.messageTemplate(context);

            // 记录推送
            const message: CareMessage = {
              id: `push-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: rule.type,
              priority: this.determinePriority(rule.type, context),
              content,
              timestamp: now.toISOString(),
              userId,
              triggeredBy: rule.id
            };

            this.pushHistory.push(message);
            this.updateUserPushStats(userId);

            console.log(`[主动服务] 📨 推送消息给 ${userId}:`);
            console.log(`   类型: ${rule.type}`);
            console.log(`   内容: ${content.slice(0, 50)}...`);

          } catch (error) {
            console.error(`[主动服务] ❌ 推送失败 (${rule.id}):`, error);
          }
        }
      }
    }
  }

  /**
   * 获取待发送的推送消息
   */
  getPendingPushes(userId: string): CareMessage[] {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 最近30分钟
    return this.pushHistory.filter(msg => 
      msg.userId === userId && 
      new Date(msg.timestamp) >= recentTime &&
      !msg.delivered
    );
  }

  /**
   * 标记消息已送达
   */
  markAsDelivered(messageId: string): void {
    const message = this.pushHistory.find(m => m.id === messageId);
    if (message) {
      (message as any).delivered = true;
      (message as any).deliveredAt = new Date().toISOString();
    }
  }

  /**
   * 手动触发危机干预推送
   */
  async triggerCrisisAlert(userId: string, analysis: EmotionAnalysisResult): Promise<CareMessage> {
    const context = await this.buildPushContext(userId, 'crisis_alert');
    context.analysis = analysis;

    const message: CareMessage = {
      id: `crisis-${Date.now()}`,
      type: 'crisis_alert',
      priority: 'urgent',
      content: this.generateCrisisAlert(context),
      timestamp: new Date().toISOString(),
      userId,
      triggeredBy: 'emotion_analysis'
    };

    this.pushHistory.push(message);
    
    console.log(`[主动服务] 🚨 触发危机预警: ${userId}`);
    
    return message;
  }

  /**
   * 更新用户推送设置
   */
  updateUserSettings(userId: string, settings: Partial<UserPushSettings>): void {
    const current = this.getUserSettings(userId);
    Object.assign(current, settings);
    this.userSettings.set(userId, current);
  }

  /**
   * 获取用户设置
   */
  getUserSettings(userId: string): UserPushSettings {
    if (!this.userSettings.has(userId)) {
      this.userSettings.set(userId, {
        userId,
        morningGreeting: true,
        eveningCare: true,
        emotionCheck: true,
        studyReminder: true,
        quietHoursStart: 23,
        quietHoursEnd: 8,
        lastPushTime: null,
        pushCountToday: 0,
        maxPushPerDay: 5
      });
    }
    return this.userSettings.get(userId)!;
  }

  /**
   * 获取推送历史
   */
  getPushHistory(userId?: string, limit: number = 50): CareMessage[] {
    let history = this.pushHistory;
    
    if (userId) {
      history = history.filter(m => m.userId === userId);
    }

    return history.slice(-limit);
  }

  // ==================== 消息模板 ====================

  private generateMorningMessage(ctx: any): string {
    const greetings = [
      '早上好！新的一天开始了，希望今天你能拥有好心情 ☀️',
      '早安！记得吃早餐哦，美好的一天从照顾好自己开始 🌅',
      '早上好呀！今天有什么计划吗？无论做什么，都要记得给自己留点休息时间 😊'
    ];

    const baseGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    // 根据用户状态添加个性化内容
    let personalized = '';
    if (ctx.yesterdayEmotion && ctx.yesterdayEmotion < -3) {
      personalized += '\n\n注意到你昨天情绪不太好，今天要多关注自己的感受哦。如果需要，随时找我聊聊 💙';
    } else if (ctx.isExamSeason) {
      personalized += '\n\n最近是考试季，复习的同时别忘了适当放松。深呼吸几次，你可以的！💪';
    } else if (ctx.recentStressors?.includes('学业压力')) {
      personalized += '\n\n学习很重要，但你的身心健康更重要。今天试着给自己安排一段完全放松的时间吧 📚→🧘';
    }

    return baseGreeting + personalized;
  }

  private generateEveningMessage(ctx: any): string {
    const messages = [
      '晚上好！今天辛苦啦，不管今天发生了什么，你都已经做得很好了 🌙',
      '晚安前的时间属于你自己，放下手机，让大脑休息一下吧 ✨',
      '一天又要结束了，回想一下今天有没有什么让你感到温暖或开心的小事？🌟'
    ];

    const baseMessage = messages[Math.floor(Math.random() * messages.length)];

    let personalized = '';
    if (ctx.todayEmotion && ctx.todayEmotion < -4) {
      personalized += '\n\n今天似乎不太容易，早点休息吧，明天会是新的开始。如果睡不着，可以试试我之前教你的呼吸放松法 🫂';
    } else if (ctx.hasSleepIssue) {
      personalized += '\n\n睡前试试：放下手机 → 调暗灯光 → 做几次深呼吸 → 听点轻音乐。祝你今晚有个好梦 💤';
    }

    return baseMessage + personalized;
  }

  private generateEmotionCheckMessage(ctx: any): string {
    return `嘿，想你了！😊\n\n` +
           `这几天感觉怎么样？如果有什么心事或者压力，随时都可以跟我说说。\n\n` +
           `记住：寻求帮助不是软弱的表现，而是勇敢的选择。我在这里陪着你 💙`;
  }

  private generateStudyReminder(ctx: any): string {
    const reminders = [
      `学习时间到！不过也要注意劳逸结合哦 📖\n\n已经学了一段时间了吧？站起来活动一下，喝口水，眺望远处放松眼睛。`,
      `提醒你：连续学习超过2小时了，该休息一下啦 ☕\n\n短暂的休息反而能提高效率，去走走吧，10分钟后再回来继续！`
    ];

    return reminders[Math.floor(Math.random() * reminders.length)];
  }

  private generateCrisisAlert(ctx: any): string {
    const analysis: EmotionAnalysisResult = ctx.analysis;
    
    let message = '⚠️ **重要提醒**\n\n';
    message += '我注意到你最近可能正在经历一些困难的时刻。请知道：\n\n';
    message += '- 你的感受是被理解和重视的\n';
    message += '- 你并不孤单，有人愿意帮助你\n';
    message += '- 这个困难是暂时的，情况会好转的\n\n';
    
    if (analysis.primaryEmotion === '自杀意念') {
      message += '**如果你现在有伤害自己的想法，请立即：**\n\n';
      message += '1. 📞 拨打24小时心理援助热线：400-161-9995\n';
      message += '2. 👥 联系你信任的人（家人、朋友、老师）\n';
      message += '3. 🏥 前往最近的医院急诊科\n';
      message += '4. 💬 或者现在就和我聊聊，我会一直在这里陪你\n\n';
      message += '你很重要，这个世界需要你 🫂';
    } else {
      message += '建议你现在：\n';
      message += '1. 找一个安全、舒适的地方坐下\n';
      message += '2. 做3次深长的呼吸\n';
      message += '3. 如果愿意，可以和我详细说说你的感受\n';
      message += '4. 或者联系学校的心理咨询中心\n\n';
      message += '我会一直在这里陪伴你 💙';
    }

    return message;
  }

  // ==================== 辅助方法 ====================

  private getActiveUsers(): string[] {
    // 返回所有有记录的用户ID
    return Array.from(this.userSettings.keys());
  }

  private shouldPushToUser(settings: UserPushSettings, type: CareMessage['type'], now: Date): boolean {
    // 检查安静时段
    const currentHour = now.getHours();
    if (currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd) {
      if (type !== 'crisis_alert') return false; // 危机消息不受安静时段限制
    }

    // 检查每日推送上限
    if (settings.pushCountToday >= settings.maxPushPerDay) {
      return false;
    }

    // 检查类型开关
    switch (type) {
      case 'morning': return settings.morningGreeting;
      case 'evening': return settings.eveningCare;
      case 'emotion_check': return settings.emotionCheck;
      case 'study_reminder': return settings.studyReminder;
      default: return true;
    }
  }

  private determinePriority(type: CareMessage['type'], context: any): CareMessage['priority'] {
    if (type === 'crisis_alert') return 'urgent';
    if (type === 'emotion_check' && context.analysis?.crisisLevel === 'urgent') return 'urgent';
    if (type === 'emotion_check') return 'high';
    if (type === 'morning' || type === 'evening') return 'medium';
    return 'low';
  }

  private async buildPushContext(userId: string, type: CareMessage['type']): Promise<any> {
    const context: any = { userId, type };
    
    try {
      // 获取情绪趋势
      const trend = this.emotionAnalyzer.getEmotionTrend(userId, 7);
      context.yesterdayEmotion = trend.dataPoints.length > 1 ? 
        trend.dataPoints[trend.dataPoints.length - 2].score : undefined;
      context.todayEmotion = trend.dataPoints.length > 0 ?
        trend.dataPoints[trend.dataPoints.length - 1].score : undefined;
      context.recentStressors = trend.dominantEmotions;

      // 判断是否考试季
      const month = new Date().getMonth() + 1;
      context.isExamSeason = [6, 12, 1].includes(month);

      // 检查睡眠问题
      context.hasSleepIssue = trend.dominantEmotions.some(e => e.includes('失眠') || e.includes('睡眠'));

    } catch (error) {
      console.error('[主动服务] 构建上下文失败:', error);
    }

    return context;
  }

  private updateUserPushStats(userId: string): void {
    const settings = this.getUserSettings(userId);
    settings.lastPushTime = new Date().toISOString();
    settings.pushCountToday++;
    this.userSettings.set(userId, settings);
  }
}

/**
 * 创建主动服务实例
 */
export function createProactiveService(): ProactiveService {
  return new ProactiveService();
}