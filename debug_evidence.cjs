// 调试截图证据保存问题
const fs = require('fs').promises;
const path = require('path');

async function debugEvidenceSaving() {
  const runId = 'd488e657-5c03-40f7-9be7-740544506f76';
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const artifactsDir = path.join(__dirname, 'artifacts', runId);

  console.log('🔍 开始调试截图证据保存问题...');
  console.log(`📁 截图目录: ${screenshotsDir}`);
  console.log(`📁 证据目录: ${artifactsDir}`);

  // 检查截图目录中的文件
  try {
    const screenshotFiles = await fs.readdir(screenshotsDir);
    const runScreenshots = screenshotFiles.filter(file =>
      file.startsWith(runId) && file.endsWith('.png')
    );

    console.log(`📸 找到 ${runScreenshots.length} 个相关截图文件:`);
    runScreenshots.forEach(file => console.log(`  - ${file}`));

    // 检查每个截图文件是否存在
    for (const screenshotFile of runScreenshots) {
      const fullPath = path.join(screenshotsDir, screenshotFile);
      try {
        const stats = await fs.stat(fullPath);
        console.log(`✅ 文件存在: ${screenshotFile} (${stats.size} bytes)`);
      } catch (error) {
        console.log(`❌ 文件不存在: ${screenshotFile} - ${error.message}`);
      }
    }

    // 检查证据目录
    try {
      const artifactFiles = await fs.readdir(artifactsDir);
      console.log(`📂 证据目录中的文件:`);
      artifactFiles.forEach(file => console.log(`  - ${file}`));
    } catch (error) {
      console.log(`❌ 读取证据目录失败: ${error.message}`);
    }

  } catch (error) {
    console.error(`❌ 调试过程中出错: ${error.message}`);
  }
}

debugEvidenceSaving().catch(console.error);
