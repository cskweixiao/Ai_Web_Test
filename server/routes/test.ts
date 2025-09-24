import { Router, Request, Response } from 'express';
import { TestExecutionService } from '../services/testExecution.js';

export function testRoutes(testExecutionService: TestExecutionService): Router {
  const router = Router();

  // 获取所有测试用例（支持分页和过滤）
  router.get('/cases', async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        pageSize = '10',
        search = '',
        tag = '',
        priority = '',
        status = '',
        system = ''
      } = req.query;

      const pageNum = parseInt(page as string);
      const sizePer = parseInt(pageSize as string);

      // 获取过滤后的测试用例
      const result = await testExecutionService.getTestCasesPaginated({
        page: pageNum,
        pageSize: sizePer,
        search: search as string,
        tag: tag as string,
        priority: priority as string,
        status: status as string,
        system: system as string
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: pageNum,
          pageSize: sizePer,
          total: result.total,
          totalPages: Math.ceil(result.total / sizePer)
        }
      });
    } catch (error: any) {
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

  // AI解析器配置管理
  router.post('/ai-parser/reload-config', async (req: Request, res: Response) => {
    try {
      await testExecutionService.reloadAIParserConfiguration();
      
      const status = testExecutionService.getAIParserStatus();
      
      res.json({
        success: true,
        message: 'AI解析器配置已重新加载',
        data: {
          modelInfo: status.modelInfo,
          isConfigManagerMode: status.isConfigManagerMode,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: `重新加载AI解析器配置失败: ${error.message}`
      });
    }
  });

  // 获取AI解析器状态
  router.get('/ai-parser/status', async (req: Request, res: Response) => {
    try {
      const status = testExecutionService.getAIParserStatus();
      
      res.json({
        success: true,
        data: {
          ...status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: `获取AI解析器状态失败: ${error.message}`
      });
    }
  });

  // 🔥 添加：测试用例执行 - 兼容前端路径
  router.post('/cases/execute', async (req: Request, res: Response) => {
    try {
      const { caseId, testCaseId, environment = 'staging' } = req.body;
      const actualCaseId = caseId || testCaseId;

      if (!actualCaseId) {
        return res.status(400).json({
          success: false,
          error: '缺少 caseId 或 testCaseId 参数'
        });
      }

      const runId = await testExecutionService.runTest(actualCaseId, environment);

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

  // 🔥 更新：创建测试用例API
  router.post('/cases', async (req: Request, res: Response) => {
    try {
      // The body now aligns with the conceptual TestCase interface
      const testCaseData = req.body;

      if (!testCaseData.name || !testCaseData.steps) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数：name 和 steps'
        });
      }

      const newTestCase = await testExecutionService.addTestCase(testCaseData);

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

  // 🔥 更新：更新测试用例API
  router.put('/cases/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const testCaseData = req.body;

      const updatedTestCase = await testExecutionService.updateTestCase(parseInt(id), testCaseData);

      if (!updatedTestCase) {
        return res.status(404).json({
          success: false,
          error: '测试用例不存在或更新失败'
        });
      }

      res.json({
        success: true,
        data: updatedTestCase,
        message: '测试用例更新成功'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 🔥 更新：删除测试用例API
  router.delete('/cases/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = await testExecutionService.deleteTestCase(parseInt(id));

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