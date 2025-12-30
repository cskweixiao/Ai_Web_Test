import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FolderKanban, Plus, Edit2, Trash2, X, Save, Search, ArrowLeft, PlusCircle,
  ChevronDown, ChevronRight, GitBranch, Star, Tag, Calendar, MoreHorizontal
} from 'lucide-react';
import { Dropdown, Tooltip, Modal, Input, Switch, DatePicker } from 'antd';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import * as systemService from '../services/systemService';
import type { System, CreateSystemInput, UpdateSystemInput, ProjectVersion, CreateVersionInput, UpdateVersionInput } from '../types/test';
import { showToast } from '../utils/toast';
import { useTabs } from '../contexts/TabContext';

// 项目表单数据
interface ProjectFormData {
  name: string;
  short_name: string;  // 🆕 项目简称
  description: string;
  status: 'active' | 'inactive';
  sort_order: number;
  // 初始版本（新建项目时）
  initial_version_name: string;
  initial_version_code: string;
  initial_version_desc: string;
}

// 版本表单数据
interface VersionFormData {
  version_name: string;
  version_code: string;
  description: string;
  is_main: boolean;
  status: 'active' | 'inactive';
  release_date: string | null;
}

const INITIAL_PROJECT_FORM: ProjectFormData = {
  name: '',
  short_name: '',  // 🆕 项目简称
  description: '',
  status: 'active',
  sort_order: 0,
  initial_version_name: '',
  initial_version_code: '',
  initial_version_desc: ''
};

const INITIAL_VERSION_FORM: VersionFormData = {
  version_name: '',
  version_code: '',
  description: '',
  is_main: false,
  status: 'active',
  release_date: null
};

