import { Router, Request, Response } from 'express';
import { FunctionalTestCaseService } from '../services/functionalTestCaseService.js';

/**
 * 功能测试用例CRUD路由
 */
export function createFunctionalTestCaseRoutes(): Router {
  const router = Router();

  // 延迟获取服务实例（避免模块加载时初始化）
  const getService = () => new FunctionalTestCaseService();

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
      const userDepartment = req.user?.project;
      const isSuperAdmin = req.user?.isSuperAdmin || false;

      console.log(`📋 查询功能测试用例列表 - 页码: ${page}, 用户部门: ${userDepartment}`);

      const result = await getService().getList({
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
   * GET /api/v1/functional-test-cases/filter-options
   * 🆕 获取筛选选项（动态生成）
   */
  router.get('/filter-options', async (req: Request, res: Response) => {
    try {
      const service = getService();
      const options = await service.getFilterOptions();
      res.json({
        success: true,
        data: options
      });
    } catch (error: any) {
      console.error('获取筛选选项失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/functional-test-cases/project-versions
   * 🆕 根据系统获取项目版本列表
   */
  router.get('/project-versions', async (req: Request, res: Response) => {
    try {
      const { system } = req.query;

      if (!system) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数: system'
        });
      }

      const service = getService();
      const versions = await service.getProjectVersionsBySystem(system as string);
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error: any) {
      console.error('获取项目版本失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/functional-test-cases/scenarios
   * 🆕 根据系统获取测试场景和测试点列表
   */
  router.get('/scenarios', async (req: Request, res: Response) => {
    try {
      const { system } = req.query;

      if (!system) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数: system'
        });
      }

      const service = getService();
      const scenarios = await service.getScenariosBySystem(system as string);
      
      res.json({
        success: true,
        data: scenarios
      });
    } catch (error: any) {
      console.error('获取测试场景失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/functional-test-cases/modules
   * 🆕 根据系统获取模块列表
   */
  router.get('/modules', async (req: Request, res: Response) => {
    try {
      const { system } = req.query;

      if (!system) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数: system'
        });
      }

      const service = getService();
      const modules = await service.getModulesBySystem(system as string);
      
      res.json({
        success: true,
        data: modules
      });
    } catch (error: any) {
      console.error('获取模块列表失败:', error);
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
        source,
        sectionName,
        createdBy,
        startDate,
        endDate,
        riskLevel,
        projectVersion,  // 🆕 项目版本筛选
        caseType,  // 🆕 用例类型筛选
        executionStatus  // 🆕 执行结果筛选
      } = req.query;

      // 获取用户信息（用于数据隔离）
      const userDepartment = req.user?.project;
      const isSuperAdmin = req.user?.isSuperAdmin || false;

      console.log(`📋 查询功能测试用例平铺列表 - 页码: ${page}, 用户部门: ${userDepartment}, 执行结果: ${executionStatus}`);

      const result = await getService().getFlatList({
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        search: search as string,
        tag: tag as string,
        priority: priority as string,
        status: status as string,
        system: system as string,
        module: module as string,
        source: source as string,
        sectionName: sectionName as string,
        createdBy: createdBy as string,
        startDate: startDate as string,
        endDate: endDate as string,
        riskLevel: riskLevel as string,
        projectVersion: projectVersion as string,  // 🆕 项目版本筛选
        caseType: caseType as string,  // 🆕 用例类型筛选
        executionStatus: executionStatus as string,  // 🆕 执行结果筛选
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

      // 如果没有会话ID，自动生成一个
      const finalSessionId = aiSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未授权'
        });
      }

      console.log(`💾 批量保存 ${testCases.length} 个功能测试用例, sessionId: ${finalSessionId}`);

      const result = await getService().batchSave({
        testCases,
        aiSessionId: finalSessionId,
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
   * POST /api/v1/functional-test-cases/batch-delete
   * 批量删除测试点
   */
  router.post('/batch-delete', async (req: Request, res: Response) => {
    try {
      const { testPointIds } = req.body;

      if (!testPointIds || !Array.isArray(testPointIds) || testPointIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '测试点ID列表不能为空'
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未授权'
        });
      }

      console.log(`🗑️ 批量删除 ${testPointIds.length} 个测试点`);

      const result = await getService().batchDeleteTestPoints(testPointIds);

      res.json({
        success: true,
        data: result,
        message: `成功删除 ${result.deletedCount} 个测试点`
      });
    } catch (error: any) {
      console.error('❌ 批量删除失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/functional-test-cases
   * 手动创建测试用例（含测试点）
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        caseId,               // 用例编号
        name,
        description,
        system,
        module,
        priority,
        status,
        testType,
        caseType,            // 用例类型
        tags,
        preconditions,
        testData,
        sectionName,
        coverageAreas,
        testScenario,        // 测试场景
        scenarioName,        // 场景名称（兼容字段）
        scenarioDescription, // 场景描述
        steps,               // 用例级别测试步骤
        assertions,          // 用例级别预期结果
        expectedResult,      // 预期结果（兼容字段）
        projectVersionId,    // 项目版本ID
        testPoints
      } = req.body;

      // 验证必填字段
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: '测试用例名称不能为空'
        });
      }

      if (!testPoints || !Array.isArray(testPoints) || testPoints.length === 0) {
        return res.status(400).json({
          success: false,
          error: '至少需要一个测试点'
        });
      }

      // 验证每个测试点（支持 testPoint 和 testPointName，统一使用 testPoint）
      for (let i = 0; i < testPoints.length; i++) {
        const point = testPoints[i];
        // 统一字段名称：优先使用 testPoint，如果没有则使用 testPointName（向后兼容）
        const testPointName = point.testPoint || point.testPointName;
        if (!testPointName || !testPointName.trim()) {
          return res.status(400).json({
            success: false,
            error: `测试点 ${i + 1} 的名称不能为空`
          });
        }
        if (!point.steps || !point.steps.trim()) {
          return res.status(400).json({
            success: false,
            error: `测试点 ${i + 1} 的测试步骤不能为空`
          });
        }
        if (!point.expectedResult || !point.expectedResult.trim()) {
          return res.status(400).json({
            success: false,
            error: `测试点 ${i + 1} 的预期结果不能为空`
          });
        }
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未授权'
        });
      }

      console.log(`✨ 手动创建测试用例: ${name}, 包含 ${testPoints.length} 个测试点`);

      // 统一测试点字段名称，确保使用 testPoint
      const normalizedTestPoints = testPoints.map((point: any) => ({
        ...point,
        testPoint: point.testPoint || point.testPointName, // 统一使用 testPoint
        testPointName: point.testPoint || point.testPointName // 保留兼容字段
      }));

      const result = await getService().create({
        caseId,              // 用例编号
        name,
        description,
        system,
        module,
        priority,
        status,
        testType,
        caseType,            // 用例类型
        tags,
        preconditions,
        testData,            // 测试数据
        sectionName,
        coverageAreas,
        testScenario: testScenario || '',           // 测试场景
        scenarioName: scenarioName || '',           // 场景名称
        scenarioDescription: scenarioDescription || '', // 场景描述
        steps: steps || '',                         // 用例级别测试步骤
        assertions: assertions || '',               // 用例级别预期结果
        expectedResult: expectedResult || '',       // 预期结果
        projectVersionId,                           // 项目版本ID
        testPoints: normalizedTestPoints
      }, req.user.id);

      res.json({
        success: true,
        data: result,
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

      const testCase = await getService().getById(id);

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

      const testCase = await getService().update(id, req.body);

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

      await getService().delete(id);

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

  /**
   * GET /api/v1/functional-test-cases/test-points/:id
   * 获取测试点详情（含关联用例信息）
   */
  router.get('/test-points/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: '无效的测试点ID'
        });
      }

      console.log(`📋 查询测试点详情，ID: ${id}`);

      const result = await getService().getTestPointById(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: '测试点不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ 查询测试点详情失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/v1/functional-test-cases/test-points/:id
   * 更新测试点
   */
  router.put('/test-points/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: '无效的测试点ID'
        });
      }

      const {
        testPurpose,
        testPointName,
        steps,
        expectedResult,
        riskLevel
      } = req.body;

      // 验证必填字段
      if (!testPointName || !testPointName.trim()) {
        return res.status(400).json({
          success: false,
          error: '测试点名称不能为空'
        });
      }

      if (!steps || !steps.trim()) {
        return res.status(400).json({
          success: false,
          error: '测试步骤不能为空'
        });
      }

      if (!expectedResult || !expectedResult.trim()) {
        return res.status(400).json({
          success: false,
          error: '预期结果不能为空'
        });
      }

      console.log(`📝 更新测试点，ID: ${id}`);

      const result = await getService().updateTestPoint(id, {
        testPurpose,
        testPointName,
        steps,
        expectedResult,
        riskLevel
      });

      res.json({
        success: true,
        data: result,
        message: '测试点更新成功'
      });
    } catch (error: any) {
      console.error('❌ 更新测试点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/analyze-scenarios
   * 阶段1：智能测试场景拆分（新接口）
   */
  router.post('/analyze-scenarios', async (req: Request, res: Response) => {
    try {
      const { requirementDoc, sessionId } = req.body;

      if (!requirementDoc) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数：requirementDoc'
        });
      }

      console.log(`🎯 阶段1：智能测试场景拆分 - sessionId: ${sessionId}`);

      const scenarios = await getService().analyzeTestScenarios(requirementDoc);

      res.json({
        success: true,
        data: {
          scenarios,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 测试场景拆分失败3:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/analyze-modules
   * 阶段1：智能测试模块拆分（兼容性接口，已废弃）
   * @deprecated 使用 /analyze-scenarios 代替
   */
  router.post('/analyze-modules', async (req: Request, res: Response) => {
    try {
      const { requirementDoc, sessionId } = req.body;

      if (!requirementDoc) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数: requirementDoc'
        });
      }

      console.log(`🎯 阶段1：开始测试模块拆分 - sessionId: ${sessionId}`);

      const modules = await getService().analyzeTestModules(requirementDoc); // 兼容性调用

      res.json({
        success: true,
        data: {
          modules, // 保持旧字段名
          scenarios: modules, // 同时返回新字段名
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 测试模块拆分失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/generate-points-for-scenario
   * 阶段2：为测试场景生成测试点（新接口）
   */
  router.post('/generate-points-for-scenario', async (req: Request, res: Response) => {
    try {
      const {
        scenarioId,
        scenarioName,
        scenarioDescription,
        requirementDoc,
        relatedSections,
        sessionId
      } = req.body;

      if (!scenarioId || !scenarioName || !requirementDoc || !relatedSections) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数'
        });
      }

      console.log(`🎯 阶段2：为测试场景 "${scenarioName}" 生成测试点 - sessionId: ${sessionId}`);

      const testPoints = await getService().generateTestPointsForScenario(
        scenarioId,
        scenarioName,
        scenarioDescription,
        requirementDoc,
        relatedSections
      );

      res.json({
        success: true,
        data: {
          testPoints,
          scenarioId,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 生成测试点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/generate-purposes
   * 阶段2：生成测试目的（兼容性接口，已废弃）
   * @deprecated 使用 /generate-points-for-scenario 代替
   */
  router.post('/generate-purposes', async (req: Request, res: Response) => {
    try {
      const { moduleId, moduleName, moduleDescription, requirementDoc, relatedSections, sessionId } = req.body;

      if (!moduleId || !moduleName || !requirementDoc || !relatedSections) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数'
        });
      }

      console.log(`🎯 阶段2：为模块 "${moduleName}" 生成测试目的 - sessionId: ${sessionId}`);

      const purposes = await getService().generateTestPurposes( // 兼容性调用
        moduleId,
        moduleName,
        moduleDescription,
        requirementDoc,
        relatedSections
      );

      res.json({
        success: true,
        data: {
          purposes, // 保持旧字段名
          moduleId,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 生成测试目的失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/generate-test-case-for-point
   * 阶段3：为单个测试点生成测试用例（新接口）
   */
  router.post('/generate-test-case-for-point', async (req: Request, res: Response) => {
    try {
      const {
        testPoint,
        scenarioId,
        scenarioName,
        scenarioDescription,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections,
        sessionId
      } = req.body;

      if (!testPoint || !scenarioId || !scenarioName) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数: testPoint, scenarioId, scenarioName 为必填'
        });
      }

      console.log(`🎯 阶段3：为测试点 "${testPoint.testPoint}" 生成测试用例 - sessionId: ${sessionId}`);

      const result = await getService().generateTestCaseForTestPoint(
        testPoint,
        scenarioId,
        scenarioName,
        scenarioDescription,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections
      );

      res.json({
        success: true,
        data: {
          testCases: result.validCases, // 有效用例（保持兼容）
          filteredCases: result.filteredCases, // 🆕 被过滤的用例
          totalGenerated: result.totalGenerated, // 🆕 AI生成总数
          validCount: result.validCount, // 🆕 有效数量
          filteredCount: result.filteredCount, // 🆕 被过滤数量
          testPointId: testPoint.id || testPoint.testPoint,
          scenarioId,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 生成测试用例失败3:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/generate-test-case
   * 阶段3：生成测试用例（兼容性接口）
   * @deprecated 使用 /generate-test-case-for-point 代替
   */
  router.post('/generate-test-case', async (req: Request, res: Response) => {
    try {
      const {
        scenarioId,
        scenarioName,
        scenarioDescription,
        testPoints,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections,
        sessionId
      } = req.body;

      if (!scenarioId || !scenarioName || !testPoints || !systemName || !moduleName || !relatedSections) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数'
        });
      }

      console.log(`🎯 阶段3：为测试场景 "${scenarioName}" 生成测试用例 - sessionId: ${sessionId}`);

      const testCase = await getService().generateTestCase(
        scenarioId,
        scenarioName,
        scenarioDescription,
        testPoints,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections
      );

      res.json({
        success: true,
        data: {
          testCase,
          scenarioId,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 生成测试用例失败4:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/generate-points
   * 阶段3：生成测试点（兼容性接口，已废弃）
   * @deprecated 使用 /generate-test-case 代替
   */
  router.post('/generate-points', async (req: Request, res: Response) => {
    try {
      const {
        purposeId,
        purposeName,
        purposeDescription,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections,
        sessionId
      } = req.body;

      if (!purposeId || !purposeName || !requirementDoc || !systemName || !moduleName || !relatedSections) {
        return res.status(400).json({
          success: false,
          error: '缺少必填参数'
        });
      }

      console.log(`🎯 阶段3：为测试目的 "${purposeName}" 生成测试点 - sessionId: ${sessionId}`);

      const testCase = await getService().generateTestPoints( // 兼容性调用
        purposeId,
        purposeName,
        purposeDescription,
        requirementDoc,
        systemName,
        moduleName,
        relatedSections
      );

      res.json({
        success: true,
        data: {
          testCase,
          purposeId,
          sessionId
        }
      });
    } catch (error: any) {
      console.error('❌ 生成测试点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 POST /api/v1/functional-test-cases/:id/execute
   * 保存功能测试用例执行结果
   */
  router.post('/:id/execute', async (req: Request, res: Response) => {
    try {
      const testCaseId = parseInt(req.params.id);

      if (isNaN(testCaseId)) {
        return res.status(400).json({
          success: false,
          error: '无效的测试用例ID'
        });
      }

      const {
        testCaseName,
        finalResult,
        actualResult,
        comments,
        durationMs,
        stepResults,
        totalSteps,
        completedSteps,
        passedSteps,
        failedSteps,
        blockedSteps,
        screenshots,
        attachments,
        metadata
      } = req.body;

      // 验证必填字段
      if (!finalResult || !['pass', 'fail', 'block'].includes(finalResult)) {
        return res.status(400).json({
          success: false,
          error: '最终结果必填，且必须为 pass、fail 或 block'
        });
      }

      if (!actualResult || !actualResult.trim()) {
        return res.status(400).json({
          success: false,
          error: '实际结果总结不能为空'
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '未授权'
        });
      }

      console.log(`💾 保存测试用例执行结果 - 用例ID: ${testCaseId}, 执行者: ${req.user.username}`);

      const result = await getService().saveExecutionResult({
        testCaseId,
        testCaseName: testCaseName || `测试用例-${testCaseId}`,
        finalResult,
        actualResult,
        comments,
        durationMs: durationMs || 0,
        executorId: req.user.id,
        executorDepartment: req.user.project,
        stepResults,
        totalSteps,
        completedSteps,
        passedSteps,
        failedSteps,
        blockedSteps,
        screenshots,
        attachments,
        metadata
      });

      res.json({
        success: true,
        data: result,
        message: '测试结果已保存'
      });
    } catch (error: any) {
      console.error('❌ 保存执行结果失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 GET /api/v1/functional-test-cases/:id/executions
   * 获取测试用例的执行历史
   */
  router.get('/:id/executions', async (req: Request, res: Response) => {
    try {
      const testCaseId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string || '10');

      if (isNaN(testCaseId)) {
        return res.status(400).json({
          success: false,
          error: '无效的测试用例ID'
        });
      }

      console.log(`📋 获取测试用例执行历史 - 用例ID: ${testCaseId}`);

      const executions = await getService().getExecutionHistory(testCaseId, limit);

      res.json({
        success: true,
        data: executions
      });
    } catch (error: any) {
      console.error('❌ 获取执行历史失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 🆕 GET /api/v1/functional-test-cases/executions/:executionId
   * 获取单个执行记录详情
   */
  router.get('/executions/:executionId', async (req: Request, res: Response) => {
    try {
      const executionId = req.params.executionId;

      console.log(`📋 获取执行记录详情 - 执行ID: ${executionId}`);

      const execution = await getService().getExecutionById(executionId);

      if (!execution) {
        return res.status(404).json({
          success: false,
          error: '执行记录不存在'
        });
      }

      res.json({
        success: true,
        data: execution
      });
    } catch (error: any) {
      console.error('❌ 获取执行记录详情失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
