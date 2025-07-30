const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkTestCase() {
  try {
    const testCases = await prisma.test_cases.findMany();
    console.log('Test cases found:', testCases.length);
    
    testCases.forEach((tc, index) => {
      console.log('\nTest Case ' + (index + 1) + ':');
      console.log('ID:', tc.id);
      console.log('Title:', tc.title);
      console.log('Steps (raw):', tc.steps);
      
      if (typeof tc.steps === 'string') {
        try {
          const parsed = JSON.parse(tc.steps);
          console.log('Steps (parsed):', parsed);
          console.log('Steps content:', parsed.steps);
          console.log('Steps lines:', parsed.steps ? parsed.steps.split('\n').filter(l => l.trim()) : []);
        } catch (e) {
          console.log('Steps (as text):', tc.steps);
          console.log('Steps lines:', tc.steps.split('\n').filter(l => l.trim()));
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestCase();
