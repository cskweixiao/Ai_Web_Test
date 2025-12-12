const fs = require('fs').promises;
const path = require('path');

async function debugAddArtifacts() {
  try {
    console.log('🔍 开始将artifacts文件记录到数据库...');

    const runId = 'd488e657-5c03-40f7-9be7-740544506f76';
    const artifactsDir = path.join(process.cwd(), 'artifacts', runId);

    // 检查artifacts目录中的文件
    const files = await fs.readdir(artifactsDir);
    console.log(`📊 找到 ${files.length} 个artifacts文件:`);
    files.forEach(file => console.log(`  - ${file}`));

    // 这里我们需要手动添加数据库记录
    // 由于Prisma客户端有问题，我们创建一个简单的SQL脚本来插入记录

    console.log('\n📝 请在数据库中执行以下SQL语句来添加artifacts记录:');

    for (const filename of files) {
      const filePath = path.join(artifactsDir, filename);
      const stats = await fs.stat(filePath);

      // 根据文件扩展名确定类型
      let type = 'log';
      if (filename.endsWith('.png')) {
        type = 'screenshot';
      } else if (filename.endsWith('.zip')) {
        type = 'trace';
      } else if (filename.endsWith('.webm') || filename.endsWith('.mp4')) {
        type = 'video';
      }

      const sql = `INSERT INTO run_artifacts (runId, type, filename, size, createdAt) VALUES ('${runId}', '${type}', '${filename}', ${stats.size}, NOW()) ON DUPLICATE KEY UPDATE size=${stats.size}, createdAt=NOW();`;

      console.log(sql);
    }

    console.log('\n✅ SQL语句已生成，请手动执行这些语句将文件记录到数据库中');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugAddArtifacts();
