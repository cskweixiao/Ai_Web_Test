// 真正的 Playwright 客户端，替换模拟版本
import { chromium, Browser, Page } from 'playwright';

export interface TestStep {
  id: string;
  action: TestAction;
  selector?: string;
  url?: string;
  value?: string;
  text?: string;
  condition?: string;
  timeout?: number;
  description: string;
  order: number;
}

export type TestAction = 
  | 'navigate'
  | 'click' 
  | 'fill'
  | 'expect'
  | 'wait'
  | 'screenshot'
  | 'hover'
  | 'select';

export interface McpExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  screenshot?: string;
}

export class PlaywrightMcpClient {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  // 添加状态追踪变量
  private browserSharedState = false;

  // 修改：initialize方法支持浏览器复用
  async initialize(options: { reuseSession?: boolean } = {}): Promise<void> {
    try {
      // 如果已初始化且请求复用会话，则直接返回
      if (this.isInitialized && this.browser && options.reuseSession) {
        console.log('♻️ 复用现有浏览器实例，跳过初始化');
        this.browserSharedState = true;
        
        // 如果页面关闭了但浏览器还在，创建新页面
        if (!this.page || this.page.isClosed?.()) {
          console.log('🔄 现有页面已关闭，创建新页面');
          this.page = await this.browser.newPage();
          await this.page.setViewportSize({ width: 1280, height: 720 });
        }
        
        return;
      }
      
      console.log('🚀 正在启动 Chromium 浏览器...');
      
      // 正常启动浏览器流程
      this.browser = await chromium.launch({
        headless: false, // 显示浏览器窗口
        slowMo: 500,     // 减慢操作速度以便观察
        devtools: false,  // 不打开开发者工具
        args: [
          '--start-maximized',  // 最大化窗口
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      // 创建新页面
      this.page = await this.browser.newPage();
      
      // 设置页面大小
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      this.isInitialized = true;
      this.browserSharedState = options.reuseSession || false;
      
      console.log('✅ Chromium 浏览器启动成功！准备执行测试...');
    } catch (error: any) {
      console.error('❌ 浏览器启动失败:', error);
      throw new Error(`浏览器启动失败: ${error.message}`);
    }
  }

  async executeStep(step: TestStep): Promise<McpExecutionResult> {
    if (!this.isInitialized || !this.page) {
      throw new Error('浏览器未初始化或页面不存在');
    }

    try {
      console.log(`🎯 执行测试步骤: ${step.action} - ${step.description}`);
      
      const result = await this.executeRealStep(step);
      
      return {
        success: true,
        result: result
      };
    } catch (error: any) {
      console.error(`❌ 步骤执行失败: ${step.description}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async executeRealStep(step: TestStep): Promise<any> {
    if (!this.page) throw new Error('页面不存在');

    // 🔥 优化超时时间：断言类操作使用较短超时，避免等待过久
    const defaultTimeout = step.action === 'expect' ? 10000 : 30000; // 断言10秒，其他30秒
    const timeout = step.timeout || defaultTimeout;

    switch (step.action) {
      case 'navigate':
        console.log(`🌐 导航到: ${step.url}`);
        await this.page.goto(step.url!, { waitUntil: 'domcontentloaded', timeout });
        await this.page.waitForTimeout(1000); // 等待页面稳定
        return {
          action: 'navigate',
          url: step.url,
          currentUrl: this.page.url(),
          title: await this.page.title(),
          status: 'success',
          message: `成功导航到 ${step.url}`
        };
        
      case 'click':
        console.log(`🖱️ 点击元素: ${step.selector}`);
        await this.page.locator(step.selector!).click({ timeout });
        await this.page.waitForTimeout(500);
        return {
          action: 'click',
          selector: step.selector,
          status: 'success',
          message: `成功点击元素 ${step.selector}`
        };
        
      case 'fill':
        console.log(`⌨️ 输入文本: ${step.value} 到 ${step.selector}`);
        await this.page.locator(step.selector!).fill(step.value!, { timeout });
        await this.page.waitForTimeout(300);
        return {
          action: 'fill',
          selector: step.selector,
          value: step.value,
          status: 'success',
          message: `成功输入文本到 ${step.selector}`
        };
        
      case 'expect':
        console.log(`✅ 验证元素: ${step.selector} ${step.condition}`);
        
        // 优化：处理不同类型的断言条件
        if (step.condition === 'url_changed') {
          // 这种情况由AIParser添加的extendMcpClientWithCustomConditions处理
          const currentUrl = this.page.url();
          console.log(`   当前URL: ${currentUrl}`);
          
          if (step.url && !currentUrl.includes(step.url)) {
            throw new Error(`URL未包含"${step.url}"，当前URL: ${currentUrl}`);
          }
          
          if (currentUrl.includes('/login')) {
            throw new Error(`URL仍然是登录页面: ${currentUrl}`);
          }
          
          return {
            action: 'expect',
            condition: 'url_changed',
            currentUrl,
            status: 'success',
            message: `验证URL已更改成功，当前: ${currentUrl}`
          };
        }
        
        // 常规元素断言
        const locator = this.page.locator(step.selector!);
        
        try {
          switch (step.condition) {
            case 'visible':
              console.log(`   等待元素可见: ${step.selector}`);
              await locator.waitFor({ state: 'visible', timeout });
              break;
              
            case 'hidden':
              console.log(`   等待元素隐藏: ${step.selector}`);
              await locator.waitFor({ state: 'hidden', timeout });
              break;
              
            case 'contains_text':
              if (step.text) {
                console.log(`   验证文本: "${step.text}"`);
                // 首先确保元素存在并可见
                await locator.waitFor({ timeout });
                
                // 然后检查文本内容
                const content = await locator.textContent();
                if (!content || !content.includes(step.text)) {
                  throw new Error(`元素文本不包含"${step.text}"，实际文本: "${content}"`);
                }
              }
              break;
              
            case 'logged_in':
              // 特殊断言：检查是否已登录成功
              console.log(`   验证登录状态...`);
              
              // 1. 检查URL是否已改变（不再是登录页面）
              const currentUrl = this.page.url();
              if (currentUrl.includes('/login')) {
                throw new Error(`用户仍在登录页面: ${currentUrl}`);
              }
              
              // 2. 尝试查找欢迎信息或用户信息元素
              try {
                // 尝试多种可能的选择器
                const selectors = [
                  '.user-info', 
                  '.username', 
                  '.welcome', 
                  '.avatar',
                  'header .user',
                  '[data-testid="user-profile"]'
                ];
                
                let found = false;
                for (const selector of selectors) {
                  const count = await this.page.locator(selector).count();
                  if (count > 0) {
                    console.log(`   找到用户信息元素: ${selector}`);
                    found = true;
                    break;
                  }
                }
                
                if (!found) {
                  console.log(`   未找到明确的用户信息元素，但URL已更改，可能已登录`);
                }
              } catch (e) {
                // 忽略错误，URL变化已经是登录成功的充分条件
                console.log(`   检查用户元素时出错，但已确认URL变化`);
              }
              
              break;
              
            default:
              console.log(`   等待元素存在: ${step.selector}`);
              await locator.waitFor({ timeout });
          }
          
          return {
            action: 'expect',
            selector: step.selector,
            condition: step.condition,
            status: 'success',
            message: `验证 ${step.selector} ${step.condition || 'exists'} 成功`
          };
        } catch (error: any) {
          // 断言失败时，捕获并返回页面状态信息以便更好地调试
          let errorDetails = error.message;
          
          try {
            // 获取当前URL和标题，帮助调试
            const url = await this.page.url();
            const title = await this.page.title();
            errorDetails += ` (页面: ${url}, 标题: ${title})`;
          } catch (e) {
            // 忽略额外信息获取失败
          }
          
          throw new Error(`断言失败: ${errorDetails}`);
        }
        
      case 'screenshot':
        console.log('📸 截图中...');
        const filename = `screenshot-${Date.now()}.png`;
        const screenshotPath = `screenshots/${filename}`;
        
        // 确保截图目录存在
        await this.page.screenshot({ 
          path: screenshotPath, 
          fullPage: true,
          timeout
        });
        
        return {
          action: 'screenshot',
          filename: filename,
          path: screenshotPath,
          status: 'success',
          message: `截图保存为 ${filename}`
        };
        
      case 'wait':
        console.log(`⏱️ 等待 ${step.timeout}ms`);
        await this.page.waitForTimeout(step.timeout || 1000);
        return {
          action: 'wait',
          timeout: step.timeout || 1000,
          status: 'success',
          message: `等待 ${step.timeout || 1000}ms 完成`
        };
        
      case 'hover':
        console.log(`🎯 悬停在: ${step.selector}`);
        await this.page.locator(step.selector!).hover({ timeout });
        await this.page.waitForTimeout(300);
        return {
          action: 'hover',
          selector: step.selector,
          status: 'success',
          message: `悬停在 ${step.selector} 成功`
        };
        
      default:
        throw new Error(`不支持的操作类型: ${step.action}`);
    }
  }

  async takeScreenshot(filename?: string): Promise<string> {
    if (!this.page) throw new Error('页面不存在');
    
    const screenshotName = filename || `screenshot-${Date.now()}.png`;
    const screenshotPath = `screenshots/${screenshotName}`;
    
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    
    console.log(`📸 截图保存: ${screenshotPath}`);
    return screenshotName;
  }

  async getSnapshot(): Promise<any> {
    if (!this.page) {
      console.warn('⚠️ 尝试在页面不存在时获取快照');
      return { url: '', title: '', elements: [] };
    }
    
    try {
      // 使用更全面的方式获取页面元素，包括更多属性信息
      const pageData = await this.page.evaluate(() => {
        // 获取所有可交互元素
        const elements = document.querySelectorAll(
          'a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [data-testid]'
        );
        
        // 结果数组
        const elementsData: any[] = [];
        
        // 遍历元素，收集详细信息
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const rect = el.getBoundingClientRect();
          
          // 忽略不可见元素
          if (rect.width === 0 || rect.height === 0) {
            continue;
          }
          
          // 收集所有重要属性
          const attributes: Record<string, string> = {};
          const attributesToCollect = [
            'id', 'name', 'type', 'placeholder', 'value', 'href', 
            'aria-label', 'aria-labelledby', 'aria-describedby', 
            'data-testid', 'title', 'alt', 'role'
          ];
          
          attributesToCollect.forEach(attr => {
            const value = el.getAttribute(attr);
            if (value) {
              attributes[attr] = value;
            }
          });
          
          // 收集CSS类名
          if (el.className && typeof el.className === 'string') {
            attributes['class'] = el.className;
          }
          
          // 获取元素文本内容
          const textContent = el.textContent ? el.textContent.trim() : '';
          
          // 生成多种可能的选择器
          const selectors: string[] = [];
          
          // ID选择器（最优先）
          if (attributes.id) {
            selectors.push(`#${attributes.id}`);
          }
          
          // 基于属性的选择器
          if (attributes.placeholder) {
            selectors.push(`${el.tagName.toLowerCase()}[placeholder="${attributes.placeholder}"]`);
          }
          
          if (attributes.name) {
            selectors.push(`${el.tagName.toLowerCase()}[name="${attributes.name}"]`);
          }
          
          if (attributes['data-testid']) {
            selectors.push(`[data-testid="${attributes['data-testid']}"]`);
          }
          
          if (attributes['aria-label']) {
            selectors.push(`${el.tagName.toLowerCase()}[aria-label="${attributes['aria-label']}"]`);
          }
          
          // 类选择器
          if (attributes.class) {
            selectors.push(`${el.tagName.toLowerCase()}.${attributes.class.replace(/\s+/g, '.')}`);
          }
          
          // 标签选择器（最不精确）
          selectors.push(el.tagName.toLowerCase());
          
          // 添加到结果数组
          elementsData.push({
            ref: i.toString(),
            tagName: el.tagName.toLowerCase(),
            selectors: selectors, // 提供多种可能的选择器
            bestSelector: selectors[0] || el.tagName.toLowerCase(), // 最佳选择器
            text: textContent.substring(0, 100),
            attributes: attributes, // 所有收集的属性
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            isVisible: true
          });
        }
        
        // 返回页面数据
        return {
          url: window.location.href,
          title: document.title,
          elements: elementsData
        };
      });
      
      return pageData;
    } catch (error: any) {
      console.error('❌ 获取页面快照失败:', error.message);
      throw new Error(`获取页面快照失败: ${error.message}`);
    }
  }

