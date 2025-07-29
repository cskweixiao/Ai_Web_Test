#!/usr/bin/env node

/**
 * 增强网络访问调试脚本
 * 用于诊断浏览器无法访问HTTPS网站的问题
 */

import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

// 禁用调试环境（生产模式）
// process.env.DEBUG = 'pw:browser*,pw:api*,pw:network*';
// process.env.PLAYWRIGHT_DEBUG = '1';

async function debugNetworkAccess() {
  console.log('🔍 开始网络访问调试...');
  
  const targetUrl = 'https://k8s-saas-tmp.ycb51.cn/supplychain_page/login';
  
  try {
    // 1. 测试基础网络连接
    console.log('📡 测试基础网络连接...');
    const http = await import('http');
    const https = await import('https');
    
    // 测试DNS解析
    console.log('🌐 测试DNS解析...');
    const dns = await import('dns');
    dns.resolve4('k8s-saas-tmp.ycb51.cn', (err, addresses) => {
      if (err) {
        console.error('❌ DNS解析失败:', err);
      } else {
        console.log('✅ DNS解析成功:', addresses);
      }
    });

    // 2. 创建增强的浏览器配置
    console.log('🚀 创建增强浏览器配置...');
    
    const browserOptions = {
      headless: true, // 无头模式（不显示浏览器窗口）
      devtools: false,  // 不打开开发者工具
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--ignore-certificate-errors',  // 忽略证书错误
        '--ignore-ssl-errors',          // 忽略SSL错误
        '--allow-insecure-localhost',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      ignoreHTTPSErrors: true, // 忽略HTTPS错误
      timeout: 60000
    };

    console.log('📋 浏览器配置:', JSON.stringify(browserOptions, null, 2));

    // 3. 启动浏览器
    console.log('🌟 启动浏览器...');
    const browser = await chromium.launch(browserOptions);
    console.log('✅ 浏览器启动成功');

    // 4. 创建页面
    console.log('📄 创建页面...');
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    console.log('✅ 页面创建成功');

    // 5. 设置网络监听
    console.log('📡 设置网络监听...');
    page.on('request', request => {
      console.log('📤 请求:', request.url(), '方法:', request.method());
    });
    
    page.on('response', response => {
      console.log('📥 响应:', response.url(), '状态:', response.status());
    });
    
    page.on('requestfailed', request => {
      console.error('❌ 请求失败:', request.url(), '错误:', request.failure()?.errorText);
    });
    
    page.on('console', msg => {
      console.log('🖥️  控制台:', msg.text());
    });

    // 6. 导航到目标URL
    console.log('🌐 导航到目标URL:', targetUrl);
    
    try {
      await page.goto(targetUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      console.log('✅ 页面加载成功');
      console.log('📄 页面标题:', await page.title());
      console.log('🌐 当前URL:', page.url());
      
      // 7. 截图保存
      await page.screenshot({ path: 'debug-success.png', fullPage: true });
      console.log('📸 截图已保存: debug-success.png');
      
      // 8. 获取页面内容
      const content = await page.content();
      console.log('📄 页面内容长度:', content.length);
      
    } catch (error) {
      console.error('❌ 导航失败:', error);
      
      // 保存错误截图
      await page.screenshot({ path: 'debug-error.png', fullPage: true });
      console.log('📸 错误截图已保存: debug-error.png');
    }

    // 9. 等待用户输入
    console.log('⏳ 浏览器将保持打开状态30秒，您可以检查控制台...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 10. 关闭浏览器
    await browser.close();
    console.log('✅ 浏览器已关闭');

  } catch (error) {
    console.error('❌ 调试过程出错:', error);
  }
}

// 运行调试
if (import.meta.url === `file://${process.argv[1]}`) {
  debugNetworkAccess().catch(console.error);
}