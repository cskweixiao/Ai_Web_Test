#!/usr/bin/env node
const { chromium } = require('playwright');

async function testChromium() {
  console.log('🚀 测试Chromium浏览器启动...');
  
  try {
    console.log('📱 正在启动浏览器...');
    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ 浏览器启动成功！');
    
    const page = await browser.newPage();
    console.log('📄 新页面创建成功');
    
    await page.goto('https://www.baidu.com');
    console.log('🌐 导航到百度成功');
    
    const title = await page.title();
    console.log('📋 页面标题:', title);
    
    await page.waitForTimeout(3000);
    console.log('⏰ 等待3秒...');
    
    await browser.close();
    console.log('🎉 测试完成，浏览器关闭');
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    console.log('📊 错误详情:', error);
  }
}

testChromium(); 