// 查询测试用例内容
import { PrismaClient } from '@prisma/client';

async function checkTestCase() {
  console.log('🔍 正在查询测试用例...');
  
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    // 查询所有测试用例
    const testCases = await prisma.testCase.findMany();
    console.log(`✅ 找到 ${testCases.length} 个测试用例`);
    
    // 打印每个测试用例的详细信息
    testCases.forEach((testCase, index) => {
      console.log(`\n📋 测试用例 #${index + 1}:`);
      console.log(`ID: ${testCase.id}`);
      console.log(`标题: ${testCase.name}`);
      
      // 解析steps字段
      let steps = '';
      let assertions = '';
      
      if (typeof testCase.steps === 'string') {
        try {
          const stepsObj = JSON.parse(testCase.steps);
          if (stepsObj && typeof stepsObj === 'object') {
            steps = stepsObj.steps || '';
            assertions = stepsObj.assertions || '';
          } else {
            steps = testCase.steps;
          }
        } catch (e) {
          steps = testCase.steps;
        }
      } else if (testCase.steps && typeof testCase.steps === 'object') {
        steps = testCase.steps.steps || '';
        assertions = testCase.steps.assertions || '';
      }
      
      console.log(`步骤:\n${steps}`);
      if (assertions) {
        console.log(`断言:\n${assertions}`);
      }
      
      // 解析tags字段
      let tags = [];
      if (testCase.tags) {
        if (typeof testCase.tags === 'string') {
          try {
            tags = JSON.parse(testCase.tags);
          } catch (e) {}
        } else if (Array.isArray(testCase.tags)) {
          tags = testCase.tags;
        }
      }
      
      if (tags.length > 0) {
        console.log(`标签: ${tags.join(', ')}`);
      }
      
      console.log(`创建时间: ${testCase.created_at}`);
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ 查询测试用例失败:', error);
  }
}

checkTestCase();