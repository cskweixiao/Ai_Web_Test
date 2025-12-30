import { Router } from 'express';
import { BackendSettingsService } from '../services/settingsService.js';
import { llmConfigManager } from '../../src/services/llmConfigManager.js';
import { modelRegistry } from '../../src/services/modelRegistry.js';
import { ProxyAgent } from 'undici';
import { elementCache } from '../services/elementCache.js'; // 🔥 新增：元素缓存

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
    res.setHeader('Content-Disposition', 'attachment; filename="Ai Web Test-settings.json"');
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
      fetchOptions.headers['HTTP-Referer'] = 'https://Ai Web Test-ai.com';
      fetchOptions.headers['X-Title'] = 'Ai Web Test AI Testing Platform';
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

// 🔥 新增：获取缓存统计（整合所有缓存）
router.get('/cache/stats', async (req, res) => {
  try {
    console.log('📊 [API] 开始获取缓存统计...');
    
    // 获取 elementCache 统计（从数据库聚合数据）
    const elementStats = await elementCache.getStatsFromDatabase();
    console.log('📊 [API] Element Cache 统计:', elementStats);
    
    // 获取 AI Parser 缓存统计（operationCache & assertionCache）
    // 从 testExecutionService 获取 aiParser 实例
    const aiParserStats = {
      operationHits: 0,
      operationMisses: 0,
      assertionHits: 0,
      assertionMisses: 0
    };
    
    // 尝试从全局服务获取统计
    try {
      const testExecService = (global as any).testExecutionService;
      if (testExecService && testExecService.aiParser) {
        const parserStats = testExecService.aiParser.getCacheStats();
        // 🔥 修复：getCacheStats() 返回的是 { operation: {...}, assertion: {...} } 格式
        aiParserStats.operationHits = parserStats.operation?.hits || 0;
        aiParserStats.operationMisses = parserStats.operation?.misses || 0;
        aiParserStats.assertionHits = parserStats.assertion?.hits || 0;
        aiParserStats.assertionMisses = parserStats.assertion?.misses || 0;
        console.log('📊 [API] AI Parser 统计:', aiParserStats);
      } else {
        console.log('⚠️ [API] AI Parser 服务未初始化');
      }
    } catch (e) {
      // 静默失败，使用默认值
      console.error('❌ [API] 获取AI Parser缓存统计失败:', e);
    }
    
    // 综合统计
    const totalRequests = 
      elementStats.totalRequests + 
      aiParserStats.operationHits + aiParserStats.operationMisses + 
      aiParserStats.assertionHits + aiParserStats.assertionMisses;
      
    const totalHits = 
      elementStats.cacheHits + 
      aiParserStats.operationHits + 
      aiParserStats.assertionHits;
      
    const totalMisses = 
      elementStats.cacheMisses + 
      aiParserStats.operationMisses + 
      aiParserStats.assertionMisses;
      
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    // 计算状态
    let status: 'excellent' | 'good' | 'normal' | 'poor';
    if (hitRate >= 60) {
      status = 'excellent';
    } else if (hitRate >= 40) {
      status = 'good';
    } else if (hitRate >= 20) {
      status = 'normal';
    } else {
      status = 'poor';
    }
    
    // 计算节省的成本和时间
    // 假设：每次AI调用平均成本0.02元，平均响应时间8秒
    const estimatedCost = totalHits * 0.02;
    const estimatedTime = totalHits * 8000; // 毫秒
    
    // 格式化时间
    let timeString: string;
    if (estimatedTime < 1000) {
      timeString = `${estimatedTime.toFixed(0)}ms`;
    } else if (estimatedTime < 60000) {
      timeString = `${(estimatedTime / 1000).toFixed(1)}秒`;
    } else if (estimatedTime < 3600000) {
      timeString = `${(estimatedTime / 60000).toFixed(1)}分钟`;
    } else {
      timeString = `${(estimatedTime / 3600000).toFixed(1)}小时`;
    }
    
    const responseData = {
      totalRequests,
      cacheHits: totalHits,
      cacheMisses: totalMisses,
      hitRate: parseFloat(hitRate.toFixed(1)),
      totalElements: elementStats.totalElements,
      memoryUsage: elementStats.memoryUsage,
      estimatedSavings: {
        apiCalls: totalHits,
        cost: estimatedCost.toFixed(2) + ' 元',
        time: timeString
      },
      status,
      // 详细统计
      breakdown: {
        element: {
          requests: elementStats.totalRequests,
          hits: elementStats.cacheHits,
          misses: elementStats.cacheMisses,
          hitRate: elementStats.hitRate
        },
        operation: {
          requests: aiParserStats.operationHits + aiParserStats.operationMisses,
          hits: aiParserStats.operationHits,
          misses: aiParserStats.operationMisses,
          hitRate: (aiParserStats.operationHits + aiParserStats.operationMisses) > 0 
            ? ((aiParserStats.operationHits / (aiParserStats.operationHits + aiParserStats.operationMisses)) * 100).toFixed(1)
            : 0
        },
        assertion: {
          requests: aiParserStats.assertionHits + aiParserStats.assertionMisses,
          hits: aiParserStats.assertionHits,
          misses: aiParserStats.assertionMisses,
          hitRate: (aiParserStats.assertionHits + aiParserStats.assertionMisses) > 0 
            ? ((aiParserStats.assertionHits / (aiParserStats.assertionHits + aiParserStats.assertionMisses)) * 100).toFixed(1)
            : 0
        }
      }
    };
    
    console.log('✅ [API] 缓存统计响应数据:', responseData);
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error('❌ [API] 获取缓存统计失败:', error);
    console.error('❌ [API] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '获取缓存统计失败'
    });
  }
});

