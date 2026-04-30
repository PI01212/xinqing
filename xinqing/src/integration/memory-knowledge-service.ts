/**
 * 心晴助手 - 记忆与知识库集成模块（完整版）
 *
 * 功能：
 * - 在消息处理流程中集成长期记忆和知识库
 * - 提供增强的上下文给AI
 * - **记录所有交互数据**（包括普通日常对话）
 */

import { createMemoryService, MemoryService } from '../memory/memory-service.js';
import { createKnowledgeBase, KnowledgeBase } from '../knowledge/knowledge-base.js';
import { buildEnhancedPrompt, ChatContext } from '../prompt/enhanced-prompt.js';
import { IntentResult } from '../layer2-intent-prompt.js';

/**
 * 记忆与知识库服务
 */
export class MemoryAndKnowledgeService {
  private memoryService: MemoryService;
  private knowledgeBase: KnowledgeBase;

  constructor() {
    this.memoryService = createMemoryService();
    this.knowledgeBase = createKnowledgeBase();
  }

  /**
   * 构建增强的对话上下文
   */
  async buildContext(
    userId: string,
    userMessage: string,
    intentResult?: IntentResult
  ): Promise<{
    enhancedPrompt: string;
    context: ChatContext;
  }> {
    try {
      console.log('\n═══ [构建上下文开始] ═══');
      console.log(`[上下文] 用户ID: ${userId}`);
      console.log(`[上下文] 用户消息: ${userMessage}`);

      // 1. 加载用户会话数据（包含画像、近期记录等）
      const sessionData = await this.memoryService.loadUserSessionData(userId);
      console.log(`[上下文] ✓ 用户画像已加载`);

      // 2. 检索相关知识
      const retrieval = await this.knowledgeBase.retrieve(userMessage, 3);
      if (retrieval.entries.length > 0) {
        console.log(`[上下文] ✓ 知识库检索成功，找到${retrieval.entries.length}条`);
        retrieval.entries.forEach((entry, i) => {
          console.log(`[上下文]   ${i+1}. ${entry.title} (${entry.category}) - 相关性:${entry.relevance}`);
        });
      } else {
        console.log(`[上下文] ⚠️ 知识库未匹配到内容`);
      }

      // 3. 获取核心记忆
      const memoryContent = await this.memoryService.getMemoryEntries(userId, 10);
      if (memoryContent && memoryContent.length > 0) {
        console.log(`[上下文] ✓ 核心记忆已加载 (${memoryContent.length}字符)`);
      } else {
        console.log(`[上下文] ⚠️ 暂无核心记忆`);
      }

      // 4. 构建上下文对象
      const context: ChatContext = {
        userProfile: {
          userId: sessionData.userId,
          basic: sessionData.profile.basic,
          psychology: {
            lastEmotion: sessionData.profile.psychology.lastEmotion,
            emotionalTrend: sessionData.profile.psychology.emotionalTrend,
            commonStressors: sessionData.profile.psychology.commonStressors,
            mentalState: sessionData.profile.psychology.mentalState,
          },
          behaviorStage: sessionData.profile.behaviorStage,
          trustLevel: sessionData.profile.trustLevel,
          recentEmotions: sessionData.recentEmotions.map(e => ({
            emotion: e.emotion,
            intensity: e.intensity,
            timestamp: e.timestamp,
          })),
          recentStress: sessionData.recentStress.map(s => ({
            stressType: s.stressType,
            intensity: s.intensity,
            timestamp: s.timestamp,
          })),
          activeGoals: sessionData.activeGoals.map(g => ({
            title: g.title,
            progress: g.progress,
            category: g.category,
          })),
        },
        memoryContext: memoryContent || undefined,
        knowledgeContext: retrieval.context || undefined,
        intentInfo: intentResult ? {
          intent: intentResult.intent,
          subIntent: intentResult.subIntent,
          confidence: intentResult.confidence,
          extractedData: intentResult.extractedData,
        } : undefined,
      };

      const enhancedPrompt = buildEnhancedPrompt(userMessage, context);
      return { enhancedPrompt, context };
    } catch (error) {
      console.error('[记忆] 构建上下文失败:', error);
      return {
        enhancedPrompt: `你是「心晴」，大学生心理健康陪伴助手。\n\n用户消息：「${userMessage}」\n\n请回复用户。`,
        context: { userProfile: { userId } }
      };
    }
  }

