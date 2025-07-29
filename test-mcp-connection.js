import { PlaywrightMcpClient } from './server/services/mcpClient.js';

async function testMCPConnection() {
    console.log('🔧 === MCP连接测试开始 ===');
    
    const mcpClient = new PlaywrightMcpClient();
    let testResults = {
        initialization: false,
        toolListing: false,
        basicNavigation: false,
        snapshot: false,
        cleanup: false
    };

    try {
        // 1. 测试初始化
        console.log('\n1️⃣ 测试MCP客户端初始化...');
        await mcpClient.initialize({
            reuseSession: false,
            headless: true,
            contextState: null
        });
        testResults.initialization = true;
        console.log('✅ MCP客户端初始化成功');

        // 2. 测试工具列表
        console.log('\n2️⃣ 测试工具列表获取...');
        const tools = await mcpClient.listAvailableTools();
        testResults.toolListing = true;
        console.log(`✅ 获取到 ${tools.length} 个工具:`);
        tools.forEach((tool, index) => {
            console.log(`   ${index + 1}. ${tool}`);
        });

        // 3. 测试基本导航
        console.log('\n3️⃣ 测试基本导航功能...');
        await mcpClient.callTool({
            name: 'browser_navigate',
            arguments: { url: 'https://www.baidu.com' }
        });
        testResults.basicNavigation = true;
        console.log('✅ 基本导航功能正常');

        // 4. 测试页面快照
        console.log('\n4️⃣ 测试页面快照获取...');
        const snapshot = await mcpClient.getSnapshot();
        testResults.snapshot = true;
        console.log(`✅ 页面快照获取成功 (${snapshot.split('\n').length} 行)`);
        
        // 显示快照预览
        const lines = snapshot.split('\n');
        console.log('📸 快照预览 (前10行):');
        lines.slice(0, 10).forEach((line, index) => {
            console.log(`   ${index + 1}. ${line}`);
        });

        // 5. 测试清理
        console.log('\n5️⃣ 测试资源清理...');
        await mcpClient.close();
        testResults.cleanup = true;
        console.log('✅ 资源清理完成');

    } catch (error) {
        console.error(`❌ MCP连接测试失败: ${error.message}`);
        console.error(`❌ 错误详情: ${error.stack}`);
        
        // 尝试清理
        try {
            await mcpClient.close();
        } catch (cleanupError) {
            console.warn('⚠️ 清理时出错:', cleanupError.message);
        }
    }

    // 生成测试报告
    console.log('\n📊 === MCP连接测试报告 ===');
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`通过测试: ${passedTests}/${totalTests}`);
    
    Object.entries(testResults).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        const testName = {
            initialization: 'MCP客户端初始化',
            toolListing: '工具列表获取',
            basicNavigation: '基本导航功能',
            snapshot: '页面快照获取',
            cleanup: '资源清理'
        }[test];
        console.log(`${icon} ${testName}`);
    });

    if (passedTests === totalTests) {
        console.log('\n🎉 所有MCP连接测试通过！');
        console.log('MCP客户端工作正常，问题可能在其他地方');
    } else {
        console.log('\n⚠️ MCP连接存在问题，需要修复');
        
        if (!testResults.initialization) {
            console.log('🔧 修复建议:');
            console.log('   - 检查Playwright安装: npm install playwright');
            console.log('   - 检查MCP服务器配置');
            console.log('   - 确认端口未被占用');
        }
        
        if (!testResults.toolListing) {
            console.log('🔧 修复建议:');
            console.log('   - 检查MCP服务器是否正确启动');
            console.log('   - 验证工具注册是否正确');
        }
        
        if (!testResults.basicNavigation) {
            console.log('🔧 修复建议:');
            console.log('   - 检查网络连接');
            console.log('   - 验证浏览器启动参数');
        }
    }

    return testResults;
}

// 运行测试
testMCPConnection().catch(error => {
    console.error('💥 测试执行失败:', error);
    process.exit(1);
});