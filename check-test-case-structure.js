const { PrismaClient } = require('@prisma/client');

async function checkTestCaseStructure() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 查询测试用例数据结构...\n');
    console.log('📋 数据库表结构:');
    console.log('   表名: test_cases');
    console.log('   字段: id, title, steps(JSON), tags(JSON), created_at');
    console.log('   steps字段应该包含: {"steps": "操作步骤", "assertions": "断言预期"}\n');
    
    // 查询所有测试用例
    const testCases = await prisma.test_cases.findMany({
      select: {
        id: true,
        title: true,
        steps: true,
        created_at: true
      },
      orderBy: {
        id: 'desc'
      },
      take: 10 // 只看最新的10条
    });
    
    console.log(`📊 找到 ${testCases.length} 个测试用例:\n`);
    
    testCases.forEach((testCase, index) => {
      console.log(`${index + 1}. 测试用例 ID: ${testCase.id}`);
      console.log(`   标题: ${testCase.title}`);
      console.log(`   创建时间: ${testCase.created_at}`);
      console.log(`   steps字段类型: ${typeof testCase.steps}`);
      console.log(`   steps原始数据: ${JSON.stringify(testCase.steps, null, 2)}`);
      
      // 分析数据结构
      if (typeof testCase.steps === 'string') {
        try {
          const parsed = JSON.parse(testCase.steps);
          console.log(`   ✅ JSON解析成功:`);
          console.log(`      parsed.steps: "${parsed.steps || '无'}"`);
          console.log(`      parsed.assertions: "${parsed.assertions || '无'}"`);
          
          // 检查"登入失败"的位置
          if (parsed.steps && parsed.steps.includes('登入失败')) {
            console.log(`   ❌ 问题: "登入失败" 在 parsed.steps 中! (应该在 parsed.assertions 中)`);
          }
          if (parsed.assertions && parsed.assertions.includes('登入失败')) {
            console.log(`   ✅ 正确: "登入失败" 在 parsed.assertions 中`);
          }
          
          // 检查其他可能的断言关键词
          const assertionKeywords = ['失败', '成功', '错误', '显示', '验证', '检查'];
          assertionKeywords.forEach(keyword => {
            if (parsed.steps && parsed.steps.includes(keyword)) {
              console.log(`   ⚠️ 可能的断言词 "${keyword}" 在操作步骤中`);
            }
          });
          
        } catch (e) {
          console.log(`   ❌ JSON解析失败: ${e.message}`);
          console.log(`   这可能是纯字符串格式，不是JSON对象`);
        }
      } else if (testCase.steps && typeof testCase.steps === 'object') {
        console.log(`   ✅ 直接是对象结构:`);
        console.log(`      testCase.steps.steps: "${testCase.steps.steps || '无'}"`);
        console.log(`      testCase.steps.assertions: "${testCase.steps.assertions || '无'}"`);
        
        // 检查"登入失败"的位置
        if (testCase.steps.steps && testCase.steps.steps.includes('登入失败')) {
          console.log(`   ❌ 问题: "登入失败" 在 testCase.steps.steps 中! (应该在 testCase.steps.assertions 中)`);
        }
        if (testCase.steps.assertions && testCase.steps.assertions.includes('登入失败')) {
          console.log(`   ✅ 正确: "登入失败" 在 testCase.steps.assertions 中`);
        }
      } else {
        console.log(`   ⚠️ steps字段为空或null`);
      }
      
      console.log(''); // 空行分隔
    });
    
    // 专门查找包含"登入失败"的测试用例
    console.log('🔍 专门查找包含"登入失败"的测试用例...\n');
    
    const casesWithLoginFailed = await prisma.$queryRaw`
      SELECT id, title, steps 
      FROM test_cases 
      WHERE JSON_EXTRACT(steps, '$') LIKE '%登入失败%'
         OR steps LIKE '%登入失败%'
    `;
    
    if (casesWithLoginFailed.length > 0) {
      console.log(`📋 找到 ${casesWithLoginFailed.length} 个包含"登入失败"的测试用例:`);
      casesWithLoginFailed.forEach((testCase, index) => {
        console.log(`${index + 1}. ID: ${testCase.id}, 标题: ${testCase.title}`);
        console.log(`   数据: ${JSON.stringify(testCase.steps, null, 2)}`);
      });
    } else {
      console.log('❌ 没有找到包含"登入失败"的测试用例');
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestCaseStructure();