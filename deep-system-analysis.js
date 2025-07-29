import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/tests';

// 深度系统分析测试用例
const deepAnalysisTestCase = {
    name: '【深度分析】MCP参数格式和执行效果验证',
    steps: `1. 导航到 https://k8s-saas-tmp.ycb51.cn/supplychain_page/home/home
2. 截图记录初始页面状态
3. 等待 3 秒确保页面稳定
4. 在用户名字段输入 "admin"
5. 截图验证用户名是否真的输入了
6. 在密码字段输入 "123456"  
7. 截图验证密码字段是否有变化
8. 点击登录按钮
9. 截图查看点击后的页面变化`,
    assertions: `每个操作后都应该有实际的页面变化`
};

async function createDeepAnalysisTest() {
    console.log('🔧 创建深度分析测试用例...');
    const response = await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deepAnalysisTestCase),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`创建失败: ${response.statusText}, ${errorBody}`);
    }
    const result = await response.json();
    console.log('✅ 深度分析测试用例创建成功, ID:', result.data.id);
    return result.data;
}

async function executeDeepAnalysisTest(testCaseId) {
    console.log(`\n🚀 执行深度分析测试 ID: ${testCaseId}`);
    const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`执行失败: ${response.statusText} - ${errorText}`);
    }
    const result = await response.json();
    console.log('✅ 深度分析测试已启动, Run ID:', result.runId);
    return result.runId;
}

