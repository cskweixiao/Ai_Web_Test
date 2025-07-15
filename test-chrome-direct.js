import { spawn } from 'child_process';

console.log('🔍 直接测试Chrome启动...');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 测试1: 最简单的启动
console.log('🚀 测试1: 最简单的Chrome启动');
const chrome1 = spawn(chromePath, ['--new-window', 'https://www.baidu.com'], {
  stdio: 'inherit'
});

chrome1.on('exit', (code, signal) => {
  console.log(`✅ Chrome测试1退出: code=${code}, signal=${signal}`);
  
  // 测试2: 带基础无头参数
  console.log('🚀 测试2: 带基础参数的Chrome启动');
  const chrome2 = spawn(chromePath, [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--new-window',
    'https://www.baidu.com'
  ], {
    stdio: 'inherit'
  });
  
  chrome2.on('exit', (code, signal) => {
    console.log(`✅ Chrome测试2退出: code=${code}, signal=${signal}`);
    process.exit(0);
  });
});

chrome1.on('error', (error) => {
  console.error('❌ Chrome测试1启动失败:', error);
});

// 10秒后强制退出
setTimeout(() => {
  console.log('⏰ 10秒测试时间到，退出');
  process.exit(0);
}, 10000); 