import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Play,
  Edit3,
  Trash2,
  Tag,
  Clock,
  User,
  FileText,
  Code,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Package,
  HelpCircle,
  Bot,
  RotateCcw,
  Table,
  AlignLeft,
  Download,
  Activity,
  StopCircle,
  RefreshCw,
  Filter,
  X,
  LayoutGrid,
  Table2
} from 'lucide-react';
import { clsx } from 'clsx';
import { testService } from '../services/testService';
import * as systemService from '../services/systemService';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import type { TestCase, TestSuite as TestSuiteType, TestStepRow, SystemOption, TestRun } from '../types/test';
import { useNavigate } from 'react-router-dom';
import { Modal, ConfirmModal } from '../components/ui/modal';
import { Modal as AntModal } from 'antd';
import { Button } from '../components/ui/button';
import { showToast } from '../utils/toast';
import { aiBulkUpdateService } from '../services/aiBulkUpdateService';
import { TagInput } from '../components/ui/TagInput';
import { TestCaseTable } from '../components/TestCaseTable';
import { StepTableEditor } from '../components/StepTableEditor';
import { parseStepsText, serializeStepsToText } from '../utils/stepConverter';
import { useAuth } from '../contexts/AuthContext';
import { getCaseTypeInfo, getCaseTypeLabel } from '../utils/caseTypeHelper';
import { FunctionalCaseSelectModal } from '../components/FunctionalCaseSelectModal';
import { TestRuns } from './TestRuns';

// 表单数据接口
interface CreateTestCaseForm {
  name: string;
  preconditions: string;
  testData: string;
  steps: string;
  assertions: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'disabled';
  tags: string;
  system: string;
  module: string;
}

// 🔥 新增：测试套件表单接口
interface CreateTestSuiteForm {
  name: string;
  description: string;
  testCases: number[];
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'disabled';
  tags: string;
  project: string; // 🔥 新增：项目字段
}