async function monitorDeepAnalysisExecution(runId) {
    console.log('\n🔍 === 深度分析执行监控 ===');
    let lastLogCount = 0;
    let checkCount = 0;
    let stepCount = 0;
    const maxChecks = 100; // 增加监控时间

    const mcpCalls = [];
    const screenshots = [];
    const parameterFormats = [];
    const executionResults = [];

    while (checkCount < maxChecks) {
        checkCount++;

        try {
            const response = await fetch(`${API_BASE}/runs/${runId}`);
            if (!response.ok) {
                console.log(`❌ 获取状态失败: ${response.status}`);
                break;
            }

            const result = await response.json();
            const testRun = result.data;

            // 分析新日志
            if (testRun.logs.length > lastLogCount) {
                const newLogs = testRun.logs.slice(lastLogCount);
                
                newLogs.forEach(log => {
                    const msg = log.message;
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    
                    // 记录MCP工具调用
                    if (msg.includes('MCP工具调用:')) {
                        const toolMatch = msg.match(/MCP工具调用: (\w+) (.+)/);
                        if (toolMatch) {
                            mcpCalls.push({
                                timestamp,
                                tool: toolMatch[1],
                                parameters: toolMatch[2],
                                step: stepCount + 1
                            });
                        }
                    }

                    // 记录参数格式
                    if (msg.includes('参数格式:') || msg.includes('arguments:')) {
                        parameterFormats.push({
                            timestamp,
                            format: msg,
                            step: stepCount + 1
                        });
                    }

                    // 记录执行结果
                    if (msg.includes('MCP命令执行成功') || msg.includes('MCP命令执行失败')) {
                        executionResults.push({
                            timestamp,
                            result: msg.includes('成功') ? 'SUCCESS' : 'FAILED',
                            message: msg,
                            step: stepCount + 1
                        });
                    }

                    // 记录截图
                    if (msg.includes('截图') || msg.includes('screenshot')) {
                        screenshots.push({
                            timestamp,
                            description: msg,
                            step: stepCount + 1
                        });
                    }

                    // 计算步骤进度
                    if (msg.includes('AI解析成功:')) {
                        stepCount++;
                    }

                    // 显示关键日志
                    const levelIcon = {
                        'info': 'ℹ️',
                        'success': '✅',
                        'warning': '⚠️',
                        'error': '❌'
                    }[log.level] || 'ℹ️';

                    console.log(`[${timestamp}] ${levelIcon} ${log.message}`);
                });
                
                lastLogCount = testRun.logs.length;
            }

            console.log(`\n📊 [检查 ${checkCount}/${maxChecks}] 状态: ${testRun.status} | 步骤: ${stepCount}/9 | MCP调用: ${mcpCalls.length} | 日志: ${testRun.logs.length} 条`);

            // 检查是否完成
            if (testRun.status === 'completed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
                console.log(`\n🏁 深度分析执行结束: ${testRun.status}`);
                return { 
                    testRun, 
                    stepCount, 
                    mcpCalls, 
                    screenshots, 
                    parameterFormats, 
                    executionResults 
                };
            }

        } catch (error) {
            console.log(`❌ 监控出错: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n⏰ 深度分析监控超时`);
    return { 
        testRun: null, 
        stepCount, 
        mcpCalls, 
        screenshots, 
        parameterFormats, 
        executionResults 
    };
}

function generateDeepAnalysisReport(data) {
    const { testRun, stepCount, mcpCalls, screenshots, parameterFormats, executionResults } = data;
    
    console.log('\n🔍 === 深度系统分析报告 ===');
    
    // 基本信息
    if (testRun) {
        console.log(`📊 执行状态: ${testRun.status}`);
        console.log(`📋 总日志数: ${testRun.logs.length}`);
        console.log(`🎯 完成步骤: ${stepCount}/9`);
    }

    // MCP调用分析
    console.log('\n🔧 === MCP工具调用分析 ===');
    console.log(`总MCP调用次数: ${mcpCalls.length}`);
    
    if (mcpCalls.length > 0) {
        console.log('\n详细MCP调用记录:');
        mcpCalls.forEach((call, index) => {
            console.log(`${index + 1}. [${call.timestamp}] 步骤${call.step}: ${call.tool}`);
            console.log(`   参数: ${call.parameters}`);
        });
    } else {
        console.log('❌ 没有检测到MCP工具调用！这表明存在严重问题');
    }

    // 参数格式分析
    console.log('\n📋 === 参数格式分析 ===');
    console.log(`参数格式记录数: ${parameterFormats.length}`);
    
    if (parameterFormats.length > 0) {
        console.log('\n参数格式详情:');
        parameterFormats.forEach((format, index) => {
            console.log(`${index + 1}. [${format.timestamp}] 步骤${format.step}:`);
            console.log(`   ${format.format}`);
        });
    } else {
        console.log('⚠️ 没有检测到参数格式记录');
    }

    // 执行结果分析
    console.log('\n✅ === 执行结果分析 ===');
    const successCount = executionResults.filter(r => r.result === 'SUCCESS').length;
    const failedCount = executionResults.filter(r => r.result === 'FAILED').length;
    
    console.log(`成功执行: ${successCount} 次`);
    console.log(`执行失败: ${failedCount} 次`);
    console.log(`成功率: ${executionResults.length > 0 ? (successCount / executionResults.length * 100).toFixed(1) : 0}%`);

    if (executionResults.length > 0) {
        console.log('\n执行结果详情:');
        executionResults.forEach((result, index) => {
            const icon = result.result === 'SUCCESS' ? '✅' : '❌';
            console.log(`${index + 1}. [${result.timestamp}] ${icon} 步骤${result.step}: ${result.result}`);
        });
    }

    // 截图分析
    console.log('\n📸 === 截图分析 ===');
    console.log(`截图次数: ${screenshots.length}`);
    
    if (screenshots.length > 0) {
        console.log('\n截图记录:');
        screenshots.forEach((screenshot, index) => {
            console.log(`${index + 1}. [${screenshot.timestamp}] 步骤${screenshot.step}: ${screenshot.description}`);
        });
    }

    // 问题诊断
    console.log('\n🚨 === 问题诊断 ===');
    
    const issues = [];
    
    if (mcpCalls.length === 0) {
        issues.push('严重: 没有检测到任何MCP工具调用');
    }
    
    if (successCount > 0 && screenshots.length === 0) {
        issues.push('可疑: MCP调用成功但没有截图验证');
    }
    
    if (successCount === executionResults.length && successCount > 0) {
        issues.push('可疑: 所有MCP调用都显示成功，但可能没有实际效果');
    }
    
    const inputCalls = mcpCalls.filter(call => call.tool === 'browser_type');
    if (inputCalls.length > 0) {
        console.log(`\n🔍 输入操作分析:`);
        inputCalls.forEach((call, index) => {
            console.log(`输入操作 ${index + 1}: ${call.parameters}`);
            // 检查参数格式是否正确
            if (call.parameters.includes('ref:') && call.parameters.includes('text:')) {
                console.log('  ✅ 参数格式正确 (包含ref和text)');
            } else if (call.parameters.includes('selector:')) {
                console.log('  ❌ 参数格式错误 (使用了selector而不是ref)');
                issues.push('参数格式错误: 输入操作使用了错误的参数格式');
            } else {
                console.log('  ⚠️ 参数格式不明确');
            }
        });
    }
    
    if (issues.length === 0) {
        console.log('✅ 未发现明显的技术问题');
        console.log('⚠️ 但需要通过截图验证实际效果');
    } else {
        console.log('发现以下问题:');
        issues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue}`);
        });
    }

    // 关键发现
    console.log('\n🎯 === 关键发现 ===');
    
    if (successCount > 0 && mcpCalls.length > 0) {
        console.log('✅ MCP系统技术层面工作正常');
        console.log('⚠️ 但"技术成功"不等于"实际效果"');
        console.log('🔍 需要检查截图验证实际的页面变化');
    }
    
    if (inputCalls.length > 0) {
        console.log(`📝 检测到 ${inputCalls.length} 次输入操作`);
        console.log('🔍 关键问题: 输入操作显示成功，但用户报告没有实际输入');
        console.log('💡 可能原因:');
        console.log('   1. 元素定位错误 - 找到了错误的元素');
        console.log('   2. 元素状态问题 - 元素不可编辑或被禁用');
        console.log('   3. 页面JavaScript干扰 - 输入被页面脚本清除');
        console.log('   4. 浏览器兼容性问题 - MCP命令与实际浏览器不同步');
    }

    console.log('\n📋 === 建议的下一步 ===');
    console.log('1. 检查screenshots文件夹中的最新截图');
    console.log('2. 对比输入前后的截图，验证是否有实际变化');
    console.log('3. 如果截图显示没有输入，则确认是MCP参数格式问题');
    console.log('4. 检查页面元素的实际状态和可编辑性');

    return {
        mcpCallsCount: mcpCalls.length,
        successRate: executionResults.length > 0 ? (successCount / executionResults.length * 100) : 0,
        screenshotsCount: screenshots.length,
        issuesCount: issues.length,
        inputCallsCount: inputCalls.length
    };
}

async function main() {
    try {
        console.log('🚀 开始深度系统分析');
        console.log('================================');
        console.log('这个测试将深入分析MCP参数格式和实际执行效果');
        console.log('重点关注: 为什么显示"成功"但没有实际输入');
        
        const testCase = await createDeepAnalysisTest();
        const runId = await executeDeepAnalysisTest(testCase.id);
        const analysisData = await monitorDeepAnalysisExecution(runId);
        
        const report = generateDeepAnalysisReport(analysisData);
        
        console.log('\n📋 === 分析完成 ===');
        console.log(`MCP调用次数: ${report.mcpCallsCount}`);
        console.log(`技术成功率: ${report.successRate}%`);
        console.log(`截图验证: ${report.screenshotsCount} 次`);
        console.log(`发现问题: ${report.issuesCount} 个`);
        
        if (report.successRate === 100 && report.inputCallsCount > 0) {
            console.log('\n🎯 核心问题确认:');
            console.log('MCP系统显示100%成功，但用户报告没有实际输入');
            console.log('这是典型的"假成功"问题 - 技术层面成功，实际效果失败');
        }

    } catch (error) {
        console.error('\n💥 深度分析过程中发生错误:', error);
        console.error('这可能表明系统存在更深层的问题');
    }
}

main();