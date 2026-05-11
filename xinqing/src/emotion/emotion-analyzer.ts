/**
 * 心晴助手 - 情感分析引擎
 * 
 * 功能：
 * - 实时分析用户文本的情感极性（正面/负面/中性）
 * - 检测情感强度（0-10分）
 * - 识别具体情绪类型（焦虑、抑郁、愤怒、快乐等）
 * - 追踪用户情绪变化趋势
 * - 触发危机预警机制
 */

export interface EmotionAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  emotions: EmotionType[];
  primaryEmotion: string;
  intensity: number;
  needsAttention: boolean;
  crisisLevel: 'safe' | 'concern' | 'warning' | 'urgent';
  keywords: string[];
}

export interface EmotionType {
  name: string;
  intensity: number;
  category: 'basic' | 'complex' | 'crisis';
}

export interface EmotionHistory {
  timestamp: string;
  text: string;
  analysis: EmotionAnalysisResult;
}

// 正面情感词库
const POSITIVE_WORDS = [
  '开心', '高兴', '快乐', '幸福', '满足', '愉快', '兴奋', '惊喜',
  '棒', '好', '优秀', '成功', '进步', '感谢', '谢谢', '喜欢',
  '爱', '温暖', '希望', '期待', '自信', '放松', '舒服', '轻松',
  '哈哈', '嘿嘿', '嘻嘻', '太好了', '不错', '很好', '完美',
  '治愈', '感动', '欣慰', '骄傲', '自豪', '幸运', '美好'
];

// 负面情感词库
const NEGATIVE_WORDS = [
  '难过', '伤心', '悲伤', '痛苦', '沮丧', '失落', '失望', '绝望',
  '焦虑', '担心', '紧张', '害怕', '恐惧', '不安', '烦躁', '郁闷',
  '生气', '愤怒', '恼火', '讨厌', '厌恶', '恨', '崩溃', '受不了',
  '累', '疲惫', '无力', '无助', '孤独', '寂寞', '空虚', '无聊',
  '压力', '压抑', '沉重', '难受', '痛苦', '折磨', '煎熬',
  '想死', '不想活', '活着没意思', '结束生命', '去死', '自杀'
];

// 具体情绪类型映射
const EMOTION_PATTERNS: { pattern: RegExp; emotion: EmotionType }[] = [
  // 焦虑类
  { pattern: /焦虑|紧张|担心|害怕|恐惧|不安|惶恐/g, emotion: { name: '焦虑', intensity: 0, category: 'basic' } },
  { pattern: /考研|考试|期末|挂科|成绩|复习|学习压力/g, emotion: { name: '学业焦虑', intensity: 0, category: 'complex' } },
  
  // 抑郁类
  { pattern: /抑郁|低落|沮丧|消沉|没意思|没动力|不想动|提不起劲/g, emotion: { name: '抑郁情绪', intensity: 0, category: 'basic' } },
  { pattern: /什么都做不了|毫无意义|没有价值|一无是处/g, emotion: { name: '无价值感', intensity: 0, category: 'complex' } },
  
  // 愤怒类
  { pattern: /生气|愤怒|恼火|讨厌|厌恶|恨|不公平|凭什么/g, emotion: { name: '愤怒', intensity: 0, category: 'basic' } },
  { pattern: /室友|同学|老师|父母|朋友.*?(矛盾|冲突|吵架|不和)/g, emotion: { name: '人际愤怒', intensity: 0, category: 'complex' } },
  
  // 孤独类
  { pattern: /孤独|寂寞|没人理解|被孤立|不合群|融不进/g, emotion: { name: '孤独感', intensity: 0, category: 'basic' } },
  
  // 危机信号
  { pattern: /想死|不想活|活着没意思|结束生命|去死|自杀|自残|自伤|割腕|跳楼/g, emotion: { name: '自杀意念', intensity: 0, category: 'crisis' } },
  { pattern: /撑不住了|受不了了|崩溃了|熬不下去了|彻底完了/g, emotion: { name: '心理崩溃', intensity: 0, category: 'crisis' } },
];

// 程度副词
const INTENSITY_MODIFIERS: { word: string; multiplier: number }[] = [
  { word: '非常', multiplier: 1.5 },
  { word: '特别', multiplier: 1.4 },
  { word: '很', multiplier: 1.3 },
  { word: '太', multiplier: 1.4 },
  { word: '超级', multiplier: 1.5 },
  { word: '极其', multiplier: 1.6 },
  { word: '有点', multiplier: 0.7 },
  { word: '稍微', multiplier: 0.6 },
  { word: '比较', multiplier: 0.8 },
  { word: '稍微有点', multiplier: 0.5 },
];

