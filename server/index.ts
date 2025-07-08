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
import { PrismaClient } from '../src/generated/prisma';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

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

// 创建默认系统用户（如果不存在）
async function ensureDefaultUser() {
  try {
    const userCount = await prisma.users.count();
    
    if (userCount === 0) {
      console.log('🔑 创建默认系统用户...');
      
      // 创建简单的哈希密码（实际环境应使用bcrypt等）
      const passwordHash = crypto.createHash('sha256').update('system123').digest('hex');
      
      const defaultUser = await prisma.users.create({
        data: {
          email: 'system@test.local',
          password_hash: passwordHash,
          created_at: new Date()
        }
      });
      
      console.log(`✅ 默认系统用户已创建: ID=${defaultUser.id}, Email=${defaultUser.email}`);
      
      // 为系统用户添加角色（如果需要）
      await prisma.roles.upsert({
        where: { name: 'admin' },
        update: {},
        create: {
          name: 'admin'
        }
      });
      
      await prisma.user_roles.create({
        data: {
          user_id: defaultUser.id,
          role_id: 1
        }
      });
    } else {
      console.log('✅ 系统中已有用户，无需创建默认用户');
    }
  } catch (error) {
    console.error('❌ 创建默认系统用户失败:', error);
  }
}

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
app.use('/api/suites', suiteRoutes(suiteExecutionService)); // 注意路径修正

// 🔥 新增: 报告API路由
app.get('/api/reports/:runId', async (req, res) => {
  try {
    const runId = req.params.runId;
    
    // 先检查是否为测试套件运行ID
    const suiteRun = suiteExecutionService.getSuiteRun(runId);
    
    if (suiteRun) {
      // 尝试从数据库查询报告
      let reportData: any = null;
      
      try {
        reportData = await prisma.reports.findFirst({
          where: {
            run_id: {
              equals: Number(suiteRun.suiteId) // 尝试匹配suite_id
            }
          },
          include: {
            test_runs: true
          }
        });
      } catch (dbError) {
        console.warn('从数据库获取报告数据失败，将使用内存数据:', dbError);
      }
      
      // 无论是否在数据库找到记录，都返回可用的报告数据
      res.json({ 
        success: true, 
        data: {
          generatedAt: new Date(),
          summary: {
            totalCases: suiteRun.totalCases,
            passedCases: suiteRun.passedCases,
            failedCases: suiteRun.failedCases,
            duration: suiteRun.duration || '0s',
            passRate: suiteRun.totalCases > 0 
              ? Math.round((suiteRun.passedCases / suiteRun.totalCases) * 100) 
              : 0,
            status: suiteRun.status
          },
          suiteRun,
          // 如果数据库有数据，附加进来
          dbReport: reportData || null
        }
      });
    } else {
      // 如果不是套件ID，尝试作为单个测试用例处理
      const testRun = testExecutionService.getTestRun(runId);
      
      if (testRun) {
        res.json({
          success: true,
          data: {
            generatedAt: new Date(),
            testRun,
            summary: {
              status: testRun.status,
              duration: testRun.finishedAt 
                ? `${Math.round((testRun.finishedAt.getTime() - testRun.startedAt.getTime()) / 1000)}s`
                : '进行中...'
            }
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: '找不到指定的测试报告'
        });
      }
    }
  } catch (error) {
    console.error('获取测试报告失败:', error);
    res.status(500).json({
      success: false,
      error: `获取测试报告失败: ${error.message}`
    });
  }
});

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
server.listen(PORT, async () => {
  console.log(`🚀 服务器已启动，正在监听端口 ${PORT}`);
  console.log(`WebSocket 服务器已准备就绪`);
  
  // 确保默认系统用户存在
  await ensureDefaultUser();
  
  // 初始化定时任务
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