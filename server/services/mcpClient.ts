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

  async initialize(): Promise<void> {
    try {
      console.log('🚀 正在启动 Chromium 浏览器...');
      
      // 启动真正的 Chromium 浏览器
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
        const locator = this.page.locator(step.selector!);
        
        switch (step.condition) {
          case 'visible':
            await locator.waitFor({ state: 'visible', timeout });
            break;
          case 'hidden':
            await locator.waitFor({ state: 'hidden', timeout });
            break;
          case 'contains_text':
            if (step.text) {
              await locator.filter({ hasText: step.text }).waitFor({ timeout });
            }
            break;
          default:
            await locator.waitFor({ timeout });
        }
        
        return {
          action: 'expect',
          selector: step.selector,
          condition: step.condition,
          status: 'success',
          message: `验证 ${step.selector} ${step.condition} 成功`
        };
        
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
      return {
        url: '',
        title: '',
        elements: [],
      };
    }
    
    const pageData = await this.page.evaluate(() => {
        const interactiveElements = Array.from(document.querySelectorAll(
            'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [onclick]'
        ));

        return {
            url: window.location.href,
            title: document.title,
            elements: interactiveElements.map(el => {
                const element = el as HTMLElement;
                return {
                    tag: element.tagName.toLowerCase(),
                    text: element.innerText.trim().slice(0, 100),
                    attributes: {
                        id: element.id,
                        'data-testid': element.getAttribute('data-testid'),
                        class: element.className,
                        name: element.getAttribute('name'),
                        placeholder: element.getAttribute('placeholder'),
                        href: element.getAttribute('href'),
                    }
                }
            })
        };
    });

    return pageData;
  }

  async getPageSnapshot(): Promise<any> {
    if (!this.page) throw new Error('页面不存在');
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      viewport: this.page.viewportSize(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 🔥 新增：获取页面上所有可交互的元素
   */
  async getPageInteractiveElements(): Promise<any[]> {
    if (!this.page) throw new Error('页面不存在');

    console.log('🔍 正在扫描页面上的可交互元素...');

    const elements = await this.page.evaluate(() => {
      const selectors = [
        'a', 'button', 'input:not([type="hidden"])', 'textarea', 'select',
        '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
        '[data-testid]'
      ].join(',');

      const visibleElements = Array.from(document.querySelectorAll(selectors)).filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      });

      return visibleElements.map(el => {
        const elementInfo: any = {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          name: el.getAttribute('name'),
          'data-testid': el.getAttribute('data-testid'),
          placeholder: el.getAttribute('placeholder'),
          text: el.textContent?.trim().slice(0, 100) || el.getAttribute('aria-label') || el.getAttribute('value'),
          class: el.className,
        };
        // 清理空值
        return Object.fromEntries(Object.entries(elementInfo).filter(([_, v]) => v != null && v !== ''));
      });
    });

    console.log(`✅ 扫描完成，找到 ${elements.length} 个可交互元素。`);
    return elements;
  }

  async cleanup(): Promise<void> {
    try {
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
      console.log('✅ 浏览器已关闭');
    } catch (error: any) {
      console.error('❌ 浏览器关闭失败:', error);
    }
  }
} 