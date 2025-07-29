import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 专门用于验证 MCP 参数格式修复的测试用例
const mcpParameterTestCase = {
    name: '【MCP参数格式修复验证】用户登录测试',
    steps: `
1. 导航到 https://k8s-saas-tmp.ycb51.cn
2. 在用户名字段输入 "admin"
3. 在密码字段输入 "123456"
4. 点击登录按钮
`,
    assertions: `
页面应该显示登录成功或跳转到主页面
`
};

async function createTestCase(testCase) {
    console.log('🔧 正在创建MCP参数格式验证测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建测试用例失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ MCP参数格式验证测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeTest(testCaseId) {
    console.log(`\n🚀 开始执行MCP参数格式验证测试 ID: ${testCaseId}`);
    const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
    });
    if (!response.ok) {
        throw new Error(`执行测试失败: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('✅ MCP参数格式验证测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function getTestRunStatus(runId) {
    const response = await fetch(`${API_BASE}/runs/${runId}`);
    if (!response.ok) {
        throw new Error(`获取测试状态失败: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data;
}

async function waitForCompletion(runId) {
    console.log('⏳ 等待MCP参数格式验证测试完成...');
    let testRun;
    const startTime = Date.now();

    while (Date.now() - startTime < 180000) { // 3 minute timeout
        testRun = await getTestRunStatus(runId);
        
        console.log(`[${new Date().toLocaleTimeString()}] 当前状态: ${testRun.status}`);

        if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
            console.log(`\n🎯 MCP参数格式验证测试执行结束, 最终状态: ${testRun.status.toUpperCase()}`);
            return testRun;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    throw new Error("等待MCP参数格式验证测试完成超时 (3分钟)");
}

function analyzeMCPLogs(logs) {
    console.log('\n🔍 === MCP参数格式分析 ===');
    
    let mcpCallCount = 0;
    let correctFormatCount = 0;
    let incorrectFormatCount = 0;
    
    const mcpCalls = [];
    
    logs.forEach(log => {
        if (log.message.includes('🔧') && log.message.includes('MCP工具调用:')) {
            mcpCallCount++;
            mcpCalls.push(log.message);
            
            // 检查是否使用了正确的参数格式
            if (log.message.includes('browser_type') && log.message.includes('"ref":') && log.message.includes('"text":')) {
                correctFormatCount++;
                console.log(`✅ 正确格式 - ${log.message}`);
            } else if (log.message.includes('browser_click') && log.message.includes('"ref":')) {
                correctFormatCount++;
                console.log(`✅ 正确格式 - ${log.message}`);
            } else if (log.message.includes('browser_type') && log.message.includes('"selector":') && log.message.includes('"value":')) {
                incorrectFormatCount++;
                console.log(`❌ 错误格式 - ${log.message}`);
            } else if (log.message.includes('browser_click') && log.message.includes('"selector":')) {
                incorrectFormatCount++;
                console.log(`❌ 错误格式 - ${log.message}`);
            }
        }
    });
    
    console.log(`\n📊 MCP参数格式统计:`);
    console.log(`   总MCP调用次数: ${mcpCallCount}`);
    console.log(`   正确格式调用: ${correctFormatCount}`);
    console.log(`   错误格式调用: ${incorrectFormatCount}`);
    
    if (incorrectFormatCount === 0 && correctFormatCount > 0) {
        console.log(`🎉 MCP参数格式修复验证成功！所有调用都使用了正确的参数格式。`);
        return true;
    } else if (incorrectFormatCount > 0) {
        console.log(`⚠️ MCP参数格式修复不完整，仍有 ${incorrectFormatCount} 个调用使用了错误格式。`);
        return false;
    } else {
        console.log(`❓ 未检测到MCP工具调用，可能测试未正常执行。`);
        return false;
    }
}

function analyzeElementFinding(logs) {
    console.log('\n🔍 === 元素查找分析 ===');
    
    let elementFindingAttempts = 0;
    let successfulFindings = 0;
    let failedFindings = 0;
    
    logs.forEach(log => {
        if (log.message.includes('🔍') && log.message.includes('统一元素查找:')) {
            elementFindingAttempts++;
        } else if (log.message.includes('✅') && log.message.includes('元素查找成功:')) {
            successfulFindings++;
            console.log(`✅ ${log.message}`);
        } else if (log.message.includes('❌') && log.message.includes('元素查找失败:')) {
            failedFindings++;
            console.log(`❌ ${log.message}`);
        }
    });
    
    console.log(`\n📊 元素查找统计:`);
    console.log(`   查找尝试次数: ${elementFindingAttempts}`);
    console.log(`   成功查找次数: ${successfulFindings}`);
    console.log(`   失败查找次数: ${failedFindings}`);
    
    return failedFindings === 0 && successfulFindings > 0;
}

async function main() {
    try {
        console.log('🚀 开始MCP参数格式修复验证测试');
        console.log('=====================================');
        
        const newTestCase = await createTestCase(mcpParameterTestCase);
        const runId = await executeTest(newTestCase.id);
        const finalRun = await waitForCompletion(runId);
        
        console.log('\n📋 === 完整测试日志 ===');
        finalRun.logs.forEach(log => {
            console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        });
        
        // 分析MCP参数格式
        const mcpFormatCorrect = analyzeMCPLogs(finalRun.logs);
        
        // 分析元素查找
        const elementFindingCorrect = analyzeElementFinding(finalRun.logs);
        
        console.log('\n🎯 === 验证结果总结 ===');
        console.log(`测试执行状态: ${finalRun.status}`);
        console.log(`MCP参数格式: ${mcpFormatCorrect ? '✅ 正确' : '❌ 错误'}`);
        console.log(`元素查找功能: ${elementFindingCorrect ? '✅ 正常' : '❌ 异常'}`);
        
        if (finalRun.status === 'completed' && mcpFormatCorrect && elementFindingCorrect) {
            console.log('\n🎉 MCP参数格式修复验证成功！');
            console.log('   ✅ 测试执行完成');
            console.log('   ✅ MCP参数格式正确');
            console.log('   ✅ 元素查找功能正常');
            process.exit(0);
        } else {
            console.log('\n⚠️ MCP参数格式修复验证发现问题：');
            if (finalRun.status !== 'completed') {
                console.log(`   ❌ 测试执行失败: ${finalRun.status}`);
            }
            if (!mcpFormatCorrect) {
                console.log('   ❌ MCP参数格式仍有问题');
            }
            if (!elementFindingCorrect) {
                console.log('   ❌ 元素查找功能异常');
            }
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 MCP参数格式修复验证过程中发生错误:', error);
        process.exit(1);
    }
}

main();