// 否定词
const NEGATION_WORDS = ['不', '没', '无', '别', '不要', '不是', '不会'];

/**
 * 情感分析引擎类
 */
export class EmotionAnalyzer {
  private history: Map<string, EmotionHistory[]> = new Map();
  private maxHistoryLength: number = 100;

  /**
   * 分析文本情感
   */
  analyze(text: string): EmotionAnalysisResult {
    const result: EmotionAnalysisResult = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0,
      emotions: [],
      primaryEmotion: '',
      intensity: 0,
      needsAttention: false,
      crisisLevel: 'safe',
      keywords: []
    };

    if (!text || text.trim().length === 0) {
      return result;
    }

    const lowerText = text.toLowerCase();
    
    // 1. 提取关键词
    result.keywords = this.extractKeywords(text);
    
    // 2. 计算基础情感分数
    const positiveCount = this.countMatches(POSITIVE_WORDS, text);
    const negativeCount = this.countMatches(NEGATIVE_WORDS, text);
    const totalWords = text.length;

    // 3. 应用程度修饰
    let positiveScore = positiveCount;
    let negativeScore = negativeCount;
    
    for (const modifier of INTENSITY_MODIFIERS) {
      if (text.includes(modifier.word)) {
        if (this.isNearPositiveWord(text, modifier.word)) {
          positiveScore *= modifier.multiplier;
        }
        if (this.isNearNegativeWord(text, modifier.word)) {
          negativeScore *= modifier.multiplier;
        }
      }
    }

    // 4. 处理否定
    for (const negation of NEGATION_WORDS) {
      if (text.includes(negation)) {
        if (this.isNearNegativeWord(text, negation)) {
          negativeScore *= 0.3; // 否定负面词 → 减少负面分数
        }
        if (this.isNearPositiveWord(text, negation)) {
          positiveScore *= 0.3; // 否定正面词 → 减少正面分数
        }
      }
    }

    // 5. 计算最终得分 (-10 到 +10)
    const rawScore = (positiveScore - negativeScore) / Math.max(totalWords / 20, 1);
    result.score = Math.max(-10, Math.min(10, rawScore * 2));
    
    // 6. 判断情感极性
    if (result.score > 0.5) {
      result.sentiment = 'positive';
    } else if (result.score < -0.5) {
      result.sentiment = 'negative';
    } else {
      result.sentiment = 'neutral';
    }

    // 7. 计算置信度
    result.confidence = Math.min(Math.abs(result.score) / 5, 1);

    // 8. 识别具体情绪类型
    result.emotions = this.detectSpecificEmotions(text);
    
    // 9. 确定主要情绪和强度
    if (result.emotions.length > 0) {
      result.emotions.sort((a, b) => b.intensity - a.intensity);
      result.primaryEmotion = result.emotions[0].name;
      result.intensity = result.emotions[0].intensity;
    } else {
      result.primaryEmotion = result.sentiment === 'positive' ? '平静愉悦' : 
                              result.sentiment === 'negative' ? '轻度不适' : '平静';
      result.intensity = Math.abs(result.score);
    }

    // 9.5 危机情绪强制分数调整（自杀意念等必须返回高负分）
    result = this.adjustScoreForCrisisEmotions(result);

    // 10. 判断是否需要关注
    result.needsAttention = this.checkNeedsAttention(result);
    
    // 11. 判断危机级别
    result.crisisLevel = this.determineCrisisLevel(result);

