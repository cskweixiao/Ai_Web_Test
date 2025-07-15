import { PlaywrightMcpClient } from './mcpClient.js';
import type { TestStep } from '../../src/types/test.js';

export interface AIParseResult {
  success: boolean;
  steps: TestStep[];
  error?: string;
  rawResponse?: string; // 添加原始响应字段
  parsedDetails?: any; // 添加解析细节
}

export interface AINextStepParseResult {
  success: boolean;
  step?: TestStep;
  remaining?: string;
  error?: string;
  rawResponse?: string; // 添加原始响应字段
}

export class AITestParser {
  private readonly OPENROUTER_API_KEY = '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';
  private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly mcpClient: PlaywrightMcpClient;
  private lastRemainingSteps: string = '';

  constructor(mcpClient: PlaywrightMcpClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * 使用GPT-4o解析自然语言测试描述
   */
  async parseTestDescription(description: string, testName: string, runId: string, snapshot: any | null): Promise<AIParseResult> {
    try {
      console.log(`[${runId}] 🧠 AI开始解析测试描述:`, description);

      const prompt = await this.buildPrompt(description, testName, snapshot);
      const response = await this.callOpenRouter(prompt, runId);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI调用失败或返回内容为空');
      }

      const steps = this.parseAIResponse(response.content, runId);
      
      console.log(`[${runId}] ✅ AI解析完成，生成${steps.length}个测试步骤`);
      
      // 返回更详细的结果，包括原始响应
      return {
        success: true,
        steps,
        rawResponse: response.content,
        parsedDetails: {
          stepCount: steps.length,
          actions: steps.map(s => s.action),
          parseTimestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      console.error(`[${runId}] ❌ AI解析失败:`, error);
      return {
        success: false,
        steps: [],
        error: error.message
      };
    }
  }

  /**
   * 构建优化的Prompt - 针对Playwright MCP优化
   */
  private async buildPrompt(description: string, testName: string, snapshot: any | null): Promise<string> {
    const pageContext = snapshot ? await this.buildPageContext(snapshot) : '页面快照不可用。';

    return `你是一个专业的Playwright MCP自动化测试专家。请将以下自然语言描述转换为结构化的测试步骤。

测试用例名称: ${testName}
测试描述: ${description}

${pageContext}

要求:
1. 分析描述中的每个操作，转换为具体的Playwright MCP测试步骤。
2. **严格使用提供的页面快照信息**来生成精确的选择器。
3. 如果生成的选择器在快照中匹配到多个元素，必须细化选择器直到它唯一匹配一个元素。
4. 自动修复URL中的错误(如"2www."改为"www.")
5. 优先使用Playwright推荐的选择器策略。
6. 返回严格的JSON数组格式，不要任何其他文字。

支持的Playwright MCP操作类型:
- navigate: 打开网页
- click: 点击元素
- fill: 输入文本 (对应playwright的fill)
- type: 逐字符输入 (对应playwright的type)
- expect: 验证元素存在/可见/包含文本等
- wait: 等待指定时间或条件
- screenshot: 截图
- hover: 悬停
- drag: 拖拽元素
- select_option: 下拉选择
- file_upload: 文件上传
- press_key: 按键操作
- scroll: 滚动页面

每个步骤的JSON格式:
{
  "id": "step-N",
  "action": "操作类型",
  "selector": "选择器(优先使用Playwright语法)",
  "url": "网址(navigate时使用)",
  "value": "输入值(fill/type时使用)",
  "text": "期望文本(expect时使用)",
  "condition": "验证条件(expect时使用)",
  "timeout": 等待时间毫秒(wait时使用),
  "key": "按键名称(press_key时使用)",
  "position": "滚动位置(scroll时使用: top/bottom/center)",
  "files": "文件路径数组(file_upload时使用)",
  "description": "步骤描述",
  "order": 步骤序号
}

🔥 **重要提示**: 
1.  **导航后必须加等待**：在 \`navigate\` 操作之后，请务必紧跟一个 \`wait\` 步骤（例如等待3秒），确保页面有足够时间加载完成，否则后续步骤会因为找不到元素而失败。
2.  **复杂操作分解**：将包含多个动作的步骤（如"输入密码并点击登录"）分解为多个独立的步骤。

Playwright MCP推荐选择器策略 (按优先级排序):
1. **文本定位器**: 
   - 按钮: "button:has-text('登录')" 或 "text=登录"
   - 链接: "a:has-text('商品管理')" 或 "text=商品管理"
   - 任意元素: ":has-text('错误信息')"

2. **角色定位器**:
   - "role=button[name='提交']"
   - "role=textbox[name='用户名']"
   - "role=link[name='首页']"

3. **属性定位器**:
   - "data-testid=submit-btn"
   - "placeholder=请输入用户名"
   - "[name='username']"
   - "#login-form"

4. **组合选择器**:
   - "form >> input[placeholder='密码']"
   - ".nav-menu >> text=设置"
   - "#sidebar >> role=button[name='保存']"

常见元素选择器映射:
- 搜索框: "input[placeholder*='搜索'], [data-testid*='search'], role=searchbox"
- 登录按钮: "button:has-text('登录'), role=button[name*='登录'], [data-testid*='login']"
- 用户名输入: "input[placeholder*='用户名'], input[name='username'], role=textbox[name*='用户']"
- 密码输入: "input[type='password'], input[placeholder*='密码'], role=textbox[name*='密码']"
- 提交按钮: "button[type='submit'], button:has-text('提交'), role=button[name*='提交']"
- 导航菜单: "nav >> a:has-text('菜单项'), role=navigation >> role=link"
- 错误提示: ".error, .alert, [role='alert'], :has-text('错误')"

请直接返回JSON数组，例如:
[
  {
    "id": "step-1",
    "action": "navigate",
    "url": "https://www.example.com",
    "description": "打开示例网站",
    "order": 1
  },
  {
    "id": "step-2", 
    "action": "fill",
    "selector": "input[placeholder*='用户名']",
    "value": "testuser",
    "description": "输入用户名",
    "order": 2
  },
  {
    "id": "step-3",
    "action": "click",
    "selector": "button:has-text('登录')",
    "description": "点击登录按钮",
    "order": 3
  },
  {
    "id": "step-4",
    "action": "expect",
    "selector": ":has-text('欢迎')",
    "condition": "visible",
    "description": "验证登录成功",
    "order": 4
  }
]`;
  }

  /**
   * 调用OpenRouter API
   */
  private async callOpenRouter(
    prompt: string, 
    runId: string, 
    max_tokens = 2000,
    format: 'text' | 'json_object' = 'text'
  ): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      const body: any = {
        "model": "openai/gpt-4o",
        "messages": [
          {
            "role": "system",
            "content": "You are a professional Playwright MCP automation testing expert. Convert natural language descriptions into executable Playwright MCP test steps using recommended selector strategies. Return strict JSON format optimized for Playwright MCP execution."
          },
          {
            "role": "user", 
            "content": prompt
          }
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens
      };

      if (format === 'json_object') {
        body.response_format = { "type": "json_object" };
      }

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`API返回错误: ${data.error.message || data.error}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('API返回内容为空');
      }

      console.log(`[${runId}] 🤖 AI返回内容:`, content);
      
      return {
        success: true,
        content: content.trim()
      };

    } catch (error: any) {
      console.error(`[${runId}] OpenRouter API调用失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析AI返回的JSON内容
   */
  private parseAIResponse(content: string, runId: string): TestStep[] {
    try {
      // 记录原始响应内容
      console.log(`[${runId}] 📝 解析AI原始响应:`, content);
      
      // 清理可能的markdown代码块标记
      let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // 尝试提取JSON数组
      const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }

      const stepsData = JSON.parse(cleanContent);
      
      if (!Array.isArray(stepsData)) {
        throw new Error('AI返回的不是数组格式');
      }

      // 转换为TestStep格式并验证
      const steps: TestStep[] = stepsData.map((step: any, index: number) => {
        if (!step.action || !step.description) {
          throw new Error(`步骤 ${index + 1} 缺少必要字段`);
        }

        // 记录步骤解析详情
        console.log(`[${runId}] 📋 解析步骤 ${index + 1}:`, JSON.stringify(step));

        return {
          id: step.id || `step-${index + 1}`,
          action: step.action,
          selector: step.selector,
          url: step.url,
          value: step.value,
          text: step.text,
          condition: step.condition || (step.action === 'expect' ? 'visible' : undefined),
          timeout: step.timeout,
          description: step.description,
          order: step.order || index + 1
        };
      });

      // 验证步骤的合理性
      this.validateSteps(steps);
      
      return steps;

    } catch (error: any) {
      console.error(`[${runId}] 解析AI响应失败:`, error);
      console.error(`[${runId}] 原始内容:`, content);
      
      try {
        // 尝试从内容中提取JSON部分，即使有错误也尽量使用部分有效步骤
        let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
          
          // 尝试解析JSON，可能部分步骤是有效的
          const partialSteps = JSON.parse(cleanContent);
          if (Array.isArray(partialSteps) && partialSteps.length > 0) {
            console.warn(`[${runId}] ⚠️ 尝试修复有错误的步骤并继续执行`);
            
            // 修复常见的问题并验证
            const fixedSteps = partialSteps.map((step: any, index: number) => {
              // 确保基本字段存在
              step.id = step.id || `step-${index+1}`;
              step.order = step.order || index+1;
              
              // 处理wait步骤缺少timeout的情况
              if (step.action === 'wait' && !step.timeout) {
                step.timeout = 3000;
              }
              
              return step;
            });
            
            // 尝试进行验证，可能会抛出错误
            this.validateSteps(fixedSteps);
            
            console.log(`[${runId}] ✅ 成功修复并验证了${fixedSteps.length}个步骤`);
            return fixedSteps;
          }
        }
      } catch (fixError) {
        console.error(`[${runId}] ❌ 修复步骤失败:`, fixError);
      }
      
      // 如果修复失败，才使用fallback
      const isAssertionParsing = content.includes('断言') || content.includes('验证') || content.includes('expect');
      
      if (isAssertionParsing) {
        console.log(`[${runId}] ⚠️ 断言解析彻底失败，返回严格的失败断言`);
        return [{
          id: 'assertion-failure',
          action: 'expect',
          selector: `div.assertion-error-${Date.now()}`, // 使用一个几乎不可能存在的选择器
          condition: 'visible',
          description: `断言失败: ${error.message}`,
          order: 1
        }];
      } else {
        console.log(`[${runId}] 测试步骤解析失败，返回错误步骤`);
        return [{
          id: 'error-step',
          action: 'wait',
          timeout: 1000,
          description: `AI解析失败: ${error.message}`,
          order: 1
        }];
      }
    }
  }

  /**
   * 🔥 新增：解析AI返回的单步结果
   */
  private parseAINextStepResponse(content: string, runId: string): { step: TestStep; remaining: string } {
    try {
      const step = JSON.parse(content) as TestStep;

      // Manually find the step description in the original remaining steps to split them.
      // This is a bit brittle but necessary since the AI now only returns the next step.
      const originalRemaining = this.lastRemainingSteps || '';
      const stepDescription = step.description;
      
      let remaining = '';
      const lines = originalRemaining.split('\n');
      const stepIndex = lines.findIndex(line => line.includes(stepDescription));
      
      if (stepIndex !== -1 && stepIndex + 1 < lines.length) {
        remaining = lines.slice(stepIndex + 1).join('\n');
      }

      this.log(runId, `📝 AI成功解析步骤: ${step.description}`);
      return { step, remaining };
    } catch (error: any) {
      this.log(runId, `❌ 解析AI的下一步响应失败: ${error.message}`, 'error');
      this.log(runId, `❌ 原始内容: ${content}`, 'error');
      throw new Error(`解析下一步错误: ${error.message}`);
    }
  }

  /**
   * 🆕 智能选择器增强和验证 - 包含冲突解决
   */
  private enhanceSelector(step: TestStep, description: string, runId: string): TestStep {
    this.log(runId, `🔧 开始增强选择器: "${step.selector}" for "${description}"`);
    
    // 如果是导航操作，无需选择器
    if (step.action === 'navigate') {
      return step;
    }
    
    // 提取步骤描述中的关键文本
    const keyText = this.extractKeyTextFromDescription(description);
    this.log(runId, `📝 提取的关键文本: "${keyText}"`);
    
    // 🆕 完全信任AI生成的选择器，不做任何修改
    if (step.selector && this.isSelectorTextBased(step.selector)) {
      this.log(runId, `✅ 保持AI生成的文本选择器不变: "${step.selector}"`);
      return step;
    }
    
    // 如果选择器是通用类选择器，尝试增强
    if (step.selector && this.isGenericSelector(step.selector)) {
      this.log(runId, `⚠️ 检测到通用选择器，尝试增强`);
      
      // 尝试添加文本约束
      if (keyText) {
        const enhancedSelector = this.addTextConstraintToSelector(step.selector, keyText);
        if (enhancedSelector !== step.selector) {
          this.log(runId, `🔧 选择器已增强: "${step.selector}" → "${enhancedSelector}"`);
          step.selector = enhancedSelector;
        }
      }
    }
    
    return step;
  }
  
  /**
   * 🆕 从步骤描述中提取关键文本
   */
  private extractKeyTextFromDescription(description: string): string {
    // 移除常见的动作词，提取核心文本
    const actionWords = ['点击', '输入', '填写', '选择', '等待', '验证', '打开', 'click', 'fill', 'type', 'select', 'enter', 'choose', 'wait', 'verify', 'open'];
    let text = description;
    
    // 移除动作词
    actionWords.forEach(word => {
      text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除常见的辅助词
    const auxiliaryWords = ['菜单', '按钮', '输入框', '字段', '元素', '页面', '链接', '选项', 'menu', 'button', 'input', 'field', 'element', 'page', 'link', 'option'];
    auxiliaryWords.forEach(word => {
      text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除引号和其他标点
    text = text.replace(/["""''()（）]/g, '').trim();
    
    // 如果提取的文本太短或为空，尝试其他策略
    if (!text || text.length < 2) {
      // 寻找引号中的内容
      const quotedMatch = description.match(/[""]([^"""]+)[""]|'([^']+)'/);
      if (quotedMatch) {
        text = quotedMatch[1] || quotedMatch[2];
      } else {
        // 尝试找到最长的连续字符串（排除动作词）
        const words = description.split(/\s+/).filter(word => 
          word.length > 1 && !actionWords.some(action => 
            word.toLowerCase().includes(action.toLowerCase())
          )
        );
        if (words.length > 0) {
          text = words.reduce((longest, current) => 
            current.length > longest.length ? current : longest
          );
        }
      }
    }
    
    return text;
  }
  
  /**
   * 🆕 检查选择器是否基于文本
   */
  private isSelectorTextBased(selector: string): boolean {
    return selector.includes(':has-text(') || 
           selector.includes(':contains(') ||
           selector.includes('text=') ||
           selector.includes(':text(');
  }
  
  /**
   * 🆕 检查是否为通用选择器
   */
  private isGenericSelector(selector: string): boolean {
    // 检查是否是纯类选择器或标签选择器
    const genericPatterns = [
      /^\.[\w-]+$/,           // 纯类选择器 .menu-item
      /^[a-z]+\.[\w-]+$/,     // 标签+类 a.menu-item
      /^[a-z]+$/,             // 纯标签选择器 a, button
      /^\.[\w-]+\.[\w-]+$/,   // 多类选择器 .menu.item
    ];
    
    return genericPatterns.some(pattern => pattern.test(selector));
  }
  
  /**
   * 🆕 为选择器添加文本约束
   */
  private addTextConstraintToSelector(selector: string, text: string): string {
    if (!text) return selector;
    
    // 为不同类型的选择器添加文本约束
    if (selector.startsWith('.')) {
      // 类选择器：.menu-item → .menu-item:has-text("商品管理")
      return `${selector}:has-text("${text}")`;
    } else if (selector.match(/^[a-z]+$/)) {
      // 标签选择器：a → a:has-text("商品管理")
      return `${selector}:has-text("${text}")`;
    } else if (selector.match(/^[a-z]+\.[\w-]+$/)) {
      // 标签+类选择器：a.menu-item → a.menu-item:has-text("商品管理")
      return `${selector}:has-text("${text}")`;
    }
    
    // 其他情况，尝试智能添加
    return `${selector}:has-text("${text}")`;
  }
  
  /**
   * 🆕 移除多匹配冲突修改 - 完全信任AI判断
   */
  private resolveTextBasedConflict(selector: string, description: string, keyText: string): string {
    // 新策略：完全保持AI生成的选择器不变
    // 多匹配问题应该在执行阶段通过更智能的方式处理，而不是在解析阶段强行修改
    return selector;
  }

  /**
   * 🆕 生成备选选择器策略
   */
  private generateFallbackSelectors(description: string, keyText: string): string[] {
    const selectors: string[] = [];
    
    if (!keyText) return selectors;
    
    // 策略1: 基于文本的通用选择器
    selectors.push(`:has-text("${keyText}")`);
    selectors.push(`:contains("${keyText}")`);
    
    // 策略2: 推测可能的标签+文本（基于通用操作模式）
    const lowerDesc = description.toLowerCase();
    const clickWords = ['点击', 'click', '选择', 'select', '按'];
    const inputWords = ['输入', '填写', 'fill', 'type', 'enter'];
    const navWords = ['菜单', '导航', 'menu', 'nav', '链接', 'link'];
    
    if (clickWords.some(word => lowerDesc.includes(word))) {
      selectors.push(`a:has-text("${keyText}")`);
      selectors.push(`button:has-text("${keyText}")`);
      selectors.push(`[role="button"]:has-text("${keyText}")`);
      selectors.push(`[role="menuitem"]:has-text("${keyText}")`);
    }
    
    if (inputWords.some(word => lowerDesc.includes(word))) {
      selectors.push(`input[placeholder*="${keyText}"]`);
      selectors.push(`input[name*="${keyText}"]`);
      selectors.push(`textarea[placeholder*="${keyText}"]`);
    }
    
    // 策略3: 导航/菜单相关选择器（基于通用模式）
    if (navWords.some(word => lowerDesc.includes(word))) {
      selectors.push(`nav a:has-text("${keyText}")`);
      selectors.push(`.menu a:has-text("${keyText}")`);
      selectors.push(`.nav a:has-text("${keyText}")`);
      selectors.push(`[role="navigation"] a:has-text("${keyText}")`);
      selectors.push(`.sidebar a:has-text("${keyText}")`);
      selectors.push(`[role="menubar"] a:has-text("${keyText}")`);
    }
    
    // 策略4: 基于常见CSS类模式的组合选择器
    const commonClassPatterns = ['item', 'link', 'button', 'menu', 'nav', 'tab'];
    commonClassPatterns.forEach(pattern => {
      selectors.push(`.${pattern}:has-text("${keyText}")`);
      selectors.push(`a.${pattern}:has-text("${keyText}")`);
      selectors.push(`button.${pattern}:has-text("${keyText}")`);
    });
    
    return selectors;
  }

  private extractJson(content: string, type: 'object' | 'array'): string {
    let cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const startChar = type === 'object' ? '{' : '[';
    const endChar = type === 'object' ? '}' : ']';

    const startIndex = cleanedContent.indexOf(startChar);
    const endIndex = cleanedContent.lastIndexOf(endChar);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return cleanedContent.substring(startIndex, endIndex + 1);
    }
    
    // Fallback if no clear block is found, though this may fail during JSON.parse
    return cleanedContent;
  }

  private validateSteps(steps: TestStep[]): void {
    for (const step of steps) {
      switch (step.action) {
        case 'navigate':
          if (!step.url || !step.url.startsWith('http')) {
            throw new Error(`导航步骤缺少有效URL: ${step.description}`);
          }
          break;
        case 'click':
        case 'hover':
          if (!step.selector) {
            throw new Error(`交互步骤缺少选择器: ${step.description}`);
          }
          break;
        case 'fill':
          if (!step.selector || step.value === undefined) {
            throw new Error(`输入步骤缺少选择器或值: ${step.description}`);
          }
          break;
        case 'expect':
          if (!step.selector && step.condition !== 'url_changed' && step.condition !== 'logged_in') {
            throw new Error(`断言步骤缺少选择器: ${step.description}`);
          }
          if (!step.condition) {
            throw new Error(`断言步骤缺少条件: ${step.description}`);
          }
          break;
        case 'wait':
          // 自动修复缺少timeout的wait步骤
          if (!step.timeout) {
            console.warn(`⚠️ 自动修复wait步骤缺少超时时间: ${step.description}`);
            step.timeout = 3000; // 添加默认超时时间3000ms
          }
          break;
      }
    }
  }

  /**
   * Fixes common URL errors, e.g., "2www." -> "www."
   */
  private fixUrl(url: string): string {
    return url.replace(/^[0-9]www\./, 'www.');
  }

  async generateSelectorWithContext(
    originalStep: TestStep,
    pageElements: any[]
  ): Promise<string> {
    console.log(`🧠 使用上下文为 "${originalStep.description}" 生成选择器...`);
    
    const prompt = this.buildContextualSelectorPrompt(originalStep, pageElements);
    const response = await this.callOpenRouter(prompt, "selector-gen");

    if (!response.success || !response.content) {
      console.warn('⚠️ AI无法生成上下文选择器，将使用原始选择器');
      return originalStep.selector || '';
    }
    
    // 假设AI直接返回最佳选择器字符串
    const bestSelector = response.content.trim(); 
    console.log(`✅ AI建议的选择器: ${bestSelector}`);
    
    return bestSelector;
  }

  private buildContextualSelectorPrompt(
    originalStep: TestStep,
    pageElements: any[]
  ): string {
    const simplifiedElements = pageElements.map(el => ({
      tag: el.tag,
      text: el.text,
      attributes: el.attributes
    }));

    return `你是一个Playwright MCP智能选择器生成器。根据用户意图和页面元素，找到最佳的Playwright MCP选择器。

用户意图: "${originalStep.description}"
原始选择器: "${originalStep.selector}"

页面元素:
${JSON.stringify(simplifiedElements, null, 2)}

请使用Playwright MCP推荐的选择器策略：
1. 优先使用文本定位器：:has-text(), text=
2. 其次使用角色定位器：role=button, role=textbox
3. 然后使用属性定位器：[data-testid], [placeholder]
4. 最后使用组合选择器：parent >> child

返回最佳的Playwright MCP选择器:`;
  }

  // --- 主要的解析方法 ---
  
  public async parseNextStep(remainingStepsText: string, snapshot: any | null, runId: string): Promise<AINextStepParseResult> {
    try {
      if (!remainingStepsText?.trim()) {
        return { success: true, step: undefined, remaining: '' };
      }
      this.lastRemainingSteps = remainingStepsText; // Cache for response parsing

      const prompt = await this.buildNextStepPrompt(remainingStepsText, snapshot);
      const response = await this.callOpenRouter(prompt, runId, 400, 'json_object');

      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI failed to return content for the next step.');
      }

      const { step, remaining } = this.parseAINextStepResponse(response.content, runId);

      return {
        success: true,
        step: step,
        remaining: remaining,
        rawResponse: response.content
      };
    } catch (error: any) {
      console.error(`[${runId}] 解析下一步失败:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🆕 记录选择器分析信息
   */
  private logSelectorAnalysis(step: TestStep, description: string, runId: string): void {
    if (!step.selector) return;
    
    const analysis = {
      原始描述: description,
      操作类型: step.action,
      选择器: step.selector,
      是否文本基础: this.isSelectorTextBased(step.selector),
      是否通用选择器: this.isGenericSelector(step.selector),
      提取的关键文本: this.extractKeyTextFromDescription(description)
    };
    
    this.log(runId, `📊 选择器分析: ${JSON.stringify(analysis, null, 2)}`);
  }

  /**
   * 🆕 错误恢复机制
   */
  private async attemptErrorRecovery(
    remainingStepsText: string, 
    runId: string, 
    originalError: string
  ): Promise<AINextStepParseResult> {
    try {
      this.log(runId, `🔄 尝试错误恢复，原始错误: ${originalError}`);
      
      const firstLine = remainingStepsText.split('\n')[0].trim();
      const keyText = this.extractKeyTextFromDescription(firstLine);
      
      if (!keyText) {
        this.log(runId, `❌ 无法提取关键文本，错误恢复失败`);
        return { success: false, error: `错误恢复失败: 无法提取关键文本` };
      }
      
      // 构建简化的提示，专注于选择器生成
      const recoveryPrompt = `Based on this failed parsing, please generate a simple Playwright MCP step.

Failed step: "${firstLine}"
Key text identified: "${keyText}"
Original error: ${originalError}

Generate a JSON object with nextStep using Playwright MCP selector strategies:
- For clicks: use :has-text() selectors (e.g., button:has-text("Save"))
- For inputs: use role=textbox or placeholder attributes
- For navigation: use text= or role=link selectors
- Be very specific and avoid generic selectors

Use Playwright MCP recommended selector priority:
1. Text-based: :has-text(), text=
2. Role-based: role=button, role=textbox
3. Attribute-based: [data-testid], [placeholder]

Return format:
{
  "nextStep": {
    "action": "...",
    "selector": "...",
    "description": "..."
  },
  "remainingSteps": "..."
}`;

      const response = await this.callOpenRouter(recoveryPrompt, runId, 500);
      
      if (response.success && response.content) {
        const parsed = this.parseAINextStepResponse(response.content, runId);
        this.log(runId, `✅ 错误恢复解析成功: ${parsed.step.description}`);
        
        return {
          success: true,
          step: parsed.step,
          remaining: parsed.remaining,
          rawResponse: response.content
        };
      }
      
      // 如果AI仍然失败，返回手工构建的基本步骤
      return this.createBasicFallbackStep(firstLine, keyText, remainingStepsText);
      
    } catch (error: any) {
      this.log(runId, `❌ 错误恢复失败: ${error.message}`, 'error');
      return { success: false, error: `错误恢复失败: ${error.message}` };
    }
  }

  /**
   * 🆕 创建基本的回退步骤
   */
  private createBasicFallbackStep(
    firstLine: string, 
    keyText: string, 
    remainingStepsText: string
  ): AINextStepParseResult {
    const remaining = remainingStepsText.split('\n').slice(1).join('\n').trim();
    
    // 基于描述推测操作类型
    let action = 'wait'; // 默认安全操作
    let selector: string | undefined = 'body';
    
    const lowerDesc = firstLine.toLowerCase();
    const clickWords = ['点击', 'click', '选择', 'select', '按'];
    const inputWords = ['输入', '填写', 'fill', 'type', 'enter'];
    const navWords = ['导航', '打开', 'navigate', 'open', '访问', 'visit'];
    
    if (clickWords.some(word => lowerDesc.includes(word))) {
      action = 'click';
      selector = keyText ? `button:has-text("${keyText}")` : 'button';
    } else if (inputWords.some(word => lowerDesc.includes(word))) {
      action = 'fill';
      selector = keyText ? `role=textbox[placeholder*="${keyText}"]` : 'role=textbox';
    } else if (navWords.some(word => lowerDesc.includes(word))) {
      action = 'navigate';
      selector = undefined;
    }
    
    const step: TestStep = {
      id: `recovery-step-${Date.now()}`,
      action: action as any,
      description: `恢复步骤: ${firstLine}`,
      order: 1
    };
    
    // 为需要选择器的操作添加选择器
    if (selector) {
      step.selector = selector;
    }
    
    // 为导航步骤添加URL
    if (action === 'navigate') {
      const urlMatch = firstLine.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        step.url = urlMatch[0];
      }
    }
    
    // 为wait步骤添加timeout
    if (action === 'wait') {
      step.timeout = 3000;
    }
    
    return {
      success: true,
      step: step,
      remaining: remaining
    };
  }

  /**
   * 混合断言策略解析逻辑
   */
  public async parseAssertions(assertionsText: string, snapshot: any, runId:string): Promise<AIParseResult> {
    try {
      this.log(runId, `🧠 AI开始解析断言: "${assertionsText}"`);

      // 使用MCP工具从快照中提取有效选择器
      const selectorsResult = await this.mcpClient.callTool({
        name: 'page_get_selectors', // 假设的工具
        arguments: { snapshot },
      }) as { selectors: string[] };
      const validSelectors = selectorsResult.selectors || [];
      
      if (validSelectors.length === 0) {
        this.log(runId, '⚠️ 页面快照中未找到有效选择器', 'warning');
      }

      const assertionType = this.identifyAssertionType(assertionsText);
      
      const prompt = await this.buildEnhancedAssertionsPrompt(
        assertionsText, 
        snapshot, 
        assertionType, 
        validSelectors
      );
      
      const response = await this.callOpenRouter(prompt, runId);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI未能返回断言步骤');
      }

      let steps = this.parseAIResponse(response.content, runId);

      // 进一步增强和验证
      steps = await this.enhanceAndVerifyAssertions(steps, snapshot, assertionType, validSelectors, runId);
      
      this.log(runId, `✅ AI断言解析完成，生成${steps.length}个步骤`);

      return {
        success: true,
        steps,
        rawResponse: response.content
      };

    } catch (error: any) {
      this.log(runId, `❌ AI断言解析失败: ${error.message}`, 'error');
      return {
        success: false,
        steps: [],
        error: error.message
      };
    }
  }

  private identifyAssertionType(assertionsText: string): 'text' | 'attribute' | 'state' | 'visual' | 'relation' {
    const lowerText = assertionsText.toLowerCase();
    if (lowerText.includes('属性') || lowerText.includes('attribute') || /has|have|prop/.test(lowerText)) return 'attribute';
    if (lowerText.includes('状态') || /is |are /.test(lowerText)) return 'state';
    if (lowerText.includes('对比') || lowerText.includes('样子') || lowerText.includes('appear')) return 'visual';
    if (lowerText.includes('关系') || lowerText.includes('位于') || /inside|below|above/.test(lowerText)) return 'relation';
    return 'text'; // 默认
  }

  /**
   * 增强和验证生成的断言
   */
  private async enhanceAndVerifyAssertions(
    steps: TestStep[], 
    snapshot: any, 
    assertionType: string,
    validSelectors: string[],
    runId: string
  ): Promise<TestStep[]> {
    const enhancedSteps: TestStep[] = [];
    
    // 处理每个步骤
    for (const step of steps) {
      // 确保所有步骤都是断言相关的操作
      if (step.action !== 'expect' && step.action !== 'wait') {
        console.warn(`[${runId}] ⚠️ 断言解析返回了非断言操作: ${step.action}, 已修正为expect`);
        step.action = 'expect'; 
        step.description = `验证: ${step.description}`;
      }
      
      // 确保wait步骤有timeout
      if (step.action === 'wait' && !step.timeout) {
        step.timeout = 3000; // 默认3秒
        console.log(`[${runId}] ⚠️ 自动修复wait步骤缺少超时时间: ${step.description}`);
      }
      
      // 内容驱动断言处理 - 特别是文本类型断言
      if (step.action === 'expect' && assertionType === 'text') {
        const enhancedStep = await this.enhanceContentDrivenAssertion(step, snapshot, validSelectors, runId);
        enhancedSteps.push(enhancedStep);
      } else {
        // 其他类型断言的处理
        const verifiedStep = this.verifyAssertionSelector(step, validSelectors, runId);
        enhancedSteps.push(verifiedStep);
      }
    }
    
    // 如果没有断言步骤，添加一个基于断言文本的通用断言
    if (enhancedSteps.length === 0) {
      const fallbackStep = this.createFallbackAssertion(assertionType, runId);
      enhancedSteps.push(fallbackStep);
    }
    
    return enhancedSteps;
  }
  
  /**
   * 内容驱动断言增强
   */
  private async enhanceContentDrivenAssertion(
    step: TestStep, 
    snapshot: any, 
    validSelectors: string[],
    runId: string
  ): Promise<TestStep> {
    // 如果已经有有效选择器且在可用列表中，不做修改
    if (step.selector && validSelectors.includes(step.selector)) {
      return step;
    }
    
    // 如果有text属性但没有选择器或选择器无效，使用文本内容查找
    if (step.text && (!step.selector || !validSelectors.includes(step.selector))) {
      console.log(`[${runId}] 🔄 增强文本断言: "${step.text}"`);
      
      // 首先尝试找到包含该文本的有效选择器
      const textSelectors = validSelectors.filter(s => s.includes(`:contains('${step.text}')`));
      
      if (textSelectors.length > 0) {
        // 使用找到的第一个有效选择器
        step.selector = textSelectors[0];
        step.condition = 'visible';
        console.log(`[${runId}] ✅ 找到匹配文本的选择器: ${step.selector}`);
      } else {
        // 如果没有找到，使用body元素并检查页面中是否包含文本
        step.selector = 'body';
        step.condition = 'contains_text';
        console.log(`[${runId}] ℹ️ 未找到精确匹配，使用body元素检查文本`);
      }
    }
    
    // 如果没有文本属性，但有选择器，尝试验证选择器是否有效
    if ((!step.text || step.text.trim() === '') && step.selector) {
      step = this.verifyAssertionSelector(step, validSelectors, runId);
    }
    
    return step;
  }
  
  /**
   * 验证断言选择器
   */
  private verifyAssertionSelector(
    step: TestStep, 
    validSelectors: string[],
    runId: string
  ): TestStep {
    // 如果没有选择器，添加默认选择器
    if (!step.selector) {
      step.selector = 'body';
      console.log(`[${runId}] ⚠️ 断言缺少选择器，已设置为body`);
      return step;
    }
    
    // 如果选择器不在有效列表中，尝试找到最相似的选择器
    if (!validSelectors.includes(step.selector)) {
      console.log(`[${runId}] 🔍 选择器 "${step.selector}" 不在有效列表中，尝试匹配`);
      
      // 如果是文本断言，尝试查找可能的错误/提示消息容器
      if (step.condition === 'contains_text' && step.text) {
        // 查找可能的错误/提示消息容器
        const messageContainer = this.findMessageContainer(validSelectors, step.text);
        if (messageContainer) {
          step.selector = messageContainer;
          console.log(`[${runId}] ✅ 找到可能的消息容器: ${step.selector}`);
          return step;
        }
      }
      
      // 简单选择器可能性
      let simpleSelector = step.selector;
      
      // 移除属性选择器部分以获取简化版本
      const simplifiedMatch = step.selector.match(/^([a-z0-9]+|[#\.][a-z0-9\-_]+)/i);
      if (simplifiedMatch) {
        simpleSelector = simplifiedMatch[0];
      }
      
      // 查找包含简化选择器的有效选择器
      const similarSelectors = validSelectors.filter(s => 
        s.includes(simpleSelector) || 
        (simpleSelector.startsWith('.') && s.includes('class=')) ||
        (simpleSelector.startsWith('#') && s.includes('id='))
      );
      
      if (similarSelectors.length > 0) {
        step.selector = similarSelectors[0];
        console.log(`[${runId}] ✅ 找到替代选择器: ${step.selector}`);
      } else {
        // 如果没有找到，记录警告并保留原选择器
        console.log(`[${runId}] ⚠️ 未找到替代选择器，保留原选择器`);
      }
    }
    
    return step;
  }
  
  /**
   * 查找可能的消息容器元素
   * 通用方法，适用于错误消息、成功消息、提示信息等
   */
  private findMessageContainer(validSelectors: string[], text?: string): string | null {
    // 常见的消息容器类名或ID模式
    const messagePatterns = [
      /error/i, /message/i, /alert/i, /notification/i, /toast/i, 
      /tip/i, /hint/i, /warn/i, /info/i, /feedback/i,
      /提示/i, /消息/i, /错误/i, /警告/i, /成功/i
    ];
    
    // 如果有文本，检查是否有包含该文本的选择器
    if (text) {
      const textLower = text.toLowerCase();
      
      // 基于文本内容的关键词，确定可能的消息类型
      const isError = textLower.includes('错误') || textLower.includes('失败') || 
                      textLower.includes('不能') || textLower.includes('必须') ||
                      textLower.includes('无效');
                      
      const isSuccess = textLower.includes('成功') || textLower.includes('完成') || 
                        textLower.includes('已') || textLower.includes('正确');
      
      // 优先查找包含文本的选择器
      const textContainers = validSelectors.filter(s => s.includes(':contains'));
      for (const container of textContainers) {
        // 如果选择器包含相关文本，优先返回
        if (container.toLowerCase().includes(textLower) || 
            (text.length > 3 && container.includes(text.substring(0, 3)))) {
          return container;
        }
      }
      
      // 然后根据消息类型查找可能的容器
      if (isError) {
        const errorContainers = validSelectors.filter(s => 
          /error|alert|warning|danger|invalid|fail/i.test(s) || 
          /错误|警告|失败|提示/i.test(s)
        );
        if (errorContainers.length > 0) return errorContainers[0];
      }
      
      if (isSuccess) {
        const successContainers = validSelectors.filter(s => 
          /success|complete|done|valid|info/i.test(s) || 
          /成功|完成|正确|信息/i.test(s)
        );
        if (successContainers.length > 0) return successContainers[0];
      }
    }
    
    // 通用消息容器查找
    for (const pattern of messagePatterns) {
      const matchingSelectors = validSelectors.filter(s => pattern.test(s));
      if (matchingSelectors.length > 0) {
        return matchingSelectors[0];
      }
    }
    
    return null;
  }
  
  /**
   * 创建回退断言
   */
  private createFallbackAssertion(assertionType: string, runId: string): TestStep {
    console.log(`[${runId}] ℹ️ 创建断言类型'${assertionType}'的回退断言`);
    
    switch(assertionType) {
      case 'text':
        return {
          id: 'fallback-text-assertion',
          action: 'expect',
          selector: 'body',
          condition: 'contains_text',
          text: '必定失败的断言-占位符',
          description: '文本内容验证（回退）',
          order: 1
        };
      case 'state':
        return {
          id: 'fallback-state-assertion',
          action: 'expect',
          selector: 'body',
          condition: 'url_changed',
          description: '状态变化验证（回退）',
          order: 1
        };
      case 'visual':
        return {
          id: 'fallback-visual-assertion',
          action: 'expect',
          selector: 'body',
          condition: 'visible',
          description: '视觉元素验证（回退）',
          order: 1
        };
      case 'attribute':
        return {
          id: 'fallback-attribute-assertion',
          action: 'expect',
          selector: 'form',
          condition: 'visible',
          description: '属性验证（回退）',
          order: 1
        };
      case 'relation':
        return {
          id: 'fallback-relation-assertion',
          action: 'expect',
          selector: 'body',
          condition: 'visible',
          description: '元素关系验证（回退）',
          order: 1
        };
      default:
        return {
          id: 'fallback-generic-assertion',
          action: 'expect',
          selector: 'body',
          condition: 'visible',
          description: '通用验证（回退）',
          order: 1
        };
    }
  }


  // --- Prompt 构建方法 ---

  /**
   * 增强的断言提示构建 - 针对Playwright MCP优化
   */
  private async buildEnhancedAssertionsPrompt(
    assertionsText: string, 
    snapshot: any, 
    assertionType: string, 
    validSelectors: string[]
  ): Promise<string> {
    const pageContext = await this.buildPageContext(snapshot);

    return `
You are a top-tier QA automation expert specializing in Playwright. Your task is to convert a natural language assertion into a precise and robust Playwright MCP 'expect' step.

**Natural Language Assertion:**
"${assertionsText}"

**Analysis:**
- Assertion Type: ${assertionType}
- Available Selectors on Page: ${validSelectors.join(', ') || 'N/A'}

${pageContext}

**Instructions:**
1.  **Analyze the user's intent** based on the assertion text.
2.  **Select the BEST possible selector** from the available selectors list or create a more robust one based on the page context. Prioritize text, roles, and stable attributes.
3.  **Determine the correct 'condition'** for the 'expect' step (e.g., 'visible', 'contains_text', 'has_attribute').
4.  **Construct a single, perfect JSON object** for the 'expect' step.
5.  **Return ONLY the JSON object.** No extra text or explanations.

**JSON Output Format:**
{
  "id": "assertion-1",
  "action": "expect",
  "selector": "your_best_selector",
  "condition": "the_correct_condition",
  "text": "text_to_check (if applicable)",
  "attribute": { "name": "attr_name", "value": "attr_value" } (if applicable),
  "description": "A concise summary of the assertion"
}

**Example:**
For an assertion "verify the error message 'Invalid credentials' is shown", your output should be:
{
  "id": "assertion-1",
  "action": "expect",
  "selector": ".error-message:has-text('Invalid credentials')",
  "condition": "visible",
  "description": "Verify error message is visible"
}
`;
  }


  private async buildAssertionsPromptWithContext(assertionsText: string, snapshot: any): Promise<string> {
    const pageContext = await this.buildPageContext(snapshot);

    return `
You are a QA automation expert. Convert the following natural language assertion into a Playwright MCP 'expect' step based on the provided page context.

**Assertion:**
"${assertionsText}"

${pageContext}

**Task:**
Return a single JSON object for the 'expect' step.

**JSON Format:**
{
  "id": "assertion-1",
  "action": "expect",
  "selector": "...",
  "condition": "...",
  "text": "...",
  "description": "..."
}
`;
  }

  /**
   * 提取页面中的纯文本内容
   */
  private extractPageTexts(elements: any[]): string[] {
    if (!elements || elements.length === 0) {
      return [];
    }
    
    // 收集所有文本内容
    const texts: string[] = [];
    elements.forEach(e => {
      if (e.innerText && typeof e.innerText === 'string' && e.innerText.trim().length > 0) {
        // 清理文本并限制长度
        const cleanText = e.innerText.trim().replace(/\s+/g, ' ').substring(0, 100);
        if (cleanText.length > 3) { // 忽略太短的文本
          texts.push(cleanText);
        }
      }
    });
    
    // 去重
    const uniqueTexts = [...new Set(texts)];
    
    // 识别可能的错误/提示消息
    const messageTexts = uniqueTexts.filter(text => {
      const lowerText = text.toLowerCase();
      return lowerText.includes('错误') || 
             lowerText.includes('提示') || 
             lowerText.includes('警告') || 
             lowerText.includes('成功') ||
             lowerText.includes('不能') || 
             lowerText.includes('必须') ||
             lowerText.includes('失败') ||
             lowerText.includes('请') ||
             text.length < 20; // 短文本可能是提示
    });
    
    // 将可能的消息文本放在列表前面
    const prioritizedTexts = [
      ...messageTexts, 
      ...uniqueTexts.filter(t => !messageTexts.includes(t))
    ];
    
    // 限制数量
    return prioritizedTexts.slice(0, 20);
  }

  // 提取页面上的关键元素
  private extractKeyElements(elements: any[]): string[] {
    if (!elements || elements.length === 0) {
      return [];
    }

    // 按优先级筛选关键元素
    const priorityElements = elements.filter(e => {
      // 表单元素
      if (e.tagName === 'BUTTON' || e.tagName === 'INPUT' || e.tagName === 'A') {
        return true;
      }
      // 有文本内容的元素
      if (e.innerText && e.innerText.trim().length > 0) {
        return true;
      }
      // 有明确ID或class的元素
      if ((e.id && e.id.trim()) || (e.className && typeof e.className === 'string' && e.className.trim())) {
        return true;
      }
      return false;
    });

    // 最多返回10个关键元素
    return priorityElements.slice(0, 10).map(e => {
      const tagName = e.tagName?.toLowerCase() || 'unknown';
      const id = e.id ? `#${e.id}` : '';
      const className = e.className && typeof e.className === 'string' 
        ? `.${e.className.replace(/\s+/g, '.')}` : '';
      const text = e.innerText ? `文本: "${e.innerText.substring(0, 50)}"` : '';
      const value = e.value ? `值: "${e.value}"` : '';
      
      return `${tagName}${id}${className} ${text} ${value}`.trim();
    });
  }
  
