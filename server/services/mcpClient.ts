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
           const chromiumDir = entries.find(entry => 
             entry.isDirectory() && entry.name.startsWith('chromium-')
           );
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
          '--browser', 'chromium',
          '--no-sandbox',
          '--ignore-https-errors'
        ],
        env: {
          ...process.env,
          PLAYWRIGHT_HEADLESS: 'false',  // 🎯 强制显示浏览器
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
      
      // 检查是否使用 mcp_playwright_browser_ 前缀
      const hasMcpPrefix = availableTools.some(tool => tool.startsWith('mcp_playwright_browser_'));
      // 检查是否使用 browser_ 前缀  
      const hasBrowserPrefix = availableTools.some(tool => tool.startsWith('browser_'));
      
      if (hasMcpPrefix) {
        console.log('✅ 使用 mcp_playwright_browser_* 格式的工具名称');
        this.useAlternativeToolNames = false;
      } else if (hasBrowserPrefix) {
        console.log('✅ 使用 browser_* 格式的工具名称');
        this.useAlternativeToolNames = true;
      } else {
        console.log('⚠️ 未识别的工具名称格式，使用默认格式');
        this.useAlternativeToolNames = false;
      }
      
      // 🔥 修复：用正确的工具名称验证
      try {
        const navigateToolName = this.useAlternativeToolNames ? 'browser_navigate' : 'mcp_playwright_browser_navigate';
        await this.callTool({
          name: navigateToolName,
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
        toolsResult.tools.forEach((tool, index) => {
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
    return this.client.callTool(args);
  }

  // 🔥 新增：列出所有可用的MCP工具
  public async listAvailableTools(): Promise<string[]> {
    if (!this.isInitialized || !this.client) {
      throw new Error('MCP_DISCONNECTED: Client is not initialized.');
    }
    
    try {
      const result = await this.client.listTools();
      console.log('🔧 MCP可用工具列表:', result.tools.map(t => t.name));
      return result.tools.map(t => t.name);
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

    // 🔥 工具名称映射函数 - 动态适配版
    const getToolName = (baseName: string): string => {
      if (this.useAlternativeToolNames) {
        // 使用 browser_* 格式
        return baseName.replace('mcp_playwright_browser_', 'browser_');
      } else {
        // 使用原始 mcp_playwright_browser_* 格式
        return baseName;
      }
    };

    switch (step.action) {
      case 'navigate':
        console.log(`🚀 [${runId}] 正在导航到: ${step.url}`);
        await this.client.callTool({ 
          name: getToolName('mcp_playwright_browser_navigate'), 
          arguments: { url: step.url! } 
        });
        console.log(`✅ [${runId}] 页面导航完成`);
        await this.refreshSnapshot();
        console.log(`📊 [${runId}] 页面快照已更新`);
        break;
      
      case 'click':
      case 'fill':
        console.log(`🔍 [${runId}] 正在查找元素: ${step.selector}`);
        const element = await this.findBestElement(step.selector!, runId);
        console.log(`✅ [${runId}] 找到目标元素: ${element.text} (ref: ${element.ref})`);
        
        const toolName = getToolName(step.action === 'click' ? 'mcp_playwright_browser_click' : 'mcp_playwright_browser_type');
        const args = step.action === 'click' 
          ? { element: step.description, ref: element.ref }
          : { element: step.description, ref: element.ref, text: step.value! };
        
        console.log(`🎯 [${runId}] 正在执行${step.action === 'click' ? '点击' : '输入'}操作...`);
        console.log(`📋 [${runId}] MCP参数:`, JSON.stringify(args, null, 2));
        
        await this.client.callTool({ name: toolName, arguments: args });
        console.log(`✅ [${runId}] ${step.action === 'click' ? '点击' : '输入'}操作完成`);
        
        await this.refreshSnapshot();
        console.log(`📊 [${runId}] 操作后页面快照已更新`);
        break;

      case 'wait':
        const waitTimeout = step.timeout || 3000;
        console.log(`⏱️ [${runId}] 开始等待 ${waitTimeout}ms...`);
        await new Promise(res => setTimeout(res, waitTimeout));
        console.log(`✅ [${runId}] 等待完成`);
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
    if (!this.client) throw new Error('MCP_DISCONNECTED: Client is null.');
    if (!this.snapshot) await this.refreshSnapshot();

    console.log(`🔍 [${runId}] === 开始元素查找 ===`);
    console.log(`🎯 [${runId}] 原始选择器: ${selector}`);

    // Playwright-style 'data-testid=' to standard CSS selector
    if (selector.startsWith('data-testid=')) {
      const value = selector.split('=')[1].trim();
      selector = `[data-testid="${value}"]`;
      console.log(`🔄 [${runId}] 转换后选择器: ${selector}`);
    }

    // 🔥 修复：直接从快照中查找元素，不使用不存在的工具
    // MCP Playwright 的快照是 YAML 格式，包含了所有可交互元素的引用
    
    // 简单的元素匹配逻辑 - 在实际的快照 YAML 中查找匹配的元素
    try {
      // 解析 YAML 快照中的元素
      const lines = this.snapshot.split('\n');
      let foundElement: { ref: string; text: string } | null = null;
      
      console.log(`📊 [${runId}] 快照包含 ${lines.length} 行内容`);
      console.log(`🔍 [${runId}] 开始精确匹配...`);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 查找包含目标选择器信息的行
        if (line.includes(selector) || 
            line.includes(selector.replace(/^\[|\]$/g, '')) || // 去掉方括号
            (selector.includes('data-testid') && line.includes(selector.split('"')[1]))) {
          
          console.log(`🎯 [${runId}] 找到匹配行 ${i + 1}: ${line.trim()}`);
          
          // 查找对应的 ref
          for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 5); j++) {
            const refLine = lines[j];
            if (refLine.includes('ref:') || refLine.includes('- ref:')) {
              const refMatch = refLine.match(/ref:\s*(\d+)/);
              if (refMatch) {
                foundElement = {
                  ref: refMatch[1],
                  text: line.trim()
                };
                console.log(`✅ [${runId}] 精确匹配成功！元素ref: ${foundElement.ref}`);
                break;
              }
            }
          }
          
          if (foundElement) break;
        }
      }
      
      if (!foundElement) {
        console.log(`⚠️ [${runId}] 精确匹配失败，开始模糊匹配...`);
        // 🔍 如果找不到精确匹配，尝试模糊匹配
        const selectorKeywords = selector.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(k => k.length > 2);
        console.log(`🔍 [${runId}] 模糊匹配关键词: ${selectorKeywords.join(', ')}`);
        
        for (const line of lines) {
          const lineText = line.toLowerCase();
          const matchCount = selectorKeywords.filter(keyword => lineText.includes(keyword)).length;
          
          if (matchCount > 0) {
            console.log(`🎯 [${runId}] 模糊匹配候选: ${line.trim()} (匹配${matchCount}个关键词)`);
            // 查找最近的 ref
            const lineIndex = lines.indexOf(line);
            for (let j = Math.max(0, lineIndex - 3); j < Math.min(lines.length, lineIndex + 3); j++) {
              const refLine = lines[j];
              const refMatch = refLine.match(/ref:\s*(\d+)/);
              if (refMatch) {
                foundElement = {
                  ref: refMatch[1],
                  text: line.trim()
                };
                console.log(`🎯 [${runId}] 模糊匹配成功: ${foundElement.text} (ref: ${foundElement.ref})`);
                break;
              }
            }
            if (foundElement) break;
          }
        }
      }
      
      if (!foundElement) {
        console.error(`❌ [${runId}] 在快照中找不到匹配的元素: ${selector}`);
        console.log(`📊 [${runId}] 当前快照内容预览 (前500字符):`);
        console.log(this.snapshot.substring(0, 500) + '...');
        
        // 显示所有可交互元素供参考
        console.log(`🔍 [${runId}] 当前页面可交互元素列表:`);
        const interactiveLines = lines.filter(line => line.includes('ref:') || line.includes('- ref:'));
        interactiveLines.slice(0, 10).forEach((line, index) => {
          console.log(`  ${index + 1}. ${line.trim()}`);
        });
        if (interactiveLines.length > 10) {
          console.log(`  ... 还有 ${interactiveLines.length - 10} 个元素`);
        }
        
        throw new Error(`页面里找不到元素: ${selector} (runId: ${runId})`);
      }
      
      console.log(`✅ [${runId}] === 元素查找成功 ===`);
      console.log(`📝 [${runId}] 元素文本: ${foundElement.text}`);
      console.log(`🔗 [${runId}] 元素引用: ${foundElement.ref}`);
      return foundElement;
      
    } catch (parseError: any) {
      console.error(`❌ [${runId}] 解析快照时出错:`, parseError.message);
      throw new Error(`解析页面快照失败: ${parseError.message} (runId: ${runId})`);
    }
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
      const snapshotResult: any = await this.client.callTool({ name: 'browser_snapshot', arguments: { random_string: 'test' } });
      
      const yaml = snapshotResult?.snapshot?.body      // old <=0.2.x
                 ?? snapshotResult?.snapshot             // old (partial)
                 ?? snapshotResult?.content?.[0]?.text;   // new >=0.3.x

      if (!yaml) {
        console.error('mcp_playwright_browser_snapshot 没返回可用数据, 实际返回:', snapshotResult);
        throw new Error('mcp_playwright_browser_snapshot 没返回可用数据');
      }

      console.log(`📊 MCP页面快照已获取`);
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
} 
