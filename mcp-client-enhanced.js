#!/usr/bin/env node

/**
 * 增强版MCP客户端配置
 * 专门解决HTTPS网站访问问题
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

class EnhancedMCPClient extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isConnected = false;
  }

  async start() {
    console.log('🚀 启动增强版MCP客户端...');
    
    // 设置环境变量
    const env = {
      ...process.env,
      // 网络相关配置
      NODE_TLS_REJECT_UNAUTHORIZED: '0', // 忽略SSL证书验证
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      
      // 调试配置
      DEBUG: 'pw:browser*,pw:api*,pw:network*,pw:protocol*',
      PWDEBUG: '1',
      
      // 浏览器配置
      PLAYWRIGHT_HEADLESS: 'false',
      HEADLESS: 'false',
      
      // 强制使用特定浏览器
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '',
      
      // 网络超时配置
      PLAYWRIGHT_TIMEOUT: '60000',
      
      // 禁用安全检查
      PLAYWRIGHT_IGNORE_HTTPS_ERRORS: 'true',
      
      // 代理配置（如果需要）
      HTTP_PROXY: process.env.HTTP_PROXY || '',
      HTTPS_PROXY: process.env.HTTPS_PROXY || '',
      NO_PROXY: process.env.NO_PROXY || 'localhost,127.0.0.1'
    };

    // MCP启动参数
    const args = [
      '@playwright/mcp@latest',
      '--browser', 'chromium',
      '--no-sandbox',
      '--ignore-https-errors', // 忽略HTTPS错误
      '--timeout', '60000'
    ];

    console.log('📋 启动参数:', args.join(' '));
    console.log('🌍 环境变量:', Object.entries(env).map(([k, v]) => `${k}=${v}`).join(', '));

    try {
      this.process = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        shell: true
      });

      this.process.stdout.on('data', (data) => {
        const message = data.toString();
        console.log('📤 MCP输出:', message);
        this.emit('output', message);
      });

      this.process.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('❌ MCP错误:', error);
        this.emit('error', error);
      });

      this.process.on('close', (code) => {
        console.log(`🔴 MCP进程退出，代码: ${code}`);
        this.isConnected = false;
        this.emit('close', code);
      });

      this.process.on('error', (error) => {
        console.error('❌ MCP进程错误:', error);
        this.emit('error', error);
      });

      // 等待连接建立
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MCP连接超时'));
        }, 30000);

        this.once('output', (data) => {
          if (data.includes('ready') || data.includes('listening')) {
            clearTimeout(timeout);
            this.isConnected = true;
            resolve();
          }
        });

        this.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log('✅ 增强版MCP客户端启动成功');
      
    } catch (error) {
      console.error('❌ 启动MCP客户端失败:', error);
      throw error;
    }
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => {
        this.once('close', resolve);
        setTimeout(resolve, 5000);
      });
    }
  }
}

// 测试函数
async function testEnhancedMCP() {
  console.log('🧪 开始测试增强版MCP...');
  
  const client = new EnhancedMCPClient();
  
  try {
    await client.start();
    
    // 等待浏览器完全启动
    console.log('⏳ 等待浏览器启动...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ 增强版MCP测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await client.stop();
  }
}

// 导出模块
export { EnhancedMCPClient };

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedMCP().catch(console.error);
}