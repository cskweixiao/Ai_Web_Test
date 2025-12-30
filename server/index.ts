// 🔥 首先加载环境变量（必须在其他导入之前）
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件（从项目根目录）
const envPath = join(__dirname, '../.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn('⚠️ 加载 .env 文件失败:', envResult.error.message);
  console.warn('   尝试加载路径:', envPath);
} else {
  console.log('✅ 环境变量已从 .env 文件加载');
  // 验证关键环境变量
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL 未在 .env 文件中找到');
  } else {
    // 隐藏敏感信息，只显示连接字符串的前部分
    const dbUrl = process.env.DATABASE_URL;
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log('   DATABASE_URL:', maskedUrl);
  }
}

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
// 🔥 新增：AI批量更新相关路由
import { createAiBulkUpdateRoutes, createVersionRoutes } from './routes/aiBulkUpdate.js';
import { createFeatureFlagRoutes, createPublicFeatureFlagRoutes } from './routes/featureFlag.js';
import { createSecurityRoutes } from './routes/security.js';
// 🔥 新增：认证相关路由
import { createAuthRoutes } from './routes/auth.js';
import { createUserRoutes } from './routes/users.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
// 🔥 新增：Dashboard统计路由
import { createDashboardRoutes } from './routes/dashboard.js';
// 🔥 新增：Reports测试报告路由
import { createReportsRoutes } from './routes/reports.js';
// 🔥 新增：功能测试用例相关路由
import { createAxureRoutes } from './routes/axure.js';
import { createFunctionalTestCaseRoutes } from './routes/functionalTestCase.js';
// 🆕 需求文档管理路由
import { createRequirementDocRoutes } from './routes/requirementDoc.js';
// 🔥 新增：系统字典管理路由
import systemsRouter from './routes/systems.js';
// 🔥 新增：知识库管理路由
import knowledgeRouter from './routes/knowledge.js';
// 🔥 新增：测试计划管理路由
import createTestPlanRoutes from './routes/testPlan.js';
// 🔥 新增：初始化功能开关和权限
import { initializeAllFeatureFlags } from './middleware/featureFlag.js';
import { PermissionService } from './middleware/auth.js';
import { AITestParser } from './services/aiParser.js';
import { PlaywrightMcpClient } from './services/mcpClient.js';
import { ScreenshotService } from './services/screenshotService.js';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { DatabaseService } from './services/databaseService.js';
import { modelRegistry } from '../src/services/modelRegistry.js';
import { QueueService } from './services/queueService.js';
import { StreamService } from './services/streamService.js';
import { EvidenceService } from './services/evidenceService.js';
import streamRoutes, { initializeStreamService } from './routes/stream.js';
import evidenceRoutes, { initializeEvidenceService } from './routes/evidence.js';
import queueRoutes, { initializeQueueService } from './routes/queue.js';
// crypto 已移除，不再需要（密码加密改用 bcrypt）
import { testRunStore } from '../lib/TestRunStore.js';
import fetch from 'node-fetch';
import axios from 'axios';
import os from 'os';
import fs from 'fs';
import { getNow } from './utils/timezone.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 🔥 延迟初始化数据库服务（在 startServer 中初始化）
let databaseService: DatabaseService;
let prisma: PrismaClient;

// 🔥 新增：日志收集器
const logFile = path.join(process.cwd(), '/logs/debug-execution.log');

