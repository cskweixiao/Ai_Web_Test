/**
 * API 配置
 * 统一管理 API 基础 URL 和 WebSocket URL
 * 🔥 从环境变量读取端口配置，支持开发和生产环境
 */

// 获取后端端口（从环境变量读取，默认 3001）
const getBackendPort = (): string => {
  // 优先使用 VITE_API_PORT（后端 API 端口，前端可访问的环境变量）
  if (import.meta.env.VITE_API_PORT) {
    return import.meta.env.VITE_API_PORT;
  }
  
  // 如果没有设置 VITE_API_PORT，使用默认的后端端口 3001
  // 注意：PORT 环境变量在前端不可直接访问，需要通过 VITE_API_PORT 传递
  return '3001';
};

// 获取后端主机
const getBackendHost = (): string => {
  // 生产环境使用当前域名
  if (!import.meta.env.DEV) {
    return window.location.hostname;
  }
  
  // 开发环境使用 localhost
  return 'localhost';
};

// 构建 API 基础 URL
export const getApiBaseUrl = (path: string = '/api'): string => {
  // 🔥 开发环境：强制使用完整URL，确保请求直接到达后端服务器
  // 这样可以避免Vite代理配置问题
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    const host = getBackendHost();
    const port = getBackendPort();
    const fullUrl = `http://${host}:${port}${path}`;
    console.log(`🔗 [API配置] 开发环境 - 完整URL: ${fullUrl}`);
    return fullUrl;
  }
  
  // 生产环境：构建完整 URL
  const host = getBackendHost();
  const port = getBackendPort();
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const prodUrl = `${protocol}//${host}:${port}${path}`;
  console.log(`🔗 [API配置] 生产环境 - 完整URL: ${prodUrl}`);
  return prodUrl;
};

// 构建 WebSocket URL
export const getWebSocketUrl = (path: string = '/ws'): string => {
  const host = getBackendHost();
  const port = getBackendPort();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}:${port}${path}`;
};

// 导出常用的 API URL
export const API_BASE_URL = getApiBaseUrl('/api');
export const WS_URL = getWebSocketUrl('/ws');

