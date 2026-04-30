/**
 * 心晴助手 - 长期记忆服务（MemoryService）
 *
 * 功能：
 * - 用户数据的持久化存储（文件系统）
 * - 记忆的加载与更新
 * - 结构化数据与可读文本的双文件存储
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import {
  UserProfile,
  EmotionRecord,
  StressRecord,
  GoalRecord,
  MemoryEntry,
  InteractionRecord,
  UserSessionData,
  createDefaultProfile,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 长期记忆服务
 */
export class MemoryService {
  private dataDir: string;
  private userCache: Map<string, UserSessionData>;

  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.userCache = new Map();
    this.ensureDirectoryExists(this.dataDir);
  }

  /**
   * 确保目录存在
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 获取用户数据目录
   */
  private getUserDir(userId: string): string {
    const userDir = path.join(this.dataDir, 'users', userId);
    this.ensureDirectoryExists(userDir);
    return userDir;
  }

  /**
   * 获取用户子目录
   */
  private getUserSubDir(userId: string, subDir: string): string {
    const dir = path.join(this.getUserDir(userId), subDir);
    this.ensureDirectoryExists(dir);
    return dir;
  }

  // ════════════════════════════════════════════════════════
  // 用户画像操作
  // ════════════════════════════════════════════════════════

  /**
   * 加载用户画像
   */
  async loadProfile(userId: string): Promise<UserProfile> {
    const profilePath = path.join(this.getUserDir(userId), 'profile.json');

    try {
      if (fs.existsSync(profilePath)) {
        const data = fs.readFileSync(profilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[Memory] 加载用户画像失败: ${error}`);
    }

    // 返回默认画像
    const defaultProfile = createDefaultProfile(userId);
    await this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * 保存用户画像
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    const profilePath = path.join(this.getUserDir(profile.userId), 'profile.json');
    profile.updatedAt = new Date().toISOString();
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8');

    // 同时生成可读的 profile.md
    const mdPath = path.join(this.getUserDir(profile.userId), 'profile.md');
    const mdContent = this.generateProfileMarkdown(profile);
    fs.writeFileSync(mdPath, mdContent, 'utf-8');
  }

  /**
   * 生成用户画像Markdown
   */
  private generateProfileMarkdown(profile: UserProfile): string {
    return `# 用户画像 - ${profile.userId}

## 基本信息
- 年龄：${profile.basic.age || '未知'}
- 性别：${profile.basic.gender || '未知'}
- 年级：${profile.basic.grade || '未知'}
- 专业：${profile.basic.major || '未知'}
- 学校：${profile.basic.school || '未知'}

## 心理状态
- 当前情绪：${profile.psychology.lastEmotion || '暂无记录'}
- 情绪趋势：${profile.psychology.emotionalTrend}
- 精神状态：${profile.psychology.mentalState}
- 常见压力源：${profile.psychology.commonStressors.join('、') || '暂无'}

## 关注领域
${profile.concerns.map(c => `- ${c}`).join('\n') || '暂无记录'}

## 行为阶段
- 当前阶段：${profile.behaviorStage}
- 信任等级：${'⭐'.repeat(profile.trustLevel)}

## 交互统计
- 总对话次数：${profile.stats.totalConversations}
- 总消息数：${profile.stats.totalMessages}
- 连续活跃天数：${profile.stats.consecutiveDays}
- 最后交互时间：${profile.stats.lastInteractionTime}

## 偏好设置
- 沟通风格：${profile.preferences.communicationStyle}
- 回复长度：${profile.preferences.responseLength}
- 推送时间：${profile.preferences.notificationTime || '未设置'}

---
更新时间：${profile.updatedAt}
`;
  }

  // ════════════════════════════════════════════════════════
  // 情绪记录操作
  // ════════════════════════════════════════════════════════

  /**
   * 保存情绪记录
   */
  async saveEmotionRecord(record: Omit<EmotionRecord, 'id'>): Promise<EmotionRecord> {
    const fullRecord: EmotionRecord = {
      ...record,
      id: `emotion_${Date.now()}_${uuidv4().slice(0, 8)}`
    };

    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const emotionFile = path.join(
      this.getUserSubDir(record.userId, 'emotions'),
      `${monthKey}.json`
    );

    // 读取或创建月度文件
    let records: EmotionRecord[] = [];
    if (fs.existsSync(emotionFile)) {
      records = JSON.parse(fs.readFileSync(emotionFile, 'utf-8'));
    }

    records.push(fullRecord);
    fs.writeFileSync(emotionFile, JSON.stringify(records, null, 2), 'utf-8');

    // 更新用户画像中的最新情绪
    await this.updateLatestEmotion(record.userId, record.emotion, record.intensity);

    return fullRecord;
  }

  /**
   * 获取近期情绪记录
   */
  async getRecentEmotions(userId: string, limit: number = 10): Promise<EmotionRecord[]> {
    const emotionsDir = path.join(this.getUserDir(userId), 'emotions');

    if (!fs.existsSync(emotionsDir)) {
      return [];
    }

    // 读取最近2个月的记录
    const now = new Date();
    const records: EmotionRecord[] = [];

    for (let i = 0; i < 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const emotionFile = path.join(emotionsDir, `${monthKey}.json`);

      if (fs.existsSync(emotionFile)) {
        const monthRecords: EmotionRecord[] = JSON.parse(fs.readFileSync(emotionFile, 'utf-8'));
        records.push(...monthRecords);
      }
    }

    // 按时间倒序返回
    return records
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * 更新用户最新情绪
   */
  private async updateLatestEmotion(userId: string, emotion: string, intensity: number): Promise<void> {
    const profile = await this.loadProfile(userId);
    profile.psychology.lastEmotion = emotion;
    profile.psychology.lastEmotionTime = new Date().toLocaleString('zh-CN');
    await this.saveProfile(profile);
  }

  // ════════════════════════════════════════════════════════
  // 压力记录操作
  // ════════════════════════════════════════════════════════

  /**
   * 保存压力记录
   */
  async saveStressRecord(record: Omit<StressRecord, 'id'>): Promise<StressRecord> {
    const fullRecord: StressRecord = {
      ...record,
      id: `stress_${Date.now()}_${uuidv4().slice(0, 8)}`
    };

    const monthKey = new Date().toISOString().slice(0, 7);
    const stressFile = path.join(
      this.getUserSubDir(record.userId, 'stress'),
      `${monthKey}.json`
    );

    let records: StressRecord[] = [];
    if (fs.existsSync(stressFile)) {
      records = JSON.parse(fs.readFileSync(stressFile, 'utf-8'));
    }

    records.push(fullRecord);
    fs.writeFileSync(stressFile, JSON.stringify(records, null, 2), 'utf-8');

    // 更新用户画像中的常见压力源
    await this.updateCommonStressors(record.userId, record.stressType);

    return fullRecord;
  }

  /**
   * 获取近期压力记录
   */
  async getRecentStress(userId: string, limit: number = 10): Promise<StressRecord[]> {
    const stressDir = path.join(this.getUserDir(userId), 'stress');

    if (!fs.existsSync(stressDir)) {
      return [];
    }

    const now = new Date();
    const records: StressRecord[] = [];

    for (let i = 0; i < 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const stressFile = path.join(stressDir, `${monthKey}.json`);

      if (fs.existsSync(stressFile)) {
        const monthRecords: StressRecord[] = JSON.parse(fs.readFileSync(stressFile, 'utf-8'));
        records.push(...monthRecords);
      }
    }

    return records
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * 更新常见压力源
   */
  private async updateCommonStressors(userId: string, stressType: string): Promise<void> {
    const profile = await this.loadProfile(userId);
    if (!profile.psychology.commonStressors.includes(stressType)) {
      profile.psychology.commonStressors.push(stressType);
      await this.saveProfile(profile);
    }
  }

  // ════════════════════════════════════════════════════════
  // 核心记忆操作（MEMORY.md）
  // ════════════════════════════════════════════════════════

  /**
   * 保存核心记忆
   */
  async saveMemoryEntry(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: `memory_${Date.now()}_${uuidv4().slice(0, 8)}`
    };

    const memoryFile = path.join(this.getUserDir(entry.userId), 'MEMORY.md');

    // 追加到MEMORY.md
    const entryMarkdown = this.generateMemoryMarkdown(fullEntry);
    const existingContent = fs.existsSync(memoryFile) ? fs.readFileSync(memoryFile, 'utf-8') : '';

    const newContent = existingContent + '\n' + entryMarkdown;
    fs.writeFileSync(memoryFile, newContent, 'utf-8');

    return fullEntry;
  }

  /**
   * 生成记忆Markdown条目
   */
  private generateMemoryMarkdown(entry: MemoryEntry): string {
    return `
## ${entry.title} [${entry.category}]

**时间**：${entry.timestamp}
**重要性**：${entry.importance}
**标签**：${entry.tags.join(', ')}

### 内容
${entry.content}

### 来源
- 类型：${entry.source.type}
${entry.source.reference ? `- 引用：${entry.source.reference}` : ''}
`;
  }

  /**
   * 获取核心记忆
   */
  async getMemoryEntries(userId: string, limit: number = 20): Promise<string> {
    const memoryFile = path.join(this.getUserDir(userId), 'MEMORY.md');

    if (!fs.existsSync(memoryFile)) {
      return '';
    }

    const content = fs.readFileSync(memoryFile, 'utf-8');
    const lines = content.split('\n');

    // 返回最后limit个记忆条目
    const entries: string[] = [];
    let currentEntry: string[] = [];
    let inEntry = false;

    for (const line of lines) {
      if (line.startsWith('## ') && line !== '## 基本信息') {
        if (currentEntry.length > 0) {
          entries.push(currentEntry.join('\n'));
        }
        currentEntry = [line];
        inEntry = true;
      } else if (inEntry) {
        currentEntry.push(line);
      }
    }

    if (currentEntry.length > 0) {
      entries.push(currentEntry.join('\n'));
    }

    return entries.slice(-limit).join('\n\n');
  }

  // ════════════════════════════════════════════════════════
  // 目标记录操作
  // ════════════════════════════════════════════════════════

  /**
   * 保存目标
   */
  async saveGoal(goal: Omit<GoalRecord, 'id'>): Promise<GoalRecord> {
    const fullGoal: GoalRecord = {
      ...goal,
      id: `goal_${Date.now()}_${uuidv4().slice(0, 8)}`
    };

    const goalsFile = path.join(this.getUserSubDir(goal.userId, 'goals'), 'goals.json');

    let goals: GoalRecord[] = [];
    if (fs.existsSync(goalsFile)) {
      goals = JSON.parse(fs.readFileSync(goalsFile, 'utf-8'));
    }

    goals.push(fullGoal);
    fs.writeFileSync(goalsFile, JSON.stringify(goals, null, 2), 'utf-8');

    return fullGoal;
  }

  /**
   * 获取进行中的目标
   */
  async getActiveGoals(userId: string): Promise<GoalRecord[]> {
    const goalsFile = path.join(this.getUserSubDir(userId, 'goals'), 'goals.json');

    if (!fs.existsSync(goalsFile)) {
      return [];
    }

    const goals: GoalRecord[] = JSON.parse(fs.readFileSync(goalsFile, 'utf-8'));
    return goals.filter(g => g.status === '进行中');
  }

  // ════════════════════════════════════════════════════════
  // 交互历史操作
  // ════════════════════════════════════════════════════════

  /**
   * 保存交互记录
   */
  async saveInteraction(record: Omit<InteractionRecord, 'id'>): Promise<InteractionRecord> {
    const fullRecord: InteractionRecord = {
      ...record,
      id: `interaction_${Date.now()}_${uuidv4().slice(0, 8)}`
    };

    const monthKey = new Date().toISOString().slice(0, 7);
    const interactionFile = path.join(
      this.getUserSubDir(record.userId, 'interactions'),
      `${monthKey}.json`
    );

    let records: InteractionRecord[] = [];
    if (fs.existsSync(interactionFile)) {
      records = JSON.parse(fs.readFileSync(interactionFile, 'utf-8'));
    }

    records.push(fullRecord);
    fs.writeFileSync(interactionFile, JSON.stringify(records, null, 2), 'utf-8');

    // 更新用户统计
    await this.updateInteractionStats(record.userId);

    return fullRecord;
  }

  /**
   * 更新交互统计
   */
  private async updateInteractionStats(userId: string): Promise<void> {
    const profile = await this.loadProfile(userId);
    profile.stats.totalConversations++;
    profile.stats.totalMessages++;
    profile.stats.lastInteractionTime = new Date().toISOString();
    await this.saveProfile(profile);
  }

  // ════════════════════════════════════════════════════════
  // 批量加载用户完整数据
  // ════════════════════════════════════════════════════════

  /**
   * 加载用户完整会话数据
   */
  async loadUserSessionData(userId: string): Promise<UserSessionData> {
    // 检查缓存
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    const [
      profile,
      recentEmotions,
      recentStress,
      activeGoals,
    ] = await Promise.all([
      this.loadProfile(userId),
      this.getRecentEmotions(userId, 20),
      this.getRecentStress(userId, 20),
      this.getActiveGoals(userId),
    ]);

    const memoryEntriesMarkdown = await this.getMemoryEntries(userId, 10);

    const sessionData: UserSessionData = {
      userId,
      profile,
      recentEmotions,
      recentStress,
      activeGoals,
      recentInteractions: [],
      memoryEntries: [],
      stats: {
        weeklyEmotionTrend: this.calculateWeeklyTrend(recentEmotions),
        monthlyStressDistribution: this.calculateStressDistribution(recentStress),
        goalCompletionRate: this.calculateGoalCompletionRate(activeGoals),
      }
    };

    // 存入缓存
    this.userCache.set(userId, sessionData);

    return sessionData;
  }

  /**
   * 计算周情绪趋势
   */
  private calculateWeeklyTrend(emotions: EmotionRecord[]): number[] {
    const now = new Date();
    const weekData: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);

      const dayEmotions = emotions.filter(e =>
        e.timestamp.startsWith(dateStr)
      );

      if (dayEmotions.length > 0) {
        const avgIntensity = dayEmotions.reduce((sum, e) => sum + e.intensity, 0) / dayEmotions.length;
        weekData.push(avgIntensity);
      } else {
        weekData.push(0);
      }
    }

    return weekData;
  }

  /**
   * 计算压力分布
   */
  private calculateStressDistribution(stress: StressRecord[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const record of stress) {
      distribution[record.stressType] = (distribution[record.stressType] || 0) + 1;
    }

    return distribution;
  }

  /**
   * 计算目标完成率
   */
  private calculateGoalCompletionRate(goals: GoalRecord[]): number {
    if (goals.length === 0) return 0;

    const completed = goals.filter(g => g.status === '已完成').length;
    return Math.round((completed / goals.length) * 100);
  }

  /**
   * 清除用户缓存
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.userCache.delete(userId);
    } else {
      this.userCache.clear();
    }
  }

  /**
   * 更新用户画像字段（便捷方法）
   */
  async updateProfileField<K extends keyof UserProfile>(
    userId: string,
    field: K,
    value: UserProfile[K]
  ): Promise<void> {
    const profile = await this.loadProfile(userId);
    profile[field] = value;
    await this.saveProfile(profile);
    this.clearCache(userId);
  }
}

/**
 * 创建记忆服务单例
 */
let memoryServiceInstance: MemoryService | null = null;

export function createMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService();
  }
  return memoryServiceInstance;
}
