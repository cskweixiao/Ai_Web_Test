import { Router } from 'express';
import { BackendSettingsService } from '../services/settingsService.js';
import { llmConfigManager } from '../../src/services/llmConfigManager.js';
import { modelRegistry } from '../../src/services/modelRegistry.js';
import { ProxyAgent } from 'undici';

const router = Router();

// 延迟获取设置服务实例（避免模块加载时初始化）
const getSettingsService = () => BackendSettingsService.getInstance();

// 获取LLM配置
router.get('/llm', async (req, res) => {
  try {
    const llmSettings = await getSettingsService().getLLMSettings();
    res.json({
      success: true,
      data: llmSettings
    });
  } catch (error: any) {
    console.error('❌ 获取LLM配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    });
  }
});

// 保存LLM配置
router.post('/llm', async (req, res) => {
  try {
    const llmSettings = req.body;
    
    // 验证请求数据
    if (!llmSettings || typeof llmSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的配置数据'
      });
    }

    // 保存配置到数据库
    await getSettingsService().saveLLMSettings(llmSettings);
    
    // 通知配置管理器重新加载配置
    try {
      await llmConfigManager.reloadConfig();
      console.log('✅ 配置管理器已重新加载');
    } catch (reloadError: any) {
      console.warn('⚠️ 配置管理器重新加载失败:', reloadError.message);
      // 不阻断保存操作，只是警告
    }
    
    // 获取保存后的配置信息和模型信息
    const savedSettings = await getSettingsService().getLLMSettings();
    const modelInfo = modelRegistry.getModelById(savedSettings.selectedModelId);
    
    res.json({
      success: true,
      message: '配置保存成功',
      data: {
        settings: savedSettings,
        summary: {
          modelName: modelInfo?.name || '未知模型',
          modelId: savedSettings.selectedModelId,
          provider: modelInfo?.provider || '未知提供商',
          baseUrl: savedSettings.baseUrl || modelInfo?.customBaseUrl || 'https://openrouter.ai/api/v1'
        }
      }
    });
  } catch (error: any) {
    console.error('❌ 保存LLM配置失败:', error);
    
    // 处理验证错误
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || '保存配置失败'
    });
  }
});

// 获取完整配置
router.get('/all', async (req, res) => {
  try {
    const settings = await getSettingsService().getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error('❌ 获取完整配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    });
  }
});

// 重置配置为默认值
router.post('/reset', async (req, res) => {
  try {
    await getSettingsService().resetToDefaults();
    
    // 通知配置管理器重新加载配置
    try {
      await llmConfigManager.reloadConfig();
      console.log('✅ 配置管理器已重新加载');
    } catch (reloadError: any) {
      console.warn('⚠️ 配置管理器重新加载失败:', reloadError.message);
    }
    
    res.json({
      success: true,
      message: '配置已重置为默认值'
    });
  } catch (error: any) {
    console.error('❌ 重置配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '重置配置失败'
    });
  }
});

// 导出配置
router.get('/export', async (req, res) => {
  try {
    const exportData = await getSettingsService().exportSettings();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="testflow-settings.json"');
    res.send(exportData);
  } catch (error: any) {
    console.error('❌ 导出配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '导出配置失败'
    });
  }
});

// 导入配置
router.post('/import', async (req, res) => {
  try {
    const { configData } = req.body;
    
    if (!configData || typeof configData !== 'string') {
      return res.status(400).json({
        success: false,
        error: '无效的配置数据'
      });
    }

    await getSettingsService().importSettings(configData);
    
    // 通知配置管理器重新加载配置
    try {
      await llmConfigManager.reloadConfig();
      console.log('✅ 配置管理器已重新加载');
    } catch (reloadError: any) {
      console.warn('⚠️ 配置管理器重新加载失败:', reloadError.message);
    }
    
    res.json({
      success: true,
      message: '配置导入成功'
    });
  } catch (error: any) {
    console.error('❌ 导入配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '导入配置失败'
    });
  }
});

