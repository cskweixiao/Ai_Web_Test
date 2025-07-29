import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 使用正确URL的测试用例
const correctWebsiteTestCase = {
    name: '【正确网站】供应链系统登录测试',
    steps: `1. 导航到 https://k8s-saas-tmp.ycb51.cn/supplychain_page/home/home
2. 等待 5 秒确保页面完全加载
3. 截图查看实际页面内容
4. 在用户名字段输入 "admin"
5. 在密码字段输入 "123456"
6. 点击登录按钮
7. 等待 3 秒查看登录结果
8. 截图查看登录后页面`,
    assertions: `页面应该显示供应链系统界面
登录后应该跳转到系统主页面`
};

async function createCorrectWebsiteTest() {
    console.log('🔧 创建正确网站测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctWebsiteTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 正确网站测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeCorrectWebsiteTest(testCaseId) {
    console.log(`\n🚀 执行正确网站测试 ID: ${testCaseId}`);
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
    console.log('✅ 正确网站测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorCorrectWebsiteExecution(runId) {
    console.log('\n🔍 === 正确网站执行监控 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    let stepCount = 0;
    const maxChecks = 80; // 增加监控时间，因为步骤更多

    const stepResults = {
        navigation: false,
        pageLoad: false,
        firstScreenshot: false,
        usernameInput: false,
        passwordInput: false,
        loginClick: false,
        waitForResult: false,
        finalScreenshot: false
    };

    const issues = {
        navigationFailed: false,
        pageNotLoaded: false,
        elementNotFound: false,
        loginFailed: false,
        unexpectedError: false
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
                    if (msg.includes('AI解析成功: browser_wait_for') && stepCount === 1) {
                        stepResults.pageLoad = true;
                        stepCount = Math.max(stepCount, 2);
                    }
                    if (msg.includes('AI解析成功: browser_take_screenshot') && stepCount === 2) {
                        stepResults.firstScreenshot = true;
                        stepCount = Math.max(stepCount, 3);
                    }
                    if (msg.includes('AI解析成功: browser_type') && msg.includes('用户名')) {
                        stepResults.usernameInput = true;
                        stepCount = Math.max(stepCount, 4);
                    }
                    if (msg.includes('AI解析成功: browser_type') && msg.includes('密码')) {
                        stepResults.passwordInput = true;
                        stepCount = Math.max(stepCount, 5);
                    }
                    if (msg.includes('AI解析成功: browser_click') && msg.includes('登录')) {
                        stepResults.loginClick = true;
                        stepCount = Math.max(stepCount, 6);
                    }
                    if (msg.includes('AI解析成功: browser_wait_for') && stepCount === 6) {
                        stepResults.waitForResult = true;
                        stepCount = Math.max(stepCount, 7);
                    }
                    if (msg.includes('AI解析成功: browser_take_screenshot') && stepCount === 7) {
                        stepResults.finalScreenshot = true;
                        stepCount = Math.max(stepCount, 8);
                    }

                    // 检测问题
                    if (msg.includes('导航失败') || msg.includes('无法访问')) {
                        issues.navigationFailed = true;
                    }
                    if (msg.includes('页面未加载') || msg.includes('加载失败')) {
                        issues.pageNotLoaded = true;
                    }
                    if (msg.includes('无法找到元素') || msg.includes('元素查找失败')) {
                        issues.elementNotFound = true;
                    }
                    if (msg.includes('登录失败') || msg.includes('认证失败')) {
                        issues.loginFailed = true;
                    }
                    if (log.level === 'error') {
                        issues.unexpectedError = true;
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

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | 完成步骤: ${stepCount}/8 | 日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 正确网站测试执行结束: ${testRun.status}`);
                return { testRun, stepResults, stepCount, issues };
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
            issues.unexpectedError = true;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ 正确网站测试监控超时`);
    return { testRun: null, stepResults, stepCount, issues };
}

function generateCorrectWebsiteReport(testRun, stepResults, stepCount, issues) {
    console.log('\n🔍 === 正确网站测试报告 ===');
    
    // 基本信息
    if (testRun) {
        console.log(`📊 执行状态: ${testRun.status}`);
        console.log(`📋 总日志数: ${testRun.logs.length}`);
        console.log(`🎯 完成步骤: ${stepCount}/8`);
    }

    // 步骤分析
    console.log('\n📋 === 详细步骤执行分析 ===');
    
    const steps = [
        { name: '页面导航', key: 'navigation', description: '导航到正确的供应链系统URL' },
        { name: '页面加载', key: 'pageLoad', description: '等待页面完全加载' },
        { name: '页面截图', key: 'firstScreenshot', description: '截图查看实际页面内容' },
        { name: '用户名输入', key: 'usernameInput', description: '在用户名字段输入admin' },
        { name: '密码输入', key: 'passwordInput', description: '在密码字段输入密码' },
        { name: '登录点击', key: 'loginClick', description: '点击登录按钮' },
        { name: '等待结果', key: 'waitForResult', description: '等待登录结果' },
        { name: '结果截图', key: 'finalScreenshot', description: '截图查看登录后页面' }
    ];

    steps.forEach((step, index) => {
        const completed = stepResults[step.key];
        const icon = completed ? '✅' : '❌';
        console.log(`${icon} 步骤 ${index + 1}: ${step.name} - ${step.description}`);
    });

    // 问题分析
    console.log('\n🚨 === 发现的问题 ===');
    let problemCount = 0;

    if (issues.navigationFailed) {
        problemCount++;
        console.log('❌ 1. 页面导航失败');
        console.log('   💡 可能原因: URL无法访问或网络问题');
    }

    if (issues.pageNotLoaded) {
        problemCount++;
        console.log('❌ 2. 页面加载失败');
        console.log('   💡 可能原因: 页面加载超时或资源加载问题');
    }

    if (issues.elementNotFound) {
        problemCount++;
        console.log('❌ 3. 页面元素查找失败');
        console.log('   💡 可能原因: 页面结构与预期不符，或元素选择器不正确');
    }

    if (issues.loginFailed) {
        problemCount++;
        console.log('❌ 4. 登录功能失败');
        console.log('   💡 可能原因: 用户名密码错误或登录逻辑问题');
    }

    if (issues.unexpectedError) {
        problemCount++;
        console.log('❌ 5. 系统异常错误');
        console.log('   💡 可能原因: 代码错误或系统配置问题');
    }

    if (problemCount === 0) {
        console.log('✅ 未发现明显问题');
    }

    // 功能验证
    console.log('\n🎯 === 真实功能验证结果 ===');
    
    const completedSteps = Object.values(stepResults).filter(Boolean).length;
    const successRate = (completedSteps / 8) * 100;
    
    console.log(`✅ 成功率: ${successRate}% (${completedSteps}/8)`);
    
    if (stepResults.navigation && stepResults.pageLoad) {
        console.log('✅ 网站访问正常: 能够访问正确的供应链系统URL');
    } else {
        console.log('❌ 网站访问异常: 无法正确访问供应链系统');
    }
    
    if (stepResults.firstScreenshot) {
        console.log('✅ 页面内容验证: 已截图，可查看实际页面内容');
    } else {
        console.log('❌ 页面内容验证失败: 无法截图验证页面');
    }
    
    if (stepResults.usernameInput && stepResults.passwordInput) {
        console.log('✅ 登录表单操作: 用户名和密码输入正常');
    } else {
        console.log('❌ 登录表单操作异常: 无法正确输入用户名或密码');
    }
    
    if (stepResults.loginClick && stepResults.waitForResult && stepResults.finalScreenshot) {
        console.log('✅ 登录流程完整: 点击登录并验证结果');
    } else {
        console.log('❌ 登录流程不完整: 登录操作或结果验证失败');
    }

    // 总结
    console.log('\n🎯 === 真实测试总结 ===');
    
    if (completedSteps >= 7) {
        console.log('🎉 供应链系统测试基本成功！');
        console.log('现在测试的是真正的应用，而不是错误页面');
    } else if (completedSteps >= 4) {
        console.log('⚠️ 部分功能正常，但登录流程可能有问题');
    } else {
        console.log('❌ 系统存在严重问题，需要检查网站访问和页面结构');
    }

    console.log('\n📸 重要提示: 请检查screenshots文件夹中的截图，查看实际的页面内容！');

    return { completedSteps, successRate, stepResults, issues };
}

async function main() {
    try {
        console.log('🚀 开始正确网站功能测试');
        console.log('================================');
        console.log('现在测试真正的供应链系统: https://k8s-saas-tmp.ycb51.cn/supplychain_page/home/home');
        console.log('这将揭示之前测试的问题 - 一直在错误的页面上操作！');
        
        const testCase = await createCorrectWebsiteTest();
        const runId = await executeCorrectWebsiteTest(testCase.id);
        const { testRun, stepResults, stepCount, issues } = await monitorCorrectWebsiteExecution(runId);
        
        const report = generateCorrectWebsiteReport(testRun, stepResults, stepCount, issues);
        
        console.log('\n📋 === 测试完成 ===');
        console.log(`真实功能完整性: ${report.successRate}%`);
        
        if (report.successRate >= 80) {
            console.log('🎉 供应链系统功能基本正常！');
        } else {
            console.log('⚠️ 发现了真实的问题，需要进一步调试');
        }

        console.log('\n🔍 下一步建议:');
        console.log('1. 查看screenshots文件夹中的截图');
        console.log('2. 确认页面是否正确加载');
        console.log('3. 检查登录表单的实际结构');
        console.log('4. 验证用户名密码是否正确');

    } catch (error) {
        console.error('\n💥 正确网站测试过程中发生错误:', error);
        console.error('这可能表明网站访问或配置有问题');
    }
}

main();