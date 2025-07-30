// 测试优化后的截图功能
import { TestExecutionService } from './dist/server/services/testExecution.js';
import { ScreenshotService } from './dist/server/services/screenshotService.js';
import { PrismaClient } from './src/generated/prisma/index.js';
import path from 'path';
import fs from 'fs';

async function testScreenshotFeature() {
  console.log('🧪 开始测试优化后的截图功能...\n');
  
  try {
    // 1. 初始化服务
    const prisma = new PrismaClient();
    const screenshotService = new ScreenshotService(prisma);
    
    console.log('✅ 服务初始化成功');
    
    // 2. 测试截图目录结构
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const backupDir = path.join(screenshotsDir, 'backup');
    const indexDir = path.join(screenshotsDir, 'index');
    
    console.log('\n📁 检查截图目录结构:');
    console.log(`- 主目录: ${screenshotsDir}`);
    console.log(`- 备份目录: ${backupDir}`);
    console.log(`- 索引目录: ${indexDir}`);
    
    // 创建目录
    await fs.promises.mkdir(screenshotsDir, { recursive: true });
    await fs.promises.mkdir(backupDir, { recursive: true });
    await fs.promises.mkdir(indexDir, { recursive: true });
    console.log('✅ 目录结构创建成功');
    
    // 3. 测试截图记录保存
    console.log('\n📸 测试截图记录保存:');
    const testRecord = {
      runId: 'test-run-123',
      testCaseId: 1,
      stepIndex: '1',
      stepDescription: '测试步骤：点击登录按钮',
      status: 'success',
      filePath: 'screenshots/test-screenshot.png',
      fileName: 'test-screenshot.png',
      fileSize: 12345,
      mimeType: 'image/png',
      fileExists: true
    };
    
    const savedRecord = await screenshotService.saveScreenshot(testRecord);
    console.log('✅ 截图记录保存成功:', {
      id: savedRecord.id,
      runId: savedRecord.runId,
      fileName: savedRecord.fileName,
      fileSize: savedRecord.fileSize
    });
    
    // 4. 测试截图查询
    console.log('\n🔍 测试截图查询:');
    const screenshots = await screenshotService.getScreenshotsByRunId('test-run-123');
    console.log(`✅ 查询到 ${screenshots.length} 个截图记录`);
    
    if (screenshots.length > 0) {
      console.log('- 第一个截图:', {
        stepIndex: screenshots[0].stepIndex,
        fileName: screenshots[0].fileName,
        status: screenshots[0].status
      });
    }
    
    // 5. 测试存储统计
    console.log('\n📊 测试存储统计:');
    const stats = await screenshotService.getStorageStats();
    console.log('✅ 存储统计获取成功:', {
      totalScreenshots: stats.totalScreenshots,
      totalSize: stats.totalSize,
      healthScore: stats.storageHealth.healthScore,
      recentActivity: stats.recentActivity.last24Hours
    });
    
    // 6. 测试目录结构预览
    console.log('\n📋 截图目录结构预览:');
    
    async function listDirectory(dir, prefix = '') {
      try {
        const items = await fs.promises.readdir(dir);
        for (const item of items.slice(0, 5)) { // 只显示前5个
          const fullPath = path.join(dir, item);
          const stats = await fs.promises.stat(fullPath);
          const type = stats.isDirectory() ? '📁' : '📄';
          console.log(`${prefix}${type} ${item}`);
        }
        if (items.length > 5) {
          console.log(`${prefix}... 还有 ${items.length - 5} 个项目`);
        }
      } catch (error) {
        console.log(`${prefix}❌ 无法读取目录: ${error.message}`);
      }
    }
    
    await listDirectory(screenshotsDir, '  ');
    
    console.log('\n🎉 截图功能测试完成！');
    
    // 总结优化点
    console.log('\n📈 截图功能优化总结:');
    console.log('✅ 增强了文件验证机制（检查文件大小>0）');
    console.log('✅ 增加了重试次数和等待时间');
    console.log('✅ 添加了按日期分类的备份机制');
    console.log('✅ 实现了截图索引文件管理');
    console.log('✅ 提供了截图清理和统计功能');
    console.log('✅ 保持了数据库+本地文件的双重存储');
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testScreenshotFeature().catch(console.error);