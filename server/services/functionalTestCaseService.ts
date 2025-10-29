import { PrismaClient } from '../../src/generated/prisma/index.js';
import { DatabaseService } from './databaseService.js';

/**
 * 列表查询参数
 */
export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  tag?: string;
  priority?: string;
  status?: string;
  system?: string;
  module?: string;
  source?: string;
  userDepartment?: string;
  isSuperAdmin?: boolean;
}

/**
 * 批量保存参数
 */
export interface BatchSaveParams {
  testCases: any[];
  aiSessionId: string;
  userId: number;
}

/**
 * 功能测试用例服务
 * 提供功能测试用例的CRUD操作
 */
export class FunctionalTestCaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient();
  }

  /**
   * 获取功能测试用例列表（分页）
   */
  async getList(params: ListParams) {
    const {
      page,
      pageSize,
      search,
      tag,
      priority,
      status,
      system,
      module,
      source,
      userDepartment,
      isSuperAdmin
    } = params;

    // 构建查询条件
    const where: any = {};

    // 搜索条件
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    // 筛选条件
    if (system) where.system = system;
    if (module) where.module = module;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (source) where.source = source;

    // 标签筛选
    if (tag) {
      where.tags = { contains: tag };
    }

    // 数据隔离：非超级管理员只能看到本部门数据
    if (!isSuperAdmin && userDepartment) {
      where.users = { department: userDepartment };
    }

    try {
      console.log('📊 查询条件:', JSON.stringify(where, null, 2));
      console.log('👤 用户信息 - 部门:', userDepartment, '超级管理员:', isSuperAdmin);

      // 分页查询
      const [data, total] = await Promise.all([
        this.prisma.functional_test_cases.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { created_at: 'desc' },
          include: {
            users: {
              select: {
                username: true,
                department: true,
                account_name: true
              }
            }
          }
        }),
        this.prisma.functional_test_cases.count({ where })
      ]);

      console.log(`✅ 查询结果: 找到 ${total} 条记录，返回 ${data.length} 条`);
      return { data, total };
    } catch (error: any) {
      console.error('❌ 查询功能测试用例失败:', error);
      throw new Error(`查询功能测试用例失败: ${error.message}`);
    }
  }

  /**
   * 批量保存测试用例
   */
  async batchSave(params: BatchSaveParams) {
    const { testCases, aiSessionId, userId } = params;

    console.log(`📦 开始批量保存 ${testCases.length} 个功能测试用例`);
    console.log(`📝 会话ID: ${aiSessionId}, 用户ID: ${userId}`);
    console.log(`📄 第一个用例示例:`, JSON.stringify(testCases[0], null, 2));

    try {
      // 使用事务确保数据一致性
      const result = await this.prisma.$transaction(async (tx) => {
        // 批量插入测试用例
        const savedCases = await tx.functional_test_cases.createMany({
          data: testCases.map(tc => ({
            name: tc.name,
            description: tc.description || '',
            steps: tc.steps || '',
            assertions: tc.assertions || '',
            system: tc.system,
            module: tc.module,
            priority: tc.priority || 'medium',
            tags: Array.isArray(tc.tags) ? tc.tags.join(',') : tc.tags || '',
            status: 'PUBLISHED',
            source: 'AI_GENERATED',
            ai_session_id: aiSessionId,
            creator_id: userId,
            test_type: tc.testType,
            preconditions: tc.preconditions,
            test_data: tc.testData
          })),
          skipDuplicates: true
        });

        // 更新会话统计
        await tx.ai_generation_sessions.update({
          where: { id: aiSessionId },
          data: { total_saved: savedCases.count }
        });

        return savedCases;
      });

      console.log(`✅ 成功保存 ${result.count} 个功能测试用例`);
      return result;
    } catch (error: any) {
      console.error('❌ 批量保存失败:', error);
      throw new Error(`批量保存失败: ${error.message}`);
    }
  }

  /**
   * 获取测试用例详情
   */
  async getById(id: number) {
    try {
      return await this.prisma.functional_test_cases.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              username: true,
              account_name: true,
              department: true
            }
          }
        }
      });
    } catch (error: any) {
      console.error('❌ 查询测试用例详情失败:', error);
      throw new Error(`查询测试用例详情失败: ${error.message}`);
    }
  }

  /**
   * 更新测试用例
   */
  async update(id: number, data: any) {
    console.log(`📝 更新功能测试用例 ID: ${id}`);

    try {
      return await this.prisma.functional_test_cases.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          steps: data.steps,
          assertions: data.assertions,
          system: data.system,
          module: data.module,
          priority: data.priority,
          tags: data.tags,
          test_type: data.testType,
          preconditions: data.preconditions,
          test_data: data.testData,
          updated_at: new Date()
        }
      });
    } catch (error: any) {
      console.error('❌ 更新测试用例失败:', error);
      throw new Error(`更新测试用例失败: ${error.message}`);
    }
  }

  /**
   * 删除测试用例
   */
  async delete(id: number) {
    console.log(`🗑️  删除功能测试用例 ID: ${id}`);

    try {
      return await this.prisma.functional_test_cases.delete({
        where: { id }
      });
    } catch (error: any) {
      console.error('❌ 删除测试用例失败:', error);
      throw new Error(`删除测试用例失败: ${error.message}`);
    }
  }
}

// 导出单例
export const functionalTestCaseService = new FunctionalTestCaseService();
