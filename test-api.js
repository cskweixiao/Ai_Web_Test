// 简单的API测试脚本
const http = require('http');

console.log('🧪 测试后端API接口...\n');

// 测试健康检查接口
function testHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('✅ Health check成功:', res.statusCode);
        console.log('   响应:', data);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.error('❌ Health check失败:', err.message);
      reject(err);
    });

    req.end();
  });
}

// 测试获取测试用例接口
function testGetCases() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/tests/cases',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('✅ 获取测试用例成功:', res.statusCode);
        console.log('   响应:', data);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.error('❌ 获取测试用例失败:', err.message);
      reject(err);
    });

    req.end();
  });
}

// 测试创建测试用例接口
function testCreateCase() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name: 'API测试用例',
      description: '通过Node.js脚本创建的测试用例',
      priority: 'high',
      status: 'active',
      tags: ['API', '测试', 'Node.js']
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/tests/cases',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('✅ 创建测试用例成功:', res.statusCode);
        console.log('   响应:', data);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.error('❌ 创建测试用例失败:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// 执行所有测试
async function runTests() {
  try {
    await testHealth();
    console.log();
    
    await testGetCases();
    console.log();
    
    await testCreateCase();
    console.log();
    
    console.log('🎉 所有API测试完成！');
    console.log('📝 现在您可以在浏览器中访问: http://localhost:5173');
    console.log('🎯 尝试创建和运行测试用例，应该可以启动Chrome浏览器了！');
    
  } catch (error) {
    console.error('💥 测试失败:', error.message);
    console.log('🔧 请检查后端服务是否正常运行在端口3001');
  }
}

runTests(); 