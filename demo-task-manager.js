#!/usr/bin/env node

/**
 * MCP Shrimp Task Manager 演示脚本
 * 用于展示如何在AI测试项目中创建和管理任务
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 MCP Shrimp Task Manager 演示开始');
console.log('====================================');

// MCP 服务器路径
const mcpServerPath = path.join(__dirname, 'mcp-shrimp-task-manager', 'dist', 'index.js');
const dataDir = path.join(__dirname, 'tasks_data');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 创建数据目录: ${dataDir}`);
}

// 启动 MCP 服务器的函数
function startMcpServer() {
    return new Promise((resolve, reject) => {
        console.log('🔧 启动 MCP Shrimp Task Manager 服务器...');
        
        const server = spawn('node', [mcpServerPath], {
            env: {
                ...process.env,
                DATA_DIR: dataDir,
                ENABLE_GUI: 'true',
                PROMPT_LANGUAGE: 'zh'
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        
        server.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            console.log('📊 [Server]', message.trim());
            
            // 检查服务器是否准备就绪
            if (message.includes('initialized') || message.includes('ready')) {
                resolve(server);
            }
        });
        
        server.stderr.on('data', (data) => {
            const message = data.toString();
            if (!message.includes('warning') && !message.includes('deprecated')) {
                console.error('❌ [Server Error]', message.trim());
            }
        });
        
        server.on('error', (error) => {
            console.error('❌ 服务器启动失败:', error);
            reject(error);
        });
        
        // 5秒后如果还没准备就绪，强制resolve
        setTimeout(() => {
            console.log('⏰ 服务器启动超时，继续演示...');
            resolve(server);
        }, 5000);
    });
}

// 模拟 MCP 客户端调用
async function callMcpTool(toolName, args) {
    console.log(`🔧 调用工具: ${toolName}`);
    console.log(`📋 参数:`, JSON.stringify(args, null, 2));
    
    // 这里应该是实际的 MCP 客户端调用
    // 为了演示目的，我们模拟返回结果
    return {
        success: true,
        content: `模拟调用 ${toolName} 成功`,
        timestamp: new Date().toISOString()
    };
}

// 演示任务管理功能
async function demonstrateTaskManagement() {
    console.log('\n🎯 开始演示任务管理功能');
    console.log('=============================');
    
    // 1. 创建项目规则初始化
    console.log('\n📝 1. 初始化项目规则');
    await callMcpTool('initProjectRules', {
        projectType: 'AI测试项目',
        language: 'zh',
        projectDescription: '基于Playwright和MCP的智能测试执行平台'
    });
    
    // 2. 创建任务 - 优化前端TestRuns页面性能
    console.log('\n📝 2. 创建任务 - 优化前端TestRuns页面性能');
    const task1 = {
        id: 'task-1',
        title: '优化前端TestRuns页面的性能',
        description: `
优化TestRuns页面的性能问题，包括：
- 减少不必要的状态更新和重新渲染
- 优化WebSocket消息处理逻辑
- 改进错误边界处理
- 优化大量测试运行数据的展示性能
- 修复内存泄漏问题
        `,
        priority: 'high',
        category: '前端优化',
        tags: ['性能', 'React', 'WebSocket'],
        relatedFiles: [
            'src/pages/TestRuns.tsx',
            'src/services/testService.ts',
            'src/components/LiveView.tsx'
        ]
    };
    
    await callMcpTool('planTask', task1);
    
    // 3. 创建任务 - 改进服务器端测试执行逻辑
    console.log('\n📝 3. 创建任务 - 改进服务器端测试执行逻辑');
    const task2 = {
        id: 'task-2',
        title: '改进服务器端测试执行逻辑',
        description: `
改进测试执行服务的稳定性和性能：
- 优化MCP客户端连接管理
- 改进测试步骤执行的错误处理
- 增强浏览器会话管理
- 优化并发测试执行
- 改进超时和重试机制
        `,
        priority: 'high',
        category: '后端优化',
        tags: ['MCP', 'Playwright', '稳定性'],
        dependencies: ['task-3'], // 依赖MCP客户端稳定性改进
        relatedFiles: [
            'server/services/testExecution.ts',
            'server/services/mcpClient.ts'
        ]
    };
    
    await callMcpTool('planTask', task2);
    
    // 4. 创建任务 - 完善MCP客户端连接稳定性
    console.log('\n📝 4. 创建任务 - 完善MCP客户端连接稳定性');
    const task3 = {
        id: 'task-3',
        title: '完善MCP客户端连接稳定性',
        description: `
提升MCP客户端的连接稳定性：
- 实现自动重连机制
- 优化连接池管理
- 改进错误处理和恢复
- 增加连接状态监控
- 优化工具名称映射
- 修复getComputedStyle相关错误
        `,
        priority: 'critical', // 最高优先级，因为其他任务依赖它
        category: 'MCP集成',
        tags: ['MCP', '连接管理', '稳定性'],
        relatedFiles: [
            'server/services/mcpClient.ts',
            'server/utils/mcpToolMapper.js'
        ]
    };
    
    await callMcpTool('planTask', task3);
    
    // 5. 创建任务 - 添加实时测试结果展示功能
    console.log('\n📝 5. 创建任务 - 添加实时测试结果展示功能');
    const task4 = {
        id: 'task-4',
        title: '添加实时测试结果展示功能',
        description: `
增强测试结果的实时展示能力：
- 实现实时流媒体播放
- 优化证据查看器
- 改进队列状态显示
- 增加测试进度可视化
- 实现实时日志流
        `,
        priority: 'medium',
        category: '功能增强',
        tags: ['实时显示', 'UI/UX', 'WebSocket'],
        dependencies: ['task-1'], // 依赖前端性能优化
        relatedFiles: [
            'src/components/LiveView.tsx',
            'src/components/EvidenceViewer.tsx',
            'src/components/QueueStatus.tsx',
            'server/services/streamService.ts'
        ]
    };
    
    await callMcpTool('planTask', task4);
    
    // 6. 查看任务列表
    console.log('\n📋 6. 查看当前任务列表');
    await callMcpTool('listTasks', {});
    
    // 7. 获取任务详情
    console.log('\n🔍 7. 查看关键任务详情');
    await callMcpTool('getTaskDetail', { taskId: 'task-3' });
    
    // 8. 开始执行最高优先级任务
    console.log('\n🚀 8. 开始执行MCP客户端稳定性任务');
    await callMcpTool('executeTask', { taskId: 'task-3' });
    
    // 9. 更新任务状态
    console.log('\n🔄 9. 更新任务进度');
    await callMcpTool('updateTaskContent', {
        taskId: 'task-3',
        status: 'in_progress',
        progress: 30,
        notes: '已完成自动重连机制的基础架构设计'
    });
    
    // 10. 任务分解
    console.log('\n🔨 10. 分解复杂任务');
    await callMcpTool('splitTasks', {
        taskId: 'task-1',
        splitCriteria: 'by_component'
    });
    
    console.log('\n✅ 任务管理演示完成！');
}

// 主函数
async function main() {
    try {
        console.log('🎬 开始MCP Shrimp Task Manager演示');
        
        // 显示项目信息
        console.log('\n📊 项目信息:');
        console.log(`📁 项目路径: ${__dirname}`);
        console.log(`💾 数据目录: ${dataDir}`);
        console.log(`🔧 MCP服务器: ${mcpServerPath}`);
        
        // 检查MCP服务器是否存在
        if (!fs.existsSync(mcpServerPath)) {
            console.error('❌ MCP服务器文件不存在:', mcpServerPath);
            return;
        }
        
        // 演示任务管理功能
        await demonstrateTaskManagement();
        
        console.log('\n🎉 演示完成！');
        console.log('\n📚 更多功能:');
        console.log('- 使用 queryTask 搜索任务');
        console.log('- 使用 analyzeTask 分析任务复杂度');
        console.log('- 使用 verifyTask 验证任务完成度');
        console.log('- 使用 reflectTask 进行任务回顾');
        console.log('- 访问 http://localhost:3000 查看Web界面');
        
    } catch (error) {
        console.error('❌ 演示过程中出错:', error);
    }
}

// 运行演示
main().catch(console.error);