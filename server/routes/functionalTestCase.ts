import { Router, Request, Response } from 'express';
import { functionalTestCaseService } from '../services/functionalTestCaseService.js';

/**
 * 功能测试用例CRUD路由
 */
export function createFunctionalTestCaseRoutes(): Router {
  const router = Router();

  /**
   * GET /api/v1/functional-test-cases
   * 获取功能测试用例列表（分页）
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        pageSize = '10',
        search,
        tag,
        priority,
        status,
        system,
        module,
        source
      } = req.query;

      // 获取用户信息（用于数据隔离）
      const userDepartment = req.user?.department;
      const isSuperAdmin = req.user?.isSuperAdmin || false;

      console.log(`📋 查询功能测试用例列表 - 页码: ${page}, 用户部门: ${userDepartment}`);

      const result = await functionalTestCaseService.getList({
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        search: search as string,
        tag: tag as string,
        priority: priority as string,
        status: status as string,
        system: system as string,
        module: module as string,
        source: source as string,
        userDepartment,
        isSuperAdmin
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(pageSize as string))
        }
      });
    } catch (error: any) {
      console.error('❌ 查询列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/functional-test-cases/flat
   * 获取功能测试用例平铺列表（以测试点为维度展示）
   */
  router.get('/flat', async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        pageSize = '20',
        search,
        tag,
        priority,
        status,
        system,
        module,
        source
      } = req.query;

      // 获取用户信息（用于数据隔离）
      const userDepartment = req.user?.department;
      const isSuperAdmin = req.user?.isSuperAdmin || false;

      console.log(`📋 查询功能测试用例平铺列表 - 页码: ${page}, 用户部门: ${userDepartment}`);

      const result = await functionalTestCaseService.getFlatList({
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        search: search as string,
        tag: tag as string,
        priority: priority as string,
        status: status as string,
        system: system as string,
        module: module as string,
        source: source as string,
        userDepartment,
        isSuperAdmin
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error('❌ 查询平铺列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/functional-test-cases/batch-save
   * 批量保存测试用例
   */
  router.post('/batch-save', async (req: Request, res: Response) => {
    try {
      const { testCases, aiSessionId } = req.body;

      if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
        return res.status(400).json({
          success: false,
          error: '测试用例列表不能为空'
        });
      }

      if (!aiSessionId) {
        return res.status(400).json({
          success: false,
          error: '缺少会话ID'
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未授权'
        });
      }

      console.log(`💾 批量保存 ${testCases.length} 个功能测试用例`);

      const result = await functionalTestCaseService.batchSave({
        testCases,
        aiSessionId,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: result,
        message: `成功保存 ${result.count} 个测试用例`
      });
    } catch (error: any) {
      console.error('❌ 批量保存失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/functional-test-cases/:id
   * 获取单个测试用例详情
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: '无效的ID'
        });
      }

      const testCase = await functionalTestCaseService.getById(id);

      if (!testCase) {
        return res.status(404).json({
          success: false,
          error: '测试用例不存在'
        });
      }

      res.json({
        success: true,
        data: testCase
      });
    } catch (error: any) {
      console.error('❌ 查询详情失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/v1/functional-test-cases/:id
   * 更新测试用例
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: '无效的ID'
        });
      }

      const testCase = await functionalTestCaseService.update(id, req.body);

      res.json({
        success: true,
        data: testCase,
        message: '更新成功'
      });
    } catch (error: any) {
      console.error('❌ 更新失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/v1/functional-test-cases/:id
   * 删除测试用例
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: '无效的ID'
        });
      }

      await functionalTestCaseService.delete(id);

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error: any) {
      console.error('❌ 删除失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
