import express, { Request, Response } from 'express';
import * as systemService from '../services/systemService';

const router = express.Router();

/**
 * GET /api/v1/systems
 * 获取系统列表（支持分页、搜索、筛选）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      search = '',
      status
    } = req.query;

    const result = await systemService.getSystems({
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      search: search as string,
      status: status as 'active' | 'inactive' | undefined
    });

    res.json(result);
  } catch (error) {
    console.error('获取系统列表失败:', error);
    res.status(500).json({
      error: '获取系统列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * GET /api/v1/systems/active
 * 获取所有启用的系统（用于下拉选择）
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const systems = await systemService.getActiveSystems();
    res.json(systems);
  } catch (error) {
    console.error('获取启用系统列表失败:', error);
    res.status(500).json({
      error: '获取启用系统列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * GET /api/v1/systems/:id
 * 根据ID获取系统
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const system = await systemService.getSystemById(id);

    if (!system) {
      return res.status(404).json({ error: '系统不存在' });
    }

    res.json(system);
  } catch (error) {
    console.error('获取系统详情失败:', error);
    res.status(500).json({
      error: '获取系统详情失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * POST /api/v1/systems
 * 创建系统
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, status, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '系统名称不能为空' });
    }

    const system = await systemService.createSystem({
      name: name.trim(),
      description: description?.trim(),
      status,
      sort_order
    });

    res.status(201).json(system);
  } catch (error) {
    console.error('创建系统失败:', error);

    if (error instanceof Error && error.message === '系统名称已存在') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: '创建系统失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * PUT /api/v1/systems/:id
 * 更新系统
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, status, sort_order } = req.body;

    const updateData: systemService.UpdateSystemInput = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (status !== undefined) updateData.status = status;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const system = await systemService.updateSystem(id, updateData);
    res.json(system);
  } catch (error) {
    console.error('更新系统失败:', error);

    if (error instanceof Error) {
      if (error.message === '系统名称已存在') {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Record to update not found')) {
        return res.status(404).json({ error: '系统不存在' });
      }
    }

    res.status(500).json({
      error: '更新系统失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * DELETE /api/v1/systems/:id
 * 删除系统
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await systemService.deleteSystem(id);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除系统失败:', error);

    if (error instanceof Error) {
      if (error.message === '系统不存在') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('正被') && error.message.includes('引用')) {
        return res.status(400).json({ error: error.message });
      }
    }

    res.status(500).json({
      error: '删除系统失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * PUT /api/v1/systems/batch/order
 * 批量更新系统排序
 */
router.put('/batch/order', async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: '参数格式错误' });
    }

    await systemService.updateSystemsOrder(orders);
    res.json({ message: '排序更新成功' });
  } catch (error) {
    console.error('更新系统排序失败:', error);
    res.status(500).json({
      error: '更新系统排序失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
