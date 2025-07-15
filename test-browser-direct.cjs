#!/usr/bin/env node

/**
 * 🔍 直接测试Playwright浏览器启动 - 绕过MCP
 */

const { chromium } = require('playwright');

async function testBrowserDirect() {
  let browser = null;
  
  try {
    console.log('🚀 直接启动Playwright Chromium...');
    
    browser = await chromium.launch({
      headless: false,  // 强制显示浏览器
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ 浏览器启动成功！');
    
    const page = await browser.newPage();
    console.log('📄 创建新页面...');
    
    await page.goto('https://www.baidu.com');
    console.log('🌐 导航到百度首页...');
    
    // 等待10秒让用户看到浏览器
    console.log('⏱️ 等待10秒让您看到浏览器窗口...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('🎉 如果您看到了浏览器窗口，说明基础环境正常！');
    
  } catch (error) {
    console.error('❌ 直接测试失败:', error.message);
    console.error('❌ 详细错误:', error);
  } finally {
    if (browser) {
      console.log('🔒 关闭浏览器...');
      await browser.close();
    }
    console.log('✅ 测试完成！');
  }
}

testBrowserDirect().catch(console.error); 