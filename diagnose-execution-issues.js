import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 诊断测试用例 - 简单但全面
const diagnosticTestCase = {
    name: '【诊断】执行问题定位测试',
    steps: `1. 导航到 https://www.baidu.com
2. 等待 3 秒
3. 截图验证页面加载`,
    assertions: `页面应该显示百度搜索框`
};

async function createDiagnosticTest() {
    console.log('🔧 创建诊断测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnosticTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 诊断测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeDiagnosticTest(testCaseId) {
    console.log(`\n🚀 执行诊断测试 ID: ${testCaseId}`);
    const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`执行失败: ${response.statusText} - ${errorText}`);
    }
    const result = await response.json();
    console.log('✅ 诊断测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorDiagnosticExecution(runId) {
    console.log('\n🔍 === 诊断执行监控 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    const maxChecks = 30; // 1分钟监控

    const issues = {
        mcpInitFailed: false,
        aiParseFailed: false,
        elementNotFound: false,
        browserNotStarted: false,
        networkIssues: false,
        parameterFormatIssues: false
    };

    while (checkCount < maxChecks) {
        checkCount++;

        try {
            const response = await fetch(`${API_BASE}/runs/${runId}`);
            if (!response.ok) {
                console.log(`❌ 获取状态失败: ${response.status}`);
                break;
            }

            const result = await response.json();
            const testRun = result.data;

            // 分析新日志
            if (testRun.logs.length > lastLogCount) {
                const newLogs = testRun.logs.slice(lastLogCount);
                
                newLogs.forEach(log => {
                    const msg = log.message.toLowerCase();
                    
                    // 检测各种问题
                    if (msg.includes('mcp初始化失败') || msg.includes('mcp服务器启动失败')) {
                        issues.mcpInitFailed = true;
                    }
                    if (msg.includes('ai解析失败') || msg.includes('解析下一步骤失败')) {
                        issues.aiParseFailed = true;
                    }
                    if (msg.includes('无法找到元素') || msg.includes('元素查找失败')) {
                        issues.elementNotFound = true;
                    }
                    if (msg.includes('浏览器') && msg.includes('失败')) {
                        issues.browserNotStarted = true;
                    }
                    if (msg.includes('网络') || msg.includes('连接') || msg.includes('超时')) {
                        issues.networkIssues = true;
                    }
                    if (msg.includes('参数格式') || msg.includes('parameter')) {
                        issues.parameterFormatIssues = true;
                    }

                    // 显示关键日志
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    const levelIcon = {
                        'info': 'ℹ️',
                        'success': '✅',
                        'warning': '⚠️',
                        'error': '❌'
                    }[log.level] || 'ℹ️';

                    console.log(`[${timestamp}] ${levelIcon} ${log.message}`);
                });
                
                lastLogCount = testRun.logs.length;
            }

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | 日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 诊断执行结束: ${testRun.status}`);
                return { testRun, issues };
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
            issues.networkIssues = true;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ 诊断监控超时`);
    return { testRun: null, issues };
}

function generateDiagnosticReport(testRun, issues) {
    console.log('\n🔍 === 诊断报告 ===');
    
    // 基本信息
    if (testRun) {
        console.log(`📊 执行状态: ${testRun.status}`);
        console.log(`📋 总日志数: ${testRun.logs.length}`);
        console.log(`⏱️ 执行时间: ${testRun.startedAt ? new Date(testRun.startedAt).toLocaleTimeString() : 'N/A'}`);
    }

    // 问题分析
    console.log('\n🚨 === 发现的问题 ===');
    let problemCount = 0;

    if (issues.mcpInitFailed) {
        problemCount++;
        console.log('❌ 1. MCP初始化失败');
        console.log('   💡 建议: 检查MCP服务器配置和浏览器启动参数');
        console.log('   🔧 可能原因: 端口冲突、权限问题、浏览器路径错误');
    }

    if (issues.aiParseFailed) {
        problemCount++;
        console.log('❌ 2. AI解析失败');
        console.log('   💡 建议: 检查步骤描述格式和AI解析逻辑');
        console.log('   🔧 可能原因: 步骤格式不规范、AI解析算法问题');
    }

    if (issues.elementNotFound) {
        problemCount++;
        console.log('❌ 3. 元素查找失败');
        console.log('   💡 建议: 检查页面快照获取和元素匹配算法');
        console.log('   🔧 可能原因: 页面未完全加载、选择器不准确');
    }

    if (issues.browserNotStarted) {
        problemCount++;
        console.log('❌ 4. 浏览器启动失败');
        console.log('   💡 建议: 检查浏览器安装和启动参数');
        console.log('   🔧 可能原因: 浏览器未安装、启动参数错误');
    }

    if (issues.networkIssues) {
        problemCount++;
        console.log('❌ 5. 网络连接问题');
        console.log('   💡 建议: 检查网络配置和防火墙设置');
        console.log('   🔧 可能原因: 网络限制、DNS解析问题');
    }

    if (issues.parameterFormatIssues) {
        problemCount++;
        console.log('❌ 6. 参数格式问题');
        console.log('   💡 建议: 检查MCP工具调用参数格式');
        console.log('   🔧 可能原因: 参数格式转换不完整');
    }

    if (problemCount === 0) {
        console.log('✅ 未发现明显问题，可能是执行超时或其他原因');
    }

    // 修复建议
    console.log('\n🛠️ === 修复建议 ===');
    
    if (issues.mcpInitFailed) {
        console.log('1. 检查MCP配置:');
        console.log('   - 确认端口3001未被占用');
        console.log('   - 检查浏览器启动参数');
        console.log('   - 验证Playwright安装');
    }

    if (issues.aiParseFailed) {
        console.log('2. 改进AI解析:');
        console.log('   - 简化步骤描述');
        console.log('   - 检查aiParser.ts逻辑');
        console.log('   - 添加更多调试日志');
    }

    if (issues.elementNotFound) {
        console.log('3. 优化元素查找:');
        console.log('   - 检查页面快照质量');
        console.log('   - 改进元素匹配算法');
        console.log('   - 添加备用选择器');
    }

    console.log('\n🎯 === 下一步行动 ===');
    console.log('1. 运行: node test-mcp-connection.js 检查MCP连接');
    console.log('2. 检查: server/services/mcpClient.ts 的初始化逻辑');
    console.log('3. 验证: server/services/aiParser.ts 的解析逻辑');
    console.log('4. 测试: 使用更简单的测试用例验证基本功能');

    return { problemCount, issues };
}

async function main() {
    try {
        console.log('🔍 开始执行问题诊断');
        console.log('==========================');
        
        const testCase = await createDiagnosticTest();
        const runId = await executeDiagnosticTest(testCase.id);
        const { testRun, issues } = await monitorDiagnosticExecution(runId);
        
        const report = generateDiagnosticReport(testRun, issues);
        
        console.log('\n📋 === 诊断完成 ===');
        console.log(`发现 ${report.problemCount} 个问题`);
        
        if (report.problemCount > 0) {
            console.log('请根据上述建议进行修复');
        } else {
            console.log('系统基本功能正常，可能需要进一步调试');
        }

    } catch (error) {
        console.error('\n💥 诊断过程中发生错误:', error);
        console.error('这可能表明服务器连接或基础配置有问题');
    }
}

main();