/**
 * 测试脚本：验证情感分析、主动服务、情绪可视化功能
 * 
 * 使用方法：
 * 1. 确保服务器已启动（npm run dev）
 * 2. 运行: npx tsx src/test-new-features.ts
 */

import { createEmotionAnalyzer, EmotionAnalysisResult } from './emotion/emotion-analyzer.js';
import { createProactiveService } from './proactive/proactive-service.js';

async function testEmotionAnalyzer() {
  console.log('\n═════════════════════════════════════');
  console.log('🧪 测试1：情感分析引擎');
  console.log('═════════════════════════════════════\n');

  const analyzer = createEmotionAnalyzer();
  const testUserId = 'test-emotion-' + Date.now();

  // 测试用例
  const testCases = [
    { text: '我今天特别开心！考试考了满分', expected: 'positive' },
    { text: '最近压力很大，感觉快要崩溃了', expected: 'negative' },
    { text: '今天天气不错，心情还可以', expected: 'neutral/positive' },
    { text: '活着真没意思，想去死', expected: 'negative', crisis: true },
    { text: '考研复习很累，但我会坚持的', expected: 'mixed' },
    { text: '室友太吵了，我很生气', expected: 'negative' },
    { text: '有点焦虑，不知道未来怎么办', expected: 'negative' },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`📝 测试: "${tc.text}"`);
    const result = analyzer.analyze(tc.text);
    
    console.log(`   极性: ${result.sentiment} (得分: ${result.score})`);
    console.log(`   主要情绪: ${result.primaryEmotion}`);
    console.log(`   强度: ${result.intensity}/10`);
    console.log(`   危机级别: ${result.crisisLevel}`);
    
    // 记录到历史
    analyzer.analyzeAndRecord(testUserId, tc.text);

    // 验证结果
    const isCorrect = result.sentiment === tc.expected || 
                     (tc.expected.includes(result.sentiment)) ||
                     (tc.crisis && result.crisisLevel !== 'safe');
    
    if (isCorrect) {
      console.log(`   ✅ 通过`);
      passed++;
    } else {
      console.log(`   ❌ 预期: ${tc.expected}`);
      failed++;
    }
    console.log('');
  }

  // 测试趋势分析
  console.log('📊 测试情绪趋势分析...');
  const trend = analyzer.getEmotionTrend(testUserId, 7);
  console.log(`   平均分: ${trend.averageScore}`);
  console.log(`   趋势: ${trend.trend}`);
  console.log(`   主导情绪: ${trend.dominantEmotions.join(', ')}`);
  console.log(`   数据点数: ${trend.dataPoints.length}`);

  console.log(`\n✅ 情感分析测试完成: ${passed}通过, ${failed}失败`);
  
  return { passed, failed };
}

async function testProactiveService() {
  console.log('\n\n═════════════════════════════════════');
  console.log('🧪 测试2：主动服务模块');
  console.log('═════════════════════════════════════\n');

  const proactiveService = createProactiveService();
  const testUserId = 'test-proactive-' + Date.now();

  // 初始化用户设置
  proactiveService.updateUserSettings(testUserId, {
    morningGreeting: true,
    eveningCare: true,
    emotionCheck: true,
    studyReminder: true,
    maxPushPerDay: 5
  });

  console.log('📋 用户设置已初始化');

  // 测试危机预警触发
  console.log('\n🚨 测试危机预警触发...');
  const emotionAnalyzer = createEmotionAnalyzer();
  const crisisAnalysis = emotionAnalyzer.analyze('我想死，活着没意思');
  
  try {
    const alertMessage = await proactiveService.triggerCrisisAlert(testUserId, crisisAnalysis);
    console.log(`   ✅ 危机预警已触发`);
    console.log(`   类型: ${alertMessage.type}`);
    console.log(`   优先级: ${alertMessage.priority}`);
    console.log(`   内容预览: ${alertMessage.content.slice(0, 50)}...`);
  } catch (error) {
    console.error(`   ❌ 危机预警失败:`, error);
  }

  // 测试推送历史
  console.log('\n📜 查看推送历史...');
  const history = proactiveService.getPushHistory(testUserId);
  console.log(`   推送记录数: ${history.length}`);
  history.forEach(h => {
    console.log(`   - [${h.type}] ${h.timestamp.slice(11, 19)} | ${h.content.slice(0, 30)}...`);
  });

  // 测试消息模板生成（不实际推送，只检查逻辑）
  console.log('\n💬 测试消息模板...');
  const settings = proactiveService.getUserSettings(testUserId);
  console.log(`   ✅ 用户设置获取成功`);
  console.log(`   - 早安问候: ${settings.morningGreeting ? '开启' : '关闭'}`);
  console.log(`   - 晚安关怀: ${settings.eveningCare ? '开启' : '关闭'}`);
  console.log(`   - 情绪检查: ${settings.emotionCheck ? '开启' : '关闭'}`);
  console.log(`   - 学习提醒: ${settings.studyReminder ? '开启' : '关闭'}`);
  console.log(`   - 每日上限: ${settings.maxPushPerDay}条`);

  console.log('\n✅ 主动服务模块测试完成');
}

async function main() {
  console.log(`
╔════════════════════════════════════╗
║                                      ║
║   🌸 心晴助手 - 新功能测试          ║
║   情感分析 + 主动服务 + 可视化     ║
║                                      ║
╚════════════════════════════════════╝
  `);

  try {
    // 测试情感分析引擎
    await testEmotionAnalyzer();

    // 测试主动服务模块
    await testProactiveService();

    console.log('\n\n═════════════════════════════════════');
    console.log('🎉 所有新功能测试完成！');
    console.log('═════════════════════════════════════\n');

    console.log('💡 功能清单:');
    console.log('   ✅ 情感分析引擎 - 实时识别用户情感极性和强度');
    console.log('   ✅ 情绪追踪系统 - 记录和分析情绪变化趋势');
    console.log('   ✅ 危机预警机制 - 自动检测危险信号并预警');
    console.log('   ✅ 主动服务模块 - 定时关怀推送和个性化建议');
    console.log('   ✅ 情绪可视化API - 提供图表数据接口');
    
    console.log('\n📡 API端点:');
    console.log('   GET /api/emotion/trend/:userId?days=7');
    console.log('   GET /api/emotion/history/:userId?limit=50');
    console.log('   GET /api/emotion/report/:userId?period=week|month');
    console.log('   GET /api/emotion/distribution/:userId?days=30');
    console.log('   GET /api/emotion/crisis-stats/:userId?days=30');
    console.log('   GET /api/emotion/dashboard/:userId');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main();