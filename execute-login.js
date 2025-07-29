#!/usr/bin/env node

/**
 * 执行用户要求的登录操作
 * 1、进入网站https://k8s-saas-tmp.ycb51.cn/supplychain_page/login 
 * 2、输入账号admin 
 * 3、点击登入
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeLogin() {
  console.log('🎯 开始执行用户要求的登录操作...');
  console.log('🌐 目标: https://k8s-saas-tmp.ycb51.cn/supplychain_page/login');
  console.log('👤 账号: admin');
  
  const loginScript = `
const { chromium } = require('playwright');

(async () => {
  console.log('🌟 启动浏览器...');
  const browser = await chromium.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--ignore-certificate-errors',
      '--disable-web-security',
      '--disable-dev-shm-usage'
    ]
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('🚀 1. 进入网站: https://k8s-saas-tmp.ycb51.cn/supplychain_page/login');
  await page.goto('https://k8s-saas-tmp.ycb51.cn/supplychain_page/login', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  console.log('✅ 网站加载完成');
  console.log('📄 页面标题:', await page.title());
  console.log('🌐 当前URL:', page.url());
  
  // 等待页面完全加载
  await page.waitForLoadState('networkidle');
  
  console.log('📝 2. 输入账号: admin');
  
  // 查找账号输入框
  const accountInput = await page.locator('input[type="text"], input[placeholder*="账号"], input[name*="user"], input[name*="login"]').first();
  
  if (await accountInput.isVisible()) {
    await accountInput.click();
    await accountInput.fill('admin');
    console.log('✅ 已输入账号: admin');
  } else {
    console.log('❌ 未找到账号输入框');
  }
  
  console.log('🔘 3. 准备点击登录按钮...');
  
  // 查找登录按钮
  const loginButton = await page.locator('button:has-text("登录"), button:has-text("登入"), input[type="submit"], button[type="submit"]').first();
  
  if (await loginButton.isVisible()) {
    const buttonText = await loginButton.textContent() || await loginButton.getAttribute('value');
    console.log('🔍 找到登录按钮:', buttonText?.trim() || '登录按钮');
    
    // 为了更好的用户体验，先截图保存当前状态
    await page.screenshot({ path: 'before-login-click.png', fullPage: true });
    console.log('📸 已保存登录前截图: before-login-click.png');
    
    // 点击登录按钮
    await loginButton.click();
    console.log('✅ 已点击登录按钮');
    
    // 等待登录结果
    try {
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
      console.log('🎉 登录成功！跳转到仪表板');
    } catch (error) {
      console.log('ℹ️  登录操作已执行，等待页面响应...');
    }
    
  } else {
    console.log('❌ 未找到登录按钮');
  }
  
  // 最终截图
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'login-result.png', fullPage: true });
  console.log('📸 已保存最终结果截图: login-result.png');
  
  console.log('🎉 操作完成！按Ctrl+C退出...');
  
  // 保持浏览器打开2分钟让用户查看结果
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  await browser.close();
  console.log('✅ 浏览器已关闭');
})().catch(console.error);
`;

  try {
    console.log('🚀 开始执行登录脚本...');
    const { stdout } = await execAsync(`node -e "${loginScript}"`);
    console.log('📋 执行结果:', stdout);
    
    console.log('🎉 用户要求的操作已全部完成！');
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
  }
}

// 执行登录操作
executeLogin().catch(console.error);