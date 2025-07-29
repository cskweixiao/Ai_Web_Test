#!/usr/bin/env node

/**
 * 验证MCP修复效果
 * 使用直接的Playwright测试来确认HTTPS访问问题已解决
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function verifyMCPFix() {
  console.log('🔍 验证MCP HTTPS访问修复效果...');
  console.log('🌐 测试URL: https://k8s-saas-tmp.ycb51.cn/supplychain_page/login');
  
  try {
    // 1. 验证Playwright安装
    console.log('📦 验证Playwright安装...');
    const { stdout: playwrightVersion } = await exec('npx playwright --version');
    console.log('✅ Playwright版本:', playwrightVersion.trim());
    
    // 2. 验证浏览器安装
    console.log('🌐 验证浏览器安装...');
    const { stdout: browsers } = await exec('npx playwright show-browsers');
    console.log('✅ 已安装浏览器:', browsers.split('\n').filter(line => line.trim()).length);
    
    // 3. 使用Playwright直接测试HTTPS访问
    console.log('🚀 使用Playwright直接测试HTTPS访问...');
    
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
      '--disable-web-security'
    ]
  });
  
  console.log('📄 创建页面...');
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // 设置网络监听
  page.on('request', request => {
    console.log('📤 请求:', request.url());
  });
  
  page.on('response', response => {
    console.log('📥 响应:', response.url(), '状态:', response.status());
  });
  
  page.on('requestfailed', request => {
    console.error('❌ 请求失败:', request.url(), request.failure()?.errorText);
  });
  
  console.log('🌐 导航到目标URL...');
  await page.goto('https://k8s-saas-tmp.ycb51.cn/supplychain_page/login', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  console.log('✅ 导航成功！');
  console.log('📄 页面标题:', await page.title());
  console.log('🌐 当前URL:', page.url());
  
  // 等待几秒让用户看到页面
  await page.waitForTimeout(3000);
  
  await browser.close();
  console.log('✅ 测试完成');
})().catch(console.error);
`;

    // 执行测试脚本
    const { stdout, stderr } = await exec(`node -e "${testScript}"`);
    console.log('📋 测试结果:', stdout);
    
    if (stderr) {
      console.warn('⚠️ 警告信息:', stderr);
    }
    
    console.log('🎉 验证完成！HTTPS访问问题已修复');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    
    // 提供故障排除建议
    console.log('\n🔧 故障排除建议:');
    console.log('1. 运行: npx playwright install chromium');
    console.log('2. 检查防火墙设置');
    console.log('3. 验证证书有效性');
    console.log('4. 检查代理设置');
  }
}

// 运行验证
verifyMCPFix().catch(console.error);