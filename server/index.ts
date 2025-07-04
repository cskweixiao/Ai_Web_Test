import express from 'express';
import cors from 'cors';
import path from 'path';
import { TestExecutionService } from './services/testExecution.js';
import { SuiteExecutionService } from './services/suiteExecution.js';
import { WebSocketManager } from './services/websocket.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const PORT = process.env.PORT || 3001;

// 创建HTTP服务器
const server = createServer(app);

// 初始化WebSocket服务器
const wss = new WebSocketServer({ server });
const wsManager = new WebSocketManager(wss);

// 初始化测试执行服务
const testExecutionService = new TestExecutionService(wsManager);

// 🔥 初始化套件执行服务
const suiteExecutionService = new SuiteExecutionService(wsManager, testExecutionService);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://192.168.124.13:5173'],
  credentials: true
}));
app.use(express.json());

// 测试用例数据存储（实际项目中应该使用数据库）
let mockTestCases: any[] = [];
let nextId = 1;

// 🔥 测试套件数据存储
let mockTestSuites: any[] = [];
let nextSuiteId = 1;

// 设置外部测试用例查找函数
testExecutionService.setExternalTestCaseFinder((id: number) => {
  return mockTestCases.find(tc => tc.id === id);
});

// 🔥 设置外部测试套件查找函数
suiteExecutionService.setExternalSuiteFinder((id: number) => {
  return mockTestSuites.find(suite => suite.id === id);
});

// 🔥 初始化示例数据（用于演示）
const initializeSampleData = () => {
  // 先创建示例测试用例
  if (mockTestCases.length === 0) {
    const sampleTestCase = {
      id: nextId++,
      name: '用户登录功能测试',
      steps: '1. 打开登录页面\n2. 输入有效的用户名和密码\n3. 点击登录按钮\n4. 验证页面跳转到首页',
      assertions: '• 成功跳转到首页\n• 显示用户昵称\n• 退出按钮可见',
      priority: 'high',
      status: 'active',
      tags: ['login', 'auth', 'core'],
      author: '测试团队',
      created: new Date().toISOString().split('T')[0],
      lastRun: '从未运行',
      success_rate: 0,
      parsedSteps: [],
      parsedAssertions: []
    };
    mockTestCases.push(sampleTestCase);
    console.log('🎯 初始化示例测试用例完成');
  }
  
  // 再创建示例测试套件
  if (mockTestSuites.length === 0) {
    const sampleSuite = {
      id: nextSuiteId++,
      name: '登录模块回归测试',
      description: '验证登录功能的完整流程',
      testCaseIds: [1], // 引用上面创建的测试用例
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: '测试团队',
      tags: ['login', 'regression'],
      priority: 'high',
      status: 'active'
    };
    mockTestSuites.push(sampleSuite);
    console.log('🎯 初始化示例测试套件完成');
  }
};

