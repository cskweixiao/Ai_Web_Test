import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 🔥 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || '3001';
  // 🔥 修复：如果后端在远程服务器，使用 SERVER_HOST，否则使用 localhost
  // 注意：这个值应该与后端实际运行的主机地址一致
  const backendHost = env.SERVER_HOST || 'localhost';
  
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        // 将所有以 /api 开头的请求代理到后端服务器
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // 🔥 将后端端口传递给前端代码（通过 VITE_API_PORT）
    define: {
      'import.meta.env.VITE_API_PORT': JSON.stringify(backendPort),
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
