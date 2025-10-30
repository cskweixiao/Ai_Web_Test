import type { AxureParseResult } from '../types/axure.js';
import { llmConfigManager } from '../../src/services/llmConfigManager.js';
import type { LLMConfig } from './aiParser.js';
import { ProxyAgent } from 'undici';
import { TestCaseKnowledgeBase } from './testCaseKnowledgeBase.js';

/**
 * 项目信息
 */
export interface ProjectInfo {
  systemName?: string;      // 系统名称
  moduleName?: string;       // 模块名称
  businessRules?: string[];  // 补充业务规则
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
 * 测试点
 */
export interface TestPoint {
  testPoint: string;
  steps: string;
  expectedResult: string;
  riskLevel?: string;
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
  // 新增字段
  testPurpose?: string; // 测试目的
  testPoints?: TestPoint[]; // 测试点数组
  sectionId?: string; // 章节ID (1.1, 1.2)
  sectionName?: string; // 章节名称
  coverageAreas?: string; // 覆盖范围
}

/**
 * 功能测试用例AI生成服务
 */
export class FunctionalTestCaseAIService {
  private useConfigManager: boolean = true;
  private knowledgeBase: TestCaseKnowledgeBase;
  private knowledgeBaseAvailable: boolean = false;

  constructor() {
    console.log('🤖 功能测试用例AI服务已初始化');

    // 初始化知识库服务
    try {
      this.knowledgeBase = new TestCaseKnowledgeBase();
      this.knowledgeBaseAvailable = true;
      console.log('📚 知识库服务已加载（RAG增强模式）');
    } catch (error: any) {
      console.warn('⚠️  知识库服务初始化失败，将降级为普通模式:', error.message);
      this.knowledgeBaseAvailable = false;
      this.knowledgeBase = null as any;
    }
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

    // 回退到默认配置（从环境变量读取）
    const defaultConfig = {
      apiKey: process.env.OPENROUTER_API_KEY || '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',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.DEFAULT_MODEL || 'openai/gpt-4o',
      temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4000')
    };

    // 验证配置有效性
    if (!defaultConfig.apiKey || defaultConfig.apiKey === '') {
      console.error('❌ API Key 未配置！请在 .env 文件中设置 OPENROUTER_API_KEY');
      throw new Error('API Key 未配置，无法调用 AI 服务');
    }

    console.log(`⚠️ 使用默认配置: ${defaultConfig.model}`);
    console.log(`🔑 API Key 来源: ${process.env.OPENROUTER_API_KEY ? '环境变量' : '硬编码回退值'}`);
    return defaultConfig;
  }

