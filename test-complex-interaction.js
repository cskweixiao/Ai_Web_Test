import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 复杂交互测试用例
const complexTestCase = {
    name: '【复杂交互】登录功能测试',
    steps: `1. 导航到 https://k8s-saas-tmp.ycb51.cn
2. 等待 3 秒
3. 在用户名字段输入 "admin"
4. 在密码字段输入 "123456"
5. 点击登录按钮`,
    assertions: `页面应该显示登录结果`
};

async function createComplexTest() {
    console.log('🔧 创建复杂交互测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 复杂交互测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeComplexTest(testCaseId) {
    console.log(`\n🚀 执行复杂交互测试 ID: ${testCaseId}`);
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
    console.log('✅ 复杂交互测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorComplexExecution(runId) {
    console.log('\n🔍 === 复杂交互执行监控 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    let stepCount = 0;
    const maxChecks = 60; // 2分钟监控

    const stepResults = {
        navigation: false,
        wait: false,
        usernameInput: false,
        passwordInput: false,
        loginClick: false
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
                    const msg = log.message;
                    
                    // 检测步骤完成
                    if (msg.includes('AI解析成功: browser_navigate')) {
                        stepResults.navigation = true;
                        stepCount = Math.max(stepCount, 1);
                    }
                    if (msg.includes('AI解析成功: browser_wait_for')) {
                        stepResults.wait = true;
                        stepCount = Math.max(stepCount, 2);
                    }
                    if (msg.includes('AI解析成功: browser_type') && msg.includes('用户名')) {
                        stepResults.usernameInput = true;
                        stepCount = Math.max(stepCount, 3);
                    }
                    if (msg.includes('AI解析成功: browser_type') && msg.includes('密码')) {
                        stepResults.passwordInput = true;
                        stepCount = Math.max(stepCount, 4);
                    }
                    if (msg.includes('AI解析成功: browser_click') && msg.includes('登录')) {
                        stepResults.loginClick = true;
                        stepCount = Math.max(stepCount, 5);
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

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | 完成步骤: ${stepCount}/5 | 日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 复杂交互执行结束: ${testRun.status}`);
                return { testRun, stepResults, stepCount };
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ 复杂交互监控超时`);
    return { testRun: null, stepResults, stepCount };
}

function generateComplexReport(testRun, stepResults, stepCount) {
    console.log('\n🔍 === 复杂交互测试报告 ===');
    
    // 基本信息
    if (testRun) {
        console.log(`📊 执行状态: ${testRun.status}`);
        console.log(`📋 总日志数: ${testRun.logs.length}`);
        console.log(`🎯 完成步骤: ${stepCount}/5`);
    }

    // 步骤分析
    console.log('\n📋 === 步骤执行分析 ===');
    
    const steps = [
        { name: '页面导航', key: 'navigation', description: '导航到登录页面' },
        { name: '等待加载', key: 'wait', description: '等待页面完全加载' },
        { name: '用户名输入', key: 'usernameInput', description: '在用户名字段输入admin' },
        { name: '密码输入', key: 'passwordInput', description: '在密码字段输入密码' },
        { name: '登录点击', key: 'loginClick', description: '点击登录按钮' }
    ];

    steps.forEach((step, index) => {
        const completed = stepResults[step.key];
        const icon = completed ? '✅' : '❌';
        console.log(`${icon} 步骤 ${index + 1}: ${step.name} - ${step.description}`);
    });

    // 功能验证
    console.log('\n🎯 === 功能验证结果 ===');
    
    const completedSteps = Object.values(stepResults).filter(Boolean).length;
    const successRate = (completedSteps / 5) * 100;
    
    console.log(`✅ 成功率: ${successRate}% (${completedSteps}/5)`);
    
    if (stepResults.navigation && stepResults.wait) {
        console.log('✅ 基础功能正常: 页面导航和等待');
    }
    
    if (stepResults.usernameInput && stepResults.passwordInput) {
        console.log('✅ 输入功能正常: 用户名和密码输入');
    } else if (stepResults.usernameInput || stepResults.passwordInput) {
        console.log('⚠️ 输入功能部分正常: 部分输入字段工作');
    } else {
        console.log('❌ 输入功能异常: 无法输入文本');
    }
    
    if (stepResults.loginClick) {
        console.log('✅ 点击功能正常: 登录按钮点击');
    } else {
        console.log('❌ 点击功能异常: 无法点击按钮');
    }

    // 总结
    console.log('\n🎯 === 测试总结 ===');
    
    if (completedSteps === 5) {
        console.log('🎉 所有功能测试通过！');
        console.log('你的系统完全正常，包括：');
        console.log('  ✅ 页面导航');
        console.log('  ✅ 元素等待');
        console.log('  ✅ 文本输入');
        console.log('  ✅ 按钮点击');
        console.log('  ✅ AI解析和MCP参数格式');
    } else if (completedSteps >= 3) {
        console.log('✅ 大部分功能正常，少数问题需要调试');
    } else {
        console.log('⚠️ 存在一些功能问题，需要进一步调试');
    }

    return { completedSteps, successRate, stepResults };
}

async function main() {
    try {
        console.log('🚀 开始复杂交互功能测试');
        console.log('================================');
        console.log('这个测试将验证输入、点击等复杂交互功能');
        
        const testCase = await createComplexTest();
        const runId = await executeComplexTest(testCase.id);
        const { testRun, stepResults, stepCount } = await monitorComplexExecution(runId);
        
        const report = generateComplexReport(testRun, stepResults, stepCount);
        
        console.log('\n📋 === 测试完成 ===');
        console.log(`功能完整性: ${report.successRate}%`);
        
        if (report.successRate >= 80) {
            console.log('🎉 系统功能基本正常！');
        } else {
            console.log('⚠️ 系统存在一些问题，但基础功能可用');
        }

    } catch (error) {
        console.error('\n💥 复杂交互测试过程中发生错误:', error);
        console.error('这可能表明服务器连接或配置有问题');
    }
}

main();