  /**
   * @returns The generated prompt string.
   */
  private async buildNextStepPrompt(remainingStepsText: string, snapshot: any | null): Promise<string> {
    const pageContext = snapshot
      ? await this.buildPageContext(snapshot)
      : 'No page snapshot available.';

    return `You are a professional Playwright MCP automation testing expert. Based on the current page context and the remaining steps, generate the JSON for the *very next* step.

Remaining Steps:
${remainingStepsText}

${pageContext}

Requirements:
1.  **Analyze the current page context** to find the most accurate selector for the next action.
2.  Prioritize user-visible text, roles, and accessibility attributes for selectors.
3.  Generate JSON for ONLY the next single step.
4.  If the next step is an assertion (e.g., "verify the welcome message is displayed"), use the "expect" action.
5.  Return ONLY the JSON object for the next step, nothing else.

Supported Actions: "navigate", "click", "fill", "type", "expect", "wait", "screenshot", "hover", "drag", "select_option", "file_upload", "press_key", "scroll".

JSON format for the next step:
{
  "id": "step-N",
  "action": "action_type",
  "selector": "CSS or Playwright selector",
  "url": "URL for navigate",
  "value": "text to fill",
  "description": "description of the step",
  "order": "auto" 
}

Example: If the next step is "click the login button", and the page context shows a button with "data-testid=login-button" and text "Log In", your response should be:
{
  "id": "step-2",
  "action": "click",
  "selector": "button:has-text('Log In')",
  "description": "Click the login button",
  "order": "auto"
}`;
  }

