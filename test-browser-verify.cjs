#!/usr/bin/env node
const { spawn } = require('child_process');
const WebSocket = require('ws');

console.log('🔧 验证MCP浏览器配置...');

async function testMcpConnection() {
  console.log('📡 启动MCP服务器...');
  
  const mcpProcess = spawn('npx', ['@playwright/mcp@latest'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PLAYWRIGHT_HEADLESS: 'false',
      PLAYWRIGHT_BROWSER: 'chromium',
      PLAYWRIGHT_LAUNCH_OPTIONS: JSON.stringify({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--new-window',
          '--force-new-instance'
        ],
        timeout: 30000
      }),
      DEBUG: 'pw:browser*,pw:api*'
    }
  });

  let port = null;
  
  mcpProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 MCP输出:', output.trim());
    
    const portMatch = output.match(/port (\d+)/);
    if (portMatch) {
      port = portMatch[1];
      console.log(`🌐 MCP服务器启动在端口: ${port}`);
      setTimeout(() => testBrowserConnection(port), 2000);
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log('⚠️ MCP错误:', data.toString().trim());
  });

  mcpProcess.on('close', (code) => {
    console.log(`❌ MCP进程退出，代码: ${code}`);
  });

  setTimeout(() => {
    if (!port) {
      console.log('⏰ 超时等待MCP启动，强制退出');
      mcpProcess.kill();
      process.exit(1);
    }
  }, 10000);
}

async function testBrowserConnection(port) {
  try {
    console.log(`🔌 连接到MCP服务器 ws://localhost:${port}/ws`);
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket连接成功');
      
      // 测试浏览器导航
      console.log('🌐 测试浏览器导航...');
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'browser_navigate',
          arguments: {
            url: 'https://www.baidu.com'
          }
        }
      }));
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log('📥 收到响应:', JSON.stringify(response, null, 2));
        
        if (response.id === 1) {
          if (response.error) {
            console.log('❌ 浏览器导航失败:', response.error);
          } else {
            console.log('🎉 浏览器导航成功！');
            
            // 测试获取快照
            setTimeout(() => {
              console.log('📸 测试获取页面快照...');
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                  name: 'browser_snapshot',
                  arguments: {}
                }
              }));
            }, 3000);
          }
        } else if (response.id === 2) {
          if (response.error) {
            console.log('❌ 获取快照失败:', response.error);
          } else {
            console.log('📷 快照获取成功！内容长度:', response.result?.content?.length || 0);
            console.log('🏁 测试完成，浏览器配置正常！');
          }
          
          setTimeout(() => {
            ws.close();
            process.exit(0);
          }, 2000);
        }
      } catch (e) {
        console.log('❌ 解析响应出错:', e.message);
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket错误:', error.message);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket连接已关闭');
    });
    
  } catch (error) {
    console.log('❌ 连接失败:', error.message);
  }
}

testMcpConnection(); 