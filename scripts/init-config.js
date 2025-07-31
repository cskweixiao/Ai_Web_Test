import { PrismaClient } from '../src/generated/prisma/index.js';

async function initializeConfig() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 初始化配置数据...');
    
    // 检查是否已存在配置
    const existingConfig = await prisma.settings.findUnique({
      where: { key: 'app_settings' }
    });
    
    if (existingConfig) {
      console.log('✅ 配置数据已存在，跳过初始化');
      return;
    }
    
    // 创建默认配置
    const defaultSettings = {
      llm: {
        selectedModelId: 'deepseek-chat-v3', // 使用deepseek作为默认
        apiKey: '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',
        customConfig: {
          temperature: 0.2,
          maxTokens: 2000
        }
      },
      system: {
        timeout: 300,
        maxConcurrency: 5,
        logRetentionDays: 30
      }
    };
    
    // 保存到数据库
    await prisma.settings.create({
      data: {
        key: 'app_settings',
        value: JSON.stringify(defaultSettings),
        updated_at: new Date()
      }
    });
    
    console.log('✅ 默认配置已初始化');
    console.log('   默认模型: DeepSeek Chat V3');
    console.log('   温度: 0.2');
    console.log('   最大令牌: 2000');
    
  } catch (error) {
    console.error('❌ 配置初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 直接运行初始化
initializeConfig()
  .then(() => {
    console.log('🎉 配置初始化完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 配置初始化失败:', error);
    process.exit(1);
  });

export { initializeConfig };