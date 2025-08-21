#!/usr/bin/env node

/**
 * 使用正确工具名称的MCP Shrimp Task Manager演示
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TaskManagerDemo {
    constructor() {
        this.client = null;
        this.transport = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            console.log('🔧 连接到MCP Shrimp Task Manager...');
            
            const mcpServerPath = path.join(__dirname, 'mcp-shrimp-task-manager', 'dist', 'index.js');
            const dataDir = path.join(__dirname, 'tasks_data');

            // 确保数据目录存在
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log(`📁 创建数据目录: ${dataDir}`);
            }

            // 创建MCP传输
            this.transport = new StdioClientTransport({
                command: 'node',
                args: [mcpServerPath],
                env: {
                    ...process.env,
                    DATA_DIR: dataDir,
                    ENABLE_GUI: 'true',
                    PROMPT_LANGUAGE: 'zh'
                }
            });

            // 创建MCP客户端
            this.client = new Client(
                { name: 'task-demo-client', version: '1.0.0' },
                {}
            );

            // 连接到服务器
            await this.client.connect(this.transport);
            this.isConnected = true;
            
            console.log('✅ 已连接到MCP Shrimp Task Manager');
            
            // 列出可用工具
            const tools = await this.client.listTools();
            console.log('\n🔧 可用工具:');
            tools.tools.forEach((tool, index) => {
                console.log(`  ${index + 1}. ${tool.name}`);
            });
            
        } catch (error) {
            console.error('❌ 连接失败:', error);
            throw error;
        }
    }

    async callTool(name, args = {}) {
        if (!this.isConnected || !this.client) {
            throw new Error('未连接到MCP服务器');
        }

        try {
            console.log(`\n🔧 调用工具: ${name}`);
            if (Object.keys(args).length > 0) {
                console.log(`📋 参数:`, JSON.stringify(args, null, 2));
            }
            
            const result = await this.client.callTool({ name, arguments: args });
            
            if (result.content && result.content.length > 0) {
                console.log('✅ 返回结果:');
                result.content.forEach(content => {
                    if (content.type === 'text') {
                        console.log(content.text);
                    }
                });
            }
            
            return result;
        } catch (error) {
            console.error(`❌ 工具调用失败 [${name}]:`, error.message);
            return null;
        }
    }

    async demonstrateTasks() {
        console.log('\n🎯 开始真实的任务管理演示');
        console.log('===================================');

        try {
            // 1. 初始化项目规则
            console.log('\n📝 步骤 1: 初始化项目规则');
            await this.callTool('init_project_rules', {
                projectType: 'AI测试平台',
                description: '基于Playwright和MCP的智能测试执行系统',
                techStack: ['React', 'TypeScript', 'Node.js', 'Playwright', 'MCP'],
                goals: ['提升测试执行稳定性', '优化用户体验', '增强实时功能']
            });

            // 2. 创建第一个任务 - 使用正确的工具名称
            console.log('\n📝 步骤 2: 创建任务 - 优化TestRuns页面性能');
            await this.callTool('plan_task', {
                title: '优化前端TestRuns页面的性能',
                description: `
# 任务目标
优化TestRuns.tsx页面的性能和用户体验

## 具体问题
1. 组件频繁重新渲染导致界面卡顿
2. WebSocket消息处理不够高效
3. 内存泄漏导致浏览器占用过高
4. 大量测试数据展示时响应缓慢

## 解决方案
- 使用React.memo优化组件渲染
- 实现虚拟滚动处理大数据
- 优化WebSocket消息去重和批处理
- 修复useEffect依赖和清理逻辑

## 验收标准
- 页面渲染时间减少50%
- 内存占用控制在合理范围
- 支持展示1000+测试记录无卡顿

## 相关文件
- src/pages/TestRuns.tsx
- src/services/testService.ts
- src/components/LiveView.tsx
                `,
                priority: 'high',
                category: '性能优化',
                tags: ['React', '性能', 'WebSocket', '内存优化']
            });

            // 3. 创建第二个任务
            console.log('\n📝 步骤 3: 创建任务 - 改进MCP客户端稳定性');
            await this.callTool('plan_task', {
                title: '完善MCP客户端连接稳定性',
                description: `
# 任务目标  
提升MCP客户端的连接稳定性和错误处理能力

## 当前问题
1. getComputedStyle相关错误频繁出现
2. 连接断开后缺乏自动重连机制
3. 工具名称映射不够灵活
4. 缺乏连接状态监控

## 改进计划
- 实现智能重连机制
- 添加连接健康检查
- 优化DOM稳定性检测
- 增强错误恢复能力

## 影响范围
- server/services/mcpClient.ts
- server/utils/mcpToolMapper.js
- server/services/testExecution.ts
                `,
                priority: 'critical',
                category: 'MCP集成',
                tags: ['MCP', '稳定性', '错误处理', '重连机制']
            });

            // 4. 创建第三个任务
            console.log('\n📝 步骤 4: 创建任务 - 实时测试结果展示');
            await this.callTool('plan_task', {
                title: '增强实时测试结果展示功能',
                description: `
# 功能需求
为用户提供更直观的实时测试执行体验

## 新增功能
1. 实时视频流播放测试过程
2. 动态更新测试进度条
3. 实时日志流展示
4. 测试证据自动收集和展示

## 技术实现
- WebSocket实时通信
- MJPEG流处理
- 文件系统监控
- 前端状态管理优化

## 用户价值
- 实时了解测试执行状态
- 快速定位问题所在
- 提升调试效率
                `,
                priority: 'medium',
                category: '功能增强',
                tags: ['实时显示', 'WebSocket', '用户体验', '视频流']
            });

            // 5. 创建第四个任务
            console.log('\n📝 步骤 5: 创建任务 - 改进服务器端执行逻辑');
            await this.callTool('plan_task', {
                title: '改进服务器端测试执行逻辑',
                description: `
# 优化目标
提升后端测试执行的性能和可靠性

## 改进点
1. 优化并发测试执行调度
2. 改进超时和重试机制  
3. 增强浏览器会话管理
4. 优化资源清理逻辑

## 技术要点
- 队列管理优化
- 资源池管理
- 异常恢复机制
- 性能监控
                `,
                priority: 'high',
                category: '后端优化',
                tags: ['后端', '执行引擎', '并发', '资源管理']
            });

            // 6. 查看任务列表
            console.log('\n📋 步骤 6: 查看当前任务列表');
            await this.callTool('list_tasks');

            // 7. 查询特定任务
            console.log('\n🔍 步骤 7: 查询MCP相关任务');
            await this.callTool('query_task', {
                keyword: 'MCP'
            });

            // 8. 分析任务复杂度
            console.log('\n🤖 步骤 8: 分析任务复杂度');
            await this.callTool('analyze_task', {
                taskId: '1' // 假设第一个任务的ID
            });

            // 9. 开始执行任务
            console.log('\n🚀 步骤 9: 开始执行任务');
            await this.callTool('execute_task', {
                taskId: '2' // MCP稳定性任务
            });

            // 10. 更新任务状态
            console.log('\n🔄 步骤 10: 更新任务状态');
            await this.callTool('update_task', {
                taskId: '2',
                progress: 30,
                status: 'in_progress',
                notes: '已完成问题分析，开始实现自动重连机制'
            });

            // 11. 分解复杂任务
            console.log('\n🔨 步骤 11: 分解复杂任务');
            await this.callTool('split_tasks', {
                taskId: '1', // 优化TestRuns性能任务
                maxSubtasks: 4
            });

            // 12. 验证任务
            console.log('\n✅ 步骤 12: 验证任务完成情况');
            await this.callTool('verify_task', {
                taskId: '2'
            });

            console.log('\n🎉 任务管理演示完成！');
            
        } catch (error) {
            console.error('❌ 演示过程中出错:', error);
        }
    }

    async showAdvancedFeatures() {
        console.log('\n🚀 高级功能演示');
        console.log('==================');
        
        try {
            // 思考过程工具
            console.log('\n🧠 使用思考过程工具分析复杂问题');
            await this.callTool('process_thought', {
                context: '如何设计一个稳定的MCP客户端连接管理系统',
                initialThought: '需要考虑网络不稳定、服务器重启、工具调用失败等场景'
            });

            // 任务反思
            console.log('\n🤔 任务反思和优化建议');
            await this.callTool('reflect_task', {
                taskId: '1' // 对性能优化任务进行反思
            });

            // 研究模式
            console.log('\n🔬 进入研究模式');
            await this.callTool('research_mode', {
                topic: 'React性能优化最佳实践',
                scope: 'WebSocket集成和大数据渲染'
            });

        } catch (error) {
            console.error('❌ 高级功能演示失败:', error);
        }
    }

    async cleanup() {
        if (this.isConnected && this.client) {
            try {
                await this.client.close();
                console.log('🛑 已断开MCP连接');
            } catch (error) {
                console.error('❌ 断开连接时出错:', error);
            }
        }
    }
}

// 主函数
async function main() {
    const demo = new TaskManagerDemo();
    
    try {
        await demo.connect();
        await demo.demonstrateTasks();
        await demo.showAdvancedFeatures();
        
        console.log('\n📚 总结：MCP Shrimp Task Manager功能');
        console.log('========================================');
        console.log('✅ 任务创建和规划 (plan_task)');
        console.log('✅ 任务列表和查询 (list_tasks, query_task)'); 
        console.log('✅ 任务执行指导 (execute_task)');
        console.log('✅ 任务状态管理 (update_task)');
        console.log('✅ 复杂任务分解 (split_tasks)');
        console.log('✅ 任务分析和验证 (analyze_task, verify_task)');
        console.log('✅ 智能思考过程 (process_thought)');
        console.log('✅ 任务反思优化 (reflect_task)');
        console.log('✅ 研究模式支持 (research_mode)');
        console.log('✅ 项目规则初始化 (init_project_rules)');
        
        console.log('\n🌟 主要优势:');
        console.log('- 支持任务依赖关系管理');
        console.log('- 提供智能任务分解能力');
        console.log('- 集成AI思考和分析过程');
        console.log('- 支持多语言界面(中文)');
        console.log('- 提供Web可视化界面');
        console.log('- 支持复杂项目管理场景');
        
        console.log('\n🎯 适用场景:');
        console.log('- 大型软件项目开发');
        console.log('- 复杂技术问题分解');
        console.log('- 团队协作任务管理');
        console.log('- AI辅助编程和调试');
        console.log('- 代码重构和优化项目');
        
    } catch (error) {
        console.error('❌ 演示失败:', error);
    } finally {
        await demo.cleanup();
    }
}

// 运行演示
main().catch(console.error);