  /**
   * 从消息中提取并保存用户基本信息
   */
  async extractAndSaveUserInfo(userId: string, message: string): Promise<void> {
    try {
      const profile = await this.memoryService.loadProfile(userId);
      let updated = false;

      // 提取姓名
      const namePatterns = [/我叫(\S{1,4})/, /我是(\S{1,4})[，,]/, /名字叫(\S{1,4})/];
      for (const pattern of namePatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          if (!profile.basic.age && !profile.basic.grade) {
            profile.basic.name = match[1];
            updated = true;
            console.log(`[记忆] 👤 记录用户姓名: ${match[1]}`);
          }
          break;
        }
      }

      // 提取年龄
      const ageMatch = message.match(/(\d{1,2})\s*岁/);
      if (ageMatch && ageMatch[1]) {
        profile.basic.age = ageMatch[1] + '岁';
        updated = true;
        console.log(`[记忆] 🎂 记录用户年龄: ${ageMatch[1]}岁`);
      }

      // 提取年级
      const gradePatterns = [/大一|大二|大三|大四|研一|研二|研三|博士/];
      for (const pattern of gradePatterns) {
        const gradeMatch = message.match(pattern);
        if (gradeMatch) {
          profile.basic.grade = gradeMatch[0];
          updated = true;
          console.log(`[记忆] 📚 记录用户年级: ${gradeMatch[0]}`);
          break;
        }
      }

      // 提取专业
      const majorList = [
        '计算机科学', '软件工程', '人工智能', '电子信息', '数学', '物理',
        '化学', '生物', '医学', '法学', '经济学', '管理学', '文学',
        '历史学', '哲学', '心理学', '教育学', '新闻传播', '艺术设计',
        '音乐', '体育', '外语', '会计', '金融', '市场营销', '人力资源',
        '土木工程', '机械工程', '电气工程', '自动化', '材料科学'
      ];
      for (const major of majorList) {
        if (message.includes(major)) {
          profile.basic.major = major;
          updated = true;
          console.log(`[记忆] 🎓 记录用户专业: ${major}`);
          break;
        }
      }

      // 提取学校
      const schoolMatch = message.match(/(\S{2,10}(大学|学院|学校))/);
      if (schoolMatch && schoolMatch[1]) {
        profile.basic.school = schoolMatch[1];
        updated = true;
        console.log(`[记忆] 🏫 记录用户学校: ${schoolMatch[1]}`);
      }

      // 更新行为阶段
      if (updated && profile.behaviorStage === '新用户') {
        profile.behaviorStage = '探索期';
        profile.trustLevel = Math.min(profile.trustLevel + 1, 5);
        console.log(`[记忆] 🎯 用户行为阶段升级为: 探索期`);
      }

      if (updated) {
        await this.memoryService.saveProfile(profile);

        await this.memoryService.saveMemoryEntry({
          userId,
          timestamp: new Date().toISOString(),
          category: '用户偏好',
          title: '👤 用户自我介绍',
          content: `用户介绍了自己的基本信息：${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`,
          importance: '高',
          tags: ['自我介绍', '用户信息'],
          source: { type: 'ai_extracted', reference: message.slice(0, 50) }
        });
        console.log('[记忆] ✅ 用户画像已更新');
      }
    } catch (error) {
      console.error('[记忆] 提取用户信息失败:', error);
    }
  }

  /**
   * 记录情绪数据（宽松版）
   */
  async recordEmotion(
    userId: string,
    intentResult: IntentResult,
    userMessage: string
  ): Promise<void> {
    try {
      const { extractedData, subIntent } = intentResult;

      // 宽松条件：只要提取到情绪词就记录
      let emotionToRecord = extractedData?.emotion;

      // 如果没有从extractedData获取到，尝试从消息中简单检测
      if (!emotionToRecord) {
        const emotionWords = ['开心', '高兴', '快乐', '难过', '悲伤', '伤心', '生气',
                           '愤怒', '焦虑', '紧张', '害怕', '恐惧', '失望', '沮丧',
                           '郁闷', '烦躁', '疲惫', '兴奋', '平静', '满足', '幸福'];
        for (const word of emotionWords) {
          if (userMessage.includes(word)) {
            emotionToRecord = word;
            break;
          }
        }
      }

      if (emotionToRecord) {
        await this.memoryService.saveEmotionRecord({
          userId,
          timestamp: new Date().toISOString(),
          emotion: emotionToRecord,
          intensity: extractedData?.intensity || 5,
          trigger: extractedData?.trigger || userMessage.slice(0, 50),
          context: extractedData?.context || userMessage.slice(0, 100),
          physicalSymptoms: extractedData?.physicalSymptoms,
          duration: extractedData?.duration,
          source: 'llm',
          intent: subIntent || 'chat_chat',
        });
        console.log(`[记忆] 📝 记录情绪: ${emotionToRecord} (${extractedData?.intensity || 5}/10)`);
      }
    } catch (error) {
      console.error('[记忆] 记录情绪失败:', error);
    }
  }

  /**
   * 记录压力数据（宽松版）
   */
  async recordStress(
    userId: string,
    intentResult: IntentResult,
    userMessage: string
  ): Promise<void> {
    try {
      const { extractedData, subIntent } = intentResult;

      // 宽松条件：只要提到压力相关词汇就记录
      let stressTypeToRecord = extractedData?.stressType;
      let stressSourceToRecord = extractedData?.source;

      // 如果没有从extractedData获取到，尝试从消息中简单检测
      if (!stressTypeToRecord && !stressSourceToRecord) {
        const stressWords = [
          { word: '考试', type: '学业压力' },
          { word: '考研', type: '学业压力' },
          { word: '学习', type: '学业压力' },
          { word: '作业', type: '学业压力' },
          { word: '室友', type: '人际压力' },
          { word: '同学', type: '人际压力' },
          { word: '朋友', type: '人际压力' },
          { word: '男朋友', type: '感情压力' },
          { word: '女朋友', type: '感情压力' },
          { word: '分手', type: '感情压力' },
          { word: '工作', type: '就业压力' },
          { word: '找工作', type: '就业压力' },
          { word: '面试', type: '就业压力' },
          { word: '钱', type: '经济压力' },
          { word: '没钱', type: '经济压力' },
          { word: '家庭', type: '家庭压力' },
          { word: '父母', type: '家庭压力' },
          { word: '压力', type: '其他压力' },
          { word: '焦虑', type: '其他压力' },
          { word: '烦恼', type: '其他压力' },
          { word: '困扰', type: '其他压力' },
        ];

        for (const item of stressWords) {
          if (userMessage.includes(item.word)) {
            stressTypeToRecord = item.type;
            stressSourceToRecord = item.word;
            break;
          }
        }
      }

      if (stressTypeToRecord || stressSourceToRecord) {
        await this.memoryService.saveStressRecord({
          userId,
          timestamp: new Date().toISOString(),
          stressType: stressTypeToRecord || '其他压力',
          source: stressSourceToRecord || userMessage.slice(0, 30),
          intensity: extractedData?.intensity || 5,
          impactArea: extractedData?.impactArea,
          symptoms: extractedData?.symptoms,
          currentCoping: extractedData?.copingCurrent,
          supportSystem: extractedData?.supportSystem,
          source: 'llm',
          intent: subIntent || 'chat_chat',
        });
        console.log(`[记忆] 📝 记录压力: ${stressTypeToRecord || '其他压力'} (${stressSourceToRecord})`);
      }
    } catch (error) {
      console.error('[记忆] 记录压力失败:', error);
    }
  }

  /**
   * 为每次对话生成记忆（核心功能）
   */
  async generateDailyMemory(
    userId: string,
    intentResult: IntentResult,
    userMessage: string
  ): Promise<void> {
    try {
      const { subIntent, intent, confidence, crisisLevel } = intentResult;

      // 确定记忆类别和标题
      let category: string;
      let title: string;
      let importance: '高' | '中' | '低';

      switch (true) {
        case crisisLevel === 'high':
          category = '重要事件';
          title = '⚠️ 危机信号';
          importance = '高';
          break;

        case crisisLevel === 'medium':
          category = '重要事件';
          title = '⚡ 需要关注';
          importance = '高';
          break;

        case subIntent.includes('emotion') || subIntent.includes('counsel'):
          category = '重要事件';
          title = `💬 ${subIntent.includes('emotion') ? '情绪分享' : '寻求建议'}`;
          importance = '中';
          break;

        case subIntent.includes('stress'):
          category = '重要事件';
          title = '😰 压力倾诉';
          importance = '中';
          break;

        default:
          // 普通对话也记录
          category = '日常互动';
          title = `� 日常对话`;
          importance = '低';
      }

      await this.memoryService.saveMemoryEntry({
        userId,
        timestamp: new Date().toISOString(),
        category: category as any,
        title,
        content: `[${subIntent}] ${userMessage}`,
        importance,
        tags: [subIntent, intent],
        source: {
          type: 'ai_extracted',
          reference: userMessage.slice(0, 80)
        }
      });

      console.log(`[记忆] 💾 记录本次对话: ${title} (${category})`);
    } catch (error) {
      console.error('[记忆] 生成记忆失败:', error);
    }
  }

  /**
   * 获取危机热线信息
   */
  async getCrisisHotlines(): Promise<any> {
    return this.knowledgeBase.getCrisisHotlines();
  }

  /**
   * 获取校园心理服务信息
   */
  async getCampusServices(): Promise<any> {
    return this.knowledgeBase.getCampusServices();
  }

  /**
   * 完整处理：记录本次交互的所有数据
   */
  async processAndRecord(
    userId: string,
    intentResult: IntentResult,
    userMessage: string
  ): Promise<void> {
    try {
      console.log('\n═══ [记忆系统开始处理] ═══');

      // 1. 提取并保存用户基本信息
      await this.extractAndSaveUserInfo(userId, userMessage);

      // 2. 记录情绪（宽松版）
      await this.recordEmotion(userId, intentResult, userMessage);

      // 3. 记录压力（宽松版）
      await this.recordStress(userId, intentResult, userMessage);

      // 4. 为每次对话生成记忆（核心！）
      await this.generateDailyMemory(userId, intentResult, userMessage);

      console.log('═══ [记忆系统处理完成] ═══\n');
    } catch (error) {
      console.error('[记忆] 处理记录失败:', error);
    }
  }

  /**
   * 获取用户完整画像（用于调试）
   */
  async getUserProfileDebug(userId: string): Promise<any> {
    const profile = await this.memoryService.loadProfile(userId);
    const emotions = await this.memoryService.getRecentEmotions(userId, 5);
    const stress = await this.memoryService.getRecentStress(userId, 5);
    const memory = await this.memoryService.getMemoryEntries(userId, 3);

    return {
      profile,
      recentEmotions: emotions.length > 0 ? emotions : '暂无',
      recentStress: stress.length > 0 ? stress : '暂无',
      recentMemory: memory || '暂无',
      dataDir: 'data/users/' + userId + '/'
    };
  }
}

/**
 * 创建记忆与知识库服务单例
 */
let serviceInstance: MemoryAndKnowledgeService | null = null;

export function createMemoryAndKnowledgeService(): MemoryAndKnowledgeService {
  if (!serviceInstance) {
    serviceInstance = new MemoryAndKnowledgeService();
  }
  return serviceInstance;
}