export default function SystemManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addTab } = useTabs();
  
  // 检查是否有返回路径
  const returnPath = (location.state as any)?.returnPath;
  const returnTitle = (location.state as any)?.returnTitle || '返回';
  
  const [projects, setProjects] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // 展开状态
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  // 项目弹窗状态
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'create' | 'edit'>('create');
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectFormData, setProjectFormData] = useState<ProjectFormData>(INITIAL_PROJECT_FORM);

  // 版本弹窗状态
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionModalMode, setVersionModalMode] = useState<'create' | 'edit'>('create');
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [versionFormData, setVersionFormData] = useState<VersionFormData>(INITIAL_VERSION_FORM);

  // 提交状态
  const [submitting, setSubmitting] = useState(false);

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // 🔥 防止重复加载
  const isFirstRenderRef = useRef(true);
  const loadingRef = useRef(false);

  // 加载项目列表
  const loadProjects = async () => {
    // 🔥 防止重复加载
    if (loadingRef.current) {
      console.log('⚠️ [SystemManagement] 项目列表正在加载中，跳过');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      
      console.log('📤 [SystemManagement] 开始加载项目列表');
      
      const params: any = {
        page: currentPage,
        pageSize,
        search: searchTerm
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await systemService.getSystems(params);
      
      // 为每个项目加载版本
      const projectsWithVersions = await Promise.all(
        response.data.map(async (project) => {
          try {
            const versions = await systemService.getProjectVersions(project.id);
            return { ...project, versions };
          } catch {
            return { ...project, versions: [] };
          }
        })
      );
      
      setProjects(projectsWithVersions);
      setTotalPages(response.totalPages);
      console.log('✅ [SystemManagement] 项目列表加载完成');
    } catch (error: any) {
      showToast.error(error?.message || '加载项目列表失败');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // 🔥 主加载 effect - 只在分页和状态筛选变化时触发
  useEffect(() => {
    loadProjects();
  }, [currentPage, statusFilter]);

  // 🔥 搜索（防抖）- 跳过首次渲染
  useEffect(() => {
    // 跳过首次渲染，避免与上面的 useEffect 重复
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (currentPage === 1) {
        loadProjects();
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 切换展开状态
  const toggleExpand = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  // ==================== 项目操作 ====================

  const openCreateProjectModal = () => {
    setProjectModalMode('create');
    setProjectFormData({
      ...INITIAL_PROJECT_FORM,
      sort_order: projects.length * 10
    });
    setEditingProjectId(null);
    setShowProjectModal(true);
  };

  const openEditProjectModal = (project: System) => {
    setProjectModalMode('edit');
    setProjectFormData({
      name: project.name,
      short_name: project.short_name || '',  // 🆕 项目简称
      description: project.description || '',
      status: project.status,
      sort_order: project.sort_order,
      initial_version_name: '',
      initial_version_code: '',
      initial_version_desc: ''
    });
    setEditingProjectId(project.id);
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setProjectFormData(INITIAL_PROJECT_FORM);
    setEditingProjectId(null);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectFormData.name.trim()) {
      showToast.error('项目名称不能为空');
      return;
    }

    // 新建项目时，必须填写初始版本
    if (projectModalMode === 'create') {
      if (!projectFormData.initial_version_name.trim()) {
        showToast.error('请填写初始版本名称');
        return;
      }
      if (!projectFormData.initial_version_code.trim()) {
        showToast.error('请填写初始版本号');
        return;
      }
    }

    setSubmitting(true);

    try {
      if (projectModalMode === 'create') {
        const input: CreateSystemInput = {
          name: projectFormData.name.trim(),
          short_name: projectFormData.short_name.trim() || undefined,  // 🆕 项目简称
          description: projectFormData.description.trim() || undefined,
          status: projectFormData.status,
          sort_order: projectFormData.sort_order,
          initial_version: {
            version_name: projectFormData.initial_version_name.trim(),
            version_code: projectFormData.initial_version_code.trim(),
            description: projectFormData.initial_version_desc.trim() || undefined,
            is_main: true // 初始版本默认为主线版本
          }
        };
        await systemService.createSystem(input);
        showToast.success('项目创建成功');
      } else if (editingProjectId !== null) {
        const input: UpdateSystemInput = {
          name: projectFormData.name.trim(),
          short_name: projectFormData.short_name.trim() || undefined,  // 🆕 项目简称
          description: projectFormData.description.trim() || undefined,
          status: projectFormData.status,
          sort_order: projectFormData.sort_order
        };
        await systemService.updateSystem(editingProjectId, input);
        showToast.success('项目更新成功');
      }

      closeProjectModal();
      loadProjects();
    } catch (error: any) {
      showToast.error(error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: System) => {
    Modal.confirm({
      title: '删除项目',
      content: (
        <div>
          <p>确定要删除项目 <strong>"{project.name}"</strong> 吗？</p>
          <p className="text-red-500 text-sm mt-2">
            ⚠️ 此操作将同时删除该项目下的所有版本，且无法恢复！
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await systemService.deleteSystem(project.id);
          showToast.success('项目删除成功');
          loadProjects();
        } catch (error: any) {
          showToast.error(error?.message || '删除失败');
        }
      }
    });
  };

  // ==================== 版本操作 ====================

  const openCreateVersionModal = (projectId: number) => {
    setVersionModalMode('create');
    setVersionFormData(INITIAL_VERSION_FORM);
    setCurrentProjectId(projectId);
    setEditingVersionId(null);
    setShowVersionModal(true);
  };

  const openEditVersionModal = (projectId: number, version: ProjectVersion) => {
    setVersionModalMode('edit');
    setVersionFormData({
      version_name: version.version_name,
      version_code: version.version_code,
      description: version.description || '',
      is_main: version.is_main,
      status: version.status,
      release_date: version.release_date || null
    });
    setCurrentProjectId(projectId);
    setEditingVersionId(version.id);
    setShowVersionModal(true);
  };

  const closeVersionModal = () => {
    setShowVersionModal(false);
    setVersionFormData(INITIAL_VERSION_FORM);
    setCurrentProjectId(null);
    setEditingVersionId(null);
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!versionFormData.version_name.trim()) {
      showToast.error('版本名称不能为空');
      return;
    }
    if (!versionFormData.version_code.trim()) {
      showToast.error('版本号不能为空');
      return;
    }
    if (currentProjectId === null) {
      showToast.error('项目ID无效');
      return;
    }

    setSubmitting(true);

    try {
      if (versionModalMode === 'create') {
        const input: CreateVersionInput = {
          project_id: currentProjectId,
          version_name: versionFormData.version_name.trim(),
          version_code: versionFormData.version_code.trim(),
          description: versionFormData.description.trim() || undefined,
          is_main: versionFormData.is_main,
          status: versionFormData.status,
          release_date: versionFormData.release_date || undefined
        };
        await systemService.createProjectVersion(input);
        showToast.success('版本创建成功');
      } else if (editingVersionId !== null) {
        const input: UpdateVersionInput = {
          version_name: versionFormData.version_name.trim(),
          version_code: versionFormData.version_code.trim(),
          description: versionFormData.description.trim() || undefined,
          status: versionFormData.status,
          release_date: versionFormData.release_date || undefined
        };
        await systemService.updateProjectVersion(currentProjectId, editingVersionId, input);
        showToast.success('版本更新成功');
      }

      closeVersionModal();
      loadProjects();
    } catch (error: any) {
      showToast.error(error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetMainVersion = async (projectId: number, versionId: number) => {
    try {
      await systemService.setMainVersion(projectId, versionId);
      showToast.success('已设为主线版本');
      loadProjects();
    } catch (error: any) {
      showToast.error(error?.message || '设置失败');
    }
  };

  const handleDeleteVersion = async (projectId: number, version: ProjectVersion) => {
    if (version.is_main) {
      showToast.error('不能删除主线版本，请先设置其他版本为主线');
      return;
    }

    Modal.confirm({
      title: '删除版本',
      content: `确定要删除版本 "${version.version_name}" 吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await systemService.deleteProjectVersion(projectId, version.id);
          showToast.success('版本删除成功');
          loadProjects();
        } catch (error: any) {
          showToast.error(error?.message || '删除失败');
        }
      }
    });
  };

  // 获取版本操作菜单
  const getVersionMenuItems = (projectId: number, version: ProjectVersion): MenuProps['items'] => [
    {
      key: 'edit',
      label: '编辑版本',
      icon: <Edit2 className="w-4 h-4" />,
      onClick: () => openEditVersionModal(projectId, version)
    },
    {
      key: 'setMain',
      label: '设为主线',
      icon: <Star className="w-4 h-4" />,
      disabled: version.is_main,
      onClick: () => handleSetMainVersion(projectId, version.id)
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除版本',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      disabled: version.is_main,
      onClick: () => handleDeleteVersion(projectId, version)
    }
  ];

  // 处理返回按钮点击
  const handleReturn = () => {
    if (returnPath) {
      // 添加返回页面的tab（如果不存在）
      addTab({
        path: returnPath,
        title: returnTitle,
        icon: <PlusCircle className="h-4 w-4" />
      });
      navigate(returnPath);
    } else {
      // 如果没有返回路径，使用浏览器返回
      navigate(-1);
    }
  };

  return (
    <div className="w-full">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {returnPath && (
            <button
              onClick={handleReturn}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={returnTitle}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <FolderKanban className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
        </div>
        <p className="text-gray-600">管理测试项目及其版本，一个项目可以有多个版本，但只能有一个主线版本</p>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* 搜索框 */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索项目名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg 
                focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                transition-all duration-200"
              />
            </div>
          </div>

          {/* 筛选和操作 */}
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">禁用</option>
            </select>

            <button
              onClick={openCreateProjectModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              新建项目
            </button>
          </div>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            加载中...
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
            <FolderKanban className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">暂无项目数据</p>
            <button
              onClick={openCreateProjectModal}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              创建第一个项目
            </button>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 项目头部 */}
              <div 
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(project.id)}
              >
                <div className="flex items-center gap-4">
                  {/* 展开/收起图标 */}
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    {expandedProjects.has(project.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {/* 项目图标 */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-white" />
                  </div>

                  {/* 项目信息 */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                      {project.short_name && (
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-bold">
                          {project.short_name}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {project.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {project.description || '暂无描述'}
                    </p>
                  </div>
                </div>

                {/* 项目统计与操作 */}
                <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                  {/* 版本数量 */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{project.versions?.length || 0}</div>
                    <div className="text-xs text-gray-500">版本</div>
                  </div>

                  {/* 主线版本 */}
                  <div className="text-center min-w-[80px]">
                    {project.versions?.find(v => v.is_main) ? (
                      <>
                        <div className="text-sm font-semibold text-gray-900">
                          {project.versions.find(v => v.is_main)?.version_code}
                        </div>
                        <div className="text-xs text-gray-500">主线版本</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400">无主线版本</div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Tooltip title="添加版本">
                      <button
                        onClick={() => openCreateVersionModal(project.id)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <GitBranch className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip title="编辑项目">
                      <button
                        onClick={() => openEditProjectModal(project)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip title="删除项目">
                      <button
                        onClick={() => handleDeleteProject(project)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* 版本列表（展开时显示） */}
              {expandedProjects.has(project.id) && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {project.versions && project.versions.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {project.versions.map((version) => (
                        <div 
                          key={version.id}
                          className={`px-6 py-3 flex items-center justify-between hover:bg-white transition-colors ${
                            version.is_main ? 'bg-indigo-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4 pl-10">
                            {/* 版本图标 */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              version.is_main 
                                ? 'bg-indigo-100 text-indigo-600' 
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {version.is_main ? (
                                <Star className="w-4 h-4 fill-current" />
                              ) : (
                                <Tag className="w-4 h-4" />
                              )}
                            </div>

                            {/* 版本信息 */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{version.version_name}</span>
                                <code className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-mono">
                                  {version.version_code}
                                </code>
                                {version.is_main && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                    主线版本
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  version.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {version.status === 'active' ? '启用' : '禁用'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                {version.description && (
                                  <span>{version.description}</span>
                                )}
                                {version.release_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(version.release_date).toLocaleDateString('zh-CN')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 版本操作 */}
                          <Dropdown 
                            menu={{ items: getVersionMenuItems(project.id, version) }}
                            trigger={['click']}
                          >
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </Dropdown>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-400">
                      <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无版本</p>
                      <button
                        onClick={() => openCreateVersionModal(project.id)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm mt-2"
                      >
                        添加第一个版本
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 创建/编辑项目弹窗 */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {projectModalMode === 'create' ? '新建项目' : '编辑项目'}
                </h2>
              </div>
              <button
                onClick={closeProjectModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProjectSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* 项目名称和简称 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    项目名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={projectFormData.name}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="如：电商系统"
                    size="large"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    项目简称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={projectFormData.short_name}
                    onChange={(e) => setProjectFormData(prev => ({ 
                      ...prev, 
                      short_name: e.target.value.toUpperCase()  // 自动转大写
                    }))}
                    placeholder="如：AAS（大写字母）"
                    size="large"
                    maxLength={20}
                  />
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  项目描述
                </label>
                <Input.TextArea
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="项目的详细描述（选填）"
                  rows={3}
                />
              </div>

              {/* 状态和排序 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    状态
                  </label>
                  <select
                    value={projectFormData.status}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    排序号
                  </label>
                  <Input
                    type="number"
                    value={projectFormData.sort_order}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    placeholder="数字越小越靠前"
                    size="large"
                  />
                </div>
              </div>

              {/* 初始版本（仅新建时显示） */}
              {projectModalMode === 'create' && (
                <div className="border-t border-gray-100 pt-5 mt-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-indigo-600" />
                    初始版本（主线版本）
                  </h3>
                  <div className="space-y-4 bg-gray-50 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          版本名称 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={projectFormData.initial_version_name}
                          onChange={(e) => setProjectFormData(prev => ({ ...prev, initial_version_name: e.target.value }))}
                          placeholder="如：主线版本"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          版本号 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={projectFormData.initial_version_code}
                          onChange={(e) => setProjectFormData(prev => ({ ...prev, initial_version_code: e.target.value }))}
                          placeholder="如：v1.0.0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        版本描述
                      </label>
                      <Input.TextArea
                        value={projectFormData.initial_version_desc}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, initial_version_desc: e.target.value }))}
                        placeholder="版本描述（选填）"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 提交按钮 */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeProjectModal}
                  className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 创建/编辑版本弹窗 */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {versionModalMode === 'create' ? '添加版本' : '编辑版本'}
                </h2>
              </div>
              <button
                onClick={closeVersionModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVersionSubmit} className="p-6 space-y-5">
              {/* 版本名称和版本号 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    版本名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={versionFormData.version_name}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, version_name: e.target.value }))}
                    placeholder="如：需求迭代v2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    版本号 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={versionFormData.version_code}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, version_code: e.target.value }))}
                    placeholder="如：v2.0.0"
                  />
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  版本描述
                </label>
                <Input.TextArea
                  value={versionFormData.description}
                  onChange={(e) => setVersionFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="版本的详细描述（选填）"
                  rows={2}
                />
              </div>

              {/* 发布日期和状态 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    发布日期
                  </label>
                  <DatePicker
                    value={versionFormData.release_date ? dayjs(versionFormData.release_date) : null}
                    onChange={(date) => setVersionFormData(prev => ({ 
                      ...prev, 
                      release_date: date ? date.format('YYYY-MM-DD') : null 
                    }))}
                    placeholder="选择日期"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    状态
                  </label>
                  <select
                    value={versionFormData.status}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
              </div>

              {/* 主线版本开关 */}
              {versionModalMode === 'create' && (
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
                  <div>
                    <div className="font-medium text-gray-900">设为主线版本</div>
                    <div className="text-sm text-gray-500">每个项目只能有一个主线版本</div>
                  </div>
                  <Switch
                    checked={versionFormData.is_main}
                    onChange={(checked) => setVersionFormData(prev => ({ ...prev, is_main: checked }))}
                  />
                </div>
              )}

              {/* 提交按钮 */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeVersionModal}
                  className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
