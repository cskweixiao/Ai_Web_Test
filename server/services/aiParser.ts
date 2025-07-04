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
  async parseTestDescription(description: string, testName: string): Promise<AIParseResult> {
    try {
      console.log('🧠 AI开始解析测试描述:', description);

      const prompt = this.buildPrompt(description, testName);
      const response = await this.callOpenRouter(prompt);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || 'AI调用失败或返回内容为空');
      }

      const steps = this.parseAIResponse(response.content);
      
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
   * 验证生成的测试步骤
   */
  private validateSteps(steps: TestStep[]): void {
    for (const step of steps) {
      switch (step.action) {
        case 'navigate':
          if (!step.url) {
            throw new Error(`导航步骤缺少URL: ${step.description}`);
          }
          // 修复常见URL错误
          step.url = this.fixUrl(step.url);
          break;
          
        case 'click':
        case 'hover':
          if (!step.selector) {
            throw new Error(`${step.action}步骤缺少选择器: ${step.description}`);
          }
          break;
          
        case 'fill':
          if (!step.selector || !step.value) {
            throw new Error(`输入步骤缺少选择器或值: ${step.description}`);
          }
          break;
          
        case 'expect':
          if (!step.selector) {
            throw new Error(`验证步骤缺少选择器: ${step.description}`);
          }
          step.condition = step.condition || 'visible';
          break;
      }
    }
  }

  /**
   * 修复URL错误
   */
  private fixUrl(url: string): string {
    // 修复常见错误
    url = url.replace(/2www\./g, 'www.');
    url = url.replace(/\s+/g, '');
    
    // 确保有协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    return url;
  }

  /**
   * 🔥 新增：结合页面上下文，生成更精准的选择器
   */
  async generateSelectorWithContext(
    originalStep: TestStep,
    pageElements: any[]
  ): Promise<string> {
    console.log(`🤖 正在为步骤 "${originalStep.description}" 结合上下文生成选择器...`);
    const prompt = this.buildContextualSelectorPrompt(originalStep, pageElements);
    
    try {
      const response = await this.callOpenRouter(prompt);
      if (!response.success || !response.content) {
        throw new Error('AI未能生成选择器');
      }
      
      // AI应该直接返回选择器字符串，去除可能的引号
      const selector = response.content.replace(/['"`]/g, '').trim();

      if (selector === 'SELECTOR_NOT_FOUND' || selector.length < 2) {
         throw new Error('AI在当前页面未找到匹配的元素');
      }

      console.log(`✅ AI生成了新的选择器: ${selector}`);
      return selector;

    } catch (error) {
      console.error('❌ 结合上下文生成选择器失败:', error);
      // 返回原始选择器作为备用
      return originalStep.selector || '';
    }
  }

  private buildContextualSelectorPrompt(
    originalStep: TestStep,
    pageElements: any[]
  ): string {
    const simplifiedElements = JSON.stringify(pageElements, null, 2);

    return `你是一个顶级的Web自动化测试专家，擅长从页面的DOM结构中找到最合适的元素。

你的任务:
根据用户的操作指令和当前页面上所有可交互元素的列表(JSON格式)，找出一个最匹配该操作的CSS选择器。

用户操作指令: "${originalStep.description}"
(这是一个 ${originalStep.action} 操作)

当前页面上的可交互元素列表:
\`\`\`json
${simplifiedElements}
\`\`\`

重要规则:
1.  仔细分析 "用户操作指令"，理解用户的意图。
2.  在 "当前页面上的可交互元素列表" 中，找到一个最符合用户意图的元素。
3.  根据找到的元素，构建一个精准、稳定、唯一的CSS选择器。优先使用 'id', 'data-testid', 'name' 等唯一属性。如果都没有，再考虑 'placeholder' 或元素文本。
4.  **只返回最终的CSS选择器字符串**，不要包含任何解释、代码块标记或多余的引号。
5.  如果分析后认为页面上没有任何元素能匹配用户的操作指令，则严格返回 "SELECTOR_NOT_FOUND"。

例如，如果指令是 "点击登录按钮"，你在元素列表里找到了一个JSON对象，内容为 '{"tag": "button", "text": "登录", "id": "login-btn"}'，那么你应该直接返回:
#login-btn
`;
  }

  /**
   * 测试AI解析功能
   */
  async testParse(description: string): Promise<void> {
    console.log('🧪 测试AI解析功能');
    console.log('输入描述:', description);
    
    const result = await this.parseTestDescription(description, '测试用例');
    
    console.log('解析结果:', result);
    if (result.success) {
      console.log('生成的测试步骤:');
      result.steps.forEach((step, i) => {
        console.log(`${i + 1}. ${step.action}: ${step.description}`);
      });
    }
  }

  /**
   * 🔥 新增：分别解析测试步骤和断言预期
   */
  async parseTestStepsAndAssertions(
    stepsText: string, 
    assertionsText: string, 
    testName: string
  ): Promise<{
    stepsResult: AIParseResult;
    assertionsResult: AIParseResult;
  }> {
    try {
      console.log('🧠 AI开始分别解析测试步骤和断言预期');
      console.log('📝 测试步骤:', stepsText);
      console.log('🎯 断言预期:', assertionsText);

      // 并行解析测试步骤和断言预期
      const [stepsResult, assertionsResult] = await Promise.all([
        this.parseTestSteps(stepsText, testName),
        this.parseAssertions(assertionsText, testName)
      ]);

      return {
        stepsResult,
        assertionsResult
      };

    } catch (error: any) {
      console.error('❌ AI解析失败:', error);
      return {
        stepsResult: {
          success: false,
          steps: [],
          error: error.message
        },
        assertionsResult: {
          success: false,
          steps: [],
          error: error.message
        }
      };
    }
  }

  /**
   * 🔥 新增：专门解析测试步骤
   */
  async parseTestSteps(stepsText: string, testName: string): Promise<AIParseResult> {
    console.log('🧠 AI解析测试步骤:', stepsText);

    const prompt = this.buildStepsPrompt(stepsText, testName);
    const response = await this.callOpenRouter(prompt);
    
    if (!response.success || !response.content) {
      return { success: false, steps: [], error: 'AI call failed' };
    }

    const steps = this.parseAIResponse(response.content);
    
    console.log('✅ 测试步骤解析完成，生成', steps.length, '个操作步骤');
    return {
      success: true,
      steps
    };
  }

  /**
   * 🔥 新增：专门解析断言预期
   */
  async parseAssertions(assertionsText: string, testName: string): Promise<AIParseResult> {
    console.log('🧠 AI解析断言预期:', assertionsText);

    if (!assertionsText.trim()) {
      console.log('⚠️ 断言预期为空，跳过解析');
      return {
        success: true,
        steps: []
      };
    }

    const prompt = this.buildAssertionsPrompt(assertionsText, testName);
    const response = await this.callOpenRouter(prompt);
    
    if (!response.success || !response.content) {
      throw new Error(response.error || 'AI调用失败或返回内容为空');
    }

    const assertions = this.parseAIResponse(response.content);
    
    console.log('✅ 断言预期解析完成，生成', assertions.length, '个断言步骤');
    return {
      success: true,
      steps: assertions
    };
  }

  /**
   * 🔥 新增：构建测试步骤的Prompt
   */
  private buildStepsPrompt(stepsText: string, testName?: string): string {
    return `你是一个专业的Web自动化测试专家。请将以下自然语言描述的**所有步骤**转换为一个结构化的JSON数组。

测试用例名称: ${testName || '未命名'}
测试描述: ${stepsText}

要求:
1.  **完整性**: 必须解析输入文本中的所有操作步骤。
2.  **准确性**: 智能识别操作类型 (navigate, click, fill, 等) 和相关的参数 (selector, value, url)。
3.  **严格格式**: 返回一个严格的JSON数组，不包含任何其他解释性文字。

每个步骤的JSON对象格式:
{
  "id": "step-N",
  "action": "操作类型",
  "selector": "CSS选择器 (如果适用)",
  "url": "网址 (用于 navigate)",
  "value": "输入值 (用于 fill)",
  "text": "期望文本 (用于 expect)",
  "condition": "验证条件 (用于 expect, e.g., 'visible', 'contains_text')",
  "timeout": 等待时间(毫秒),
  "description": "步骤的自然语言描述",
  "order": 步骤顺序 (从1开始)
}

这是一个例子:
输入: "打开百度，搜索'AI'，然后点击搜索按钮"
输出:
[
  { "id": "step-1", "action": "navigate", "url": "https://www.baidu.com", "description": "打开百度", "order": 1 },
  { "id": "step-2", "action": "fill", "selector": "#kw", "value": "AI", "description": "搜索'AI'", "order": 2 },
  { "id": "step-3", "action": "click", "selector": "#su", "description": "点击搜索按钮", "order": 3 }
]

现在，请解析以下文本:
${stepsText}
`;
  }

  /**
   * 🔥 新增：构建断言预期的Prompt
   */
  private buildAssertionsPrompt(assertionsText: string, testName: string): string {
    return `你是一个专业的Web自动化测试专家。请将以下自然语言描述的**所有断言**转换为一个结构化的JSON数组。

测试用例名称: ${testName}
断言描述: ${assertionsText}

⚠️ 重要要求:
1. 断言预期只能生成验证类型的操作，不能包含navigate、click、fill等会改变页面状态的操作
2. 断言是在当前页面上进行验证，不会跳转到其他页面
3. 智能识别页面元素和文本内容的验证
4. 返回严格的JSON数组格式，不要任何其他文字

🔥 断言预期支持的操作类型（仅限验证类）:
- expect: 验证元素存在/可见/包含文本
- wait: 等待元素出现
- screenshot: 截图记录

每个断言步骤的JSON对象格式:
{
  "id": "assertion-N",
  "action": "expect",
  "selector": "CSS选择器",
  "text": "期望文本 (如果适用)",
  "condition": "验证条件 ('visible', 'hidden', 'contains_text', 'equal_text')",
  "description": "断言的自然语言描述",
  "order": 断言顺序 (从1开始)
}

例如:
[
  {
    "id": "assertion-1",
    "action": "expect",
    "selector": "h1.title",
    "text": "欢迎回来",
    "condition": "contains_text",
    "description": "验证页面标题包含'欢迎回来'",
    "order": 1
  }
]`;
  }

  public async parseSteps(stepsText: string, runId: string): Promise<AIParseResult> {
    this.log(runId, `🧠 AI开始解析测试步骤: ${stepsText}`);
    const prompt = this.buildStepsPrompt(stepsText);
    const response = await this.callOpenRouter(prompt, runId);

    if (!response.success || !response.content) {
      return { success: false, steps: [], error: 'AI call failed' };
    }
    const steps = this.parseAIResponse(response.content, runId);
    this.log(runId, `✅ 测试步骤解析完成，生成 ${steps.length} 个操作步骤`);
    return { success: true, steps };
  }

  public async parseAssertions(assertionsText: string, snapshot: any, runId: string): Promise<AIParseResult> {
    this.log(runId, `🧠 AI开始解析断言: ${assertionsText}`);
    const prompt = this.buildAssertionsPrompt(assertionsText, snapshot);
    const response = await this.callOpenRouter(prompt, runId);

    if (!response.success || !response.content) {
      return { success: false, steps: [], error: 'AI call failed' };
    }
    const steps = this.parseAIResponse(response.content, runId);
    this.log(runId, `✅ 断言预期解析完成，生成 ${steps.length} 个断言步骤`);
    return { success: true, steps };
  }
  
  public async parseNextStep(remainingStepsText: string, snapshot: any, runId: string): Promise<AINextStepParseResult> {
    this.log(runId, `🧠 AI开始解析下一步操作 from: "${remainingStepsText}"`);
    const prompt = this.buildNextStepPrompt(remainingStepsText, snapshot);
    const response = await this.callOpenRouter(prompt, runId, 1000);

    if (!response.success || !response.content) {
      return { success: false, error: 'AI call failed' };
    }

    try {
      const { step, remaining } = this.parseNextStepResponse(response.content, runId);
      if (step) {
        this.log(runId, `✅ AI解析出下一步: ${step.description}`);
      }
      return { success: true, step, remaining };
    } catch (error: any) {
      this.log(runId, `❌ 解析下一步操作失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  private parseNextStepResponse(content: string, runId: string): { step?: TestStep, remaining: string } {
    try {
      const cleanContent = this.extractJson(content, 'object');
      const parsedJson = JSON.parse(cleanContent);
      const { next_step: stepData, remaining_text: remainingText } = parsedJson;

      if (typeof remainingText === 'undefined') {
        throw new Error('AI响应缺少 "remaining_text" 字段');
      }
      if (!stepData) {
        return { remaining: remainingText };
      }
      this.validateSteps([stepData]);
      return { step: stepData, remaining: remainingText };
    } catch (error: any) {
      this.log(runId, `解析AI下一步响应失败: ${error.message}`, 'error');
      this.log(runId, `原始内容: ${content}`, 'error');
      // If parsing fails, assume the whole text is remaining to avoid infinite loops
      return { remaining: content };
    }
  }

  private extractJson(content: string, type: 'object' | 'array'): string {
    const pattern = type === 'object' ? /{[\s\S]*}/ : /\[[\s\S]*\]/;
    let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const match = cleanContent.match(pattern);
    if (match) {
      return match[0];
    }
    // Handle cases where AI might not return a markdown block
    if ( (type === 'object' && cleanContent.startsWith('{')) || (type === 'array' && cleanContent.startsWith('[')) ) {
      return cleanContent;
    }
    throw new Error(`AI响应中没有找到有效的JSON ${type}`);
  }

  private buildNextStepPrompt(remainingStepsText: string, snapshot: any): string {
    const pageContext = this.buildPageContext(snapshot);
    return `你是一个专业的Web自动化测试专家，正在进行**分步式**测试执行。
你的任务是：只从下面的文本中解析出**第一个**可执行的操作，并返回这个操作和**剩余未解析**的文本。
${pageContext}
待处理的测试文本: "${remainingStepsText}"

🔥 **严格支持的操作类型**（必须使用这些类型）:
- **navigate**: 打开网页（用于"打开"、"访问"、"跳转"等）
- **click**: 点击元素（用于"点击"、"选择"等）
- **fill**: 填写表单（用于"输入"、"填写"等）
- **expect**: 验证元素（用于"验证"、"检查"等）
- **wait**: 等待（用于"等待"等）
- **screenshot**: 截图
- **hover**: 悬停

要求:
1.  **只解析第一步**: 仅识别并返回第一个动作。
2.  **必须使用标准操作类型**: 只能使用上面列出的操作类型，不能自创。
3.  **利用上下文**: 根据上面提供的页面元素信息，生成最准确的CSS选择器。
4.  **返回剩余文本**: 必须准确返回尚未处理的剩余文本。
5.  **严格的JSON格式**: 你的回答必须是包裹在一个JSON对象中的。

next_step 对象格式:
{
  "id": "step-1",
  "action": "操作类型（从上面列表选择）",
  "selector": "CSS选择器（如果需要）",
  "url": "网址（仅用于navigate）",
  "value": "输入值（仅用于fill）", 
  "text": "期望文本（仅用于expect）",
  "condition": "验证条件（仅用于expect）",
  "description": "步骤的详细描述",
  "order": 1
}

返回的JSON格式:
{ "next_step": { ... }, "remaining_text": "..." }

示例：
输入: "打开百度首页，然后搜索关键词"
输出: 
{
  "next_step": {
    "id": "step-1",
    "action": "navigate",
    "url": "https://www.baidu.com",
    "description": "打开百度首页",
    "order": 1
  },
  "remaining_text": "然后搜索关键词"
}

现在，请处理以下文本:
"${remainingStepsText}"`;
  }
  
  private buildPageContext(snapshot: any): string {
    if (!snapshot || !snapshot.url) return '当前没有页面上下文。';
    
    const elementInfo = snapshot.elements?.slice(0, 15).map((el:any) => ({
      tag: el.tag,
      text: el.text,
      attributes: el.attributes
    }));
    
    return `当前页面URL: ${snapshot.url}
当前页面标题: ${snapshot.title}
页面可见元素 (部分):
${JSON.stringify(elementInfo, null, 2)}
`;
  }
  
  private log(runId: string, message: string, level: 'info' | 'error' = 'info') {
      const logMessage = `[AITestParser][${runId}] ${message}`;
      if (level === 'error') {
          console.error(logMessage);
      } else {
          console.log(logMessage);
      }
  }
} 