  private async buildPageContext(snapshot: string): Promise<string> {
    try {
      // 依赖注入的mcpClient现在可以用了
      // 我们假设有一个工具可以从YAML快照中提取关键信息
      const summaryResult = await this.mcpClient.callTool({
        name: 'page_get_summary', // 假设的工具
        arguments: { snapshot },
      }) as { text_content: string, interactive_elements: string[] };

      const { text_content, interactive_elements } = summaryResult;

      const elementsText = interactive_elements.length > 0
        ? `可交互元素 (选择器):\n${interactive_elements.join('\n')}`
        : '页面上没有检测到可交互的元素。';

      const pageTextSummary = text_content
        ? `页面文本内容摘要:\n${text_content}`
        : '页面没有可见的文本内容。';

      return `
当前页面快照分析:
---
${pageTextSummary}
---
${elementsText}
---`;
    } catch (error: any) {
      console.error('构建页面上下文失败:', error);
      // 即使失败，也返回一个无害的默认值，而不是让整个流程中断
      return `
当前页面快照分析:
---
[页面摘要生成失败: ${error.message}]
---`;
    }
  }

  /**
   * 优化日志输出方法
   */
  private log(runId: string, message: string, level: 'info' | 'error' | 'warning' = 'info') {
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '📝';
    console.log(`[${runId}] ${prefix} ${message}`);
  }

