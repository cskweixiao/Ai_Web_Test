const { spawn } = require('child_process');

async function checkMCPTools() {
    console.log('🔍 检查 Playwright MCP 工具列表...');
    
    // 启动 MCP 进程并检查输出
    const mcp = spawn('npx', ['@playwright/mcp', '--browser', 'chromium', '--headless'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
    });
    
    let output = '';
    let errorOutput = '';
    
    mcp.stdout.on('data', (data) => {
        output += data.toString();
        console.log('STDOUT:', data.toString());
    });
    
    mcp.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('STDERR:', data.toString());
    });
    
    mcp.on('close', (code) => {
        console.log(`MCP 进程退出，代码: ${code}`);
        console.log('完整输出:', output);
        console.log('错误输出:', errorOutput);
    });
    
    // 等待 5 秒后检查进程状态
    setTimeout(() => {
        console.log('5秒后检查 MCP 进程状态...');
        if (!mcp.killed) {
            console.log('✅ MCP 进程正在运行');
            mcp.kill();
        } else {
            console.log('❌ MCP 进程已退出');
        }
    }, 5000);
}

checkMCPTools().catch(console.error);