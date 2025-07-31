// 简单的配置状态检查脚本
console.log('🔍 检查配置状态...\n');

// 检查localStorage中的设置
if (typeof window !== 'undefined' && window.localStorage) {
  const rawData = localStorage.getItem('testflow_settings');
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      console.log('📋 localStorage中的设置:');
      console.log('   选中的模型ID:', parsed.llm?.selectedModelId || '未设置');
      console.log('   API密钥:', parsed.llm?.apiKey ? `${parsed.llm.apiKey.substring(0, 20)}...` : '未设置');
      console.log('   自定义配置:', parsed.llm?.customConfig || '未设置');
      console.log('\n📄 完整数据:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (error) {
      console.error('❌ 解析localStorage数据失败:', error);
    }
  } else {
    console.log('⚠️ localStorage中没有找到设置数据');
  }
} else {
  console.log('⚠️ 不在浏览器环境中，无法访问localStorage');
}

// 如果在浏览器环境中，尝试检查全局对象
if (typeof window !== 'undefined') {
  console.log('\n🌐 浏览器环境检查:');
  console.log('   当前URL:', window.location.href);
  console.log('   用户代理:', navigator.userAgent.substring(0, 50) + '...');
}