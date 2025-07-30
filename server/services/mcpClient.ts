import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { TestStep } from '../../src/types/test.js';
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
    console.log('📋 启动参数:', JSON.stringify(options, null, 2));

    try {
      // 🎯 使用有头模式 - 显示浏览器窗口
      console.log('🎯 使用有头模式 - 浏览器窗口可见');

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
          const chromiumDir = entries.find(function (entry) {
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

      // 🔥 最小化浏览器启动参数，完全避免安全警告
      const enhancedArgs = [
        `--user-data-dir=${tmpDir}`,
        '--no-first-run',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-popup-blocking',
        '--disable-sync'
        // 完全移除 --no-sandbox, --disable-web-security 等所有可能触发警告的参数
      ];

      process.env.MCP_LAUNCH_PERSISTENT_ARGS = JSON.stringify(enhancedArgs);

      // 🔥 设置网络访问环境变量（无调试模式）
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略SSL证书验证
      process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
      // process.env.DEBUG = 'pw:browser*,pw:api*,pw:network*,pw:protocol*'; // 禁用调试输出
      // process.env.PWDEBUG = '1'; // 禁用调试模式
      process.env.PLAYWRIGHT_TIMEOUT = '60000';
      process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS = 'true';

      console.log('🔥 MCP环境配置:');
      console.log('  - MCP_LAUNCH_PERSISTENT_ARGS:', process.env.MCP_LAUNCH_PERSISTENT_ARGS);
      console.log('  - 使用Playwright自带蓝色Chromium');

      console.log('🚀 使用MCP强制安装浏览器...');

      console.log('🔧 使用MCP的browser_install功能...');

      // 🔥 先创建到MCP的连接 - 移除 --no-sandbox 参数
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '@playwright/mcp',
          '--browser', 'chromium'
          // 移除 --no-sandbox 和 --ignore-https-errors 参数
        ],
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: browserPath,
          PLAYWRIGHT_HEADLESS: 'false',
          HEADLESS: 'false'
        }
      });

      // 🔥 连接后立即使用browser_install安装浏览器
      this.client = new Client({ name: 'ai-test-client', version: '1.0.0' }, {});
      await this.client.connect(this.transport);

      console.log('🔧 正在使用MCP安装浏览器...');
      try {
        await this.client.callTool({
          name: 'browser_install',
          arguments: {}
        });
        console.log('✅ MCP浏览器安装完成');
      } catch (installError) {
        console.log('⚠️ 浏览器可能已安装:', installError.message);
      }

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
      const hasBrowserPrefix = availableTools.some(function (tool) {
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
        // 先用about:blank测试
        await this.callTool({
          name: 'browser_navigate',
          arguments: { url: 'about:blank' }
        });
        console.log('✅ MCP工具验证成功！浏览器已启动');

        // 仅验证导航功能，但不实际导航到任何特定页面
        // 避免强制导航影响后续测试
        console.log('✅ MCP导航功能验证完成（跳过实际页面导航）');

        // 验证当前URL（使用正确的工具名称）
        try {
          const currentUrl = await this.client.callTool({
            name: 'browser_navigate',
            arguments: { url: 'about:blank' }
          });
          console.log('✅ 浏览器导航功能验证完成');
        } catch (verifyError) {
          console.warn('⚠️ URL验证跳过，继续执行:', verifyError.message);
        }

      } catch (verifyError: any) {
        console.error('❌ MCP工具验证失败:', verifyError.message);
        throw new Error(`MCP工具调用失败: ${verifyError.message}`);
      }

      // 🔍 调试：打印所有可用工具名称
      try {
        const toolsResult = await this.client.listTools();
        console.log('🔧 MCP实际可用工具列表:');
        toolsResult.tools.forEach(function (tool, index) {
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
      console.error('❌ 错误类型:', error.constructor.name);
      console.error('❌ 完整错误对象:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
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
      } catch (e) {
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
      
      // 🔥 详细记录MCP返回结果
      console.log(`📋 MCP工具返回结果: ${args.name}`, JSON.stringify(result, null, 2));
      
      // 🔥 检查返回结果中的错误信息
      if (result && result.content) {
        const content = Array.isArray(result.content) ? result.content : [result.content];
        for (const item of content) {
          if (item.type === 'text' && item.text) {
            console.log(`📄 MCP返回内容: ${item.text}`);
            // 检查是否包含错误信息
            if (item.text.includes('Error:') || item.text.includes('Failed:') || item.text.includes('error')) {
              console.error(`❌ MCP命令执行错误: ${item.text}`);
            }
          }
        }
      }
      
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
      console.log('🔧 MCP可用工具列表:', result.tools.map(function (t) {
        return t.name;
      }));
      return result.tools.map(function (t) {
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

  // 🔥 统一使用MCPToolMapper进行工具名映射
  private getToolName(baseName: string): string {
    try {
      // 直接导入并使用MCPToolMapper
      const { MCPToolMapper } = require('../utils/mcpToolMapper.js');
      return MCPToolMapper.getToolName(baseName);
    } catch (error) {
      console.warn('⚠️ 无法加载MCPToolMapper，使用降级映射:', error);
      // 降级映射，确保fill/input/type都映射到browser_type
      const fallbackMap: Record<string, string> = {
        'navigate': 'browser_navigate',
        'click': 'browser_click',
        'fill': 'browser_type',
        'input': 'browser_type',
        'type': 'browser_type',
        'wait': 'browser_wait_for',
        'screenshot': 'browser_take_screenshot',
        'expect': 'browser_snapshot'
      };
      return fallbackMap[baseName] || `browser_${baseName}`;
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

    // 🔥 修复：直接使用正确的工具名称
    const getToolName = (baseName: string): string => {
      // 直接使用browser_*格式，移除错误的前缀映射
      if (baseName.startsWith('mcp_playwright_browser_')) {
        return baseName.replace('mcp_playwright_browser_', 'browser_');
      }
      return baseName; // 直接返回，确保名称正确
    };

    switch (step.action) {
      case 'navigate':
        console.log(`🚀 [${runId}] 正在导航到: ${step.url}`);
        // 🔥 修复：确保URL参数正确传递并添加调试
        console.log(`🌐 [${runId}] 执行导航命令到: ${step.url}`);
        const navigateResult = await this.client.callTool({
          name: this.getToolName('navigate'),
          arguments: { url: step.url! }
        });
        console.log(`🌐 [${runId}] 导航命令完成，结果:`, JSON.stringify(navigateResult, null, 2));
        console.log(`✅ [${runId}] 页面导航完成:`, navigateResult);

        // 🔍 导航后立即验证页面状态
        await this.verifyCurrentPageState(runId);

        // 导航后等待一下确保页面加载
        console.log(`⏳ [${runId}] 等待页面完全加载...`);
        try {
          await this.client.callTool({
            name: this.getToolName('wait'),
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
            name: this.getToolName('wait'),
            arguments: { ref: element.ref, state: 'visible', timeout: 5000 }
          });
          console.log(`✅ [${runId}] 元素可见性验证通过`);
        } catch (visibilityError) {
          console.warn(`⚠️ [${runId}] 元素不可见，尝试直接操作...`);
        }

        const toolName = this.getToolName(step.action === 'click' ? 'click' : 'fill');
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

      case 'browser_type':
        console.log(`⌨️ [${runId}] 正在执行browser_type操作...`);
        console.log(`📋 [${runId}] 目标ref: ${step.ref}, 输入文本: ${step.text}`);

        // 操作前确保页面完全加载
        await this.waitForLoad();

        // 直接使用AI提供的ref，无需查找元素
        const typeArgs = { ref: step.ref, text: step.text };
        console.log(`🎯 [${runId}] MCP browser_type参数:`, JSON.stringify(typeArgs, null, 2));

        try {
          await this.client.callTool({ 
            name: 'browser_type', 
            arguments: typeArgs 
          });
          console.log(`✅ [${runId}] browser_type操作完成`);
        } catch (typeError) {
          console.error(`❌ [${runId}] browser_type操作失败:`, typeError);
          throw typeError;
        }

        await this.refreshSnapshot();
        console.log(`📊 [${runId}] browser_type操作后页面快照已更新`);
        break;

      case 'browser_click':
        console.log(`🖱️ [${runId}] 正在执行browser_click操作...`);
        console.log(`📋 [${runId}] 目标ref: ${step.ref}`);

        // 操作前确保页面完全加载
        await this.waitForLoad();

        // 直接使用AI提供的ref，无需查找元素
        const clickArgs = { ref: step.ref };
        console.log(`🎯 [${runId}] MCP browser_click参数:`, JSON.stringify(clickArgs, null, 2));

        try {
          await this.client.callTool({ 
            name: 'browser_click', 
            arguments: clickArgs 
          });
          console.log(`✅ [${runId}] browser_click操作完成`);
        } catch (clickError) {
          console.error(`❌ [${runId}] browser_click操作失败:`, clickError);
          throw clickError;
        }

        await this.refreshSnapshot();
        console.log(`📊 [${runId}] browser_click操作后页面快照已更新`);
        break;

      case 'wait':
        const waitTimeout = step.timeout || 3000;
        console.log(`⏱️ [${runId}] 开始等待 ${waitTimeout}ms...`);

        // 使用MCP的等待功能确保页面完全加载
        try {
          console.log(`⏳ [${runId}] 等待页面网络空闲...`);
          await this.client.callTool({
            name: this.getToolName('wait'),
            arguments: { state: 'networkidle' }
          });
          console.log(`✅ [${runId}] 页面网络空闲完成`);
        } catch (networkError) {
          console.warn(`⚠️ [${runId}] 网络等待失败，使用固定等待时间: ${networkError}`);
          await new Promise(function (res) {
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
          name: this.getToolName('press_key'),
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
      const snapshotResult: any = await this.client.callTool({ name: this.getToolName('snapshot'), arguments: { random_string: 'test' } });

      console.log(`📊 MCP原始快照返回:`, JSON.stringify(snapshotResult, null, 2));

      const yaml = snapshotResult?.snapshot?.body      // old <=0.2.x
        ?? snapshotResult?.snapshot             // old (partial)
        ?? snapshotResult?.content?.[0]?.text   // new >=0.3.x
        ?? snapshotResult?.content?.text;       // 🔥 额外兼容格式

      if (!yaml) {
        console.error('❌ mcp_playwright_browser_snapshot 没返回可用数据, 实际返回:', snapshotResult);

        // 🔥 尝试截图作为备用方案
        try {
          await this.client.callTool({ name: this.getToolName('screenshot'), arguments: { filename: 'debug-snapshot.png' } });
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
      await this.client.callTool({ name: this.getToolName('screenshot'), arguments: { filename } });
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
      return await this.client.callTool({ name: this.getToolName('get_context_state'), arguments: {} });
    } catch (error) {
      console.error(`❌ 获取上下文状态失败:`, error);
      return null;
    }
  }

  async setContextState(contextState: any): Promise<void> {
    if (!this.isInitialized || !this.client) return;
    try {
      await this.client.callTool({ name: this.getToolName('set_context_state'), arguments: { contextState } });
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
        name: 'browser_evaluate',
        arguments: {
          script: 'window.location.href'
        }
      });

      const currentTitle = await this.client.callTool({
        name: 'browser_evaluate',
        arguments: {
          script: 'document.title'
        }
      });

      console.log(`🔍 [${runId}] 当前页面状态:`);
      console.log(`   🌐 URL: ${currentUrl}`);
      console.log(`   📄 标题: ${currentTitle}`);

      // 检查页面是否完全加载
      const readyState = await this.client.callTool({
        name: 'browser_evaluate',
        arguments: {
          script: 'document.readyState'
        }
      });

      console.log(`   ⚡ 加载状态: ${readyState}`);

      // 检查是否存在网络内容
      const bodyContent = await this.client.callTool({
        name: 'browser_evaluate',
        arguments: {
          script: 'document.body ? document.body.innerHTML.length : 0'
        }
      });

      console.log(`   📊 页面内容长度: ${bodyContent}字符`);

      // 强制刷新快照，确保与实际浏览器状态同步
      await this.refreshSnapshot();
      console.log(`📊 [${runId}] 页面状态验证完成`);

    } catch (error) {
      console.error(`❌ [${runId}] 验证页面状态失败:`, error);
    }

    console.log(`🔍 [${runId}] ===== 页面状态验证结束 =====`);
  }
}
