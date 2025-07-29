import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 简单的测试用例，用于验证步骤执行
const stepByStepTestCase = {
    name: '【步骤执行验证】简单登录测试',
    steps: `1. 导航到 https://k8s-saas-tmp.ycb51.cn
2. 等待 3 秒
3. 在用户名字段输入 "admin"
4. 在密码字段输入 "123456"
5. 点击登录按钮`,
    assertions: `页面应该显示登录结果`
};

async function createTestCase(testCase) {
    console.log('📝 正在创建步骤执行验证测试用例...');
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
    console.log('✅ 步骤执行验证测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeTest(testCaseId) {
    console.log(`\n🚀 开始执行步骤验证测试 ID: ${testCaseId}`);
    const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
    });
    if (!response.ok) {
        throw new Error(`执行测试失败: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('✅ 步骤验证测试已启动, Run ID:', result.runId);
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

async function monitorStepExecution(runId) {
    console.log('\n🔍 === 监控步骤执行过程 ===');
    let testRun;
    const startTime = Date.now();
    let lastLogCount = 0;
    let currentStep = 0;

    while (Date.now() - startTime < 300000) { // 5 minute timeout
        testRun = await getTestRunStatus(runId);
        
        // 显示新的日志
        if (testRun.logs.length > lastLogCount) {
            const newLogs = testRun.logs.slice(lastLogCount);
            newLogs.forEach(log => {
                const timestamp = new Date(log.timestamp).toLocaleTimeString();
                const levelIcon = {
                    'info': 'ℹ️',
                    'success': '✅',
                    'warning': '⚠️',
                    'error': '❌'
                }[log.level] || 'ℹ️';
                
                console.log(`[${timestamp}] ${levelIcon} ${log.message}`);
                
                // 检测步骤执行
                if (log.message.includes('步骤') && log.message.includes(':')) {
                    const stepMatch = log.message.match(/步骤 (\d+):/);
                    if (stepMatch) {
                        const stepNum = parseInt(stepMatch[1]);
                        if (stepNum > currentStep) {
                            currentStep = stepNum;
                            console.log(`\n🎯 === 正在执行第 ${stepNum} 步 ===`);
                        }
                    }
                }
                
                // 检测AI解析过程
                if (log.message.includes('AI解析步骤开始')) {
                    console.log(`\n🤖 === AI正在解析下一个步骤 ===`);
                }
                
                // 检测MCP调用
                if (log.message.includes('MCP工具调用:')) {
                    console.log(`\n🔧 === MCP工具调用 ===`);
                }
            });
            lastLogCount = testRun.logs.length;
        }
        
        // 显示当前状态
        console.log(`\n📊 [${new Date().toLocaleTimeString()}] 状态: ${testRun.status} | 当前步骤: ${currentStep} | 日志数: ${testRun.logs.length}`);

        if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
            console.log(`\n🏁 步骤执行监控结束, 最终状态: ${testRun.status.toUpperCase()}`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // 每2秒检查一次
    }
    
    return testRun;
}

function analyzeStepExecution(logs) {
    console.log('\n📈 === 步骤执行分析 ===');
    
    let stepCount = 0;
    let aiParseCount = 0;
    let mcpCallCount = 0;
    let errorCount = 0;
    
    const steps = [];
    
    logs.forEach(log => {
        // 统计步骤
        if (log.message.includes('步骤') && log.message.includes(':')) {
            const stepMatch = log.message.match(/步骤 (\d+): (.+)/);
            if (stepMatch) {
                stepCount++;
                steps.push({
                    number: parseInt(stepMatch[1]),
                    description: stepMatch[2],
                    timestamp: log.timestamp
                });
            }
        }
        
        // 统计AI解析
        if (log.message.includes('AI解析步骤')) {
            aiParseCount++;
        }
        
        // 统计MCP调用
        if (log.message.includes('MCP工具调用:')) {
            mcpCallCount++;
        }
        
        // 统计错误
        if (log.level === 'error') {
            errorCount++;
        }
    });
    
    console.log(`📊 执行统计:`);
    console.log(`   执行步骤数: ${stepCount}`);
    console.log(`   AI解析次数: ${aiParseCount}`);
    console.log(`   MCP调用次数: ${mcpCallCount}`);
    console.log(`   错误次数: ${errorCount}`);
    
    if (steps.length > 0) {
        console.log(`\n📋 执行的步骤:`);
        steps.forEach(step => {
            const time = new Date(step.timestamp).toLocaleTimeString();
            console.log(`   ${step.number}. [${time}] ${step.description}`);
        });
    } else {
        console.log(`\n⚠️ 没有检测到步骤执行！可能的原因:`);
        console.log(`   - AI解析失败`);
        console.log(`   - MCP初始化失败`);
        console.log(`   - 测试用例格式问题`);
    }
    
    return {
        stepCount,
        aiParseCount,
        mcpCallCount,
        errorCount,
        steps
    };
}

async function main() {
    try {
        console.log('🚀 开始步骤执行验证测试');
        console.log('================================');
        
        const newTestCase = await createTestCase(stepByStepTestCase);
        const runId = await executeTest(newTestCase.id);
        const finalRun = await monitorStepExecution(runId);
        
        // 分析步骤执行
        const analysis = analyzeStepExecution(finalRun.logs);
        
        console.log('\n🎯 === 验证结果 ===');
        if (analysis.stepCount > 0) {
            console.log(`✅ 成功执行了 ${analysis.stepCount} 个步骤`);
            console.log(`✅ 步骤执行功能正常`);
        } else {
            console.log(`❌ 没有检测到步骤执行`);
            console.log(`❌ 需要检查AI解析和MCP初始化`);
        }
        
        if (finalRun.status === 'completed') {
            console.log(`✅ 测试执行完成`);
        } else {
            console.log(`⚠️ 测试执行状态: ${finalRun.status}`);
        }

    } catch (error) {
        console.error('\n💥 步骤执行验证过程中发生错误:', error);
        process.exit(1);
    }
}

main();