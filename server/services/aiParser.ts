import { TestStep } from './mcpClient.js';

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

  /**
   * 使用GPT-4o解析自然语言测试描述
   */
  async parseTestDescription(description: string, testName: string, runId: string): Promise<AIParseResult> {
    try {
      console.log(`[${runId}] 🧠 AI开始解析测试描述:`, description);

      const prompt = this.buildPrompt(description, testName);
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

  /**
   * 混合断言策略解析逻辑
   */
  public async parseAssertions(assertionsText: string, snapshot: any, runId:string): Promise<AIParseResult> {
    try {
      console.log(`[${runId}] 🧠 开始解析断言: "${assertionsText}"`);
      console.log(`[${runId}] 📸 页面快照标题: "${snapshot.title || '无标题'}"`);
      console.log(`[${runId}] 📸 页面快照URL: "${snapshot.url || '未知'}"`);
      
      // 步骤1: 分析断言类型
      const assertionType = this.identifyAssertionType(assertionsText);
      console.log(`[${runId}] 🔍 断言类型识别: ${assertionType}`);
      
      // 步骤2: 提取有效元素选择器列表
      const validSelectors = this.extractValidSelectors(snapshot.elements || []);
      console.log(`[${runId}] 🔍 页面上有效选择器: ${validSelectors.length}个`);
      
      // 步骤3: 使用增强的断言提示
      const prompt = this.buildEnhancedAssertionsPrompt(assertionsText, snapshot, assertionType, validSelectors);
      const response = await this.callOpenRouter(prompt, runId);
      
      if (!response.success || !response.content) {
        throw new Error(response.error || '断言解析失败，返回内容为空');
      }

      const steps = this.parseAIResponse(response.content, runId);
      
      // 步骤4: 验证和修复生成的断言选择器
      const enhancedSteps = await this.enhanceAndVerifyAssertions(steps, snapshot, assertionType, validSelectors, runId);
      
      // 记录每个断言步骤的详情
      enhancedSteps.filter(s => s.action === 'expect').forEach((step, idx) => {
        console.log(`[${runId}] 🔍 断言 #${idx+1}: ${JSON.stringify({
          selector: step.selector,
          condition: step.condition,
          text: step.text,
          description: step.description
        })}`);
      });
      
      return {
        success: true,
        steps: enhancedSteps,
        rawResponse: response.content,
        parsedDetails: {
          assertionsText,
          snapshotUrl: snapshot.url,
          assertionType: assertionType,
          assertionCount: enhancedSteps.filter(s => s.action === 'expect').length,
          method: "混合断言策略"
        }
      };
    } catch (error: any) {
      console.error(`[${runId}] ❌ 断言解析失败:`, error);
      
      // 直接返回错误，让调用者处理
      return {
        success: false,
        steps: [],
        error: `断言解析错误: ${error.message}`,
        rawResponse: error.stack || "无详细错误信息"
      };
    }
  }
  
  /**
   * 识别断言类型
   */
  private identifyAssertionType(assertionsText: string): 'text' | 'attribute' | 'state' | 'visual' | 'relation' {
    assertionsText = assertionsText.toLowerCase();
    
    // 文本相关的断言
    if (assertionsText.match(/显示|文本|内容|包含|提示|消息|出现|文案|显示/)) {
      return 'text';
    }
    
    // 属性相关的断言
    if (assertionsText.match(/属性|禁用|启用|选中|checked|disabled|enabled|selected|属性/)) {
      return 'attribute';
    }
    
    // 状态相关的断言
    if (assertionsText.match(/状态|成功|失败|登录|跳转|导航|url|链接|地址|切换/)) {
      return 'state';
    }
    
    // 视觉相关的断言
    if (assertionsText.match(/颜色|大小|位置|可见|隐藏|visible|hidden|style|样式|图片|图标/)) {
      return 'visual';
    }
    
    // 元素关系相关的断言
    if (assertionsText.match(/前面|后面|内部|包含|父|子|兄弟|下方|上方|旁边|左侧|右侧/)) {
      return 'relation';
    }
    
    // 默认为文本断言
    return 'text';
  }
  
  /**
   * 从页面元素中提取有效选择器
   */
  private extractValidSelectors(elements: any[]): string[] {
    if (!elements || elements.length === 0) {
      return [];
    }
    
    const selectors: string[] = [];
    
    elements.forEach(element => {
      // 基于ID的选择器
      if (element.id) {
        selectors.push(`#${element.id}`);
      }
      
      // 基于class的选择器
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0) {
          selectors.push(`.${classes.join('.')}`);
        }
      }
      
      // 基于标签和属性的选择器
      if (element.tagName) {
        const tag = element.tagName.toLowerCase();
        
        // 输入框
        if (tag === 'input' && element.attributes) {
          // 基于placeholder
          if (element.attributes.placeholder) {
            selectors.push(`input[placeholder='${element.attributes.placeholder}']`);
          }
          
          // 基于type
          if (element.attributes.type) {
            selectors.push(`input[type='${element.attributes.type}']`);
          }
          
          // 基于name
          if (element.attributes.name) {
            selectors.push(`input[name='${element.attributes.name}']`);
          }
        }
        
        // 按钮
        if (tag === 'button' && element.innerText) {
          selectors.push(`button:contains('${element.innerText}')`);
        }
        
        // 链接
        if (tag === 'a' && element.innerText) {
          selectors.push(`a:contains('${element.innerText}')`);
        }
      }
      
      // 基于包含文本的选择器(任何元素)
      if (element.innerText && element.tagName) {
        const text = element.innerText.trim();
        if (text.length > 0) {
          const tag = element.tagName.toLowerCase();
          selectors.push(`${tag}:contains('${text}')`);
          
          // 通用选择器
          if (text.length < 50) { // 避免过长文本
            selectors.push(`:contains('${text}')`);
          }
        }
      }
    });
    
    return [...new Set(selectors)]; // 去重
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
   * 增强的断言提示构建 - 包含类型识别和有效选择器提示
   */
  private buildEnhancedAssertionsPrompt(
    assertionsText: string, 
    snapshot: any, 
    assertionType: string, 
    validSelectors: string[]
  ): string {
    const pageTitle = snapshot.title || '无标题页面';
    const pageUrl = snapshot.url || '未知URL';
    
    // 提取页面上可能的关键元素列表（最多10个）
    const keyElements = this.extractKeyElements(snapshot.elements || []);
    const elementsText = keyElements.length > 0 
      ? `页面上的关键元素:\n${keyElements.join('\n')}` 
      : '页面上没有找到关键元素';
    
    // 提取页面文本内容
    const pageTexts = this.extractPageTexts(snapshot.elements || []);
    const pageTextsStr = pageTexts.length > 0
      ? `页面文本内容:\n${pageTexts.join('\n')}`
      : '未找到页面文本内容';
    
    // 创建有效选择器列表字符串
    const selectorsText = validSelectors.length > 0
      ? `有效的页面选择器: \n${validSelectors.slice(0, 30).join('\n')}`
      : '页面未提供有效选择器';
      
    // 根据断言类型提供特定指导
    let typeSpecificGuidance = '';
    switch(assertionType) {
      case 'text':
        typeSpecificGuidance = `
【文本类型断言】指导:
1. 你的任务是验证页面中是否存在与"${assertionsText}"相关的文本
2. 首先在页面文本内容中查找关键词，提取核心信息（如"密码不能为空"中的"密码"+"不能为空"）
3. 【重要】错误/提示信息通常显示在专门的提示元素中，而不是表单输入框内部
4. 【重要】表单验证错误通常显示在表单字段附近，但不是字段本身
5. 使用contains_text条件，不要求完全匹配，只需包含核心关键词即可
6. 如果找不到精确元素，可以尝试更通用的选择器如错误信息容器(.error, .message, .alert等)`;
        break;
      case 'state':
        typeSpecificGuidance = `
【状态类型断言】指导:
1. 你的任务是验证页面状态变化，如登录成功、操作完成等
2. 检查URL变化、登录状态指示器或成功/失败消息
3. 寻找状态指示元素，如成功图标、欢迎信息等`;
        break;
      case 'visual':
        typeSpecificGuidance = `
【视觉类型断言】指导:
1. 你的任务是验证元素的可见性或视觉状态
2. 检查特定元素是否可见、隐藏或有特定样式`;
        break;
      case 'attribute':
        typeSpecificGuidance = `
【属性类型断言】指导:
1. 你的任务是验证元素属性，如禁用状态、选中状态等
2. 检查表单元素的状态属性是否符合预期`;
        break;
      case 'relation':
        typeSpecificGuidance = `
【关系类型断言】指导:
1. 你的任务是验证元素之间的关系
2. 检查元素的层次结构或相对位置`;
        break;
    }

    return `你是一个专业的Web自动化测试断言专家。你的唯一任务是根据页面信息创建准确的断言步骤，验证页面是否符合预期。

【断言目标】: "${assertionsText}"

【当前页面信息】:
- 标题: ${pageTitle}
- URL: ${pageUrl}
- 断言类型: ${assertionType}

${pageTextsStr}

${elementsText}

${selectorsText}

${typeSpecificGuidance}

【断言要求】:
1. 你必须创建断言步骤，验证"${assertionsText}"是否满足
2. 断言必须精确匹配用户意图，不要过度解释或扩展断言范围
3. 【关键】分析页面文本内容，寻找与断言相关的文本（如错误提示、成功消息）
4. 【重要】仅使用上面列出的"有效的页面选择器"，不要创造不存在的选择器
5. 如果找不到精确匹配的选择器，使用包含相关文本的元素
6. 必要时添加wait步骤等待元素出现（必须设置timeout值）
7. 不要添加navigate操作或其他改变页面状态的操作

【支持的条件类型】:
- visible: 元素可见
- hidden: 元素隐藏
- contains_text: 元素包含指定文本（最常用，推荐）
- url_changed: URL已更改
- logged_in: 登录状态检查

返回严格的JSON数组格式，例如:
[
  {
    "id": "assertion-1",
    "action": "wait",
    "timeout": 3000,
    "description": "等待3秒确保状态更新",
    "order": 1
  },
  {
    "id": "assertion-2",
    "action": "expect",
    "selector": "选择器",
    "condition": "contains_text",
    "text": "关键文本",
    "description": "验证页面包含期望文本",
    "order": 2
  }
]`;
  }

  /**
   * 旧版断言提示构建方法(保留作为兼容和参考)
   */
  private buildAssertionsPromptWithContext(assertionsText: string, snapshot: any): string {
    const pageTitle = snapshot.title || '无标题页面';
    const pageUrl = snapshot.url || '未知URL';
    
    // 提取页面上可能的关键元素列表（最多10个）
    const keyElements = this.extractKeyElements(snapshot.elements || []);
    const elementsText = keyElements.length > 0 
      ? `页面上的关键元素:\n${keyElements.join('\n')}` 
      : '页面上没有找到关键元素';

    return `你是一个专业的Web自动化测试专家。请根据当前页面信息和预期结果，创建准确的断言步骤。

当前页面信息:
- 标题: ${pageTitle}
- URL: ${pageUrl}
- 当前时间: ${new Date().toISOString()}

${elementsText}

用户期望的测试结果: "${assertionsText}"

要求:
1. 创建一系列断言步骤，验证页面是否满足预期结果
2. 对所有类型的断言采用相同的分析逻辑，不要特殊处理某种类型
3. 根据页面上下文提供合适的验证步骤，如验证特定元素存在、文本内容匹配等
4. 对于页面上找不到相关元素的情况，可以添加wait步骤等待元素出现
5. 优先使用可见文本和语义化元素进行断言
6. 严禁添加navigate操作，不要离开当前页面

支持的条件类型:
- visible: 元素可见
- hidden: 元素隐藏
- contains_text: 元素包含指定文本
- url_changed: URL已更改
- logged_in: 登录状态检查

返回严格的JSON数组格式，例如:
[
  {
    "id": "assertion-1",
    "action": "expect",
    "selector": ".welcome-message",
    "condition": "visible",
    "description": "验证欢迎消息可见",
    "order": 1
  },
  {
    "id": "assertion-2", 
    "action": "expect",
    "selector": ".username-display",
    "condition": "contains_text",
    "text": "用户名",
    "description": "验证用户名显示正确",
    "order": 2
  }
]`;
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

  /**
   * 优化日志输出方法
   */
  private log(runId: string, message: string, level: 'info' | 'error' | 'warning' = 'info') {
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '📝';
    console.log(`[${runId}] ${prefix} ${message}`);
  }

  /**
   * 优化executeStep方法，添加url_changed条件支持
   */
  public extendMcpClientWithCustomConditions(mcpClient: any) {
    // 保存原始的executeStep方法
    const originalExecuteStep = mcpClient.executeStep;
    
    // 替换为支持自定义条件的版本
    mcpClient.executeStep = async (step: TestStep): Promise<any> => {
      // 处理自定义条件
      if (step.action === 'expect' && step.condition === 'url_changed') {
        try {
          const page = mcpClient.page;
          if (!page) {
            throw new Error('页面不存在');
          }
          
          // 获取当前URL
          const currentUrl = page.url();
          
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
                  message: `URL已更改且包含"${step.url}"`
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
              message: `URL已更改: ${currentUrl}`
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
} 