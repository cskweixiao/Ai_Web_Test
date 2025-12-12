import { PrismaClient } from '../../src/generated/prisma/index.js';
import { DatabaseService } from './databaseService.js';

/**
 * 需求文档列表查询参数
 */
export interface RequirementDocListParams {
  page: number;
  pageSize: number;
  search?: string;
  projectId?: number;
  projectVersionId?: number;
  module?: string;
  status?: string;
  creatorId?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * 创建需求文档参数
 */
export interface CreateRequirementDocParams {
  title: string;
  content: string;
  summary?: string;
  sourceFilename?: string;
  aiSessionId?: string;
  projectId?: number;
  projectVersionId?: number;
  creatorId: number;
  scenarioCount?: number;
  system?: string;  // 🆕 系统名称
  module?: string;  // 🆕 模块名称
}

/**
 * 更新需求文档参数
 */
export interface UpdateRequirementDocParams {
  title?: string;
  content?: string;
  summary?: string;
  projectId?: number;
  projectVersionId?: number;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  system?: string;  // 🆕 系统名称
  module?: string;  // 🆕 模块名称
}

/**
 * 需求文档服务
 */
export class RequirementDocService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient();
  }

  /**
   * 获取需求文档列表（分页）
   */
  async getList(params: RequirementDocListParams) {
    const { page, pageSize, search, projectId, projectVersionId, module, status, creatorId, startDate, endDate } = params;

    const where: any = {};
    
    // 搜索条件
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { summary: { contains: search } },
        { source_filename: { contains: search } }
      ];
    }

    // 筛选条件
    if (projectId) where.project_id = projectId;
    if (projectVersionId) where.project_version_id = projectVersionId;
    if (module) where.module = { contains: module };
    if (status) where.status = status;
    if (creatorId) where.creator_id = creatorId;
    
    // 时间范围筛选
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    // 默认不显示已删除的
    if (!status) {
      where.status = { not: 'DELETED' };
    }

    try {
      const [documents, total] = await Promise.all([
        this.prisma.requirement_documents.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { created_at: 'desc' },
          include: {
            users: {
              select: { id: true, username: true }
            },
            project: {
              select: { id: true, name: true }
            },
            project_version: {
              select: { id: true, version_name: true, version_code: true }
            },
            _count: {
              select: { test_cases: true }
            }
          }
        }),
        this.prisma.requirement_documents.count({ where })
      ]);

      return {
        data: documents.map(doc => ({
          ...doc,
          test_case_count: doc._count.test_cases
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error: any) {
      console.error('❌ 获取需求文档列表失败:', error);
      throw new Error(`获取需求文档列表失败: ${error.message}`);
    }
  }

  /**
   * 获取需求文档详情
   */
  async getById(id: number) {
    try {
      const document = await this.prisma.requirement_documents.findUnique({
        where: { id },
        include: {
          users: {
            select: { id: true, username: true }
          },
          project: {
            select: { id: true, name: true }
          },
          project_version: {
            select: { id: true, version_name: true, version_code: true }
          },
          test_cases: {
            select: {
              id: true,
              name: true,
              section_name: true,
              test_point_name: true,
              priority: true,
              status: true,
              source: true,
              created_at: true
            },
            orderBy: { created_at: 'desc' }
          }
        }
      });

      return document;
    } catch (error: any) {
      console.error('❌ 获取需求文档详情失败:', error);
      throw new Error(`获取需求文档详情失败: ${error.message}`);
    }
  }

  /**
   * 创建需求文档
   */
  async create(params: CreateRequirementDocParams) {
    const {
      title,
      content,
      summary,
      sourceFilename,
      aiSessionId,
      projectId,
      projectVersionId,
      creatorId,
      scenarioCount,
      system,
      module
    } = params;

    try {
      const document = await this.prisma.requirement_documents.create({
        data: {
          title,
          content,
          summary,
          source_filename: sourceFilename,
          ai_session_id: aiSessionId,
          project_id: projectId,
          project_version_id: projectVersionId,
          creator_id: creatorId,
          scenario_count: scenarioCount || 0,
          system,  // 🆕 保存系统名称
          module,  // 🆕 保存模块名称
          status: 'ACTIVE'
        },
        include: {
          users: {
            select: { id: true, username: true }
          }
        }
      });

      console.log(`✅ 需求文档创建成功: ${document.id} - ${title}`);
      return document;
    } catch (error: any) {
      console.error('❌ 创建需求文档失败:', error);
      throw new Error(`创建需求文档失败: ${error.message}`);
    }
  }

  /**
   * 更新需求文档
   */
  async update(id: number, params: UpdateRequirementDocParams) {
    try {
      const updateData: any = {};
      
      if (params.title !== undefined) updateData.title = params.title;
      if (params.content !== undefined) updateData.content = params.content;
      if (params.summary !== undefined) updateData.summary = params.summary;
      if (params.projectId !== undefined) updateData.project_id = params.projectId;
      if (params.projectVersionId !== undefined) updateData.project_version_id = params.projectVersionId;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.system !== undefined) updateData.system = params.system;  // 🆕 更新系统名称
      if (params.module !== undefined) updateData.module = params.module;  // 🆕 更新模块名称

      console.log('📝 [后端服务] 准备更新需求文档，updateData:', updateData);

      const document = await this.prisma.requirement_documents.update({
        where: { id },
        data: updateData,
        include: {
          users: {
            select: { id: true, username: true }
          }
        }
      });

      console.log(`✅ 需求文档更新成功: ${document.id}, system: ${document.system}, module: ${document.module}`);
      return document;
    } catch (error: any) {
      console.error('❌ 更新需求文档失败:', error);
      throw new Error(`更新需求文档失败: ${error.message}`);
    }
  }

  /**
   * 删除需求文档（软删除）
   */
  async delete(id: number) {
    try {
      const document = await this.prisma.requirement_documents.update({
        where: { id },
        data: { status: 'DELETED' }
      });

      console.log(`✅ 需求文档删除成功: ${document.id}`);
      return document;
    } catch (error: any) {
      console.error('❌ 删除需求文档失败:', error);
      throw new Error(`删除需求文档失败: ${error.message}`);
    }
  }

  /**
   * 归档需求文档
   */
  async archive(id: number) {
    try {
      const document = await this.prisma.requirement_documents.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      });

      console.log(`✅ 需求文档归档成功: ${document.id}`);
      return document;
    } catch (error: any) {
      console.error('❌ 归档需求文档失败:', error);
      throw new Error(`归档需求文档失败: ${error.message}`);
    }
  }

  /**
   * 恢复需求文档
   */
  async restore(id: number) {
    try {
      const document = await this.prisma.requirement_documents.update({
        where: { id },
        data: { status: 'ACTIVE' }
      });

      console.log(`✅ 需求文档恢复成功: ${document.id}`);
      return document;
    } catch (error: any) {
      console.error('❌ 恢复需求文档失败:', error);
      throw new Error(`恢复需求文档失败: ${error.message}`);
    }
  }

  /**
   * 更新关联用例数量
   */
  async updateTestCaseCount(id: number) {
    try {
      const count = await this.prisma.functional_test_cases.count({
        where: { requirement_doc_id: id }
      });

      await this.prisma.requirement_documents.update({
        where: { id },
        data: { test_case_count: count }
      });

      return count;
    } catch (error: any) {
      console.error('❌ 更新用例数量失败:', error);
      throw new Error(`更新用例数量失败: ${error.message}`);
    }
  }

  /**
   * 获取需求文档的关联用例
   */
  async getTestCases(id: number, page: number = 1, pageSize: number = 20) {
    try {
      const [testCases, total] = await Promise.all([
        this.prisma.functional_test_cases.findMany({
          where: { requirement_doc_id: id },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { created_at: 'desc' },
          include: {
            users: {
              select: { id: true, username: true }
            }
          }
        }),
        this.prisma.functional_test_cases.count({
          where: { requirement_doc_id: id }
        })
      ]);

      return {
        data: testCases,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error: any) {
      console.error('❌ 获取关联用例失败:', error);
      throw new Error(`获取关联用例失败: ${error.message}`);
    }
  }
}

