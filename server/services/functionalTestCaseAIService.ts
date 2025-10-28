import type { AxureParseResult } from '../types/axure.js';
import { llmConfigManager } from '../../src/services/llmConfigManager.js';
import type { LLMConfig } from './aiParser.js';

/**
 * 项目信息
 */
export interface ProjectInfo {
  projectName: string;
  systemType: string;
  businessDomain: string;
  businessRules: string[];
  constraints: string[];
  description: string;
}

/**
 * 批次信息
 */
export interface Batch {
  id: string;
  name: string;
  priority: string;
  scenarios: string[];
  estimatedCount: number;
}

/**
 * 测试用例
 */
export interface TestCase {
  name: string;
  description: string;
  steps: string;
  assertions: string;
  priority: string;
  tags: string[];
  system: string;
  module: string;
  testType?: string;
  preconditions?: string;
  testData?: string;
}

/**
 * 功能测试用例AI生成服务
 */
export class FunctionalTestCaseAIService {
  private useConfigManager: boolean = true;

  constructor() {
    console.log('🤖 功能测试用例AI服务已初始化');
  }

  /**
   * 初始化配置管理器
   */
  private async initializeConfigManager(): Promise<void> {
    try {
      if (!llmConfigManager.isReady()) {
        await llmConfigManager.initialize();
      }
      console.log('🔧 功能测试用例AI服务配置已加载');
    } catch (error) {
      console.error('❌ 配置管理器初始化失败:', error);
      this.useConfigManager = false;
    }
  }

