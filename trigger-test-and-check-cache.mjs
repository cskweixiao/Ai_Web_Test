/**
 * 触发测试并检查缓存的完整脚本 (ES Module版本)
 */

import http from 'http';

const API_BASE = 'http://localhost:3001/api';

// Helper function for HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('\n🚀 开始测试缓存功能...\n');

  // Step 1: 登录
  console.log('📝 Step 1: 登录系统');
  const loginRes = await request('POST', '/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  
  if (!loginRes.success) {
    console.error('❌ 登录失败:', loginRes.message);
    return;
  }
  
  console.log('✅ 登录成功');
  const token = loginRes.token;

  // Step 2: 触发测试执行 (假设测试用例ID为47)
  console.log('\n📝 Step 2: 触发测试执行 (测试用例 #47)');
  const runRes = await request('POST', `/cases/47/run?env=staging`, { token });
  
  if (!runRes.success && !runRes.runId) {
    console.error('❌ 触发测试失败:', runRes);
    return;
  }
  
  const runId = runRes.runId || runRes.data?.runId;
  console.log(`✅ 测试已触发, runId: ${runId}`);

  // Step 3: 等待测试完成
  console.log('\n📝 Step 3: 等待测试执行完成...');
  let completed = false;
  let attempts = 0;
  const maxAttempts = 90; // 最多等待90秒

  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;

    try {
      const statusRes = await request('GET', `/runs/${runId}`);
      if (statusRes.success && statusRes.data) {
        const status = statusRes.data.status;
        process.stdout.write(`\r   ⏳ 状态: ${status.padEnd(15)} (${attempts}s)`);
        
        if (status === 'completed' || status === 'failed') {
          completed = true;
          console.log(`\n✅ 测试执行完成: ${status}`);
        }
      }
    } catch (e) {
      // 忽略错误，继续等待
    }
  }

  if (!completed) {
    console.log('\n⚠️  测试未在预期时间内完成，但继续检查缓存');
  }

  // Step 4: 检查缓存统计
  console.log('\n📝 Step 4: 检查缓存统计\n');
  const cacheRes = await request('GET', '/cache/stats');
  
  if (!cacheRes.success) {
    console.error('❌ 获取缓存统计失败:', cacheRes.error);
    return;
  }

  const stats = cacheRes.data;
  
  console.log('📊 综合统计:');
  console.log(`   总请求数: ${stats.totalRequests}`);
  console.log(`   缓存命中: ${stats.cacheHits}`);
  console.log(`   缓存未命中: ${stats.cacheMisses}`);
  console.log(`   命中率: ${stats.hitRate}%`);
  console.log(`   状态: ${stats.status}`);
  console.log(`   总缓存元素: ${stats.totalElements}`);
  console.log(`   内存占用: ${stats.memoryUsage}KB`);

  console.log('\n💰 节省估算:');
  console.log(`   节省AI调用: ${stats.estimatedSavings.apiCalls} 次`);
  console.log(`   节省成本: ${stats.estimatedSavings.cost}`);
  console.log(`   节省时间: ${stats.estimatedSavings.time}`);

  console.log('\n📈 详细分类:\n');
  
  const breakdown = stats.breakdown;
  console.log('  🔹 元素缓存 (elementCache):');
  console.log(`     请求: ${breakdown.element.requests}`);
  console.log(`     命中: ${breakdown.element.hits}`);
  console.log(`     未命中: ${breakdown.element.misses}`);
  console.log(`     命中率: ${breakdown.element.hitRate}%`);

  console.log('\n  🔹 操作缓存 (operationCache):');
  console.log(`     请求: ${breakdown.operation.requests}`);
  console.log(`     命中: ${breakdown.operation.hits}`);
  console.log(`     未命中: ${breakdown.operation.misses}`);
  console.log(`     命中率: ${breakdown.operation.hitRate}%`);

  console.log('\n  🔹 断言缓存 (assertionCache):');
  console.log(`     请求: ${breakdown.assertion.requests}`);
  console.log(`     命中: ${breakdown.assertion.hits}`);
  console.log(`     未命中: ${breakdown.assertion.misses}`);
  console.log(`     命中率: ${breakdown.assertion.hitRate}%`);

  console.log('\n✅ 测试完成！\n');

  // 判断是否成功
  if (stats.totalRequests > 0) {
    console.log('🎉 缓存数据已正常收集！');
  } else {
    console.log('⚠️  缓存数据仍为空，可能原因：');
    console.log('   1. 测试执行未完成');
    console.log('   2. 测试执行过程中没有使用AI解析');
    console.log('   3. 缓存统计代码存在问题');
  }
}

main().catch(console.error);