// 🔥 新增：清空元素缓存
router.post('/cache/clear', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (url) {
      // 清空指定URL的缓存
      const count = elementCache.clearByUrl(url);
      res.json({
        success: true,
        message: `已清理指定URL的缓存`,
        data: { clearedCount: count }
      });
    } else {
      // 清空所有缓存
      elementCache.clear();
      res.json({
        success: true,
        message: '已清空所有元素缓存'
      });
    }
  } catch (error: any) {
    console.error('❌ 清空缓存失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '清空缓存失败'
    });
  }
});

// 🔥 新增：重置缓存统计
router.post('/cache/reset-stats', async (req, res) => {
  try {
    elementCache.resetStats();
    res.json({
      success: true,
      message: '缓存统计已重置'
    });
  } catch (error: any) {
    console.error('❌ 重置统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '重置统计失败'
    });
  }
});

// 🔥 新增：打印缓存报告
router.get('/cache/report', async (req, res) => {
  try {
    // 打印到控制台
    elementCache.printStatsReport();
    
    const stats = elementCache.getStats();
    res.json({
      success: true,
      message: '缓存报告已生成（查看服务器控制台）',
      data: stats
    });
  } catch (error: any) {
    console.error('❌ 生成缓存报告失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成缓存报告失败'
    });
  }
});

// 🔥 新增：调试端点 - 直接查询数据库缓存状态
router.get('/cache/debug', async (req, res) => {
  try {
    console.log('🔍 [调试] 开始查询数据库缓存状态...');
    
    // 直接使用 Prisma 查询数据库
    const { PrismaClient } = await import('../../src/generated/prisma/index.js');
    const prisma = new PrismaClient();
    
    try {
      // 查询所有缓存记录（包括过期的）
      const allCaches = await prisma.ai_element_cache.findMany({
        take: 10,
        orderBy: { created_at: 'desc' }
      });
      
      // 统计信息
      const totalCount = await prisma.ai_element_cache.count();
      const activeCount = await prisma.ai_element_cache.count({
        where: {
          expires_at: { gt: new Date() }
        }
      });
      
      const hitStats = await prisma.ai_element_cache.aggregate({
        _sum: { hit_count: true },
        _avg: { hit_count: true },
        _max: { hit_count: true }
      });
      
      console.log('✅ [调试] 数据库查询成功');
      
      res.json({
        success: true,
        data: {
          database: {
            totalCaches: totalCount,
            activeCaches: activeCount,
            expiredCaches: totalCount - activeCount,
            hitStats: {
              total: hitStats._sum.hit_count || 0,
              average: hitStats._avg.hit_count || 0,
              max: hitStats._max.hit_count || 0
            }
          },
          samples: allCaches.map(cache => ({
            cache_key: cache.cache_key.substring(0, 16) + '...',
            element_text: cache.element_text,
            hit_count: cache.hit_count,
            created_at: cache.created_at,
            expires_at: cache.expires_at,
            is_expired: cache.expires_at <= new Date()
          })),
          memory: {
            cacheSize: elementCache['cache'].size,
            stats: elementCache['stats']
          }
        }
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error: any) {
    console.error('❌ [调试] 查询数据库失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '查询失败',
      stack: error.stack
    });
  }
});

export { router as configRoutes };
export default router;