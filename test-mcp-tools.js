import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPTools() {
    console.log('🔍 测试 Playwright MCP 工具...');
    
    let transport = null;
    let client = null;
    
    try {
        // 启动 MCP 客户端
        transport = new StdioClientTransport({
            command: 'npx',
            args: ['@playwright/mcp', '--browser', 'chromium', '--headless'],
            env: process.env
        });

        client = new Client({ name: 'test-client', version: '1.0.0' }, {});
        await client.connect(transport);
        
        console.log('✅ MCP 连接成功');
        
        // 获取所有可用工具
        const toolsResult = await client.listTools();
        console.log('\n📋 实际可用的工具列表:');
        toolsResult.tools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name} - ${tool.description || '无描述'}`);
            if (tool.inputSchema && tool.inputSchema.properties) {
                console.log(`   参数: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
            }
        });
        
        // 测试导航功能
        console.log('\n🌐 测试导航到空白页...');
        try {
            const navResult = await client.callTool({
                name: 'browser_navigate',
                arguments: { url: 'about:blank' }
            });
            console.log('✅ 导航成功:', navResult);
        } catch (navError) {
            console.error('❌ 导航失败:', navError.message);
        }
        
        // 测试获取快照
        console.log('\n📸 测试获取页面快照...');
        try {
            const snapshotResult = await client.callTool({
                name: 'browser_snapshot',
                arguments: {}
            });
            console.log('✅ 快照获取成功');
            console.log('快照格式:', typeof snapshotResult);
            
            if (snapshotResult && snapshotResult.content) {
                console.log('快照内容结构:', Object.keys(snapshotResult.content[0] || {}));
            }
        } catch (snapshotError) {
            console.error('❌ 快照获取失败:', snapshotError.message);
        }

    } catch (error) {
        console.error('❌ MCP 测试失败:', error.message);
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (e) {
                console.warn('关闭客户端时出错:', e.message);
            }
        }
        if (transport) {
            try {
                await transport.close();
            } catch (e) {
                console.warn('关闭传输时出错:', e.message);
            }
        }
    }
}

testMCPTools().catch(console.error);