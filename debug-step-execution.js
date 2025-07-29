import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 非常简单的测试用例
const debugTestCase = {
    name: '【调试】最简单的测试',
    steps: `1. 等待 2 秒
2. 截图`,
    assertions: ``
};

async function checkServerStatus() {
    console.log('🔍 检查服务器状态...');
    try {
        const response = await fetch(`${API_BASE}/cases`);
        if (response.ok) {
            console.log('✅ 服务器正常运行');
            return true;
        } else {
            console.log(`❌ 服务器响应异常: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 无法连接到服务器: ${error.message}`);
        return false;
    }
}

async function createDebugTestCase() {
    console.log('📝 创建调试测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debugTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 调试测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeDebugTest(testCaseId) {
    console.log(`\n🚀 执行调试测试 ID: ${testCaseId}`);
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
    console.log('✅ 调试测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorDebugExecution(runId) {
    console.log('\n🔍 === 详细监控调试执行 ===');
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
                console.log(`\n📋 新增 ${newLogs.length} 条日志:`);
                newLogs.forEach((log, index) => {
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    const levelIcon = {
                        'info': 'ℹ️',
                        'success': '✅',
                        'warning': '⚠️',
                        'error': '❌'
                    }[log.level] || 'ℹ️';
                    
                    console.log(`  ${lastLogCount + index + 1}. [${timestamp}] ${levelIcon} ${log.message}`);
                });
                lastLogCount = testRun.logs.length;
            }
            
            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | 日志: ${testRun.logs.length} 条`);
            
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

function analyzeDebugLogs(logs) {
    console.log('\n🔍 === 调试日志分析 ===');
    
    const categories = {
        mcp_init: [],
        ai_parse: [],
        step_execution: [],
        mcp_calls: [],
        errors: [],
        other: []
    };
    
    logs.forEach((log, index) => {
        const msg = log.message.toLowerCase();
        
        if (msg.includes('mcp') && (msg.includes('初始化') || msg.includes('启动'))) {
            categories.mcp_init.push(`${index + 1}. ${log.message}`);
        } else if (msg.includes('ai') && msg.includes('解析')) {
            categories.ai_parse.push(`${index + 1}. ${log.message}`);
        } else if (msg.includes('步骤') && msg.includes(':')) {
            categories.step_execution.push(`${index + 1}. ${log.message}`);
        } else if (msg.includes('mcp工具调用')) {
            categories.mcp_calls.push(`${index + 1}. ${log.message}`);
        } else if (log.level === 'error') {
            categories.errors.push(`${index + 1}. ${log.message}`);
        } else {
            categories.other.push(`${index + 1}. ${log.message}`);
        }
    });
    
    console.log(`📊 日志分类统计:`);
    console.log(`   MCP初始化: ${categories.mcp_init.length} 条`);
    console.log(`   AI解析: ${categories.ai_parse.length} 条`);
    console.log(`   步骤执行: ${categories.step_execution.length} 条`);
    console.log(`   MCP调用: ${categories.mcp_calls.length} 条`);
    console.log(`   错误: ${categories.errors.length} 条`);
    console.log(`   其他: ${categories.other.length} 条`);
    
    // 显示关键日志
    if (categories.errors.length > 0) {
        console.log(`\n❌ 错误日志:`);
        categories.errors.forEach(log => console.log(`   ${log}`));
    }
    
    if (categories.mcp_init.length > 0) {
        console.log(`\n🔧 MCP初始化日志:`);
        categories.mcp_init.slice(0, 3).forEach(log => console.log(`   ${log}`));
    }
    
    if (categories.ai_parse.length > 0) {
        console.log(`\n🤖 AI解析日志:`);
        categories.ai_parse.slice(0, 3).forEach(log => console.log(`   ${log}`));
    }
    
    if (categories.step_execution.length > 0) {
        console.log(`\n🎯 步骤执行日志:`);
        categories.step_execution.forEach(log => console.log(`   ${log}`));
    } else {
        console.log(`\n⚠️ 没有发现步骤执行日志！`);
        console.log(`   这可能是问题所在。可能的原因:`);
        console.log(`   1. AI解析失败 - 检查AI解析日志`);
        console.log(`   2. MCP初始化失败 - 检查MCP初始化日志`);
        console.log(`   3. 测试用例格式问题 - 检查测试用例内容`);
        console.log(`   4. 执行流程中断 - 检查错误日志`);
    }
    
    return categories;
}

async function main() {
    try {
        console.log('🚀 开始调试步骤执行问题');
        console.log('===============================');
        
        // 1. 检查服务器状态
        const serverOk = await checkServerStatus();
        if (!serverOk) {
            console.log('❌ 服务器不可用，请先启动服务器');
            return;
        }
        
        // 2. 创建调试测试用例
        const testCase = await createDebugTestCase();
        
        // 3. 执行测试
        const runId = await executeDebugTest(testCase.id);
        
        // 4. 监控执行过程
        const finalRun = await monitorDebugExecution(runId);
        
        if (finalRun) {
            // 5. 分析日志
            const analysis = analyzeDebugLogs(finalRun.logs);
            
            console.log('\n🎯 === 诊断结果 ===');
            if (analysis.step_execution.length > 0) {
                console.log('✅ 步骤执行功能正常');
            } else {
                console.log('❌ 步骤执行功能异常');
                
                if (analysis.errors.length > 0) {
                    console.log('🔍 建议检查错误日志');
                } else if (analysis.mcp_init.length === 0) {
                    console.log('🔍 建议检查MCP初始化');
                } else if (analysis.ai_parse.length === 0) {
                    console.log('🔍 建议检查AI解析功能');
                } else {
                    console.log('🔍 建议检查测试执行流程');
                }
            }
        } else {
            console.log('❌ 无法获取执行结果');
        }
        
    } catch (error) {
        console.error('\n💥 调试过程中发生错误:', error);
        console.error('错误详情:', error.stack);
    }
}

main();