// 🔥 格式化时间为本地时间（YYYY-MM-DD HH:mm:ss.SSS）
function formatLocalTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function setupLogCollection() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // 清空之前的日志
  fs.writeFileSync(logFile, `=== 测试执行日志 ${formatLocalTime()} ===\n`);
  
  // 拦截console输出
  const appendLog = (level: string, args: unknown[]) => {
    const timestamp = formatLocalTime();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    fs.promises.appendFile(logFile, `[${timestamp}] ${level}: ${message}
`).catch(logError => {
      originalError('❌ 日志写入失败:', logError);
    });
  };

  console.log = function(...args) {
    appendLog('LOG', args);
    originalLog(...args);
  };

  console.error = function(...args) {
    appendLog('ERROR', args);
    originalError(...args);
  };

  console.warn = function(...args) {
    appendLog('WARN', args);
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

// 🔥 全局服务变量声明（将在startServer中初始化）
let mcpClient: PlaywrightMcpClient;
let aiParser: AITestParser;
let screenshotService: ScreenshotService;
let testExecutionService: TestExecutionService;
let suiteExecutionService: SuiteExecutionService;
let queueService: QueueService;
let streamService: StreamService;
let evidenceService: EvidenceService;

// 绑定WebSocket通知到Store
testRunStore.onChange((runId, testRun) => {
  wsManager.sendTestStatus(runId, testRun.status, testRun.error);
  // 如果需要，也可以在这里发送详细的 testRun 对象
  // wsManager.broadcast({ type: 'test_update', payload: testRun });
});


// 自动初始化AI配置
async function ensureAIConfiguration() {
  try {
    // 确保 prisma 已初始化
    if (!prisma) {
      throw new Error('Prisma 客户端未初始化');
    }
    
    // 检查数据库中是否存在 app_settings 配置
    const existingSettings = await prisma.settings.findUnique({
      where: { key: 'app_settings' }
    });

    if (!existingSettings) {
      console.log('⚙️ 数据库中未找到AI配置，正在创建默认配置...');

      // 从环境变量构建默认配置（使用正确的 llm 嵌套格式）
      // 获取默认模型的 baseUrl
      const defaultModelId = 'gpt-4o';
      const defaultModel = modelRegistry.getModelById(defaultModelId);
      const defaultBaseUrl = defaultModel?.customBaseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
      
      const defaultSettings = {
        llm: {
          selectedModelId: defaultModelId, // 前端使用的模型ID
          apiKey: process.env.OPENROUTER_API_KEY || '',
          baseUrl: defaultBaseUrl, // 🔥 添加 baseUrl
          customConfig: {
            temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.3'),
            maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '2000')
          }
        },
        system: {
          timeout: 300,
          maxConcurrency: 10,
          logRetentionDays: 90
        }
      };

      if (!defaultSettings.llm.apiKey) {
        console.warn('⚠️ 环境变量 OPENROUTER_API_KEY 未设置，AI功能可能无法正常使用');
      }

      // 保存到数据库
      await prisma.settings.create({
        data: {
          key: 'app_settings',
          value: JSON.stringify(defaultSettings),
          updated_at: getNow()
        }
      });

      console.log('✅ AI配置已自动初始化:', {
        model: defaultSettings.llm.selectedModelId,
        hasApiKey: !!defaultSettings.llm.apiKey,
        temperature: defaultSettings.llm.customConfig.temperature,
        maxTokens: defaultSettings.llm.customConfig.maxTokens
      });
    } else {
      console.log('✅ AI配置已存在于数据库中');

      // 验证配置完整性
      try {
        const settings = JSON.parse(existingSettings.value || '{}');
        console.log('🔍 当前模型配置:', settings);
        
        // 检查配置格式是否正确（是否有 llm 字段）
        if (!settings.llm) {
          console.warn('⚠️ 配置格式不正确，缺少 llm 字段，可能需要迁移');
        } else {
          if (!settings.llm.apiKey) {
            console.warn('⚠️ 数据库中的API Key为空，请通过前端设置页面配置');
          } else {
            console.log(`✅ 当前使用模型: ${settings.llm.selectedModelId || 'default'}`);
          }
        }
      } catch (error) {
        console.error('❌ 解析AI配置失败:', error);
      }
    }
  } catch (error: any) {
    console.error('❌ 初始化AI配置失败:', error.message);
    console.log('💡 AI功能将使用环境变量作为回退配置');
  }
}

