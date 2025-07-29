#!/usr/bin/env node

/**
 * 直接测试导航到目标URL
 * 验证MCP是否正确使用目标URL
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDirectNavigation() {
  console.log('🎯 直接测试导航到指定URL...');
  console.log('🌐 目标URL: https://k8s-saas-tmp.ycb51.cn/supplychain_page/login');
  
  const testScript = `
const { chromium } = require('playwright');

(async () => {
  console.log('🌟 启动浏览器...');
  const browser = await chromium.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--ignore-certificate-errors',
      '--disable-web-security',
      '--disable-dev-shm-usage'
    ]
  });
  
  console.log('📄 创建页面...');
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // 设置导航监听
  page.on('framenavigated', frame => {
    console.log('🌐 导航到:', frame.url());
  });
  
  page.on('request', request => {
    console.log('📤 请求:', request.url());
  });
  
  page.on('response', response => {
    console.log('📥 响应:', response.url(), '状态:', response.status());
  });
  
  page.on('requestfailed', request => {
    console.error('❌ 请求失败:', request.url(), request.failure()?.errorText);
  });
  
  console.log('🚀 导航到目标URL...');
  const targetUrl = 'https://k8s-saas-tmp.ycb51.cn/supplychain_page/login';
  
  try {
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ 导航成功！');
    console.log('📄 页面标题:', await page.title());
    console.log('🌐 最终URL:', page.url());
    
    // 等待3秒让用户看到页面
    await page.waitForTimeout(3000);
    
    // 截图保存
    await page.screenshot({ path: 'navigation-success.png', fullPage: true });
    console.log('📸 截图已保存: navigation-success.png');
    
  } catch (error) {
    console.error('❌ 导航失败:', error.message);
    
    // 保存错误截图
    await page.screenshot({ path: 'navigation-error.png', fullPage: true });
    console.log('📸 错误截图已保存: navigation-error.png');
    
    throw error;
  }
  
  await browser.close();
  console.log('✅ 测试完成');
})().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
`;

  try {
    console.log('🚀 执行导航测试...');
    const { stdout } = await execAsync(`node -e "${testScript}"`);
    console.log('📋 测试结果:', stdout);
    
    console.log('🎉 导航测试成功！');
    
  } catch (error) {
    console.error('❌ 导航测试失败:', error.message);
    
    // 提供诊断信息
    console.log('\n🔧 诊断信息:');
    console.log('1. 检查URL是否正确');
    console.log('2. 验证网络连接');
    console.log('3. 检查证书有效性');
    console.log('4. 验证防火墙设置');
  }
}

// 运行测试
testDirectNavigation().catch(console.error);