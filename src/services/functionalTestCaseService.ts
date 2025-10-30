const API_BASE_URL = `http://${window.location.hostname}:3001/api/v1`;
const TOKEN_KEY = 'authToken';

/**
 * 获取认证请求头
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 处理 API 响应，统一处理 401 错误
 */
async function handleResponse(response: Response) {
  if (response.status === 401) {
    // Token 过期或无效，清除本地存储并跳转到登录页
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('authUser');

    // 显示友好提示
    alert('登录已过期，请重新登录');

    // 跳转到登录页
    window.location.href = '/login';

    throw new Error('认证失败，请重新登录');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `请求失败: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 列表查询参数
 */
export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  tag?: string;
  priority?: string;
  status?: string;
  system?: string;
  module?: string;
  source?: string;
}

/**
 * 项目信息
 */
export interface ProjectInfo {
  projectName: string;
  systemType: string;
  businessDomain: string;
  businessRules: string[];
  constraints: string[];
  description: string;
}

/**
 * 功能测试用例前端服务
 */
class FunctionalTestCaseService {
  /**
   * 获取功能测试用例列表
   */
  async getList(params: ListParams) {
    const queryString = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_BASE_URL}/functional-test-cases?${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    return handleResponse(response);
  }

  /**
   * 获取功能测试用例平铺列表（以测试点为维度展示）
   */
  async getFlatList(params: ListParams) {
    const queryString = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_BASE_URL}/functional-test-cases/flat?${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    return handleResponse(response);
  }

  /**
   * 批量保存测试用例
   */
  async batchSave(testCases: any[], aiSessionId: string) {
    const response = await fetch(`${API_BASE_URL}/functional-test-cases/batch-save`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ testCases, aiSessionId })
    });

    return handleResponse(response);
  }

  /**
   * 获取测试用例详情
   */
  async getById(id: number) {
    const response = await fetch(`${API_BASE_URL}/functional-test-cases/${id}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    return handleResponse(response);
  }

  /**
   * 更新测试用例
   */
  async update(id: number, data: any) {
    const response = await fetch(`${API_BASE_URL}/functional-test-cases/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    return handleResponse(response);
  }

  /**
   * 删除测试用例
   */
  async delete(id: number) {
    const response = await fetch(`${API_BASE_URL}/functional-test-cases/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    return handleResponse(response);
  }

  /**
   * 上传并解析Axure文件（单文件）
   */
  async parseAxure(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem(TOKEN_KEY);
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // 注意: 不要设置 Content-Type, 让浏览器自动设置multipart boundary

    const response = await fetch(`${API_BASE_URL}/axure/parse`, {
      method: 'POST',
      headers,
      body: formData
    });

    return handleResponse(response);
  }

  /**
   * 上传并解析Axure文件（多文件 - HTML + JS）
   */
  async parseAxureMulti(files: File[]) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const token = localStorage.getItem(TOKEN_KEY);
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // 注意: 不要设置 Content-Type, 让浏览器自动设置multipart boundary

    const response = await fetch(`${API_BASE_URL}/axure/parse-multi`, {
      method: 'POST',
      headers,
      body: formData
    });

    return handleResponse(response);
  }

  /**
   * 生成需求文档（AI生成可能需要30-90秒）
   */
  async generateRequirement(sessionId: string, axureData: any, projectInfo: ProjectInfo) {
    console.log('📤 开始请求生成需求文档...');

    // 创建一个超时控制器（3分钟超时）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟

    try {
      const response = await fetch(`${API_BASE_URL}/axure/generate-requirement`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionId, axureData, projectInfo }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('✅ 收到需求文档响应');
      const result = await handleResponse(response);
      console.log('✅ 需求文档解析成功，长度:', result.data?.requirementDoc?.length);

      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('生成需求文档超时（超过3分钟），请重试或简化原型内容');
      }
      throw error;
    }
  }

  /**
   * 规划分批策略
   */
  async planBatches(sessionId: string, requirementDoc: string) {
    const response = await fetch(`${API_BASE_URL}/axure/plan-batches`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, requirementDoc })
    });

    return handleResponse(response);
  }

  /**
   * 生成单个批次
   */
  async generateBatch(
    sessionId: string,
    batchId: string,
    scenarios: string[],
    requirementDoc: string,
    existingCases: any[],
    systemName?: string,
    moduleName?: string
  ) {
    const response = await fetch(`${API_BASE_URL}/axure/generate-batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sessionId,
        batchId,
        scenarios,
        requirementDoc,
        existingCases,
        systemName,
        moduleName
      })
    });

    return handleResponse(response);
  }

  /**
   * 重新生成指定用例
   */
  async regenerateCases(originalCases: any[], instruction: string, requirementDoc: string) {
    const response = await fetch(`${API_BASE_URL}/axure/regenerate-cases`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        originalCases,
        instruction,
        requirementDoc
      })
    });

    return handleResponse(response);
  }
}

// 导出单例
export const functionalTestCaseService = new FunctionalTestCaseService();
export default functionalTestCaseService;
