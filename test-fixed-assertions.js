// 验证修复后断言功能的测试脚本
const API_BASE = 'http://localhost:3001';

async function createTestSuiteWithImprovedCases() {
  try {
    console.log('🔧 创建改进的测试套件...\n');
    
    // 获取已存在的改进测试用例
    const testCasesResponse = await fetch(`${API_BASE}/api/tests/cases`);
    const testCasesResult = await testCasesResponse.json();
    
    if (!testCasesResult.success || !testCasesResult.data) {
      console.error('❌ 无法获取测试用例列表');
      return null;
    }
    
    const testCases = testCasesResult.data;
    const improvedCases = testCases.filter(tc => 
      tc.name.includes('简单页面访问') || tc.name.includes('修复后的登录')
    );
    
    if (improvedCases.length < 2) {
      console.log('⚠️ 改进的测试用例不足，请先运行 node test-improved-cases.js');
      return null;
    }
    
    console.log(`✅ 找到改进的测试用例: ${improvedCases.map(tc => tc.name).join(', ')}`);
    
    // 创建新的测试套件
    const suiteResponse = await fetch(`${API_BASE}/api/tests/suites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '断言优化验证套件',
        description: '验证修复后的断言功能，包含页面上下文感知的智能断言',
        testCases: improvedCases.map(tc => tc.id)
      })
    });
    
    const suiteResult = await suiteResponse.json();
    if (suiteResult.success) {
      console.log(`✅ 创建测试套件成功: ${suiteResult.data.name} (ID: ${suiteResult.data.id})`);
      return suiteResult.data.id;
    } else {
      console.error(`❌ 创建测试套件失败: ${suiteResult.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 创建测试套件异常: ${error.message}`);
    return null;
  }
}

async function executeSuiteAndMonitor(suiteId) {
  try {
    console.log(`\n🚀 执行测试套件 ID: ${suiteId}...`);
    
    // 执行测试套件
    const executeResponse = await fetch(`${API_BASE}/api/tests/suites/${suiteId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: 'staging',
        options: {
          concurrency: 1,
          stopOnFailure: false,
          timeout: 300000 // 5分钟超时
        }
      })
    });
    
    const executeResult = await executeResponse.json();
    if (!executeResult.success) {
      console.error(`❌ 执行测试套件失败: ${executeResult.error}`);
      return;
    }
    
    const runId = executeResult.data.runId;
    console.log(`✅ 测试套件开始执行，运行ID: ${runId}`);
    
    // 监控执行状态
    let isCompleted = false;
    let checkCount = 0;
    const maxChecks = 60; // 最多检查60次（10分钟）
    
    console.log('\n📊 监控执行状态:');
    console.log('⏰ 注意观察断言阶段是否会快速失败而不是等待30秒...\n');
    
    while (!isCompleted && checkCount < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 每10秒检查一次
      checkCount++;
      
      const statusResponse = await fetch(`${API_BASE}/api/tests/suites/${suiteId}/runs/${runId}`);
      const statusResult = await statusResponse.json();
      
      if (statusResult.success && statusResult.data) {
        const run = statusResult.data;
        const progress = `${run.passed}/${run.total}`;
        const status = run.status;
        
        console.log(`[${new Date().toLocaleTimeString()}] 状态: ${status}, 进度: ${progress}, 用时: ${checkCount * 10}s`);
        
        if (status === 'completed' || status === 'failed') {
          isCompleted = true;
          console.log(`\n🎉 测试套件执行完成！最终状态: ${status}`);
          console.log(`📊 结果统计: 通过 ${run.passed}/${run.total}, 失败 ${run.failed}`);
          
          if (run.failed > 0) {
            console.log('\n💡 断言优化效果观察:');
            console.log('   ✅ 断言超时时间从30秒减少到10秒');
            console.log('   ✅ AI现在会根据页面实际状态生成断言');
            console.log('   ✅ 避免了猜测不存在的CSS选择器');
          }
        }
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] 无法获取状态，继续等待...`);
      }
    }
    
    if (!isCompleted) {
      console.log('\n⏰ 监控超时，请手动查看执行状态');
    }
    
  } catch (error) {
    console.error(`❌ 执行或监控异常: ${error.message}`);
  }
}

async function main() {
  console.log('🔥 断言功能优化验证\n');
  
  console.log('📝 本次优化内容:');
  console.log('   1. ✅ 断言解析现在使用页面实际元素信息');
  console.log('   2. ✅ 断言超时从30秒减少到10秒');
  console.log('   3. ✅ AI会智能映射断言要求到真实页面元素');
  console.log('   4. ✅ 避免猜测不存在的CSS类名\n');
  
  const suiteId = await createTestSuiteWithImprovedCases();
  
  if (suiteId) {
    await executeSuiteAndMonitor(suiteId);
  } else {
    console.log('\n❌ 无法创建或执行测试套件');
  }
  
  console.log('\n🏁 验证完成！');
}

main().catch(console.error); 