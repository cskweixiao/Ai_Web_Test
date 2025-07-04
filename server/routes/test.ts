import { Router, Request, Response } from 'express';
import { TestExecutionService } from '../services/testExecution.js';

export function testRoutes(testExecutionService: TestExecutionService): Router {
  const router = Router();

  // 获取所有测试用例
  router.get('/cases', async (req: Request, res: Response) => {
    try {
      const testCases = testExecutionService.getTestCases();
      res.json({
        success: true,
        data: testCases
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 执行测试用例
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { testCaseId, environment = 'staging' } = req.body;

      if (!testCaseId) {
        return res.status(400).json({
          success: false,
          error: '缺少 testCaseId 参数'
        });
      }

      const runId = await testExecutionService.runTest(testCaseId, environment);

      res.json({
        success: true,
        runId,
        message: '测试已开始执行'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 获取测试运行状态
  router.get('/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const testRun = testExecutionService.getTestRun(runId);

      if (!testRun) {
        return res.status(404).json({
          success: false,
          error: '测试运行不存在'
        });
      }

      res.json({
        success: true,
        data: testRun
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 获取所有测试运行
  router.get('/runs', async (req: Request, res: Response) => {
    try {
      const testRuns = testExecutionService.getAllTestRuns();
      res.json({
        success: true,
        data: testRuns
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 取消测试执行
  router.post('/runs/:runId/cancel', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const success = await testExecutionService.cancelTest(runId);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: '无法取消测试，测试可能已完成或不存在'
        });
      }

      res.json({
        success: true,
        message: '测试已取消'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 🔥 新增：创建测试用例API
  router.post('/cases', async (req: Request, res: Response) => {
    try {
      const { name, steps, assertions, priority, status, tags, author } = req.body;

      if (!name || !steps) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数：name 和 steps'
        });
      }

      // 调用服务类保存测试用例
      const newTestCase = testExecutionService.addTestCase({
        name: name.trim(),
        steps: steps.trim(),
        assertions: assertions?.trim() || '',
        tags: Array.isArray(tags) ? tags : [],
        priority: priority || 'medium',
        status: status || 'draft',
        author: author || '系统'
      });

      console.log('✅ 测试用例创建成功:', newTestCase);

      res.json({
        success: true,
        data: newTestCase,
        message: '测试用例创建成功'
      });
    } catch (error: any) {
      console.error('❌ 创建测试用例失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 🔥 新增：更新测试用例API
  router.put('/cases/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, steps, assertions, tags, priority, status } = req.body;

      const success = testExecutionService.updateTestCase(parseInt(id), {
        name: name?.trim(),
        steps: steps?.trim(),
        assertions: assertions?.trim(),
        tags: Array.isArray(tags) ? tags : undefined,
        priority,
        status
      });

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '测试用例不存在'
        });
      }

      res.json({
        success: true,
        message: '测试用例更新成功'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 🔥 新增：删除测试用例API
  router.delete('/cases/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = testExecutionService.deleteTestCase(parseInt(id));

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '测试用例不存在'
        });
      }

      res.json({
        success: true,
        message: '测试用例删除成功'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
} 