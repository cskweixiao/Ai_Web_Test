import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'module';
import { randomBytes } from 'crypto';

const require = createRequire(import.meta.url);

console.log('🔍 测试MCP独立浏览器实例启动...');

async function testMcpIsolated() {
  let transport = null;
  let client = null;
  
  try {
    console.log('📦 正在解析MCP路径...');
    const mcpPath = require.resolve('@playwright/mcp/package.json').replace('package.json', 'cli.js');
    console.log('📦 MCP路径:', mcpPath);
    
    // 🎯 生成完全独立的用户数据目录
    const uniqueId = randomBytes(8).toString('hex');
    const isolatedDataDir = `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Temp\\mcp-test-${uniqueId}`;
    const isolatedPort = 9000 + Math.floor(Math.random() * 1000); // 随机端口
    
    console.log('🔧 独立浏览器配置:');
    console.log('- 数据目录:', isolatedDataDir);
    console.log('- 调试端口:', isolatedPort);
    
    console.log('🚀 正在启动MCP传输（独立模式）...');
    transport = new StdioClientTransport({
      command: 'node',
      args: [mcpPath],
      env: {
        ...process.env,
        DEBUG: 'pw:browser*',
        // 🎯 强制独立配置
        PW_HEADLESS: '0',
        PLAYWRIGHT_HEADLESS: 'false',
        HEADLESS: 'false',
        // 🔥 关键：独立浏览器启动配置
        PLAYWRIGHT_LAUNCH_OPTIONS: JSON.stringify({
          headless: false,
          args: [
            `--user-data-dir=${isolatedDataDir}`,
            `--remote-debugging-port=${isolatedPort}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-mode',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-features=TranslateUI',
            '--new-window',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ],
          channel: 'chrome',
          timeout: 30000
        })
      }
    });

    console.log('🔗 正在连接MCP客户端...');
    client = new Client({ name: 'test-isolated-client', version: '1.0.0' }, {});
    await client.connect(transport);
    
    console.log('✅ MCP客户端连接成功！');
    
    console.log('🌐 正在测试浏览器导航...');
    await client.callTool({ 
      name: 'browser_navigate', 
      arguments: { url: 'https://www.baidu.com' } 
    });
    
    console.log('🎉 浏览器导航成功！你应该能看到一个新的Chrome窗口打开百度！');
    console.log('📋 这个测试浏览器是独立的，不会影响你的日常Chrome使用');
    
    // 等待10秒让你看到浏览器
    console.log('⏱️ 等待10秒让你观察独立的测试浏览器...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('❌ 错误详情:', error.stack);
  } finally {
    if (client) {
      console.log('🔒 正在关闭客户端...');
      await client.close();
    }
    if (transport) {
      console.log('🔒 正在关闭传输...');
      await transport.close();
    }
    console.log('✅ 测试完成！独立浏览器会自动关闭');
  }
}

testMcpIsolated().catch(console.error); 