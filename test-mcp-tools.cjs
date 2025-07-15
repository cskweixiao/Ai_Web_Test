#!/usr/bin/env node

/**
 * 🔍 MCP工具验证脚本 - 找出真正可用的工具名称
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testMcpTools() {
  let transport = null;
  let client = null;
  
  try {
    console.log('🚀 启动MCP测试...');
    
    // 使用配置文件中的方式启动
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@latest', '--no-sandbox'],
      env: {
        ...process.env,
        PLAYWRIGHT_HEADLESS: 'false',
        DEBUG: 'pw:*'
      }
    });

    client = new Client({ name: 'test-tools-client', version: '1.0.0' }, {});
    
    console.log('🔗 连接MCP客户端...');
    await client.connect(transport);
    
    console.log('✅ MCP连接成功！');
    
    // 列出所有可用工具
    console.log('📋 获取工具列表...');
    const toolsResult = await client.listTools();
    
    console.log('🔧 可用工具列表:');
    toolsResult.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name} - ${tool.description || '无描述'}`);
    });
    
    if (toolsResult.tools.length === 0) {
      console.log('❌ 没有找到任何可用工具！');
      return;
    }
    
    // 测试快照工具
    const snapshotTools = toolsResult.tools.filter(t => 
      t.name.includes('snapshot') || t.name.includes('browser')
    );
    
    if (snapshotTools.length > 0) {
      console.log('🎯 尝试测试快照工具:', snapshotTools[0].name);
      try {
        const snapshotResult = await client.callTool({
          name: snapshotTools[0].name,
          arguments: {}
        });
        console.log('✅ 快照工具测试成功！');
        console.log('📊 快照数据类型:', typeof snapshotResult);
        console.log('📊 快照数据键:', Object.keys(snapshotResult || {}));
      } catch (snapError) {
        console.log('❌ 快照工具测试失败:', snapError.message);
      }
    }
    
    // 测试导航工具
    const navTools = toolsResult.tools.filter(t => 
      t.name.includes('navigate') || t.name.includes('browser')
    );
    
    if (navTools.length > 0) {
      console.log('🌐 尝试测试导航工具:', navTools[0].name);
      try {
        await client.callTool({
          name: navTools[0].name,
          arguments: { url: 'https://www.baidu.com' }
        });
        console.log('✅ 导航工具测试成功！你应该看到浏览器打开了！');
        
        // 等待几秒钟让用户看到浏览器
        console.log('⏱️ 等待5秒...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (navError) {
        console.log('❌ 导航工具测试失败:', navError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ MCP测试失败:', error.message);
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
    console.log('✅ 测试完成！');
  }
}

testMcpTools().catch(console.error); 