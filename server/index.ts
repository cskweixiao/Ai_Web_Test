import express from 'express';
import cors from 'cors';
import path from 'path';
import { TestExecutionService } from './services/testExecution.js';
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

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://192.168.124.13:5173'],
  credentials: true
}));
app.use(express.json());

// 测试用例数据存储（实际项目中应该使用数据库）
let mockTestCases: any[] = [];
let nextId = 1;

// 设置外部测试用例查找函数
testExecutionService.setExternalTestCaseFinder((id: number) => {
  return mockTestCases.find(tc => tc.id === id);
});

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