const mysql = require('mysql2/promise');

async function executeSQL() {
  let connection;

  try {
    console.log('🔗 连接到数据库...');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: '172.19.5.222',
      port: 3306,
      user: 'test_flow',
      password: 'test_flow',
      database: 'test_flow'
    });

    console.log('✅ 数据库连接成功');

    const runId = 'd488e657-5c03-40f7-9be7-740544506f76';

    // 插入artifacts记录
    const artifacts = [
      {
        filename: 'd488e657-5c03-40f7-9be7-740544506f76-execution.log',
        type: 'log',
        size: 318906
      },
      {
        filename: 'd488e657-5c03-40f7-9be7-740544506f76-step-1-success-1765277568912.png',
        type: 'screenshot',
        size: 52344
      },
      {
        filename: 'd488e657-5c03-40f7-9be7-740544506f76-step-2-success-1765277589183.png',
        type: 'screenshot',
        size: 50989
      },
      {
        filename: 'd488e657-5c03-40f7-9be7-740544506f76-step-3-success-1765277613541.png',
        type: 'screenshot',
        size: 80450
      },
      {
        filename: 'd488e657-5c03-40f7-9be7-740544506f76-step-final-completed-1765277614129.png',
        type: 'screenshot',
        size: 78423
      }
    ];

    for (const artifact of artifacts) {
      const sql = `INSERT INTO run_artifacts (runId, type, filename, size, createdAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE size=?, createdAt=NOW()`;

      const [result] = await connection.execute(sql, [
        runId,
        artifact.type,
        artifact.filename,
        artifact.size,
        artifact.size
      ]);

      console.log(`✅ 已添加/更新 artifact: ${artifact.filename} (${artifact.type})`);
    }

    console.log('🎉 所有artifacts记录已成功添加到数据库');

  } catch (error) {
    console.error('❌ 执行SQL失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

executeSQL();
