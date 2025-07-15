import { chromium } from 'playwright';

console.log('🧪 测试Chrome是否能正常启动...');

async function testChrome() {
  let browser = null;
  
  try {
    console.log('🚀 正在启动Chrome...');
    
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      timeout: 10000
    });
    
    console.log('✅ Chrome启动成功！');
    
    const page = await browser.newPage();
    await page.goto('https://www.baidu.com');
    
    console.log('✅ 页面加载成功！');
    
    // 等待3秒让你看到浏览器
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('❌ Chrome启动失败:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 浏览器已关闭');
    }
  }
}

testChrome().catch(console.error); 