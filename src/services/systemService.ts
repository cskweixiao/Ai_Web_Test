import type {
  System,
  SystemsResponse,
  SystemOption,
  CreateSystemInput,
  UpdateSystemInput,
  ProjectVersion,
  CreateVersionInput,
  UpdateVersionInput
} from '../types/test';

// 🔥 使用统一的 API 配置
import { getApiBaseUrl } from '../config/api';
const API_BASE_URL = getApiBaseUrl('/api/v1/systems');
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
 * 处理 API 响应，统一处理错误
 */
async function handleResponse(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('authUser');
    alert('登录已过期，请重新登录');
    window.location.href = '/login';
    throw new Error('未授权');
  }

  if (!response.ok) {
    let errorMessage = `请求失败 (${response.status})`;
    try {
      const errorData = await response.json();
      // 后端返回格式：{ error: '错误信息', message: '详细信息' }
      if (errorData.error) {
        errorMessage = errorData.error;
        // 如果有详细信息，追加显示
        if (errorData.message && errorData.message !== errorData.error) {
          errorMessage += `: ${errorData.message}`;
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // JSON 解析失败，使用默认错误信息
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// 🔥 正在进行的请求缓存（用于去重）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingRequests = new Map<string, Promise<any>>();

// 🔥 缓存保留时间（毫秒）- 防止短时间内的重复请求
const CACHE_RETAIN_TIME = 300;

/**
 * 通用请求函数（带去重功能）
 */
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  // 只对 GET 请求进行去重
  const isGet = options.method === 'GET' || !options.method;
  // 生成唯一请求 Key
  const requestKey = isGet ? `${url}` : null;

  // 如果已有相同请求（正在进行或刚完成），直接返回该 Promise
  if (requestKey && pendingRequests.has(requestKey)) {
    console.log('🔄 [systemService] 复用缓存请求:', requestKey.split('?')[0]);
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  console.log('📤 [systemService] 发起新请求:', url.split('?')[0]);

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...options.headers,
        }
      });
      return handleResponse(response);
    } finally {
      // 🔥 延迟清除缓存，确保短时间内的重复请求能复用结果
      if (requestKey) {
        setTimeout(() => {
          pendingRequests.delete(requestKey);
          console.log('🗑️ [systemService] 清除缓存:', requestKey.split('?')[0]);
        }, CACHE_RETAIN_TIME);
      }
    }
  })();

  // 存入缓存
  if (requestKey) {
    pendingRequests.set(requestKey, promise);
  }

  return promise;
}

/**
 * 获取系统列表（支持分页、搜索、筛选）
 */
export async function getSystems(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'active' | 'inactive';
}): Promise<SystemsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status) queryParams.append('status', params.status);

  // 🔥 确保参数排序，提高去重命中率
  queryParams.sort();

  const url = `${API_BASE_URL}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  return request<SystemsResponse>(url);
}

/**
 * 获取所有启用的系统（用于下拉选择）
 */
export async function getActiveSystems(): Promise<SystemOption[]> {
  return request<SystemOption[]>(`${API_BASE_URL}/active`);
}

/**
 * 根据ID获取系统
 */
export async function getSystemById(id: number): Promise<System> {
  return request<System>(`${API_BASE_URL}/${id}`);
}

/**
 * 创建系统
 */
export async function createSystem(data: CreateSystemInput): Promise<System> {
  return request<System>(API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * 更新系统
 */
export async function updateSystem(id: number, data: UpdateSystemInput): Promise<System> {
  return request<System>(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * 删除系统
 */
export async function deleteSystem(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`${API_BASE_URL}/${id}`, {
    method: 'DELETE'
  });
}

/**
 * 批量更新系统排序
 */
export async function updateSystemsOrder(orders: { id: number; sort_order: number }[]): Promise<{ message: string }> {
  return request<{ message: string }>(`${API_BASE_URL}/batch/order`, {
    method: 'PUT',
    body: JSON.stringify({ orders })
  });
}

// ==================== 项目版本相关 API ====================

/**
 * 获取项目的所有版本
 */
export async function getProjectVersions(projectId: number): Promise<ProjectVersion[]> {
  return request<ProjectVersion[]>(`${API_BASE_URL}/${projectId}/versions`);
}

/**
 * 创建项目版本
 */
export async function createProjectVersion(data: CreateVersionInput): Promise<ProjectVersion> {
  return request<ProjectVersion>(`${API_BASE_URL}/${data.project_id}/versions`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * 更新项目版本
 */
export async function updateProjectVersion(
  projectId: number,
  versionId: number,
  data: UpdateVersionInput
): Promise<ProjectVersion> {
  return request<ProjectVersion>(`${API_BASE_URL}/${projectId}/versions/${versionId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * 删除项目版本
 */
export async function deleteProjectVersion(
  projectId: number,
  versionId: number
): Promise<{ message: string }> {
  return request<{ message: string }>(`${API_BASE_URL}/${projectId}/versions/${versionId}`, {
    method: 'DELETE'
  });
}

/**
 * 设置主线版本
 */
export async function setMainVersion(
  projectId: number,
  versionId: number
): Promise<ProjectVersion> {
  return request<ProjectVersion>(`${API_BASE_URL}/${projectId}/versions/${versionId}/set-main`, {
    method: 'PUT'
  });
}
