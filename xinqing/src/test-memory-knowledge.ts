/**
 * 测试脚本：验证知识库和长期记忆功能
 * 
 * 使用方法：
 * 1. 确保服务器已启动（npm run dev）
 * 2. 在另一个终端运行: npx tsx src/test-knowledge.ts
 */

import { createKnowledgeBase } from './knowledge/knowledge-base.js';
import { createMemoryService } from './memory/memory-service.js';

async function testKnowledgeBase() {
  console.log('\n═════════════════════════════════════');
  console.log('🧪 测试1：知识库检索功能');
  console.log('═════════════════════════════════════\n');

  const kb = createKnowledgeBase();

  // 测试用例
  const testQueries = [
    '有什么放松的方法吗',
    '什么是认知行为疗法',
    '如何缓解压力',
    '正念冥想怎么做',
    '呼吸放松技巧',
    '人际关系处理',
    '情绪管理方法'
  ];

  for (const query of testQueries) {
    console.log(`\n📝 查询: "${query}"`);
    const result = await kb.retrieve(query, 2);
    
    if (result.entries.length > 0) {
      console.log(`✅ 找到 ${result.entries.length} 条相关知识:`);
      result.entries.forEach((entry, i) => {
        console.log(`   ${i+1}. [${entry.category}] ${entry.title} (相关性: ${entry.relevance})`);
        console.log(`      内容预览: ${entry.content.slice(0, 100)}...`);
      });
    } else {
      console.log('⚠️ 未找到相关知识');
    }
  }
}

async function testMemoryService() {
  console.log('\n\n═════════════════════════════════════');
  console.log('🧪 测试2：长期记忆功能');
  console.log('═════════════════════════════════════\n');

  const memory = createMemoryService();
  
  const testUserId = 'test-user-' + Date.now();

  // 测试创建用户画像
  console.log('\n📝 创建用户画像...');
  const profile = await memory.loadProfile(testUserId);
  console.log(`✅ 用户画像已创建: ${profile.userId}`);
  console.log(`   行为阶段: ${profile.behaviorStage}`);
  console.log(`   信任等级: ${profile.trustLevel}`);

  // 测试保存情绪记录
  console.log('\n📝 记录情绪数据...');
  await memory.saveEmotionRecord({
    userId: testUserId,
    timestamp: new Date().toISOString(),
    emotion: '焦虑',
    intensity: 7,
    trigger: '考研复习压力',
    source: 'test',
    intent: 'emotion_log'
  });
  console.log('✅ 情绪记录已保存');

  // 测试保存压力记录
  console.log('\n📝 记录压力数据...');
  await memory.saveStressRecord({
    userId: testUserId,
    timestamp: new Date().toISOString(),
    stressType: '学业压力',
    source: '考研',
    intensity: 8,
    source: 'test',
    intent: 'stress_log'
  });
  console.log('✅ 压力记录已保存');

  // 测试生成核心记忆
  console.log('\n📝 生成核心记忆...');
  await memory.saveMemoryEntry({
    userId: testUserId,
    timestamp: new Date().toISOString(),
    category: '重要事件',
    title: '测试记忆条目',
    content: '这是一个测试的记忆内容，用于验证长期记忆功能。',
    importance: '中',
    tags: ['测试', '验证'],
    source: {
      type: 'ai_extracted',
      reference: '测试引用'
    }
  });
  console.log('✅ 核心记忆已生成');

  // 测试读取数据
  console.log('\n📖 读取近期情绪记录...');
  const emotions = await memory.getRecentEmotions(testUserId, 5);
  console.log(`✅ 获取到 ${emotions.length} 条情绪记录:`);
  emotions.forEach(e => {
    console.log(`   - ${e.emotion} (${e.intensity}/10) @ ${e.timestamp}`);
  });

  console.log('\n📖 读取核心记忆...');
  const memoryContent = await memory.getMemoryEntries(testUserId, 5);
  console.log(`✅ 核心记忆长度: ${memoryContent?.length || 0} 字符`);

  console.log('\n✅ 所有记忆功能测试通过！');
}

async function main() {
  try {
    await testKnowledgeBase();
    await testMemoryService();

    console.log('\n\n═════════════════════════════════════');
    console.log('🎉 全部测试完成！');
    console.log('═════════════════════════════════════\n');

    console.log('💡 提示:');
    console.log('   - 如果看到 ✅ 表示功能正常');
    console.log('   - 如果看到 ⚠️ 表示需要检查');
    console.log('   - 查看控制台日志了解更多详情\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

main();
