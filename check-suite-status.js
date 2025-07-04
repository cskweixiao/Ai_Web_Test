// 检查测试套件执行状态脚本
const API_BASE = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkTestCases() {
  try {
    const response = await fetch(`${API_BASE}/api/tests/cases`);
    const testCases = await response.json();
    
    console.log(`📋 当前测试用例列表 (${testCases.length} 个):`);
    testCases.forEach(tc => {
      console.log(`   • [${tc.id}] ${tc.name} - ${tc.status}`);
    });
    return testCases;
  } catch (error) {
    console.error(`❌ 获取测试用例失败: ${error.message}`);
    return [];
  }
}

async function checkTestSuites() {
  try {
    const response = await fetch(`${API_BASE}/api/test-suites`);
    const testSuites = await response.json();
    
    console.log(`📦 当前测试套件列表 (${testSuites.length} 个):`);
    testSuites.forEach(suite => {
      console.log(`   • [${suite.id}] ${suite.name}`);
      console.log(`     描述: ${suite.description}`);
      console.log(`     包含用例: ${suite.testCaseIds.join(', ')}`);
      console.log(`     状态: ${suite.status}, 优先级: ${suite.priority}`);
      console.log('');
    });
    return testSuites;
  } catch (error) {
    console.error(`❌ 获取测试套件失败: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🔍 检查测试套件和测试用例状态...\n');
  
  await checkTestCases();
  console.log('');
  await checkTestSuites();
  
  console.log('💡 提示: 如果要查看详细的执行日志，请查看服务器控制台输出');
  console.log('🎯 串行执行应该显示类似以下的日志:');
  console.log('   🚀 [Suite xxx] 开始串行执行 2 个测试用例');
  console.log('   🎬 [Suite xxx] 执行测试用例 1/2: 3');
  console.log('   ⏳ [Suite xxx] 等待测试用例 3 执行完成...');
  console.log('   ✅ [Suite xxx] 测试用例 3 执行成功');
  console.log('   ⏱️ [Suite xxx] 测试用例间隔等待 2 秒...');
  console.log('   🎬 [Suite xxx] 执行测试用例 2/2: 4');
  console.log('   ⏳ [Suite xxx] 等待测试用例 4 执行完成...');
  console.log('   ✅ [Suite xxx] 测试用例 4 执行成功');
  console.log('   🎉 [Suite xxx] 套件执行完成: 2/2 通过');
}

main().catch(console.error); 