/**
 * 部署配置文件
 * 定义不同环境的配置参数
 */

const path = require('path');

const config = {
  // 开发环境配置
  development: {
    database: {
      url: process.env.DATABASE_URL || "mysql://root:password@localhost:3306/automation_testing",
      migrationTimeout: 30000,
      backupEnabled: true
    },
    screenshots: {
      directory: process.env.SCREENSHOT_DIR || 'screenshots',
      retentionDays: parseInt(process.env.SCREENSHOT_RETENTION_DAYS) || 30,
      maxFileSize: parseInt(process.env.SCREENSHOT_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
      quality: parseInt(process.env.SCREENSHOT_QUALITY) || 80,
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp']
    },
    server: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost',
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      }
    },
    logging: {
      level: 'debug',
      directory: 'logs',
      maxFiles: 10,
      maxSize: '10m'
    }
  },

  // 测试环境配置
  test: {
    database: {
      url: process.env.TEST_DATABASE_URL || "mysql://root:password@localhost:3306/automation_testing_test",
      migrationTimeout: 15000,
      backupEnabled: false
    },
    screenshots: {
      directory: 'test-screenshots',
      retentionDays: 7,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      quality: 60,
      allowedTypes: ['image/png']
    },
    server: {
      port: 3001,
      host: 'localhost',
      cors: {
        origin: '*',
        credentials: false
      }
    },
    logging: {
      level: 'warn',
      directory: 'test-logs',
      maxFiles: 5,
      maxSize: '5m'
    }
  },

  // 生产环境配置
  production: {
    database: {
      url: process.env.DATABASE_URL,
      migrationTimeout: 60000,
      backupEnabled: true,
      connectionPool: {
        min: 2,
        max: 10
      }
    },
    screenshots: {
      directory: process.env.SCREENSHOT_DIR || '/var/app/screenshots',
      retentionDays: parseInt(process.env.SCREENSHOT_RETENTION_DAYS) || 90,
      maxFileSize: parseInt(process.env.SCREENSHOT_MAX_FILE_SIZE) || 20 * 1024 * 1024, // 20MB
      quality: parseInt(process.env.SCREENSHOT_QUALITY) || 85,
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      cleanup: {
        enabled: true,
        schedule: '0 2 * * *', // 每天凌晨2点
        batchSize: 1000
      }
    },
    server: {
      port: process.env.PORT || 8080,
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
        credentials: true
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 1000 // 限制每个IP 1000次请求
      }
    },
    logging: {
      level: 'info',
      directory: '/var/log/app',
      maxFiles: 30,
      maxSize: '50m'
    },
    monitoring: {
      enabled: true,
      healthCheck: {
        path: '/health',
        interval: 30000
      },
      metrics: {
        enabled: true,
        path: '/metrics'
      }
    }
  }
};

// 获取当前环境配置
function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = config[env];
  
  if (!envConfig) {
    throw new Error(`未知的环境: ${env}`);
  }

  return {
    environment: env,
    ...envConfig
  };
}

// 验证配置
function validateConfig(config) {
  const errors = [];

  // 验证数据库配置
  if (!config.database.url) {
    errors.push('数据库URL未配置');
  }

  // 验证截图目录配置
  if (!config.screenshots.directory) {
    errors.push('截图目录未配置');
  }

  if (config.screenshots.retentionDays < 1) {
    errors.push('截图保留天数必须大于0');
  }

  if (config.screenshots.maxFileSize < 1024) {
    errors.push('最大文件大小必须大于1KB');
  }

  // 验证服务器配置
  if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
    errors.push('服务器端口配置无效');
  }

  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n${errors.join('\n')}`);
  }

  return true;
}

// 创建目录结构
function createDirectories(config) {
  const directories = [
    config.screenshots.directory,
    config.logging.directory,
    'temp',
    'backups'
  ];

  const fs = require('fs');
  
  directories.forEach(dir => {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`创建目录: ${fullPath}`);
    }
  });
}

module.exports = {
  getConfig,
  validateConfig,
  createDirectories,
  environments: Object.keys(config)
};