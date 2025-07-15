import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

console.log('🔍 开始测试MCP浏览器启动...');

async function testMcpBrowser() {
  let transport = null;
  let client = null;
  
  try {
    console.log('📦 正在解析MCP路径...');
    const mcpPath = require.resolve('@playwright/mcp/package.json').replace('package.json', 'cli.js');
    console.log('📦 MCP路径:', mcpPath);
    
    console.log('🚀 正在启动MCP传输...');
    transport = new StdioClientTransport({
      command: 'node',
      args: [mcpPath],
      env: {
        ...process.env,
        DEBUG: 'pw:browser*',
        PW_HEADLESS: '0',  // 强制显示浏览器
        PLAYWRIGHT_HEADLESS: 'false',
        HEADLESS: 'false',
        PLAYWRIGHT_CHROMIUM_ARGS: '--no-sandbox --disable-setuid-sandbox'
      }
    });

    console.log('🔗 正在连接MCP客户端...');
    client = new Client({ name: 'test-client', version: '1.0.0' }, {});
    await client.connect(transport);
    
    console.log('✅ MCP客户端连接成功！');
    
    console.log('🌐 正在测试浏览器导航...');
    await client.callTool({ 
      name: 'browser_navigate', 
      arguments: { url: 'https://www.baidu.com' } 
    });
    
    console.log('🎉 浏览器导航成功！你应该能看到百度首页了！');
    
    // 等待5秒让你看到浏览器
    console.log('⏱️ 等待5秒让你观察浏览器...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
    console.log('✅ 测试完成！');
  }
}

testMcpBrowser().catch(console.error); 