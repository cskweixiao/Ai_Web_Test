#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testNavigation() {
  let transport = null;
  let client = null;
  
  try {
    console.log('🚀 测试正确的browser_navigate工具...');
    
    transport = new StdioClientTransport({
      command: 'node',
      args: ['node_modules/@playwright/mcp/cli.js', '--browser', 'chromium'],
      env: { ...process.env, PLAYWRIGHT_HEADLESS: 'false' }
    });

    client = new Client({ name: 'nav-test', version: '1.0.0' }, {});
    await client.connect(transport);
    
    console.log('✅ MCP连接成功！');
    
    // 🎯 直接测试 browser_navigate
    console.log('🌐 调用 browser_navigate 到百度...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://www.baidu.com' }
    });
    
    console.log('✅ 导航成功！您应该能看到浏览器窗口打开百度了！');
    
    // 等待20秒让用户看到
    console.log('⏱️ 等待20秒让您观察浏览器...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (client) await client.close();
    if (transport) await transport.close();
    console.log('✅ 测试完成！');
  }
}

testNavigation().catch(console.error); 