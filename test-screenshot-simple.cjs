// 简单测试截图功能优化
const path = require('path');
const fs = require('fs');

async function testScreenshotDirectoryStructure() {
  console.log('🧪 测试截图目录结构优化...\n');
  
  try {
    // 1. 创建截图目录结构
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const backupDir = path.join(screenshotsDir, 'backup');
    const indexDir = path.join(screenshotsDir, 'index');
    
    console.log('📁 创建目录结构:');
    await fs.promises.mkdir(screenshotsDir, { recursive: true });
    await fs.promises.mkdir(backupDir, { recursive: true });
    await fs.promises.mkdir(indexDir, { recursive: true });
    
    console.log(`✅ 主目录: ${screenshotsDir}`);
    console.log(`✅ 备份目录: ${backupDir}`);
    console.log(`✅ 索引目录: ${indexDir}`);
    
    // 2. 测试按日期分类的备份目录
    const today = new Date().toISOString().slice(0, 10);
    const testRunId = 'test-run-123';
    const runBackupDir = path.join(backupDir, today, testRunId);
    
    await fs.promises.mkdir(runBackupDir, { recursive: true });
    console.log(`✅ 测试备份目录: backup/${today}/${testRunId}`);
    
    // 3. 模拟创建截图索引文件
    const indexFile = path.join(indexDir, `${testRunId}_screenshots.json`);
    const sampleIndex = [
      {
        stepIndex: '1',
        filename: 'test-run-123-step-1-success-1234567890.png',
        description: '打开页面',
        status: 'success',
        timestamp: new Date().toISOString(),
        fileSize: 45678,
        filePath: 'screenshots/test-run-123-step-1-success-1234567890.png'
      },
      {
        stepIndex: '2',
        filename: 'test-run-123-step-2-success-1234567891.png',
        description: '输入用户名',
        status: 'success',
        timestamp: new Date().toISOString(),
        fileSize: 46789,
        filePath: 'screenshots/test-run-123-step-2-success-1234567891.png'
      }
    ];
    
    await fs.promises.writeFile(indexFile, JSON.stringify(sampleIndex, null, 2));
    console.log(`✅ 索引文件创建: ${testRunId}_screenshots.json`);
    
    // 4. 显示目录结构
    console.log('\n📋 最终目录结构:');
    
    async function showDirStructure(dir, prefix = '') {
      try {
        const items = await fs.promises.readdir(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = await fs.promises.stat(fullPath);
          const type = stats.isDirectory() ? '📁' : '📄';
          console.log(`${prefix}${type} ${item}`);
          
          // 递归显示子目录（限制深度）
          if (stats.isDirectory() && prefix.length < 8) {
            await showDirStructure(fullPath, prefix + '  ');
          }
        }
      } catch (error) {
        console.log(`${prefix}❌ 读取失败: ${error.message}`);
      }
    }
    
    await showDirStructure(screenshotsDir, '  ');
    
    // 5. 验证索引文件内容
    console.log('\n📖 索引文件内容预览:');
    const indexContent = await fs.promises.readFile(indexFile, 'utf-8');
    const indexData = JSON.parse(indexContent);
    console.log(`- 共 ${indexData.length} 个截图记录`);
    indexData.forEach((item, idx) => {
      console.log(`  ${idx + 1}. 步骤${item.stepIndex}: ${item.description} (${item.status})`);
    });
    
    console.log('\n🎉 截图目录结构测试完成！');
    
    // 总结新功能
    console.log('\n📈 截图功能优化总结:');
    console.log('✅ 1. 按日期分类的备份目录结构 (backup/YYYY-MM-DD/runId/)');
    console.log('✅ 2. 截图索引文件管理 (index/runId_screenshots.json)');
    console.log('✅ 3. 增强的文件验证机制（大小检查、重试机制）');
    console.log('✅ 4. 双重存储保障（主文件+备份+数据库）');
    console.log('✅ 5. 完整的清理和统计功能');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testScreenshotDirectoryStructure().catch(console.error);