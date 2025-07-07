import express from 'express';
import cors from 'cors';
import path from 'path';
import { TestExecutionService } from './services/testExecution.js';
import { SuiteExecutionService } from './services/suiteExecution.js';
import { WebSocketManager } from './services/websocket.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { testRoutes } from './routes/test.js';
import { suiteRoutes } from './routes/suite.js'; // 🔥 新增
import { AITestParser } from './services/aiParser.js';
import { PlaywrightMcpClient } from './services/mcpClient.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 创建HTTP服务器
const server = createServer(app);

// 初始化WebSocket服务器
const wss = new WebSocketServer({ server });
const wsManager = new WebSocketManager(wss);

// 初始化AI解析器和Playwright客户端
const aiParser = new AITestParser();
const mcpClient = new PlaywrightMcpClient();

// 初始化测试执行服务
const testExecutionService = new TestExecutionService(wsManager, aiParser, mcpClient);

// 🔥 初始化套件执行服务
const suiteExecutionService = new SuiteExecutionService(wsManager, testExecutionService);

// Middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

app.use(express.json());

// API Routes
app.use('/api/tests', testRoutes(testExecutionService));
app.use('/api/test-suites', suiteRoutes(suiteExecutionService)); // 🔥 新增


// 🔥 定时清理任务，防止内存泄漏
const setupCleanupTasks = () => {
  // 每小时清理一次已完成的测试记录
  setInterval(() => {
    console.log('🧹 执行定时清理任务...');
    suiteExecutionService.cleanupCompletedSuites(24); // 清理24小时前的记录
    
    // 🔥 可以在这里添加更多清理逻辑
    // testExecutionService.cleanupCompletedTests(24);
  }, 60 * 60 * 1000); // 每小时执行一次
  
  console.log('⏰ 定时清理任务已设置');
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 服务器已启动，正在监听端口 ${PORT}`);
  console.log(`WebSocket 服务器已准备就绪`);
  
  // 🔥 初始化示例数据和定时任务
  // initializeSampleData();
  setupCleanupTasks();
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