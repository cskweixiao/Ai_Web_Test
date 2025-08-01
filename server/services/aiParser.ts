import { PlaywrightMcpClient } from './mcpClient.js';
import { llmConfigManager, LLMConfigManager } from '../../src/services/llmConfigManager.js';

// AI配置接口
export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AIParseResult {
  success: boolean;
  steps: TestStep[];
  error?: string;
}

export interface AINextStepParseResult {
  success: boolean;
  step?: TestStep;
  remaining?: string;
  error?: string;
}

export interface TestStep {
  id: string;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  url?: string;
  condition?: string;
  text?: string;
  timeout?: number;
  element?: string;  // 🔥 新增：元素的人类可读描述
  ref?: string;      // 🔥 新增：元素的精确引用
  stepType?: 'operation' | 'assertion';  // 🔥 新增：步骤类型标记
}

export interface MCPCommand {
  name: string;
  arguments: Record<string, any>;
}

export class AITestParser {
  private mcpClient: PlaywrightMcpClient;
  private configManager: LLMConfigManager;
  private useConfigManager: boolean;

  constructor(mcpClient: PlaywrightMcpClient, llmConfig?: LLMConfig) {
    this.mcpClient = mcpClient;
    this.configManager = llmConfigManager;

    // 如果提供了llmConfig，使用传统模式；否则使用配置管理器
    this.useConfigManager = !llmConfig;

    if (llmConfig) {
      // 传统模式：使用传入的配置
      console.log('🤖 AI解析器启用 (传统模式)，模型:', llmConfig.model);
    } else {
      // 配置管理器模式：使用动态配置
      console.log('🤖 AI解析器启用 (配置管理器模式) - 延迟初始化');
      // 🔥 修复：不在构造函数中进行异步初始化，避免阻塞服务启动
      // 配置管理器将在首次使用时进行初始化
    }
  }

  /**
   * 初始化配置管理器
   */
  private async initializeConfigManager(): Promise<void> {
    try {
      if (!this.configManager.isReady()) {
        await this.configManager.initialize();
      }

      const summary = this.configManager.getConfigSummary();
      console.log(`🔧 AI解析器配置已加载: ${summary.modelName} (${summary.provider})`);
      console.log(`   温度: ${summary.temperature}, 最大令牌: ${summary.maxTokens}`);

      // 监听配置变更
      this.configManager.addConfigChangeListener((event) => {
        console.log(`🔄 AI解析器配置已更新: ${event.type} - ${event.modelInfo.name}`);
        if (event.type === 'model_changed') {
          console.log(`   模型切换: ${event.oldConfig?.model || '未知'} → ${event.newConfig.model}`);
        }
      });

    } catch (error) {
      console.error('❌ AI解析器配置管理器初始化失败:', error);
      // 回退到默认配置
      this.useConfigManager = false;
    }
  }