  /**
   * 🔥 优化executeStep方法，添加url_changed条件支持 (MCP兼容版本)
   */
  public extendMcpClientWithCustomConditions(mcpClient: any) {
    // 保存原始的executeStep方法
    const originalExecuteStep = mcpClient.executeStep;
    
    // 替换为支持自定义条件的版本
    mcpClient.executeStep = async (step: TestStep): Promise<any> => {
      // 处理自定义条件
      if (step.action === 'expect' && step.condition === 'url_changed') {
        try {
          // 🔥 MCP兼容方式：通过快照获取当前URL
          const snapshot = await mcpClient.getSnapshot();
          const currentUrl = snapshot?.url || '';
          
          if (!currentUrl) {
            throw new Error('无法获取当前页面URL');
          }
          
          // 如果指定了需要匹配的URL部分
          if (step.url) {
            // 检查当前URL是否包含指定的部分
            if (currentUrl.includes(step.url)) {
              return {
                success: true,
                result: {
                  action: 'expect',
                  condition: 'url_changed',
                  currentUrl,
                  expectedUrl: step.url,
                  status: 'success',
                  message: `MCP验证URL已更改且包含"${step.url}"`
                }
              };
            } else {
              throw new Error(`URL未包含预期部分，当前URL: ${currentUrl}, 预期包含: ${step.url}`);
            }
          } 
          
          // 检查是否不再是登录页面
          if (currentUrl.includes('/login')) {
            throw new Error(`URL仍然是登录页面: ${currentUrl}`);
          }
          
          return {
            success: true,
            result: {
              action: 'expect',
              condition: 'url_changed',
              currentUrl,
              status: 'success',
              message: `MCP验证URL已更改: ${currentUrl}`
            }
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      // 对于其他类型的步骤，使用原始方法
      return originalExecuteStep.call(mcpClient, step);
    };
    
    return mcpClient;
  }

  async fixStepSelector(failedStep: TestStep, error: string, snapshot: any, runId: string): Promise<AIParseResult> {
    try {
      console.log(`[${runId}] 🤖 AI开始修正失败的步骤: ${failedStep.description}`);

      const prompt = this.buildFixSelectorPrompt(failedStep, error, snapshot);
      // 使用较小的max_tokens，因为我们只需要一个JSON对象
      const response = await this.callOpenRouter(prompt, runId, 500);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI调用失败或返回内容为空');
      }

      // AI应该返回一个JSON对象，我们将其解析并放入数组中
      const content = this.extractJson(response.content, 'object');
      const fixedStep = JSON.parse(content);
      
      console.log(`[${runId}] ✅ AI修正完成，新选择器: ${fixedStep.selector}`);
      
      return {
        success: true,
        steps: [fixedStep], // 作为步骤数组返回
        rawResponse: response.content,
      };

    } catch (e: any) {
      console.error(`[${runId}] ❌ AI修正步骤失败:`, e);
      return {
        success: false,
        steps: [],
        error: e.message
      };
    }
  }

  private buildFixSelectorPrompt(failedStep: TestStep, error: string, snapshot: any): string {
    const pageContext = this.buildPageContext(snapshot);

    return `你是一个自动化测试修复专家。下面的Playwright MCP测试步骤在执行时失败了。
请分析错误信息和当前的页面快照，然后仅返回一个修正后的、只包含一个步骤的JSON数组。

失败的步骤:
${JSON.stringify(failedStep, null, 2)}

错误信息:
"${error}"

${pageContext}

要求:
1.  **只修正选择器 (selector)**，保持其他所有字段（action, value, id, order等）不变。
2.  你的首要目标是生成一个在当前快照中**唯一且可见**的元素选择器。
3.  仔细分析快照中的元素，使用最稳定、最精确的定位策略（如 role, text, data-testid）。
4.  **不要返回任何解释或额外的文本**，直接返回一个包含单个JSON对象的数组。

例如:
[
  {
    "id": "${failedStep.id}",
    "action": "${failedStep.action}",
    "selector": "role=button[name=' corrected login button ']",
    "value": ${JSON.stringify(failedStep.value)},
    "description": "${failedStep.description}",
    "order": ${failedStep.order}
  }
]
`;
  }
} 