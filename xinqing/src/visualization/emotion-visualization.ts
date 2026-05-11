/**
 * 心晴助手 - 情绪可视化与数据统计模块
 * 
 * 功能：
 * - 提供情绪趋势数据接口
 * - 生成情绪统计报告
 * - 支持前端图表渲染
 */

import { EmotionAnalyzer, EmotionAnalysisResult, createEmotionAnalyzer } from '../emotion/emotion-analyzer.js';
import express from 'express';

export interface EmotionReport {
  userId: string;
  period: string;
  generatedAt: string;
  summary: {
    totalInteractions: number;
    averageScore: number;
    averageIntensity: number;
    dominantEmotions: string[];
    trend: 'improving' | 'declining' | 'stable';
    crisisCount: number;
    wellbeingScore: number; // 0-100 综合幸福感评分
  };
  dailyBreakdown: Array<{
    date: string;
    messageCount: number;
    avgScore: number;
    avgIntensity: number;
    topEmotions: string[];
  }>;
  emotionDistribution: Record<string, number>;
  recommendations: string[];
}

export class EmotionVisualizationService {
  private emotionAnalyzer: EmotionAnalyzer;
  private router: express.Router;

  constructor() {
    this.emotionAnalyzer = createEmotionAnalyzer();
    this.router = express.Router();
    this.initializeRoutes();
  }

  /**
   * 获取Express路由器
   */
  getRouter(): express.Router {
    return this.router;
  }

