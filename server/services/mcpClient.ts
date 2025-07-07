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