  /**
   * 获取当前LLM配置
   */
  private async getCurrentConfig(): Promise<LLMConfig> {
    if (this.useConfigManager) {
      try {
        if (!llmConfigManager.isReady()) {
          await Promise.race([
            this.initializeConfigManager(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('配置管理器初始化超时')), 5000)
            )
          ]);
        }

        if (llmConfigManager.isReady()) {
          const config = llmConfigManager.getCurrentConfig();
          console.log(`🔧 使用配置管理器配置: ${config.model}`);
          return config;
        }
      } catch (error: any) {
        console.error('❌ 配置管理器初始化失败，回退到默认配置:', error.message);
        this.useConfigManager = false;
      }
    }

    // 回退到默认配置
    const defaultConfig = {
      apiKey: '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',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 4000
    };
    console.log(`⚠️ 使用默认配置: ${defaultConfig.model}`);
    return defaultConfig;
  }

  /**
   * 调用AI模型
   */
  private async callAI(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
    const config = await this.getCurrentConfig();

    console.log(`🚀 调用AI模型: ${config.model}`);

    try {
      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: config.temperature,
        max_tokens: maxTokens || config.maxTokens
      };

      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': 'https://testflow-ai.com',
          'X-Title': 'TestFlow AI Testing Platform',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ AI API错误详情: ${errorText}`);
        console.error(`❌ 请求模型: ${config.model}`);
        console.error(`❌ 请求URL: ${config.baseUrl}/chat/completions`);
        throw new Error(`AI API调用失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error(`AI API返回格式异常: ${JSON.stringify(data)}`);
      }

      const content = data.choices[0].message.content;
      console.log(`✅ AI响应成功 (${content.length}字符)`);

      return content;
    } catch (error: any) {
      console.error(`❌ AI调用失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成需求文档
   * @param axureData Axure解析结果
   * @param projectInfo 项目信息
   */
  async generateRequirementDoc(
    axureData: AxureParseResult,
    projectInfo: ProjectInfo
  ): Promise<{ requirementDoc: string; completeness: number; suggestions: string[] }> {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           🤖 开始生成需求文档 - 详细日志模式                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // 📊 输入数据日志
    console.log('📊 【步骤 1/5】输入数据统计:');
    console.log(`   - 项目名称: ${projectInfo.projectName}`);
    console.log(`   - 系统类型: ${projectInfo.systemType}`);
    console.log(`   - 业务领域: ${projectInfo.businessDomain}`);
    console.log(`   - 项目描述: ${projectInfo.description.substring(0, 100)}${projectInfo.description.length > 100 ? '...' : ''}`);
    console.log(`   - 业务规则数量: ${projectInfo.businessRules.length}`);
    console.log(`   - 约束条件数量: ${projectInfo.constraints.length}`);
    console.log(`   - Axure 页面数: ${axureData.pageCount}`);
    console.log(`   - Axure 元素数: ${axureData.elementCount}`);
    console.log(`   - Axure 交互数: ${axureData.interactionCount}\n`);

    // 📄 详细页面信息
    console.log('📄 【步骤 2/5】Axure 页面详情:');
    axureData.pages.forEach((page, index) => {
      console.log(`\n   页面 ${index + 1}: "${page.name}"`);
      console.log(`      - 元素数量: ${page.elements.length}`);
      console.log(`      - 交互数量: ${page.interactions.length}`);

      // 显示前5个元素
      if (page.elements.length > 0) {
        console.log(`      - 主要元素:`);
        page.elements.slice(0, 5).forEach(elem => {
          const displayText = elem.text ? `"${elem.text}"` : (elem.placeholder ? `[${elem.placeholder}]` : (elem.name || '未命名'));
          console.log(`         • ${elem.type}: ${displayText}`);
        });
        if (page.elements.length > 5) {
          console.log(`         ... 还有 ${page.elements.length - 5} 个元素`);
        }
      }
    });
    console.log('');

    const systemPrompt = `你是需求分析专家，基于Axure原型生成详细的功能需求文档。

🚨 核心原则（必须严格遵守）:
1. 严格基于用户上传的实际原型内容，禁止编造任何字段或功能
2. 每个功能、字段都必须注明来源：(来源: 页面名-元素名)
3. 不确定的部分必须标注[待确认]或[推断]
4. 主业务页面为主，弹窗/导航归属到主页面
5. 🚫 绝对禁止输出任何示例占位符或自己编造的字段名

📋 必须包含的内容:

**一、页面结构（仅当原型中存在时才写）**
- 查询条件：
  * ⚠️ 绝对优先规则：type="input"或type="select"的元素就是查询条件！
  * 🔍 识别步骤：
    1. 先扫描所有type="input"和type="select"元素
    2. 如果元素有name属性，name就是查询条件字段名
    3. 把所有这些字段都列为查询条件，不要管字段名是否在列表中出现
  * 🚫 绝对禁止：不要把input/select类型的元素判断为列表字段
  * 📝 判断规则速查表：
    - type="input" + name="客户名称" → 查询条件: 客户名称
    - type="select" + name="订单状态" → 查询条件: 订单状态
    - type="input" + name="渠道集采订单号" → 查询条件: 渠道集采订单号（即使列表中也有这个字段名）
    - type="div" + text="JC2025090212300100001" → 列表字段: 渠道集采订单号（这是显示的数据值）
  * 🎯 执行要求：先找出所有input/select，全部归类为查询条件，然后再处理列表字段

- 列表展示字段：
  * 仅从type="div"的元素中提取
  * 这些是用来显示数据的只读区域，不是输入框
  * 如果某个字段名已经在查询条件中出现过，在列表中就不要重复写了

- 操作按钮：从type="button"的元素中提取

**二、表单详细定义（仅当原型中存在表单时才写）**
从原型中逐个提取每个字段的:
- 实际字段名称 (来源: 页面名-label文字)
- 控件类型 (输入框/下拉/单选/多选/日期选择器)
- 是否必填 (通过查找"*"标记确定)
- 数据类型和长度限制 (从"0/100"等字样提取)
- 默认值 (如原型中有)
- 选项内容 (单选/多选按钮的实际选项列表)
- 提示文字/占位符

**三、操作流程与交互**
从原型中提取:
- 按钮操作的实际行为
- 二次确认弹窗的实际提示文案
- 成功/失败反馈的实际消息

**四、校验规则**
基于原型内容推断:
- 必填校验：标有"*"的字段
- 格式校验：根据字段类型推断
- 长度限制：从原型中提取
- 数值范围：根据业务场景推断

**五、业务规则 (🚨 极其重要！！！)**
⚠️ **必须从原型中完整提取所有业务规则说明文字**,这些文字通常是长段落的文本,包含:
- 计算规则(如"结算总金额=商品价格之和+运费")
- 流程规则(如"审核通过时,需要...")
- 校验规则(如"需要校验库存是否能扣减成功")
- 拦截规则(如"当存在商品运费拉取失败时,需要拦截...")
- 状态变化规则(如"超时未上传则自动终止")
🎯 **提取要求**:
1. 逐字逐句完整提取,不要遗漏任何一条规则
2. 保持原文表述,不要改写或简化
3. 每条规则都必须注明来源
4. 特别关注包含"审核"、"校验"、"拦截"、"确认"、"运费"、"库存"、"结算总金额"等关键词的长文本段落

📤 输出格式:
---REQUIREMENT_DOC---
# [实际系统名称]需求文档

## 1. [实际模块名称]
### 1.1 [实际页面名称]

#### 查询条件（仅当原型中存在列表页时）
| 字段名 | 控件类型 | 必填 | 默认值 | 说明 | 来源 |
|--------|---------|------|--------|------|------|
（此处填入从原型提取的实际字段，不要写任何占位符）

#### 列表展示字段（仅当原型中存在时）
| 字段名 | 数据类型 | 格式 | 说明 | 来源 |
|--------|---------|------|------|------|
（此处填入从原型提取的实际字段，不要写任何占位符）

#### 操作按钮（仅当原型中存在时）
| 按钮名称 | 位置 | 触发条件 | 操作说明 | 来源 |
|---------|------|---------|---------|------|
（此处填入从原型提取的实际按钮，不要写任何占位符）

#### 表单字段定义（仅当原型中存在表单时）
| 字段名 | 控件类型 | 必填 | 长度/范围 | 默认值 | 选项/说明 | 来源 |
|--------|---------|------|----------|--------|----------|------|
（此处填入从原型提取的实际字段，每一行都必须是真实字段）

#### 操作流程
（描述从原型中观察到的实际操作流程）

#### 校验规则
（列出基于原型推断的实际校验规则）

#### 业务规则
（提取原型中的实际业务规则文案）

---COMPLETENESS---
（0-1评分，评估原型信息完整度）
---SUGGESTIONS---
（列出缺少的信息）

🚫 严格禁止:
1. 不要输出任何示例占位符(如带中括号的内容)
2. 不要编造任何原型中不存在的内容
3. 表格中的每一行都必须是从原型中实际提取的内容
4. 如果原型中没有某个章节的内容，就跳过该章节，不要生成示例
5. 所有字段名、按钮文本都必须从原型中提取，不要自己创造`;

    // 🎯 关键优化: 提前收集所有input/select元素,确保查询条件完整展示给AI
    const allInputElements: Array<{name?: string; type: string; value?: string; placeholder?: string; page: string}> = [];
    axureData.pages.forEach(page => {
      page.elements
        .filter(e => e.type === 'input' || e.type === 'select')
        .forEach(e => {
          if (e.name) {
            allInputElements.push({
              name: e.name,
              type: e.type,
              value: e.value,
              placeholder: e.placeholder,
              page: page.name
            });
          }
        });
    });

    const inputSummary = allInputElements.length > 0
      ? `\n🔍 【重要】原型中的所有输入框/下拉框 (${allInputElements.length}个,这些必须全部作为查询条件):\n${allInputElements.map((inp, i) =>
          `${i + 1}. ${inp.type}: name="${inp.name}"${inp.value ? `, value="${inp.value}"` : ''}${inp.placeholder ? `, placeholder="${inp.placeholder}"` : ''} (来源: ${inp.page})`
        ).join('\n')}\n`
      : '';

    // 🎯 关键优化2: 提取所有长文本段落(可能包含重要的业务规则说明)
    const longTexts: Array<{text: string; page: string}> = [];
    axureData.pages.forEach(page => {
      page.elements
        .filter(e => e.type === 'div' && e.text && e.text.length > 50) // 提取超过50字的div元素
        .forEach(e => {
          // 过滤掉只包含重复数据的文本(如列表数据)
          const text = e.text!.trim();
          if (text.includes('审核') || text.includes('校验') || text.includes('拦截') ||
              text.includes('确认') || text.includes('运费') || text.includes('库存') ||
              text.includes('结算总金额') || text.includes('通过时') || text.includes('拉取')) {
            longTexts.push({
              text: text.substring(0, 500), // 最多取500字
              page: page.name
            });
          }
        });
    });

    const longTextSummary = longTexts.length > 0
      ? `\n📋 【极其重要！！！】原型中的业务规则说明文字 (${longTexts.length}条,必须完整提取到"业务规则"章节):\n${longTexts.map((lt, i) =>
          `${i + 1}. [来源: ${lt.page}] ${lt.text}`
        ).join('\n\n')}\n`
      : '';

    const userPrompt = `项目: ${projectInfo.projectName} (${projectInfo.systemType} - ${projectInfo.businessDomain})
描述: ${projectInfo.description}
${projectInfo.businessRules.length > 0 ? '\n业务规则:\n' + projectInfo.businessRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : ''}
${projectInfo.constraints.length > 0 ? '\n约束:\n' + projectInfo.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n') : ''}
${inputSummary}${longTextSummary}
Axure原型解析结果 (${axureData.pageCount}页, ${axureData.elementCount}元素):

${axureData.pages.slice(0, 10).map((page, i) => {
  // 🔍 关键优化: 优先显示所有input/select元素,确保查询条件不会被遗漏
  const inputElements = page.elements.filter(e => e.type === 'input' || e.type === 'select');
  const otherElements = page.elements.filter(e => e.type !== 'input' && e.type !== 'select');

  // 构建元素详情: 先显示所有输入框,再显示其他元素
  const inputDetail = inputElements.map(e => {
    if (e.name) return `  - ${e.type}: name="${e.name}"${e.value ? `, value="${e.value}"` : ''}${e.placeholder ? `, placeholder="${e.placeholder}"` : ''}`;
    if (e.placeholder) return `  - ${e.type}: [${e.placeholder}]`;
    return `  - ${e.type}`;
  }).join('\n');

  const otherDetail = otherElements.slice(0, 15).map(e => {
    if (e.text) return `  - ${e.type}: "${e.text}"`;
    if (e.placeholder) return `  - ${e.type}: [${e.placeholder}]`;
    if (e.name) return `  - ${e.type}: ${e.name}`;
    return `  - ${e.type}`;
  }).join('\n');

  const elementsDetail = [inputDetail, otherDetail].filter(d => d).join('\n');

  const interactionsDetail = page.interactions.slice(0, 10).map(int =>
    `  - ${int.type}${int.trigger ? `: ${int.trigger}` : ''}`
  ).join('\n');

  return `页面${i + 1}: ${page.name}
📝 输入框/下拉框 (${inputElements.length}个):
${inputDetail || '  无'}

其他元素(${otherElements.length}个):
${otherDetail || '  无'}

交互(${page.interactions.length}):
${interactionsDetail || '  无'}`;
}).join('\n\n')}

${axureData.pageCount > 10 ? `\n(还有${axureData.pageCount - 10}个页面未展示)` : ''}

🚨 重要提醒:
1. 上面显示的所有元素和文字都是真实的原型内容
2. 你必须使用这些实际内容（如上面显示的按钮文本、输入框标签等）
3. 🚫 绝对禁止使用示例占位符，如[字段1]、[字段2]、[商品名称]、[库存数量]等
4. 如果原型中没有某类内容，就跳过该章节，不要编造
5. 严格按照上面的实际原型内容生成，按业务模块划分
6. 弹窗归属主页面，导航不单独描述
7. 所有字段必须标注来源`;

    // 🚀 构建完整的 Prompt 日志
    console.log('🚀 【步骤 3/5】构建 AI Prompt:');
    console.log(`   - System Prompt 长度: ${systemPrompt.length} 字符`);
    console.log(`   - User Prompt 长度: ${userPrompt.length} 字符`);
    console.log(`   - 总 Token 估算: ~${Math.ceil((systemPrompt.length + userPrompt.length) / 4)} tokens\n`);

    // 保存完整的 prompt 到日志（可选，用于调试）
    if (process.env.LOG_FULL_PROMPT === 'true') {
      console.log('📝 完整 User Prompt:\n');
      console.log('---BEGIN USER PROMPT---');
      console.log(userPrompt);
      console.log('---END USER PROMPT---\n');
    }

    try {
      console.log('📡 【步骤 4/5】调用 AI 模型...');
      const startTime = Date.now();

      const aiResponse = await this.callAI(systemPrompt, userPrompt, 8000);

      const duration = Date.now() - startTime;
      console.log(`✅ AI 响应完成 (耗时: ${duration}ms, 响应长度: ${aiResponse.length} 字符)\n`);

      // 📋 解析 AI 响应
      console.log('📋 【步骤 5/5】解析 AI 响应:');

      const docMatch = aiResponse.match(/---REQUIREMENT_DOC---([\s\S]*?)---COMPLETENESS---/);
      const completenessMatch = aiResponse.match(/---COMPLETENESS---\s*([\d.]+)/);
      const suggestionsMatch = aiResponse.match(/---SUGGESTIONS---([\s\S]*?)$/);

      const requirementDoc = docMatch ? docMatch[1].trim() : aiResponse;
      const completeness = completenessMatch ? parseFloat(completenessMatch[1]) : 0.8;
      const suggestions = suggestionsMatch
        ? suggestionsMatch[1].trim().split('\n').filter(s => s.trim()).map(s => s.replace(/^[-*]\s*/, ''))
        : ['请人工审核需求文档', '补充异常流程说明', '补充非功能性需求'];

      console.log(`   ✓ 需求文档提取成功 (${requirementDoc.length} 字符)`);
      console.log(`   ✓ 完整度评分: ${(completeness * 100).toFixed(1)}%`);
      console.log(`   ✓ 建议数量: ${suggestions.length} 条\n`);

      // 检查是否包含示例占位符（质量检查）
      const hasPlaceholders = /\[字段\d+\]|\[商品名称\]|\[库存数量\]|\[审核意见\]/.test(requirementDoc);
      if (hasPlaceholders) {
        console.warn('⚠️  警告: 检测到示例占位符，需求文档质量可能不佳！');
      } else {
        console.log('✅ 质量检查通过: 未检测到示例占位符');
      }

      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║              ✅ 需求文档生成成功                              ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      return { requirementDoc, completeness, suggestions };
    } catch (error: any) {
      console.error('\n❌ 【错误】需求文档生成失败:');
      console.error(`   错误类型: ${error.name}`);
      console.error(`   错误消息: ${error.message}`);
      if (error.stack) {
        console.error(`   错误堆栈:\n${error.stack}`);
      }
      console.error('\n🔄 使用回退方案生成模拟文档...\n');

      // 回退到模拟实现
      const requirementDoc = this.buildMockRequirementDoc(axureData, projectInfo);
      return {
        requirementDoc,
        completeness: 0.7,
        suggestions: ['AI服务暂时不可用，请人工审核此文档']
      };
    }
  }

  /**
   * 规划分批策略
   * @param requirementDoc 需求文档
   */
  async planBatchStrategy(requirementDoc: string): Promise<Batch[]> {
    console.log('📋 开始规划分批策略...');

    const systemPrompt = `你是一个测试用例设计专家。你的职责是：
1. 分析功能需求文档
2. 识别核心测试场景并进行优先级分类
3. 规划合理的测试用例生成批次策略
4. 避免单批次token过载，确保每批次场景数适中(建议3-8个场景)

批次划分原则：
- 核心正向流程优先级最高(high)
- 异常流程和边界条件中等优先级(medium)
- 非核心功能和扩展功能较低优先级(low)
- 每批次场景应具有相关性，便于统一生成`;

    const userPrompt = `请根据以下需求文档规划测试用例生成批次：

${requirementDoc}

请输出JSON格式的批次规划，格式如下：
\`\`\`json
{
  "batches": [
    {
      "id": "batch-1",
      "name": "批次名称",
      "priority": "high/medium/low",
      "scenarios": ["场景1", "场景2", "场景3"],
      "estimatedCount": 5
    }
  ]
}
\`\`\`

要求：
1. 至少2个批次，最多5个批次
2. 每批次3-8个场景
3. 优先级分布合理
4. estimatedCount是该批次预计生成的测试用例数量`;

    try {
      const aiResponse = await this.callAI(systemPrompt, userPrompt, 2000);

      // 解析AI响应
      let jsonText = aiResponse.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      const batches: Batch[] = parsed.batches || [];

      console.log(`✅ AI规划完成，共${batches.length}个批次`);
      return batches;

    } catch (error: any) {
      console.error('❌ 批次规划失败，使用回退方案:', error.message);
      // 回退到默认批次
      return [
        {
          id: 'batch-1',
          name: '核心正常流程',
          priority: 'high',
          scenarios: ['主要功能操作', '数据提交', '查询功能'],
          estimatedCount: 5
        },
        {
          id: 'batch-2',
          name: '异常流程',
          priority: 'medium',
          scenarios: ['错误输入处理', '权限验证', '边界条件'],
          estimatedCount: 4
        }
      ];
    }
  }

  /**
   * 生成单个批次的测试用例
   */
  async generateBatch(
    batchId: string,
    scenarios: string[],
    requirementDoc: string,
    existingCases: TestCase[]
  ): Promise<TestCase[]> {
    console.log(`🤖 开始生成批次 ${batchId}，场景数：${scenarios.length}`);

    const systemPrompt = `你是一个测试用例设计专家。你的职责是：
1. 根据需求文档和测试场景生成详细的功能测试用例
2. 每个测试用例应包含清晰的步骤、预期结果和优先级
3. 避免与已存在的测试用例重复
4. 确保用例可执行、可验证

测试用例结构要求：
- name: 简洁明确的用例名称
- description: 详细的测试目标说明
- steps: 详细的操作步骤(用\\n分隔每个步骤)
- assertions: 预期结果和验证点(用\\n分隔每个验证点)
- priority: high/medium/low
- tags: 相关标签数组
- system: 所属系统
- module: 所属模块
- preconditions: 前置条件(可选)
- testData: 测试数据(可选)`;

    const existingCaseNames = existingCases.map(tc => tc.name).join('\n- ');

    const userPrompt = `请为以下测试场景生成详细的功能测试用例：

## 测试场景
${scenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 需求文档(参考)
${requirementDoc.substring(0, 2000)}...

## 已存在的测试用例(避免重复)
${existingCaseNames || '无'}

请为每个场景生成1-2个测试用例，输出JSON格式：
\`\`\`json
{
  "testCases": [
    {
      "name": "用例名称",
      "description": "用例描述",
      "steps": "1. 步骤1\\n2. 步骤2\\n3. 步骤3",
      "assertions": "1. 验证点1\\n2. 验证点2",
      "priority": "high",
      "tags": ["标签1", "标签2"],
      "system": "系统名",
      "module": "模块名",
      "preconditions": "前置条件",
      "testData": "测试数据"
    }
  ]
}
\`\`\``;

    try {
      const aiResponse = await this.callAI(systemPrompt, userPrompt, 3000);

      // 解析AI响应
      let jsonText = aiResponse.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      const testCases: TestCase[] = parsed.testCases || [];

      console.log(`✅ AI生成批次${batchId}完成，共${testCases.length}个用例`);
      return testCases;

    } catch (error: any) {
      console.error(`❌ 批次${batchId}生成失败，使用回退方案:`, error.message);
      // 回退到简单生成
      return scenarios.map((scenario, index) => ({
        name: `TC-${batchId}-${index + 1}: ${scenario}`,
        description: `针对${scenario}的功能测试(AI生成失败，回退到基础模板)`,
        steps: `1. 准备测试环境和数据\n2. 执行${scenario}相关操作\n3. 观察系统响应\n4. 验证结果`,
        assertions: `1. ${scenario}执行成功\n2. 系统响应正确\n3. 数据状态符合预期`,
        priority: 'medium',
        tags: [scenario, '自动生成', 'AI回退'],
        system: '待补充',
        module: '待补充',
        testType: '功能测试'
      }));
    }
  }

  /**
   * 重新生成指定用例
   */
  async regenerateCases(
    originalCases: TestCase[],
    instruction: string,
    requirementDoc: string
  ): Promise<TestCase[]> {
    console.log(`🔄 重新生成${originalCases.length}个用例，指令: ${instruction}`);

    const systemPrompt = `你是一个测试用例优化专家。你的职责是：
1. 根据用户的优化指令改进现有测试用例
2. 保持用例的核心测试目标不变
3. 根据指令优化步骤、验证点、优先级等
4. 确保优化后的用例更完善、更易执行

常见优化指令类型：
- "补充边界条件" - 添加更多边界值测试
- "增强步骤描述" - 让步骤更详细清晰
- "增加异常场景" - 补充异常流程验证
- "调整优先级" - 重新评估优先级
- "细化验证点" - 增加更具体的验证项`;

    const originalCasesList = originalCases.map((tc, i) => `
### 用例 ${i + 1}: ${tc.name}
**描述**: ${tc.description}
**步骤**:
${tc.steps}
**验证点**:
${tc.assertions}
**优先级**: ${tc.priority}
**标签**: ${tc.tags.join(', ')}
`).join('\n');

    const userPrompt = `请根据以下优化指令改进测试用例：

## 优化指令
"${instruction}"

## 原始测试用例
${originalCasesList}

## 需求文档(参考)
${requirementDoc.substring(0, 1500)}...

请输出优化后的测试用例，保持JSON格式：
\`\`\`json
{
  "testCases": [
    {
      "name": "用例名称",
      "description": "用例描述",
      "steps": "1. 步骤1\\n2. 步骤2",
      "assertions": "1. 验证点1\\n2. 验证点2",
      "priority": "high/medium/low",
      "tags": ["标签"],
      "system": "系统名",
      "module": "模块名"
    }
  ]
}
\`\`\``;

    try {
      const aiResponse = await this.callAI(systemPrompt, userPrompt, 3000);

      // 解析AI响应
      let jsonText = aiResponse.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      const newCases: TestCase[] = parsed.testCases || [];

      console.log(`✅ AI重新生成完成，共${newCases.length}个用例`);
      return newCases;

    } catch (error: any) {
      console.error(`❌ 重新生成失败，使用回退方案:`, error.message);
      // 回退到简单优化
      const newCases = originalCases.map(tc => ({
        ...tc,
        steps: tc.steps + '\n' + this.getOptimizationStep(instruction),
        assertions: tc.assertions + '\n' + this.getOptimizationAssertion(instruction),
        tags: [...tc.tags, instruction.substring(0, 10)]
      }));

      console.log(`✅ 回退方案重新生成完成`);
      return newCases;
    }
  }

  /**
   * 根据指令生成优化步骤(回退方案)
   */
  private getOptimizationStep(instruction: string): string {
    if (instruction.includes('边界')) {
      return '5. 验证边界值输入情况';
    } else if (instruction.includes('异常')) {
      return '5. 执行异常场景测试';
    } else if (instruction.includes('详细') || instruction.includes('细化')) {
      return '5. 补充详细操作说明';
    }
    return '5. 根据指令补充测试步骤';
  }

  /**
   * 根据指令生成优化验证点(回退方案)
   */
  private getOptimizationAssertion(instruction: string): string {
    if (instruction.includes('边界')) {
      return '5. 边界值处理符合预期';
    } else if (instruction.includes('异常')) {
      return '5. 异常情况得到正确处理';
    } else if (instruction.includes('详细') || instruction.includes('细化')) {
      return '5. 所有验证点均通过';
    }
    return '5. 补充验证项符合要求';
  }

  /**
   * 构建模拟需求文档（临时实现）
   */
  private buildMockRequirementDoc(axureData: AxureParseResult, projectInfo: ProjectInfo): string {
    return `# ${projectInfo.projectName} 需求文档

## 一、项目概述

- **项目名称**: ${projectInfo.projectName}
- **系统类型**: ${projectInfo.systemType}
- **业务领域**: ${projectInfo.businessDomain}

## 二、原型分析

通过分析Axure原型文件，识别出以下关键信息：

- **页面数量**: ${axureData.pageCount}个
- **交互元素**: ${axureData.elementCount}个
- **交互行为**: ${axureData.interactionCount}个

## 三、功能模块划分

${axureData.pages.map((page, i) => `
### ${i + 1}. ${page.name}

**主要元素**:
${page.elements.slice(0, 5).map(e => `- ${e.type}: ${e.name || e.text || e.placeholder || '未命名'}`).join('\n')}

**交互行为**:
${page.interactions.slice(0, 3).map(int => `- ${int.type}: ${int.trigger}`).join('\n')}
`).join('\n')}

## 四、业务规则

${projectInfo.businessRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

## 五、约束条件

${projectInfo.constraints.map((constraint, i) => `${i + 1}. ${constraint}`).join('\n')}

---
*本文档由AI自动生成，请人工审核确认*
`;
  }
}

export const functionalTestCaseAIService = new FunctionalTestCaseAIService();
