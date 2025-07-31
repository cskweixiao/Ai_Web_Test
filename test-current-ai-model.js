// 测试当前 AI 模型状态
async function testCurrentAIModel() {
  console.log('🧪 测试当前 AI 模型状态...\n');

  try {
    // 1. 获取服务器端配置
    console.log('1. 获取当前服务器端配置:');
    const response = await fetch('http://localhost:3001/api/config/llm');
    const config = await response.json();

    if (config.success) {
      console.log(`   ✅ 当前模型: ${config.data.summary.modelName}`);
      console.log(`   模型ID: ${config.data.summary.modelId}`);
      console.log(`   提供商: ${config.data.summary.provider}`);
      console.log(`   温度: ${config.data.summary.temperature}`);
      console.log(`   最大令牌: ${config.data.summary.maxTokens}`);
      console.log(`   成本级别: ${config.data.summary.costLevel}`);
      console.log(`   是否已初始化: ${config.data.summary.isInitialized}`);
    } else {
      console.log(`   ❌ 获取配置失败: ${config.error}`);
    }

    // 2. 模拟一个简单的 AI 解析请求来验证实际使用的模型
    console.log('\n2. 测试 AI 解析功能:');
    console.log('   注意：这需要在实际的测试执行中才能看到 AI 调用日志');
    console.log('   建议：在前端页面执行一个简单的测试用例来验证');

    // 3. 检查日志文件中的最新记录
    console.log('\n3. 建议检查项目:');
    console.log('   - 查看 debug-execution.log 文件的最新日志');
    console.log('   - 在前端执行一个测试用例');
    console.log('   - 观察 AI 调用时使用的模型');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
testCurrentAIModel();