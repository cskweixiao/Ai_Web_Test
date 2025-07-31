import { PrismaClient } from './src/generated/prisma/index.js';

async function checkDatabaseConfig() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查数据库中的配置...');
    
    const result = await prisma.settings.findUnique({
      where: { key: 'app_settings' }
    });
    
    if (result) {
      console.log('✅ 找到配置记录:');
      console.log('   Key:', result.key);
      console.log('   Updated:', result.updated_at);
      console.log('   Value length:', result.value?.length || 0);
      
      if (result.value) {
        try {
          const parsed = JSON.parse(result.value);
          console.log('📋 解析后的配置:');
          console.log('   LLM模型:', parsed.llm?.selectedModelId || '未设置');
          console.log('   API密钥:', parsed.llm?.apiKey ? '已设置' : '未设置');
          console.log('   温度:', parsed.llm?.customConfig?.temperature || '未设置');
          console.log('   最大令牌:', parsed.llm?.customConfig?.maxTokens || '未设置');
          console.log('   完整配置:', JSON.stringify(parsed, null, 2));
        } catch (parseError) {
          console.error('❌ JSON解析失败:', parseError.message);
          console.log('   原始值:', result.value);
        }
      } else {
        console.log('⚠️ 配置值为空');
      }
    } else {
      console.log('❌ 数据库中没有找到配置记录');
      console.log('💡 这可能是问题的原因！');
    }
    
  } catch (error) {
    console.error('❌ 检查配置失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseConfig();