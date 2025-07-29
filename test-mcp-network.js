#!/usr/bin/env node

/**
 * 测试MCP网络访问的脚本
 * 用于验证HTTPS网站访问修复效果
 */

import { PlaywrightMcpClient } from './server/services/mcpClient.ts';

async function testNetworkAccess() {
  console.log('🧪 开始测试MCP网络访问...');
  console.log('🌐 目标URL: https://k8s-saas-tmp.ycb51.cn/supplychain_page/login');
  
  const client = new PlaywrightMcpClient();
  
  try {
    console.log('🚀 初始化MCP客户端...');
    await client.initialize();
    
    console.log('✅ MCP客户端初始化成功');
    
    // 测试导航到目标URL
    console.log('🌐 测试导航到目标URL...');
    
    const navigateStep = {
      action: 'navigate',
      url: 'https://k8s-saas-tmp.ycb51.cn/supplychain_page/login',
      description: '导航到登录页面'
    };
    
    const result = await client.executeStep(navigateStep, 'test-network-' + Date.now());
    
    if (result.success) {
      console.log('✅ 网络访问测试成功！');
      console.log('📊 结果:', result.result);
      
      // 获取当前页面状态
      try {
        const currentUrl = await client.getCurrentUrl();
        console.log('🌐 当前URL:', currentUrl);
      } catch (urlError) {
        console.warn('⚠️ 获取当前URL失败:', urlError.message);
      }
      
    } else {
      console.error('❌ 网络访问测试失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程出错:', error);
    console.error('📋 错误详情:', error.message);
    console.error('🔍 错误堆栈:', error.stack);
  } finally {
    console.log('🧹 清理资源...');
    await client.close();
    console.log('✅ 测试完成');
  }
}

// 直接运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testNetworkAccess().catch(console.error);
}

export { testNetworkAccess };