// 测试配置连接
router.post('/test-connection', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const llmSettings = req.body;
    
    if (!llmSettings || typeof llmSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的配置数据'
      });
    }

    // 验证配置
    const validation = await getSettingsService().validateLLMSettings(llmSettings);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: '配置验证失败',
        validationErrors: validation.errors
      });
    }

    // 🔥 获取模型信息并确定 baseUrl
    const modelInfo = modelRegistry.getModelById(llmSettings.selectedModelId);
    if (!modelInfo) {
      return res.status(400).json({
        success: false,
        error: '无效的模型ID'
      });
    }

    const baseUrl = llmSettings.baseUrl || modelInfo.customBaseUrl || 'https://openrouter.ai/api/v1';
    const model = llmSettings.selectedModelId || modelInfo.openRouterModel;

    // 🔥 获取模型的最大 tokens 限制
    const getMaxTokensLimit = (baseUrl: string): number => {
      if (baseUrl.includes('dashscope.aliyuncs.com')) return 8192;
      if (baseUrl.includes('api.deepseek.com')) return 8192;
      if (baseUrl.includes('open.bigmodel.cn')) return 4096;
      if (baseUrl.includes('aip.baidubce.com')) return 2048;
      if (baseUrl.includes('api.moonshot.cn')) return 8192;
      if (baseUrl.includes('zenmux.ai')) return 8192;
      return 8192;
    };

    const maxTokensLimit = getMaxTokensLimit(baseUrl);
    const finalMaxTokens = Math.min(10, maxTokensLimit); // 测试只需要很少的tokens

    console.log(`🧪 [后端] 测试连接: ${modelInfo.name}`);
    console.log(`📍 API端点: ${baseUrl}/chat/completions`);
    console.log(`🔑 API Key状态: ${llmSettings.apiKey ? '已设置' : '❌ 未设置'}`);

    // 构建测试请求
    const requestBody = {
      model: modelInfo.openRouterModel,
      messages: [
        {
          role: 'user',
          content: "Hello, this is a connection test. Please respond with 'OK'."
        }
      ],
      temperature: 0.1,
      max_tokens: finalMaxTokens
    };

    // 配置代理（如果环境变量中有配置）
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    const fetchOptions: any = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llmSettings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    };

    // 只对 OpenRouter API 添加额外的识别头
    if (!modelInfo.customBaseUrl) {
      fetchOptions.headers['HTTP-Referer'] = 'https://testflow-ai.com';
      fetchOptions.headers['X-Title'] = 'TestFlow AI Testing Platform';
    }

    // 如果配置了代理，使用 undici 的 ProxyAgent
    if (proxyUrl) {
      console.log(`🌐 使用代理: ${proxyUrl}`);
      fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
    }

    // 发送测试请求
    const response = await fetch(baseUrl + '/chat/completions', fetchOptions);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [后端] AI API错误详情: ${errorText}`);
      console.error(`❌ 请求模型: ${model}`);
      console.error(`❌ 请求URL: ${baseUrl}/chat/completions`);

      let errorMessage = `API调用失败 (${response.status})`;
      
      // 增强错误信息
      if (response.status === 401) {
        errorMessage = 'API密钥无效或已过期';
      } else if (response.status === 429) {
        errorMessage = 'API调用频率超限，请稍后重试';
      } else if (response.status === 500) {
        errorMessage = '服务器内部错误，请稍后重试';
      } else if (response.status === 403) {
        errorMessage = '访问被拒绝，请检查API密钥权限';
      } else {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage += `: ${errorText}`;
        }
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
        responseTime
      });
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(400).json({
        success: false,
        error: 'API返回格式异常，请检查模型配置',
        responseTime
      });
    }

    console.log(`✅ [后端] 连接测试成功: ${modelInfo.name} (${responseTime}ms)`);

    res.json({
      success: true,
      message: '连接测试成功',
      responseTime,
      modelInfo: {
        name: modelInfo.name,
        provider: modelInfo.provider,
        modelId: llmSettings.selectedModelId
      }
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('❌ [后端] 连接测试失败:', error);
    
    let errorMessage = error.message || '连接测试失败';
    
    // 增强错误处理
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = '网络连接失败，请检查网络设置';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      responseTime
    });
  }
});

export { router as configRoutes };
export default router;