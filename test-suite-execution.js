// 测试套件串行执行验证脚本
const API_BASE = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestCase(name, steps, assertions) {
  try {
    const response = await fetch(`${API_BASE}/api/tests/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        steps,
        assertions,
        priority: 'medium',
        status: 'active',
        tags: ['demo', 'test'],
        author: '测试脚本'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 创建测试用例成功: ${name} (ID: ${result.data.id})`);
      return result.data.id;
    } else {
      console.error(`❌ 创建测试用例失败: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 创建测试用例异常: ${error.message}`);
    return null;
  }
}

async function createTestSuite(name, description, testCaseIds) {
  try {
    const response = await fetch(`${API_BASE}/api/test-suites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        testCases: testCaseIds, // 直接传ID数组
        priority: 'high',
        status: 'active',
        tags: ['demo', 'suite'],
        author: '测试脚本'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 创建测试套件成功: ${name} (ID: ${result.data.id})`);
      console.log(`📋 包含测试用例: ${result.data.testCaseIds.join(', ')}`);
      return result.data.id;
    } else {
      console.error(`❌ 创建测试套件失败: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 创建测试套件异常: ${error.message}`);
    return null;
  }
}

async function executeSuite(suiteId) {
  try {
    console.log(`🚀 开始执行测试套件 ${suiteId}...`);
    
    const response = await fetch(`${API_BASE}/api/test-suites/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suiteId,
        environment: 'demo'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 测试套件已提交执行: ${result.runId}`);
      return result.runId;
    } else {
      console.error(`❌ 执行测试套件失败: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 执行测试套件异常: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎯 开始测试套件串行执行验证...\n');
  
  // 1. 创建两个测试用例
  console.log('📝 第一步: 创建测试用例');
  const testCase1 = await createTestCase(
    '快速测试用例1',
    '1. 访问百度首页 https://www.baidu.com\n2. 等待页面加载完成',
    '• 页面标题包含"百度"\n• 搜索框可见'
  );
  
  const testCase2 = await createTestCase(
    '快速测试用例2', 
    '1. 访问必应首页 https://www.bing.com\n2. 等待页面加载完成',
    '• 页面标题包含"Bing"\n• 搜索框可见'
  );
  
  if (!testCase1 || !testCase2) {
    console.error('❌ 无法创建测试用例，终止测试');
    return;
  }
  
  await sleep(1000);
  
  // 2. 创建包含两个测试用例的套件
  console.log('\n📦 第二步: 创建测试套件');
  const suite = await createTestSuite(
    '串行执行验证套件',
    '验证测试套件能够正确串行执行多个测试用例',
    [testCase1, testCase2]
  );
  
  if (!suite) {
    console.error('❌ 无法创建测试套件，终止测试');
    return;
  }
  
  await sleep(1000);
  
  // 3. 执行测试套件
  console.log('\n🎬 第三步: 执行测试套件');
  const runId = await executeSuite(suite);
  
  if (runId) {
    console.log(`\n🔍 观察服务器日志以查看串行执行过程...`);
    console.log(`📊 预期看到:`);
    console.log(`   • 测试用例按顺序一个接一个执行`);
    console.log(`   • 每个测试等待前一个完成后才开始`);
    console.log(`   • 测试用例间有2秒间隔`);
    console.log(`   • 准确的成功/失败统计`);
  }
  
  console.log('\n✅ 测试脚本执行完成！');
}

// 运行测试
main().catch(console.error); 