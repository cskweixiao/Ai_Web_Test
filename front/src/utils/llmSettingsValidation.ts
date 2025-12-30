import { modelRegistry } from '../services/modelRegistry';
import type { LLMSettings, ValidationResult, ValidationError } from '../services/settingsService';

/**
 * 验证 LLM 设置
 * 
 * 这是一个共享的验证工具，用于前端和后端统一验证逻辑
 * 
 * @param settings 待验证的 LLM 设置
 * @returns 验证结果
 */
export function validateLLMSettings(settings: LLMSettings): ValidationResult {
  const errors: ValidationError[] = [];

  // 验证模型ID
  if (!settings.selectedModelId) {
    errors.push({
      field: 'selectedModelId',
      message: '请选择一个模型',
      code: 'REQUIRED'
    });
  } else if (!modelRegistry.isValidModelId(settings.selectedModelId)) {
    errors.push({
      field: 'selectedModelId',
      message: '选择的模型无效',
      code: 'INVALID_MODEL'
    });
  }

  // 验证API密钥
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    errors.push({
      field: 'apiKey',
      message: 'API密钥不能为空',
      code: 'REQUIRED'
    });
  } else {
    const model = modelRegistry.getModelById(settings.selectedModelId);
    // 只对标准 OpenRouter 模型进行 sk- 格式验证
    if (!model?.requiresCustomAuth && !settings.apiKey.startsWith('sk-')) {
      errors.push({
        field: 'apiKey',
        message: 'OpenRouter API密钥必须以 sk- 开头',
        code: 'INVALID_FORMAT'
      });
    }
  }

  // 验证自定义配置
  if (settings.customConfig) {
    const { temperature, maxTokens, topP } = settings.customConfig;

    // 验证 Temperature
    if (temperature !== undefined) {
      if (temperature < 0 || temperature > 2) {
        errors.push({
          field: 'temperature',
          message: 'Temperature必须在0-2之间',
          code: 'OUT_OF_RANGE'
        });
      }
    }

    // 验证 Max Tokens
    if (maxTokens !== undefined) {
      if (maxTokens < 1 || maxTokens > 8000) {
        errors.push({
          field: 'maxTokens',
          message: 'Max Tokens必须在1-8000之间',
          code: 'OUT_OF_RANGE'
        });
      }
    }

    // 验证 Top P
    if (topP !== undefined) {
      if (topP < 0 || topP > 1) {
        errors.push({
          field: 'topP',
          message: 'Top P必须在0-1之间',
          code: 'OUT_OF_RANGE'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

