import { Router, Request, Response } from 'express';
import { SuiteExecutionService } from '../services/suiteExecution.js';

export function suiteRoutes(suiteExecutionService: SuiteExecutionService): Router {
  const router = Router();

  // 获取所有测试套件
  router.get('/', async (req: Request, res: Response) => {
    try {
      const suites = await suiteExecutionService.getAllTestSuites();
      res.json({ success: true, data: suites });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 创建测试套件
  router.post('/', async (req: Request, res: Response) => {
    try {
      const newSuite = await suiteExecutionService.createTestSuite(req.body);
      res.json({ success: true, data: newSuite });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 更新测试套件
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const updatedSuite = await suiteExecutionService.updateTestSuite(parseInt(req.params.id), req.body);
      if (updatedSuite) {
        res.json({ success: true, data: updatedSuite });
      } else {
        res.status(404).json({ success: false, error: 'Suite not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 删除测试套件
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const success = await suiteExecutionService.deleteTestSuite(parseInt(req.params.id));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: 'Suite not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 执行测试套件
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { suiteId, environment, executionMode, concurrency, continueOnFailure } = req.body;
      
      // 构造执行选项对象
      const options = {
        environment,
        executionMode,
        concurrency,
        continueOnFailure
      };
      
      const runId = await suiteExecutionService.runSuite(suiteId, options);
      res.json({ success: true, runId });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
} 