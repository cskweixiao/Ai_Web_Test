// 强制同步前端配置到服务器端
async function forceSyncConfig() {
  console.log('🔄 强制同步配置...\n');

  try {
    // 1. 检查前端 localStorage 配置
    console.log('1. 检查前端配置:');
    let frontendConfig = null;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      const rawData = localStorage.getItem('testflow_settings');
      if (rawData) {
        frontendConfig = JSON.parse(rawData);
        console.log(`   前端模型ID: ${frontendConfig.llm?.selectedModelId || '未设置'}`);
      } else {
        console.log('   前端没有配置数据');
      }
    } else {
      console.log('   不在浏览器环境中');
    }

    // 2. 获取服务器端当前配置
    console.log('\n2. 获取服务器端配置:');
    const serverResponse = await fetch('http://localhost:3001/api/config/llm');
    const serverConfig = await serverResponse.json();
    
    if (serverConfig.success) {
      console.log(`   服务器端模型: ${serverConfig.data.summary.modelName}`);
      console.log(`   服务器端模型ID: ${serverConfig.data.summary.modelId}`);
    }

    // 3. 如果前端有配置，同步到服务器端
    if (frontendConfig && frontendConfig.llm) {
      console.log('\n3. 同步前端配置到服务器端:');
      
      const syncResponse = await fetch('http://localhost:3001/api/config/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: frontendConfig.llm
        })
      });

      const syncResult = await syncResponse.json();
      
      if (syncResult.success) {
        console.log(`   ✅ 同步成功: ${syncResult.data.summary.modelName}`);
      } else {
        console.log(`   ❌ 同步失败: ${syncResult.error}`);
        if (syncResult.validationErrors) {
          console.log('   验证错误:', syncResult.validationErrors);
        }
      }
    } else {
      // 4. 如果前端没有配置，使用默认的 DeepSeek 配置
      console.log('\n3. 使用默认 DeepSeek 配置:');
      
      const defaultDeepSeekConfig = {
        selectedModelId: 'deepseek-chat-v3',
        apiKey: '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',
        customConfig: {
          temperature: 0.2,
          maxTokens: 2000
        }
      };

      const syncResponse = await fetch('http://localhost:3001/api/config/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: defaultDeepSeekConfig
        })
      });

      const syncResult = await syncResponse.json();
      
      if (syncResult.success) {
        console.log(`   ✅ 设置默认配置成功: ${syncResult.data.summary.modelName}`);
        
        // 同时更新前端 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const newSettings = {
            llm: defaultDeepSeekConfig,
            system: {
              timeout: 300,
              maxConcurrency: 10,
              logRetentionDays: 90
            }
          };
          localStorage.setItem('testflow_settings', JSON.stringify(newSettings));
          console.log('   ✅ 前端配置也已更新');
        }
      } else {
        console.log(`   ❌ 设置默认配置失败: ${syncResult.error}`);
      }
    }

    // 4. 最终验证
    console.log('\n4. 最终验证:');
    const finalResponse = await fetch('http://localhost:3001/api/config/llm');
    const finalConfig = await finalResponse.json();
    
    if (finalConfig.success) {
      console.log(`   最终服务器端模型: ${finalConfig.data.summary.modelName}`);
      console.log(`   模型ID: ${finalConfig.data.summary.modelId}`);
      console.log(`   提供商: ${finalConfig.data.summary.provider}`);
      
      if (finalConfig.data.summary.modelId.includes('deepseek')) {
        console.log('   🎉 配置同步成功！现在前后端都使用 DeepSeek');
      } else {
        console.log('   ⚠️ 配置可能还没有完全同步');
      }
    }

  } catch (error) {
    console.error('❌ 强制同步过程中出现错误:', error);
  }
}

// 运行强制同步
forceSyncConfig();