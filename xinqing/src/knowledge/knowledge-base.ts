/**
 * 心晴助手 - 知识库服务（KnowledgeBase）
 *
 * 功能：
 * - 管理心理健康专业知识（心理学知识、心理技术、资源信息）
 * - 支持RAG（检索增强生成）
 * - 提供专业上下文给大模型
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 知识条目接口
 */
export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  relevance?: number;  // 检索相关性评分
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  entries: KnowledgeEntry[];
  context: string;  // 拼接后的上下文
}

/**
 * 心理健康知识库
 */
export class KnowledgeBase {
  private knowledgeDir: string;
  private cache: Map<string, KnowledgeEntry[]>;

  constructor() {
    this.knowledgeDir = path.join(__dirname, '../../knowledge');
    this.cache = new Map();
    this.ensureKnowledgeBaseExists();
  }

  /**
   * 确保知识库目录存在
   */
  private ensureKnowledgeBaseExists(): void {
    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
      this.initializeDefaultKnowledge();
    }
  }

  /**
   * 初始化默认知识库
   */
  private initializeDefaultKnowledge(): void {
    // 创建心理学知识目录
    const psychDir = path.join(this.knowledgeDir, 'psychology');
    const techDir = path.join(this.knowledgeDir, 'techniques');
    const resDir = path.join(this.knowledgeDir, 'resources');

    [psychDir, techDir, resDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 心理学知识
    this.saveKnowledge('psychology', '情绪管理', this.getEmotionManagementKnowledge());
    this.saveKnowledge('psychology', '压力应对', this.getStressCopingKnowledge());
    this.saveKnowledge('psychology', '人际关系', this.getRelationshipKnowledge());
    this.saveKnowledge('psychology', '自我成长', this.getSelfGrowthKnowledge());

    // 心理技术
    this.saveKnowledge('techniques', '正念冥想', this.getMindfulnessKnowledge());
    this.saveKnowledge('techniques', '呼吸放松', this.getBreathingKnowledge());
    this.saveKnowledge('techniques', '认知重构', this.getCognitiveKnowledge());
    this.saveKnowledge('techniques', '渐进式放松', this.getRelaxationKnowledge());

    // 资源信息
    this.saveResource('hotlines', this.getHotlinesResource());
    this.saveResource('campus-services', this.getCampusServicesResource());

    console.log('[知识库] 初始化完成');
  }

  /**
   * 保存知识条目
   */
  private saveKnowledge(category: string, title: string, content: string): void {
    const filePath = path.join(this.knowledgeDir, category, `${title}.md`);
    const tags = this.extractTags(content);

    const knowledge: KnowledgeEntry = {
      id: `${category}_${title}`,
      category,
      title,
      content,
      tags
    };

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[知识库] 保存知识: ${category}/${title}`);
  }

  /**
   * 保存资源文件（JSON格式）
   */
  private saveResource(name: string, data: any): void {
    const filePath = path.join(this.knowledgeDir, 'resources', `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[知识库] 保存资源: ${name}`);
  }

  /**
   * 从内容中提取标签
   */
  private extractTags(content: string): string[] {
    const tagPattern = /#(\w+)/g;
    const matches = content.match(tagPattern);
    return matches ? matches.map(t => t.slice(1)) : [];
  }

  // ════════════════════════════════════════════════════════
  // 检索功能
  // ════════════════════════════════════════════════════════

  /**
   * 检索相关知识
   * @param query 用户查询
   * @param topK 返回前k个最相关结果
   */
  async retrieve(query: string, topK: number = 3): Promise<RetrievalResult> {
    console.log(`[知识库] 开始检索: "${query}"`);
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const allEntries: KnowledgeEntry[] = [];
    const categories = ['psychology', 'techniques', 'resources'];

    for (const category of categories) {
      const categoryDir = path.join(this.knowledgeDir, category);
      if (!fs.existsSync(categoryDir)) {
        console.log(`[知识库] 目录不存在: ${categoryDir}`);
        continue;
      }

      const files = fs.readdirSync(categoryDir);
      console.log(`[知识库] ${category}目录有${files.length}个文件`);

      for (const file of files) {
        const filePath = path.join(categoryDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          // 简单关键词匹配评分
          const relevance = this.calculateRelevance(queryLower, content);

          if (relevance > 0) {
            const title = path.basename(file, path.extname(file));
            const entry: KnowledgeEntry = {
              id: `${category}_${title}`,
              category,
              title,
              content: this.truncateContent(content, 500),
              tags: this.extractTags(content),
              relevance
            };
            allEntries.push(entry);
            console.log(`[知识库] ✓ 匹配到: ${category}/${title} (相关性: ${relevance})`);
          }
        } catch (error) {
          console.error(`[知识库] 读取文件失败: ${filePath}`, error);
        }
      }
    }

    // 按相关性排序
    allEntries.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    const topEntries = allEntries.slice(0, topK);
    const context = this.buildContext(topEntries);

    if (topEntries.length > 0) {
      console.log(`[知识库] ✅ 检索完成，找到${topEntries.length}条相关知识`);
    } else {
      console.log(`[知识库] ⚠️ 未找到相关知识（查询词: ${queryWords.join(', ')})`);
    }

    return {
      entries: topEntries,
      context
    };
  }

  /**
   * 计算相关性评分（改进版 - 支持中文）
   */
  private calculateRelevance(query: string, content: string): number {
    const contentLower = content.toLowerCase();
    let score = 0;

    // 方法1：完整查询匹配
    if (contentLower.includes(query)) {
      score += 10;
    }

    // 方法2：提取查询中的关键词进行匹配（支持中文）
    const keywords = this.extractChineseKeywords(query);
    for (const keyword of keywords) {
      if (keyword.length >= 2 && contentLower.includes(keyword)) {
        score += 2;
      }
    }

    // 方法3：标题匹配权重更高
    for (const keyword of keywords) {
      if (contentLower.includes(`# ${keyword}`) || 
          contentLower.includes(`## ${keyword}`) ||
          contentLower.startsWith(`${keyword}\n`) ||
          contentLower.includes(`### ${keyword}`)) {
        score += 5;
      }
    }

    // 方法4：同义词扩展匹配
    const synonyms = this.getSynonyms(query);
    for (const synonym of synonyms) {
      if (contentLower.includes(synonym)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * 提取中文关键词（简单实现）
   */
  private extractChineseKeywords(text: string): string[] {
    const keywords: string[] = [];

    // 常见心理健康相关关键词列表
    const commonKeywords = [
      '放松', '减压', '压力', '焦虑', '抑郁', '情绪', '心情',
      '呼吸', '冥想', '正念', '认知', '行为', '疗法',
      '人际', '关系', '沟通', '社交',
      '睡眠', '失眠', '入睡',
      '目标', '成长', '习惯',
      '学习', '考试', '考研', '工作', '就业',
      '室友', '同学', '朋友', '家人',
      '放松方法', '减压方法', '情绪管理', '压力应对'
    ];

    // 检查常见关键词
    for (const kw of commonKeywords) {
      if (text.includes(kw)) {
        keywords.push(kw);
      }
    }

    // 如果没有匹配到常见关键词，尝试提取2-4字的词语
    if (keywords.length === 0) {
      // 简单的中文分词：按长度提取可能的词语
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= text.length - len; i++) {
          const word = text.slice(i, i + len);
          // 过滤掉纯标点和数字
          if (/[\u4e00-\u9fa5]/.test(word) && !/^[0-9\s\W]+$/.test(word)) {
            keywords.push(word);
          }
        }
      }
    }

    return [...new Set(keywords)];  // 去重
  }

  /**
   * 获取同义词
   */
  private getSynonyms(text: string): string[] {
    const synonymMap: Record<string, string[]> = {
      '放松': ['relax', '轻松', '休息'],
      '减压': ['缓解压力', '减少压力'],
      '焦虑': ['紧张', '担心', '不安', 'anxiety'],
      '抑郁': ['沮丧', '低落', '不开心', 'sadness'],
      '情绪': ['情感', '心情', '感受'],
      '冥想': ['meditation', '静心'],
      '正念': ['mindfulness', '专注当下'],
      '认知': ['cognition', '思维', '想法'],
      '行为': ['behavior', '行动'],
      '人际': ['interpersonal', '人与人'],
      '关系': ['relationship', '联系'],
      '沟通': ['communication', '交流'],
      '睡眠': ['sleep', '睡觉'],
      '失眠': ['insomnia', '睡不着'],
      '压力': ['stress', '压力感'],
      '方法': ['method', '方式', '技巧', 'technique']
    };

    const foundSynonyms: string[] = [];
    for (const [key, values] of Object.entries(synonymMap)) {
      if (text.includes(key)) {
        foundSynonyms.push(...values);
      }
    }

    return foundSynonyms;
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // 找到最后一个句子结束位置
    const truncated = content.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('。');
    const lastNewline = truncated.lastIndexOf('\n');

    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > maxLength * 0.7) {
      return truncated.slice(0, cutPoint + 1);
    }

    return truncated + '...';
  }

  /**
   * 构建检索上下文
   */
  private buildContext(entries: KnowledgeEntry[]): string {
    if (entries.length === 0) return '';

    let context = '\n\n【相关知识】\n\n';

    for (const entry of entries) {
      context += `### ${entry.title}\n`;
      context += entry.content + '\n\n';
    }

    return context;
  }

  // ════════════════════════════════════════════════════════
  // 获取完整知识内容
  // ════════════════════════════════════════════════════════

  /**
   * 获取特定知识
   */
  async getKnowledge(category: string, title: string): Promise<string | null> {
    const filePath = path.join(this.knowledgeDir, category, `${title}.md`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 获取资源信息
   */
  async getResource(name: string): Promise<any | null> {
    const filePath = path.join(this.knowledgeDir, 'resources', `${name}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * 获取危机热线
   */
  async getCrisisHotlines(): Promise<any> {
    return this.getResource('hotlines') || this.getDefaultHotlines();
  }

  /**
   * 获取校园心理服务
   */
  async getCampusServices(): Promise<any> {
    return this.getResource('campus-services') || this.getDefaultCampusServices();
  }

  // ════════════════════════════════════════════════════════
  // 知识库内容（默认内容）
  // ════════════════════════════════════════════════════════

  private getEmotionManagementKnowledge(): string {
    return `# 情绪管理

## 什么是情绪管理
情绪管理是指个体对自身情绪的认知、理解、调节和控制能力。良好的情绪管理能够帮助我们更好地应对生活中的挑战。

## 常见情绪类型
- **焦虑**：对未来不确定性的担忧
- **抑郁**：持续的悲伤和兴趣丧失
- **愤怒**：对不满对象的强烈情绪
- **恐惧**：对特定事物或情境的害怕

## 情绪调节策略

### 1. 认知重评
通过改变对事件的看法来改变情绪体验。
例如：把失败看作是学习的机会而非终点。

### 2. 表达抑制
暂时抑制情绪表达，但长期使用可能有害健康。

### 3. 正念觉察
不带评判地觉察当下情绪，与情绪和平共处。

### 4. 问题解决
针对可改变的情绪来源，采取实际行动解决问题。

## 情绪急救箱
当情绪激动时，尝试：
1. 深呼吸5次
2. 数到10
3. 离开让你激动的环境
4. 和信任的人倾诉
5. 写下你的感受

#情绪管理 #心理调节 #焦虑 #抑郁`;
  }

  private getStressCopingKnowledge(): string {
    return `# 压力应对

## 压力的本质
压力是人体对挑战性事件的自然反应。适度的压力可以激励我们，但过大的压力会影响身心健康。

## 大学生常见压力源
- **学业压力**：考试、论文、考研、就业
- **人际关系**：室友关系、同学关系、恋爱关系
- **经济压力**：生活费、家庭期望
- **未来发展**：职业规划、人生方向

## 压力管理技巧

### 1. 时间管理
- 制定清晰的学习计划
- 使用番茄工作法（25分钟专注+5分钟休息）
- 优先处理重要且紧急的任务

### 2. 放松技术
- 深呼吸：4-7-8呼吸法
- 渐进式肌肉放松
- 正念冥想

### 3. 社会支持
- 与朋友倾诉
- 寻求家人支持
- 参加社团活动

### 4. 认知调整
- 识别灾难化思维
- 挑战非理性信念
- 建立成长型思维

## 压力预警信号
身体信号：头痛、胃痛、失眠、食欲改变
心理信号：焦虑增加、情绪波动、注意力下降
行为信号：社交退缩、拖延、攻击性增加

#压力管理 #应对策略 #放松技巧`;
  }

  private getRelationshipKnowledge(): string {
    return `# 人际关系

## 大学生常见人际困扰
- 室友矛盾
- 与家人的冲突
- 恋爱问题
- 社交焦虑

## 有效沟通技巧

### 1. 非暴力沟通（NVC）
观察 → 感受 → 需求 → 请求
- 观察：描述具体行为，不评价
- 感受：表达你的感受
- 需求：说明你的需求
- 请求：提出具体请求

### 2. 积极倾听
- 全神贯注地听
- 不打断对方
- 复述确认理解
- 给予情感回应

## 室友关系处理
1. 制定共同生活规则
2. 尊重彼此的空间和习惯
3. 及时沟通小矛盾
4. 共同参与活动增进感情

## 边界设定
- 学会说"不"
- 保护个人隐私
- 尊重他人边界
- 保持适当距离

#人际关系 #沟通技巧 #室友 #社交`;
  }

  private getSelfGrowthKnowledge(): string {
    return `# 自我成长

## 大学生自我发展任务
- 自我认同：我是谁，我要成为什么样的人
- 职业规划：了解自己的兴趣和能力
- 价值观形成：形成自己的判断标准
- 亲密关系：建立深度的人际关系

## 自我认知方法
1. **心理测试**：MBTI、霍兰德职业兴趣测试
2. **反思日志**：记录每天的感受和思考
3. **他人反馈**：主动询问朋友家人的看法
4. **尝试新事物**：通过实践了解自己

## 目标设定（SMART原则）
- Specific（具体）：目标清晰明确
- Measurable（可测量）：可以量化评估
- Achievable（可实现）：有挑战但可达成
- Relevant（相关）：与人生方向一致
- Time-bound（有时限）：有明确的截止日期

## 习惯养成
- 从小目标开始
- 坚持21天
- 奖励自己
- 找到同伴互相监督

#自我成长 #目标设定 #习惯养成 #大学生发展`;
  }

  private getMindfulnessKnowledge(): string {
    return `# 正念冥想

## 什么是正念
正念（Mindfulness）是一种有意识地、不评判地专注于当下时刻的觉察能力。

## 正念冥想基础练习

### 1. 呼吸观察
1. 找一个舒适的坐姿
2. 闭上眼睛或轻轻下垂
3. 将注意力放在呼吸上
4. 感受空气进出身体的感觉
5. 当注意力游移时，温柔地把它带回来
6. 持续5-10分钟

### 2. 身体扫描
1. 从脚趾开始
2. 依次感受身体各部位
3. 不评判，只是觉察
4. 关注身体的感觉

### 3. 日常正念
- 吃饭时专注咀嚼
- 走路时感受脚步
- 刷牙时感受触感
- 洗澡时感受水流

## 正念的益处
- 减轻焦虑和压力
- 改善专注力
- 增强情绪调节能力
- 提高睡眠质量

## 注意事项
- 每天固定时间练习
- 从短时间开始（5分钟）
- 不追求特殊体验
- 保持耐心和恒心

#正念 #冥想 #放松 #专注力`;
  }

  private getBreathingKnowledge(): string {
    return `# 呼吸放松

## 呼吸为什么重要
呼吸是连接身心的高速公路。通过调节呼吸，可以快速影响自主神经系统，达到放松效果。

## 推荐呼吸技巧

### 1. 4-7-8呼吸法（入睡神器）
1. 用鼻子吸气4秒
2. 屏住呼吸7秒
3. 用嘴缓缓呼气8秒
4. 重复3-5次

### 2. 腹式呼吸
1. 把手放在腹部
2. 吸气时腹部鼓起
3. 呼气时腹部收缩
4. 保持胸部不动
5. 缓慢深沉地呼吸

### 3. 箱式呼吸（专注力）
1. 用鼻子吸气4秒
2. 屏住呼吸4秒
3. 用嘴呼气4秒
4. 屏住呼吸4秒
5. 重复4-5次

### 4. 深呼吸急救
当感到焦虑时：
1. 找一个安静的地方
2. 慢慢地深深地吸气
3. 感受腹部膨胀
4. 缓缓呼气
5. 重复5-10次

## 练习建议
- 早晚各练习一次
- 感到压力时随时使用
- 保持背部挺直
- 关闭眼睛效果更好

#呼吸 #放松 #焦虑缓解 #入睡`;
  }

  private getCognitiveKnowledge(): string {
    return `# 认知重构

## 什么是认知重构
认知重构是认知行为疗法（CBT）的核心技术，通过改变不合理的思维模式来改善情绪和行为。

## 常见不合理思维

### 1. 全或无思维
"如果这次失败了，我就彻底完了。"
→ 改成："失败是正常的，过程比结果更重要。"

### 2. 灾难化思维
"万一挂科了，我的人生就毁了。"
→ 改成："挂科确实不好，但我可以想办法补救。"

### 3. 以偏概全
"这次演讲搞砸了，我根本不擅长演讲。"
→ 改成："这次演讲有问题，但不代表我永远做不好。"

### 4. 读心术
"大家肯定都觉得我很差劲。"
→ 改成："我不知道别人怎么想，但我已经尽力了。"

## 认知重构步骤
1. **识别**：写下让你困扰的想法
2. **证据**：找出支持和不支持这个想法的证据
3. **替代**：用一个更平衡的想法替代
4. **行动**：按照新想法采取行动

## 苏格拉底提问
- 这个想法有证据支持吗？
- 还有其他可能的解释吗？
- 最坏的结果是什么？真的会发生吗？
- 如果是朋友遇到这种情况，你会怎么说？

#认知重构 #CBT #思维改变 #心理技巧`;
  }

  private getRelaxationKnowledge(): string {
    return `# 渐进式肌肉放松

## 原理
通过先紧张后放松身体各部位的肌肉，打破紧张的循环，达到身心放松的效果。

## 完整练习步骤

### 1. 准备
- 找一个安静舒适的地方
- 躺下或坐在椅子上
- 穿着宽松的衣服
- 关闭眼睛

### 2. 脚部（2分钟）
1. 蜷缩脚趾向下，保持5秒
2. 放松，感受差异
3. 重复一次

### 3. 小腿（2分钟）
1. 脚尖向上翘，拉伸小腿肌肉
2. 保持5秒
3. 放松
4. 重复

### 4. 大腿（2分钟）
1. 收紧大腿肌肉
2. 保持5秒
3. 放松
4. 感受温暖的重量感

### 5. 腹部（1分钟）
1. 深吸一口气
2. 收紧腹部肌肉
3. 保持5秒
4. 缓缓呼气放松

### 6. 胸部（1分钟）
1. 深呼吸
2. 扩张胸腔
3. 保持5秒
4. 缓缓呼气

### 7. 手部（2分钟）
1. 握紧拳头
2. 保持5秒
3. 放松
4. 感受手部变暖

### 8. 手臂（2分钟）
1. 弯曲手臂，收缩肱二头肌
2. 保持5秒
3. 放松
4. 伸展手臂，收缩肱三头肌
5. 保持5秒后放松

### 9. 肩部和颈部（2分钟）
1. 耸起肩膀到耳朵
2. 保持5秒
3. 放松
4. 向后旋转肩膀
5. 向前旋转肩膀

### 10. 面部（1分钟）
1. 紧闭眼睛
2. 皱起眉头
3. 咬紧牙关
4. 收缩面部肌肉
5. 然后完全放松

## 练习提示
- 每个部位紧张5-7秒
- 放松15-20秒
- 感受紧张和放松的对比
- 每天练习15-20分钟
- 睡前练习有助于入睡

#渐进式放松 #肌肉放松 #减压 #睡眠`;
  }

  private getHotlinesResource(): any {
    return {
      name: '心理危机干预热线',
      description: '全国心理援助热线汇总',
      hotlines: [
        {
          name: '全国心理援助热线',
          number: '400-161-9995',
          hours: '24小时',
          description: '专业的心理危机干预服务'
        },
        {
          name: '北京心理危机研究与干预中心',
          number: '010-82951332',
          hours: '24小时',
          description: '心理危机干预和自杀预防'
        },
        {
          name: '生命热线',
          number: '400-821-1215',
          hours: '24小时',
          description: '情感倾诉和心理支持'
        },
        {
          name: '希望24热线',
          number: '400-161-9995',
          hours: '24小时',
          description: '全国青少年心理援助'
        }
      ],
      usage: '当你或身边的朋友有心理困扰时，可以拨打上述热线寻求专业帮助。拨打方式是：区号+电话号码。'
    };
  }

  private getCampusServicesResource(): any {
    return {
      name: '校园心理服务',
      description: '大学生可获得的校园心理支持资源',
      services: [
        {
          type: '心理咨询中心',
          description: '大多数高校都设有心理咨询中心，提供免费或低价的心理咨询服务',
          howToAccess: '通常可以通过学校官网预约，或直接前往心理咨询中心现场预约'
        },
        {
          type: '辅导员/班主任',
          description: '辅导员是学生事务的第一联系人，可以帮助你协调各种资源和困难',
          howToAccess: '直接联系你的辅导员，表达你的困扰和需求'
        },
        {
          type: '班级心理委员',
          description: '每个班级都有经过培训的心理委员，可以提供初步的心理支持',
          howToAccess: '联系班级心理委员，或通过心理委员了解相关资源'
        },
        {
          type: '学生心理社团',
          description: '很多学校有心理健康类学生社团，组织各种心理健康活动',
          howToAccess: '参加社团活动，或关注社团组织的心理健康讲座和工作坊'
        }
      ],
      whenToSeek: [
        '情绪持续低落超过两周',
        '对以前感兴趣的事情失去兴趣',
        '出现睡眠问题（失眠或嗜睡）',
        '食欲和体重明显变化',
        '难以集中注意力',
        '出现自我伤害的想法',
        '人际关系出现严重困难'
      ],
      reminder: '寻求帮助是勇敢的表现，不是软弱。学校的心理服务都是保密的，可以放心使用。'
    };
  }

  private getDefaultHotlines(): any {
    return this.getHotlinesResource();
  }

  private getDefaultCampusServices(): any {
    return this.getCampusServicesResource();
  }
}

/**
 * 创建知识库单例
 */
let knowledgeBaseInstance: KnowledgeBase | null = null;

export function createKnowledgeBase(): KnowledgeBase {
  if (!knowledgeBaseInstance) {
    knowledgeBaseInstance = new KnowledgeBase();
  }
  return knowledgeBaseInstance;
}
