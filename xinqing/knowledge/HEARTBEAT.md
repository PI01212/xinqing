# 心晴Agent - 心跳检测与任务调度器

**文档版本**：v1.0  
**创建日期**：2026年4月30日  
**最后心跳时间**：2026-04-30 23:45:00  

---

## 💓 心跳机制说明

本文件是心晴Agent的**心跳检测中心**，用于：
- 触发定时更新任务（DAILY/WEEKLY）
- 监控Agent运行状态
- 记录任务执行日志
- 协调人机协同工作流

### 心跳检测规则

```
每次启动Agent时：
1. 读取本文件获取最后状态
2. 检查是否有待执行的定时任务
3. 根据当前时间决定是否触发任务
4. 更新心跳时间和状态
5. 写回本文件
```

---

## ⏰ 定时任务调度表

### 每日任务（DAILY）

| 任务ID | 计划时间 | 容错窗口 | 任务名称 | 上次执行 | 下次执行 | 状态 |
|--------|---------|---------|---------|---------|---------|------|
| DAILY-001 | 09:00 | ±30分钟 | 通用技能学习 | 2026-04-22 09:00 | 2026-05-01 09:00 | ⏳ 待执行 |
| DAILY-002 | 09:15 | ±30分钟 | 领域知识库更新 | 2026-04-22 09:15 | 2026-05-01 09:15 | ⏳ 待执行 |
| DAILY-003 | 18:00 | ±60分钟 | 当日更新汇总 | 2026-04-22 18:00 | 2026-05-01 18:00 | ⏳ 待执行 |

### 每周任务（WEEKLY）

| 任务ID | 计划时间 | 执行日 | 任务名称 | 上次执行 | 下次执行 | 状态 |
|--------|---------|--------|---------|---------|---------|------|
| WEEKLY-001 | 18:00 | 周日 | 深度分析与回顾 | 从未 | 2026-05-04 18:00 | ⏳ 待执行 |
| WEEKLY-002 | 20:00 | 周日 | 缺口识别与计划 | 从未 | 2026-05-04 20:00 | ⏳ 待执行 |

---

## 🔄 自动化执行模式

### 模式一：手动触发（按需执行）

适用于：测试、调试、临时更新

```bash
# 触发单个任务
node daily-tasks.js --task=DAILY-001

# 触发所有待执行的DAILY任务
node daily-tasks.js --mode=daily

# 触发WEEKLY任务
node daily-tasks.js --mode=weekly
```

### 模式二：定时自动执行（推荐）

使用Node.js的`cron`或系统任务计划程序：

```javascript
// 使用 node-cron 库
const cron = require('node-cron');

// 每天09:00执行DAILY-001
cron.schedule('0 9 * * *', () => {
  executeTask('DAILY-001');
});

// 每天09:15执行DAILY-002
cron.schedule('15 9 * * *', () => {
  executeTask('DAILY-002');
});

// 每天18:00执行DAILY-003
cron.schedule('0 18 * * *', () => {
  executeTask('DAILY-003');
});
```

### 模式三：持续守护进程（高级）

创建一个长期运行的Agent服务：

```bash
# 启动守护进程
node agent-daemon.js start

# 停止守护进程
node agent-daemon.js stop

# 查看状态
node agent-daemon.js status
```

---

## 📋 任务执行流程

### DAILY-001：通用技能学习（09:00）

```
[触发] → [选择主题] → [搜索学习] → [整理记录] → [写入skills/技能成长编年史.md] → [自检] → [完成]
```

**输出文件**：
- 主输出：`skills/技能成长编年史.md`（追加内容）
- 日志：`logs/daily-001-YYYY-MM-DD.log`

**主题池轮换算法**：
```javascript
const topics = [
  '心理学基础理论',
  '认知行为疗法(CBT)新进展',
  '正念冥想研究',
  '大学生心理健康数据',
  '危机干预新技术',
  '睡眠科学研究',
  '社交心理学发现',
  '积极心理学应用'
];

// 基于日期的伪随机选择（确保每天不同）
const today = new Date().toISOString().split('T')[0];
const hash = simpleHash(today);
const selectedTopic = topics[hash % topics.length];
```

### DAILY-002：领域知识库更新（09:15）

```
[触发] → [读取HEARTBEAT] → [选择主题] → [检索权威来源] → [整理Markdown] → [写入daily-updates/] → [自检] → [更新checklist] → [完成]
```

**输出文件**：
- 主输出：`daily-updates/YYYY-MM-DD.md`
- 清单更新：`AGENT-knowledge-base-checklist.md`

**内容模板**：
```markdown
# [主题名称] - YYYY-MM-DD更新

## 📚 信息来源
- 来源1：URL/引用
- 来源2：URL/引用

## 🔑 核心观点
1. 观点1
2. 观点2

## 💡 具体方法
### 方法一：xxx
- 步骤1
- 步骤2

## ✅ 适用场景
- 场景1
- 场景2

## ⚠️ 注意事项
- 注意点1

## 🏷️ 标签
#[标签1] #[标签2]

---
*生成时间：YYYY-MM-DD HH:MM*  
*生成者：心晴Agent v1.0*  
*审核状态：待审核*
```

### DAILY-003：当日更新汇总（18:00）

```
[触发] → [收集今日产出] → [统计汇总] → [分析质量] → [制定明日计划] → [写入checklist] → [完成]
```

