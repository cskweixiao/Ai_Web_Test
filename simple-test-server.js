import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 测试路由 - 完全匹配原来的路径
app.get('/api/tests/cases', (req, res) => {
  console.log('收到测试用例请求');
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: '测试用例1',
        steps: '打开百度\n输入搜索内容\n点击搜索按钮',
        assertions: '验证搜索结果显示',
        tags: ['测试', '示例'],
        created: new Date().toISOString(),
        priority: 'medium',
        status: 'active',
        author: 'System'
      }
    ]
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 简单测试服务器已启动: http://localhost:${PORT}`);
  console.log(`   测试API: http://localhost:${PORT}/api/tests/cases`);
});