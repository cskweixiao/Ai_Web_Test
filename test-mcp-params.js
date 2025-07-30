import { spawn } from 'child_process';
import fs from 'fs';

// 测试不同的参数格式
const testConfigs = [
  {
    name: 'test-element-param',
    message: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'browser_type',
        arguments: {
          element: 'e18',
          text: 'admin'
        }
      }
    }
  },
  {
    name: 'test-ref-param',
    message: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'browser_type',
        arguments: {
          ref: 'e18',
          text: 'admin'
        }
      }
    }
  }
];

async function testMCPParams() {
  console.log('🔍 测试MCP参数格式...');
  
  for (const config of testConfigs) {
    console.log(`\n📋 测试 ${config.name}:`);
    console.log('发送参数:', JSON.stringify(config.message.params.arguments));
    
    try {
      const mcp = spawn('npx', ['@playwright/mcp@0.0.30', '--browser', 'chromium', '--headless'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      mcp.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // 发送消息
      mcp.stdin.write(JSON.stringify(config.message) + '\n');
      
      // 等待响应
      await new Promise((resolve) => {
        setTimeout(() => {
          mcp.kill();
          resolve();
        }, 3000);
      });
      
      console.log('📤 响应:', output.substring(0, 200) + '...');
      if (errorOutput) {
        console.log('❌ 错误:', errorOutput.substring(0, 200) + '...');
      }
      
    } catch (error) {
      console.log('❌ 测试失败:', error.message);
    }
  }
}

testMCPParams().then(() => {
  console.log('\n✅ 测试完成');
  process.exit(0);
}).catch(console.error);