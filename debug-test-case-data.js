const { PrismaClient } = require('@prisma/client');

async function debugTestCaseData() {
  const prisma = new PrismaClient();
  
  try {
    // 获取所有测试用例
    const testCases = await prisma.testCase.findMany({
      select: {
        id: true,
        title: true,
        steps: true
      }
    });
    
    console.log('🔍 测试用例数据结构分析:');
    
    testCases.forEach(testCase => {
      console.log(`\n📋 测试用例: ${testCase.title} (ID: ${testCase.id})`);
      console.log(`📄 原始steps数据: ${JSON.stringify(testCase.steps)}`);
      
      if (typeof testCase.steps === 'string') {
        try {
          const parsed = JSON.parse(testCase.steps);
          console.log(`✅ 解析后的数据:`);
          console.log(`   🎯 操作步骤: "${parsed.steps || '无'}"`);
          console.log(`   ✔️ 断言预期: "${parsed.assertions || '无'}"`);
          
          // 检查是否有断言被错误放在steps中
          if (parsed.steps && parsed.steps.includes('失败')) {
            console.log(`⚠️ 警告: 操作步骤中可能包含断言内容!`);
          }
        } catch (e) {
          console.log(`❌ JSON解析失败: ${e.message}`);
          console.log(`   原始内容: "${testCase.steps}"`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTestCaseData();