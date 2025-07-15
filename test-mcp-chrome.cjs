#!/usr/bin/env node
const { spawn } = require('child_process');
const WebSocket = require('ws');

console.log('🔧 测试MCP Chrome浏览器启动...');

async function testMcpChrome() {
  console.log('📡 启动MCP服务器 (Chrome)...');
  
  const mcpProcess = spawn('npx.cmd', ['@playwright/mcp@latest'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PLAYWRIGHT_HEADLESS: 'false',
      PLAYWRIGHT_BROWSER: 'chrome'
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
  }, 15000);
}

async function testBrowserConnection(port) {
  try {
    console.log(`🔌 连接到MCP服务器 ws://localhost:${port}/ws`);
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket连接成功');
      
      setTimeout(() => {
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
      }, 1000);
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log('📥 收到响应ID:', response.id);
        
        if (response.error) {
          console.log('❌ 响应错误:', response.error);
        } else if (response.result) {
          console.log('✅ 操作成功！');
          if (response.id === 1) {
            console.log('🎉 Chrome浏览器导航成功！');
          }
        }
      } catch (e) {
        console.log('❌ 解析响应出错:', e.message);
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket错误:', error.message);
    });
    
  } catch (error) {
    console.log('❌ 连接失败:', error.message);
  }
}

testMcpChrome(); 