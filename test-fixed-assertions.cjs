// 测试修复后的快照功能
const fetch = require('node-fetch');

async function testFixedSnapshot() {
  console.log('测试修复后的快照功能...');
  
  try {
    // 步骤1: 创建一个新的测试用例
    const testCase = {
      name: '测试修复后的快照功能',
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
    
    // 步骤2: 运行测试
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
    console.log('✅ 测试开始运行:', runResult);
    
    // 步骤3: 等待测试完成
    console.log('⏳ 等待测试执行完成...');
    
    // 简单等待15秒，实际应用中应该轮询测试状态
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 步骤4: 获取测试结果
    const resultResponse = await fetch(`http://localhost:3001/api/test-runs/${runResult.runId}`);
    if (!resultResponse.ok) {
      throw new Error(`获取测试结果失败: ${resultResponse.statusText}`);
    }
    
    const testResult = await resultResponse.json();
    console.log('📊 测试结果:', JSON.stringify(testResult, null, 2));
    
    // 检查测试状态
    if (testResult.status === 'completed') {
      console.log('🎉 测试成功完成!');
    } else if (testResult.status === 'failed') {
      console.log('❌ 测试失败:', testResult.logs.find(log => log.level === 'error')?.message);
    } else {
      console.log('⚠️ 测试状态:', testResult.status);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 执行测试
testFixedSnapshot(); 