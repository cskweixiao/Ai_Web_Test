#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const os = require('os');

const execPromise = promisify(exec);

// 🔥 加载环境变量
try {
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
} catch (error) {
  // dotenv 可能未安装，继续执行
  console.warn('⚠️ 无法加载 .env 文件，将使用默认配置');
}

// 🔥 从环境变量读取配置，提供默认值
const BACKEND_PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.VITE_PORT || '5173', 10);
const SERVER_HOST = process.env.SERVER_HOST || '127.0.0.1';

// Windows 兼容性：检测 npm 和 npx 命令
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('\n🚀 Ai Web Test 启动脚本');
console.log('====================\n');

// 检查依赖是否已安装
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('   ⚙️  正在安装依赖（这可能需要几分钟）...');
    return new Promise((resolve, reject) => {
      const install = spawn(npmCmd, ['install'], { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          // 依赖安装完成，静默完成
          resolve();
        } else {
          // 提供通用的错误提示和解决方案
          console.error('\n❌ 依赖安装失败');
          console.error('\n📋 如果错误与 sqlite3 编译相关，可以尝试以下解决方案：');
          console.error('\n   方案 1（推荐）：安装 Visual Studio Build Tools');
          console.error('   - 下载地址: https://visualstudio.microsoft.com/downloads/');
          console.error('   - 选择 "Build Tools for Visual Studio"');
          console.error('   - 安装时勾选 "Desktop development with C++" 工作负载');
          console.error('   - 安装完成后重新运行此脚本');
          console.error('\n   方案 2：尝试使用预编译版本（跳过编译）');
          console.error('   - 运行: npm install --ignore-scripts');
          console.error('   - 然后运行: npm install sqlite3 --build-from-source=false');
          console.error('   - 如果仍有问题，可以暂时跳过: npm install --ignore-scripts');
          console.error('\n   方案 3：如果项目使用 MySQL，sqlite3 可能是可选依赖');
          console.error('   - 可以尝试: npm install --ignore-scripts');
          console.error('   - 然后手动安装其他依赖');
          console.error('\n💡 提示：项目当前配置使用 MySQL，sqlite3 可能是可选依赖');
          console.error('   如果不需要 SQLite，可以暂时跳过 sqlite3 的安装');
          reject(new Error('依赖安装失败，请查看上方错误信息和解决方案'));
        }
      });
      
      install.on('error', (error) => {
        reject(error);
      });
    });
  }
  return Promise.resolve();
}

