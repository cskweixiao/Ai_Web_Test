// 测试断言处理功能
const fetch = require('node-fetch');

async function testAssertionHandling() {
  console.log('🧪 测试断言处理功能...');
  
  try {
    // 创建一个包含断言的测试用例
    const testCase = {
      name: '登录失败测试',
      steps: '1. 进入网站https://k8s-saas-tmp.ycb51.cn/supplychain_page/login\n2. 输入错误的账号和密码\n3. 点击登录按钮',
      assertions: '登入失败'  // 断言放在正确的字段中
    };
    
    console.log('📝 创建测试用例:');
    console.log('   操作步骤:', testCase.steps);
    console.log('   断言预期:', testCase.assertions);
    
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
    console.log('✅ 测试用例创建成功:', newTest.id);
    
    // 运行测试
    console.log('\n🚀 开始运行测试...');
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
    console.log('✅ 测试开始运行，运行ID:', runResult.runId);
    
    // 监控测试执行
    console.log('\n⏳ 监控测试执行过程...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      try {
        const resultResponse = await fetch(`http://localhost:3001/api/test-runs/${runResult.runId}`);
        if (!resultResponse.ok) {
          console.log(`尝试 ${attempts}: 获取测试结果失败，继续等待...`);
          continue;
        }
        
        const testResult = await resultResponse.json();
        console.log(`尝试 ${attempts}: 测试状态 = ${testResult.status}`);
        
        // 分析日志，查看断言处理
        if (testResult.logs) {
          const assertionLogs = testResult.logs.filter(log => 
            log.message.includes('断言') || 
            log.message.includes('AI断言') ||
            log.message.includes('parseAssertions')
          );
          
          if (assertionLogs.length > 0) {
            console.log('\n📊 断言处理日志:');
            assertionLogs.forEach(log => {
              console.log(`   [${log.level}] ${log.message}`);
            });
          }
        }
        
        if (testResult.status === 'completed' || testResult.status === 'failed' || testResult.status === 'cancelled') {
          console.log(`\n🎯 测试执行完成，最终状态: ${testResult.status}`);
          
          // 验证断言是否被正确处理
          const hasAssertionProcessing = testResult.logs?.some(log => 
            log.message.includes('AI断言') || log.message.includes('parseAssertions')
          );
          
          if (hasAssertionProcessing) {
            console.log('✅ 断言处理功能正常工作');
          } else {
            console.log('⚠️ 未检测到断言处理日志');
          }
          
          break;
        }
      } catch (error) {
        console.log(`尝试 ${attempts}: 检查状态时出错:`, error.message);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('❌ 测试监控超时');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 执行测试
testAssertionHandling();