    return result;
  }

  /**
   * 分析并记录到历史
   */
  analyzeAndRecord(userId: string, text: string): EmotionAnalysisResult {
    const analysis = this.analyze(text);
    
    const historyEntry: EmotionHistory = {
      timestamp: new Date().toISOString(),
      text: text.slice(0, 100),
      analysis
    };

    if (!this.history.has(userId)) {
      this.history.set(userId, []);
    }

    const userHistory = this.history.get(userId)!;
    userHistory.push(historyEntry);

    // 保持历史记录长度
    if (userHistory.length > this.maxHistoryLength) {
      userHistory.shift();
    }

    return analysis;
  }

  /**
   * 获取用户情绪趋势
   */
  getEmotionTrend(userId: string, days: number = 7): {
    trend: 'improving' | 'declining' | 'stable';
    averageScore: number;
    averageIntensity: number;
    dominantEmotions: string[];
    crisisCount: number;
    dataPoints: Array<{ date: string; score: number; intensity: number }>;
  } {
    const userHistory = this.history.get(userId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = userHistory.filter(entry => 
      new Date(entry.timestamp) >= cutoffDate
    );

    if (recentEntries.length === 0) {
      return {
        trend: 'stable',
        averageScore: 0,
        averageIntensity: 0,
        dominantEmotions: [],
        crisisCount: 0,
        dataPoints: []
      };
    }

    // 计算平均分
    const totalScore = recentEntries.reduce((sum, entry) => sum + entry.analysis.score, 0);
    const averageScore = totalScore / recentEntries.length;

    // 计算平均强度
    const totalIntensity = recentEntries.reduce((sum, entry) => sum + entry.analysis.intensity, 0);
    const averageIntensity = totalIntensity / recentEntries.length;

    // 统计主导情绪
    const emotionCounts: Record<string, number> = {};
    recentEntries.forEach(entry => {
      if (entry.analysis.primaryEmotion) {
        emotionCounts[entry.analysis.primaryEmotion] = 
          (emotionCounts[entry.analysis.primaryEmotion] || 0) + 1;
      }
    });
    const dominantEmotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion]) => emotion);

    // 统计危机次数
    const crisisCount = recentEntries.filter(entry => 
      entry.analysis.crisisLevel === 'warning' || entry.analysis.crisisLevel === 'urgent'
    ).length;

    // 判断趋势
    const halfPoint = Math.floor(recentEntries.length / 2);
    const firstHalf = recentEntries.slice(0, halfPoint);
    const secondHalf = recentEntries.slice(halfPoint);

    const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.analysis.score, 0) / Math.max(firstHalf.length, 1);
    const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.analysis.score, 0) / Math.max(secondHalf.length, 1);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondHalfAvg - firstHalfAvg > 1) {
      trend = 'improving';
    } else if (firstHalfAvg - secondHalfAvg > 1) {
      trend = 'declining';
    }

    // 生成数据点（按天聚合）
    const dailyData: Record<string, { scores: number[]; intensities: number[] }> = {};
    recentEntries.forEach(entry => {
      const date = entry.timestamp.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { scores: [], intensities: [] };
      }
      dailyData[date].scores.push(entry.analysis.score);
      dailyData[date].intensities.push(entry.analysis.intensity);
    });

    const dataPoints = Object.entries(dailyData).map(([date, data]) => ({
      date,
      score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      intensity: data.intensities.reduce((a, b) => a + b, 0) / data.intensities.length
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      trend,
      averageScore: Math.round(averageScore * 100) / 100,
      averageIntensity: Math.round(averageIntensity * 100) / 100,
      dominantEmotions,
      crisisCount,
      dataPoints
    };
  }

  /**
   * 获取情绪历史记录
   */
  getHistory(userId: string, limit: number = 50): EmotionHistory[] {
    const userHistory = this.history.get(userId) || [];
    return userHistory.slice(-limit);
  }

  /**
   * 清除历史记录
   */
  clearHistory(userId?: string): void {
    if (userId) {
      this.history.delete(userId);
    } else {
      this.history.clear();
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    
    [...POSITIVE_WORDS, ...NEGATIVE_WORDS].forEach(word => {
      if (text.includes(word)) {
        keywords.push(word);
      }
    });

    return keywords;
  }

  /**
   * 统计匹配次数
   */
  private countMatches(words: string[], text: string): number {
    let count = 0;
    words.forEach(word => {
      const regex = new RegExp(word, 'g');
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    });
    return count;
  }

  /**
   * 检查修饰词附近是否有正面词
   */
  private isNearPositiveWord(text: string, modifier: string): boolean {
    const index = text.indexOf(modifier);
    if (index === -1) return false;
    
    const nearbyText = text.slice(Math.max(0, index - 5), index + modifier.length + 10);
    return POSITIVE_WORDS.some(word => nearbyText.includes(word));
  }

  /**
   * 检查修饰词附近是否有负面词
   */
  private isNearNegativeWord(text: string, modifier: string): boolean {
    const index = text.indexOf(modifier);
    if (index === -1) return false;
    
    const nearbyText = text.slice(Math.max(0, index - 5), index + modifier.length + 10);
    return NEGATIVE_WORDS.some(word => nearbyText.includes(word));
  }

  /**
   * 检测具体情绪类型
   */
  private detectSpecificEmotions(text: string): EmotionType[] {
    const emotions: EmotionType[] = [];

    EMOTION_PATTERNS.forEach(({ pattern, emotion }) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 根据匹配次数和上下文计算强度
        let baseIntensity = matches.length * 2;
        
        // 检查程度修饰符
        for (const modifier of INTENSITY_MODIFIERS) {
          const modIndex = text.indexOf(modifier.word);
          if (modIndex !== -1) {
            const emotionIndex = text.indexOf(emotion.name);
            if (Math.abs(modIndex - emotionIndex) < 10) {
              baseIntensity *= modifier.multiplier;
              break;
            }
          }
        }

        emotions.push({
          ...emotion,
          intensity: Math.min(10, Math.max(1, baseIntensity))
        });
      }
    });

    return emotions;
  }

  /**
   * 检查是否需要关注
   */
  private checkNeedsAttention(result: EmotionAnalysisResult): boolean {
    return (
      result.intensity >= 7 ||
      result.crisisLevel === 'warning' ||
      result.crisisLevel === 'urgent' ||
      (result.sentiment === 'negative' && result.score < -5)
    );
  }

  /**
   * 9.5 危机情绪强制分数调整
   * 自杀意念、自伤等危机情绪必须返回高负分（-8到-10）
   */
  private adjustScoreForCrisisEmotions(result: EmotionAnalysisResult): EmotionAnalysisResult {
    // 检查是否有危机类别情绪
    const crisisEmotions = result.emotions.filter(e => e.category === 'crisis');
    
    if (crisisEmotions.length > 0) {
      // 找到最高强度的危机情绪
      const maxCrisis = crisisEmotions.reduce((prev, current) => 
        prev.intensity > current.intensity ? prev : current
      );
      
      // 根据危机情绪类型和强度设置负分
      let crisisScore: number;
      
      if (maxCrisis.name === '自杀意念') {
        // 自杀意念：-9到-10（最严重）
        crisisScore = -9 - (Math.min(maxCrisis.intensity, 10) / 10);
      } else if (maxCrisis.name === '心理崩溃') {
        // 心理崩溃：-8到-9.5
        crisisScore = -8 - (Math.min(maxCrisis.intensity, 10) / 20);
      } else {
        // 其他危机情绪：-7到-8
        crisisScore = -7 - (Math.min(maxCrisis.intensity, 10) / 30);
      }
      
      // 确保分数在有效范围内
      result.score = Math.max(-10, Math.min(crisisScore, -7));
      result.sentiment = 'negative';
      
      console.log(`[情感分析] ⚠️ 检测到危机情绪 "${maxCrisis.name}"，分数调整为: ${result.score}`);
    }
    
    // 检查高强度负面情绪（非危机但严重）
    const severeNegative = result.emotions.find(e => 
      e.category !== 'crisis' && 
      e.intensity >= 8 &&
      ['抑郁情绪', '无价值感', '愤怒'].includes(e.name)
    );
    
    if (severeNegative && result.score > -5) {
      // 高强度负面情绪至少应该是中度负面
      result.score = Math.min(result.score, -5);
      console.log(`[情感分析] ⚠️ 检测到高强度负面情绪 "${severeNegative.name}"，分数调整为: ${result.score}`);
    }
    
    return result;
  }

  /**
   * 判断危机级别
   */
  private determineCrisisLevel(result: EmotionAnalysisResult): 'safe' | 'concern' | 'warning' | 'urgent' {
    // 检查是否有危机情绪
    const hasCrisisEmotion = result.emotions.some(e => e.category === 'crisis');
    
    if (hasCrisisEmotion) {
      const crisisEmotion = result.emotions.find(e => e.category === 'crisis')!;
      if (crisisEmotion.intensity >= 7) {
        return 'urgent';
      }
      return 'warning';
    }

    // 根据强度判断
    if (result.intensity >= 8) {
      return 'warning';
    }
    
    if (result.intensity >= 6 && result.sentiment === 'negative') {
      return 'concern';
    }

    return 'safe';
  }
}

/**
 * 创建情感分析器实例
 */
export function createEmotionAnalyzer(): EmotionAnalyzer {
  return new EmotionAnalyzer();
}