// 🔥 定时清理任务，防止内存泄漏
const setupCleanupTasks = () => {
  // 每小时清理一次已完成的测试记录
  setInterval(() => {
    console.log('🧹 执行定时清理任务...');
    suiteExecutionService.cleanupCompletedSuites(24); // 清理24小时前的记录
    
    // 🔥 可以在这里添加更多清理逻辑
    testExecutionService.cleanupCompletedTests(24);
  }, 60 * 60 * 1000); // 每小时执行一次
  
  console.log('⏰ 定时清理任务已设置');
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
// 获取测试用例列表
app.get('/api/tests/cases', (req, res) => {
  res.json(mockTestCases);
});

// 创建测试用例
app.post('/api/tests/cases', (req, res) => {
  try {
    const { name, steps, assertions, priority, status, tags, author, created, lastRun, success_rate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '测试用例名称不能为空'
      });
    }

    if (!steps || !steps.trim()) {
      return res.status(400).json({
        success: false,
        error: '测试步骤不能为空'
      });
    }

    // 🔥 修改：保存测试步骤和断言预期的原始文本
    const newTestCase = {
      id: nextId++,
      name: name.trim(),
      steps: steps.trim(), // 保存测试步骤文本，供AI解析
      assertions: assertions?.trim() || '', // 保存断言预期文本，供AI解析
      priority: priority || 'medium',
      status: status || 'draft',
      tags: Array.isArray(tags) ? tags : [],
      author: author || '当前用户',
      created: created || new Date().toISOString().split('T')[0],
      lastRun: lastRun || '从未运行',
      success_rate: success_rate || 0,
      parsedSteps: [], // AI解析后的步骤
      parsedAssertions: [] // AI解析后的断言
    };

    mockTestCases.push(newTestCase);

    console.log(`✅ 创建测试用例成功: ${newTestCase.name} (ID: ${newTestCase.id})`);
    console.log(`📝 测试步骤: ${newTestCase.steps}`);
    console.log(`🎯 断言预期: ${newTestCase.assertions}`);
    console.log(`🧠 将使用AI分别解析测试步骤和断言预期`);

    res.json({
      success: true,
      data: newTestCase,
      message: '测试用例创建成功，将使用AI分别解析测试步骤和断言预期'
    });
  } catch (error) {
    console.error('创建测试用例失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：更新测试用例接口
app.put('/api/tests/cases/:id', (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const { name, steps, assertions, priority, status, tags } = req.body;

    const testCaseIndex = mockTestCases.findIndex(tc => tc.id === caseId);
    if (testCaseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '测试用例不存在'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '测试用例名称不能为空'
      });
    }

    if (!steps || !steps.trim()) {
      return res.status(400).json({
        success: false,
        error: '测试步骤不能为空'
      });
    }

    // 更新测试用例
    const updatedTestCase = {
      ...mockTestCases[testCaseIndex],
      name: name.trim(),
      steps: steps.trim(),
      assertions: assertions?.trim() || '',
      priority: priority || 'medium',
      status: status || 'draft',
      tags: Array.isArray(tags) ? tags : [],
      parsedSteps: [], // 重置AI解析结果
      parsedAssertions: []
    };

    mockTestCases[testCaseIndex] = updatedTestCase;

    console.log(`✅ 更新测试用例成功: ${updatedTestCase.name} (ID: ${updatedTestCase.id})`);

    res.json({
      success: true,
      data: updatedTestCase,
      message: '测试用例更新成功'
    });
  } catch (error) {
    console.error('更新测试用例失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：删除测试用例接口
app.delete('/api/tests/cases/:id', (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const testCaseIndex = mockTestCases.findIndex(tc => tc.id === caseId);
    
    if (testCaseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '测试用例不存在'
      });
    }

    const deletedTestCase = mockTestCases.splice(testCaseIndex, 1)[0];
    
    console.log(`✅ 删除测试用例成功: ${deletedTestCase.name} (ID: ${deletedTestCase.id})`);

    res.json({
      success: true,
      message: '测试用例删除成功'
    });
  } catch (error) {
    console.error('删除测试用例失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：获取测试套件列表
app.get('/api/test-suites', (req, res) => {
  res.json(mockTestSuites);
});

// 🔥 新增：创建测试套件
app.post('/api/test-suites', (req, res) => {
  try {
    const { name, description, testCases, priority, status, tags, author, created } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '套件名称不能为空'
      });
    }

    if (!testCases || !testCases.length) {
      return res.status(400).json({
        success: false,
        error: '套件必须包含至少一个测试用例'
      });
    }

         const newSuite = {
       id: nextSuiteId++,
       name: name.trim(),
       description: description || '',
       testCaseIds: Array.isArray(testCases) ? testCases : [], // 直接使用测试用例ID数组
       priority: priority || 'medium',
       status: status || 'draft',
       tags: Array.isArray(tags) ? tags : [],
       owner: author || '当前用户',
       createdAt: created || new Date().toISOString(),
       updatedAt: new Date().toISOString()
     };

    mockTestSuites.push(newSuite);

    console.log(`✅ 创建测试套件成功: ${newSuite.name} (ID: ${newSuite.id})`);
    console.log(`📝 套件描述: ${newSuite.description}`);
    console.log(`🧠 将使用AI分别解析测试用例和断言预期`);

    res.json({
      success: true,
      data: newSuite,
      message: '测试套件创建成功，将使用AI分别解析测试用例和断言预期'
    });
  } catch (error) {
    console.error('创建测试套件失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：更新测试套件
app.put('/api/test-suites/:id', (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    const { name, description, testCases, priority, status, tags } = req.body;

    const suiteIndex = mockTestSuites.findIndex(suite => suite.id === suiteId);
    if (suiteIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '测试套件不存在'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '套件名称不能为空'
      });
    }

    if (!testCases || !testCases.length) {
      return res.status(400).json({
        success: false,
        error: '套件必须包含至少一个测试用例'
      });
    }

         const updatedSuite = {
       ...mockTestSuites[suiteIndex],
       name: name.trim(),
       description: description || '',
       testCaseIds: Array.isArray(testCases) ? testCases : [], // 直接使用测试用例ID数组
       priority: priority || 'medium',
       status: status || 'draft',
       tags: Array.isArray(tags) ? tags : [],
       updatedAt: new Date().toISOString()
     };

    mockTestSuites[suiteIndex] = updatedSuite;

    console.log(`✅ 更新测试套件成功: ${updatedSuite.name} (ID: ${updatedSuite.id})`);

    res.json({
      success: true,
      data: updatedSuite,
      message: '测试套件更新成功'
    });
  } catch (error) {
    console.error('更新测试套件失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：删除测试套件
app.delete('/api/test-suites/:id', (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    const suiteIndex = mockTestSuites.findIndex(suite => suite.id === suiteId);
    
    if (suiteIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '测试套件不存在'
      });
    }

    const deletedSuite = mockTestSuites.splice(suiteIndex, 1)[0];
    
    console.log(`✅ 删除测试套件成功: ${deletedSuite.name} (ID: ${deletedSuite.id})`);

    res.json({
      success: true,
      message: '测试套件删除成功'
    });
  } catch (error) {
    console.error('删除测试套件失败:', error);
    res.status(500).json({
      success: false,
      error: '内部服务器错误'
    });
  }
});

// 🔥 新增：执行测试套件
app.post('/api/test-suites/execute', async (req, res) => {
  try {
    console.log('🔥🔥🔥 [API] 收到执行测试套件请求');
    console.log('🔥🔥🔥 [API] 请求体:', JSON.stringify(req.body, null, 2));
    
    const { suiteId, environment = 'staging' } = req.body;

    if (!suiteId) {
      return res.status(400).json({
        success: false,
        error: '缺少 suiteId 参数'
      });
    }

    console.log(`🔥🔥🔥 [API] 开始执行测试套件 ID: ${suiteId}`);

    // 查找测试套件并转换为SuiteExecutionService需要的格式
    const testSuite = mockTestSuites.find(suite => suite.id === suiteId);
    if (!testSuite) {
      console.log(`🔥🔥🔥 [API] 测试套件不存在: ${suiteId}`);
      console.log(`��🔥🔥 [API] 当前所有测试套件:`, mockTestSuites.map(suite => ({id: suite.id, name: suite.name})));
      return res.status(404).json({
        success: false,
        error: `测试套件 ${suiteId} 不存在`
      });
    }

           console.log(`🔥🔥🔥 [API] 找到测试套件:`, {
         id: testSuite.id,
         name: testSuite.name,
         description: testSuite.description,
         testCasesCount: testSuite.testCaseIds?.length || 0
       });

    // 使用SuiteExecutionService执行测试套件
    const runId = await suiteExecutionService.runSuite(suiteId, environment);

    console.log(`🔥🔥🔥 [API] 测试套件已提交，运行ID: ${runId}`);

    res.json({
      success: true,
      runId,
      suiteId,
      message: `开始执行测试套件: ${testSuite.name}`
    });

  } catch (error: any) {
    console.error('🔥🔥🔥 [API] 执行测试套件失败:', error);
    console.error('🔥🔥🔥 [API] 错误详情:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '执行测试套件失败'
    });
  }
});

// 执行测试用例（真正的实现）
app.post('/api/tests/execute', async (req, res) => {
  try {
    console.log('🔥🔥🔥 [API] 收到执行测试请求');
    console.log('🔥🔥🔥 [API] 请求体:', JSON.stringify(req.body, null, 2));
    
    const { testCaseId, environment = 'staging' } = req.body;

    if (!testCaseId) {
      return res.status(400).json({
        success: false,
        error: '缺少 testCaseId 参数'
      });
    }

    console.log(`🔥🔥🔥 [API] 开始执行测试用例 ID: ${testCaseId}`);

    // 查找测试用例并转换为TestExecutionService需要的格式
    const testCase = mockTestCases.find(tc => tc.id === testCaseId);
    if (!testCase) {
      console.log(`🔥🔥🔥 [API] 测试用例不存在: ${testCaseId}`);
      console.log(`🔥🔥🔥 [API] 当前所有测试用例:`, mockTestCases.map(tc => ({id: tc.id, name: tc.name})));
      return res.status(404).json({
        success: false,
        error: `测试用例 ${testCaseId} 不存在`
      });
    }

    console.log(`🔥🔥🔥 [API] 找到测试用例:`, {
      id: testCase.id,
      name: testCase.name,
      description: testCase.description,
      stepsCount: testCase.steps?.length || 0
    });

    // 使用TestExecutionService执行测试
    const runId = await testExecutionService.runTest(testCaseId, environment);

    console.log(`🔥🔥🔥 [API] 测试已提交，运行ID: ${runId}`);

    res.json({
      success: true,
      runId,
      testCaseId,
      message: `开始执行测试: ${testCase.name}`
    });

  } catch (error: any) {
    console.error('🔥🔥🔥 [API] 执行测试失败:', error);
    console.error('🔥🔥🔥 [API] 错误详情:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '执行测试失败'
    });
  }
});

// 静态文件服务 (仅在生产环境)
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  // SPA 回退
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  console.log('🌐 WebSocket 服务已准备就绪');
  
  // 🔥 初始化示例数据和清理任务
  initializeSampleData();
  setupCleanupTasks();
  
  console.log('✅ 系统初始化完成');
});

process.on('SIGINT', () => {
  console.log('🔌 正在关闭服务器...');
  wsManager.shutdown();
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

export default app; 