  /**
   * 初始化API路由
   */
  private initializeRoutes(): void {
    // 获取情绪趋势数据（用于折线图）
    this.router.get('/api/emotion/trend/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days as string) || 7;

        const trend = this.emotionAnalyzer.getEmotionTrend(userId, days);

        res.json({
          success: true,
          data: trend,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[情绪API] 获取趋势失败:', error);
        res.status(500).json({
          success: false,
          error: '获取情绪趋势失败'
        });
      }
    });

    // 获取情绪历史记录
    this.router.get('/api/emotion/history/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const history = this.emotionAnalyzer.getHistory(userId, limit);

        res.json({
          success: true,
          data: history.map(h => ({
            timestamp: h.timestamp,
            text: h.text,
            sentiment: h.analysis.sentiment,
            score: h.analysis.score,
            primaryEmotion: h.analysis.primaryEmotion,
            intensity: h.analysis.intensity,
            crisisLevel: h.analysis.crisisLevel
          })),
          count: history.length
        });
      } catch (error) {
        console.error('[情绪API] 获取历史失败:', error);
        res.status(500).json({
          success: false,
          error: '获取情绪历史失败'
        });
      }
    });

    // 生成情绪报告
    this.router.get('/api/emotion/report/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const period = (req.query.period as string) || 'week'; // week | month

        const report = await this.generateReport(userId, period);

        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        console.error('[情绪API] 生成报告失败:', error);
        res.status(500).json({
          success: false,
          error: '生成报告失败'
        });
      }
    });

    // 获取情绪分布（用于饼图/环形图）
    this.router.get('/api/emotion/distribution/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days as string) || 30;

        const history = this.emotionAnalyzer.getHistory(userId, 200);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentHistory = history.filter(h => 
          new Date(h.timestamp) >= cutoffDate
        );

        // 统计情绪分布
        const distribution: Record<string, number> = {};
        recentHistory.forEach(h => {
          const emotion = h.analysis.primaryEmotion || '未知';
          distribution[emotion] = (distribution[emotion] || 0) + 1;
        });

        // 转换为图表格式
        const chartData = Object.entries(distribution)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10); // 取前10个

        res.json({
          success: true,
          data: chartData,
          total: recentHistory.length
        });
      } catch (error) {
        console.error('[情绪API] 获取分布失败:', error);
        res.status(500).json({
          success: false,
          error: '获取情绪分布失败'
        });
      }
    });

    // 获取危机预警统计
    this.router.get('/api/emotion/crisis-stats/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days as string) || 30;

        const history = this.emotionAnalyzer.getHistory(userId, 200);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentHistory = history.filter(h => 
          new Date(h.timestamp) >= cutoffDate
        );

        const crisisCount = recentHistory.filter(h => 
          h.analysis.crisisLevel === 'warning' || h.analysis.crisisLevel === 'urgent'
        ).length;

        const warningCount = recentHistory.filter(h =>
          h.analysis.needsAttention && h.analysis.crisisLevel !== 'safe'
        ).length;

        res.json({
          success: true,
          data: {
            period: `${days}天`,
            totalInteractions: recentHistory.length,
            crisisAlerts: crisisCount,
            warnings: warningCount,
            safeDays: Math.max(0, days - Math.ceil(warningCount / (recentHistory.length / days || 1))),
            riskLevel: crisisCount > 3 ? 'high' : warningCount > 5 ? 'medium' : 'low'
          }
        });
      } catch (error) {
        console.error('[情绪API] 获取危机统计失败:', error);
        res.status(500).json({
          success: false,
          error: '获取危机统计失败'
        });
      }
    });

    // 获取综合仪表盘数据
    this.router.get('/api/emotion/dashboard/:userId', async (req, res) => {
      try {
        const { userId } = req.params;

        const [trend, distribution, crisisStats] = await Promise.all([
          Promise.resolve(this.emotionAnalyzer.getEmotionTrend(userId, 7)),
          new Promise<any>((resolve) => {
            const history = this.emotionAnalyzer.getHistory(userId, 100);
            const dist: Record<string, number> = {};
            history.slice(-50).forEach(h => {
              const e = h.analysis.primaryEmotion || '未知';
              dist[e] = (dist[e] || 0) + 1;
            });
            resolve(Object.entries(dist).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
          }),
          new Promise<any>((resolve) => {
            const history = this.emotionAnalyzer.getHistory(userId, 100);
            const recent = history.slice(-30);
            resolve({
              crisisCount: recent.filter(h => h.analysis.crisisLevel === 'warning' || h.analysis.crisisLevel === 'urgent').length,
              needsAttention: recent.filter(h => h.analysis.needsAttention).length
            });
          })
        ]);

        // 计算综合幸福感评分 (0-100)
        const wellbeingScore = Math.max(0, Math.min(100, 
          ((trend.averageScore + 10) / 20) * 60 + // 基础情感分 (0-60分)
          (trend.trend === 'improving' ? 20 : trend.trend === 'declining' ? 0 : 10) + // 趋势加分 (0-20分)
          (crisisStats.crisisCount === 0 ? 20 : Math.max(0, 20 - crisisStats.crisisCount * 5)) // 安全加分 (0-20分)
        ));

        res.json({
          success: true,
          data: {
            currentMood: {
              score: trend.dataPoints.length > 0 ? trend.dataPoints[trend.dataPoints.length - 1].score : 0,
              sentiment: trend.dataPoints.length > 0 ? 
                (trend.dataPoints[trend.dataPoints.length - 1].score > 0.5 ? 'positive' : 
                 trend.dataPoints[trend.dataPoints.length - 1].score < -0.5 ? 'negative' : 'neutral') : 'neutral',
              primaryEmotion: trend.dominantEmotions[0] || '平静',
              intensity: trend.averageIntensity
            },
            weeklyTrend: {
              direction: trend.trend,
              averageScore: trend.averageScore,
              dataPoints: trend.dataPoints
            },
            emotionDistribution: distribution.slice(0, 6),
            safetyStatus: {
              level: crisisStats.crisisCount > 2 ? 'attention_needed' : 'normal',
              recentCrisisCount: crisisStats.crisisCount,
              recentWarnings: crisisStats.needsAttention
            },
            wellbeingScore: Math.round(wellbeingScore),
            recommendations: this.generateRecommendations(trend, crisisStats)
          },
          generatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('[情绪API] 获取仪表盘失败:', error);
        res.status(500).json({
          success: false,
          error: '获取仪表盘数据失败'
        });
      }
    });
  }

  /**
   * 生成详细报告
   */
  async generateReport(userId: string, period: string): Promise<EmotionReport> {
    const days = period === 'month' ? 30 : 7;
    const history = this.emotionAnalyzer.getHistory(userId, 500);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const periodHistory = history.filter(h => 
      new Date(h.timestamp) >= cutoffDate
    );

    if (periodHistory.length === 0) {
      return this.createEmptyReport(userId, period);
    }

    // 计算汇总
    const totalInteractions = periodHistory.length;
    const scores = periodHistory.map(h => h.analysis.score);
    const intensities = periodHistory.map(h => h.analysis.intensity);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const averageIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;

    // 主导情绪
    const emotionCounts: Record<string, number> = {};
    periodHistory.forEach(h => {
      const e = h.analysis.primaryEmotion;
      emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    });
    const dominantEmotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([e]) => e);

    // 趋势
    const trend = this.emotionAnalyzer.getEmotionTrend(userId, days);

    // 危机次数
    const crisisCount = periodHistory.filter(h =>
      h.analysis.crisisLevel === 'warning' || h.analysis.crisisLevel === 'urgent'
    ).length;

    // 按日分解
    const dailyMap: Record<string, { scores: number[]; intensities: number[]; emotions: string[] }> = {};
    periodHistory.forEach(h => {
      const date = h.timestamp.split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { scores: [], intensities: [], emotions: [] };
      }
      dailyMap[date].scores.push(h.analysis.score);
      dailyMap[date].intensities.push(h.analysis.intensity);
      dailyMap[date].emotions.push(h.analysis.primaryEmotion);
    });

    const dailyBreakdown = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        messageCount: data.scores.length,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        avgIntensity: data.intensities.reduce((a, b) => a + b, 0) / data.intensities.length,
        topEmotions: [...new Set(data.emotions)].slice(0, 3)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 幸福感评分
    const wellbeingScore = Math.round(
      ((averageScore + 10) / 20) * 50 +
      (trend.trend === 'improving' ? 15 : trend.trend === 'declining' ? 0 : 8) +
      Math.max(0, 15 - crisisCount * 3)
    );

    return {
      userId,
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalInteractions,
        averageScore: Math.round(averageScore * 100) / 100,
        averageIntensity: Math.round(averageIntensity * 100) / 100,
        dominantEmotions,
        trend: trend.trend,
        crisisCount,
        wellbeingScore: Math.max(0, Math.min(100, wellbeingScore))
      },
      dailyBreakdown,
      emotionDistribution: emotionCounts,
      recommendations: this.generateRecommendations(trend, { crisisCount })
    };
  }

  /**
   * 创建空报告
   */
  private createEmptyReport(userId: string, period: string): EmotionReport {
    return {
      userId,
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalInteractions: 0,
        averageScore: 0,
        averageIntensity: 0,
        dominantEmotions: [],
        trend: 'stable',
        crisisCount: 0,
        wellbeingScore: 50
      },
      dailyBreakdown: [],
      emotionDistribution: {},
      recommendations: [
        '开始和我聊天吧！我会帮你记录和分析你的情绪变化。',
        '多分享你的感受，这样我才能更好地帮助你。'
      ]
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(trend: any, stats: { crisisCount: number }): string[] {
    const recommendations: string[] = [];

    if (stats.crisisCount > 3) {
      recommendations.push('⚠️ 最近检测到多次情绪预警，建议你关注自己的心理状态，必要时寻求专业帮助。');
    }

    if (trend.trend === 'declining') {
      recommendations.push('📉 近期情绪呈下降趋势，可以尝试：每天进行10分钟的正念练习、保持规律作息、和朋友倾诉。');
    } else if (trend.trend === 'improving') {
      recommendations.push('📈 很高兴看到你的情绪在好转！继续保持现在的积极做法。');
    }

    if (trend.averageScore < -3) {
      recommendations.push('💙 整体情绪偏负面，建议：减少压力源、增加运动时间、保证充足睡眠。');
    }

    if (trend.dominantEmotions.includes('焦虑')) {
      recommendations.push('😰 焦虑是近期主要情绪，试试深呼吸：吸气4秒→屏息7秒→呼气8秒，重复5次。');
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ 你的情绪状态整体良好，继续保持！');
      recommendations.push('💡 可以尝试记录每日感恩日记，进一步提升幸福感。');
    }

    return recommendations;
  }
}

/**
 * 创建情绪可视化服务实例
 */
export function createEmotionVisualizationService(): EmotionVisualizationService {
  return new EmotionVisualizationService();
}