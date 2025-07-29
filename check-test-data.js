const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkTestData() {
  try {
    // 查询所有测试用例
    const testCases = await prisma.test_cases.findMany();
    console.log('=== 测试用例数据 ===');
    console.log(`总共找到 ${testCases.length} 个测试用例`);
    
    testCases.forEach((testCase, index) => {
      console.log(`\n--- 测试用例 ${index + 1} ---`);
      console.log(`ID: ${testCase.id}`);
      console.log(`标题: ${testCase.title}`);
      console.log(`步骤: ${testCase.steps}`);
      console.log(`标签: ${testCase.tags}`);
      console.log(`创建时间: ${testCase.created_at}`);
    });

    // 查询测试运行结果
    const testRuns = await prisma.test_run_results.findMany({
      include: {
        test_cases: true
      }
    });
    
    console.log('\n=== 测试运行结果 ===');
    console.log(`总共找到 ${testRuns.length} 个测试运行结果`);
    
    testRuns.forEach((run, index) => {
      console.log(`\n--- 运行结果 ${index + 1} ---`);
      console.log(`用例: ${run.test_cases?.title}`);
      console.log(`状态: ${run.status}`);
      console.log(`执行时间: ${run.executed_at}`);
    });

  } catch (error) {
    console.error('查询数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData();