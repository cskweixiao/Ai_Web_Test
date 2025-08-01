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
import { screenshotRoutes } from './routes/screenshots.js';
import { configRoutes } from './routes/config.js';
import { AITestParser } from './services/aiParser.js';
import { PlaywrightMcpClient } from './services/mcpClient.js';
import { ScreenshotService } from './services/screenshotService.js';
import { PrismaClient } from '../src/generated/prisma/index.js';
import crypto from 'crypto';
import { testRunStore } from '../lib/TestRunStore.js';
import fetch from 'node-fetch';
import axios from 'axios';
import os from 'os';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// 🔥 新增：日志收集器
const logFile = path.join(process.cwd(), 'debug-execution.log');
function setupLogCollection() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // 清空之前的日志
  fs.writeFileSync(logFile, `=== 测试执行日志 ${new Date().toISOString()} ===\n`);
  
  // 拦截console输出
  console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    fs.appendFileSync(logFile, `[${timestamp}] LOG: ${message}\n`);
    originalLog(...args);
  };
  
  console.error = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    fs.appendFileSync(logFile, `[${timestamp}] ERROR: ${message}\n`);
    originalError(...args);
  };
  
  console.warn = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    fs.appendFileSync(logFile, `[${timestamp}] WARN: ${message}\n`);
    originalWarn(...args);
  };
  
  console.log('📝 日志收集已启用，日志文件:', logFile);
}

// 启用日志收集
setupLogCollection();

// 创建HTTP服务器
const server = createServer(app);

// 初始化WebSocket服务器
const wss = new WebSocketServer({ server });
const wsManager = new WebSocketManager(wss);

// 初始化Playwright客户端
console.log('🔧 开始初始化MCP客户端...');
const mcpClient = new PlaywrightMcpClient();
console.log('✅ MCP客户端初始化完成');

// 初始化AI解析器（传入MCP客户端）
console.log('🔧 开始初始化AI解析器...');
const aiParser = new AITestParser(mcpClient);
console.log('✅ AI解析器初始化完成');

// 初始化截图服务
console.log('🔧 开始初始化截图服务...');
const screenshotService = new ScreenshotService(prisma);
console.log('✅ 截图服务初始化完成');

// 初始化测试执行服务
console.log('🔧 开始初始化测试执行服务...');
const testExecutionService = new TestExecutionService(wsManager, aiParser, mcpClient, screenshotService);
console.log('✅ 测试执行服务初始化完成');

// 🔥 初始化套件执行服务
console.log('🔧 开始初始化套件执行服务...');
const suiteExecutionService = new SuiteExecutionService(wsManager, testExecutionService);
console.log('✅ 套件执行服务初始化完成');

// 绑定WebSocket通知到Store
testRunStore.onChange((runId, testRun) => {
  wsManager.sendTestStatus(runId, testRun.status, testRun.error);
  // 如果需要，也可以在这里发送详细的 testRun 对象
  // wsManager.broadcast({ type: 'test_update', payload: testRun });
});


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
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://192.168.10.146:5173',
  'http://192.168.10.146:5174',
  'http://192.168.10.146:5175',
  'http://192.168.10.146:5176',
  'http://192.168.10.146:5177',
  'http://192.168.10.146:5178'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 CORS检查 - 请求来源:', origin);
    
    // 允许没有来源的请求 (例如curl, Postman等工具)
    if (!origin) {
      console.log('✅ CORS允许 - 无来源请求');
      return callback(null, true);
    }
    
    // 检查来源是否在白名单中
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS允许 - 白名单匹配:', origin);
      callback(null, true);
    } else {
      // 🔥 增强的局域网IP检测，支持更多网段
      const isLanAccess = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1):\d{4,5}$/.test(origin);
      if (isLanAccess) {
        console.log('✅ CORS允许 - 局域网访问:', origin);
        return callback(null, true);
      }
      
      // 🔥 开发环境下允许所有来源（可选，生产环境请移除）
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CORS允许 - 开发环境:', origin);
        return callback(null, true);
      }
      
      console.log('❌ CORS拒绝 - 未授权来源:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

app.use(express.json());

// API Routes
app.use('/api/tests', testRoutes(testExecutionService));
app.use('/api/suites', suiteRoutes(suiteExecutionService)); // 注意路径修正
app.use('/api', screenshotRoutes(screenshotService)); // 截图API路由
app.use('/api/config', configRoutes); // 配置API路由

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
              duration: testRun.endedAt 
                ? `${Math.round((testRun.endedAt.getTime() - testRun.startedAt.getTime()) / 1000)}s`
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

// 全局错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('未处理的错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// Start Server
async function startServer() {
  try {
    // 确保数据库和用户已设置
    await ensureDefaultUser();

    // 🔥 新增：初始化配置数据
    try {
      const { initializeConfig } = await import('../scripts/init-config.js');
      await initializeConfig();
    } catch (configError) {
      console.warn('⚠️ 配置初始化失败，将使用默认配置:', configError);
    }

    // 设置定时清理任务
    console.log('🔧 准备设置定时清理任务...');
    setupCleanupTasks();
    console.log('✅ 定时清理任务设置完成');

    console.log('🔧 准备启动HTTP服务器...');
    server.listen(PORT, () => {
      console.log('✅ HTTP服务器监听回调被调用');
      logServerInfo();
    });
    console.log('🔧 server.listen() 调用完成');
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

async function logServerInfo() {
  console.log('✅ 服务器已启动');

  // 获取内外网IP地址
  const networkInterfaces = os.networkInterfaces();
  let localIp = '';
  for (const name of Object.keys(networkInterfaces)) {
    const netInterface = networkInterfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        // 跳过非IPv4和内部地址
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
    }
    if (localIp) break;
  }

  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
    const publicIp = response.data.ip;
    console.log('-------------------------------------------------');
    console.log(`🚀 服务正在运行:`);
    console.log(`   - 本地访问: http://localhost:${PORT}`);
    if (localIp) {
      console.log(`   - 内网访问: http://${localIp}:${PORT}`);
    }
    console.log(`   - 公网访问: http://${publicIp}:${PORT}`);
    console.log('-------------------------------------------------');
  } catch (error) {
    console.log('-------------------------------------------------');
    console.log(`🚀 服务正在运行:`);
    console.log(`   - 本地访问: http://localhost:${PORT}`);
    if (localIp) {
      console.log(`   - 内网访问: http://${localIp}:${PORT}`);
    }
    console.log('   - 公网IP: 获取失败 (网络连接问题)');
    console.log('-------------------------------------------------');
  }
}

console.log('🚀 准备调用startServer()函数...');
startServer();

process.on('SIGINT', () => {
  console.log('🔌 正在关闭服务器...');
  wsManager.shutdown();
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

export default app; 