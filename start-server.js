// 简单的服务器启动脚本
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 正在启动后端服务器...');

// 启动后端服务器
const server = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('❌ 启动服务器时出错:', error);
});

console.log('✅ 服务器启动命令已执行，请查看上方日志确认是否成功启动');