// 检查系统状态
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载.env文件
dotenv.config();

console.log('🔍 系统状态检查');
console.log('=================');

// 检查环境变量
console.log('\n📋 环境变量检查:');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`PORT: ${process.env.PORT || '3001 (默认)'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || '未设置 (默认为development)'}`);

// 检查文件存在
console.log('\n📋 文件检查:');
const filesToCheck = [
  '.env',
  'package.json',
  'server/index.ts',
  'prisma/schema.prisma'
];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  console.log(`${file}: ${fs.existsSync(filePath) ? '✅ 存在' : '❌ 不存在'}`);
});

// 检查MySQL连接
console.log('\n📋 MySQL连接检查:');
try {
  // 从.env文件中提取MySQL连接信息
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  const dbUrlMatch = envContent.match(/DATABASE_URL="mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^"]+)"/);
  
  if (dbUrlMatch) {
    const [, user, password, host, port, database] = dbUrlMatch;
    console.log(`用户名: ${user}`);
    console.log(`密码: ${'*'.repeat(password.length)}`);
    console.log(`主机: ${host}`);
    console.log(`端口: ${port}`);
    console.log(`数据库: ${database}`);
    
    // 尝试检查MySQL服务是否运行
    try {
      console.log('\n尝试检查MySQL服务状态...');
      const mysqlStatus = execSync('sc query mysql', { encoding: 'utf8' });
      if (mysqlStatus.includes('RUNNING')) {
        console.log('MySQL服务: ✅ 正在运行');
      } else {
        console.log('MySQL服务: ❌ 未运行');
      }
    } catch (error) {
      console.log('MySQL服务: ❓ 无法确定状态');
    }
  } else {
    console.log('❌ 无法从.env文件解析数据库连接信息');
  }
} catch (error) {
  console.error('❌ 检查MySQL连接失败:', error.message);
}

// 检查端口占用
console.log('\n📋 端口占用检查:');
try {
  console.log('检查端口3001...');
  const portCheck = execSync('netstat -ano | findstr :3001', { encoding: 'utf8' });
  if (portCheck.includes('LISTENING')) {
    console.log('端口3001: ❌ 已被占用');
    console.log(portCheck);
  } else {
    console.log('端口3001: ✅ 可用');
  }
} catch (error) {
  console.log('端口3001: ✅ 可用');
}

console.log('\n=================');
console.log('🔍 检查完成');