// 运行数据库迁移
async function runDatabaseMigrations() {
  try {
    return new Promise((resolve, reject) => {
      const migrateDeploy = spawn(npxCmd, ['prisma', 'migrate', 'deploy'], { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      migrateDeploy.on('close', (code) => {
        if (code === 0) {
          // 迁移成功，静默完成
          resolve();
        } else {
          // 如果 migrate deploy 失败，尝试使用 migrate dev（开发环境）
          const migrateDev = spawn(npxCmd, ['prisma', 'migrate', 'dev', '--name', 'init'], { 
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            shell: process.platform === 'win32'
          });
          
          migrateDev.on('close', (devCode) => {
            if (devCode === 0) {
              resolve();
            } else {
              // 静默处理，可能是表已存在
              resolve();
            }
          });
          
          migrateDev.on('error', (error) => {
            // 静默处理，不阻止启动
            resolve();
          });
        }
      });
      
      migrateDeploy.on('error', (error) => {
        // 静默处理，不阻止启动
        resolve();
      });
    });
  } catch (error) {
    console.warn('⚠️ 数据库迁移异常，但继续启动:', error.message);
    // 不阻止启动，可能是数据库连接问题或表已存在
  }
}

// 生成 Prisma 客户端
async function generatePrismaClient() {
  try {
    const prismaClientPath = path.resolve(__dirname, '../src/generated/prisma');
    
    // 检查 Prisma 客户端是否已生成
    if (fs.existsSync(prismaClientPath) && fs.existsSync(path.join(prismaClientPath, 'index.js'))) {
      // 已存在，静默跳过
      return;
    }
    
    // 需要生成时才显示日志
    console.log('   ⚙️  正在生成 Prisma 客户端...');
    
    // 直接使用 npx prisma generate 生成客户端
    return new Promise((resolve, reject) => {
      const prismaGenerate = spawn(npxCmd, ['prisma', 'generate'], { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      prismaGenerate.on('close', (code) => {
        if (code === 0) {
          // 生成成功，静默完成
          resolve();
        } else {
          reject(new Error('Prisma 客户端生成失败'));
        }
      });
      
      prismaGenerate.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Prisma 客户端生成失败:', error.message);
    console.error('💡 提示：可以手动运行 "npx prisma generate" 来生成 Prisma 客户端');
    process.exit(1);
  }
}

// 安装 Playwright 浏览器
async function setup() {
  try {
    // 检查 playwright 是否已安装（__dirname 是 scripts 目录，所以用 ../node_modules）
    const playwrightPath = path.resolve(__dirname, '../node_modules/playwright');
    if (!fs.existsSync(playwrightPath)) {
        console.log('Playwright 未安装，请先运行 npm install playwright');
        process.exit(1);
    }
    
    // 直接使用 node 调用 playwright 的安装脚本
    const playwrightCliPath = path.resolve(playwrightPath, 'cli.js');
    await execPromise(`node "${playwrightCliPath}" install chromium`);
    
    // 安装成功，静默完成
  } catch (error) {
    console.error('❌ Playwright 浏览器安装失败:', error);
    process.exit(1);
  }
}

// 创建必要的目录
function createDirectories() {
  const dirs = ['screenshots', 'logs', 'temp'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      // 静默创建，不输出日志
    }
  });
}

// 检查服务健康状态
function checkServiceHealth(url, serviceName, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    let attempts = 0;
    let isResolved = false;
    let checkTimer = null;
    
    const cleanup = () => {
      if (checkTimer) {
        clearTimeout(checkTimer);
        checkTimer = null;
      }
    };
    
    const check = () => {
      if (isResolved) return;
      
      attempts++;
      
      // 只在第一次和每10次尝试时显示进度
      if (attempts === 1 || attempts % 10 === 0) {
        process.stdout.write(`\r⏳ 等待${serviceName}启动... (${attempts}/${maxAttempts})`);
      }
      
      const req = http.get(url, { timeout: 2000 }, (res) => {
        if (isResolved) return;
        
        // 对于健康检查端点，200 表示成功
        // 对于前端，任何响应都表示服务已启动
        if (res.statusCode === 200 || res.statusCode < 500) {
          cleanup();
          isResolved = true;
          process.stdout.write('\r'); // 清除进度行
          resolve(true);
        } else {
          if (attempts < maxAttempts) {
            checkTimer = setTimeout(check, 1000);
          } else {
            cleanup();
            reject(new Error(`${serviceName}启动超时 (${maxAttempts} 秒)`));
          }
        }
        res.resume(); // 释放响应对象
      });
      
      req.on('error', () => {
        if (isResolved) return;
        
        if (attempts < maxAttempts) {
          checkTimer = setTimeout(check, 1000);
        } else {
          cleanup();
          reject(new Error(`${serviceName}启动超时 (${maxAttempts} 秒)`));
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        if (isResolved) return;
        
        if (attempts < maxAttempts) {
          checkTimer = setTimeout(check, 1000);
        } else {
          cleanup();
          reject(new Error(`${serviceName}启动超时 (${maxAttempts} 秒)`));
        }
      });
    };
    
    // 等待 3 秒后开始检查（给服务启动时间）
    checkTimer = setTimeout(check, 3000);
  });
}

// 启动服务
async function startServices() {
  console.log('\n🔥 启动 Ai Web Test 服务...');
  console.log('====================\n');
  
  // 🔥 修复：按顺序启动服务，确保后端先启动成功后再启动前端
  
  // 步骤 1: 启动后端服务
  console.log('🔧 [1/2] 正在启动后端服务...');
  const backendProcess = spawn(npxCmd, ['tsx', 'watch', 'server/index.ts'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1'
    }
  });
  
  // 存储后端进程引用以便优雅关闭
  process._backendProcess = backendProcess;
  
  // 错误处理
  backendProcess.on('error', (error) => {
    console.error('\n❌ 后端服务启动失败:', error.message);
    console.error('💡 请检查：');
    console.error('   1. 是否已安装所有依赖 (npm install)');
    console.error('   2. 是否已生成 Prisma 客户端 (npx prisma generate)');
    console.error('   3. 环境变量是否正确配置 (.env 文件)');
    console.error('   4. 端口是否被占用');
    console.error('   5. tsx 是否已安装 (npm install tsx)');
    process.exit(1);
  });
  
  // 步骤 2: 等待后端服务健康检查通过
  try {
    console.log('⏳ 等待后端服务启动...');
    const backendHealthUrl = `http://${SERVER_HOST}:${BACKEND_PORT}/health`;
    await checkServiceHealth(backendHealthUrl, '后端服务', 60);
    console.log(`✅ 后端服务已启动并运行正常 (端口 ${BACKEND_PORT})`);
  } catch (error) {
    console.error('\n❌ 后端服务健康检查失败:', error.message);
    console.error('💡 提示：');
    console.error('   - 后端可能仍在启动中，请查看上方的日志');
    console.error('   - 如果后端启动失败，请检查：');
    console.error('     1. 数据库连接是否正常');
    console.error('     2. 环境变量是否正确配置');
    console.error(`     3. 端口 ${BACKEND_PORT} 是否被占用`);
    console.error('   - 可以单独运行 "npm run dev:server" 查看详细错误信息');
    process.exit(1);
  }
  
  // 步骤 3: 后端启动成功后，启动前端服务
  console.log('\n🔧 [2/2] 正在启动前端服务...\n');
  const frontendProcess = spawn('node', [
    '--max-old-space-size=4096',
    './node_modules/vite/bin/vite.js'
  ], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  
  // 存储前端进程引用以便优雅关闭
  process._frontendProcess = frontendProcess;
  
  frontendProcess.on('error', (error) => {
    console.error('\n❌ 前端服务启动失败:', error.message);
    console.error('💡 请检查：');
    console.error(`   1. 端口 ${FRONTEND_PORT} 是否被占用`);
    console.error('   2. vite 是否已安装');
    process.exit(1);
  });
  
  // 步骤 4: 等待前端服务启动
  try {
    console.log('⏳ 等待前端服务启动...');
    const frontendHealthUrl = `http://${SERVER_HOST}:${FRONTEND_PORT}`;
    await checkServiceHealth(frontendHealthUrl, '前端服务', 30);
    console.log(`✅ 前端服务已启动并运行正常 (端口 ${FRONTEND_PORT})`);
  } catch (error) {
    console.warn('\n⚠️ 前端服务健康检查失败:', error.message);
    console.warn('💡 提示：前端可能仍在启动中，请查看上方的日志');
  }
  
  // 步骤 5: 所有服务启动完成，输出访问地址
  console.log('\n🎉 所有服务启动完成！');
  console.log('====================');
  
  // 🔥 获取所有可用的网络地址
  const networkInterfaces = os.networkInterfaces();
  const networkIps = [];
  
  for (const name of Object.keys(networkInterfaces)) {
    const netInterface = networkInterfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (net.family === 'IPv4' && !net.internal) {
          const ip = net.address;
          if (ip !== '127.0.0.1' && ip !== '::1') {
            networkIps.push(ip);
          }
        }
      }
    }
  }
  
  // 去重并排序：优先显示局域网地址
  const uniqueIps = Array.from(new Set(networkIps));
  const sortedIps = uniqueIps.sort((a, b) => {
    const isLanA = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(a);
    const isLanB = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(b);
    if (isLanA && !isLanB) return -1;
    if (!isLanA && isLanB) return 1;
    return 0;
  });
  
  // 分离局域网地址和链路本地地址
  const lanIps = sortedIps.filter(ip => /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip));
  const linkLocalIps = sortedIps.filter(ip => /^169\.254\./.test(ip));
  
  console.log('📍 访问地址:');
  console.log('   - 本地访问:');
  console.log(`     • 后端: http://localhost:${BACKEND_PORT}`);
  console.log(`     • 前端: http://localhost:${FRONTEND_PORT}`);
  
  if (lanIps.length > 0) {
    console.log('   - 内网访问 (推荐):');
    lanIps.forEach(ip => {
      console.log(`     • 后端: http://${ip}:${BACKEND_PORT}`);
      console.log(`     • 前端: http://${ip}:${FRONTEND_PORT}`);
    });
  }
  
  if (linkLocalIps.length > 0) {
    console.log('   - 链路本地地址 (仅同链路可用):');
    linkLocalIps.forEach(ip => {
      console.log(`     • 后端: http://${ip}:${BACKEND_PORT}`);
      console.log(`     • 前端: http://${ip}:${FRONTEND_PORT}`);
    });
  }
  console.log('🔑 登录凭据:');
  console.log('   - 用户名: admin');
  console.log('   - 密码: admin');
  console.log('====================');
  console.log('💡 提示: 按 Ctrl+C 停止服务\n');
  
  // 优雅关闭处理
  const shutdown = () => {
    console.log('\n🛑 正在关闭服务...');
    if (process._backendProcess) {
      process._backendProcess.kill('SIGINT');
    }
    if (process._frontendProcess) {
      process._frontendProcess.kill('SIGINT');
    }
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // 后端进程关闭事件
  backendProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ 后端服务异常退出 (退出码: ${code})`);
      console.error('💡 请检查上方的错误信息');
      console.error('💡 可以尝试单独启动后端: npm run dev:server');
    } else {
      console.log(`\n后端服务已关闭 (退出码: ${code})`);
    }
  });
  
  // 前端进程关闭事件
  frontendProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ 前端服务异常退出 (退出码: ${code})`);
      console.error('💡 请检查上方的错误信息');
    } else {
      console.log(`\n前端服务已关闭 (退出码: ${code})`);
    }
  });
}

// 主启动流程
async function main() {
  try {
    console.log('📋 启动检查清单:');
    console.log('   [1/5] 检查依赖...');
    await checkDependencies();
    
    console.log('   [2/5] 生成 Prisma 客户端...');
    await generatePrismaClient();
    
    console.log('   [3/5] 运行数据库迁移...');
    await runDatabaseMigrations();
    
    console.log('   [4/5] 创建必要目录...');
    createDirectories();
    
    console.log('   [5/5] 安装 Playwright 浏览器...');
    await setup();
    
    console.log('✅ 所有启动检查完成\n');
    await startServices();
  } catch (error) {
    console.error('\n❌ 启动失败:', error.message);
    process.exit(1);
  }
}

main(); 