// 创建测试管理员用户
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

async function createTestAdmin() {
  try {
    console.log('创建测试管理员用户...\n');

    // 使用register端点创建用户
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      email: 'admin@test.com',
      username: 'admin',
      password: 'admin123',
      accountName: '系统管理员',
      department: 'IT部门'
    });

    console.log('✓ 用户创建成功:');
    console.log(JSON.stringify(registerRes.data, null, 2));
    console.log('\n现在需要将此用户设置为超级管理员，请使用数据库工具手动修改 is_super_admin 字段为 true');

  } catch (error) {
    if (error.response) {
      console.error('❌ 创建失败:');
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('❌ 错误:', error.message);
    }
    process.exit(1);
  }
}

createTestAdmin();
