import type {
  System,
  SystemsResponse,
  SystemOption,
  CreateSystemInput,
  UpdateSystemInput
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
 * 处理 API 响应，统一处理 401 错误
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
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '请求失败');
  }

  return response.json();
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

  const url = `${API_BASE_URL}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

/**
 * 获取所有启用的系统（用于下拉选择）
 */
export async function getActiveSystems(): Promise<SystemOption[]> {
  const response = await fetch(`${API_BASE_URL}/active`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

/**
 * 根据ID获取系统
 */
export async function getSystemById(id: number): Promise<System> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

/**
 * 创建系统
 */
export async function createSystem(data: CreateSystemInput): Promise<System> {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });

  return handleResponse(response);
}

/**
 * 更新系统
 */
export async function updateSystem(id: number, data: UpdateSystemInput): Promise<System> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });

  return handleResponse(response);
}

/**
 * 删除系统
 */
export async function deleteSystem(id: number): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

/**
 * 批量更新系统排序
 */
export async function updateSystemsOrder(orders: { id: number; sort_order: number }[]): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/batch/order`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ orders })
  });

  return handleResponse(response);
}
