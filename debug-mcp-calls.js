import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 简单的MCP调用跟踪测试
const mcpTrackingTestCase = {
    name: '【MCP调用跟踪】单步输入测试',
    steps: `1. 导航到 https://k8s-saas-tmp.ycb51.cn/supplychain_page/home/home
2. 在用户名字段输入 "admin"`,
    assertions: `应该能看到详细的MCP调用过程`
};

async function createMCPTrackingTest() {
    console.log('🔧 创建MCP调用跟踪测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpTrackingTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ MCP调用跟踪测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeMCPTrackingTest(testCaseId) {
    console.log(`\n🚀 执行MCP调用跟踪测试 ID: ${testCaseId}`);
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
    console.log('✅ MCP调用跟踪测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorMCPCalls(runId) {
    console.log('\n🔍 === MCP调用详细监控 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    const maxChecks = 40;

    const detectedCalls = [];
    const executionFlow = [];

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
                    const msg = log.message;
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    
                    // 记录执行流程
                    executionFlow.push({
                        timestamp,
                        level: log.level,
                        message: msg
                    });

                    // 特别关注MCP相关的日志
                    if (msg.includes('MCP') || msg.includes('browser_') || msg.includes('工具调用') || msg.includes('参数格式')) {
                        detectedCalls.push({
                            timestamp,
                            type: 'MCP_RELATED',
                            message: msg
                        });
                        console.log(`🔧 [${timestamp}] MCP相关: ${msg}`);
                    } else {
                        // 显示其他关键日志
                        const levelIcon = {
                            'info': 'ℹ️',
                            'success': '✅',
                            'warning': '⚠️',
                            'error': '❌'
                        }[log.level] || 'ℹ️';
                        console.log(`[${timestamp}] ${levelIcon} ${msg}`);
                    }
                });
                
                lastLogCount = testRun.logs.length;
            }

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | MCP相关日志: ${detectedCalls.length} | 总日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 MCP调用跟踪结束: ${testRun.status}`);
                return { testRun, detectedCalls, executionFlow };
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ MCP调用跟踪超时`);
    return { testRun: null, detectedCalls, executionFlow };
}

function analyzeMCPCallFlow(detectedCalls, executionFlow) {
    console.log('\n🔍 === MCP调用流程分析 ===');
    
    console.log(`检测到 ${detectedCalls.length} 条MCP相关日志`);
    
    if (detectedCalls.length > 0) {
        console.log('\n🔧 MCP相关日志详情:');
        detectedCalls.forEach((call, index) => {
            console.log(`${index + 1}. [${call.timestamp}] ${call.message}`);
        });
    } else {
        console.log('❌ 没有检测到任何MCP相关日志！');
    }

    // 分析执行流程中的关键节点
    console.log('\n📋 === 执行流程关键节点 ===');
    
    const keyPoints = executionFlow.filter(flow => 
        flow.message.includes('AI解析成功') ||
        flow.message.includes('开始执行MCP命令') ||
        flow.message.includes('MCP命令执行成功') ||
        flow.message.includes('MCP命令执行失败') ||
        flow.message.includes('browser_type') ||
        flow.message.includes('browser_click')
    );

    if (keyPoints.length > 0) {
        keyPoints.forEach((point, index) => {
            console.log(`${index + 1}. [${point.timestamp}] ${point.message}`);
        });
    } else {
        console.log('⚠️ 没有找到关键执行节点');
    }

    // 检查是否有输入操作
    const inputOperations = executionFlow.filter(flow => 
        flow.message.includes('用户名') || 
        flow.message.includes('输入') ||
        flow.message.includes('browser_type')
    );

    console.log('\n⌨️ === 输入操作分析 ===');
    console.log(`检测到 ${inputOperations.length} 个输入相关操作`);
    
    if (inputOperations.length > 0) {
        inputOperations.forEach((op, index) => {
            console.log(`${index + 1}. [${op.timestamp}] ${op.message}`);
        });
    }

    // 问题诊断
    console.log('\n🚨 === 问题诊断 ===');
    
    const issues = [];
    
    if (detectedCalls.length === 0) {
        issues.push('严重: 没有检测到MCP工具调用日志');
    }
    
    const hasInputStep = executionFlow.some(flow => flow.message.includes('用户名字段输入'));
    const hasMCPTypeCall = detectedCalls.some(call => call.message.includes('browser_type'));
    
    if (hasInputStep && !hasMCPTypeCall) {
        issues.push('关键: 有输入步骤但没有browser_type调用');
    }
    
    const hasSuccess = executionFlow.some(flow => flow.message.includes('MCP命令执行成功'));
    const hasActualCall = detectedCalls.some(call => call.message.includes('MCP工具调用:'));
    
    if (hasSuccess && !hasActualCall) {
        issues.push('核心问题: 显示执行成功但没有实际的工具调用记录');
    }

    if (issues.length > 0) {
        console.log('发现以下问题:');
        issues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue}`);
        });
    } else {
        console.log('✅ 没有发现明显问题');
    }

    return {
        mcpCallsCount: detectedCalls.length,
        keyPointsCount: keyPoints.length,
        inputOperationsCount: inputOperations.length,
        issuesCount: issues.length
    };
}

async function main() {
    try {
        console.log('🚀 开始MCP调用跟踪分析');
        console.log('================================');
        console.log('专门跟踪MCP工具调用的详细过程');
        console.log('目标: 找出为什么没有实际的MCP调用记录');
        
        const testCase = await createMCPTrackingTest();
        const runId = await executeMCPTrackingTest(testCase.id);
        const { testRun, detectedCalls, executionFlow } = await monitorMCPCalls(runId);
        
        const analysis = analyzeMCPCallFlow(detectedCalls, executionFlow);
        
        console.log('\n📋 === 跟踪分析完成 ===');
        console.log(`MCP相关日志: ${analysis.mcpCallsCount} 条`);
        console.log(`关键节点: ${analysis.keyPointsCount} 个`);
        console.log(`输入操作: ${analysis.inputOperationsCount} 个`);
        console.log(`发现问题: ${analysis.issuesCount} 个`);
        
        if (analysis.issuesCount > 0) {
            console.log('\n🎯 核心问题确认:');
            console.log('系统在某个环节"跳过"了实际的MCP工具调用');
            console.log('这解释了为什么显示成功但没有实际效果');
        }

    } catch (error) {
        console.error('\n💥 MCP调用跟踪过程中发生错误:', error);
    }
}

main();