// 测试登录成功断言
const fetch = require('node-fetch');

async function testLoginAssertion() {
  console.log('测试登录成功断言...');
  
  try {
    // 创建测试用例
    const testCase = {
      name: '登录测试用例',
      steps: '1、进入网站https://k8s-saas-tmp.ycb51.cn/supplychain_page/login\n2、输入账号admin\n3.点击登入   预期结果  登入成功'
    };
    
    const createResponse = await fetch('http://localhost:3001/api/tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCase)
    });
    
    if (!createResponse.ok) {
      throw new Error(`创建测试用例失败: ${createResponse.statusText}`);
    }
    
    const newTest = await createResponse.json();
    console.log('✅ 创建测试用例成功:', newTest);
    
    // 运行测试
    const runResponse = await fetch(`http://localhost:3001/api/tests/${newTest.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ environment: 'staging' })
    });
    
    if (!runResponse.ok) {
      throw new Error(`运行测试失败: ${runResponse.statusText}`);
    }
    
    const runResult = await runResponse.json();
    console.log('✅ 测试开始运行:', runResult.runId);
    
    // 等待测试完成
    console.log('⏳ 等待测试执行完成...');
    let testComplete = false;
    let testResult = null;
    let attempts = 0;
    
    while (!testComplete && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 每2秒检查一次
      attempts++;
      
      const resultResponse = await fetch(`http://localhost:3001/api/test-runs/${runResult.runId}`);
      if (!resultResponse.ok) {
        console.log(`尝试 ${attempts}: 获取测试结果失败，将重试...`);
        continue;
      }
      
      testResult = await resultResponse.json();
      console.log(`尝试 ${attempts}: 测试状态 = ${testResult.status}`);
      
      if (testResult.status === 'completed' || testResult.status === 'failed' || testResult.status === 'cancelled') {
        testComplete = true;
      }
    }
    
    if (!testComplete) {
      console.log('❌ 测试执行超时，未能获取最终结果');
      return;
    }
    
    // 分析日志，查找断言相关的记录
    if (testResult && testResult.logs) {
      console.log('\n📊 断言相关日志:');
      
      const assertionLogs = testResult.logs.filter(log => 
        log.message.includes('断言') || 
        log.message.includes('验证') || 
        log.message.includes('expect') ||
        log.message.includes('登入成功')
      );
      
      assertionLogs.forEach(log => {
        console.log(`[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level}] ${log.message}`);
      });
      
      // 检查测试状态
      if (testResult.status === 'completed') {
        console.log('\n🎉 测试成功完成!');
      } else if (testResult.status === 'failed') {
        const errorLog = testResult.logs.find(log => log.level === 'error');
        console.log(`\n❌ 测试失败: ${errorLog?.message || '未知错误'}`);
      } else {
        console.log(`\n⚠️ 测试状态: ${testResult.status}`);
      }
    } else {
      console.log('❓ 未能获取测试日志');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 执行测试
testLoginAssertion(); 