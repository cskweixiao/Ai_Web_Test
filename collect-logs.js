import fs from 'fs';
import path from 'path';

// 日志收集器 - 将控制台输出保存到文件
class LogCollector {
    constructor() {
        this.logFile = path.join(process.cwd(), 'execution-logs.txt');
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        // 清空之前的日志
        fs.writeFileSync(this.logFile, '=== 测试执行日志 ===\n');
    }
    
    start() {
        const self = this;
        
        // 拦截所有console输出
        ['log', 'error', 'warn', 'info'].forEach(method => {
            console[method] = function(...args) {
                const timestamp = new Date().toISOString();
                const message = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                
                const logLine = `[${timestamp}] ${method.toUpperCase()}: ${message}\n`;
                
                // 写入文件
                fs.appendFileSync(self.logFile, logLine);
                
                // 同时输出到原始控制台
                self.originalConsole[method](...args);
            };
        });
        
        console.log('📝 日志收集器已启动，日志将保存到:', this.logFile);
    }
    
    stop() {
        // 恢复原始console
        Object.assign(console, this.originalConsole);
        console.log('📝 日志收集器已停止');
    }
}

export { LogCollector };