  /**
   * 获取当前LLM配置
   */
  private async getCurrentConfig(): Promise<LLMConfig> {
    if (this.useConfigManager) {
      // 🔥 修复：添加超时和错误处理，避免配置管理器卡住整个服务
      try {
        // 如果配置管理器还没准备好，等待初始化完成（带超时）
        if (!this.configManager.isReady()) {
          console.log('⏳ 配置管理器未就绪，开始初始化...');
          
          // 使用Promise.race添加超时机制
          await Promise.race([
            this.initializeConfigManager(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('配置管理器初始化超时')), 5000)
            )
          ]);
        }

        if (this.configManager.isReady()) {
          const config = this.configManager.getCurrentConfig();
          console.log(`🔧 使用配置管理器配置: ${config.model}`);
          return config;
        }
      } catch (error) {
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
      maxTokens: 1500
    };
    console.log(`⚠️ 使用默认配置: ${defaultConfig.model}`);
    return defaultConfig;
  }

  /**
   * 重新加载配置（无需重启服务）
   */
  public async reloadConfiguration(): Promise<void> {
    if (this.useConfigManager) {
      try {
        await this.configManager.reloadConfig();
        const summary = this.configManager.getConfigSummary();
        console.log(`🔄 AI解析器配置已重新加载: ${summary.modelName}`);
      } catch (error) {
        console.error('❌ 重新加载AI解析器配置失败:', error);
      }
    } else {
      console.log('⚠️ AI解析器使用传统模式，无法重新加载配置');
    }
  }

  /**
   * 获取当前模型信息（用于日志和调试）
   */
  public getCurrentModelInfo(): { modelName: string; provider: string; mode: string } {
    if (this.useConfigManager && this.configManager.isReady()) {
      const summary = this.configManager.getConfigSummary();
      return {
        modelName: summary.modelName,
        provider: summary.provider,
        mode: '配置管理器模式'
      };
    } else {
      // 回退到默认配置信息
      return {
        modelName: 'openai/gpt-4o',
        provider: '未知',
        mode: '传统模式'
      };
    }
  }

  /**
   * 检查配置管理器是否可用
   */
  public isConfigManagerMode(): boolean {
    return this.useConfigManager && this.configManager.isReady();
  }

  /**
   * 基于MCP快照和用例描述，AI解析为可执行的步骤
   */
  async parseTestDescription(description: string, testName: string, runId: string, snapshot: any | null): Promise<AIParseResult> {
    try {
      // 将用例描述分割为步骤
      const steps = this.splitDescriptionToSteps(description);
      return { success: true, steps };
    } catch (error) {
      return { success: false, steps: [], error: `解析测试描述失败: ${error}` };
    }
  }

  /**
   * AI根据当前快照和下一条指令生成MCP命令
   */
  async parseNextStep(remainingStepsText: string, snapshot: any | null, runId: string): Promise<AINextStepParseResult> {
    try {
      // 🔥 增强日志：打印完整的剩余步骤
      console.log(`\n🔍 [${runId}] ===== AI解析步骤开始 =====`);
      console.log(`📋 [${runId}] 剩余步骤文本:\n${remainingStepsText}`);

      if (!remainingStepsText?.trim()) {
        console.log(`❌ [${runId}] 没有剩余步骤，解析结束`);
        return { success: false, error: "没有剩余步骤" };
      }

      // 🔥 修复：更智能的步骤分割，处理数字编号的步骤
      const lines = remainingStepsText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        console.log(`❌ [${runId}] 没有有效步骤，解析结束`);
        return { success: false, error: "没有有效步骤" };
      }

      // 🔥 增强日志：打印所有拆分的步骤
      console.log(`📊 [${runId}] 拆分后的步骤数量: ${lines.length}`);
      lines.forEach((line, index) => {
        console.log(`   ${index + 1}. "${line}"`);
      });

      // 🔥 修复：确保正确提取当前步骤并计算剩余步骤
      let nextStepText = lines[0].trim();

      // 🔥 增强：移除各种步骤编号格式（中文标点、英文标点、无标点等）
      // 匹配模式：数字 + 可选的标点符号(、。.：:) + 可选空格
      nextStepText = nextStepText.replace(/^(?:\d+\s*[、。\.\)\:]?\s*|步骤\s*\d+\s*[、。\.\)\:]?\s*)/i, '').trim();

      console.log(`🔄 [${runId}] 原始步骤: "${lines[0]}"`);
      console.log(`🔄 [${runId}] 清理后步骤: "${nextStepText}"`);

      // 🔥 关键修复：确保剩余步骤正确计算
      const remaining = lines.slice(1).join('\n').trim();

      console.log(`🎯 [${runId}] 当前解析步骤: "${nextStepText}"`);
      console.log(`📊 [${runId}] 剩余步骤数: ${lines.length - 1}`);
      console.log(`📋 [${runId}] 剩余步骤内容: "${remaining}"`)

      // 🔥 增强日志：打印页面快照状态
      if (snapshot) {
        const snapshotLines = snapshot.split('\n');
        console.log(`📸 [${runId}] 页面快照状态: ${snapshotLines.length}行`);

        // 提取页面URL和标题
        const urlMatch = snapshot.match(/Page URL: ([^\n]+)/);
        const titleMatch = snapshot.match(/Page Title: ([^\n]+)/);

        if (urlMatch) console.log(`   🌐 URL: ${urlMatch[1]}`);
        if (titleMatch) console.log(`   📄 标题: ${titleMatch[1]}`);

        // 统计元素
        const elementTypes = ['textbox', 'button', 'link', 'input', 'checkbox', 'radio', 'combobox'];
        const foundTypes = elementTypes
          .map(type => {
            const count = (snapshot.match(new RegExp(type, 'g')) || []).length;
            return count > 0 ? `${type}(${count})` : null;
          })
          .filter(Boolean);

        if (foundTypes.length > 0) {
          console.log(`   🔍 页面元素: ${foundTypes.join(', ')}`);
        } else {
          console.log(`   ⚠️ 未在快照中发现常见交互元素`);
        }
      } else {
        console.log(`⚠️ [${runId}] 无页面快照可用，将使用默认解析策略`);
      }

      // AI模拟：基于当前步骤文本和快照生成MCP命令
      const mcpCommand = await this.generateMCPCommand(nextStepText, snapshot);

      // 🔥 增强日志：打印解析结果
      console.log(`🤖 [${runId}] AI解析结果:`);
      console.log(`   🎯 操作类型: ${mcpCommand.name}`);
      console.log(`   📋 参数: ${JSON.stringify(mcpCommand.arguments, null, 2)}`);

      const step: TestStep = {
        id: `step-${Date.now()}`,
        action: mcpCommand.name,
        description: nextStepText,
        stepType: 'operation',  // 🔥 标记为操作步骤
        ...mcpCommand.arguments
      };

      console.log(`✅ [${runId}] AI解析步骤完成: ${step.action} - ${step.description}`);
      console.log(`📋 [${runId}] 返回剩余步骤: "${remaining}"`);
      console.log(`🔍 [${runId}] ===== AI解析步骤结束 =====\n`);

      // 🔥 关键修复：确保返回正确的剩余步骤
      return { success: true, step, remaining: remaining || '' };
    } catch (error) {
      console.error(`❌ [${runId}] AI解析步骤失败: ${error}`);
      return { success: false, error: `解析下一步骤失败: ${error}` };
    }
  }

  /**
   * AI根据快照和断言描述生成断言命令
   */
  async parseAssertions(assertionsText: string, snapshot: any, runId: string): Promise<AIParseResult> {
    try {
      if (!assertionsText?.trim()) {
        return { success: true, steps: [] };
      }

      const assertionLines = assertionsText.split('\n').filter(line => line.trim());
      const steps: TestStep[] = [];

      for (let i = 0; i < assertionLines.length; i++) {
        const assertionText = assertionLines[i].trim();
        const mcpCommand = await this.generateAssertionCommand(assertionText, snapshot);

        steps.push({
          id: `assertion-${i + 1}`,
          action: mcpCommand.name,
          description: assertionText,
          stepType: 'assertion',  // 🔥 标记为断言步骤
          ...mcpCommand.arguments
        });
      }

      return { success: true, steps };
    } catch (error) {
      return { success: false, steps: [], error: `解析断言失败: ${error}` };
    }
  }

  /**
   * 将用例描述分割为步骤
   */
  private splitDescriptionToSteps(description: string): TestStep[] {
    if (!description?.trim()) return [];

    const lines = description.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      action: 'pending', // 待AI解析
      description: line,
      order: index + 1
    }));
  }

  /**
   * 🔥 真正的AI解析：根据步骤描述和快照生成MCP命令
   */
  private async generateMCPCommand(stepDescription: string, snapshot: any): Promise<MCPCommand> {
    console.log(`🤖 使用AI解析: "${stepDescription}"`);

    try {
      // 1. 提取页面元素
      const pageElements = this.extractPageElements(snapshot);

      // 2. 构建AI提示词
      const prompt = this.buildAIPrompt(stepDescription, pageElements);

      // 3. 调用AI模型
      const aiResponse = await this.callLLM(prompt);

      // 4. 解析AI响应
      const mcpCommand = this.parseAIResponse(aiResponse);

      console.log(`✅ AI解析成功: ${mcpCommand.name}`);
      return mcpCommand;

    } catch (error: any) {
      console.error(`❌ AI解析失败: ${error.message}`);
      throw new Error(`AI解析失败: ${error.message}`);
    }
  }

  /**
   * 🔥 真正的AI解析：根据断言描述和快照生成断言命令
   */
  private async generateAssertionCommand(assertionDescription: string, snapshot: any): Promise<MCPCommand> {
    console.log(`🤖 使用AI解析断言: "${assertionDescription}"`);

    try {
      // 1. 提取页面元素
      const pageElements = this.extractPageElements(snapshot);

      // 2. 构建断言专用的AI提示词
      const prompt = this.buildAssertionPrompt(assertionDescription, pageElements);

      // 3. 调用AI模型
      const aiResponse = await this.callLLM(prompt);

      // 4. 解析AI响应
      const mcpCommand = this.parseAIResponse(aiResponse);

      console.log(`✅ AI断言解析成功: ${mcpCommand.name}`);
      return mcpCommand;

    } catch (error: any) {
      console.error(`❌ AI断言解析失败: ${error.message}`);
      throw new Error(`AI断言解析失败: ${error.message}`);
    }
  }

  /**
   * 🔥 提取页面元素用于AI分析
   */
  private extractPageElements(snapshot: string): Array<{ ref: string, role: string, text: string }> {
    if (!snapshot) return [];

    const elements: Array<{ ref: string, role: string, text: string }> = [];
    const lines = snapshot.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      const refMatch = trimmedLine.match(/\[ref=([a-zA-Z0-9_-]+)\]/);

      if (refMatch) {
        const ref = refMatch[1];
        const textMatches = trimmedLine.match(/"([^"]*)"/g) || [];
        const texts = textMatches.map(t => t.replace(/"/g, ''));

        let role = '';
        if (trimmedLine.includes('textbox')) role = 'textbox';
        else if (trimmedLine.includes('button')) role = 'button';
        else if (trimmedLine.includes('link')) role = 'link';
        else if (trimmedLine.includes('checkbox')) role = 'checkbox';
        else if (trimmedLine.includes('combobox')) role = 'combobox';
        else role = 'element';

        if (ref && texts.length > 0) {
          elements.push({ ref, role, text: texts[0] || '' });
        }
      }
    }

    return elements.slice(0, 10); // 取前10个最重要的元素
  }

  /**
   * 🔥 [V3] 构建"操作"专用的AI提示词 (全面增强版)
   */
  private buildAIPrompt(stepDescription: string, pageElements: Array<{ ref: string, role: string, text: string }>): string {
    const elementsContext = pageElements.length > 0
      ? pageElements.map(el => `[ref=${el.ref}] ${el.role} "${el.text}"`).join('\n')
      : "当前页面没有可用的交互元素。";

    return `你是一个顶级的测试自动化AI专家。你的任务是将用户的自然语言【操作指令】，基于当前页面上的元素，转换为一个精确的JSON格式的MCP【操作命令】。

**⚠️ 重要提醒**：
- 你现在处于【操作模式】，只处理明确的操作指令（如"点击登录"、"输入用户名"、"滚动页面"）
- 如果用户的指令看起来像是断言或验证（如"登入失败"、"显示错误"、"页面跳转"等），而不是具体的操作指令，请返回错误信息
- 只有明确的操作指令（如"点击登录"、"输入用户名"、"滚动页面"）才应该被转换为MCP命令

你的思考过程必须遵循以下步骤：
1.  **分析意图**: 理解用户的核心操作目标（如点击、输入、悬停、获取文本等）。如果这不是一个明确的操作指令，而是断言或状态描述，请返回错误。
2.  **定位元素**: 如果操作需要页面元素，根据指令描述在"当前页面可用元素"列表中找到最匹配的元素，并记下其ref。
3.  **生成element描述**: 为选中的元素创建一个简洁的人类可读描述（如"用户名输入框"、"登录按钮"、"搜索框"等）。
4.  **处理变量**: 检查指令中是否要使用变量（格式为 \${variable_name}）或要将结果存入变量。
5.  **构建命令**: 根据分析结果，从"支持的MCP操作命令"列表中选择一个最合适的命令，并填充参数。
6.  **输出结果**: 严格按照指定的格式输出。

**重要说明**：
- element参数：必须是简洁的中文描述，说明这个元素是什么（如"用户名输入框"、"提交按钮"）
- ref参数：必须使用从页面元素列表中找到的确切ref值（如"e18"、"e25"）
- 两个参数都是必需的，缺一不可

---
[当前页面可用元素]
${elementsContext}

---
[支持的MCP操作命令]
# 核心交互
- 点击: {"name": "browser_click", "args": {"element": "人类可读的元素描述", "ref": "element_ref"}}
- 双击: {"name": "browser_double_click", "args": {"element": "人类可读的元素描述", "ref": "element_ref"}}
- 悬停: {"name": "browser_hover", "args": {"element": "人类可读的元素描述", "ref": "element_ref"}}
- 输入: {"name": "browser_type", "args": {"element": "人类可读的输入框描述", "ref": "input_ref", "text": "content"}}
- 清空输入框: {"name": "browser_clear_input", "args": {"element": "人类可读的输入框描述", "ref": "input_ref"}}
- 选择下拉选项: {"name": "browser_select_option", "args": {"element": "人类可读的下拉框描述", "ref": "select_ref", "value": "option_value"}}
- 按键: {"name": "browser_press_key", "args": {"key": "Enter"}}

# 页面与滚动
- 导航: {"name": "browser_navigate", "args": {"url": "URL"}}
- 滚动到元素: {"name": "browser_scroll_to_element", "args": {"element": "人类可读的元素描述", "ref": "element_ref"}}
- 滚动页面: {"name": "browser_scroll_page", "args": {"direction": "down"}}
- 刷新: {"name": "browser_refresh", "args": {}}
- 后退: {"name": "browser_go_back", "args": {}}
- 前进: {"name": "browser_go_forward", "args": {}}

# 数据提取 (存入变量)
- 获取文本: {"name": "browser_get_text", "args": {"element": "人类可读的元素描述", "ref": "element_ref", "variable_name": "my_var"}}
- 获取属性: {"name": "browser_get_attribute", "args": {"element": "人类可读的元素描述", "ref": "element_ref", "attribute": "href", "variable_name": "my_var"}}
- 获取URL: {"name": "browser_get_url", "args": {"variable_name": "my_var"}}

# 高级控制
- 等待: {"name": "browser_wait_for", "args": {"timeout": milliseconds}}
- 截图: {"name": "browser_screenshot", "args": {}}
- 切换到iframe: {"name": "browser_switch_to_frame", "args": {"element": "人类可读的iframe描述", "ref": "iframe_ref"}}
- 切换回主页面: {"name": "browser_switch_to_default", "args": {}}
- 处理弹窗: {"name": "browser_handle_alert", "args": {"action": "accept"}}

---
[输出格式要求]
<THOUGHTS>
这里是你的分步思考过程。
</THOUGHTS>
<COMMAND>
{
  "name": "...",
  "args": {...}
}
</COMMAND>

---
[用户操作指令]
"${stepDescription}"

请开始分析和转换：`;
  }

  /**
   * 🔥 [V4] 构建"断言"专用的AI提示词 (修复版)
   */
  private buildAssertionPrompt(assertionDescription: string, pageElements: Array<{ ref: string, role: string, text: string }>): string {
    const elementsContext = pageElements.length > 0
      ? pageElements.map(el => `[ref=${el.ref}] ${el.role} "${el.text}"`).join('\n')
      : "当前页面没有可用的交互元素。";

    return `你是一个顶级的测试自动化AI专家。你的任务是将用户的自然语言【断言指令】，基于当前页面上的元素，转换为一个精确的JSON格式的MCP【断言命令】。

**⚠️ 重要说明**：
- 你现在处于【断言验证模式】，不是操作模式
- 用户提供的是断言描述（如"页面展示商品管理"、"显示错误信息"、"页面跳转成功"等），这些都是需要验证的状态
- 断言的目标是验证页面当前状态是否符合预期，不是执行操作

你的思考过程必须遵循以下步骤：
1.  **分析断言类型**: 理解用户要验证什么（文本存在、元素可见性、页面内容、URL地址等）。
2.  **确定验证策略**: 选择最合适的验证方法（快照分析、等待文本、截图验证等）。
3.  **定位相关元素**: 如果断言涉及特定页面元素，在"当前页面可用元素"列表中找到最匹配的元素。
4.  **构建验证命令**: 根据分析结果，选择最合适的MCP命令来实现验证。
5.  **输出结果**: 严格按照指定的格式输出。

**断言验证原则**：
- 对于文本内容验证：使用browser_snapshot获取页面状态，在应用层检查文本
- 对于元素可见性验证：使用browser_snapshot或browser_wait_for
- 对于页面状态验证：使用browser_snapshot进行全面检查
- 对于视觉验证：使用browser_take_screenshot保存证据

---
[当前页面可用元素]
${elementsContext}

---
[支持的MCP断言命令]
# 重要说明：由于Playwright MCP不提供专门的断言工具，我们使用以下策略：

# 1. 快照验证（推荐）- 获取页面完整状态供应用层分析
- 获取页面快照: {"name": "browser_snapshot", "args": {}}

# 2. 等待验证 - 等待特定条件出现或消失
- 等待文本出现: {"name": "browser_wait_for", "args": {"text": "期望的文本内容"}}
- 等待文本消失: {"name": "browser_wait_for", "args": {"textGone": "不应该存在的文本"}}
- 等待元素可见: {"name": "browser_wait_for", "args": {"ref": "element_ref", "state": "visible"}}

# 3. 截图验证 - 保存视觉证据
- 截取页面截图: {"name": "browser_take_screenshot", "args": {"filename": "assertion_proof.png"}}

# 执行流程：
# 1. 使用browser_snapshot获取页面状态
# 2. 在应用层解析快照内容进行断言判断
# 3. 可选：使用browser_take_screenshot保存验证截图

---
[输出格式要求]
<THOUGHTS>
这里是你的分步思考过程。
</THOUGHTS>
<COMMAND>
{
  "name": "...",
  "args": {...}
}
</COMMAND>

---
[用户断言指令]
"${assertionDescription}"

请开始分析和转换：`;
  }

  /**
   * 🔥 调用AI模型
   */
  private async callLLM(prompt: string): Promise<string> {
    // 获取当前配置
    const currentConfig = await this.getCurrentConfig();
    const modelInfo = this.getCurrentModelInfo();

    console.log(`🚀 调用AI模型: ${modelInfo.modelName} (${modelInfo.provider})`);
    console.log(`   模型标识: ${currentConfig.model}`);
    console.log(`   温度: ${currentConfig.temperature}, 最大令牌: ${currentConfig.maxTokens}`);
    console.log(`   运行模式: ${modelInfo.mode}`);

    try {
      const requestBody = {
        model: currentConfig.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: currentConfig.temperature,
        max_tokens: currentConfig.maxTokens
      };

      const response = await fetch(currentConfig.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentConfig.apiKey}`,
          'HTTP-Referer': 'https://testflow-ai.com',
          'X-Title': 'TestFlow AI Testing Platform',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API调用失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error(`AI API返回格式异常: ${JSON.stringify(data)}`);
      }

      const content = data.choices[0].message.content;

      if (!content || content.trim() === '') {
        throw new Error('AI返回空响应');
      }

      console.log(`🤖 AI响应: ${content}`);
      return content;

    } catch (error: any) {
      const modelInfo = this.getCurrentModelInfo();
      console.error(`❌ AI调用失败: ${modelInfo.modelName} (${modelInfo.provider})`);
      console.error(`   错误详情: ${error.message}`);
      console.error(`   模型标识: ${currentConfig.model}`);
      console.error(`   运行模式: ${modelInfo.mode}`);

      // 增强错误信息
      if (error.message.includes('401')) {
        console.error(`   💡 建议: 请检查API密钥是否有效`);
      } else if (error.message.includes('429')) {
        console.error(`   💡 建议: API调用频率超限，请稍后重试`);
      } else if (error.message.includes('fetch')) {
        console.error(`   💡 建议: 请检查网络连接`);
      }

      throw error;
    }
  }

  /**
   * 🔥 解析AI响应为MCP命令 (支持V3格式)
   */
  private parseAIResponse(aiResponse: string): MCPCommand {
    try {
      console.log(`🔍 开始解析AI响应: ${aiResponse.substring(0, 200)}...`);

      let jsonText = aiResponse.trim();

      // 🔥 检查是否包含错误信息（在<THOUGHTS>或其他地方）
      if (jsonText.includes('<ERROR>') || jsonText.includes('用户指令不是具体的操作指令')) {
        // 提取错误信息
        const errorMatch = jsonText.match(/<ERROR>(.*?)<\/ERROR>/s) ||
          jsonText.match(/用户指令不是具体的操作指令[，。]?(.*)$/s);
        const errorMsg = errorMatch ? errorMatch[1].trim() : '用户指令不是具体的操作指令';
        console.log(`⚠️ AI返回错误信息: ${errorMsg}`);
        throw new Error(`AI解析失败: ${errorMsg}`);
      }

      // 🔥 V3格式: 尝试提取<COMMAND>标签中的内容
      const commandMatch = jsonText.match(/<COMMAND>\s*([\s\S]*?)\s*<\/COMMAND>/i);
      if (commandMatch) {
        jsonText = commandMatch[1].trim();
        console.log(`✅ 从<COMMAND>标签中提取JSON: ${jsonText}`);
      } else {
        // 🔥 兼容旧格式: 如果响应包含代码块，提取其中的JSON
        const codeBlockMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
          console.log(`✅ 从代码块中提取JSON: ${jsonText}`);
        } else {
          // 🔥 兼容旧格式: 尝试提取JSON对象
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
            console.log(`✅ 直接提取JSON对象: ${jsonText}`);
          } else {
            // 🔥 如果没有找到JSON，但包含<THOUGHTS>，说明AI没有按格式返回
            if (jsonText.includes('<THOUGHTS>')) {
              console.error(`❌ AI返回包含<THOUGHTS>但缺少<COMMAND>标签`);
              throw new Error('AI响应格式错误：包含思考过程但缺少命令部分');
            }
          }
        }
      }

      if (!jsonText || jsonText.trim() === '') {
        throw new Error('无法从AI响应中提取有效的JSON内容');
      }

      console.log(`🔍 最终解析的JSON: ${jsonText}`);

      // 🔥 新增：检查是否是错误响应
      if (jsonText.includes('"error"') && !jsonText.includes('"name"')) {
        const errorObj = JSON.parse(jsonText);
        if (errorObj.error) {
          console.log(`⚠️ AI返回错误信息: ${errorObj.error}`);
          throw new Error(`AI解析失败: ${errorObj.error}`);
        }
      }

      const parsed = JSON.parse(jsonText);

      // 验证基本结构
      if (!parsed.name || !parsed.args) {
        throw new Error('AI响应缺少必需的name或args字段');
      }

      console.log(`✅ AI响应解析成功: ${parsed.name}`);
      return {
        name: parsed.name,
        arguments: parsed.args
      };

    } catch (error: any) {
      console.error(`❌ AI响应解析失败: ${error.message}`);
      console.error(`📄 原始响应: ${aiResponse}`);
      throw new Error(`AI响应解析失败: ${error.message}`);
    }
  }
}