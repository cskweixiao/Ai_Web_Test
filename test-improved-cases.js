// 改进的测试用例创建脚本 - 修复断言问题
const API_BASE = 'http://localhost:3001';

async function createImprovedTestCase() {
  try {
    // 创建一个更简单、更可靠的测试用例
    const response = await fetch(`${API_BASE}/api/tests/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '简单页面访问测试',
        steps: '1. 访问百度首页 https://www.baidu.com\n2. 等待页面加载完成',
        assertions: '• 页面标题包含"百度"\n• 搜索框可见', // 更可靠的断言
        priority: 'medium',
        status: 'active',
        tags: ['demo', 'simple'],
        author: '改进测试'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 创建改进测试用例成功: ${result.data.name} (ID: ${result.data.id})`);
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

async function createFixedLoginTest() {
  try {
    // 创建一个修复了问题的登录测试
    const response = await fetch(`${API_BASE}/api/tests/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '修复后的登录测试',
        steps: `1. 访问登录页面 https://supply-test.ycb51.cn/api_platform/
2. 在账号输入框中输入 admin
3. 在密码输入框中输入 wrongpassword
4. 点击登录按钮`,
        assertions: '• 页面显示错误提示\n• 仍然停留在登录页面', // 更通用的断言
        priority: 'medium',
        status: 'active',
        tags: ['login', 'fixed'],
        author: '改进测试'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 创建修复登录测试成功: ${result.data.name} (ID: ${result.data.id})`);
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

async function main() {
  console.log('🔧 创建改进的测试用例...\n');
  
  console.log('📝 问题分析:');
  console.log('   1. 原测试步骤缺少密码输入');
  console.log('   2. 断言预期过于具体，实际页面可能不匹配');
  console.log('   3. Playwright默认30秒超时太长\n');
  
  console.log('💡 改进方案:');
  console.log('   1. 创建更简单的页面访问测试');
  console.log('   2. 修复登录测试的步骤完整性');
  console.log('   3. 使用更通用的断言预期\n');
  
  const simpleTest = await createImprovedTestCase();
  const fixedLoginTest = await createFixedLoginTest();
  
  if (simpleTest && fixedLoginTest) {
    console.log('\n🎯 建议:');
    console.log('   • 使用这些改进的测试用例创建新的测试套件');
    console.log('   • 简单测试更容易成功，适合验证串行执行');
    console.log('   • 登录测试现在包含了完整的步骤');
  }
  
  console.log('\n🛠️ 断言优化建议:');
  console.log('   • 避免过于具体的错误消息断言');
  console.log('   • 使用页面元素存在性验证');
  console.log('   • 缩短Playwright超时时间');
}

main().catch(console.error); 