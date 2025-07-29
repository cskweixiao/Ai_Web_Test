import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 测试增强日志记录的测试用例
const enhancedLoggingTestCase = {
    name: '【增强日志】详细执行过程测试',
    steps: `1. 导航到 https://www.baidu.com
2. 等待 2 秒
3. 在搜索框输入 "测试"
4. 截图`,
    assertions: `页面应该显示搜索框`
};

async function createEnhancedTestCase() {
    console.log('📝 创建增强日志测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enhancedLoggingTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 增强日志测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeEnhancedTest(testCaseId) {
    console.log(`\n🚀 执行增强日志测试 ID: ${testCaseId}`);
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
    console.log('✅ 增强日志测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorEnhancedExecution(runId) {
    console.log('\n🔍 === 监控增强日志执行过程 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    const maxChecks = 60; // 最多检查60次（2分钟）

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

            // 显示新日志
            if (testRun.logs.length > lastLogCount) {
                const newLogs = testRun.logs.slice(lastLogCount);
                console.log(`\n📋 === 新增 ${newLogs.length} 条日志 ===`);
                newLogs.forEach((log, index) => {
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    const levelIcon = {
                        'info': 'ℹ️',
                        'success': '✅',
                        'warning': '⚠️',
                        'error': '❌'
                    }[log.level] || 'ℹ️';

                    console.log(`${lastLogCount + index + 1}. [${timestamp}] ${levelIcon} ${log.message}`);
                });
                lastLogCount = testRun.logs.length;
            }

            const statusIcon = {
                'queued': '⏳',
                'running': '🏃',
                'completed': '✅',
                'failed': '❌',
                'cancelled': '🚫'
            }[testRun.status] || '❓';

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] ${statusIcon} 状态: ${testRun.status} | 日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 执行结束: ${testRun.status}`);
                return testRun;
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ 监控超时，停止检查`);
    return null;
}

function analyzeEnhancedLogs(logs) {
    console.log('\n🔍 === 增强日志分析 ===');

    const logCategories = {
        'MCP初始化': { count: 0, logs: [] },
        'AI解析': { count: 0, logs: [] },
        '页面快照': { count: 0, logs: [] },
        'MCP命令': { count: 0, logs: [] },
        '浏览器操作': { count: 0, logs: [] },
        '步骤执行': { count: 0, logs: [] },
        '错误信息': { count: 0, logs: [] }
    };

    logs.forEach((log, index) => {
        const msg = log.message;

        if (msg.includes('MCP客户端') || msg.includes('MCP初始化')) {
            logCategories['MCP初始化'].count++;
            logCategories['MCP初始化'].logs.push(`${index + 1}. ${msg}`);
        }

        if (msg.includes('AI') && (msg.includes('解析') || msg.includes('分析'))) {
            logCategories['AI解析'].count++;
            logCategories['AI解析'].logs.push(`${index + 1}. ${msg}`);
        }

        if (msg.includes('快照') || msg.includes('snapshot')) {
            logCategories['页面快照'].count++;
            logCategories['页面快照'].logs.push(`${index + 1}. ${msg}`);
        }

        if (msg.includes('MCP工具调用') || msg.includes('MCP命令')) {
            logCategories['MCP命令'].count++;
            logCategories['MCP命令'].logs.push(`${index + 1}. ${msg}`);
        }

        if (msg.includes('导航') || msg.includes('输入') || msg.includes('点击') || msg.includes('浏览器')) {
            logCategories['浏览器操作'].count++;
            logCategories['浏览器操作'].logs.push(`${index + 1}. ${msg}`);
        }

        if (msg.includes('步骤')) {
            logCategories['步骤执行'].count++;
            logCategories['步骤执行'].logs.push(`${index + 1}. ${msg}`);
        }

        if (log.level === 'error') {
            logCategories['错误信息'].count++;
            logCategories['错误信息'].logs.push(`${index + 1}. ${msg}`);
        }
    });

    console.log(`📊 增强日志统计:`);
    Object.keys(logCategories).forEach(category => {
        const data = logCategories[category];
        console.log(`   ${category}: ${data.count} 条`);

        if (data.logs.length > 0) {
            console.log(`     最新几条:`);
            data.logs.slice(-2).forEach(log => {
                console.log(`       ${log}`);
            });
        }
    });

    // 验证增强日志是否生效
    console.log(`\n🎯 === 增强日志验证结果 ===`);

    const hasDetailedLogs =
        logCategories['MCP初始化'].count > 0 &&
        logCategories['AI解析'].count > 0 &&
        logCategories['页面快照'].count > 0;

    if (hasDetailedLogs) {
        console.log('✅ 增强日志功能正常工作！');
        console.log('   ✅ 可以看到MCP初始化过程');
        console.log('   ✅ 可以看到AI解析过程');
        console.log('   ✅ 可以看到页面快照获取过程');
        console.log('   ✅ 现在你可以看到完整的步骤执行过程了！');
    } else {
        console.log('⚠️ 增强日志可能没有完全生效');
        if (logCategories['MCP初始化'].count === 0) {
            console.log('   ❌ 缺少MCP初始化日志');
        }
        if (logCategories['AI解析'].count === 0) {
            console.log('   ❌ 缺少AI解析日志');
        }
        if (logCategories['页面快照'].count === 0) {
            console.log('   ❌ 缺少页面快照日志');
        }
    }

    return logCategories;
}

async function main() {
    try {
        console.log('🚀 开始增强日志验证测试');
        console.log('===============================');
        console.log('这个测试将验证你现在是否能看到详细的步骤执行过程');

        // 1. 创建测试用例
        const testCase = await createEnhancedTestCase();

        // 2. 执行测试
        const runId = await executeEnhancedTest(testCase.id);

        // 3. 监控执行过程
        const finalRun = await monitorEnhancedExecution(runId);

        if (finalRun) {
            // 4. 分析日志
            const analysis = analyzeEnhancedLogs(finalRun.logs);

            console.log('\n🎯 === 最终结果 ===');
            console.log(`测试状态: ${finalRun.status}`);
            console.log(`总日志数: ${finalRun.logs.length}`);

            const hasEnhancedLogs =
                analysis['MCP初始化'].count > 0 &&
                analysis['AI解析'].count > 0 &&
                analysis['页面快照'].count > 0;

            if (hasEnhancedLogs) {
                console.log('\n🎉 恭喜！增强日志功能已生效！');
                console.log('现在你可以看到：');
                console.log('  ✅ MCP客户端初始化过程');
                console.log('  ✅ AI解析每个步骤的过程');
                console.log('  ✅ 页面快照获取过程');
                console.log('  ✅ MCP命令执行的详细信息');
                console.log('  ✅ 浏览器操作的具体过程');
                console.log('\n这就是你一直想看到的详细步骤执行过程！');
            } else {
                console.log('\n⚠️ 增强日志可能需要进一步调整');
            }

        } else {
            console.log('❌ 无法获取执行结果');
        }

    } catch (error) {
        console.error('\n💥 增强日志验证过程中发生错误:', error);
        console.error('错误详情:', error.stack);
    }
}

main();