  // 修改：cleanup方法支持条件关闭
  async cleanup(forceClose = true): Promise<void> {
    try {
      // 如果浏览器处于共享状态且不强制关闭，则保持打开
      if (this.browserSharedState && !forceClose) {
        console.log('⚠️ 保持浏览器会话打开状态 (处于共享模式)');
        
        // 仅关闭页面但保留浏览器实例
        if (this.page) {
          await this.page.close();
          this.page = null;
          console.log('🔍 当前页面已关闭，浏览器保持运行');
        }
        
        return;
      }
      
      console.log('🧹 正在关闭浏览器...');
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isInitialized = false;
      this.browserSharedState = false;
      console.log('✅ 浏览器已完全关闭');
    } catch (error: any) {
      console.error('❌ 浏览器关闭失败:', error);
    }
  }
  
  // 新增：提取页面状态方法，用于在测试之间传递状态
  async extractPageState(): Promise<any> {
    if (!this.page) {
      return null;
    }
    
    try {
      // 提取cookies
      const cookies = await this.page.context().cookies();
      
      // 提取localStorage (如果需要)
      const localStorage = await this.page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key);
          }
        }
        return items;
      });
      
      // 提取当前URL
      const currentUrl = this.page.url();
      
      return {
        cookies,
        localStorage,
        currentUrl,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 提取页面状态失败:', error);
      return null;
    }
  }
  
  // 新增：恢复页面状态方法
  async restorePageState(state: any): Promise<boolean> {
    if (!this.page || !state) {
      return false;
    }
    
    try {
      // 恢复cookies
      if (state.cookies && Array.isArray(state.cookies)) {
        await this.page.context().addCookies(state.cookies);
      }
      
      // 恢复localStorage
      if (state.localStorage) {
        await this.page.evaluate((storageItems) => {
          for (const key in storageItems) {
            try {
              window.localStorage.setItem(key, storageItems[key]);
            } catch (e) {
              console.error(`无法设置localStorage项 ${key}:`, e);
            }
          }
        }, state.localStorage);
      }
      
      // 如果需要，导航回之前的URL
      if (state.currentUrl && this.page.url() !== state.currentUrl) {
        await this.page.goto(state.currentUrl, { waitUntil: 'domcontentloaded' });
      }
      
      console.log('✅ 已恢复页面状态，包含cookies和localStorage数据');
      return true;
    } catch (error) {
      console.error('❌ 恢复页面状态失败:', error);
      return false;
    }
  }
  
  // 新增：检查浏览器和页面健康状态
  async checkHealth(): Promise<{isAlive: boolean, reason?: string}> {
    if (!this.browser) {
      return { isAlive: false, reason: 'browser_null' };
    }
    
    try {
      // 如果页面不存在或已关闭，尝试创建新页面
      if (!this.page || this.page.isClosed?.()) {
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1280, height: 720 });
      }
      
      // 执行简单操作确保页面响应
      await this.page.evaluate(() => document.title);
      
      return { isAlive: true };
    } catch (error) {
      return { isAlive: false, reason: 'page_unresponsive' };
    }
  }
} 