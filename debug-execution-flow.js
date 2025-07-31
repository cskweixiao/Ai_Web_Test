// 在testExecution.ts的主执行循环开始处添加详细日志
// 找到这行代码：let remainingSteps = testCase.steps;
// 在它后面添加：

console.log(`🔍 [DEBUG] 测试用例原始数据:`);
console.log(`   testCase.id: ${testCase.id}`);
console.log(`   testCase.name: ${testCase.name}`);
console.log(`   testCase.steps: "${testCase.steps}"`);
console.log(`   testCase.assertions: "${testCase.assertions}"`);
console.log(`   remainingSteps初始值: "${remainingSteps}"`);

// 在while循环内部，parseNextStep调用前添加：
console.log(`🔍 [DEBUG] 第${stepIndex}次循环:`);
console.log(`   当前remainingSteps: "${remainingSteps}"`);
console.log(`   remainingSteps类型: ${typeof remainingSteps}`);
console.log(`   remainingSteps长度: ${remainingSteps?.length || 0}`);

// 在aiResult获取后添加：
console.log(`🔍 [DEBUG] AI解析结果:`);
console.log(`   aiResult.success: ${aiResult.success}`);
console.log(`   aiResult.step: ${JSON.stringify(aiResult.step, null, 2)}`);
console.log(`   aiResult.remaining: "${aiResult.remaining}"`);
console.log(`   aiResult.error: ${aiResult.error}`);

// 这个脚本用于指导你在代码中添加调试日志
console.log('请在server/services/testExecution.ts中添加上述调试日志');
console.log('然后运行测试用例，查看详细的执行流程');