// 创建默认系统用户（如果不存在）
async function ensureDefaultUser() {
  try {
    // 确保 prisma 已初始化
    if (!prisma) {
      throw new Error('Prisma 客户端未初始化');
    }
    
    // 🔥 改进：根据用户名判断，而不是用户总数
    const adminUser = await prisma.users.findUnique({
      where: { username: 'admin' }
    });

    if (!adminUser) {
      console.log('🔑 创建默认系统用户...');

      // 🔥 修复：使用 bcrypt 加密密码（与登录验证保持一致）
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.default.hash('admin', 10);

      const defaultUser = await prisma.users.create({
        data: {
          email: 'admin@test.local',
          username: 'admin',
          password_hash: passwordHash,
          account_name: '系统管理员',
          is_super_admin: true,
          created_at: getNow()
        }
      });

      console.log(`✅ 默认系统用户已创建: ID=${defaultUser.id}, Email=${defaultUser.email}`);
      console.log(`   用户名: admin`);
      console.log(`   密码: admin`);
      
      // 🔥 使用权限服务分配管理员角色
      try {
        await PermissionService.assignDefaultRole(defaultUser.id, 'admin');
        console.log(`✅ 为默认用户分配管理员角色完成`);
      } catch (roleError) {
        console.warn('⚠️ 分配管理员角色失败，将在后续初始化中处理:', roleError);
      }
    } else {
      console.log('✅ 默认管理员用户已存在，无需创建');
      
      // 🔥 检查并修复现有用户的密码哈希（如果使用的是旧版 SHA256）
      await fixExistingUserPasswords();
    }
  } catch (error) {
    console.error('❌ 创建默认系统用户失败:', error);
  }
}

// 🔥 新增：修复现有用户的密码哈希（从 SHA256 迁移到 bcrypt）
async function fixExistingUserPasswords() {
  try {
    const bcrypt = await import('bcrypt');
    
    // 查找所有用户
    const users = await prisma.users.findMany({
      select: { id: true, username: true, password_hash: true }
    });
    
    for (const user of users) {
      // 检查密码哈希格式：bcrypt 哈希以 $2a$, $2b$, $2y$ 开头，长度为 60
      const isBcryptHash = user.password_hash.startsWith('$2') && user.password_hash.length === 60;
      
      if (!isBcryptHash) {
        console.log(`🔄 检测到用户 "${user.username}" 使用旧版密码哈希，正在更新为 bcrypt...`);
        
        // 如果是默认用户（admin 或 system），直接更新密码
        // 否则需要用户重新设置密码（这里我们只处理默认用户）
        if (user.username === 'admin' || user.username === 'system') {
          const newPasswordHash = await bcrypt.default.hash('admin', 10);
          await prisma.users.update({
            where: { id: user.id },
            data: { password_hash: newPasswordHash }
          });
          console.log(`✅ 用户 "${user.username}" 的密码已更新为 bcrypt 哈希`);
        } else {
          console.warn(`⚠️ 用户 "${user.username}" 使用旧版密码哈希，请手动重置密码`);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 修复用户密码哈希失败:', error);
  }
}

// Middleware
// 🔥 从环境变量读取前端端口，支持多个端口
const frontendPort = process.env.VITE_PORT || '5173';
const frontendPorts = [frontendPort, '5174', '5175', '5176', '5177', '5178'];
const allowedOrigins = [
  'http://localhost:3000',
  ...frontendPorts.map(port => `http://localhost:${port}`),
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
      const isLanAccess = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1):\d{4,5}$/.test(origin);
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// 🔥 优化：明确配置JSON中间件支持UTF-8编码和合适的大小限制
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json',
  verify: (req, res, buf, encoding) => {
    // 确保接收的数据使用UTF-8编码
    if (encoding !== 'utf8' && encoding !== 'utf-8') {
      const err = new Error('仅支持UTF-8编码的JSON数据');
      (err as any).status = 400;
      throw err;
    }
  }
}));

