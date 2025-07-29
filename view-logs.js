import fs from 'fs';
import path from 'path';

// 日志查看工具
const logFile = path.join(process.cwd(), 'debug-execution.log');

function viewLogs() {
    console.log('📋 查看执行日志...\n');
    
    if (!fs.existsSync(logFile)) {
        console.log('❌ 日志文件不存在:', logFile);
        return;
    }
    
    try {
        const content = fs.readFileSync(logFile, 'utf8');
        
        // 分析和过滤关键日志
        const lines = content.split('\n');
        const keywordFilters = [
            'AI解析',
            'MCP工具调用',
            'executeMcpCommand',
            '条件检查',
            'TestStep对象',
            '无法识别操作类型',
            'ERROR',
            'WARN'
        ];
        
        console.log('🔍 关键日志信息:\n');
        
        const filteredLines = lines.filter(line => 
            keywordFilters.some(keyword => line.includes(keyword))
        );
        
        filteredLines.forEach(line => {
            if (line.includes('ERROR')) {
                console.log('🔴', line);
            } else if (line.includes('WARN')) {
                console.log('🟡', line);
            } else if (line.includes('AI解析成功')) {
                console.log('🟢', line);
            } else if (line.includes('MCP工具调用成功')) {
                console.log('✅', line);
            } else {
                console.log('ℹ️ ', line);
            }
        });
        
        console.log(`\n📊 日志统计:`);
        console.log(`总行数: ${lines.length}`);
        console.log(`关键日志: ${filteredLines.length}`);
        console.log(`错误: ${lines.filter(l => l.includes('ERROR')).length}`);
        console.log(`警告: ${lines.filter(l => l.includes('WARN')).length}`);
        
    } catch (error) {
        console.error('❌ 读取日志失败:', error.message);
    }
}

// 实时监控模式
function watchLogs() {
    console.log('👀 实时监控日志...(按Ctrl+C退出)\n');
    
    let lastSize = 0;
    
    const checkForUpdates = () => {
        if (!fs.existsSync(logFile)) return;
        
        const stats = fs.statSync(logFile);
        if (stats.size > lastSize) {
            const content = fs.readFileSync(logFile, 'utf8');
            const newContent = content.slice(lastSize);
            
            // 只显示关键信息
            const lines = newContent.split('\n').filter(line => line.trim());
            lines.forEach(line => {
                if (line.includes('AI解析') || line.includes('MCP工具调用') || 
                    line.includes('ERROR') || line.includes('WARN') ||
                    line.includes('无法识别操作类型')) {
                    console.log(new Date().toLocaleTimeString(), ':', line);
                }
            });
            
            lastSize = stats.size;
        }
    };
    
    // 每秒检查一次
    const interval = setInterval(checkForUpdates, 1000);
    
    // 优雅退出
    process.on('SIGINT', () => {
        clearInterval(interval);
        console.log('\n👋 监控已停止');
        process.exit(0);
    });
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
    watchLogs();
} else {
    viewLogs();
}