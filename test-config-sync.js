import { llmConfigManager } from './src/services/llmConfigManager.ts';

async function testConfigSync() {
  try {
    console.log('🔧 测试配置管理器初始化...');
    
    // 初始化配置管理器
    await llmConfigManager.initialize();
    
    // 获取当前配置
    const config = llmConfigManager.getCurrentConfig();
    const modelInfo = llmConfigManager.getModelInfo();
    
    console.log('✅ 配置管理器初始化成功');
    console.log('📋 当前配置:');
    console.log('   模型:', config.model);
    console.log('   模型名称:', modelInfo.name);
    console.log('   提供商:', modelInfo.provider);
    console.log('   温度:', config.temperature);
    console.log('   最大令牌:', config.maxTokens);
    console.log('   API密钥:', config.apiKey ? '已设置' : '未设置');
    
    // 测试重新加载
    console.log('\n🔄 测试配置重新加载...');
    await llmConfigManager.reloadConfig();
    
    const reloadedConfig = llmConfigManager.getCurrentConfig();
    const reloadedModelInfo = llmConfigManager.getModelInfo();
    
    console.log('✅ 配置重新加载成功');
    console.log('📋 重新加载后的配置:');
    console.log('   模型:', reloadedConfig.model);
    console.log('   模型名称:', reloadedModelInfo.name);
    console.log('   提供商:', reloadedModelInfo.provider);
    
  } catch (error) {
    console.error('❌ 配置管理器测试失败:', error);
    console.error('   错误详情:', error.stack);
  }
}

testConfigSync();