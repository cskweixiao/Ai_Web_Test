import { chromium } from 'playwright';

console.log('🚀 直接测试Playwright浏览器启动...');

async function testPlaywrightDirect() {
  let browser = null;
  
  try {
    console.log('📦 正在启动Chromium浏览器...');
    
    // 使用最强的参数配置
    browser = await chromium.launch({
      headless: false,  // 显示浏览器
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--new-window',
        '--force-new-instance',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-mode',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-default-browser-check'
      ],
      channel: 'chrome',  // 使用系统Chrome
      timeout: 30000
    });
    
    console.log('✅ 浏览器启动成功！');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('🌐 正在导航到百度...');
    await page.goto('https://www.baidu.com', { waitUntil: 'networkidle' });
    
    console.log('🎉 导航成功！浏览器应该显示百度首页了！');
    
    // 等待10秒让你看到浏览器
    console.log('⏱️ 等待10秒让你观察浏览器...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Playwright测试失败:', error.message);
    console.error('❌ 错误详情:', error.stack);
  } finally {
    if (browser) {
      console.log('🔒 正在关闭浏览器...');
      await browser.close();
    }
    console.log('✅ 测试完成！');
  }
}

testPlaywrightDirect().catch(console.error); 