import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { TestStep, TestAction } from '../../src/types/test.js';
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

export interface McpExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class PlaywrightMcpClient {
  private client: Client<any, any> | null = null;
  private transport: StdioClientTransport | null = null;
  private isInitialized = false;
  private snapshot: any | null = null;
  private useAlternativeToolNames = false; // 🔥 工具名称映射标志

  async initialize(options: { reuseSession?: boolean; contextState?: any; } = {}) {
    if (this.isInitialized && options.reuseSession) {
      console.log('♻️ 复用现有MCP会话');
      if (options.contextState) await this.setContextState(options.contextState);
      return;
    }

    if (this.isInitialized) await this.close();

    console.log('🚀 正在启动MCP Playwright服务器...');
    
    try {
      // 🎯 强制使用有头模式 - 永远显示浏览器窗口
      console.log('🎯 强制有头模式 - 浏览器窗口将可见');

      // 🔥 恢复蓝色Chromium：使用临时目录但保留Playwright自带浏览器
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-chrome-'));
      console.log('🎯 使用临时目录:', tmpDir);
      
      // 🎯 智能检测Playwright浏览器路径
      const possibleBrowserPaths = [
        path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
        path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers')
      ];
      
      let browserPath = '';
      for (const browserDir of possibleBrowserPaths) {
        if (fs.existsSync(browserDir)) {
          // 查找 chromium 相关目录
          const entries = fs.readdirSync(browserDir, { withFileTypes: true });
          const chromiumDir = entries.find(function(entry) {
            return entry.isDirectory() && entry.name.startsWith('chromium-');
          });
          if (chromiumDir) {
            browserPath = browserDir;
            console.log('🔍 找到Playwright浏览器目录:', browserPath);
            console.log('🔍 找到Chromium:', chromiumDir.name);
            break;
          }
        }
      }
      
      if (browserPath) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
        console.log('🎯 设置PLAYWRIGHT_BROWSERS_PATH:', browserPath);
      } else {
        console.log('⚠️ 未找到Playwright浏览器，使用默认路径');
      }
      
      // 设置必要的启动参数，避免端口冲突和沙箱告警
      process.env.MCP_LAUNCH_PERSISTENT_ARGS = JSON.stringify([
        `--user-data-dir=${tmpDir}`,
        `--remote-debugging-pipe`,    // 🔥 用管道通信，完全绕开端口冲突
        '--no-first-run',
        '--disable-background-mode',
        '--no-sandbox',               // 🔇 消除Windows沙箱告警
        '--disable-setuid-sandbox',   // 🔇 进一步禁用沙箱相关告警
        '--disable-features=VizDisplayCompositor'  // 防止某些环境下的GPU问题
      ]);
      
      console.log('🔥 MCP环境配置:');
      console.log('  - MCP_LAUNCH_PERSISTENT_ARGS:', process.env.MCP_LAUNCH_PERSISTENT_ARGS);
      console.log('  - 使用Playwright自带蓝色Chromium');
      
      const mcpArgs = [
        require.resolve('@playwright/mcp/package.json').replace('package.json', 'cli.js'),
        '--browser', 'chromium'      // 🎯 使用蓝色Chromium，默认就是有头模式
      ];

      console.log('🚀 MCP启动参数:', mcpArgs.join(' '));
      console.log('🖥️ 浏览器将以有头模式启动，窗口可见！');

      // 🔥 修复：使用与配置文件完全一致的启动方式
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '@playwright/mcp@latest',
          '--no-sandbox'
        ],
        env: {
          ...process.env,
          PLAYWRIGHT_HEADLESS: 'false',  // 🎯 强制显示浏览器
          HEADLESS: 'false',
          DEBUG: 'pw:browser*,pw:api*'
        }
      });

      this.client = new Client({ name: 'ai-test-client', version: '1.0.0' }, {});
      await this.client.connect(this.transport);
      
      this.isInitialized = true;
      
      // 🔍 验证MCP工具是否真的可用
      console.log('🔍 正在验证MCP工具可用性...');
      
      // 先列出所有可用工具
      const availableTools = await this.listAvailableTools();
      
      if (availableTools.length === 0) {
        throw new Error('MCP服务器没有提供任何工具！');
      }
      
      // 🔥 修复：动态检测工具名称格式
      console.log('🔍 可用工具列表:', availableTools);
      
      // 检查是否使用 browser_ 前缀  
      const hasBrowserPrefix = availableTools.some(function(tool) {
        return tool.startsWith('browser_');
      });
      
      if (hasBrowserPrefix) {
        console.log('✅ 使用 browser_* 格式的工具名称');
        this.useAlternativeToolNames = true;
      } else {
        console.log('⚠️ 未识别的工具名称格式，使用默认格式');
        this.useAlternativeToolNames = false;
      }
      
      // 🔥 修复：用正确的工具名称验证
      try {
        await this.callTool({
          name: 'browser_navigate',
          arguments: { url: 'about:blank' }
        });
        console.log('✅ MCP工具验证成功！浏览器已启动');
      } catch (verifyError: any) {
        console.error('❌ MCP工具验证失败:', verifyError.message);
        throw new Error(`MCP工具调用失败: ${verifyError.message}`);
      }
      
      // 🔍 调试：打印所有可用工具名称
      try {
        const toolsResult = await this.client.listTools();
        console.log('🔧 MCP实际可用工具列表:');
        toolsResult.tools.forEach(function(tool, index) {
          console.log(`  ${index + 1}. ${tool.name} - ${tool.description || '无描述'}`);
        });
      } catch (listError: any) {
        console.error('❌ 获取工具列表失败:', listError.message);
      }
      
      if (options.contextState) await this.setContextState(options.contextState);
      
      console.log('✅ MCP服务器启动成功！浏览器窗口应该可见');
    } catch (error: any) {
      console.error('❌ MCP服务器启动失败:', error);
      console.error('❌ 错误详情:', error.stack);
      this.isInitialized = false;
      throw new Error(`MCP服务器启动失败: ${error.message}`);
    }
  }

  async close() {
    if (this.isInitialized && this.client) {
      try {
        await this.client.close();
      } catch (e) {
        console.warn('⚠️ 关闭MCP客户端时出错:', e);
      }
    }
    if (this.transport) {
      try {
        await this.transport.close();
      } catch(e) {
        console.warn('⚠️ 关闭MCP传输时出错:', e);
      }
    }
    this.client = null;
    this.transport = null;
    this.isInitialized = false;
    this.snapshot = null;
    console.log('🛑 MCP会话已关闭');
  }

  public async callTool(args: { name: string; arguments: any; }): Promise<any> {
    if (!this.isInitialized || !this.client) {
      throw new Error('MCP_DISCONNECTED: Client is not initialized.');
    }
    
    try {
      console.log(`🔧 MCP工具调用: ${args.name}`, args.arguments);
      const result = await this.client.callTool(args);
      console.log(`✅ MCP工具调用成功: ${args.name}`);
      return result;
    } catch (error: any) {
      console.error(`❌ MCP工具调用失败: ${args.name}`, {
        error: error.message,
        arguments: args.arguments
      });
      throw new Error(`MCP工具调用失败 [${args.name}]: ${error.message}`);
    }
  }

  // 🔥 新增：列出所有可用的MCP工具
  public async listAvailableTools(): Promise<string[]> {
    if (!this.isInitialized || !this.client) {
      throw new Error('MCP_DISCONNECTED: Client is not initialized.');
    }
    
    try {
      const result = await this.client.listTools();
      console.log('🔧 MCP可用工具列表:', result.tools.map(function(t) {
        return t.name;
      }));
      return result.tools.map(function(t) {
        return t.name;
      });
    } catch (error: any) {
      console.error('❌ 获取MCP工具列表失败:', error.message);
      return [];
    }
  }

  private handleConnectionClose() {
    console.error('❌ MCP连接关闭');
    this.isInitialized = false;
    this.client = null;
    this.transport = null;
    this.snapshot = null;
  }

  async executeStep(step: TestStep, runId: string): Promise<McpExecutionResult> {
    if (!this.isInitialized || !this.client) {
      throw new Error('MCP_DISCONNECTED: Client is not initialized.');
    }

    try {
      // 调试：打印完整的步骤对象
      console.log(`[${runId}] Executing MCP Step:`, JSON.stringify(step, null, 2));
      const result = await this.executeMcpStep(step, runId);
      return { success: true, result };
    } catch (error: any) {
      console.error(`❌ MCP步骤[${step.description}]执行失败 (runId: ${runId}):`, error.message);
      return { success: false, error: error.message };
    }
  }

  private async executeMcpStep(step: TestStep, runId: string): Promise<any> {
    if (!this.client) throw new Error('MCP_DISCONNECTED: Client is null.');

    console.log(`🎬 [${runId}] === 开始执行步骤 ===`);
    console.log(`📝 步骤描述: ${step.description}`);
    console.log(`🎯 操作类型: ${step.action}`);
    console.log(`🔍 目标元素: ${step.selector || '无'}`);
    console.log(`📄 输入值: ${step.value || '无'}`);
    console.log(`🌐 目标URL: ${step.url || '无'}`);
    
    // 🔍 每个步骤前验证当前页面状态
    await this.verifyCurrentPageState(runId);

    // 🔥 工具名称映射函数 - 动态适配版
    const getToolName = (baseName: string): string => {
      // 直接使用 browser_* 格式，因为我们已经确认这是正确的格式
      return baseName.replace('mcp_playwright_browser_', 'browser_');
    };

    switch (step.action) {
      case 'navigate':
        console.log(`🚀 [${runId}] 正在导航到: ${step.url}`);
        const navigateResult = await this.client.callTool({ 
          name: getToolName('mcp_playwright_browser_navigate'), 
          arguments: { url: step.url! } 
        });
        console.log(`✅ [${runId}] 页面导航完成:`, navigateResult);
        
        // 🔍 导航后立即验证页面状态
        await this.verifyCurrentPageState(runId);
        
        // 导航后等待一下确保页面加载
        console.log(`⏳ [${runId}] 等待页面完全加载...`);
        try {
          await this.client.callTool({ 
            name: getToolName('mcp_playwright_browser_wait'), 
            arguments: { state: 'networkidle' } 
          });
          console.log(`✅ [${runId}] 页面完全加载完成`);
          
          // 🔍 等待后再次验证
          await this.verifyCurrentPageState(runId);
          
        } catch (waitError) {
          console.warn(`⚠️ [${runId}] 页面等待失败，继续执行: ${waitError}`);
        }
        
        // 🔍 强制截图验证实际显示状态
        await this.takeScreenshot(`navigate-${Date.now()}.png`);
        
        await this.refreshSnapshot();
        console.log(`📊 [${runId}] 页面快照已更新`);
        break;
      
      case 'click':
      case 'fill':
        console.log(`🔍 [${runId}] 正在查找元素: ${step.selector}`);
        
        // 操作前确保页面完全加载
        await this.waitForLoad();
        
        const element = await this.findBestElement(step.selector!, runId);
        console.log(`✅ [${runId}] 找到目标元素: ${element.text} (ref: ${element.ref})`);
        
        // 确保元素可见并可交互
        try {
          console.log(`🔍 [${runId}] 验证元素可见性...`);
          await this.client.callTool({ 
            name: getToolName('mcp_playwright_browser_wait'), 
            arguments: { ref: element.ref, state: 'visible', timeout: 5000 } 
          });
          console.log(`✅ [${runId}] 元素可见性验证通过`);
        } catch (visibilityError) {
          console.warn(`⚠️ [${runId}] 元素不可见，尝试直接操作...`);
        }
        
        const toolName = getToolName(step.action === 'click' ? 'mcp_playwright_browser_click' : 'mcp_playwright_browser_type');
        const args = step.action === 'click' 
          ? { ref: element.ref }
          : { ref: element.ref, text: step.value! };
        
        console.log(`🎯 [${runId}] 正在执行${step.action === 'click' ? '点击' : '输入'}操作...`);
        console.log(`📋 [${runId}] MCP参数:`, JSON.stringify(args, null, 2));
        
        try {
          await this.client.callTool({ name: toolName, arguments: args });
          console.log(`✅ [${runId}] ${step.action === 'click' ? '点击' : '输入'}操作完成`);
        } catch (operationError) {
          console.error(`❌ [${runId}] 操作执行失败:`, operationError);
          // 重试一次
          console.log(`🔄 [${runId}] 正在重试操作...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await this.client.callTool({ name: toolName, arguments: args });
          console.log(`✅ [${runId}] 重试操作成功`);
        }
        
        await this.refreshSnapshot();
        console.log(`📊 [${runId}] 操作后页面快照已更新`);
        break;

      case 'wait':
        const waitTimeout = step.timeout || 3000;
        console.log(`⏱️ [${runId}] 开始等待 ${waitTimeout}ms...`);
        
        // 使用MCP的等待功能确保页面完全加载
        try {
          console.log(`⏳ [${runId}] 等待页面网络空闲...`);
          await this.client.callTool({ 
            name: getToolName('mcp_playwright_browser_wait'), 
            arguments: { state: 'networkidle' } 
          });
          console.log(`✅ [${runId}] 页面网络空闲完成`);
        } catch (networkError) {
          console.warn(`⚠️ [${runId}] 网络等待失败，使用固定等待时间: ${networkError}`);
          await new Promise(function(res) {
            setTimeout(res, waitTimeout);
          });
        }
        
        // 等待后刷新快照确保元素可见
        await this.refreshSnapshot();
        console.log(`✅ [${runId}] 等待完成，页面快照已更新`);
        break;
      
      case 'scroll':
        console.log(`📜 [${runId}] 正在滚动页面...`);
        // 🔥 修复：使用正确的按键操作滚动
        await this.client.callTool({ 
          name: 'browser_press_key', 
          arguments: { key: 'End' } 
        });
        console.log(`✅ [${runId}] 页面滚动完成`);
        await this.refreshSnapshot();
        console.log(`📊 [${runId}] 滚动后页面快照已更新`);
        break;

      case 'screenshot':
        console.log(`📸 [${runId}] 正在截图...`);
        const filename = `screenshot-${Date.now()}.png`;
        await this.takeScreenshot(filename);
        console.log(`✅ [${runId}] 截图完成: ${filename}`);
        break;

      default:
        throw new Error(`❌ [${runId}] 未知的MCP动作: ${step.action}`);
    }

    console.log(`🏁 [${runId}] === 步骤执行完成 ===\n`);
  }

  private async findBestElement(selector: string, runId: string): Promise<any> {
    if (!this.snapshot) {
      await this.refreshSnapshot();
    }
    if (!this.snapshot) {
      throw new Error(`无法获取页面快照 (runId: ${runId})`);
    }

    try {
      console.log(`🤖 [${runId}] ===== AI元素解析开始 =====`);
      console.log(`🔍 [${runId}] 目标描述: "${selector}"`);
      
      // 🔍 解析快照为结构化数据，提供给AI进行智能匹配
      const snapshotData = this.parseSnapshotForAI();
      
      console.log(`📊 [${runId}] AI分析基础数据:`);
      console.log(`   📋 页面信息: ${snapshotData.pageInfo.title} (${snapshotData.pageInfo.url})`);
      console.log(`   📊 发现 ${snapshotData.elements.length} 个可交互元素`);
      
      // 打印所有发现的元素供调试
      console.log(`🔍 [${runId}] 全部可交互元素列表:`);
      snapshotData.elements.forEach((element, index) => {
        console.log(`   ${index + 1}. [${element.ref}] ${element.role || 'unknown'}: "${element.texts.join('", "')}"`);
      });

      // 使用AI服务来解析最佳匹配元素
      const matchedElement = await this.aiMatchElement(selector, snapshotData, runId);
      
      if (matchedElement) {
        console.log(`✅ [${runId}] AI匹配成功！`);
        console.log(`   🎯 匹配元素: "${matchedElement.text}"`);
        console.log(`   🔗 元素引用: ${matchedElement.ref}`);
        console.log(`   📊 置信度: ${matchedElement.confidence || 'N/A'}%`);
        console.log(`🤖 [${runId}] ===== AI元素解析完成 =====`);
        return matchedElement;
      }

      console.log(`❌ [${runId}] AI无法找到匹配元素: ${selector}`);
      console.log(`🤖 [${runId}] ===== AI元素解析失败 =====`);
      throw new Error(`AI无法找到匹配元素: ${selector} (runId: ${runId})`);
      
    } catch (parseError: any) {
      console.error(`❌ [${runId}] AI解析时出错:`, parseError.message);
      console.error(`❌ [${runId}] 错误堆栈:`, parseError.stack);
      throw new Error(`AI元素定位失败: ${parseError.message} (runId: ${runId})`);
    }
  }

  private parseSnapshotForAI(): any {
    const elements: any[] = [];
    const lines = this.snapshot.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 提取ref和完整描述
      const refMatch = trimmedLine.match(/\[ref=([a-zA-Z0-9_-]+)\]/);
      if (refMatch) {
        const ref = refMatch[1];
        
        // 提取所有文本信息
        const textMatches = trimmedLine.match(/"([^"]*)"/g) || [];
        const texts = textMatches.map(t => t.replace(/"/g, ''));
        
        // 确定角色和类型
        let role = '';
        let type = '';
        
        if (trimmedLine.includes('textbox')) role = 'textbox';
        else if (trimmedLine.includes('button')) role = 'button';
        else if (trimmedLine.includes('checkbox')) role = 'checkbox';
        else if (trimmedLine.includes('link')) role = 'link';
        else if (trimmedLine.includes('input')) role = 'input';
        
        if (trimmedLine.includes('password')) type = 'password';
        else if (trimmedLine.includes('submit')) type = 'submit';
        
        elements.push({
          ref,
          texts,
          role,
          type,
          fullLine: trimmedLine
        });
      }
    }

    return {
      elements,
      pageInfo: this.extractPageInfo()
    };
  }

  private extractPageInfo(): any {
    // 提取页面基本信息用于AI理解上下文
    const urlMatch = this.snapshot.match(/Page URL: ([^\n]+)/);
    const titleMatch = this.snapshot.match(/Page Title: ([^\n]+)/);
    
    return {
      url: urlMatch ? urlMatch[1].trim() : '',
      title: titleMatch ? titleMatch[1].trim() : '',
      elementCount: (this.snapshot.match(/\[ref=/g) || []).length
    };
  }

  private async aiMatchElement(selector: string, snapshotData: any, runId: string): Promise<any> {
    // 这里应该调用AI服务，但为了保持MCP架构，我们使用简单的启发式算法
    // 实际项目中可以接入真正的AI服务
    
    const { elements, pageInfo } = snapshotData;
    const selectorDesc = selector.toLowerCase();
    
    console.log(`🤖 [${runId}] AI分析开始:`);
    console.log(`   📝 自然语言描述: "${selector}"`);
    console.log(`   🌐 页面标题: ${pageInfo.title}`);
    console.log(`   📊 待匹配元素数: ${elements.length}`);
    
    // 智能启发式匹配，模拟AI理解
    let bestMatch = null;
    let bestConfidence = 0;
    
    console.log(`🤖 [${runId}] AI匹配过程:`);
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      let confidence = 0;
      const elementText = element.texts.join(' ').toLowerCase();
      const elementDesc = `[${element.ref}] ${element.role} ${element.type}: "${element.texts.join('", "')}"`;
      
      console.log(`   🔍 分析元素 ${i + 1}/${elements.length}: ${elementDesc}`);
      
      // 基于自然语言理解的匹配逻辑
      let reasons = [];
      
      if (selectorDesc.includes('账号') || selectorDesc.includes('用户名') || selectorDesc.includes('user')) {
        if (elementText.includes('账号')) {
          confidence += 100;
          reasons.push('包含"账号"关键词');
        }
        if (elementText.includes('用户名')) {
          confidence += 90;
          reasons.push('包含"用户名"关键词');
        }
        if (elementText.includes('user')) {
          confidence += 80;
          reasons.push('包含"user"关键词');
        }
        if (element.role === 'textbox' && !elementText.includes('密码')) {
          confidence += 40;
          reasons.push('是文本输入框且不含密码提示');
        }
      }
      
      if (selectorDesc.includes('密码') || selectorDesc.includes('password') || selectorDesc.includes('pass')) {
        if (elementText.includes('密码')) {
          confidence += 100;
          reasons.push('包含"密码"关键词');
        }
        if (elementText.includes('password')) {
          confidence += 90;
          reasons.push('包含"password"关键词');
        }
        if (element.type === 'password') {
          confidence += 60;
          reasons.push('类型为password');
        }
        if (element.role === 'textbox' && elementText.includes('密码')) {
          confidence += 50;
          reasons.push('是文本输入框且含密码提示');
        }
      }
      
      if (selectorDesc.includes('登录') || selectorDesc.includes('登入') || selectorDesc.includes('submit') || selectorDesc.includes('button')) {
        if (elementText.includes('登录')) {
          confidence += 100;
          reasons.push('包含"登录"关键词');
        }
        if (elementText.includes('登入')) {
          confidence += 100;
          reasons.push('包含"登入"关键词');
        }
        if (elementText.includes('login')) {
          confidence += 80;
          reasons.push('包含"login"关键词');
        }
        if (element.role === 'button') {
          confidence += 50;
          reasons.push('是按钮类型');
        }
      }
      
      // 选择器文本匹配
      const selectorKeywords = selectorDesc.split(/\s+/).filter(k => k.length > 1);
      for (const keyword of selectorKeywords) {
        if (elementText.includes(keyword)) {
          confidence += 25;
          reasons.push(`匹配关键词"${keyword}"`);
        }
      }
      
      console.log(`      📊 置信度: ${confidence}% (${reasons.join(', ')})`);
      
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          ref: element.ref,
          text: element.texts[0] || '',
          confidence,
          reasons: reasons.join(', ')
        };
      }
    }
    
    if (bestMatch && bestConfidence >= 50) {
      console.log(`✅ [${runId}] AI匹配成功:`);
      console.log(`   🎯 最佳匹配: "${bestMatch.text}" [${bestMatch.ref}]`);
      console.log(`   📊 最终置信度: ${bestConfidence}%`);
      console.log(`   🔍 匹配原因: ${bestMatch.reasons}`);
      return bestMatch;
    }
    
    if (bestMatch && bestConfidence > 20) {
      console.log(`⚠️ [${runId}] AI找到低置信度匹配:`);
      console.log(`   🎯 匹配元素: "${bestMatch.text}" [${bestMatch.ref}]`);
      console.log(`   📊 置信度: ${bestConfidence}% (低于推荐阈值)`);
    }
    
    // 如果启发式匹配失败，使用智能回退策略
    console.log(`🤖 [${runId}] 使用智能回退策略...`);
    
    const fallback = elements.find(e => 
      (selectorDesc.includes('账号') && e.role === 'textbox' && e.texts.some(t => t.includes('账号'))) ||
      (selectorDesc.includes('密码') && e.role === 'textbox' && e.texts.some(t => t.includes('密码'))) ||
      (selectorDesc.includes('登录') && e.role === 'button' && e.texts.some(t => t.includes('登录')))
    );
    
    if (fallback) {
      console.log(`⚠️ [${runId}] AI使用智能回退:`);
      console.log(`   🎯 回退匹配: "${fallback.texts[0]}" [${fallback.ref}]`);
      return { ref: fallback.ref, text: fallback.texts[0] || '' };
    }
    
    if (elements.length > 0) {
      const lastResort = elements[0];
      console.log(`⚠️ [${runId}] AI使用最后手段:`);
      console.log(`   🎯 选择第一个元素: "${lastResort.texts[0]}" [${lastResort.ref}]`);
      return { ref: lastResort.ref, text: lastResort.texts[0] || '' };
    }
    
    console.log(`❌ [${runId}] AI无法找到任何匹配元素`);
    return null;
  }

  private async refreshSnapshot(): Promise<void> {
    this.snapshot = await this.getSnapshot();
  }

  async getSnapshot(): Promise<any> {
    if (!this.isInitialized || !this.client) {
      throw new Error('MCP_DISCONNECTED: Client is not connected.');
    }
    try {
      console.log(`📊 正在获取MCP页面快照...`);
      
      // 🔥 增强调试：记录原始返回
      const snapshotResult: any = await this.client.callTool({ name: 'browser_snapshot', arguments: { random_string: 'test' } });
      
      console.log(`📊 MCP原始快照返回:`, JSON.stringify(snapshotResult, null, 2));
      
      const yaml = snapshotResult?.snapshot?.body      // old <=0.2.x
                 ?? snapshotResult?.snapshot             // old (partial)
                 ?? snapshotResult?.content?.[0]?.text   // new >=0.3.x
                 ?? snapshotResult?.content?.text;       // 🔥 额外兼容格式

      if (!yaml) {
        console.error('❌ mcp_playwright_browser_snapshot 没返回可用数据, 实际返回:', snapshotResult);
        
        // 🔥 尝试截图作为备用方案
        try {
          await this.client.callTool({ name: 'browser_take_screenshot', arguments: { filename: 'debug-snapshot.png' } });
          console.log('📸 已保存调试截图: debug-snapshot.png');
        } catch (screenshotError) {
          console.warn('⚠️ 截图也失败了:', screenshotError);
        }
        
        throw new Error('mcp_playwright_browser_snapshot 没返回可用数据');
      }

      // 🔥 增强调试：显示快照内容预览
      const lines = yaml.split('\n');
      console.log(`📊 MCP页面快照已获取 (${lines.length} 行)`);
      
      // 显示前20行用于调试
      const previewLines = lines.slice(0, 20);
      console.log(`📊 快照预览:\n${previewLines.join('\n')}`);
      
      // 🔥 统计元素类型
      const elementTypes = ['textbox', 'button', 'link', 'input', 'checkbox', 'radio', 'combobox'];
      const foundTypes: string[] = [];
      elementTypes.forEach(type => {
        const count = (yaml.match(new RegExp(type, 'g')) || []).length;
        if (count > 0) foundTypes.push(`${type}(${count})`);
      });
      
      if (foundTypes.length > 0) {
        console.log(`📊 发现元素类型: ${foundTypes.join(', ')}`);
      } else {
        console.log(`⚠️ 未在快照中发现常见交互元素`);
      }

      this.snapshot = yaml; // Store the YAML string
      return yaml;

    } catch (error: any) {
      console.error('📛 mcp_playwright_browser_snapshot 调用异常 >>>', error); 
      this.snapshot = null;
      throw new Error(`获取MCP快照失败: ${error?.message || error}`);
    }
  }

  async takeScreenshot(filename: string): Promise<void> {
    if (!this.isInitialized || !this.client) return;
    try {
      await this.client.callTool({ name: 'browser_take_screenshot', arguments: { filename } });
      console.log(`📸 截图已保存: ${filename}`);
    } catch (error) {
      console.error(`❌ 截图失败:`, error);
    }
  }

  async waitForLoad(): Promise<void> {
    if (!this.isInitialized || !this.client) return;
    try {
      await this.client.callTool({ 
        name: this.useAlternativeToolNames ? 'browser_wait' : 'mcp_playwright_browser_wait', 
        arguments: { state: 'networkidle' } 
      });
      console.log('⏳ 页面已完全加载');
    } catch (error) {
      console.warn('⚠️ 等待页面加载失败，继续执行:', error);
    }
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.isInitialized || !this.client) return '';
    try {
      const result = await this.client.callTool({ 
        name: this.useAlternativeToolNames ? 'browser_evaluate' : 'mcp_playwright_browser_evaluate',
        arguments: { 
          script: 'window.location.href' 
        }
      });
      return typeof result === 'string' ? result : '';
    } catch (error) {
      console.error(`❌ 获取当前URL失败:`, error);
      return '';
    }
  }

  async getContextState(): Promise<any> {
    if (!this.isInitialized || !this.client) return null;
    try {
      return await this.client.callTool({ name: 'mcp_playwright_browser_get_context_state', arguments: {} });
    } catch (error) {
      console.error(`❌ 获取上下文状态失败:`, error);
      return null;
    }
  }

  async setContextState(contextState: any): Promise<void> {
    if (!this.isInitialized || !this.client) return;
    try {
      await this.client.callTool({ name: 'mcp_playwright_browser_set_context_state', arguments: { contextState } });
      console.log('🔄 上下文状态已恢复');
    } catch (error) {
      console.error(`❌ 设置上下文状态失败:`, error);
    }
  }

  private async verifyCurrentPageState(runId: string): Promise<void> {
    console.log(`🔍 [${runId}] ===== 验证当前页面状态 =====`);
    
    try {
      // 🔥 使用正确的工具名称格式
      const getToolName = (baseName: string): string => {
        return baseName.replace('mcp_playwright_browser_', 'browser_');
      };
      
      // 获取当前页面URL和标题
      const currentUrl = await this.client.callTool({
        name: getToolName('mcp_playwright_browser_evaluate'),
        arguments: { 
          script: 'window.location.href' 
        }
      });
      
      const currentTitle = await this.client.callTool({
        name: getToolName('mcp_playwright_browser_evaluate'),
        arguments: { 
          script: 'document.title' 
        }
      });
      
      console.log(`🔍 [${runId}] 当前页面状态:`);
      console.log(`   🌐 URL: ${currentUrl}`);
      console.log(`   📄 标题: ${currentTitle}`);
      
      // 检查页面是否完全加载
      const readyState = await this.client.callTool({
        name: getToolName('mcp_playwright_browser_evaluate'),
        arguments: { 
          script: 'document.readyState' 
        }
      });
      
      console.log(`   ⚡ 加载状态: ${readyState}`);
      
      // 强制刷新快照，确保与实际浏览器状态同步
      await this.refreshSnapshot();
      console.log(`📊 [${runId}] 页面状态验证完成`);
      
    } catch (error) {
      console.error(`❌ [${runId}] 验证页面状态失败:`, error);
    }
    
    console.log(`🔍 [${runId}] ===== 页面状态验证结束 =====`);
  }
}
