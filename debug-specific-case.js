const { PrismaClient } = require('@prisma/client');

async function debugSpecificCase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 调试具体的测试用例...\n');
    
    // 查找你提到的测试用例数据
    const testCases = await prisma.test_cases.findMany({
      where: {
        steps: {
          contains: '登入失败'
        }
      }
    });
    
    console.log(`📋 找到 ${testCases.length} 个包含"登入失败"的测试用例:`);
    
    for (const testCase of testCases) {
      console.log(`\n📄 测试用例详情:`);
      console.log(`   ID: ${testCase.id}`);
      console.log(`   标题: ${testCase.title}`);
      console.log(`   创建时间: ${testCase.created_at}`);
      
      // 解析steps字段
      let stepsData;
      try {
        if (typeof testCase.steps === 'string') {
          stepsData = JSON.parse(testCase.steps);
        } else {
          stepsData = testCase.steps;
        }
        
        console.log(`\n📊 解析后的数据结构:`);
        console.log(`   类型: ${typeof stepsData}`);
        console.log(`   完整数据: ${JSON.stringify(stepsData, null, 2)}`);
        
        if (stepsData && typeof stepsData === 'object') {
          console.log(`\n🔍 字段分析:`);
          console.log(`   steps字段: "${stepsData.steps || '无'}"`);
          console.log(`   assertions字段: "${stepsData.assertions || '无'}"`);
          
          // 检查"登入失败"在哪个字段中
          if (stepsData.steps && stepsData.steps.includes('登入失败')) {
            console.log(`   ❌ 问题确认: "登入失败" 在steps字段中!`);
            console.log(`   🔧 建议: 需要将"登入失败"移动到assertions字段`);
          }
          
          if (stepsData.assertions && stepsData.assertions.includes('登入失败')) {
            console.log(`   ✅ 正确: "登入失败" 在assertions字段中`);
          }
          
          // 分析steps字段的每一行
          if (stepsData.steps) {
            const stepLines = stepsData.steps.split('\n').filter(line => line.trim());
            console.log(`\n📋 操作步骤分析 (共${stepLines.length}行):`);
            stepLines.forEach((line, index) => {
              console.log(`   ${index + 1}. "${line.trim()}"`);
              if (line.includes('登入失败')) {
                console.log(`      ⚠️ 这一行包含断言内容!`);
              }
            });
          }
        }
        
      } catch (e) {
        console.log(`   ❌ JSON解析失败: ${e.message}`);
        console.log(`   原始数据: ${testCase.steps}`);
      }
    }
    
    // 如果没有找到，查看所有测试用例
    if (testCases.length === 0) {
      console.log('\n🔍 没有找到包含"登入失败"的测试用例，查看所有测试用例...');
      
      const allCases = await prisma.test_cases.findMany({
        orderBy: { id: 'desc' },
        take: 5
      });
      
      allCases.forEach(testCase => {
        console.log(`\n📄 测试用例 ${testCase.id}: ${testCase.title}`);
        console.log(`   数据: ${JSON.stringify(testCase.steps)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSpecificCase();