import { TestStep } from './mcpClient.js';

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

export class AITestParser {
  private readonly OPENROUTER_API_KEY = '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';
  private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  /**
   * 使用GPT-4o解析自然语言测试描述
   */
  async parseTestDescription(description: string, testName: string, runId: string): Promise<AIParseResult> {
    try {
      console.log('🧠 AI开始解析测试描述:', description);

      const prompt = this.buildPrompt(description, testName);
      const response = await this.callOpenRouter(prompt, runId);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI调用失败或返回内容为空');
      }

      const steps = this.parseAIResponse(response.content, runId);
      
      console.log('✅ AI解析完成，生成', steps.length, '个测试步骤');
      return {
        success: true,
        steps
      };

    } catch (error: any) {
      console.error('❌ AI解析失败:', error);
      return {
        success: false,
        steps: [],
        error: error.message
      };
    }
  }

  /**
   * 构建优化的Prompt
   */
  private buildPrompt(description: string, testName: string): string {
    return `你是一个专业的Web自动化测试专家。请将以下自然语言描述转换为结构化的测试步骤。

测试用例名称: ${testName}
测试描述: ${description}

要求:
1. 分析描述中的每个操作，转换为具体的测试步骤
2. 自动修复URL中的错误(如"2www."改为"www.")
3. 智能识别常见的CSS选择器
4. 返回严格的JSON数组格式，不要任何其他文字

支持的操作类型:
- navigate: 打开网页
- click: 点击元素
- fill: 输入文本
- expect: 验证元素存在/可见
- wait: 等待指定时间
- screenshot: 截图
- hover: 悬停

每个步骤的JSON格式:
{
  "id": "step-N",
  "action": "操作类型",
  "selector": "CSS选择器(如果需要)",
  "url": "网址(navigate时使用)",
  "value": "输入值(fill时使用)",
  "text": "期望文本(expect时使用)",
  "condition": "验证条件(expect时使用,如visible)",
  "timeout": 等待时间毫秒(wait时使用),
  "description": "步骤描述",
  "order": 步骤序号
}

常见选择器映射:
- 搜索框: "#kw, .search-input, input[type='search']"
- 搜索按钮: "#su, .btn-search, .search-btn"
- 登录按钮: "#login-btn, .login-button, button:contains('登录')"
- 用户名输入: "#username, #email, input[name='username']"
- 密码输入: "#password, input[type='password']"

请直接返回JSON数组，例如:
[
  {
    "id": "step-1",
    "action": "navigate",
    "url": "https://www.baidu.com",
    "description": "打开百度首页",
    "order": 1
  },
  {
    "id": "step-2", 
    "action": "fill",
    "selector": "#kw",
    "value": "人工智能",
    "description": "在搜索框输入关键词",
    "order": 2
  }
]`;
  }

  /**
   * 调用OpenRouter API
   */
  private async callOpenRouter(prompt: string, runId: string, max_tokens = 2000): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "openai/gpt-4o",
          "messages": [
            {
              "role": "system",
              "content": "You are a professional web automation testing expert. Convert natural language descriptions into executable test steps. Return strict JSON format."
            },
            {
              "role": "user", 
              "content": prompt
            }
          ],
          "temperature": 0.3,
          "max_tokens": max_tokens
        })
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
      
      // 如果解析失败，返回一个基本的导航步骤
      return [{
        id: 'step-1',
        action: 'navigate',
        url: 'https://www.baidu.com',
        description: 'AI解析失败，默认打开百度',
        order: 1
      }];
    }
  }

  /**
   * 🔥 新增：解析AI返回的单步结果
   */
  private parseAINextStepResponse(content: string, runId: string): { step: TestStep; remaining: string } {
    try {
      this.log(runId, `AI返回内容: ${content}`);
      const cleanContent = this.extractJson(content, 'object');
      const parsed = JSON.parse(cleanContent);

      if (!parsed.nextStep || typeof parsed.remainingSteps !== 'string') {
        throw new Error('AI响应缺少 "nextStep" 或 "remainingSteps" 字段。');
      }

      const stepData = parsed.nextStep;
      const remaining = parsed.remainingSteps.trim();

      // 验证关键步骤是否包含选择器
      if ((stepData.action === 'click' || stepData.action === 'fill') && !stepData.selector) {
        const errorMsg = `AI未能为操作 '${stepData.description}' 提供选择器。`;
        this.log(runId, errorMsg, 'error');
        throw new Error(errorMsg);
      }
      
      this.log(runId, `AI成功解析步骤: ${stepData.description}`);
      return { step: stepData, remaining };

    } catch (error: any) {
      this.log(runId, `解析AI的下一步响应失败: ${error.message}`, 'error');
      this.log(runId, `原始内容: ${content}`, 'error');
      throw new Error(`解析下一步错误: ${error.message}`);
    }
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
          if (!step.selector || !step.condition) {
            throw new Error(`断言步骤缺少选择器或条件: ${step.description}`);
          }
          break;
        case 'wait':
          if (!step.timeout) {
            throw new Error(`等待步骤缺少超时时间: ${step.description}`);
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

    return `你是一个智能选择器生成器。根据用户意图和页面元素，找到最佳CSS选择器。
用户意图: "${originalStep.description}"
原始选择器: "${originalStep.selector}"

页面元素:
${JSON.stringify(simplifiedElements, null, 2)}

返回最佳的CSS选择器:`;
  }

  // --- 主要的解析方法 ---
  
  public async parseNextStep(remainingStepsText: string, snapshot: any | null, runId: string): Promise<AINextStepParseResult> {
    try {
      this.log(runId, `🧠 AI开始从以下内容解析下一步: "${remainingStepsText}"`);
      const prompt = this.buildNextStepPrompt(remainingStepsText, snapshot);
      const response = await this.callOpenRouter(prompt, runId, 1000);

      if (!response.success || !response.content) {
        return { success: false, error: response.error || 'AI调用失败' };
      }
      
      const parsed = this.parseAINextStepResponse(response.content, runId);

      return {
        success: true,
        step: parsed.step,
        remaining: parsed.remaining,
      };

    } catch (error: any) {
      this.log(runId, `❌ 解析下一步失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  public async parseAssertions(assertionsText: string, snapshot: any, runId:string): Promise<AIParseResult> {
    this.log(runId, `🧠 AI 开始解析断言...`);
    const prompt = this.buildAssertionsPromptWithContext(assertionsText, snapshot);
    const response = await this.callOpenRouter(prompt, runId);

    if (!response.success || !response.content) {
      return { success: false, steps: [], error: 'AI调用失败' };
    }

    const steps = this.parseAIResponse(response.content, runId);
    return { success: true, steps };
  }


  // --- Prompt 构建方法 ---

  private buildAssertionsPromptWithContext(assertionsText: string, snapshot: any): string {
    const pageContext = this.buildPageContext(snapshot);
    return `
You are a web automation expert. Your task is to convert a list of natural language assertions into structured test steps based on the current page snapshot.

**Current Page Snapshot:**
URL: ${snapshot.url}
Title: ${snapshot.title}
\`\`\`json
${pageContext}
\`\`\`

**Assertions to Verify:**
\`\`\`
${assertionsText}
\`\`\`

**Your Task:**
1.  For each assertion, find the corresponding element in the page snapshot.
2.  Create a JSON test step for each assertion using the correct selector from the snapshot.
3.  The action for all these steps **MUST** be "expect".

**Output Format:**
Return a single JSON array of test steps.

**Example:**
If the assertion is "The user 'John Doe' should be visible" and the snapshot contains \`{"selector": "#user-name", "name": "John Doe"}\`, the output should be:
\`\`\`json
[
  {
    "action": "expect",
    "selector": "#user-name",
    "condition": "visible",
    "text": "John Doe",
    "description": "The user 'John Doe' should be visible"
  }
]
\`\`\`

Now, convert the provided assertions.`;
  }
  
  /**
   * @returns The generated prompt string.
   */
  private buildNextStepPrompt(remainingStepsText: string, snapshot: any | null): string {
    const firstLine = remainingStepsText.split('\n')[0].trim();
    
    let prompt = `You are an expert web automation assistant. Your task is to determine the very next step to execute based on a list of remaining steps and, if available, a snapshot of the current web page.

**Test Plan (Remaining Steps):**
\`\`\`
${remainingStepsText}
\`\`\`

**Your Task:**
1.  Analyze the **first line** of the remaining steps: "${firstLine}".
`;

    if (snapshot) {
      const pageContext = this.buildPageContext(snapshot);
      prompt += `
**Current Page Snapshot:**
URL: ${snapshot.url}
Title: ${snapshot.title}

**Visible Interactive Elements on Page:**
\`\`\`json
${pageContext}
\`\`\`

2. From the list of visible elements, find the **best matching element** for this action.
3. **IMPORTANT SELECTOR GUIDELINES:**
   - Each element has multiple possible selectors in the "selectors" array
   - Choose the MOST SPECIFIC selector that uniquely identifies the element
   - Prefer selectors with attributes like placeholder, id, or data-testid over generic class selectors
   - For input fields, ALWAYS check the "attributes" object to find unique identifiers like placeholder text
   - For username/login fields, look for placeholders containing words like "username", "账号", "login", etc.
   - For password fields, look for type="password" or placeholders containing "password", "密码", etc.
   - AVOID using selectors that might match multiple elements
`;
    } else {
      prompt += `
2.  **No page snapshot is available.** You must infer the action from the text alone. This is most likely a 'navigate' action.
`;
    }

    prompt += `
**Output Format:**
Return a single JSON object with two keys:
-   \`nextStep\`: A JSON object for the single next action.
-   \`remainingSteps\`: A string containing all test steps **except** the one you just processed.

**Example (with snapshot):**
If the first step is "Enter 'admin' in the username field" and you find an element with placeholder="Username", your output should be:
\`\`\`json
{
  "nextStep": {
    "action": "fill",
    "selector": "input[placeholder='Username']",
    "value": "admin",
    "description": "Enter 'admin' in the username field"
  },
  "remainingSteps": "<the rest of the steps here>"
}
\`\`\`

**Example (without snapshot):**
If the first step is "Navigate to https://example.com", your output should be:
\`\`\`json
{
  "nextStep": {
    "action": "navigate",
    "url": "https://example.com",
    "description": "Navigate to https://example.com"
  },
  "remainingSteps": "<the rest of the steps here>"
}
\`\`\`

Now, determine the next step for: "${firstLine}"`;
    return prompt;
  }

  private buildPageContext(snapshot: any): string {
    if (!snapshot || !Array.isArray(snapshot.elements) || snapshot.elements.length === 0) {
      return '[]'; // No elements found
    }
    
    // 提供更丰富的元素信息给AI，包括多种选择器和属性
    const elementsForPrompt = snapshot.elements.map((el: any) => {
      // 构建一个简化但信息丰富的元素表示
      const element = {
        // 提供多个可能的选择器，让AI选择最精确的
        selectors: el.selectors || [el.selector || el.bestSelector],
        // 推荐的最佳选择器
        bestSelector: el.bestSelector || el.selector,
        // 元素文本内容
        text: el.text || el.name || '',
        // 元素标签名
        tagName: el.tagName || '',
        // 元素角色
        role: el.attributes?.role || el.role || '',
        // 重要属性
        attributes: {}
      };
      
      // 添加重要属性
      if (el.attributes) {
        // 优先添加这些对识别元素最有用的属性
        const importantAttrs = ['id', 'placeholder', 'name', 'type', 'value', 'aria-label', 'data-testid'];
        importantAttrs.forEach(attr => {
          if (el.attributes[attr]) {
            element.attributes[attr] = el.attributes[attr];
          }
        });
      }
      
      return element;
    });

    return JSON.stringify(elementsForPrompt, null, 2);
  }

  private log(runId: string, message: string, level: 'info' | 'error' | 'warning' = 'info') {
    // Helper for structured logging
    console.log(`[${new Date().toLocaleTimeString()}] [${runId}] [AITestParser] [${level.toUpperCase()}] ${message}`);
  }
} 