// 🔥 优化：设置默认字符编码
app.use((req, res, next) => {
  req.setEncoding && req.setEncoding('utf8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 🔥 API路由将在startServer函数中注册，因为服务需要先初始化
// 注意：/api/reports/:runId 路由已移到 startServer 函数内部，在 createReportsRoutes 之后注册

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

// 🔥 404处理移到了startServer函数中，确保在API路由注册后执行

// Start Server
async function startServer() {
  try {
    // 🔥 检查 DATABASE_URL 环境变量
    if (!process.env.DATABASE_URL) {
      console.error('❌ 错误：DATABASE_URL 环境变量未设置');
      console.error('\n📋 解决方案：');
      console.error('   1. 创建 .env 文件在项目根目录');
      console.error('   2. 添加 DATABASE_URL 配置，例如：');
      console.error('      DATABASE_URL="mysql://username:password@localhost:3306/ai_web_test"');
      console.error('\n💡 提示：可以参考 docs/CONFIGURATION.md 查看完整配置说明');
      throw new Error('DATABASE_URL 环境变量未设置');
    }

    // 🔥 初始化数据库服务（延迟到环境变量检查后）
    console.log('🗄️ 正在初始化数据库服务...');
    databaseService = DatabaseService.getInstance({
      enableLogging: process.env.NODE_ENV === 'development',
      logLevel: 'error',
      maxConnections: 10
    });
    prisma = databaseService.getClient();
    console.log('✅ 数据库服务初始化完成');

    // 🔥 连接数据库
    console.log('🗄️ 开始连接数据库...');
    await databaseService.connect();

    // 确保数据库和用户已设置
    await ensureDefaultUser();

    // 🔥 新增：初始化权限角色和功能开关
    console.log('🔧 开始初始化权限角色和功能开关...');
    await PermissionService.ensureDefaultRoles();
    await initializeAllFeatureFlags();
    console.log('✅ 权限角色和功能开关初始化完成');

    // 🔥 新增：自动初始化AI配置
    console.log('🤖 开始检查AI配置...');
    await ensureAIConfiguration();
    console.log('✅ AI配置检查完成');

    // 🔥 初始化所有服务
    console.log('⚙️ 开始初始化所有服务...');
    
    // 🔥 Phase 7: 优化浏览器预安装 - 条件性异步执行
    const shouldPreInstallBrowser = process.env.PLAYWRIGHT_PRE_INSTALL_BROWSER !== 'false';
    if (shouldPreInstallBrowser) {
      console.log('🔧 开始浏览器预安装检查 (后台异步)...');
      // 🚀 Phase 7: 异步执行，不阻塞服务器启动
      PlaywrightMcpClient.ensureBrowserInstalled()
        .then(() => console.log('✅ 浏览器预安装检查完成'))
        .catch((error) => console.warn('⚠️ 浏览器预安装检查失败:', error.message));
    } else {
      console.log('⚡ 跳过浏览器预安装检查 (PLAYWRIGHT_PRE_INSTALL_BROWSER=false)');
    }

    // 初始化Playwright客户端
    console.log('🔧 开始初始化MCP客户端...');
    mcpClient = new PlaywrightMcpClient();
    console.log('✅ MCP客户端初始化完成');

    // 初始化AI解析器（传入MCP客户端）
    console.log('🔧 开始初始化AI解析器...');
    aiParser = new AITestParser(mcpClient);
    console.log('✅ AI解析器初始化完成');

    // 初始化截图服务
    console.log('🔧 开始初始化截图服务...');
    screenshotService = new ScreenshotService(prisma);
    console.log('✅ 截图服务初始化完成');

    // 🔥 初始化新增强服务
    console.log('🔧 开始初始化队列服务...');
    queueService = new QueueService({
      maxConcurrency: 6,
      perUserLimit: 2,
      taskTimeout: 600000, // 10分钟
      retryAttempts: 1
    });
    console.log('✅ 队列服务初始化完成');

    console.log('🔧 开始初始化实时流服务...');
    streamService = new StreamService({
      fps: 2,
      jpegQuality: 85,  // 🔥 提高质量：从60提升到85，提供更清晰的画面
      width: 1920,       // 🔥 提高分辨率：从1024提升到1920，支持高清显示
      height: 1080,      // 🔥 提高分辨率：从768提升到1080，支持高清显示
      maskSelectors: []
    });
    console.log('✅ 实时流服务初始化完成');

    console.log('🔧 开始初始化证据服务...');
    // 🔥 从环境变量构建 BASE_URL
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    evidenceService = new EvidenceService(
      prisma,
      path.join(process.cwd(), 'artifacts'),
      baseUrl
    );
    console.log('✅ 证据服务初始化完成');

    // 🔥 初始化测试执行服务（使用数据库服务和新增强服务）
    console.log('🔧 开始初始化测试执行服务...');
    testExecutionService = new TestExecutionService(
      wsManager, 
      aiParser, 
      mcpClient, 
      databaseService, 
      screenshotService,
      queueService,
      streamService,
      evidenceService
    );
    
    // 🔥 将服务挂载到 global，以便 API 路由访问缓存统计
    (global as any).testExecutionService = testExecutionService;
    
    console.log('✅ 测试执行服务初始化完成');

    // 🔥 初始化套件执行服务（使用数据库服务）
    console.log('🔧 开始初始化套件执行服务...');
    suiteExecutionService = new SuiteExecutionService(wsManager, testExecutionService, databaseService);
    console.log('✅ 套件执行服务初始化完成');

    console.log('✅ 所有服务初始化完成');

    // 🔥 注册API路由（现在服务已经初始化完成）
    console.log('🔧 开始注册API路由...');
    
    // 初始化路由服务
    initializeQueueService(queueService);
    initializeStreamService(streamService);
    initializeEvidenceService(evidenceService);

    // 🔥 创建认证中间件
    const { authenticate } = createAuthMiddleware(prisma);

    // 注册所有路由（需要认证的路由使用认证中间件）
    app.use('/api/tests', authenticate, testRoutes(testExecutionService));
    app.use('/api/suites', authenticate, suiteRoutes(suiteExecutionService));
    app.use('/api', screenshotRoutes(screenshotService));
    app.use('/api/config', configRoutes);
    app.use(streamRoutes);
    app.use(evidenceRoutes);
    app.use(queueRoutes);

    // 🔥 新增：认证路由
    console.log('🔧 注册认证路由...');
    app.use('/api/auth', createAuthRoutes(prisma));

    // 🔥 新增：用户管理路由
    console.log('🔧 注册用户管理路由...');
    app.use('/api/users', createUserRoutes(prisma));

    // 🔥 新增：AI批量更新相关路由
    console.log('🔧 注册AI批量更新路由...');
    app.use('/api/v1/ai-bulk', createAiBulkUpdateRoutes(prisma, aiParser, wsManager));
    app.use('/api/testcases', createVersionRoutes(prisma));

    // 🔥 新增：功能开关管理路由
    console.log('🔧 注册功能开关管理路由...');
    app.use('/api/v1/feature-flags', createFeatureFlagRoutes());
    app.use('/api/v1/features', createPublicFeatureFlagRoutes());

    // 🔥 新增：安全监控路由
    console.log('🔧 注册安全监控路由...');
    app.use('/api/v1/security', createSecurityRoutes());

    // 🔥 新增：Dashboard统计路由
    console.log('🔧 注册Dashboard统计路由...');
    app.use('/api/dashboard', authenticate, createDashboardRoutes(prisma));

    // 🔥 新增：Reports测试报告路由
    console.log('🔧 注册Reports测试报告路由...');
    app.use('/api/reports', authenticate, createReportsRoutes(prisma));

    // 🔥 新增: 单个测试报告路由（必须在 createReportsRoutes 之后注册，避免拦截其他路由）
    // GET /api/reports/:runId - 获取单个测试运行或套件的报告
    app.get('/api/reports/:runId', authenticate, async (req, res) => {
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
      } catch (error: any) {
        console.error('获取测试报告失败:', error);
        res.status(500).json({
          success: false,
          error: `获取测试报告失败: ${error.message}`
        });
      }
    });

    // 🔥 新增：功能测试用例相关路由
    console.log('🔧 注册功能测试用例相关路由...');
    app.use('/api/v1/axure', authenticate, createAxureRoutes());
    app.use('/api/v1/functional-test-cases', authenticate, createFunctionalTestCaseRoutes());
    
    // 🆕 需求文档管理路由
    console.log('🔧 注册需求文档管理路由...');
    app.use('/api/v1/requirement-docs', authenticate, createRequirementDocRoutes());

    // 🔥 新增：系统字典管理路由
    console.log('🔧 注册系统字典管理路由...');
    app.use('/api/v1/systems', authenticate, systemsRouter);

    // 🔥 新增：知识库管理路由（移除认证，允许公开搜索）
    console.log('🔧 注册知识库管理路由...');
    app.use('/api/v1/knowledge', knowledgeRouter);

    // 🔥 新增：测试计划管理路由
    console.log('🔧 注册测试计划管理路由...');
    app.use('/api/v1/test-plans', authenticate, createTestPlanRoutes(testExecutionService));

    console.log('✅ API路由注册完成');

    // 🔥 在所有API路由注册完成后，注册catch-all 404处理
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: '接口不存在'
      });
    });
    console.log('✅ 404处理路由已注册');

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
    // 🔥 改进：监听所有网络接口 (0.0.0.0)，允许从局域网和链路本地地址访问
    // 如果只需要本地访问，可以通过环境变量 SERVER_HOST=127.0.0.1 限制
    const host = process.env.SERVER_HOST || '0.0.0.0';
    const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
    
    // 🔥 添加端口占用错误处理
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${portNumber} 已被占用！`);
        console.error('\n💡 解决方案：');
        console.error('   1. 停止其他占用该端口的进程');
        console.error('   2. 或者修改 .env 文件中的 PORT 配置');
        console.error('   3. 使用命令查找占用进程: netstat -ano | findstr :' + portNumber);
        process.exit(1);
      } else {
        console.error('❌ 服务器启动错误:', error);
        process.exit(1);
      }
    });
    
    server.listen(portNumber, host, () => {
      console.log('✅ HTTP服务器监听回调被调用');
      if (host === '0.0.0.0') {
        console.log('   📡 服务器监听所有网络接口，可从局域网访问');
      } else {
        console.log(`   📡 服务器仅监听 ${host}，仅本地访问`);
      }
      logServerInfo();
    });
    console.log('🔧 server.listen() 调用完成');
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    
    // 清理已初始化的资源
    try {
      await databaseService.disconnect();
    } catch (cleanupError) {
      console.error('❌ 清理资源时出错:', cleanupError);
    }
    
    process.exit(1);
  }
}

async function logServerInfo() {
  console.log('✅ 服务器已启动');

  // 🔥 改进：获取所有可用的网络地址（与 Vite 行为一致）
  const networkInterfaces = os.networkInterfaces();
  const networkIps: string[] = [];
  
  for (const name of Object.keys(networkInterfaces)) {
    const netInterface = networkInterfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        // 跳过非IPv4和内部地址（127.0.0.1）
        // 但保留链路本地地址（169.254.x.x）和局域网地址
        if (net.family === 'IPv4' && !net.internal) {
          const ip = net.address;
          // 排除回环地址
          if (ip !== '127.0.0.1' && ip !== '::1') {
            networkIps.push(ip);
          }
        }
      }
    }
  }
  
  // 去重并排序：优先显示局域网地址（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
  const uniqueIps = Array.from(new Set(networkIps));
  const sortedIps = uniqueIps.sort((a, b) => {
    // 优先显示局域网地址
    const isLanA = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(a);
    const isLanB = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(b);
    if (isLanA && !isLanB) return -1;
    if (!isLanA && isLanB) return 1;
    return 0;
  });

  // 🔥 改进：尝试多个公网IP获取服务，提高成功率
  const publicIpServices = [
    { url: 'https://api.ipify.org?format=json', timeout: 5000 },
    { url: 'https://api64.ipify.org?format=json', timeout: 5000 },
    { url: 'https://ifconfig.me/ip', timeout: 5000, isPlainText: true },
    { url: 'https://icanhazip.com', timeout: 5000, isPlainText: true },
    { url: 'https://checkip.amazonaws.com', timeout: 5000, isPlainText: true }
  ];

  let publicIp: string | null = null;
  let lastError: Error | null = null;

  // 依次尝试各个服务
  for (const service of publicIpServices) {
    try {
      if (service.isPlainText) {
        // 纯文本响应
        const response = await axios.get(service.url, { 
          timeout: service.timeout,
          responseType: 'text',
          validateStatus: (status) => status === 200
        });
        publicIp = response.data.trim();
      } else {
        // JSON响应
        const response = await axios.get(service.url, { 
          timeout: service.timeout,
          validateStatus: (status) => status === 200
        });
        publicIp = response.data.ip || response.data.query || response.data;
      }
      
      if (publicIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(publicIp)) {
        // 验证IP格式正确
        break;
      } else {
        publicIp = null;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // 继续尝试下一个服务
      continue;
    }
  }

  // 输出服务器信息
  console.log('-------------------------------------------------');
  console.log(`🚀 服务正在运行:`);
  console.log(`   - 本地访问: http://localhost:${PORT}`);
  
  // 显示所有可用的网络地址（与 Vite 行为一致）
  if (sortedIps.length > 0) {
    // 分离局域网地址和链路本地地址
    const lanIps = sortedIps.filter(ip => /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip));
    const linkLocalIps = sortedIps.filter(ip => /^169\.254\./.test(ip));
    
    if (lanIps.length > 0) {
      if (lanIps.length === 1) {
        console.log(`   - 内网访问: http://${lanIps[0]}:${PORT} (推荐)`);
      } else {
        console.log(`   - 内网访问 (推荐):`);
        lanIps.forEach(ip => {
          console.log(`     • http://${ip}:${PORT}`);
        });
      }
    }
    
    if (linkLocalIps.length > 0) {
      console.log(`   - 链路本地地址 (仅同链路可用):`);
      linkLocalIps.forEach(ip => {
        console.log(`     • http://${ip}:${PORT}`);
      });
    }
  }
  
  if (publicIp) {
    console.log(`   - 公网访问: http://${publicIp}:${PORT}`);
  } else {
    console.log('   - 公网IP: 无法获取');
    if (lastError) {
      console.log(`   - 原因: ${lastError.message || '网络连接问题'}`);
    }
    console.log('   - 提示: 如果服务器在NAT/防火墙后，可能需要配置端口转发');
  }
  console.log('-------------------------------------------------');
}

console.log('🚀 准备调用startServer()函数...');
startServer();

// 🔥 优雅关闭服务器
process.on('SIGINT', async () => {
  console.log('🔌 正在关闭服务器...');
  
  try {
    // 关闭WebSocket连接
    wsManager.shutdown();
    
    // 关闭数据库连接
    console.log('🗄️ 正在关闭数据库连接...');
    await databaseService.disconnect();
    
    // 清理TestRunStore资源
    console.log('🧹 正在清理TestRunStore资源...');
    testRunStore.destroy();
    
    // 关闭HTTP服务器
    server.close(() => {
      console.log('✅ 服务器已完全关闭');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ 关闭服务器时出错:', error);
    process.exit(1);
  }
});

// 处理其他退出信号
process.on('SIGTERM', async () => {
  console.log('📨 收到SIGTERM信号，优雅关闭...');
  process.emit('SIGINT' as any);
});

export default app; 