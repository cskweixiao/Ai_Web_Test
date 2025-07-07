import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

const smartTestCase = {
    name: '【智能执行】用户登录并验证Dashboard',
    steps: `
1. 导航到 http://localhost:5173/login
2. 在用户名字段输入 "admin"
3. 在密码字段输入 "password"
4. 点击 "登录" 按钮
5. 验证页面上是否出现 "Dashboard" 标题
`
};

async function createTestCase(testCase) {
    console.log('正在创建测试用例...');
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
    console.log('✅ 测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeTest(testCaseId) {
    console.log(`\n🔥 开始执行测试用例 ID: ${testCaseId}`);
    const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
    });
    if (!response.ok) {
        throw new Error(`执行测试失败: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('✅ 测试已启动, Run ID:', result.runId);
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
    console.log('🕰️ 等待测试完成...');
    let testRun;
    const startTime = Date.now();

    while (Date.now() - startTime < 120000) { // 2 minute timeout
        testRun = await getTestRunStatus(runId);
        
        console.log(`[${new Date().toLocaleTimeString()}] 当前状态: ${testRun.status}`);

        if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
            console.log(`\n🎉 测试执行结束, 最终状态: ${testRun.status.toUpperCase()}`);
            return testRun;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    throw new Error("等待测试完成超时 (2分钟)");
}

async function main() {
    try {
        const newTestCase = await createTestCase(smartTestCase);
        const runId = await executeTest(newTestCase.id);
        const finalRun = await waitForCompletion(runId);
        
        console.log('\n--- 最终测试日志 ---');
        finalRun.logs.forEach(log => {
            console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        });

        if (finalRun.status !== 'completed') {
            console.error('\n❌ 测试未成功完成!');
            process.exit(1);
        } else {
            console.log('\n✅ 测试成功!');
            process.exit(0);
        }

    } catch (error) {
        console.error('\n🚨 执行脚本时发生致命错误:', error);
        process.exit(1);
    }
}

main(); 