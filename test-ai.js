// 创建这个文件来测试AI
import { AITestParser } from './server/services/aiParser.js';

const parser = new AITestParser();

async function testAI() {
  console.log('🧪 测试AI解析...');
  
  const result = await parser.parseTestDescription(
    '打开浏览器 输入www.baidu.com',
    '测试用例'
  );
  
  console.log('结果:', JSON.stringify(result, null, 2));
}

testAI().catch(console.error); 