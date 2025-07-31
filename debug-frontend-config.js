// 测试后端设置服务的导入和使用
async function testBackendSettingsService() {
  try {
    console.log('🔧 测试后端设置服务导入...');
    
    // 动态导入后端设置服务
    const { backendSettingsService } = await import('./server/services/settingsService.js');
    
    console.log('✅ 后端设置服务导入成功');
    
    // 测试获取LLM设置
    const settings = await backendSettingsService.getLLMSettings();
    
    console.log('✅ 获取LLM设置成功:');
    console.log('   模型:', settings.selectedModelId);
    console.log('   温度:', settings.customConfig?.temperature);
    console.log('   最大令牌:', settings.customConfig?.maxTokens);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('   错误详情:', error.stack);
  }
}

testBackendSettingsService();