import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 包含实际浏览器操作的测试用例
const detailedTestCase = {
    name: '【详细执行验证】真实浏览器操作测试',
    steps: `1. 导航到 https://www.baidu.com
2. 等待 3 秒
3. 在搜索框输入 "测试"
4. 点击搜索按钮
5. 截图`,
    assertions: `页面应该显示搜索结果`
};

async function createDetailedTestCase() {
    console.log('📝 创建详细执行测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailedTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 详细执行测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeDetailedTest(testCaseId) {
    console.log(`\n🚀 执行详细测试 ID: ${testCaseId}`);
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
    console.log('✅ 详细测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorDetailedExecution(runId) {
    console.log('\n🔍 === 监控详细执行过程 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    const maxChecks = 90; // 最多检查90次（3分钟）

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
                    
                    // 特别关注关键日志
                    if (log.message.includes('MCP') || log.message.includes('AI') || log.message.includes('浏览器')) {
                        console.log(`   🔍 关键日志: ${log.message}`);
                    }
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

function analyzeDetailedLogs(logs) {
    console.log('\n🔍 === 详细日志分析 ===');
    
    const keywordAnalysis = {
        'MCP初始化': { keywords: ['mcp', '初始化', '启动', 'initialize'], logs: [] },
        'AI解析': { keywords: ['ai', '解析', 'parse', '分析'], logs: [] },
        '浏览器操作': { keywords: ['浏览器', 'browser', '导航', 'navigate', '点击', 'click', '输入', 'type'], logs: [] },
        '步骤执行': { keywords: ['步骤', 'step'], logs: [] },
        '错误信息': { keywords: ['错误', 'error', '失败', 'failed'], logs: [] },
        '成功信息': { keywords: ['成功', 'success', '完成', 'completed'], logs: [] }
    };
    
    logs.forEach((log, index) => {
        const msg = log.message.toLowerCase();
        
        Object.keys(keywordAnalysis).forEach(category => {
            const analysis = keywordAnalysis[category];
            if (analysis.keywords.some(keyword => msg.includes(keyword))) {
                analysis.logs.push({
                    index: index + 1,
                    timestamp: new Date(log.timestamp).toLocaleTimeString(),
                    level: log.level,
                    message: log.message
                });
            }
        });
    });
    
    console.log(`📊 关键词分析结果:`);
    Object.keys(keywordAnalysis).forEach(category => {
        const analysis = keywordAnalysis[category];
        console.log(`   ${category}: ${analysis.logs.length} 条`);
        
        if (analysis.logs.length > 0) {
            console.log(`     最新几条:`);
            analysis.logs.slice(-3).forEach(log => {
                const levelIcon = {
                    'info': 'ℹ️',
                    'success': '✅',
                    'warning': '⚠️',
                    'error': '❌'
                }[log.level] || 'ℹ️';
                console.log(`       ${log.index}. [${log.timestamp}] ${levelIcon} ${log.message}`);
            });
        }
    });
    
    // 诊断建议
    console.log(`\n🎯 === 诊断建议 ===`);
    
    if (keywordAnalysis['MCP初始化'].logs.length === 0) {
        console.log(`⚠️ 没有发现MCP初始化日志`);
        console.log(`   建议: 检查MCP客户端是否正常启动`);
    }
    
    if (keywordAnalysis['AI解析'].logs.length === 0) {
        console.log(`⚠️ 没有发现AI解析日志`);
        console.log(`   建议: 检查AI解析器是否正常工作`);
    }
    
    if (keywordAnalysis['浏览器操作'].logs.length === 0) {
        console.log(`⚠️ 没有发现浏览器操作日志`);
        console.log(`   建议: 检查是否真的在执行浏览器操作`);
    }
    
    if (keywordAnalysis['错误信息'].logs.length > 0) {
        console.log(`❌ 发现错误信息`);
        console.log(`   建议: 重点关注错误日志`);
    }
    
    if (keywordAnalysis['步骤执行'].logs.length > 0 && 
        keywordAnalysis['浏览器操作'].logs.length === 0) {
        console.log(`🤔 发现步骤执行但没有浏览器操作`);
        console.log(`   可能原因: 步骤被简化执行，没有真正调用浏览器`);
    }
    
    return keywordAnalysis;
}

async function main() {
    try {
        console.log('🚀 开始详细执行验证测试');
        console.log('===============================');
        
        // 1. 创建详细测试用例
        const testCase = await createDetailedTestCase();
        
        // 2. 执行测试
        const runId = await executeDetailedTest(testCase.id);
        
        // 3. 监控执行过程
        const finalRun = await monitorDetailedExecution(runId);
        
        if (finalRun) {
            // 4. 分析日志
            const analysis = analyzeDetailedLogs(finalRun.logs);
            
            console.log('\n🎯 === 最终诊断结果 ===');
            console.log(`测试状态: ${finalRun.status}`);
            console.log(`总日志数: ${finalRun.logs.length}`);
            
            const hasSteps = analysis['步骤执行'].logs.length > 0;
            const hasBrowserOps = analysis['浏览器操作'].logs.length > 0;
            const hasErrors = analysis['错误信息'].logs.length > 0;
            
            if (hasSteps && hasBrowserOps) {
                console.log('✅ 步骤执行和浏览器操作都正常');
            } else if (hasSteps && !hasBrowserOps) {
                console.log('⚠️ 有步骤执行但缺少浏览器操作');
                console.log('   这可能是你看不到详细执行过程的原因');
            } else if (!hasSteps) {
                console.log('❌ 没有步骤执行');
            }
            
            if (hasErrors) {
                console.log('❌ 执行过程中有错误');
            }
            
        } else {
            console.log('❌ 无法获取执行结果');
        }
        
    } catch (error) {
        console.error('\n💥 详细执行验证过程中发生错误:', error);
        console.error('错误详情:', error.stack);
    }
}

main();