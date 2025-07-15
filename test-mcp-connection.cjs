#!/usr/bin/env node

/**
 * 🔍 正确的MCP客户端连接测试
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testMcpConnection() {
  let transport = null;
  let client = null;
  
  try {
    console.log('🚀 启动MCP连接测试...');
    
    // 🔥 正确的连接方式
    transport = new StdioClientTransport({
      command: 'node',
      args: ['node_modules/@playwright/mcp/cli.js', '--browser', 'chromium'],
      env: {
        ...process.env,
        PLAYWRIGHT_HEADLESS: 'false',
        DEBUG: 'pw:*'
      }
    });

    client = new Client({ name: 'connection-test-client', version: '1.0.0' }, {});
    
    console.log('🔗 连接MCP服务器...');
    await client.connect(transport);
    
    console.log('✅ MCP连接成功！');
    
    // 列出所有可用工具
    console.log('📋 获取工具列表...');
    const toolsResult = await client.listTools();
    
    console.log('🔧 MCP可用工具列表:');
    toolsResult.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name} - ${tool.description || '无描述'}`);
    });
    
    if (toolsResult.tools.length === 0) {
      console.log('❌ 没有找到任何可用工具！');
      return;
    }
    
    // 🎯 测试导航工具 - 这应该会启动浏览器
    const navTools = toolsResult.tools.filter(t => 
      t.name.includes('navigate') || t.name.toLowerCase().includes('browser')
    );
    
    if (navTools.length > 0) {
      console.log('🌐 尝试测试导航工具:', navTools[0].name);
      try {
        await client.callTool({
          name: navTools[0].name,
          arguments: { url: 'https://www.baidu.com' }
        });
        console.log('✅ 导航工具测试成功！现在应该能看到浏览器了！');
        
        // 等待让用户看到浏览器
        console.log('⏱️ 等待10秒让您观察浏览器窗口...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (navError) {
        console.log('❌ 导航工具测试失败:', navError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ MCP连接测试失败:', error.message);
    console.error('❌ 详细错误:', error);
  } finally {
    if (client) {
      console.log('🔒 关闭客户端...');
      await client.close();
    }
    if (transport) {
      console.log('🔒 关闭传输...');
      await transport.close();
    }
    console.log('✅ 连接测试完成！');
  }
}

testMcpConnection().catch(console.error); 