  /**
   * 调用AI模型
   */
  private async callAI(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
    const config = await this.getCurrentConfig();

    console.log(`🚀 调用AI模型: ${config.model}`);
    console.log(`📍 API端点: ${config.baseUrl}/chat/completions`);
    console.log(`🔑 API Key状态: ${config.apiKey ? '已设置 (长度: ' + config.apiKey.length + ')' : '❌ 未设置'}`);
    console.log(`🌡️ Temperature: ${config.temperature}, Max Tokens: ${maxTokens || config.maxTokens}`);

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

      console.log(`📤 发送请求到 OpenRouter...`);

      // 配置代理（如果环境变量中有配置）
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': 'https://testflow-ai.com',
          'X-Title': 'TestFlow AI Testing Platform',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      // 如果配置了代理，使用 undici 的 ProxyAgent
      if (proxyUrl) {
        console.log(`🌐 使用代理: ${proxyUrl}`);
        fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
      } else {
        console.log(`📡 直连模式（未配置代理）`);
      }

      const response = await fetch(config.baseUrl + '/chat/completions', fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ AI API错误详情: ${errorText}`);
        console.error(`❌ 请求模型: ${config.model}`);
        console.error(`❌ 请求URL: ${config.baseUrl}/chat/completions`);

        // 区分不同的错误类型
        if (response.status === 401) {
          throw new Error(`❌ 认证失败 (401): API Key无效或已过期。请检查 .env 文件中的 OPENROUTER_API_KEY`);
        } else if (response.status === 429) {
          throw new Error(`❌ 请求限流 (429): API调用频率过高，请稍后重试`);
        } else if (response.status === 402) {
          throw new Error(`❌ 配额不足 (402): OpenRouter账户余额不足，请充值`);
        } else if (response.status === 404) {
          throw new Error(`❌ 模型不存在 (404): 模型 "${config.model}" 在OpenRouter上不可用`);
        } else if (response.status >= 500) {
          throw new Error(`❌ 服务器错误 (${response.status}): OpenRouter服务异常，请稍后重试`);
        } else {
          throw new Error(`AI API调用失败 (${response.status}): ${errorText}`);
        }
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error(`❌ API返回数据格式异常:`, JSON.stringify(data, null, 2));
        throw new Error(`AI API返回格式异常: 缺少 choices 或 message 字段`);
      }

      const content = data.choices[0].message.content;
      console.log(`✅ AI响应成功 (${content.length}字符)`);

      return content;
    } catch (error: any) {
      // 增强错误日志
      if (error.name === 'TypeError' && error.message === 'fetch failed') {
        console.error(`❌ 网络请求失败: 无法连接到 ${config.baseUrl}`);
        console.error(`💡 可能原因:`);
        console.error(`   1. 网络连接问题（请检查网络设置）`);
        console.error(`   2. API端点不可达（请检查防火墙/代理设置）`);
        console.error(`   3. DNS解析失败（请检查DNS配置）`);
        throw new Error(`❌ 网络连接失败: 无法访问 OpenRouter API。请检查网络连接。`);
      }

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
    console.log(`   - 系统名称: ${projectInfo.systemName || '未指定'}`);
    console.log(`   - 模块名称: ${projectInfo.moduleName || '未指定'}`);
    console.log(`   - 业务规则数量: ${projectInfo.businessRules?.length || 0}`);
    console.log(`   - Axure 页面数: ${axureData.pageCount}`);
    console.log(`   - Axure 元素数: ${axureData.elementCount}`);
    console.log(`   - Axure 交互数: ${axureData.interactionCount}\n`);

    // 📄 详细页面信息
    console.log('📄 【步骤 2/5】Axure 页面详情:');
    (axureData.pages || []).forEach((page, index) => {
      console.log(`\n   页面 ${index + 1}: "${page.name || '未命名'}"`);
      console.log(`      - 元素数量: ${(page.elements || []).length}`);
      console.log(`      - 交互数量: ${(page.interactions || []).length}`);

      // 显示前5个元素
      if ((page.elements || []).length > 0) {
        console.log(`      - 主要元素:`);
        (page.elements || []).slice(0, 5).forEach(elem => {
          const displayText = elem.text ? `"${elem.text}"` : (elem.placeholder ? `[${elem.placeholder}]` : (elem.name || '未命名'));
          console.log(`         • ${elem.type}: ${displayText}`);
        });
        if ((page.elements || []).length > 5) {
          console.log(`         ... 还有 ${(page.elements || []).length - 5} 个元素`);
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

📤 输出格式（重要：必须带章节编号）:
---REQUIREMENT_DOC---
# [实际系统名称]需求文档

## 1. [实际模块名称]

### 1.1 [实际页面名称]

#### 1.1.1 查询条件（仅当原型中存在列表页时）
| 字段名 | 控件类型 | 必填 | 默认值 | 说明 | 来源 |
|--------|---------|------|--------|------|------|
（此处填入从原型提取的实际字段，不要写任何占位符）

#### 1.1.2 列表展示字段（仅当原型中存在时）
| 字段名 | 数据类型 | 格式 | 说明 | 来源 |
|--------|---------|------|------|------|
（此处填入从原型提取的实际字段，不要写任何占位符）

#### 1.1.3 操作按钮（仅当原型中存在时）
| 按钮名称 | 位置 | 触发条件 | 操作说明 | 来源 |
|---------|------|---------|---------|------|
（此处填入从原型提取的实际按钮，不要写任何占位符）

#### 1.1.4 表单字段定义（仅当原型中存在表单时）
| 字段名 | 控件类型 | 必填 | 长度/范围 | 默认值 | 选项/说明 | 来源 |
|--------|---------|------|----------|--------|----------|------|
（此处填入从原型提取的实际字段，每一行都必须是真实字段）

#### 1.1.5 操作流程
（描述从原型中观察到的实际操作流程）

#### 1.1.6 校验规则
（列出基于原型推断的实际校验规则）

#### 1.1.7 业务规则
（提取原型中的实际业务规则文案）

### 1.2 [下一个页面名称（如果有）]
（重复1.1的结构）

**重要说明**：
- 每个页面作为一个三级标题（1.1、1.2、1.3...）
- 每个页面下的子章节使用四级标题（1.1.1、1.1.2...）
- 章节编号必须连续且完整
- 每个章节编号将作为后续测试用例生成的批次标识

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
    (axureData.pages || []).forEach(page => {
      (page.elements || [])
        .filter(e => e.type === 'input' || e.type === 'select')
        .forEach(e => {
          if (e.name) {
            allInputElements.push({
              name: e.name,
              type: e.type,
              value: e.value,
              placeholder: e.placeholder,
              page: page.name || '未命名'
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
    (axureData.pages || []).forEach(page => {
      (page.elements || [])
        .filter(e => e.type === 'div' && e.text && e.text.length > 50) // 提取超过50字的div元素
        .forEach(e => {
          // 过滤掉只包含重复数据的文本(如列表数据)
          const text = e.text!.trim();
          if (text.includes('审核') || text.includes('校验') || text.includes('拦截') ||
              text.includes('确认') || text.includes('运费') || text.includes('库存') ||
              text.includes('结算总金额') || text.includes('通过时') || text.includes('拉取')) {
            longTexts.push({
              text: text.substring(0, 500), // 最多取500字
              page: page.name || '未命名'
            });
          }
        });
    });

    const longTextSummary = longTexts.length > 0
      ? `\n📋 【极其重要！！！】原型中的业务规则说明文字 (${longTexts.length}条,必须完整提取到"业务规则"章节):\n${longTexts.map((lt, i) =>
          `${i + 1}. [来源: ${lt.page}] ${lt.text}`
        ).join('\n\n')}\n`
      : '';

    const userPrompt = `系统: ${projectInfo.systemName || '未指定'}
模块: ${projectInfo.moduleName || '未指定'}
${projectInfo.businessRules && projectInfo.businessRules.length > 0 ? '\n业务规则:\n' + projectInfo.businessRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : ''}
${inputSummary}${longTextSummary}
Axure原型解析结果 (${axureData.pageCount || 0}页, ${axureData.elementCount || 0}元素):

${(axureData.pages || []).slice(0, 10).map((page, i) => {
  // 🔍 关键优化: 优先显示所有input/select元素,确保查询条件不会被遗漏
  const inputElements = (page.elements || []).filter(e => e.type === 'input' || e.type === 'select');
  const otherElements = (page.elements || []).filter(e => e.type !== 'input' && e.type !== 'select');

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

  const interactionsDetail = (page.interactions || []).slice(0, 10).map(int =>
    `  - ${int.type}${int.trigger ? `: ${int.trigger}` : ''}`
  ).join('\n');

  return `页面${i + 1}: ${page.name || '未命名'}
📝 输入框/下拉框 (${inputElements.length}个):
${inputDetail || '  无'}

其他元素(${otherElements.length}个):
${otherDetail || '  无'}

交互(${(page.interactions || []).length}):
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
   * 规划分批策略 - 基于需求文档章节
   * @param requirementDoc 需求文档
   */
  async planBatchStrategy(requirementDoc: string): Promise<Batch[]> {
    console.log('📋 开始规划分批策略（基于章节）...');

    // 提取文档中的三级标题（### 1.1、### 1.2 等）
    const chapterRegex = /###\s+([\d.]+)\s+(.+)/g;
    const chapters: Array<{ id: string; name: string }> = [];
    let match;

    while ((match = chapterRegex.exec(requirementDoc)) !== null) {
      chapters.push({
        id: match[1].trim(), // "1.1", "1.2", "1.3"...
        name: match[2].trim() // 页面名称
      });
    }

    if (chapters.length === 0) {
      console.warn('⚠️  未能从需求文档中提取到章节编号，使用回退方案');
      return [
        {
          id: 'section-1',
          name: '完整功能测试',
          priority: 'high',
          scenarios: ['主要功能测试'],
          estimatedCount: 10
        }
      ];
    }

    console.log(`✅ 提取到 ${chapters.length} 个章节:`, chapters.map(c => `${c.id} ${c.name}`).join(', '));

    // 将每个章节转换为一个批次
    const batches: Batch[] = chapters.map((chapter, index) => ({
      id: `section-${chapter.id}`,
      name: `${chapter.id} ${chapter.name}`,
      priority: index === 0 ? 'high' : 'medium', // 第一个章节优先级为high
      scenarios: [chapter.id], // 直接使用章节ID作为场景标识
      estimatedCount: 0 // 将在生成时由AI决定数量
    }));

    console.log(`✅ 规划完成，共 ${batches.length} 个批次（按章节划分）`);
    return batches;
  }

  /**
   * 生成单个批次的测试用例（基于章节）
   */
  async generateBatch(
    batchId: string,
    scenarios: string[], // scenarios[0] 是章节ID (如 "1.1")
    requirementDoc: string,
    existingCases: TestCase[],
    systemName?: string,  // 系统名称
    moduleName?: string   // 模块名称
  ): Promise<TestCase[]> {
    const sectionId = scenarios[0]; // "1.1", "1.2" 等
    console.log(`🤖 开始生成批次 ${batchId}（章节 ${sectionId}），系统: ${systemName || '未指定'}, 模块: ${moduleName || '未指定'}`);

    // 提取该章节的完整内容
    const sectionRegex = new RegExp(`###\\s+${sectionId.replace('.', '\\.')}\\s+(.+?)[\\s\\S]*?(?=###\\s+[\\d.]+\\s+|$)`);
    const sectionMatch = requirementDoc.match(sectionRegex);
    const sectionContent = sectionMatch ? sectionMatch[0] : requirementDoc.substring(0, 3000);
    const sectionName = sectionMatch ? sectionMatch[1].trim() : '功能模块';

    console.log(`📄 提取章节内容 - ${sectionId} ${sectionName} (${sectionContent.length}字符)`);

    // 🔍 查询知识库（RAG增强）
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📚 [知识库RAG] 开始检索相关知识...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let knowledgeContext = '';
    if (this.knowledgeBaseAvailable) {
      try {
        console.log(`🔍 [RAG-Step1] 准备查询参数:`);
        console.log(`   📌 章节名称: "${sectionName}"`);
        console.log(`   📌 内容长度: ${sectionContent.length}字符 (取前500字作为查询上下文)`);
        console.log(`   📌 检索参数: topK=3, scoreThreshold=0.5`);

        const queryText = `${sectionName}\n${sectionContent.substring(0, 500)}`;
        console.log(`   📌 实际查询文本预览: ${queryText.substring(0, 150)}...`);

        console.log(`\n🔍 [RAG-Step2] 调用Qdrant向量数据库进行语义检索...`);
        const queryStartTime = Date.now();

        const knowledgeResults = await this.knowledgeBase.searchByCategory({
          query: queryText,
          topK: 3,
          scoreThreshold: 0.5
        });

        const queryDuration = Date.now() - queryStartTime;
        console.log(`✅ [RAG-Step2] 向量检索完成 (耗时: ${queryDuration}ms)`);

        const totalKnowledge =
          knowledgeResults.businessRules.length +
          knowledgeResults.testPatterns.length +
          knowledgeResults.pitfalls.length +
          knowledgeResults.riskScenarios.length;

        if (totalKnowledge > 0) {
          console.log(`\n📊 [RAG-Step3] 知识检索结果汇总:`);
          console.log(`   ✅ 业务规则: ${knowledgeResults.businessRules.length}条`);
          if (knowledgeResults.businessRules.length > 0) {
            knowledgeResults.businessRules.forEach((r: any, i: number) => {
              console.log(`      ${i+1}. "${r.knowledge.title}" (相似度: ${(r.score * 100).toFixed(1)}%)`);
            });
          }

          console.log(`   ✅ 测试模式: ${knowledgeResults.testPatterns.length}条`);
          if (knowledgeResults.testPatterns.length > 0) {
            knowledgeResults.testPatterns.forEach((r: any, i: number) => {
              console.log(`      ${i+1}. "${r.knowledge.title}" (相似度: ${(r.score * 100).toFixed(1)}%)`);
            });
          }

          console.log(`   ✅ 历史踩坑点: ${knowledgeResults.pitfalls.length}条`);
          if (knowledgeResults.pitfalls.length > 0) {
            knowledgeResults.pitfalls.forEach((r: any, i: number) => {
              console.log(`      ${i+1}. "${r.knowledge.title}" (相似度: ${(r.score * 100).toFixed(1)}%)`);
            });
          }

          console.log(`   ✅ 资损风险场景: ${knowledgeResults.riskScenarios.length}条`);
          if (knowledgeResults.riskScenarios.length > 0) {
            knowledgeResults.riskScenarios.forEach((r: any, i: number) => {
              console.log(`      ${i+1}. "${r.knowledge.title}" (相似度: ${(r.score * 100).toFixed(1)}%)`);
            });
          }

          console.log(`   📈 总计检索到: ${totalKnowledge}条相关知识`);

          console.log(`\n🔧 [RAG-Step4] 格式化知识上下文，准备注入AI提示词...`);
          knowledgeContext = this.buildKnowledgeContext(knowledgeResults);
          console.log(`✅ [RAG-Step4] 知识上下文构建完成 (长度: ${knowledgeContext.length}字符)`);

          console.log(`\n🎯 [RAG模式] 将使用知识库增强模式生成测试用例`);
        } else {
          console.log(`\n⚠️  [RAG-Step3] 未检索到相关知识 (所有知识相似度 < 0.5)`);
          console.log(`   💡 这可能是因为:`);
          console.log(`      - 知识库中没有与"${sectionName}"相关的内容`);
          console.log(`      - 相似度阈值0.5设置过高`);
          console.log(`      - 需要添加更多业务知识到知识库`);
          console.log(`\n🔄 [降级处理] 切换到普通模式生成（不使用知识库增强）`);
        }
      } catch (error: any) {
        console.error(`\n❌ [RAG-Error] 知识库查询异常:`);
        console.error(`   错误类型: ${error.name}`);
        console.error(`   错误信息: ${error.message}`);
        console.error(`   错误堆栈: ${error.stack}`);
        console.warn(`\n🔄 [降级处理] 自动切换到普通模式生成`);
      }
    } else {
      console.log(`⚠️  [RAG状态] 知识库服务未启用`);
      console.log(`   💡 原因: 服务初始化时出现错误（检查Qdrant连接或配置）`);
      console.log(`\n🔄 [降级处理] 使用普通模式生成（不使用知识库增强）`);
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const systemPrompt = `你是一个测试用例设计专家。你的职责是：
1. 根据需求文档的指定章节生成详细的功能测试用例
2. 每个测试用例包含一个测试目的，以及若干个测试点
3. 每个测试点是一个独立的、可验证的测试项
4. 根据需求复杂度决定生成的测试点数量，不要人为限制数量
5. 避免与已存在的测试用例重复

🎯 核心数据结构：
- 一条测试用例 = 一个测试目的 + 多个测试点
- 测试目的：总体测试目标（如"验证订单创建流程"）
- 测试点：具体的测试项（如"正常提交订单"、"库存不足时提交订单"、"超时订单处理"）

📊 测试用例生成规则：
1. 数量不限制：根据需求文档的复杂度自动判断需要多少个测试点
2. 每个测试点必须是原子性的、独立验证的
3. 测试点应覆盖正常流程、异常流程、边界条件
4. 测试点应标注风险等级（low/medium/high）

测试用例结构要求：
- name: 用例名称（格式：[章节ID]-[测试目的]，如"1.1-订单创建"）
- testPurpose: 测试目的（简短描述测试目标）
- system: 所属系统（从需求文档提取）
- module: 所属模块（从需求文档提取）
- sectionId: 章节ID（如"1.1"）
- sectionName: 章节名称（如"订单管理页面"）
- priority: high/medium/low
- tags: 相关标签数组
- coverageAreas: 覆盖范围（功能点列表，逗号分隔）
- testPoints: 测试点数组，每个测试点包含：
  * testPoint: 测试点名称
  * steps: 操作步骤（\\n分隔）
  * expectedResult: 预期结果
  * riskLevel: 风险等级（low/medium/high）
- steps: 汇总的操作步骤（兼容旧格式）
- assertions: 汇总的预期结果（兼容旧格式）
- preconditions: 前置条件（可选）
- testData: 测试数据（可选）
${knowledgeContext}`;

    const existingCaseNames = existingCases.map(tc => tc.name).join('\n- ');

    const userPrompt = `请为以下需求文档章节生成详细的功能测试用例：

## 目标章节
章节ID: ${sectionId}
章节名称: ${sectionName}

## 章节需求内容
${sectionContent}

## 已存在的测试用例（避免重复）
${existingCaseNames || '无'}

## 生成要求
1. 根据需求复杂度决定测试点数量，不要人为限制
2. 每个测试点必须独立且可验证
3. 覆盖正常流程、异常流程、边界条件
4. 标注每个测试点的风险等级
5. 测试用例名称格式：[章节ID]-[测试目的]

请输出JSON格式：
\`\`\`json
{
  "testCases": [
    {
      "name": "${sectionId}-测试目的简述",
      "testPurpose": "测试目的详细描述",
      "system": "系统名",
      "module": "模块名",
      "sectionId": "${sectionId}",
      "sectionName": "${sectionName}",
      "priority": "high",
      "tags": ["标签1", "标签2"],
      "coverageAreas": "功能点1,功能点2,功能点3",
      "testPoints": [
        {
          "testPoint": "测试点1：具体测试项",
          "steps": "1. 操作步骤1\\n2. 操作步骤2",
          "expectedResult": "预期结果描述",
          "riskLevel": "high"
        },
        {
          "testPoint": "测试点2：具体测试项",
          "steps": "1. 操作步骤1\\n2. 操作步骤2",
          "expectedResult": "预期结果描述",
          "riskLevel": "medium"
        }
      ],
      "steps": "汇总的操作步骤（用于兼容旧格式）",
      "assertions": "汇总的预期结果（用于兼容旧格式）",
      "preconditions": "前置条件",
      "testData": "测试数据"
    }
  ]
}
\`\`\`

💡 提示：根据需求文档内容决定测试点数量，简单页面可能3-5个测试点，复杂流程可能需要10-20个测试点。`;

    try {
      console.log(`\n🤖 [AI生成] 准备调用大模型生成测试用例...`);
      console.log(`   📝 系统提示词长度: ${systemPrompt.length} 字符`);
      console.log(`   📝 用户提示词长度: ${userPrompt.length} 字符`);

      if (knowledgeContext) {
        console.log(`   ✅ 已注入知识库上下文 (${knowledgeContext.length}字符)`);
        console.log(`   💡 AI将基于知识库内容生成更专业的测试用例`);
      } else {
        console.log(`   ⚠️  未注入知识库上下文，使用普通模式生成`);
      }

      console.log(`\n🚀 [AI生成] 正在调用大模型API (GPT-4o via OpenRouter)...`);
      const aiStartTime = Date.now();

      const aiResponse = await this.callAI(systemPrompt, userPrompt, 8000);

      const aiDuration = Date.now() - aiStartTime;
      console.log(`✅ [AI生成] 大模型响应完成 (耗时: ${aiDuration}ms, 响应长度: ${aiResponse.length}字符)`);

      // 解析AI响应
      let jsonText = aiResponse.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      const testCases: TestCase[] = parsed.testCases || [];

      // 补充章节信息和系统模块信息
      testCases.forEach(tc => {
        tc.sectionId = sectionId;
        tc.sectionName = sectionName;

        // 自动填充系统名称和模块名称
        if (systemName) {
          tc.system = systemName;
        }
        if (moduleName) {
          tc.module = moduleName;
        }

        // 如果没有testPoints，从steps和assertions生成一个默认测试点
        if (!tc.testPoints || tc.testPoints.length === 0) {
          tc.testPoints = [{
            testPoint: tc.testPurpose || tc.name,
            steps: tc.steps,
            expectedResult: tc.assertions,
            riskLevel: 'medium'
          }];
        }
      });

      console.log(`✅ AI生成批次${batchId}完成，共${testCases.length}个用例，总计${testCases.reduce((sum, tc) => sum + (tc.testPoints?.length || 0), 0)}个测试点`);
      return testCases;

    } catch (error: any) {
      console.error(`❌ 批次${batchId}生成失败，使用回退方案:`, error.message);
      // 回退到简单生成
      return [{
        name: `${sectionId}-${sectionName}`,
        testPurpose: `验证${sectionName}的基本功能`,
        description: `针对${sectionName}的功能测试(AI生成失败，回退到基础模板)`,
        steps: `1. 准备测试环境和数据\n2. 执行${sectionName}相关操作\n3. 观察系统响应\n4. 验证结果`,
        assertions: `1. ${sectionName}执行成功\n2. 系统响应正确\n3. 数据状态符合预期`,
        priority: 'medium',
        tags: [sectionName, '自动生成', 'AI回退'],
        system: '待补充',
        module: '待补充',
        sectionId,
        sectionName,
        testPoints: [{
          testPoint: '基本功能测试',
          steps: `1. 准备测试环境和数据\n2. 执行${sectionName}相关操作`,
          expectedResult: '功能正常运行',
          riskLevel: 'medium'
        }],
        testType: '功能测试'
      }];
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
   * 构建知识库上下文（RAG增强）
   */
  private buildKnowledgeContext(knowledgeResults: {
    businessRules: any[];
    testPatterns: any[];
    pitfalls: any[];
    riskScenarios: any[];
  }): string {
    console.log(`\n🔧 [RAG-格式化] 开始构建知识上下文，准备注入AI提示词...`);

    let context = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    context += '📚 【知识库增强】以下是从企业知识库检索到的相关测试知识：\n';
    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    let totalKnowledgeAdded = 0;

    // 业务规则
    if (knowledgeResults.businessRules.length > 0) {
      console.log(`   📋 [类别1/4] 添加业务规则 ${knowledgeResults.businessRules.length} 条:`);
      context += '\n## 📋 业务规则参考\n';
      context += '（生成测试用例时必须符合这些业务规则）\n\n';
      knowledgeResults.businessRules.forEach((result, i) => {
        const knowledge = result.knowledge;
        const similarity = (result.score * 100).toFixed(1);
        console.log(`      - "${knowledge.title}" (${similarity}%, ${knowledge.content.length}字符)`);
        context += `**${i + 1}. ${knowledge.title}** (相似度: ${similarity}%)\n`;
        context += `${knowledge.content}\n\n`;
        totalKnowledgeAdded++;
      });
    } else {
      console.log(`   📋 [类别1/4] 业务规则: 无匹配`);
    }

    // 测试模式
    if (knowledgeResults.testPatterns.length > 0) {
      console.log(`   🎯 [类别2/4] 添加测试模式 ${knowledgeResults.testPatterns.length} 条:`);
      context += '\n## 🎯 测试模式参考\n';
      context += '（参考这些测试模式设计测试点，确保覆盖全面）\n\n';
      knowledgeResults.testPatterns.forEach((result, i) => {
        const knowledge = result.knowledge;
        const similarity = (result.score * 100).toFixed(1);
        console.log(`      - "${knowledge.title}" (${similarity}%, ${knowledge.content.length}字符)`);
        context += `**${i + 1}. ${knowledge.title}** (相似度: ${similarity}%)\n`;
        context += `${knowledge.content}\n\n`;
        totalKnowledgeAdded++;
      });
    } else {
      console.log(`   🎯 [类别2/4] 测试模式: 无匹配`);
    }

    // 历史踩坑点
    if (knowledgeResults.pitfalls.length > 0) {
      console.log(`   ⚠️  [类别3/4] 添加历史踩坑点 ${knowledgeResults.pitfalls.length} 条 (高优先级):`);
      context += '\n## ⚠️  历史踩坑点（必须覆盖）\n';
      context += '（这些是历史上发生过的bug，测试用例中必须包含这些场景以避免重复犯错）\n\n';
      knowledgeResults.pitfalls.forEach((result, i) => {
        const knowledge = result.knowledge;
        const similarity = (result.score * 100).toFixed(1);
        console.log(`      - "${knowledge.title}" (${similarity}%, ${knowledge.content.length}字符)`);
        context += `**${i + 1}. ${knowledge.title}** (相似度: ${similarity}%)\n`;
        context += `${knowledge.content}\n\n`;
        totalKnowledgeAdded++;
      });
    } else {
      console.log(`   ⚠️  [类别3/4] 历史踩坑点: 无匹配`);
    }

    // 资损风险场景
    if (knowledgeResults.riskScenarios.length > 0) {
      console.log(`   🔥 [类别4/4] 添加资损风险场景 ${knowledgeResults.riskScenarios.length} 条 (最高优先级):`);
      context += '\n## 🔥 资损风险场景（优先级最高）\n';
      context += '（这些场景可能导致资金损失或安全问题，必须优先测试并标记为high风险等级）\n\n';
      knowledgeResults.riskScenarios.forEach((result, i) => {
        const knowledge = result.knowledge;
        const similarity = (result.score * 100).toFixed(1);
        console.log(`      - "${knowledge.title}" (${similarity}%, ${knowledge.content.length}字符)`);
        context += `**${i + 1}. ${knowledge.title}** (相似度: ${similarity}%)\n`;
        context += `${knowledge.content}\n\n`;
        totalKnowledgeAdded++;
      });
    } else {
      console.log(`   🔥 [类别4/4] 资损风险场景: 无匹配`);
    }

    context += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    context += '💡 请基于以上知识库内容生成更专业、更全面的测试用例\n';
    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    console.log(`✅ [RAG-格式化] 知识上下文构建完成:`);
    console.log(`   📊 总计添加 ${totalKnowledgeAdded} 条知识`);
    console.log(`   📏 上下文总长度: ${context.length} 字符`);
    console.log(`   💡 这些知识将被注入到AI系统提示词中，引导生成更专业的测试用例\n`);

    return context;
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