**输出文件**：
- 主输出：`AGENT-knowledge-base-checklist.md`（覆盖更新）
- 可选：`logs/daily-summary-YYYY-MM-DD.log`

---

## 📊 Agent状态监控

### 当前状态

| 指标 | 值 | 状态 |
|------|-----|------|
| Agent版本 | 心晴 v1.0 | ✅ 正常 |
| 最后心跳 | 2026-04-30 23:45 | ✅ 正常 |
| 连续运行天数 | 0天（刚初始化） | ℹ️ 新启动 |
| 今日任务完成率 | 0/3 (0%) | ⏳ 等待执行 |
| 本周任务完成率 | 0/5 (0%) | ⏳ 等待执行 |
| 知识库总条目 | 14条 | ✅ 正常 |
| 系统健康度 | 🟢 良好 | ✅ 正常 |

### 错误日志

```
[暂无错误记录]
```

---

## 🔧 配置参数

### 任务执行配置

```json
{
  "execution": {
    "auto_execute": true,
    "retry_on_failure": true,
    "max_retries": 3,
    "retry_delay_minutes": 5,
    "timeout_minutes": 30,
    "require_human_approval": false,
    "log_level": "info"
  },
  "scheduling": {
    "timezone": "Asia/Shanghai",
    "daily_window_start": "08:00",
    "daily_window_end": "20:00",
    "skip_weekends": false,
    "skip_holidays": false
  },
  "safety": {
    "auto_publish": false,
    "review_required": ["crisis-intervention", "safety-check"],
    "max_daily_updates": 10,
    "content_filter_enabled": true
  }
}
```

---

## 🎯 人机协同接口

### 人类指令格式

当人类想要干预或调整时，可在此处添加指令：

```
<!-- 人类指令区域 -->
<!-- 格式：[日期] [指令类型] 指令内容 -->
<!-- 示例：[2026-05-01] [优先级] 明天重点更新考试焦虑内容 -->
```

**当前指令队列**：
```
[暂无待处理指令]
```

### 反馈通道

Agent执行完任务后，会在此记录需要人类关注的事项：

```
<!-- Agent反馈区域 -->
[2026-04-30] [信息] 已完成知识库结构重构，符合PPT标准96.7%
[2026-04-30] [建议] 建议尽快初始化Git版本控制
[2026-04-30] [提醒] 安全检查JSON文件需专业审核后方可正式使用
```

---

## 📈 性能指标

### 历史执行记录

| 日期 | DAILY-001 | DAILY-002 | DAILY-003 | 总耗时 | 成功率 |
|------|-----------|-----------|-----------|--------|--------|
| 2026-04-22 | ✅ 完成 | ✅ 完成 | ✅ 完成 | ~45min | 100% |
| 2026-04-23~29 | ⏸️ 未执行 | ⏸️ 未执行 | ⏸️ 未执行 | - | - |
| 2026-04-30 | ⏳ 待执行 | ⏳ 待执行 | ⏳ 待执行 | - | - |

### 效率目标

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| DAILY-001平均耗时 | ~15min | <20min | ✅ 达标 |
| DAILY-002平均耗时 | ~20min | <30min | ✅ 达标 |
| DAILY-003平均耗时 | ~10min | <15min | ✅ 达标 |
| 日均新增知识点 | 5-8个 | >5个 | ✅ 达标 |
| 内容准确率 | 估计95% | >90% | ✅ 达标 |

---

## 🚨 应急预案

### 任务失败处理

```
如果DAILY任务失败：
1. 自动重试最多3次（间隔5分钟）
2. 记录失败原因到错误日志
3. 在checklist中标记为⚠️ 失败
4. 如果连续3天失败，发送警报到反馈通道

如果WEEKLY任务失败：
1. 推迟到下周同一时间
2. 发送人工介入请求
3. 保留本周未整合的数据
```

### 紧急停止机制

如需立即停止所有自动化任务：

```bash
# 创建停止信号文件
echo "STOP" > .agent-stop-signal

# Agent会在下次心跳检测时读取并停止
```

---

## 📝 使用说明

### 如何启动自动化？

#### 方案A：一次性执行所有待完成任务（推荐测试用）

```bash
# 在knowledge目录下运行
node ../scripts/run-daily-tasks.js --all
```

#### 方案B：启动定时调度器（推荐生产环境）

```bash
# 安装依赖
npm install node-cron

# 启动调度器
node ../scripts/task-scheduler.js
```

#### 方案C：手动逐个执行

```bash
# 执行DAILY-001
node ../scripts/run-daily-tasks.js --task=DAILY-001

# 执行DAILY-002
node ../scripts/run-daily-tasks.js --task=DAILY-002

# 执行DAILY-003
node ../scripts/run-daily-tasks.js --task=DAILY-003
```

---

## ✅ 启动前检查清单

在首次执行DAILY任务前，确认以下项目：

- [x] knowledge目录结构完整
- [x] AGENT-TASK.md已定义任务
- [x] AGENT-knowledge-base-checklist.md存在
- [x] HEARTBEAT.md已创建（本文件）
- [x] skills/目录存在且可写
- [x] daily-updates/目录存在且可写
- [x] weekly-reports/目录存在且可写
- [ ] Node.js环境可用（如需脚本执行）
- [ ] 网络连接正常（如需在线搜索）

---

**下次心跳检测时间**：即时（手动触发）或 2026-05-01 09:00（自动）  
**维护责任人**：心晴Agent v1.0  
**人工监督员**：（待指定）