export function TestCases() {
  // 🔥 获取当前用户信息
  const { user } = useAuth();

  // 🔥 新增: 导航钩子
  const navigate = useNavigate();

  // 🔥 新增：Tab状态管理
  const [activeTab, setActiveTab] = useState<'cases' | 'suites' | 'runs'>('cases');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('');
  const [runningTestId, setRunningTestId] = useState<number | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [testCasesLoading, setTestCasesLoading] = useState(false);
  
  // 🔥 新增：测试运行记录状态（用于统计执行结果）
  const [testRunsMap, setTestRunsMap] = useState<Map<number, TestRun>>(new Map());
  
  // 🔥 新增：执行配置状态
  const [showExecutionConfig, setShowExecutionConfig] = useState(false);
  const [pendingTestCase, setPendingTestCase] = useState<TestCase | null>(null);
  const [executionConfig, setExecutionConfig] = useState({
    executionEngine: 'mcp' as 'mcp' | 'playwright',
    enableTrace: true,
    enableVideo: true,
    environment: 'staging'
  });

  // 🔥 新增：分页状态管理
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  
  // 🔥 新增：测试套件状态管理
  const [testSuites, setTestSuites] = useState<TestSuiteType[]>([]);
  const [editingTestSuite, setEditingTestSuite] = useState<TestSuiteType | null>(null);
  const [runningSuiteId, setRunningSuiteId] = useState<number | null>(null);
  
  // 🔥 新增：AI批量更新状态管理
  const [aiFeatureAvailable, setAiFeatureAvailable] = useState(false);
  const [checkingFeature, setCheckingFeature] = useState(true);

  // 🔥 新增：系统字典列表
  const [systemOptions, setSystemOptions] = useState<SystemOption[]>([]);

  const [formData, setFormData] = useState<CreateTestCaseForm>({
    name: '',
    preconditions: '',
    testData: '',
    steps: '',
    assertions: '',
    priority: 'medium',
    status: 'active', // 🔥 修改默认状态为启用
    tags: '',
    system: '',
    module: ''
  });

  // 🔥 新增：测试套件表单数据
  const [suiteFormData, setSuiteFormData] = useState<CreateTestSuiteForm>({
    name: '',
    description: '',
    testCases: [],
    priority: 'medium',
    status: 'active', // 🔥 修改默认状态为启用
    tags: '',
    project: '' // 🔥 新增：项目字段
  });
  const [formDirty, setFormDirty] = useState(false);
  const [suiteFormDirty, setSuiteFormDirty] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suiteNameInputRef = useRef<HTMLInputElement>(null);
  const stepsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [stepsTouched, setStepsTouched] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [stepsSoftWrap, setStepsSoftWrap] = useState(true);
  const [suiteNameTouched, setSuiteNameTouched] = useState(false);
  const [suiteCaseSearch, setSuiteCaseSearch] = useState('');
  const [stepsHelpOpen, setStepsHelpOpen] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // 🔥 新增：步骤编辑器模式和结构化数据
  const [stepsEditorMode, setStepsEditorMode] = useState<'text' | 'table'>('table'); // 默认表格模式
  const [stepsData, setStepsData] = useState<TestStepRow[]>([]);

  // 🔥 新增：导入功能用例相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [functionalCases, setFunctionalCases] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFunctionalCases, setSelectedFunctionalCases] = useState<number[]>([]);
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [importPagination, setImportPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  // 🔥 新增：已导入的功能用例ID集合
  const [importedFunctionalCaseIds, setImportedFunctionalCaseIds] = useState<Set<number>>(new Set());

  // 筛选器状态
  const [filterSystem, setFilterSystem] = useState('');
  const [filterProjectVersion, setFilterProjectVersion] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterScenario, setFilterScenario] = useState('');
  const [filterCaseType, setFilterCaseType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  
  // 🔥 新增：加载系统字典列表
  useEffect(() => {
    const loadSystems = async () => {
      try {
        const systems = await systemService.getActiveSystems();
        setSystemOptions(systems);
      } catch (error) {
        console.error('加载系统列表失败:', error);
        showToast.error('加载系统列表失败');
      }
    };
    loadSystems();
  }, []);

  // 🔥 新增：初始化时加载用户偏好的编辑器模式
  useEffect(() => {
    const savedMode = localStorage.getItem('stepsEditorMode') as 'text' | 'table' | null;
    if (savedMode) {
      setStepsEditorMode(savedMode);
    }
  }, []);

  // 🔥 新增：当编辑现有用例时，解析步骤数据
  useEffect(() => {
    if (editingTestCase && showCreateModal) {
      // 如果是表格模式，解析文本为结构化数据
      if (stepsEditorMode === 'table') {
        const parsed = parseStepsText(editingTestCase.steps);
        setStepsData(parsed);
      }
    } else if (!showCreateModal) {
      // 关闭弹窗时清空数据
      setStepsData([]);
    }
  }, [editingTestCase, showCreateModal, stepsEditorMode]);

  // 🔥 新增：检查AI批量更新功能可用性
  const checkAIBulkUpdateAvailability = async () => {
    try {
      setCheckingFeature(true);
      console.log('🔍 [AI_Bulk_Update] 检查功能可用性...');

      // 调用真实的AI服务检查功能可用性
      const available = await aiBulkUpdateService.checkFeatureAvailability();
      setAiFeatureAvailable(available);

      console.log('✅ [AI_Bulk_Update] 功能检查完成，可用状态:', available);
      
    } catch (error) {
      console.error('❌ [AI_Bulk_Update] 检查功能可用性失败:', error);
      setAiFeatureAvailable(false);
    } finally {
      setCheckingFeature(false);
    }
  };

  // 🔥 初始化加载 - 默认加载第一页10条数据
  useEffect(() => {
    // 设置默认分页参数
    setPagination({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    loadTestCases({ page: 1, pageSize: 10, resetPagination: true });
    loadTestSuites();
    loadTestRuns(); // 🔥 加载测试运行记录用于统计
    loadFilterOptions(); // 🔥 加载筛选选项
    checkAIBulkUpdateAvailability();
    
    // 🔥 添加WebSocket连接状态检查
    const initWebSocket = async () => {
      try {
        await testService.initializeWebSocket();
        console.log('✅ WebSocket连接已初始化');
      } catch (error) {
        console.error('❌ WebSocket连接初始化失败:', error);
      }
    };
    
    // 初始化WebSocket
    initWebSocket();
    
    // 设置定期检查WebSocket连接状态
    const wsCheckInterval = setInterval(() => {
      if (!testService.isWebSocketConnected()) {
        console.log('⚠️ WebSocket连接已断开，尝试重连...');
        initWebSocket();
      }
    }, 10000); // 每10秒检查一次
    
    // 🔥 添加状态清理超时机制 - 防止状态永久卡住
    const stateCleanupTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    // 监听 runningTestId 变化，设置清理超时
    if (runningTestId !== null) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ 测试运行状态超时，强制清理');
        setRunningTestId(null);
      }, 10 * 60 * 1000); // 10分钟超时
      stateCleanupTimeouts.push(timeout);
    }
    
    // 监听 runningSuiteId 变化，设置清理超时  
    if (runningSuiteId !== null) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ 套件运行状态超时，强制清理');
        setRunningSuiteId(null);
      }, 15 * 60 * 1000); // 15分钟超时（套件可能运行更久）
      stateCleanupTimeouts.push(timeout);
    }
    
    // 清理函数
    return () => {
      clearInterval(wsCheckInterval);
      stateCleanupTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // 🔥 新增：标签页切换时同步搜索状态
  useEffect(() => {
    if (activeTab === 'suites' && searchTerm !== searchQuery) {
      // 切换到套件标签页时，将 searchTerm 同步到 searchQuery
      setSearchQuery(searchTerm);
    }
  }, [activeTab, searchTerm, searchQuery]);

  // 🔥 新增：当测试用例列表变化时，更新已导入的功能用例ID集合
  useEffect(() => {
    if (testCases.length > 0) {
      updateImportedFunctionalCaseIds();
    }
  }, [testCases]);

  // 🔥 新增：分页加载测试用例
  const loadTestCases = async (params?: {
    page?: number;
    pageSize?: number;
    resetPagination?: boolean;
  }) => {
    try {
      console.log('🔄 [TestCases] 开始重新加载测试用例...');
      setTestCasesLoading(true);
      
      // 🔥 新增：重新加载时清空选择
      setSelectedTestCaseIds([]);

      const currentPage = params?.page ?? pagination.page;
      const currentPageSize = params?.pageSize ?? pagination.pageSize;

      const result = await testService.getTestCasesPaginated({
        page: currentPage,
        pageSize: currentPageSize,
        search: searchTerm, // 🔥 改为使用searchTerm而非searchQuery
        tag: selectedTag,
        priority: selectedPriority,
        status: casesStatusFilter, // 🆕 修复：使用casesStatusFilter而不是空字符串
        system: selectedSystem,
        module: selectedModule, // 🔥 新增：模块筛选参数
        projectVersion: selectedVersion, // 🔥 新增：版本筛选参数
        executionStatus: casesExecutionStatusFilter, // 🆕 执行状态筛选
        executionResult: casesExecutionResultFilter, // 🆕 执行结果筛选
        author: casesAuthorFilter // 🆕 创建者筛选
      });

      console.log('📊 [TestCases] 获取到分页数据:', {
        count: result.data?.length || 0,
        total: result.pagination.total,
        page: result.pagination.page
      });

      // 🔥 调试日志：检查成功率数据
      if (result.data && result.data.length > 0) {
        const sampleCase = result.data[0];
        console.log('📈 [TestCases] 示例测试用例数据:', {
          id: sampleCase.id,
          name: sampleCase.name,
          success_rate: sampleCase.success_rate,
          lastRun: sampleCase.lastRun,
          hasSuccessRate: sampleCase.success_rate !== undefined && sampleCase.success_rate !== null
        });
      }

      setTestCases(result.data || []);

      // 更新分页信息
      if (params?.resetPagination) {
        setPagination({
          page: 1,
          pageSize: currentPageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        });
      } else {
        setPagination({
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        });
      }

      console.log('✅ [TestCases] 测试用例状态已更新');
    } catch (error) {
      console.error('❌ [TestCases] 加载测试用例失败:', error);
      setTestCases([]);
      setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setTestCasesLoading(false);
    }
  };

  // 🔥 新增：加载测试运行记录（用于统计执行结果）
  const loadTestRuns = async () => {
    try {
      console.log('🔄 [TestCases] 开始加载测试运行记录...');
      const runs = await testService.getAllTestRuns({
        sortBy: 'startedAt',
        sortOrder: 'desc'
      });
      
      // 构建Map：testCaseId -> 最后一次TestRun
      const runsMap = new Map<number, TestRun>();
      runs.forEach(run => {
        if (run.testCaseId && !runsMap.has(run.testCaseId)) {
          // 只保存每个测试用例的最后一次运行记录（因为已按时间降序排序）
          runsMap.set(run.testCaseId, run);
        }
      });
      
      setTestRunsMap(runsMap);
      console.log('✅ [TestCases] 测试运行记录已加载，共', runsMap.size, '个用例有执行记录');
    } catch (error) {
      console.error('❌ [TestCases] 加载测试运行记录失败:', error);
      setTestRunsMap(new Map());
    }
  };

  // 🔥 新增：加载测试套件
  const loadTestSuites = async () => {
    try {
      console.log('🔄 [TestCases] 开始重新加载测试套件...');
      setLoading(true);
      const suites = await testService.getTestSuites();
      console.log('📊 [TestCases] 获取到测试套件数量:', suites?.length || 0);
      setTestSuites(suites || []);
      
      // 🔥 提取所有套件标签
      const suiteTags = Array.from(new Set(suites?.flatMap(suite => suite.tags || []).filter((tag): tag is string => tag !== undefined) || []));
      setAllSuiteTags(suiteTags);
      
      console.log('✅ [TestCases] 测试套件状态已更新');
    } catch (error) {
      console.error('❌ [TestCases] 加载测试套件失败:', error);
      setTestSuites([]);
      setAllSuiteTags([]);
    } finally {
      setLoading(false);
    }
  };

  // 可选：创建专用组件
  const CaseTypeBadge: React.FC<{ caseType: string }> = ({ caseType }) => {
    const config = getCaseTypeConfig(caseType);

    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
        style={{
          backgroundColor: config.bg,
          color: config.color
        }}
      >
        {config.text}
      </span>
    );
  };

  // 🔥 新增：加载所有标签和模块选项（独立于分页数据）
  const loadFilterOptions = async () => {
    try {
      // 获取所有用例（不分页）来提取标签和模块
      const result = await testService.getTestCasesPaginated({
        page: 1,
        pageSize: 10000, // 获取所有数据用于提取选项
        search: '',
        tag: '',
        priority: '',
        status: '',
        system: ''
      });
      
      const allCases = result.data || [];
      const tags = Array.from(new Set(allCases.flatMap(tc => tc.tags).filter((tag): tag is string => tag !== undefined)));
      const modules = Array.from(new Set(allCases.map(tc => tc.module).filter((m): m is string => Boolean(m))));
      const authors = Array.from(new Set(allCases.map(tc => tc.author).filter((a): a is string => Boolean(a))));
      // 🔥 注意：版本选项不再从所有用例中提取，而是根据选择的项目动态加载（参考功能用例逻辑）
      
      setAllTags(tags);
      setModuleOptions(modules);
      setCasesFilterOptions({ authors });
      // 版本选项通过 useEffect 根据选择的项目动态加载，不在这里处理
      
      console.log('✅ [TestCases] 筛选选项已加载:', { tags: tags.length, modules: modules.length, authors: authors.length });
    } catch (error) {
      console.error('❌ [TestCases] 加载筛选选项失败:', error);
      showToast.error('加载筛选选项失败');
    }
  };

  // 🔥 新增：从UI测试用例名称中提取功能用例ID
  const extractFunctionalCaseId = (testCaseName: string): number | null => {
    // 匹配格式：[TC_00002] 或 [TC_2]
    const match = testCaseName.match(/\[TC_(\d+)\]/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  };

  // 🔥 新增：根据功能用例ID查找对应的UI测试用例ID
  const findUITestCaseIdByFunctionalId = (functionalCaseId: number): number | null => {
    const uiTestCase = testCases.find(tc => {
      const funcId = extractFunctionalCaseId(tc.name);
      return funcId === functionalCaseId;
    });
    return uiTestCase ? uiTestCase.id : null;
  };

  // 🔥 新增：更新已导入的功能用例ID集合
  const updateImportedFunctionalCaseIds = () => {
    const importedIds = new Set<number>();
    testCases.forEach(tc => {
      const funcCaseId = extractFunctionalCaseId(tc.name);
      if (funcCaseId !== null) {
        importedIds.add(funcCaseId);
      }
    });
    setImportedFunctionalCaseIds(importedIds);
    console.log('🔍 [已导入用例] 更新已导入ID集合:', Array.from(importedIds));
  };

  // 🔥 新增：切换编辑器模式（文本 ↔ 表格）
  const handleToggleEditorMode = () => {
    const newMode = stepsEditorMode === 'text' ? 'table' : 'text';

    // 从文本模式切换到表格模式：解析文本为结构化数据
    if (newMode === 'table') {
      const parsed = parseStepsText(formData.steps);
      setStepsData(parsed);
    }
    // 从表格模式切换到文本模式：序列化结构化数据为文本
    else {
      const serialized = serializeStepsToText(stepsData);
      setFormData(prev => ({ ...prev, steps: serialized }));
    }

    setStepsEditorMode(newMode);
    localStorage.setItem('stepsEditorMode', newMode); // 记住用户偏好
  };

  // 🔥 新增：表格数据变化时同步到文本字段
  const handleStepsDataChange = (newStepsData: TestStepRow[]) => {
    setStepsData(newStepsData);
    // 同步更新文本格式（保持兼容性）
    const serialized = serializeStepsToText(newStepsData);
    setFormData(prev => ({ ...prev, steps: serialized }));
    setFormDirty(true);
  };

  // 🔥 新增：加载功能测试用例列表
  const loadFunctionalCases = async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) => {
    try {
      setImportLoading(true);
      const currentPage = params?.page ?? importPagination.page;
      const currentPageSize = params?.pageSize ?? importPagination.pageSize;
      const searchTerm = params?.search ?? importSearchTerm;

      // 调用API获取功能用例列表
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: currentPageSize.toString(),
        ...(searchTerm && { search: searchTerm })
      });

      // 🔥 修复：使用 flat 接口获取包含步骤和预期结果的平铺列表
      const response = await fetch(`/api/v1/functional-test-cases/flat?${queryParams}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('获取功能用例失败');
      }

      const result = await response.json();
      
      console.log('🔥 [加载功能用例] API响应:', {
        success: result.success,
        dataCount: result.data?.length,
        firstItem: result.data?.[0]
      });
      
      if (result.data && result.data.length > 0) {
        console.log('🔥 [加载功能用例] 第一条数据完整结构:', JSON.stringify(result.data[0], null, 2));
      }
      
      if (result.success) {
        // 🔥 修改：不过滤，显示所有功能用例（包括已导入的）
        const allFunctionalCases = result.data || [];
        const importedCount = allFunctionalCases.filter((fc: any) => 
          importedFunctionalCaseIds.has(fc.id)
        ).length;
        
        console.log('🔥 [加载功能用例] 统计结果:', {
          total: allFunctionalCases.length,
          imported: importedCount,
          unimported: allFunctionalCases.length - importedCount
        });
        
        setFunctionalCases(allFunctionalCases);
        setImportPagination({
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        });
      } else {
        throw new Error(result.error || '获取功能用例失败');
      }
    } catch (error: any) {
      console.error('加载功能测试用例失败:', error);
      showToast.error(`加载功能用例失败: ${error.message}`);
      setFunctionalCases([]);
    } finally {
      setImportLoading(false);
    }
  };

  // 🔥 新增：转化功能用例为UI测试用例
  const convertFunctionalToUICase = (functionalCase: any): any => {
    // 🔥 调试日志：查看功能用例的实际数据结构
    console.log('🔍 [导入功能用例] 原始数据:', functionalCase);
    console.log('  - name:', functionalCase.name);
    console.log('  - preconditions:', functionalCase.preconditions);
    console.log('  - testData:', functionalCase.testData);
    // console.log('  - test_data:', functionalCase.test_data);
    console.log('  - steps:', functionalCase.steps);
    console.log('  - test_point_steps:', functionalCase.test_point_steps);
    console.log('  - expected_result:', functionalCase.expected_result);
    console.log('  - test_point_expected_result:', functionalCase.test_point_expected_result);
    console.log('  - assertions:', functionalCase.assertions);

    // 优先级映射
    const priorityMap: { [key: string]: 'high' | 'medium' | 'low' } = {
      'HIGH': 'high',
      'CRITICAL': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };

    // 状态映射
    const statusMap: { [key: string]: 'active' | 'draft' | 'disabled' } = {
      'PUBLISHED': 'active',
      'DRAFT': 'draft',
      'ARCHIVED': 'disabled',
      'active': 'active',
      'draft': 'draft',
      'disabled': 'disabled'
    };

    // 🔥 处理步骤和预期结果：将每个步骤与对应的预期结果配对
    // 尝试多种可能的字段名
    const rawSteps = functionalCase.test_point_steps || functionalCase.steps || '';
    const rawExpectedResults = functionalCase.test_point_expected_result || functionalCase.expected_result || functionalCase.assertions || '';
    
    console.log('🔍 [导入功能用例] 提取结果:', {
      rawSteps,
      rawExpectedResults
    });
    
    let formattedSteps = '';
    let lastExpectedResult = '';
    
    if (rawSteps && rawExpectedResults) {
      // 按行分割步骤和预期结果
      const stepLines = rawSteps.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const expectedLines = rawExpectedResults.split('\n').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
      
      console.log('🔍 [导入功能用例] 分割后:', {
        stepLines,
        expectedLines,
        stepCount: stepLines.length,
        expectedCount: expectedLines.length
      });
      
      // 将每个步骤与对应的预期结果配对
      const pairedLines: string[] = [];
      for (let i = 0; i < stepLines.length; i++) {
        const step = stepLines[i];
        // 移除步骤前面的序号（如 "1. ", "1、", "1）"等）
        const cleanStep = step.replace(/^\d+[.、)]\s*/, '');
        
        if (i < expectedLines.length) {
          const expected = expectedLines[i];
          // 移除预期结果前面的序号
          const cleanExpected = expected.replace(/^\d+[.、)]\s*/, '');
          pairedLines.push(`${i + 1}. ${cleanStep} -> ${cleanExpected}`);
          
          // 每次都更新，循环结束后 lastExpectedResult 就是最后一个
          lastExpectedResult = cleanExpected;
        } else {
          // 如果预期结果不够，只保留步骤
          pairedLines.push(`${i + 1}. ${cleanStep}`);
        }
      }
      
      formattedSteps = pairedLines.join('\n');
      
      console.log('🔍 [导入功能用例] 配对结果:', {
        pairedLines,
        lastExpectedResult
      });
    } else if (rawSteps) {
      // 只有步骤，没有预期结果
      formattedSteps = rawSteps;
    }

    // 🔥 断言预期使用最后一个步骤的预期结果
    const assertions = lastExpectedResult || rawExpectedResults || functionalCase.assertions || '';
    
    console.log('🔍 [导入功能用例] 最终结果:', {
      formattedSteps,
      assertions,
      lastExpectedResult
    });

      // 🔥 标签处理：添加用例类型的中文标签
      const tagsList = [];
      
      // 先添加用例类型标签（中文）
      if (functionalCase.case_type) {
        const caseTypeInfo = getCaseTypeLabel(functionalCase.case_type);
        tagsList.push(caseTypeInfo); // 使用中文标签（如"冒烟测试"、"全量测试"）
      }
    
    // 再添加原有标签
    // if (functionalCase.tags) {
    //   const originalTags = Array.isArray(functionalCase.tags)
    //     ? functionalCase.tags
    //     : functionalCase.tags.split(',').map((t: string) => t.trim());
    //   tagsList = [...tagsList, ...originalTags];
    // }

    // 🔥 获取版本信息
    const projectVersion = functionalCase.project_version 
      ? (functionalCase.project_version.version_name || functionalCase.project_version.version_code || String(functionalCase.project_version_id))
      : undefined;

    return {
      name: `[TC_${String(functionalCase.id).padStart(5, '0')}] ${functionalCase.name}`,
      preconditions: functionalCase.preconditions || '', // 🔥 前置条件
      testData: functionalCase.testData || functionalCase.test_data || '', // 🔥 测试数据
      steps: formattedSteps,
      assertions: assertions,
      priority: priorityMap[functionalCase.priority] || 'medium',
      status: statusMap[functionalCase.status] || 'active',
      tags: tagsList,
      system: functionalCase.system || '',
      module: functionalCase.module || '',
      projectVersion: projectVersion, // 🔥 新增：所属版本
      department: user?.project || undefined,
      author: user?.accountName || user?.username || user?.email || '未知用户',
      created: new Date().toISOString().split('T')[0],
      lastRun: '',
      success_rate: 0
    };
  };

  // 🔥 新增：批量导入功能用例
  const handleImportFunctionalCases = async () => {
    if (selectedFunctionalCases.length === 0) {
      showToast.warning('请至少选择一个功能用例');
      return;
    }

    try {
      setLoading(true);
      const selectedCases = functionalCases.filter(fc => 
        selectedFunctionalCases.includes(fc.id)
      );

      let createdCount = 0; // 🔥 修改：新建的数量
      let updatedCount = 0; // 🔥 修改：更新的数量
      let failCount = 0;

      for (const functionalCase of selectedCases) {
        try {
          console.log('🔥 [批量导入] 开始转换功能用例:', functionalCase.name);
          console.log('🔥 [批量导入] 功能用例完整数据:', JSON.stringify(functionalCase, null, 2));
          
          const uiCase = convertFunctionalToUICase(functionalCase);
          console.log('🔥 [批量导入] 转换后的UI测试用例:', JSON.stringify(uiCase, null, 2));
          
          // 🔥 修改：检查是否已导入，已导入则更新，未导入则创建
          const existingUITestCaseId = findUITestCaseIdByFunctionalId(functionalCase.id);
          
          if (existingUITestCaseId) {
            // 已导入，执行更新操作
            console.log(`🔄 [批量导入] 功能用例 ${functionalCase.id} 已导入，执行更新操作，UI测试用例ID: ${existingUITestCaseId}`);
            await testService.updateTestCase(existingUITestCaseId, uiCase);
            updatedCount++;
          } else {
            // 未导入，执行创建操作
            console.log(`✨ [批量导入] 功能用例 ${functionalCase.id} 未导入，执行创建操作`);
            await testService.createTestCase(uiCase);
            createdCount++;
            
            // 🔥 新增：创建成功后，将该功能用例ID添加到已导入集合
            importedFunctionalCaseIds.add(functionalCase.id);
          }
        } catch (error) {
          console.error(`导入用例 ${functionalCase.name} 失败:`, error);
          failCount++;
        }
      }

      // 刷新测试用例列表
      await loadTestCases();

      // 关闭弹窗并重置状态
      setShowImportModal(false);
      setSelectedFunctionalCases([]);
      setImportSearchTerm('');

      // 🔥 修改：显示创建、更新、失败的数量
      if (failCount === 0) {
        if (updatedCount === 0) {
          showToast.success(`成功创建 ${createdCount} 个测试用例！`);
        } else if (createdCount === 0) {
          showToast.success(`成功更新 ${updatedCount} 个测试用例！`);
        } else {
          showToast.success(`导入完成：创建 ${createdCount} 个，更新 ${updatedCount} 个`);
        }
      } else {
        if (updatedCount === 0 && createdCount === 0) {
          showToast.error(`导入失败：失败 ${failCount} 个`);
        } else if (updatedCount === 0) {
          showToast.warning(`导入完成：创建 ${createdCount} 个，失败 ${failCount} 个`);
        } else if (createdCount === 0) {
          showToast.warning(`导入完成：更新 ${updatedCount} 个，失败 ${failCount} 个`);
        } else {
          showToast.warning(`导入完成：创建 ${createdCount} 个，更新 ${updatedCount} 个，失败 ${failCount} 个`);
        }
      }
    } catch (error: any) {
      console.error('批量导入失败:', error);
      showToast.error(`批量导入失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestCase = async (keepOpen = false) => {
    // 🔥 防重复点击检查
    if (loading) {
      console.log('⚠️ 操作正在进行中，忽略重复点击');
      return;
    }

    if (!formData.name.trim()) {
      showToast.warning('请输入测试用例名称');
      setNameTouched(true);
      setTimeout(() => nameInputRef.current?.focus(), 0);
      return;
    }
    
    if (!formData.steps.trim()) {
      showToast.warning('请输入测试步骤');
      setStepsTouched(true);
      setTimeout(() => {
        stepsTextareaRef.current?.focus();
        stepsTextareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }

    try {
      setLoading(true);
      
      if (editingTestCase) {
        // 编辑模式
        // 🔥 修复：编辑时也使用当前用户信息作为 author
        const authorValue = user?.accountName || user?.username || user?.email || '未知用户';
        console.log('🔍 [TestCases] 编辑模式 - 当前用户信息:', {
          user,
          accountName: user?.accountName,
          username: user?.username,
          email: user?.email,
          author: authorValue
        });

        // 🔥 修复：确保 author 不会被覆盖，放在最后设置
        const updatedTestCase = {
          ...editingTestCase,
          name: formData.name.trim(),
          preconditions: formData.preconditions.trim(),
          testData: formData.testData.trim(),
          steps: formData.steps.trim(),
          assertions: formData.assertions.trim(),
          priority: formData.priority,
          status: formData.status,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          system: formData.system.trim() || undefined,
          module: formData.module.trim() || undefined,
        };
        
        // 🔥 确保 author 字段被正确设置（放在最后，避免被覆盖）
        updatedTestCase.author = authorValue;

        console.log('📤 [TestCases] 编辑模式 - 发送到后端的测试用例数据:', {
          id: editingTestCase.id,
          name: updatedTestCase.name,
          author: updatedTestCase.author
        });

        try {
          await testService.updateTestCase(editingTestCase.id, updatedTestCase);
          await loadTestCases();
          resetForm();
          showToast.success('测试用例更新成功！');
        } catch (error: any) {
          throw new Error(error.message || '更新失败');
        }
      } else {
        // 创建模式
        // 🔥 调试：检查用户信息
        const authorValue = user?.accountName || user?.username || user?.email || '未知用户';
        console.log('🔍 [TestCases] 当前用户信息:', {
          user,
          accountName: user?.accountName,
          username: user?.username,
          email: user?.email,
          author: authorValue
        });

        const newTestCase: any = {
          name: formData.name.trim(),
          preconditions: formData.preconditions.trim(),
          testData: formData.testData.trim(),
          steps: formData.steps.trim(),
          assertions: formData.assertions.trim(),
          priority: formData.priority,
          status: formData.status,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          system: formData.system.trim() || undefined,
          module: formData.module.trim() || undefined,
          department: user?.project || undefined, // 🔥 修复：使用 project 字段
          created: new Date().toISOString().split('T')[0],
          lastRun: '',
          success_rate: 0
        };
        
        // 🔥 确保 author 字段被正确设置（显式设置，避免被过滤）
        newTestCase.author = authorValue;

        console.log('📤 [TestCases] 发送到后端的测试用例数据:', {
          name: newTestCase.name,
          author: newTestCase.author,
          hasSteps: !!newTestCase.steps
        });

        try {
          await testService.createTestCase(newTestCase);
          await loadTestCases();
          if (keepOpen) {
            setFormData({
              name: '',
              preconditions: '',
              testData: '',
              steps: '',
              assertions: '',
              priority: 'medium',
              status: 'active', // 🔥 修改默认状态为启用
              tags: '',
              system: '',
              module: ''
            });
            setFormDirty(false);
            setEditingTestCase(null);
            showToast.success('测试用例已创建，已为你保留表单，便于继续录入');
            setTimeout(() => nameInputRef.current?.focus(), 0);
          } else {
            resetForm();
            showToast.success('测试用例创建成功！');
          }
        } catch (error: any) {
          throw new Error(error.message || '创建失败');
        }
      }
    } catch (error: any) {
      console.error('操作测试用例失败:', error);
      showToast.error(`操作失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理测试用例数据中的可选字段 - 改为导航到编辑页面
  const handleEditTestCase = (testCase: TestCase) => {
    navigate(`/test-cases/${testCase.id}/edit`);
  };

  const handleDeleteTestCase = (testCase: TestCase) => {
    AntModal.confirm({
      title: '确认删除',
      content: (
        <div className="space-y-2">
          <p>
            您确定要删除测试用例 "
            <span className="font-medium">{testCase.name}</span>" 吗？
          </p>
          <p className="text-xs text-gray-500">
            注意：测试用例的历史执行记录将被保留，用于数据分析和统计。
          </p>
        </div>
      ),
      okText: '确认删除',
      cancelText: '取消',
      // okType: 'danger',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setLoading(true);
          await testService.deleteTestCase(testCase.id);
          // 🔥 软删除：后端只标记deleted_at，重新加载时会自动过滤掉已删除的记录
          await loadTestCases();
          showToast.success('测试用例删除成功！');
        } catch (error: any) {
          console.error('删除测试用例失败:', error);
          showToast.error(`删除失败: ${error.message}`);
          throw error; // 阻止 Modal 关闭
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 🔥 新增：批量删除测试用例
  const handleBatchDelete = () => {
    if (selectedTestCaseIds.length === 0) {
      showToast.warning('请先选择要删除的测试用例');
      return;
    }

    AntModal.confirm({
      title: '批量删除确认',
      content: (
        <div className="space-y-2">
          <p>
            您确定要删除选中的 <span className="font-medium text-red-600">{selectedTestCaseIds.length}</span> 个测试用例吗？
          </p>
          <p className="text-xs text-gray-500">
            注意：测试用例的历史执行记录将被保留，用于数据分析和统计。
          </p>
        </div>
      ),
      okText: '确认删除',
      cancelText: '取消',
      // okType: 'danger',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setLoading(true);
          let successCount = 0;
          let failCount = 0;

          // 逐个删除选中的测试用例
          for (const id of selectedTestCaseIds) {
            try {
              await testService.deleteTestCase(id);
              successCount++;
            } catch (error) {
              console.error(`删除测试用例 ${id} 失败:`, error);
              failCount++;
            }
          }

          // 🔥 软删除：重新加载时会自动过滤掉已删除的记录，清空选择
          await loadTestCases();
          setSelectedTestCaseIds([]);

          // 显示结果
          if (failCount === 0) {
            showToast.success(`成功删除 ${successCount} 个测试用例！`);
          } else {
            showToast.warning(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`);
          }
        } catch (error: any) {
          console.error('批量删除失败:', error);
          showToast.error(`批量删除失败: ${error.message}`);
          throw error; // 阻止 Modal 关闭
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      preconditions: '',
      testData: '',
      steps: '',
      assertions: '',
      priority: 'medium',
      status: 'active', // 🔥 修改默认状态为启用
      tags: '',
      system: '',
      module: ''
    });
    setShowCreateModal(false);
    setEditingTestCase(null);
    setFormDirty(false);
  };

  // 🔥 新增：重置套件表单
  const resetSuiteForm = () => {
    setSuiteFormData({
      name: '',
      description: '',
      testCases: [],
      priority: 'medium',
      status: 'active', // 🔥 修改默认状态为启用
      tags: '',
      project: '' // 🔥 新增：重置项目字段
    });
    setShowCreateModal(false);
    setEditingTestSuite(null);
    setSuiteFormDirty(false);
  };

  // 关闭创建/编辑弹窗（包含未保存更改提示）
  const handleCloseModal = () => {
    if (activeTab === 'cases') {
      if (formDirty) {
        setShowUnsavedConfirm(true);
        return;
      }
      resetForm();
      setFormDirty(false);
    } else {
      if (suiteFormDirty) {
        setShowUnsavedConfirm(true);
        return;
      }
      resetSuiteForm();
      setSuiteFormDirty(false);
    }
  };

  // 🔥 新增：创建/编辑测试套件
  const handleCreateTestSuite = async (keepOpen = false) => {
    // 🔥 防重复点击检查
    if (loading) {
      console.log('⚠️ 操作正在进行中，忽略重复点击');
      return;
    }

    if (!suiteFormData.name.trim()) {
      showToast.warning('请输入测试套件名称');
      setSuiteNameTouched(true);
      setTimeout(() => suiteNameInputRef.current?.focus(), 0);
      return;
    }
    
    if (!suiteFormData.project) {
      showToast.warning('请选择项目');
      return;
    }
    
    if (suiteFormData.testCases.length === 0) {
      showToast.warning('请选择至少一个测试用例');
      return;
    }

    try {
      setLoading(true);
      
      if (editingTestSuite) {
        // 编辑模式
        const updatedSuite = {
          ...editingTestSuite,
          name: suiteFormData.name.trim(),
          description: suiteFormData.description.trim(),
          testCaseIds: suiteFormData.testCases, // 🔥 修复：使用正确的字段名
          priority: suiteFormData.priority,
          status: suiteFormData.status,
          tags: suiteFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          project: suiteFormData.project || undefined // 🔥 新增：传递项目字段
        };

        try {
          await testService.updateTestSuite(editingTestSuite.id, updatedSuite);
          await loadTestSuites();
          resetSuiteForm();
          showToast.success('测试套件更新成功！');
        } catch (error: any) {
          throw new Error(error.message || '更新失败');
        }
      } else {
        // 创建模式
        const newSuite = {
          name: suiteFormData.name.trim(),
          description: suiteFormData.description.trim(),
          testCaseIds: suiteFormData.testCases, // 🔥 修复：使用正确的字段名
          priority: suiteFormData.priority,
          status: suiteFormData.status,
          tags: suiteFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          project: suiteFormData.project || undefined, // 🔥 新增：传递项目字段
          department: user?.project || undefined, // 🔥 修复：使用 project 字段
          author: user?.accountName || user?.username || user?.email || '未知用户', // 🔥 使用当前登录用户信息
          created: new Date().toISOString().split('T')[0]
        };

        try {
          await testService.createTestSuite(newSuite);
          await loadTestSuites();
          if (keepOpen) {
            setSuiteFormData({
              name: '',
              description: '',
              testCases: [],
              priority: 'medium',
              status: 'active', // 🔥 修改默认状态为启用
              tags: '',
              project: '' // 🔥 新增：重置项目字段
            });
            setSuiteFormDirty(false);
            setEditingTestSuite(null);
            showToast.success('测试套件已创建，已为你保留表单，便于继续录入');
            setTimeout(() => suiteNameInputRef.current?.focus(), 0);
          } else {
            // 🔥 修复：确保弹窗关闭
            setSuiteFormDirty(false);
            setEditingTestSuite(null);
            setShowCreateModal(false);
            setSuiteFormData({
              name: '',
              description: '',
              testCases: [],
              priority: 'medium',
              status: 'active', // 🔥 修改默认状态为启用
              tags: '',
              project: ''
            });
            showToast.success('测试套件创建成功！');
          }
        } catch (error: any) {
          throw new Error(error.message || '创建失败');
        }
      }
    } catch (error: any) {
      console.error('操作测试套件失败:', error);
      showToast.error(`操作失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 新增：编辑测试套件
  const handleEditTestSuite = (testSuite: TestSuiteType) => {
    setEditingTestSuite(testSuite);
    setSuiteFormData({
      name: testSuite.name,
      description: testSuite.description || '',
      testCases: testSuite.testCaseIds,
      priority: testSuite.priority || 'medium',
      status: testSuite.status || 'active',
      tags: testSuite.tags?.join(', ') || '',
      project: testSuite.project || '' // 🔥 新增：编辑时显示当前项目
    });
    setShowCreateModal(true);
  };

  // 🔥 新增：删除测试套件
  const handleDeleteTestSuite = (testSuite: TestSuiteType) => {
    AntModal.confirm({
      title: '确认删除',
      content: (
        <div className="space-y-2">
          <p>
            您确定要删除测试套件 "
            <span className="font-medium">{testSuite.name}</span>" 吗？
            此操作无法撤销。
          </p>
          <p className="text-sm text-amber-600">
            注意：删除套件不会删除其中的测试用例，但会移除套件与用例的关联。
          </p>
        </div>
      ),
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          await testService.deleteTestSuite(testSuite.id);
          await loadTestSuites();
          showToast.success('测试套件删除成功！');
        } catch (error: any) {
          console.error('删除测试套件失败:', error);
          showToast.error(`删除失败: ${error.message}`);
          throw error; // 阻止 Modal 关闭
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 🔥 新增：运行测试套件 - 使用WebSocket监听而非模拟通知
  const handleRunTestSuite = async (testSuite: TestSuiteType) => {
    if (runningSuiteId) {
      showToast.warning('已有套件在运行中，请等待完成');
      return;
    }

    setRunningSuiteId(testSuite.id);
    let suiteRunId = '';
    
    try {
      console.log(`🚀 开始执行测试套件: ${testSuite.name}`);
      
      try {
        // 添加一次性监听器，用于接收套件完成通知
        const listenerId = `suite-run-${testSuite.id}-${Date.now()}`;
        let messageReceivedFlag = false;
        
        testService.addMessageListener(listenerId, (message) => {
          console.log(`📣 [TestSuite] 收到WebSocket消息:`, message);
          messageReceivedFlag = true;
          
          // 🔥 立即重置loading状态，无论消息格式如何
          // 🔥 任何测试相关的消息都应该重置loading状态
          const shouldReset = 
            message.type === 'suiteUpdate' ||
            message.type === 'test_complete' ||
            message.type === 'test_error' ||
            (message.data && (message.data.status === 'completed' || message.data.status === 'failed' || message.data.status === 'error' || message.data.status === 'cancelled'));
          
          if (shouldReset) {
            console.log(`✅ 收到测试完成通知，重置状态:`, message);
            setRunningSuiteId(null);
            testService.removeMessageListener(listenerId);
            
            // 🔥 刷新测试运行记录以更新统计数据
            loadTestRuns();
            
            // 根据状态显示不同消息
            const status = message.data?.status || 'completed';
            if (status === 'failed' || status === 'error') {
              showToast.error(`❌ 测试套件执行失败: ${testSuite.name}`);
            } else if (status === 'cancelled') {
              showToast.warning(`⚠️ 测试套件执行被取消: ${testSuite.name}`);
            } else {
              showToast.success(`🎉 测试套件执行完成: ${testSuite.name}`);
            }
            
            // 导航到测试运行页面
            navigate('/test-runs');
          }
        });
        
        // 启动测试套件
        const response = await testService.runTestSuite(testSuite.id);
        suiteRunId = response.runId;
        showToast.info(`✅ 测试套件开始执行: ${testSuite.name}\n运行ID: ${response.runId}`);
        console.log('套件运行ID:', response.runId);
        
        // 设置安全超时（5分钟），以防WebSocket消息丢失
        setTimeout(() => {
          if (runningSuiteId === testSuite.id) {
            console.warn('⚠️ 套件执行超时保护触发，重置状态');
            setRunningSuiteId(null);
            testService.removeMessageListener(listenerId);
            
            if (!messageReceivedFlag) {
              // 从未收到任何消息，可能是WebSocket彻底断开了
              showToast.warning('⚠️ 未收到任何WebSocket消息，可能连接已断开。已重置界面状态。');
              testService.initializeWebSocket().catch(e => console.error('重连失败:', e));
            } else {
              showToast.warning('测试套件执行超时，已重置界面状态。请检查测试运行页面查看实际执行结果。');
            }
          }
        }, 3 * 60 * 1000); // 3分钟超时
        
        // 添加周期性状态检查，防止消息丢失
        let checkCount = 0;
        const maxChecks = 10;
        const statusCheckInterval = setInterval(async () => {
          checkCount++;
          
          // 如果已经超出检查次数或者套件不再运行，停止检查
          if (checkCount > maxChecks || runningSuiteId !== testSuite.id) {
            clearInterval(statusCheckInterval);
            return;
          }
          
          // 检查套件状态
          if (suiteRunId) {
            try {
              const suiteStatus = await testService.getSuiteRun(suiteRunId);
              console.log(`🔍 定期检查套件状态: ${suiteStatus?.status}`);
              
              if (suiteStatus && (suiteStatus.status === 'completed' || 
                  suiteStatus.status === 'failed' || 
                  suiteStatus.status === 'cancelled')) {
                console.log('✅ 定期检查发现套件已完成');
                clearInterval(statusCheckInterval);
                setRunningSuiteId(null);
                testService.removeMessageListener(listenerId);
                showToast.success(`🎉 测试套件执行完成: ${testSuite.name} (通过定期检查发现)`);
                navigate('/test-runs');
              }
            } catch (error) {
              console.error('定期检查套件状态失败:', error);
            }
          }
        }, 30000); // 每30秒检查一次
        
      } catch (error: any) {
        setRunningSuiteId(null);
        throw new Error(error.message || '启动测试套件失败');
      }
      
    } catch (error: any) {
      console.error('执行测试套件失败:', error);
      showToast.error(`❌ 执行测试套件失败: ${error.message}`);
      setRunningSuiteId(null);
    }
  };

  // 🔥 修复：独立维护所有标签和模块选项，不受当前页testCases影响
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allSuiteTags, setAllSuiteTags] = useState<string[]>([]);
  const [moduleOptions, setModuleOptions] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  // 🔥 新增：版本筛选器状态
  const [versionOptions, setVersionOptions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  
  // 🔥 新增：测试执行搜索和筛选状态
  const [runsSearchTerm, setRunsSearchTerm] = useState('');
  const [runsStatusFilter, setRunsStatusFilter] = useState('');
  const [runsResultFilter, setRunsResultFilter] = useState('');  // 🆕 执行结果筛选
  const [runsExecutorFilter, setRunsExecutorFilter] = useState('');
  const [runsEnvironmentFilter, setRunsEnvironmentFilter] = useState('');
  const [runsSystemFilter, setRunsSystemFilter] = useState('');
  const [runsVersionFilter, setRunsVersionFilter] = useState('');
  const [runsModuleFilter, setRunsModuleFilter] = useState('');
  const [runsTagFilter, setRunsTagFilter] = useState('');
  const [runsPriorityFilter, setRunsPriorityFilter] = useState('');
  const [runsShowAdvanced, setRunsShowAdvanced] = useState(false);
  
  // 🔥 新增：测试用例高级筛选状态
  const [casesShowAdvanced, setCasesShowAdvanced] = useState(false);
  const [casesStatusFilter, setCasesStatusFilter] = useState('');
  const [casesExecutionStatusFilter, setCasesExecutionStatusFilter] = useState('');  // 🆕 执行状态筛选
  const [casesExecutionResultFilter, setCasesExecutionResultFilter] = useState('');  // 🆕 执行结果筛选
  const [casesAuthorFilter, setCasesAuthorFilter] = useState('');
  
  // 🔥 新增：测试用例筛选选项（从测试用例数据中提取）
  const [casesFilterOptions, setCasesFilterOptions] = useState<{
    authors: string[];
  }>({
    authors: []
  });
  
  // 🆕 监听筛选条件变化，自动触发数据加载
  useEffect(() => {
    if (activeTab === 'cases') {
      loadTestCases({ page: 1, resetPagination: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSystem,
    selectedModule,
    selectedVersion,
    selectedTag,
    selectedPriority,
    casesStatusFilter, // 🆕 状态筛选
    casesExecutionStatusFilter, // 🆕 执行状态筛选
    casesExecutionResultFilter, // 🆕 执行结果筛选
    casesAuthorFilter, // 🆕 创建者筛选
    activeTab
  ]);
  
  // 🔥 新增：测试执行筛选选项（从测试运行数据中提取）
  const [runsFilterOptions, setRunsFilterOptions] = useState<{
    systems: string[];
    versions: string[];
    modules: string[];
    tags: string[];
    executors: string[];
    environments: string[];
  }>({
    systems: [],
    versions: [],
    modules: [],
    tags: [],
    executors: [],
    environments: []
  });
  
  // 🔥 新增：TestRuns组件的ref，用于访问停止和刷新功能
  const testRunsStopAllRef = useRef<(() => void) | null>(null);
  const testRunsRefreshRef = useRef<(() => void) | null>(null);
  const testRunsStatsRef = useRef<{ running: number; queued: number; completed: number; failed: number } | null>(null);
  const testRunsStoppingAllRef = useRef<boolean | null>(null);
  
  // 🔥 新增：用于存储TestRuns的状态，确保按钮能够响应状态变化
  const [testRunsStats, setTestRunsStats] = useState<{ running: number; queued: number; completed: number; failed: number } | null>(null);
  const [testRunsStoppingAll, setTestRunsStoppingAll] = useState(false);
  
  // 🔥 新增：测试执行视图模式状态
  const [testRunsViewMode, setTestRunsViewMode] = useState<'table' | 'detailed' | 'card'>(() => {
    const saved = localStorage.getItem('testCases-runs-viewMode');
    return (saved as 'table' | 'detailed' | 'card') || 'table';
  });
  
  // 🔥 新增：测试用例视图模式状态
  const [testCasesViewMode, setTestCasesViewMode] = useState<'table' | 'detailed' | 'card'>(() => {
    const saved = localStorage.getItem('testCases-cases-viewMode');
    return (saved as 'table' | 'detailed' | 'card') || 'table';
  });
  
  // 🔥 保存视图模式偏好
  useEffect(() => {
    localStorage.setItem('testCases-runs-viewMode', testRunsViewMode);
  }, [testRunsViewMode]);
  
  useEffect(() => {
    localStorage.setItem('testCases-cases-viewMode', testCasesViewMode);
  }, [testCasesViewMode]);
  
  // 🔥 新增：定期同步ref到state，触发重新渲染
  useEffect(() => {
    if (activeTab === 'runs') {
      const interval = setInterval(() => {
        if (testRunsStatsRef.current) {
          setTestRunsStats(testRunsStatsRef.current);
        }
        if (testRunsStoppingAllRef.current !== null) {
          setTestRunsStoppingAll(testRunsStoppingAllRef.current);
        }
      }, 300); // 每300ms同步一次
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // 🔥 新增：批量选择状态
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<number[]>([]);

  // 🔥 移除前端过滤逻辑：现在由后端分页API处理所有过滤

  // 🔥 新增：自动触发搜索 - 监听过滤条件变化（下拉选择框）
  const isInitialMount = useRef(true);
  useEffect(() => {
    // 跳过首次加载，避免初始化时触发搜索
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // 当过滤条件变化时，自动触发搜索
    if (activeTab === 'cases') {
      loadTestCases({ page: 1, resetPagination: true });
    } else {
      // 测试套件：前端过滤，同步 searchQuery
      setSearchQuery(searchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystem, selectedModule, selectedTag, selectedPriority, selectedVersion, activeTab, searchTerm]);

  // 🔥 新增：自动触发搜索 - 监听搜索关键词变化（带防抖）
  // useEffect(() => {
  //   // 跳过首次加载
  //   if (isInitialMount.current) {
  //     return;
  //   }
    
  //   // 设置防抖定时器
  //   const debounceTimer = setTimeout(() => {
  //     if (activeTab === 'cases') {
  //       loadTestCases({ page: 1, resetPagination: true });
  //     } else {
  //       // 测试套件：前端过滤，同步 searchQuery
  //       setSearchQuery(searchTerm);
  //     }
  //   }, 500); // 500ms 防抖延迟

  //   return () => clearTimeout(debounceTimer);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [searchTerm, activeTab]);

  // 🔥 新增：根据选择的项目动态加载版本选项（参考功能用例逻辑）
  useEffect(() => {
    const loadProjectVersions = async () => {
      if (selectedSystem && activeTab === 'cases') {
        try {
          console.log('📋 [TestCases] 加载系统版本列表:', selectedSystem);
          const versions = await functionalTestCaseService.getProjectVersionsBySystem(selectedSystem);
          setVersionOptions(versions.map(v => v.version_name || v.version_code));
          console.log('✅ [TestCases] 版本列表已加载:', versions.length);
        } catch (error) {
          console.error('❌ [TestCases] 加载系统版本列表失败:', error);
          setVersionOptions([]);
        }
      } else {
        // 清空项目时，清空版本列表和版本筛选
        setVersionOptions([]);
        setSelectedVersion('');
      }
    };
    loadProjectVersions();
  }, [selectedSystem, activeTab]); // 仅监听项目变化和tab切换

  // 🔥 新增：自动触发导入功能用例搜索（带防抖）
  useEffect(() => {
    // 只有在导入模态框打开时才自动搜索
    if (!showImportModal) {
      return;
    }
    
    // 设置防抖定时器
    // const debounceTimer = setTimeout(() => {
    //   void loadFunctionalCases({ page: 1, search: importSearchTerm });
    // }, 500); // 500ms 防抖延迟

    // return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSearchTerm, showImportModal]);

  // 🔥 新增：过滤测试套件
  const filteredTestSuites = testSuites.filter(testSuite => {
    // 🔥 修复：统一使用 searchQuery（在 handleSearch 中会从 searchTerm 同步）
    const matchesSearch = searchQuery === '' || 
      testSuite.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (testSuite.description && testSuite.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = selectedTag === '' || (testSuite.tags && testSuite.tags.includes(selectedTag));
    const matchesPriority = selectedPriority === '' || testSuite.priority === selectedPriority;
    
    return matchesSearch && matchesTag && matchesPriority;
  });

  // 🔥 运行测试用例 - 显示执行配置对话框
  const handleRunTest = async (testCase: TestCase) => {
    if (runningTestId) {
      showToast.warning('已有测试在运行中，请等待完成');
      return;
    }

    // 显示执行配置对话框
    setPendingTestCase(testCase);
    setShowExecutionConfig(true);
  };

  // 🔥 确认执行测试（带配置）
  const handleConfirmRunTest = async () => {
    if (!pendingTestCase) return;

    setRunningTestId(pendingTestCase.id);
    setShowExecutionConfig(false);
    
    try {
      console.log(`🚀 开始执行测试: ${pendingTestCase.name}`);
      console.log(`   执行引擎: ${executionConfig.executionEngine}`);
      console.log(`   Trace录制: ${executionConfig.enableTrace ? '启用' : '禁用'}`);
      console.log(`   Video录制: ${executionConfig.enableVideo ? '启用' : '禁用'}`);
      
      try {
        // 启动WebSocket监听器来跟踪测试运行
        const listenerId = `test-run-${pendingTestCase.id}`;
        
        // 添加一次性监听器，用于接收测试完成通知
        testService.addMessageListener(listenerId, (message) => {
          console.log(`📣 [TestCase] 收到WebSocket消息:`, message);
          
          // 🔥 修复：只在收到 test_complete 消息时才显示完成提示
          // 避免在测试还在执行时（收到 test_update 但状态为 completed）就显示完成
          if (message.type === 'test_complete') {
            console.log(`✅ 收到测试完成通知，重置状态:`, message);
            setRunningTestId(null);
            testService.removeMessageListener(listenerId);
            
            // 🔥 刷新测试运行记录以更新统计数据
            loadTestRuns();
            
            // 根据状态显示不同消息
            const status = message.data?.status || 'completed';
            if (status === 'failed' || status === 'error') {
              showToast.error(`❌ 测试执行失败: ${pendingTestCase.name}`);
            } else if (status === 'cancelled') {
              showToast.warning(`⚠️ 测试执行被取消: ${pendingTestCase.name}`);
            } else {
              showToast.success(`🎉 测试执行完成: ${pendingTestCase.name}`);
            }
            
            // 导航到测试运行页面
            // navigate('/test-runs');
          } else if (message.type === 'test_error') {
            // 测试错误时也重置状态
            console.log(`❌ 收到测试错误通知，重置状态:`, message);
            setRunningTestId(null);
            testService.removeMessageListener(listenerId);
            showToast.error(`❌ 测试执行出错: ${pendingTestCase.name}`);
          }
          // 🔥 注意：test_update 消息不触发完成提示，因为测试可能还在执行中
        });
        
        // 启动测试（传递执行配置）
        const response = await testService.runTestCase(pendingTestCase.id, {
          executionEngine: executionConfig.executionEngine,
          enableTrace: executionConfig.enableTrace,
          enableVideo: executionConfig.enableVideo,
          environment: executionConfig.environment
        });
        // showToast.info(`✅ 测试开始执行: ${pendingTestCase.name}\n运行ID: ${response.runId}\n引擎: ${executionConfig.executionEngine === 'playwright' ? 'Playwright Test Runner' : 'MCP 客户端'}`);
        showToast.info(`✅ 开始执行: ${pendingTestCase.name}`);
        console.log('测试运行ID:', response.runId);
        navigate(`/test-runs/${response.runId}/detail`);
      } catch (error: any) {
        setRunningTestId(null);
        throw new Error(error.message || '启动测试失败');
      }
      
    } catch (error: any) {
      console.error('执行测试失败:', error);
      showToast.error(`❌ 执行测试失败: ${error.message}`);
      setRunningTestId(null);
    } finally {
      setPendingTestCase(null);
    }
  };

  // 规范化“1、xxx 2、xxx …”步骤文本为多行
  const normalizeSteps = (text: string) => {
    if (!text) return '';
    let normalized = text.replace(/\r\n/g, '\n').trim();
    // 仅拆分“行首编号”：1. / 1、 / 1)
    normalized = ('\n' + normalized)
      .replace(/\n\s*(\d+[\.、\)])/g, '\n$1 ')
      .replace(/\n{2,}/g, '\n')
      .trim();
    return normalized;
  };

  // 粘贴时自动解析为多行步骤
  const handleStepsPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    if (/\d+[\.\、\)]/.test(pasted)) {
      e.preventDefault();
      const normalized = normalizeSteps(pasted);
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const current = formData.steps || '';
      const next = current.slice(0, start) + normalized + current.slice(end);
      setFormData(prev => ({ ...prev, steps: next }));
      setFormDirty(true);
    }
  };

  // 弹窗打开自动聚焦 + 快捷键提交（Ctrl/Cmd + Enter）
  useEffect(() => {
    if (!showCreateModal) return;
    try {
      if (activeTab === 'cases') {
        nameInputRef?.current?.focus();
      } else {
        suiteNameInputRef?.current?.focus();
      }
    } catch {}
  }, [showCreateModal, activeTab]);

  useEffect(() => {
    if (!showCreateModal) return;
    const handler = (e: KeyboardEvent) => {
      // 提交：Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeTab === 'cases') {
          if (!loading && formData.name.trim() && formData.steps.trim()) {
            handleCreateTestCase();
          }
        } else {
          if (!loading && suiteFormData.name.trim() && suiteFormData.testCases.length > 0) {
            handleCreateTestSuite();
          }
        }
      }
      // 切换展开编辑：Alt + E
      if (e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        if (activeTab === 'cases') {
          setStepsExpanded(v => !v);
        }
      }
      // 切换软换行：Alt + W
      if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (activeTab === 'cases') {
          setStepsSoftWrap(v => !v);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showCreateModal, activeTab, loading, formData.name, formData.steps, suiteFormData.name, suiteFormData.testCases]);

  useEffect(() => {
    if (showCreateModal && activeTab === 'cases' && stepsExpanded) {
      try {
        stepsTextareaRef.current?.focus();
        stepsTextareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {}
    }
  }, [showCreateModal, activeTab, stepsExpanded]);

  // 🔥 新增：分页控制函数
  const handlePageChange = (page: number) => {
    console.log('📄 [TestCases] 切换页码:', page);
    loadTestCases({ page });
  };

  const handlePageSizeChange = (pageSize: number) => {
    console.log('📏 [TestCases] 切换页面大小:', pageSize);
    loadTestCases({ page: 1, pageSize, resetPagination: true });
  };

  // 🔥 新增：手动搜索功能
  const handleSearch = () => {
    console.log('🔍 [TestCases] 执行手动搜索:', { 
      activeTab, 
      searchTerm, 
      selectedTag, 
      selectedPriority, 
      selectedSystem,
      selectedVersion
    });
    
    if (activeTab === 'cases') {
      // 测试用例搜索：调用后端API
      loadTestCases({ page: 1, resetPagination: true });
    } else {
      // 测试套件搜索：前端过滤，同步 searchQuery 状态
      setSearchQuery(searchTerm);
      // 套件搜索是前端过滤，不需要调用API，状态更新会自动触发重新渲染
    }
  };

  // 🔥 新增：重置功能
  const handleReset = async () => {
    console.log('🔄 [TestCases] 重置搜索条件');
    
    // 先重置所有状态
    setSearchTerm('');
    setSearchQuery('');
    setSelectedTag('');
    setSelectedPriority('');
    setSelectedSystem('');
    setSelectedModule('');
    setSelectedVersion(''); // 🔥 新增：重置版本筛选器
    setCasesStatusFilter(''); // 🔥 新增：重置状态筛选器
    setCasesExecutionStatusFilter(''); // 🆕 重置执行状态筛选
    setCasesExecutionResultFilter(''); // 🆕 重置执行结果筛选
    setCasesAuthorFilter(''); // 🔥 新增：重置创建者筛选器
    
    if (activeTab === 'cases') {
      // 🔥 彻底修复：直接用空参数调用API，不依赖state
      try {
        setTestCasesLoading(true);
        const result = await testService.getTestCasesPaginated({
          page: 1,
          pageSize: pagination.pageSize,
          search: '',
          tag: '',
          priority: '',
          status: '', // 🆕 状态筛选
          system: '',
          module: '',
          projectVersion: '', // 🔥 新增：重置版本筛选参数
          executionStatus: '', // 🆕 重置执行状态筛选
          executionResult: '', // 🆕 重置执行结果筛选
          author: '' // 🆕 重置创建者筛选
        });
        
        setTestCases(result.data || []);
        setPagination({
          page: 1,
          pageSize: pagination.pageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        });
        
        console.log('✅ [TestCases] 重置完成，已加载数据');
      } catch (error) {
        console.error('❌ [TestCases] 重置加载失败:', error);
        showToast.error('重置失败');
      } finally {
        setTestCasesLoading(false);
      }
    }
    // 套件搜索是前端过滤，状态更新会自动触发重新渲染
  };

  // 🔥 移除自动搜索逻辑，改为手动搜索

  // 已移除自动高度，改为 CSS min-height 控制

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'disabled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 🆕 用例类型配置
  const getCaseTypeConfig = (caseType: string) => {
    const typeInfo = getCaseTypeInfo(caseType);
    return { 
        color: typeInfo.color, 
        bg: typeInfo.bgColor, 
        text: `${typeInfo.emoji} ${typeInfo.label}` 
    };
  };

  return (
    <div className="space-y-6">

      {/* 🔥 新增：Tab切换 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              if (showCreateModal) {
                showToast.warning('请先关闭当前表单再切换');
                return;
              }
              setActiveTab('cases');
            }}
            className={clsx(
              'flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'cases'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <FileText className="h-5 w-5 mr-2" />
            测试用例
            {/* <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {testCases.length}
            </span> */}
          </button>
          {/* <button
            onClick={() => {
              if (showCreateModal) {
                showToast.warning('请先关闭当前表单再切换');
                return;
              }
              setActiveTab('suites');
            }}
            className={clsx(
              'flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'suites'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Package className="h-5 w-5 mr-2" />
            测试套件
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {testSuites.length}
            </span>
          </button> */}
          <button
            onClick={() => {
              if (showCreateModal) {
                showToast.warning('请先关闭当前表单再切换');
                return;
              }
              setActiveTab('runs');
            }}
            className={clsx(
              'flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'runs'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <Activity className="h-5 w-5 mr-2" />
            测试执行
            {/* <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {(testRunsStats?.running || 0) + (testRunsStats?.queued || 0) + (testRunsStats?.completed || 0) + (testRunsStats?.failed || 0)}
            </span> */}
          </button>
        </div>
      </div>

      {/* 🔥 测试执行标签页：视图切换器 + 操作按钮 + 统计数据 + 搜索栏 */}
      {activeTab === 'runs' && (
        <>
          {/* 视图切换器和操作按钮在同一行 */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* 视图切换器 */}
            <div className="inline-flex items-center bg-white rounded-lg border border-gray-200 shadow-sm p-1">
              <button
                onClick={() => setTestRunsViewMode('table')}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  testRunsViewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                title="表格视图"
              >
                <Table2 className="w-4 h-4" />
                <span className="hidden sm:inline">表格视图</span>
              </button>
              <button
                onClick={() => setTestRunsViewMode('detailed')}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  testRunsViewMode === 'detailed'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                title="详细表格"
              >
                <Table2 className="w-4 h-4" />
                <span className="hidden sm:inline">详细表格</span>
              </button>
              <button
                onClick={() => setTestRunsViewMode('card')}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  testRunsViewMode === 'card'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                title="卡片视图"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">卡片视图</span>
              </button>
            </div>
            
            {/* 操作按钮组 */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0)) > 0 ? 1.02 : 1 }}
                whileTap={{ scale: ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0)) > 0 ? 0.98 : 1 }}
                onClick={() => testRunsStopAllRef.current?.()}
                disabled={!testRunsStopAllRef.current || testRunsStoppingAll || ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0) === 0)}
                className={clsx(
                  "inline-flex items-center px-4 py-2 rounded-lg transition-colors font-medium shadow-sm",
                  testRunsStoppingAll
                    ? "bg-orange-100 text-orange-700 cursor-not-allowed"
                    : ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0)) > 0
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
                title={
                  testRunsStoppingAll
                    ? "正在停止所有测试..."
                    : ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0)) > 0
                    ? `停止所有运行中的测试 (${(testRunsStats?.running || 0) + (testRunsStats?.queued || 0)}个)`
                    : "当前没有正在运行的测试"
                }
              >
                {testRunsStoppingAll ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <StopCircle className="h-5 w-5 mr-2" />
                )}
                {testRunsStoppingAll
                  ? '停止中...'
                  : ((testRunsStats?.running || 0) + (testRunsStats?.queued || 0)) > 0
                  ? `停止所有 (${(testRunsStats?.running || 0) + (testRunsStats?.queued || 0)})`
                  : '停止所有'
                }
              </motion.button>
            </div>
          </div>

          {/* 统计数据栏 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                <div className="text-sm font-medium text-gray-600">执行中</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{testRunsStats?.running || 0}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-yellow-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">队列中</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{testRunsStats?.queued || 0}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">已完成</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{testRunsStats?.completed || 0}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">失败</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{testRunsStats?.failed || 0}</div>
            </div>
          </div>

          {/* 搜索栏 - 参考FilterBar设计 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            {/* Main Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索测试用例ID或名称..."
                value={runsSearchTerm}
                onChange={(e) => setRunsSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // 可以在这里触发搜索
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg 
                     focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                     transition-all duration-200"
              />
            </div>

            {/* Quick Filters */}
            <select
              value={runsSystemFilter}
              onChange={(e) => setRunsSystemFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有项目</option>
              {systemOptions.map(sys => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>

            {/* 版本筛选 - 依赖于项目选择 */}
            <select
              value={runsVersionFilter}
              onChange={(e) => setRunsVersionFilter(e.target.value)}
              disabled={!runsSystemFilter || runsFilterOptions.versions.length === 0}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{!runsSystemFilter ? '请先选择项目' : '所有版本'}</option>
              {runsFilterOptions.versions.map(version => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>

            <select
              value={runsModuleFilter}
              onChange={(e) => setRunsModuleFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有模块</option>
              {runsFilterOptions.modules.map(module => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>

            <select
              value={runsStatusFilter}
              onChange={(e) => setRunsStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有状态</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="queued">队列中</option>
              <option value="cancelled">已取消</option>
            </select>

            {/* 🆕 执行结果筛选 */}
            <select
              value={runsResultFilter}
              onChange={(e) => setRunsResultFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有结果</option>
              <option value="pass">✅ 通过</option>
              <option value="fail">❌ 失败</option>
              <option value="block">🚫 阻塞</option>
              <option value="skip">⏭️ 跳过</option>
            </select>
            {/* 🆕 优先级筛选（从高级筛选面板移到主搜索栏） */}
            {/* <select
              value={runsPriorityFilter}
              onChange={(e) => setRunsPriorityFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有优先级</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select> */}
            {/* Actions */}
            <button
              onClick={() => setRunsShowAdvanced(!runsShowAdvanced)}
              className={clsx(
                'inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                runsShowAdvanced
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选
            </button>

            <button
              onClick={() => {
                setRunsSearchTerm('');
                setRunsStatusFilter('');
                setRunsResultFilter('');  // 🆕 重置执行结果筛选
                setRunsExecutorFilter('');
                setRunsEnvironmentFilter('');
                setRunsSystemFilter('');
                setRunsVersionFilter('');
                setRunsModuleFilter('');
                setRunsTagFilter('');
                setRunsPriorityFilter('');
              }}
              className="inline-flex items-center px-4 py-2.5 text-gray-600 hover:text-gray-900
                   border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4 mr-2" />
              重置
            </button>

            {/* 🔥 刷新数据按钮 - 放在重置按钮后面 */}
            {testRunsRefreshRef.current && (
              <button
                type="button"
                onClick={() => testRunsRefreshRef.current?.()}
                className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {runsShowAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 mt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">标签</label>
                    <select
                      value={runsTagFilter}
                      onChange={(e) => setRunsTagFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有标签</option>
                      {runsFilterOptions.tags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">优先级</label>
                    <select
                      value={runsPriorityFilter}
                      onChange={(e) => setRunsPriorityFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有优先级</option>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">环境</label>
                    <select
                      value={runsEnvironmentFilter}
                      onChange={(e) => setRunsEnvironmentFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有环境</option>
                      {runsFilterOptions.environments.map(env => (
                        <option key={env} value={env}>{env}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">执行者</label>
                    <select
                      value={runsExecutorFilter}
                      onChange={(e) => setRunsExecutorFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有执行者</option>
                      {runsFilterOptions.executors.map(executor => (
                        <option key={executor} value={executor}>{executor}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </>
      )}

      {/* 🔥 测试用例标签页：顶部行（视图切换器 + 操作按钮） */}
      {activeTab === 'cases' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* 视图切换器 */}
          <div className="inline-flex items-center bg-white rounded-lg border border-gray-200 shadow-sm p-1">
            <button
              onClick={() => setTestCasesViewMode('table')}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                testCasesViewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title="表格视图"
            >
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">表格视图</span>
            </button>
            <button
              onClick={() => setTestCasesViewMode('detailed')}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                testCasesViewMode === 'detailed'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title="详细表格"
            >
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">详细表格</span>
            </button>
            <button
              onClick={() => setTestCasesViewMode('card')}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                testCasesViewMode === 'card'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title="卡片视图"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">卡片视图</span>
            </button>
          </div>
          
          {/* 操作按钮组 */}
          <div className="flex gap-3">
            {/* 重置按钮 - 仅在有运行中的测试时显示 */}
            {(runningTestId || runningSuiteId) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (window.confirm('确定要重置执行状态吗？如果测试仍在运行，这可能会导致界面状态不同步。')) {
                    setRunningTestId(null);
                    setRunningSuiteId(null);
                    showToast.info('已重置执行状态');
                    console.log('✅ 手动重置了测试执行状态');
                  }
                }}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm font-medium"
                title="如果测试已完成但loading状态未消失，请点击此按钮重置"
              >
                <AlertTriangle className="h-5 w-5 mr-2" />
                重置状态
              </motion.button>
            )}
            
            {/* AI批量更新按钮 */}
            {aiFeatureAvailable && !checkingFeature && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/ai-bulk-update')}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm font-medium"
                title="使用AI批量更新测试用例"
              >
                <Bot className="h-5 w-5 mr-2" />
                AI批量更新
              </motion.button>
            )}
            
            {/* 批量删除按钮 - 仅在有选中项时显示 */}
            {selectedTestCaseIds.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBatchDelete}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                批量删除 ({selectedTestCaseIds.length})
              </motion.button>
            )}
            
            {/* 导入功能用例按钮 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                updateImportedFunctionalCaseIds();
                setShowImportModal(true);
                setTimeout(() => {
                  loadFunctionalCases();
                }, 100);
              }}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
            >
              <Download className="h-5 w-5 mr-2" />
              导入功能用例
            </motion.button>
            
            {/* 创建测试用例按钮 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/test-cases/new')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <Plus className="h-5 w-5 mr-2" />
              创建测试用例
            </motion.button>
          </div>
        </div>
      )}

      {/* 🔥 测试用例标签页：统计数据栏 - 执行结果统计 */}
      {activeTab === 'cases' && (() => {
        // 🔥 基于testRunsMap计算执行结果统计
        let passedCount = 0;
        let failedCount = 0;
        let blockedCount = 0;
        let notRunCount = 0;
        
        testCases.forEach(tc => {
          const lastRun = testRunsMap.get(tc.id);
          if (lastRun) {
            // 有执行记录，根据status统计
            if (lastRun.status === 'completed') {
              passedCount++;
            } else if (lastRun.status === 'failed' || lastRun.status === 'error') {
              failedCount++;
            } else if (lastRun.status === 'cancelled') {
              blockedCount++;
            }
          } else {
            // 没有执行记录
            notRunCount++;
          }
        });
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-blue-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">用例总数</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{testCases.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                总计: {pagination.total} | 未执行: {notRunCount}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">通过</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {passedCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {testCases.length > 0 
                  ? `${((passedCount / testCases.length) * 100).toFixed(1)}%`
                  : '0%'
                }
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">失败</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {failedCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {testCases.length > 0 
                  ? `${((failedCount / testCases.length) * 100).toFixed(1)}%`
                  : '0%'
                }
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-yellow-500 rounded-full mr-2"></div>
                <div className="text-sm font-medium text-gray-600">阻塞</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {blockedCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {testCases.length > 0 
                  ? `${((blockedCount / testCases.length) * 100).toFixed(1)}%`
                  : '0%'
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filters - 测试用例搜索栏 */}
      {activeTab === 'cases' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            {/* Main Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索测试用例ID或名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg 
                     focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                     transition-all duration-200"
              />
            </div>

            {/* Quick Filters */}
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有项目</option>
              {systemOptions.map(sys => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>

            {/* 版本筛选 - 依赖于项目选择 */}
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={!selectedSystem || versionOptions.length === 0}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{!selectedSystem ? '请先选择项目' : '所有版本'}</option>
              {versionOptions.map(version => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>

            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有模块</option>
              {moduleOptions.map(module => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>

            {/* 🆕 执行状态筛选 */}
            <select
              value={casesExecutionStatusFilter}
              onChange={(e) => setCasesExecutionStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有状态</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="queued">队列中</option>
              <option value="cancelled">已取消</option>
            </select>

            {/* 🆕 执行结果筛选 */}
            <select
              value={casesExecutionResultFilter}
              onChange={(e) => setCasesExecutionResultFilter(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">所有结果</option>
              <option value="pass">✅ 通过</option>
              <option value="fail">❌ 失败</option>
              <option value="block">🚫 阻塞</option>
              <option value="skip">⏭️ 跳过</option>
            </select>

            {/* Actions */}
            <button
              onClick={() => setCasesShowAdvanced(!casesShowAdvanced)}
              className={clsx(
                'inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                casesShowAdvanced
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选
            </button>

            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2.5 text-gray-600 hover:text-gray-900
                   border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4 mr-2" />
              重置
            </button>

            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {casesShowAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 mt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">标签</label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有标签</option>
                      {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">优先级</label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有优先级</option>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">状态</label>
                    <select
                      value={casesStatusFilter}
                      onChange={(e) => setCasesStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有状态</option>
                      <option value="active">启用</option>
                      <option value="draft">草稿</option>
                      <option value="disabled">禁用</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">创建者</label>
                    <select
                      value={casesAuthorFilter}
                      onChange={(e) => setCasesAuthorFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">所有创建者</option>
                      {casesFilterOptions.authors.map(author => (
                        <option key={author} value={author}>{author}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Filters - 测试套件搜索栏 */}
      {activeTab === 'suites' && (
        <div className="flex flex-row gap-4 items-center justify-center bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          {/* Search */}
          <div className="flex flex-row gap-4 items-center relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-600" />
            <input
              type="text"
              placeholder="搜索测试套件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ width: '480px' }}
            />
            {/* System Filter */}
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ width: '250px' }}
            >
              <option value="">所有项目</option>
              {systemOptions.map(sys => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 items-center md:grid-cols-2">
            {/* Tag Filter */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={allSuiteTags.length === 0}
            >
              <option value="">所有标签</option>
              {allSuiteTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">所有优先级</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => loadTestSuites()}
            className="flex items-center px-3 h-10 w-20 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </button>
          <button
            type="button"
            onClick={() => loadTestSuites()}
            className="flex items-center px-3 h-10 w-20 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </button>
        </div>
      )}

      {/* 🔥 Tab内容区域 */}
      {activeTab === 'cases' ? (
        <>
          {/* Empty State - Test Cases */}
          {testCases.length === 0 && !testCasesLoading && (
            <div className="text-center py-16">
              <div className="mx-auto w-32 h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText className="h-16 w-16 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">暂无测试用例</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                未匹配到任何测试用例，请调整筛选条件，重新搜索。
              </p>
              <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                可以点击下方按钮创建您的第一个自动化测试用例，开始您的测试之旅。
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/test-cases/new')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="h-5 w-5 mr-2" />
                创建第一个测试用例
              </motion.button>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                    <Code className="h-5 w-5 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">简单易用</h4>
                  <p className="text-sm text-gray-600">直观的界面，无需编程知识即可创建测试用例</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                    <Play className="h-5 w-5 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">自动执行</h4>
                  <p className="text-sm text-gray-600">基于 Playwright 的自动化测试引擎</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">实时反馈</h4>
                  <p className="text-sm text-gray-600">测试结果实时更新，快速定位问题</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {testCasesLoading && (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">加载中...</p>
            </div>
          )}

          {/* Test Cases Views */}
          {!testCasesLoading && testCases.length > 0 && (
            <>
              {/* 表格视图 */}
              {testCasesViewMode === 'table' && (
                <TestCaseTable
                  testCases={testCases}
                  onRunTest={handleRunTest}
                  onEditTestCase={handleEditTestCase}
                  onDeleteTestCase={handleDeleteTestCase}
                  runningTestId={runningTestId}
                  loading={loading}
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  selectedIds={selectedTestCaseIds}
                  onSelectionChange={setSelectedTestCaseIds}
                />
              )}

              {/* 详细表格视图 */}
              {testCasesViewMode === 'detailed' && (
                <TestCaseTable
                  testCases={testCases}
                  onRunTest={handleRunTest}
                  onEditTestCase={handleEditTestCase}
                  onDeleteTestCase={handleDeleteTestCase}
                  runningTestId={runningTestId}
                  loading={loading}
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  selectedIds={selectedTestCaseIds}
                  onSelectionChange={setSelectedTestCaseIds}
                />
              )}

              {/* 卡片视图 */}
              {testCasesViewMode === 'card' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence>
                      {testCases.map((testCase, index) => (
                        <motion.div
                          key={testCase.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          {/* 卡片头部 */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 mb-1 truncate" title={testCase.name}>
                                {testCase.name}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="flex items-center">
                                  <User className="h-3 w-3 mr-1" />
                                  {testCase.author || '未知'}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {testCase.created}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <input
                                type="checkbox"
                                checked={selectedTestCaseIds.includes(testCase.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTestCaseIds(prev => [...prev, testCase.id]);
                                  } else {
                                    setSelectedTestCaseIds(prev => prev.filter(id => id !== testCase.id));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* 系统/模块 */}
                          {(testCase.system || testCase.module) && (
                            <div className="flex items-center gap-2 mb-3 text-sm">
                              {testCase.system && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {testCase.system}
                                </span>
                              )}
                              {testCase.module && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  {testCase.module}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 标签 */}
                          {testCase.tags && testCase.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {testCase.tags.slice(0, 3).map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </span>
                              ))}
                              {testCase.tags.length > 3 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  +{testCase.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 状态和优先级 */}
                          <div className="flex items-center justify-between mb-4">
                            <span className={clsx(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              getPriorityColor(testCase.priority)
                            )}>
                              {testCase.priority === 'high' ? '高' : testCase.priority === 'medium' ? '中' : '低'}
                            </span>
                            <span className={clsx(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              getStatusColor(testCase.status)
                            )}>
                              {testCase.status === 'active' ? '启用' : testCase.status === 'draft' ? '草稿' : '禁用'}
                            </span>
                          </div>

                          {/* 成功率（如果有） */}
                          {testCase.success_rate !== undefined && testCase.success_rate !== null && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>成功率</span>
                                <span className="font-medium">{testCase.success_rate}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={clsx(
                                    'h-1.5 rounded-full transition-all',
                                    testCase.success_rate >= 80 ? 'bg-green-500' :
                                    testCase.success_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${testCase.success_rate}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleRunTest(testCase)}
                              disabled={runningTestId === testCase.id}
                              className={clsx(
                                "p-2 rounded-lg transition-colors",
                                runningTestId === testCase.id 
                                  ? "bg-blue-100 text-blue-600 cursor-not-allowed" 
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                              )}
                              title={runningTestId === testCase.id ? "执行中..." : "运行测试"}
                            >
                              {runningTestId === testCase.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleEditTestCase(testCase)}
                              className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                              title="编辑测试用例"
                            >
                              <Edit3 className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteTestCase(testCase)}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="删除测试用例"
                            >
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* 卡片视图的分页 */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      显示 {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} 到{' '}
                      {Math.min(pagination.page * pagination.pageSize, pagination.total)} 共 {pagination.total} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        上一页
                      </button>
                      <span className="text-sm text-gray-600">
                        第 {pagination.page} / {pagination.totalPages} 页
                      </span>
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        下一页
                      </button>
                      <select
                        value={pagination.pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value={10}>10 条/页</option>
                        <option value={20}>20 条/页</option>
                        <option value={50}>50 条/页</option>
                        <option value={100}>100 条/页</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : activeTab === 'suites' ? (
        <>
          {/* 🔥 测试套件标签页：顶部行（操作按钮） */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4">
            {/* 操作按钮组 */}
            <div className="flex gap-3">
              {/* 创建测试套件按钮 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                <Plus className="h-5 w-5 mr-2" />
                创建测试套件
              </motion.button>
            </div>
          </div>

          {/* Empty State - Test Suites */}
          {testSuites.length === 0 && !loading && (
                <div className="text-center py-16">
                  <div className="mx-auto w-32 h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-16 w-16 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">暂无测试套件</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    您还没有创建任何测试套件。测试套件可以帮您批量管理和执行相关的测试用例。
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    创建第一个测试套件
                  </motion.button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="text-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">加载中...</p>
                </div>
              )}

              {/* Test Suites Grid */}
              {!loading && filteredTestSuites.length > 0 && (
                <div className="grid gap-6">
                  <AnimatePresence>
                    {filteredTestSuites.map((testSuite, index) => (
                      <motion.div
                        key={testSuite.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-2">{testSuite.name}</h3>
                            <p className="text-sm text-gray-600 mb-3">{testSuite.description || '暂无描述'}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                {testSuite.testCaseIds.length} 个测试用例
                              </span>
                              <span className="flex items-center">
                                <User className="h-4 w-4 mr-1" />
                                {testSuite.owner || '未知作者'}
                              </span>
                              <span className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {new Date(testSuite.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRunTestSuite(testSuite)}
                              disabled={runningSuiteId === testSuite.id}
                              className={clsx(
                                "p-1 transition-colors",
                                runningSuiteId === testSuite.id 
                                  ? "text-blue-600 cursor-not-allowed" 
                                  : "text-gray-600 hover:text-blue-600"
                              )}
                              title={runningSuiteId === testSuite.id ? "执行中..." : "运行套件"}
                            >
                              {runningSuiteId === testSuite.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditTestSuite(testSuite)}
                              className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                              title="编辑测试套件"
                            >
                              <Edit3 className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeleteTestSuite(testSuite)}
                              className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                              title="删除测试套件"
                            >
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>

                        {/* Tags */}
                        {testSuite.tags && testSuite.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {testSuite.tags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Status and Priority */}
                        <div className="flex items-center justify-between">
                          <span className={clsx(
                            'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                            getPriorityColor(testSuite.priority)
                          )}>
                            优先级: {testSuite.priority === 'high' ? '高' : testSuite.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span className={clsx(
                            'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                            getStatusColor(testSuite.status)
                          )}>
                            {testSuite.status === 'active' ? '启用' : testSuite.status === 'draft' ? '草稿' : '禁用'}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
        </>
      ) : activeTab === 'runs' ? (
        <>
          {/* 测试执行页面 */}
          {activeTab === 'runs' && (
            <TestRuns 
              searchTerm={runsSearchTerm}
              statusFilter={runsStatusFilter}
              resultFilter={runsResultFilter}  // 🆕 执行结果筛选
              executorFilter={runsExecutorFilter}
              environmentFilter={runsEnvironmentFilter}
              systemFilter={runsSystemFilter}
              versionFilter={runsVersionFilter}
              moduleFilter={runsModuleFilter}
              tagFilter={runsTagFilter}
              priorityFilter={runsPriorityFilter}
              hideHeader={true}
              hideStats={true}
              hideViewSwitcher={true}
              externalViewMode={testRunsViewMode}
              onViewModeChange={setTestRunsViewMode}
              onStopAllRef={testRunsStopAllRef}
              onRefreshRef={testRunsRefreshRef}
              statsRef={testRunsStatsRef}
              stoppingAllRef={testRunsStoppingAllRef}
              onFilterOptionsUpdate={setRunsFilterOptions}
            />
          )}
        </>
      ) : null}



      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        title={activeTab === 'cases'
          ? (editingTestCase ? '编辑测试用例' : '创建新测试用例')
          : (editingTestSuite ? '编辑测试套件' : '创建新测试套件')
        }
        closeOnClickOutside={false}
        size="wide"
        contentPadding="md"
        footer={
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              disabled={loading}
            >
              取消
            </Button>
            {activeTab === 'cases' && !editingTestCase && (
            <Button
              variant="outline"
              onClick={() => { void handleCreateTestCase(true); }}
              disabled={loading || !formData.name.trim() || !formData.steps.trim()}
            >
              保存并继续
            </Button>
            )}
            {activeTab === 'suites' && !editingTestSuite && (
              <Button
                variant="outline"
                onClick={() => { void handleCreateTestSuite(true); }}
                disabled={loading || !suiteFormData.name.trim() || !suiteFormData.project || suiteFormData.testCases.length === 0}
              >
                保存并继续
              </Button>
            )}
            <Button
              onClick={activeTab === 'cases' ? () => { void handleCreateTestCase(); } : () => { void handleCreateTestSuite(false); }}
              disabled={loading || (activeTab === 'cases' 
                ? (!formData.name.trim() || !formData.steps.trim())
                : (!suiteFormData.name.trim() || !suiteFormData.project || suiteFormData.testCases.length === 0)
              )}
              isLoading={loading}
            >
              {activeTab === 'cases' 
                ? (editingTestCase ? '更新用例' : '创建用例')
                : (editingTestSuite ? '更新套件' : '创建套件')
              }
            </Button>
          </div>
        }
      >
        {activeTab === 'cases' ? (
          // 🔥 测试用例表单
          <div className={clsx("grid gap-4", !stepsExpanded && "xl:grid-cols-3")}>
            {/* 左侧主区：名称 + 步骤 + 断言 */}
            <div className="space-y-3 xl:col-span-2">
              <div>
                <label htmlFor="caseName" className="block text-sm font-medium text-gray-700 mb-2">
                  用例名称 *
                </label>
                <input
                  id="caseName"
                  ref={nameInputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setFormDirty(true); }}
                  onBlur={() => setNameTouched(true)}
                  aria-invalid={nameTouched && !formData.name.trim()}
                  aria-describedby="caseName-error"
                  className={clsx(
                    "w-full px-3 py-2 border rounded-lg focus:ring-2",
                    nameTouched && !formData.name.trim()
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-transparent"
                  )}
                  placeholder="输入测试用例名称"
                />
                {nameTouched && !formData.name.trim() && (
                  <p id="caseName-error" className="mt-1 text-sm text-red-600 font-medium">请输入测试用例名称</p>
                )}
              </div>

              {/* 前置条件和测试数据 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    前置条件
                  </label>
                  <textarea
                    value={formData.preconditions}
                    onChange={(e) => { setFormData(prev => ({ ...prev, preconditions: e.target.value })); setFormDirty(true); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="请描述执行测试前需要满足的条件"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    测试数据
                  </label>
                  <textarea
                    value={formData.testData}
                    onChange={(e) => { setFormData(prev => ({ ...prev, testData: e.target.value })); setFormDirty(true); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="请输入测试过程中使用的数据"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="caseSteps" className="block text-sm font-medium text-gray-700">
                    测试步骤 *
                  </label>
                  <div className="flex items-center gap-2 relative">
                    {/* 🔥 新增：切换编辑器模式按钮 */}
                    <button
                      type="button"
                      onClick={handleToggleEditorMode}
                      className="inline-flex items-center text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      title={stepsEditorMode === 'table' ? '切换为文本模式' : '切换为表格模式'}
                    >
                      {stepsEditorMode === 'table' ? (
                        <>
                          <AlignLeft className="h-3.5 w-3.5 mr-1" />
                          文本
                        </>
                      ) : (
                        <>
                          <Table className="h-3.5 w-3.5 mr-1" />
                          表格
                        </>
                      )}
                    </button>

                    {/* 仅在文本模式显示这些按钮 */}
                    {stepsEditorMode === 'text' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const n = normalizeSteps(formData.steps);
                            setFormData(prev => ({ ...prev, steps: n }));
                            setFormDirty(true);
                            showToast.info('已格式化步骤');
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          title='将"1、xxx 2、xxx ..."自动拆分为多行'
                        >
                          格式化步骤
                        </button>
                        <button
                          type="button"
                          onClick={() => setStepsSoftWrap(v => !v)}
                          aria-pressed={stepsSoftWrap ? 'true' : 'false'}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          title={stepsSoftWrap ? '软换行：开（Alt+W）' : '软换行：关（Alt+W）'}
                        >
                          {stepsSoftWrap ? '软换行：开' : '软换行：关'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStepsExpanded(v => {
                              const next = !v;
                              if (!v) {
                                setTimeout(() => {
                                  try {
                                    stepsTextareaRef.current?.focus();
                                    stepsTextareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                  } catch {}
                                }, 0);
                              }
                              return next;
                            });
                          }}
                          aria-pressed={stepsExpanded ? 'true' : 'false'}
                          aria-controls="caseSteps"
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          title={stepsExpanded ? '收起编辑区域（Alt+E）' : '展开为更大编辑区域（Alt+E）'}
                        >
                          {stepsExpanded ? '收起编辑' : '展开编辑'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStepsHelpOpen(v => !v)}
                          aria-expanded={stepsHelpOpen ? 'true' : 'false'}
                          className="inline-flex items-center text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          title="查看步骤输入帮助与快捷键"
                        >
                          <HelpCircle className="h-3.5 w-3.5 mr-1" />
                          帮助
                        </button>
                        {stepsHelpOpen && (
                          <div className="absolute right-0 top-8 z-20 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-xs leading-5">
                            <div className="font-medium text-gray-900 mb-1">步骤输入帮助</div>
                            <ul className="list-disc pl-5 text-gray-700 space-y-1">
                              <li>支持编号：1. / 1、 / 1)</li>
                              <li>粘贴自动分行，建议每步一句</li>
                              <li>快捷键：Alt+E 展开/收起，Alt+W 软换行，Ctrl/Cmd+Enter 提交</li>
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 🔥 条件渲染：表格模式或文本模式 */}
                {stepsEditorMode === 'table' ? (
                  <>
                    <StepTableEditor
                      steps={stepsData}
                      onChange={handleStepsDataChange}
                    />
                    {stepsTouched && stepsData.length === 0 && (
                      <p className="mt-1 text-sm text-red-600 font-medium">请添加至少一个测试步骤</p>
                    )}
                  </>
                ) : (
                  <>
                    <textarea
                      id="caseSteps"
                      ref={stepsTextareaRef}
                      rows={12}
                      value={formData.steps}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, steps: e.target.value }));
                        setFormDirty(true);
                      }}
                      onBlur={() => setStepsTouched(true)}
                      onPaste={handleStepsPaste}
                      wrap={stepsSoftWrap ? "soft" : "off"}
                      aria-invalid={stepsTouched && !formData.steps.trim()}
                      aria-describedby="caseSteps-error"
                      className={clsx(
                        "w-full px-3 py-2 font-mono border rounded-lg focus:ring-2 leading-6 resize-y",
                        (stepsTouched && !formData.steps.trim())
                          ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                          : "border-gray-300 focus:ring-blue-500 focus:border-transparent",
                        "min-h-[32vh] sm:min-h-[38vh] md:min-h-[42vh] xl:min-h-[44vh]",
                        !stepsSoftWrap && "overflow-x-auto",
                        stepsExpanded && "h-[68vh]"
                      )}
                      placeholder="例如：&#10;1、打开登录页面&#10;2、输入用户名和密码&#10;3、点击登录按钮&#10;4、验证页面跳转"
                    />
                    {stepsTouched && !formData.steps.trim() && (
                      <p id="caseSteps-error" className="mt-1 text-sm text-red-600 font-medium">请输入测试步骤</p>
                    )}
                    <div className="mt-1 flex justify-between text-sm text-gray-700">
                      <span>行数: {formData.steps ? formData.steps.split(/\r\n|\n/).length : 0} · 支持数字编号粘贴自动拆分</span>
                      <span>字符: {formData.steps.length}</span>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  断言预期
                </label>
                <textarea
                  value={formData.assertions}
                  onChange={(e) => setFormData(prev => ({ ...prev, assertions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 overflow-y-auto"
                  placeholder="例如：&#10;• 页面成功跳转到首页&#10;• 显示用户昵称&#10;• 退出按钮可见"
                />
                <div className="mt-1 flex justify-between text-sm text-gray-700">
                  <span>行数: {formData.assertions ? formData.assertions.split(/\r\n|\n/).length : 0}</span>
                  <span>字符: {formData.assertions.length}</span>
                </div>
              </div>
            </div>

            {/* 右侧辅区：系统/模块/优先级/状态/标签 */}
            <div className={clsx("space-y-3 xl:col-span-1", stepsExpanded && "hidden")}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  系统
                </label>
                <select
                  value={formData.system}
                  onChange={(e) => setFormData(prev => ({ ...prev, system: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择项目</option>
                  {systemOptions.map((sys) => (
                    <option key={sys.id} value={sys.name}>{sys.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模块
                </label>
                <input
                  type="text"
                  list="moduleOptions"
                  value={formData.module}
                  onChange={(e) => setFormData(prev => ({ ...prev, module: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="如：商品管理"
                />
                <datalist id="moduleOptions">
                  {moduleOptions.map((opt) => (
                    <option key={opt as string} value={opt as string}></option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优先级
                </label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态
                </label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'draft' | 'disabled' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签
                </label>
                <TagInput
                  value={formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
                  onChange={(tags) => { setFormData(prev => ({ ...prev, tags: tags.join(', ') })); setFormDirty(true); }}
                  placeholder="输入后按 Enter 或逗号添加标签"
                />
              </div>
            </div>
          </div>
        ) : (
          // 🔥 测试套件表单
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                所属项目 *
              </label>
              <select
                value={suiteFormData.project}
                onChange={(e) => { setSuiteFormData(prev => ({ ...prev, project: e.target.value })); setSuiteFormDirty(true); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">请选择项目</option>
                {systemOptions.map((system) => (
                  <option key={system.id} value={system.name}>
                    {system.name}
                  </option>
                ))}
              </select>
              {!suiteFormData.project && (
                <p className="mt-1 text-sm text-amber-600">请选择项目，以便正确关联测试报告数据</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                套件名称 *
              </label>
              <input
                ref={suiteNameInputRef}
                type="text"
                value={suiteFormData.name}
                onChange={(e) => { setSuiteFormData(prev => ({ ...prev, name: e.target.value })); setSuiteFormDirty(true); }}
                onBlur={() => setSuiteNameTouched(true)}
                aria-invalid={suiteNameTouched && !suiteFormData.name.trim()}
                aria-describedby="suiteName-error"
                className={clsx(
                  "w-full px-3 py-2 border rounded-lg focus:ring-2",
                  suiteNameTouched && !suiteFormData.name.trim()
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-transparent"
                )}
                placeholder="输入测试套件名称"
              />
              {suiteNameTouched && !suiteFormData.name.trim() && (
                <p id="suiteName-error" className="mt-1 text-sm text-red-600 font-medium">请输入测试套件名称</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                套件描述
              </label>
              <textarea
                rows={4}
                value={suiteFormData.description}
                onChange={(e) => setSuiteFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="描述这个测试套件的用途和覆盖范围"
              />
              <div className="mt-1 flex justify-between text-sm text-gray-700">
                <span>行数: {suiteFormData.description ? suiteFormData.description.split(/\r\n|\n/).length : 0}</span>
                <span>字符: {suiteFormData.description.length}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择测试用例 *
              </label>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-600" />
                  <input
                    type="text"
                    value={suiteCaseSearch}
                    onChange={(e) => setSuiteCaseSearch(e.target.value)}
                    placeholder="搜索用例名称..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <span className="text-sm text-gray-700 whitespace-nowrap">
                  匹配 {testCases.filter(tc => tc.name.toLowerCase().includes(suiteCaseSearch.toLowerCase())).length} 条
                </span>
                <button
                  type="button"
                  className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={() => {
                    const visibleIds = testCases
                      .filter(tc => tc.name.toLowerCase().includes(suiteCaseSearch.toLowerCase()))
                      .map(tc => tc.id);
                    setSuiteFormData(prev => ({
                      ...prev,
                      testCases: Array.from(new Set([...(prev.testCases || []), ...visibleIds]))
                    }));
                    setSuiteFormDirty(true);
                  }}
                >
                  全选可见
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={() => {
                    const visibleIds = testCases
                      .filter(tc => tc.name.toLowerCase().includes(suiteCaseSearch.toLowerCase()))
                      .map(tc => tc.id);
                    setSuiteFormData(prev => ({
                      ...prev,
                      testCases: (prev.testCases || []).filter(id => !visibleIds.includes(id))
                    }));
                    setSuiteFormDirty(true);
                  }}
                >
                  全不选可见
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {testCases.length === 0 ? (
                  <p className="text-gray-500 text-sm">暂无可用的测试用例，请先创建测试用例</p>
                  ) : (
                    testCases
                      .filter(tc => tc.name.toLowerCase().includes(suiteCaseSearch.toLowerCase()))
                      .sort((a, b) => (Number(suiteFormData.testCases.includes(b.id)) - Number(suiteFormData.testCases.includes(a.id))) || a.name.localeCompare(b.name))
                      .map((testCase) => (
                    <label key={testCase.id} className={clsx("flex items-center space-x-2 cursor-pointer rounded px-2 py-1", suiteFormData.testCases.includes(testCase.id) && "bg-blue-50 ring-1 ring-blue-200")}>
                      <input
                        type="checkbox"
                        checked={suiteFormData.testCases.includes(testCase.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSuiteFormData(prev => ({
                              ...prev,
                              testCases: [...prev.testCases, testCase.id]
                            }));
                          } else {
                            setSuiteFormData(prev => ({
                              ...prev,
                              testCases: prev.testCases.filter(id => id !== testCase.id)
                            }));
                          }
                          setSuiteFormDirty(true);
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{testCase.name}</span>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full',
                        getPriorityColor(testCase.priority)
                      )}>
                        {testCase.priority === 'high' ? '高' : testCase.priority === 'medium' ? '中' : '低'}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {suiteFormData.testCases.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  已选择 {suiteFormData.testCases.length} 个测试用例
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优先级
                </label>
                <select 
                  value={suiteFormData.priority}
                  onChange={(e) => setSuiteFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态
                </label>
                <select 
                  value={suiteFormData.status}
                  onChange={(e) => setSuiteFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'draft' | 'disabled' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标签
              </label>
              <TagInput
                value={suiteFormData.tags ? suiteFormData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
                onChange={(tags) => { setSuiteFormData(prev => ({ ...prev, tags: tags.join(', ') })); setSuiteFormDirty(true); }}
                placeholder="输入后按 Enter 或逗号添加标签"
              />
            </div>
          </div>
        )}
      </Modal>

      
      {/* 🔥 执行配置对话框 */}
      <Modal
        isOpen={showExecutionConfig}
        onClose={() => {
          setShowExecutionConfig(false);
          setPendingTestCase(null);
        }}
        title="执行配置"
        size="md"
      >
        <div className="space-y-4">
          {/* {pendingTestCase && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">测试用例</p>
              <p className="font-medium text-gray-900">{pendingTestCase.name}</p>
            </div>
          )} */}

          <div className="mt-[-20px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              执行引擎
            </label>
            <select
              value={executionConfig.executionEngine}
              onChange={(e) => setExecutionConfig(prev => ({ 
                ...prev, 
                executionEngine: e.target.value as 'mcp' | 'playwright' 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="mcp">MCP 客户端（默认）</option>
              <option value="playwright">Playwright Test Runner</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {executionConfig.executionEngine === 'mcp' 
                ? '使用 MCP 客户端执行，支持 AI 闭环流程'
                : '使用 Playwright Test Runner，支持 Trace 和 Video 录制'}
            </p>
          </div>

          {executionConfig.executionEngine === 'playwright' && (
            <>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableTrace"
                  checked={executionConfig.enableTrace}
                  onChange={(e) => setExecutionConfig(prev => ({ 
                    ...prev, 
                    enableTrace: e.target.checked 
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableTrace" className="text-sm font-medium text-gray-700">
                  启用 Trace 录制
                </label>
              </div>
              <p className="ml-7 text-xs text-gray-500">
                录制测试执行过程，可在 trace.playwright.dev 查看
              </p>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableVideo"
                  checked={executionConfig.enableVideo}
                  onChange={(e) => setExecutionConfig(prev => ({ 
                    ...prev, 
                    enableVideo: e.target.checked 
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableVideo" className="text-sm font-medium text-gray-700">
                  启用 Video 录制
                </label>
              </div>
              <p className="ml-7 text-xs text-gray-500">
                录制测试执行视频，用于调试和回放
              </p>
            </>
          )}

          <div className="pb-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              执行环境
            </label>
            <select
              value={executionConfig.environment}
              onChange={(e) => setExecutionConfig(prev => ({ 
                ...prev, 
                environment: e.target.value 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowExecutionConfig(false);
                setPendingTestCase(null);
              }}
            >
              取消
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmRunTest}
              isLoading={runningTestId === pendingTestCase?.id}
            >
              开始执行
            </Button>
          </div>
        </div>
      </Modal>

      {/* 未保存更改拦截确认 */}
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        onClose={() => setShowUnsavedConfirm(false)}
        title="确认关闭"
        description="有未保存的更改，确认关闭吗？"
        onConfirm={() => {
          if (activeTab === 'cases') {
            resetForm();
            setFormDirty(false);
          } else {
            resetSuiteForm();
            setSuiteFormDirty(false);
          }
          setShowUnsavedConfirm(false);
        }}
        confirmText="确认关闭"
        cancelText="继续编辑"
        size="sm"
      />

      {/* 🔥 新增：导入功能用例Modal - 使用统一组件 */}
      <FunctionalCaseSelectModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setSelectedFunctionalCases([]);
          setImportSearchTerm('');
          setFilterSystem('');
          setFilterProjectVersion('');
          setFilterModule('');
          setFilterScenario('');
          setFilterCaseType('');
          setFilterPriority('');
        }}
        title="从功能用例导入"
        cases={functionalCases}
        selectedCaseIds={selectedFunctionalCases}
        onSelectedCasesChange={(ids) => setSelectedFunctionalCases(ids as number[])}
        importedCaseIds={importedFunctionalCaseIds}
        loading={importLoading}
        searchTerm={importSearchTerm}
        onSearchChange={setImportSearchTerm}
        onSearch={() => loadFunctionalCases({ page: 1, search: importSearchTerm })}
        pagination={importPagination}
        onPageChange={(page) => loadFunctionalCases({ page })}
        onPageSizeChange={(pageSize) => loadFunctionalCases({ page: 1, pageSize })}
        onConfirm={handleImportFunctionalCases}
        confirmText="导入选中用例"
        confirmDisabled={loading}
        confirmLoading={loading}
        showViewToggle={true}
        defaultViewMode="list"
        CaseTypeBadge={CaseTypeBadge}
        filters={[
          {
            key: 'system',
            label: '所属系统',
            value: filterSystem,
            onChange: setFilterSystem,
            placeholder: '所有系统'
          },
          {
            key: 'project_version_id',
            label: '所属版本',
            value: filterProjectVersion,
            onChange: setFilterProjectVersion,
            placeholder: '所有版本'
          },
          {
            key: 'module',
            label: '所属模块',
            value: filterModule,
            onChange: setFilterModule,
            placeholder: '所有模块'
          },
          {
            key: 'scenario_name',
            label: '所属场景',
            value: filterScenario,
            onChange: setFilterScenario,
            placeholder: '所有场景'
          },
          {
            key: 'case_type',
            label: '用例类型',
            value: filterCaseType,
            onChange: setFilterCaseType,
            options: ['SMOKE', 'FULL', 'ABNORMAL', 'BOUNDARY', 'PERFORMANCE', 'SECURITY', 'USABILITY', 'COMPATIBILITY', 'RELIABILITY'],
            optionLabels: {
              SMOKE: '🔥 冒烟',
              FULL: '📋 全量',
              ABNORMAL: '⚠️ 异常',
              BOUNDARY: '📏 边界',
              PERFORMANCE: '⚡ 性能',
              SECURITY: '🔒 安全',
              USABILITY: '👤 可用性',
              COMPATIBILITY: '🔄 兼容性',
              RELIABILITY: '💪 可靠性'
            },
            placeholder: '所有类型'
          },
          {
            key: 'priority',
            label: '优先级',
            value: filterPriority,
            onChange: setFilterPriority,
            options: ['high', 'medium', 'low'],
            optionLabels: { high: '高', medium: '中', low: '低' },
            placeholder: '所有优先级'
          },
        ]}
        useSet={false}
      />

    </div>
  );
}
