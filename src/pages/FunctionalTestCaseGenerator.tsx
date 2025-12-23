import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Radio, Select, Tooltip, Empty, Spin, Modal as AntModal } from 'antd';
import {
  Sparkles, FileText,
  ArrowLeft, ArrowRight, Save, FileX, CheckCircle, Target,
  Upload, FileCheck, TestTube2, FolderOpen, FileCode, User, Calendar, Copy, Check,
  AlertTriangle,  // 🆕 用于显示过滤用例警告
  Eye,  // 🆕 用于预览需求文档
  Edit3,  // 🆕 用于编辑模式切换
  X
} from 'lucide-react';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import * as systemService from '../services/systemService';
import { requirementDocService, RequirementDoc } from '../services/requirementDocService';
import { showToast } from '../utils/toast';
import { Button } from '../components/ui/button';
import { ProgressIndicator } from '../components/ai-generator/ProgressIndicator';
import { readFileContent, type FileReadResult } from '../utils/fileReader';
import { StepCard } from '../components/ai-generator/StepCard';
import { AIThinking } from '../components/ai-generator/AIThinking';
import { DraftCaseCard } from '../components/ai-generator/DraftCaseCard';
import { MultiFileUpload } from '../components/ai-generator/MultiFileUpload';
import { MarkdownEditor } from '../components/ai-generator/MarkdownEditor';
import { TestCaseDetailModal } from '../components/ai-generator/TestCaseDetailModal';
import { MAX_FILE_SIZE, MAX_FILES } from '../config/upload';
import { SmartCompletionModal } from '../components/ai-generator/SmartCompletionModal';
import type { PreAnalysisResult, UserConfirmation, EnhancedAxureData } from '../types/aiPreAnalysis';
import { clsx } from 'clsx';
import { getCaseTypeInfo } from '../utils/caseTypeHelper';

const { TextArea } = Input;

// 🆕 生成器模式
type GeneratorMode = 'requirement' | 'testcase';

// 需求文档生成步骤
const REQUIREMENT_STEPS = [
  { name: '上传原型', description: '上传 Axure 文件' },
  { name: '生成需求', description: 'AI 生成需求文档' },
  { name: '保存文档', description: '确认并保存' }
];

// 测试用例生成步骤
const TESTCASE_STEPS = [
  { name: '选择需求', description: '选择需求文档' },
  { name: '生成用例', description: '批量生成测试用例' },
  { name: '保存用例', description: '确认并保存' }
];

// 兼容旧的 STEPS（默认使用测试用例步骤）
const STEPS = TESTCASE_STEPS;

/**
 * AI测试用例生成器页面 - 重新设计版本
 */
/**
 * 生成测试用例ID：TC_模块_序号
 * @param moduleName 模块名称
 * @param index 序号（从0开始）
 * @returns 格式化的测试用例ID，例如：TC_LOGIN_00001
 */
function generateTestCaseId(moduleName: string, index: number): string {
  const parts: string[] = ['TC'];
  
  // 1. 添加模块标识
  let moduleCode = 'DEFAULT';
  if (moduleName) {
    // 移除特殊字符，只保留字母数字和中文
    const cleaned = moduleName.trim().replace(/[^\w\u4e00-\u9fa5]/g, '');
    
    // 如果是纯英文，直接转大写
    if (/^[a-zA-Z]+$/.test(cleaned)) {
      moduleCode = cleaned.toUpperCase();
    } else {
      // 如果包含中文，使用拼音首字母或常见模块映射
      const moduleMap: Record<string, string> = {
        '登录': 'LOGIN',
        '注册': 'REGISTER',
        '用户': 'USER',
        '订单': 'ORDER',
        '支付': 'PAYMENT',
        '商品': 'PRODUCT',
        '购物车': 'CART',
        '搜索': 'SEARCH',
        '评价': 'REVIEW',
        '设置': 'SETTINGS',
        '权限': 'PERMISSION',
        '角色': 'ROLE',
        '菜单': 'MENU',
        '系统': 'SYSTEM',
        '数据': 'DATA',
        '报表': 'REPORT',
        '审核': 'AUDIT',
        '消息': 'MESSAGE',
        '通知': 'NOTIFICATION',
      };
      
      moduleCode = moduleMap[cleaned] || cleaned.substring(0, 6).toUpperCase();
    }
  }
  
  parts.push(moduleCode);
  
  // 2. 添加序号（补零到4位）
  const sequence = String(index + 1).padStart(4, '0');
  parts.push(sequence);
  
  return parts.join('_');
}

export function FunctionalTestCaseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);

  // 🆕 生成器模式：需求文档生成 / 测试用例生成
  // 从URL参数读取默认模式（?mode=requirement 或 ?mode=testcase）
  const initialMode = searchParams.get('mode') === 'requirement' ? 'requirement' : 'testcase';
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>(initialMode);
  
  // 🆕 需求文档列表（用于测试用例生成模式）
  const [requirementDocs, setRequirementDocs] = useState<RequirementDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedRequirementDoc, setSelectedRequirementDoc] = useState<RequirementDoc | null>(null);
  
  // 🆕 保存需求文档的状态
  const [docSaving, setDocSaving] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [contentSourceType, setContentSourceType] = useState<'html' | 'pdf' | 'docx' | 'markdown' | 'text'>('html'); // 🆕 文件类型

  // 项目选项（包含版本列表）
  const [systemOptions, setSystemOptions] = useState<Array<{ 
    id: number; 
    name: string;
    project_versions?: Array<{
      id: number;
      version_name: string;
      version_code: string;
      is_main: boolean;
    }>;
  }>>([]);

  // 步骤1状态
  const [axureFiles, setAxureFiles] = useState<File[]>([]);
  const [pageName, setPageName] = useState(''); // 新增:页面名称
  const [pageMode, setPageMode] = useState<'new' | 'modify'>('new'); // 🆕 页面模式：新增/修改
  const [platformType, setPlatformType] = useState<'web' | 'mobile'>('web'); // 🆕 平台类型：Web端/移动端
  const [inputMethod, setInputMethod] = useState<'upload' | 'paste'>('upload'); // 🆕 输入方式：上传文件/粘贴文本
  const [pastedText, setPastedText] = useState(''); // 🆕 粘贴的文本内容
  
  // 🆕 文件预览状态
  const [filePreviewResult, setFilePreviewResult] = useState<FileReadResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [fileContentCopied, setFileContentCopied] = useState(false); // 🆕 文件内容复制状态
  const [filePreviewMode, setFilePreviewMode] = useState<'preview' | 'edit'>('preview'); // 🆕 预览/编辑模式
  
  // 🆕 清空文件预览
  const handleClearPreview = () => {
    setShowFilePreview(false);
    setFilePreviewResult(null);
  };

  // 🆕 复制文件内容
  const handleCopyFileContent = async () => {
    if (!filePreviewResult?.content) {
      showToast.warning('没有可复制的内容');
      return;
    }
    
    try {
      // 方法1：使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(filePreviewResult.content);
        setFileContentCopied(true);
        showToast.success('已复制到剪贴板');
        setTimeout(() => setFileContentCopied(false), 2000);
      } else {
        // 方法2：降级使用传统方法
        const textarea = document.createElement('textarea');
        textarea.value = filePreviewResult.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful) {
          setFileContentCopied(true);
          showToast.success('已复制到剪贴板');
          setTimeout(() => setFileContentCopied(false), 2000);
        } else {
          showToast.error('复制失败，请手动选择并复制');
        }
      }
    } catch (error) {
      console.error('复制失败:', error);
      showToast.error('复制失败，请手动选择并复制');
    }
  };
  const [projectInfo, setProjectInfo] = useState({
    systemName: '',      // 项目名称
    projectShortName: '', // 🆕 项目简称
    projectId: null as number | null,        // 🆕 项目ID
    projectVersionId: null as number | null, // 🆕 项目版本ID
    moduleName: '',      // 模块名称
    businessRules: ''    // 补充业务规则
  });
  const [parseResult, setParseResult] = useState<any>(null);
  const [parsing, setParsing] = useState(false);

  // 加载系统字典选项
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

  // 🆕 加载需求文档列表（测试用例生成模式）
  const loadRequirementDocs = async () => {
    setLoadingDocs(true);
    try {
      const result = await requirementDocService.getList({
        page: 1,
        pageSize: 100,
        status: 'ACTIVE'
      });
      setRequirementDocs(result.data);
    } catch (error: any) {
      console.error('加载需求文档失败:', error);
      showToast.error('加载需求文档失败');
    } finally {
      setLoadingDocs(false);
    }
  };

  // 测试用例模式下加载需求文档
  useEffect(() => {
    if (generatorMode === 'testcase') {
      loadRequirementDocs();
    }
  }, [generatorMode]);

  // 🆕 切换生成器模式
  const handleModeChange = (mode: GeneratorMode) => {
    setGeneratorMode(mode);
    setCurrentStep(0);
    // 重置状态
    setAxureFiles([]);
    setRequirementDoc('');
    setTestScenarios([]);
    setDraftCases([]);
    setSelectedRequirementDoc(null);
    setRequirementDocId(null);
  };

  // 🆕 选择需求文档
  const handleSelectRequirementDoc = (doc: RequirementDoc) => {
    setSelectedRequirementDoc(doc);
    setRequirementDocId(doc.id);
    setRequirementDoc(doc.content);
    // 🆕 设置会话ID（使用需求文档的会话ID或生成新的）
    setSessionId(doc.ai_session_id || `session-${Date.now()}`);
    // 设置项目信息
    if (doc.project) {
      setProjectInfo(prev => ({
        ...prev,
        systemName: doc.project?.name || '',
        projectShortName: doc.project?.short_name || '',  // 🆕 设置项目简称
        projectId: doc.project_id || null,
        projectVersionId: doc.project_version_id || null,
        moduleName: doc.module || ''  // 🔧 设置模块名称
      }));
    }
    console.log('📝 选择需求文档后的projectInfo:', {
      systemName: doc.project?.name || '',
      projectShortName: doc.project?.short_name || '',
      projectId: doc.project_id || null,
      projectVersionId: doc.project_version_id || null,
      moduleName: doc.module || ''
    });
  };

  // 步骤2状态
  const [requirementDoc, setRequirementDoc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sessionId, setSessionId] = useState('');

  // 🆕 预分析相关状态（智能补全）
  const [preAnalysisResult, setPreAnalysisResult] = useState<PreAnalysisResult | null>(null);
  const [preAnalyzing, setPreAnalyzing] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [userConfirmations, setUserConfirmations] = useState<UserConfirmation[]>([]);

  // 步骤3状态 - 🆕 三阶段渐进式（新流程：测试场景 → 测试点 → 测试用例）
  const [testScenarios, setTestScenarios] = useState<any[]>([]); // 测试场景列表
  const [analyzingScenarios, setAnalyzingScenarios] = useState(false); // 是否正在分析场景
  const [generatingPoints, setGeneratingPoints] = useState<Record<string, boolean>>({}); // 哪些场景正在生成测试点
  const [generatingCases, setGeneratingCases] = useState<Record<string, boolean>>({}); // 哪些场景正在生成测试用例
  const [expandedScenarios, setExpandedScenarios] = useState<Record<string, boolean>>({}); // 哪些场景是展开的
  const [expandedTestPoints, setExpandedTestPoints] = useState<Record<string, boolean>>({}); // 哪些测试点是展开的（显示测试用例列表）
  const [draftCases, setDraftCases] = useState<any[]>([]); // 已生成的测试用例草稿
  const [selectedScenarios, setSelectedScenarios] = useState<Record<string, boolean>>({}); // 已选中的测试场景
  const [selectedTestPoints, setSelectedTestPoints] = useState<Record<string, boolean>>({}); // 🆕 已选中的测试点（key: scenarioId-testPointName）
  const [selectedTestCases, setSelectedTestCases] = useState<Record<string, boolean>>({}); // 🆕 已选中的测试用例（key: testCaseId）
  const [savedScenarios, setSavedScenarios] = useState<Record<string, boolean>>({}); // 🆕 已保存的测试场景
  const [saving, setSaving] = useState(false);
  const [requirementDocId, setRequirementDocId] = useState<number | null>(null); // 🆕 需求文档ID
  const [viewingAllCases, setViewingAllCases] = useState<any[]>([]); // 查看全部用例时的用例列表
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0); // 当前查看的用例索引

  // 兼容性：保留旧状态名称（用于向后兼容）
  const testModules = testScenarios;
  const setTestModules = setTestScenarios;
  const analyzingModules = analyzingScenarios;
  const setAnalyzingModules = setAnalyzingScenarios;

  // 详情对话框状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentDetailCase, setCurrentDetailCase] = useState<any>(null);
  
  // 🆕 需求文档详情弹窗状态
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [currentRequirementDoc, setCurrentRequirementDoc] = useState<RequirementDoc | null>(null);
  const [requirementLoading, setRequirementLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🆕 预览指定文件内容（文件上传模式）
  const handlePreviewFile = async (file?: File) => {
    // 如果没有传入文件，尝试自动选择第一个主文件
    let targetFile = file;
    
    if (!targetFile) {
      if (axureFiles.length === 0) {
        AntModal.warning({
          title: '请先上传文件',
          content: '请上传至少一个支持的需求来源文件（HTML / PDF / DOCX / Markdown / TXT）',
          centered: true,
          okText: '知道了'
        });
        return;
      }

      // 验证至少有一个主文件
      const supportedMainExt = ['.html', '.htm', '.pdf', '.docx', '.md', '.markdown', '.txt'];
      targetFile = axureFiles.find(f => supportedMainExt.some(ext => f.name.toLowerCase().endsWith(ext)));
      
      if (!targetFile) {
        AntModal.warning({
          title: '文件格式不支持',
          content: '请至少上传一个支持的需求来源文件（HTML / PDF / DOCX / Markdown / TXT）',
          centered: true,
          okText: '知道了'
        });
        return;
      }
    }

    setPreviewLoading(true);
    
    try {
      console.log('📄 开始读取文件内容:', targetFile.name);
      const result = await readFileContent(targetFile);
      
      if (!result.success) {
        AntModal.error({
          title: '文件读取失败',
          content: result.error || '无法读取文件内容',
          centered: true,
          okText: '知道了'
        });
        return;
      }
      
      console.log('✅ 文件读取成功:', {
        fileName: result.fileName,
        fileType: result.fileType,
        contentLength: result.content.length
      });
      
      setFilePreviewResult(result);
      setShowFilePreview(true);
      showToast.success(`成功读取文件内容（${result.content.length} 字符）`);
    } catch (error: any) {
      console.error('❌ 文件读取错误:', error);
      AntModal.error({
        title: '文件读取失败',
        content: error.message || '读取文件时发生未知错误',
        centered: true,
        okText: '知道了'
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // 步骤1：上传和解析 - 🆕 直接生成需求文档（跳过解析和二次确认）
  const handleParse = async () => {
    // 🆕 验证输入内容（文件或文本）
    if (inputMethod === 'upload') {
      if (axureFiles.length === 0) {
        AntModal.warning({
          title: '请先上传文件',
          content: '请上传至少一个支持的需求来源文件（HTML / PDF / DOCX / Markdown / TXT）',
          centered: true,
          okText: '知道了'
        });
        return;
      }

      // 验证至少有一个主文件（HTML / PDF / DOCX / Markdown / TXT）
      const supportedMainExt = ['.html', '.htm', '.pdf', '.docx', '.md', '.markdown', '.txt'];
      const mainFile = axureFiles.find(f => supportedMainExt.some(ext => f.name.toLowerCase().endsWith(ext)));
      if (!mainFile) {
        AntModal.warning({
          title: '文件格式不支持',
          content: '请至少上传一个支持的需求来源文件（HTML / PDF / DOCX / Markdown / TXT）',
          centered: true,
          okText: '知道了'
        });
        return;
      }
    } else {
      // 粘贴文本模式
      if (!pastedText.trim()) {
        AntModal.warning({
          title: '请输入需求文档内容',
          content: '粘贴文本模式下，需要输入至少 50 个字符的需求文档内容',
          centered: true,
          okText: '知道了'
        });
        return;
      }
      if (pastedText.trim().length < 50) {
        AntModal.warning({
          title: '文本内容过少',
          content: `当前输入了 ${pastedText.trim().length} 个字符，请输入至少 50 个字符`,
          centered: true,
          okText: '知道了'
        });
        return;
      }
    }

    // 🆕 验证页面名称（必填）- 保持页面内验证和UI提示
    if (!pageName.trim()) {
      showToast.error('请填写页面名称');
      return;
    }

    // 🆕 验证必填字段 - 使用弹窗提示
    if (!projectInfo.projectId) {
      AntModal.warning({
        title: '请选择项目',
        content: '项目名称为必填项，请在右侧表单中选择项目',
        centered: true,
        okText: '知道了'
      });
      return;
    }
    if (!projectInfo.projectVersionId) {
      AntModal.warning({
        title: '请选择项目版本',
        content: '项目版本为必填项，请在右侧表单中选择项目版本',
        centered: true,
        okText: '知道了'
      });
      return;
    }
    if (!projectInfo.moduleName.trim()) {
      AntModal.warning({
        title: '请填写模块名称',
        content: '模块名称为必填项，请在右侧表单中填写模块名称',
        centered: true,
        okText: '知道了'
      });
      return;
    }

    // 🔥 修复：先进入步骤2，再显示loading，避免在步骤1下方显示loading
    setCurrentStep(1);
    setParsing(true);
    setGenerating(true);

    try {
      console.log('🚀 使用新的直接生成模式（跳过解析和二次确认）');

      let result;
      
      if (inputMethod === 'upload') {
        // 文件上传模式 - 🔧 先在前端读取并转换文件内容
        const supportedMainExt = ['.html', '.htm', '.pdf', '.docx', '.md', '.markdown', '.txt'];
        const mainFile = axureFiles.find(f => supportedMainExt.some(ext => f.name.toLowerCase().endsWith(ext)))!;
        
        console.log('📄 开始读取并转换文件内容:', mainFile.name);
        
        // 🆕 先读取文件内容，确保转换成功
        const fileReadResult = await readFileContent(mainFile);
        
        if (!fileReadResult.success) {
          throw new Error(`文件读取失败: ${fileReadResult.error || '未知错误'}`);
        }
        
        console.log('✅ 文件内容读取成功，长度:', fileReadResult.content.length);
        
        // 🆕 使用读取后的文本内容生成需求文档
        result = await functionalTestCaseService.generateFromText(
          fileReadResult.content,
          projectInfo.systemName,
          projectInfo.moduleName,
          pageMode,
          projectInfo.businessRules,
          platformType
        );
        
        // 🆕 保存文件类型信息
        setContentSourceType(fileReadResult.fileType.toLowerCase() as any);
      } else {
        // 🆕 文本粘贴模式
        result = await functionalTestCaseService.generateFromText(
          pastedText,
          projectInfo.systemName,
          projectInfo.moduleName,
          pageMode,
          projectInfo.businessRules,
          platformType
        );
      }

      // 设置会话ID和需求文档
      setSessionId(result.data.sessionId);
      setRequirementDoc(result.data.requirementDoc);
      if (inputMethod !== 'upload') {
        setContentSourceType(result.data.contentSourceType || 'text');
      }

      showToast.success(`需求文档生成成功！识别到 ${result.data.sections.length} 个章节`);
    } catch (error: any) {
      showToast.error('生成需求文档失败：' + error.message);
      // 失败时回退到步骤1
      setCurrentStep(0);
    } finally {
      setParsing(false);
      setGenerating(false);
    }
  };

  // 🆕 执行AI预分析（智能补全）
  const performPreAnalysis = async (axureData: any, sid: string) => {
    setPreAnalyzing(true);
    try {
      console.log('🔍 开始AI预分析...');
      const result = await functionalTestCaseService.preAnalyze(sid, axureData);

      setPreAnalysisResult(result.data);

      // 如果有不确定信息，打开智能补全对话框
      if (result.data.uncertainInfo && result.data.uncertainInfo.length > 0) {
        console.log(`📋 识别到 ${result.data.uncertainInfo.length} 个不确定信息`);
        setCompletionModalOpen(true);
      } else {
        // 没有不确定信息，直接生成需求文档
        console.log('✅ 没有不确定信息，直接生成需求文档');
        showToast.info('原型信息完整，直接生成需求文档');
        await generateRequirementDoc(axureData, sid);
      }
    } catch (error: any) {
      console.error('❌ AI预分析失败:', error);
      showToast.warning('AI预分析失败，将使用原始方式生成需求文档');
      // 预分析失败，回退到原始流程
      await generateRequirementDoc(axureData, sid);
    } finally {
      setPreAnalyzing(false);
    }
  };

  // 🆕 处理用户确认（智能补全）
  const handleConfirmations = async (confirmations: UserConfirmation[]) => {
    setUserConfirmations(confirmations);
    setCompletionModalOpen(false);

    console.log('✅ 用户确认完成，开始生成增强需求文档');
    console.log('📊 确认数量:', confirmations.length);
    console.log('📋 确认详情:', confirmations);

    // 构建增强数据
    const enhancedData = buildEnhancedData(confirmations);

    console.log('🔥 增强数据构建完成:');
    console.log('   - 页面类型:', enhancedData.enrichedInfo.pageType);
    console.log('   - 确认的枚举:', enhancedData.enrichedInfo.confirmedEnums);
    console.log('   - 确认的规则:', enhancedData.enrichedInfo.confirmedRules);

    // 使用增强API生成需求文档
    await generateRequirementDocEnhanced(parseResult, sessionId, enhancedData);
  };

  // 🆕 跳过智能补全
  const handleSkipCompletion = async () => {
    setCompletionModalOpen(false);
    showToast.info('已跳过智能补全，使用原始数据生成需求文档');
    await generateRequirementDoc(parseResult, sessionId);
  };

  // 🆕 构建增强数据
  const buildEnhancedData = (confirmations: UserConfirmation[]): EnhancedAxureData => {
    if (!preAnalysisResult) {
      throw new Error('预分析结果不存在');
    }

    const enrichedInfo = {
      pageType: undefined as string | undefined,
      confirmedEnums: {} as Record<string, string[]>,
      confirmedRules: [] as Array<{ field: string; rule: string }>,
      confirmedMeanings: {} as Record<string, string>,
      confirmedValidations: [] as Array<{ field: string; validation: string }>
    };

    // 处理每个用户确认
    confirmations.forEach(conf => {
      if (!conf.confirmed || !conf.userValue) return;

      const uncertainInfo = preAnalysisResult.uncertainInfo.find(u => u.id === conf.id);
      if (!uncertainInfo) return;

      switch (uncertainInfo.type) {
        case 'pageType':
          // 🔥 页面类型确认（最重要！）
          enrichedInfo.pageType = conf.userValue[0]; // 取第一个值（list/form/detail/mixed）
          break;
        case 'enumValues':
          if (uncertainInfo.field) {
            enrichedInfo.confirmedEnums[uncertainInfo.field] = conf.userValue;
          }
          break;
        case 'businessRule':
          if (uncertainInfo.field) {
            enrichedInfo.confirmedRules.push({
              field: uncertainInfo.field,
              rule: conf.userValue.join('; ')
            });
          }
          break;
        case 'fieldMeaning':
          if (uncertainInfo.field) {
            enrichedInfo.confirmedMeanings[uncertainInfo.field] = conf.userValue.join('; ');
          }
          break;
        case 'validationRule':
          if (uncertainInfo.field) {
            enrichedInfo.confirmedValidations.push({
              field: uncertainInfo.field,
              validation: conf.userValue.join('; ')
            });
          }
          break;
      }
    });

    return {
      originalData: parseResult,
      preAnalysis: preAnalysisResult,
      userConfirmations: confirmations,
      enrichedInfo
    };
  };

  // 🆕 生成需求文档（增强版）
  const generateRequirementDocEnhanced = async (
    axureData: any,
    sid: string,
    enhancedData: EnhancedAxureData
  ) => {
    setGenerating(true);
    try {
      const businessRules = (projectInfo.businessRules || '').split('\n').filter(r => r.trim());

      const result = await functionalTestCaseService.generateRequirementEnhanced(
        sid,
        axureData,
        {
          systemName: projectInfo.systemName || '',
          moduleName: projectInfo.moduleName || '',
          businessRules
        },
        enhancedData
      );

      setRequirementDoc(result.data.requirementDoc);
      showToast.success('增强需求文档生成成功！');
    } catch (error: any) {
      showToast.error('生成需求文档失败：' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // 生成需求文档
  const generateRequirementDoc = async (axureData: any, sid?: string) => {
    setGenerating(true);
    try {
      // 安全处理业务规则，避免 undefined 错误
      const businessRules = (projectInfo.businessRules || '').split('\n').filter(r => r.trim());

      // 使用传入的 sessionId 或状态中的 sessionId
      const currentSessionId = sid || sessionId;

      const result = await functionalTestCaseService.generateRequirement(
        currentSessionId,
        axureData,
        {
          systemName: projectInfo.systemName || '',
          moduleName: projectInfo.moduleName || '',
          businessRules
        }
      );

      setRequirementDoc(result.data.requirementDoc);
    } catch (error: any) {
      showToast.error('生成需求文档失败：' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // 🆕 阶段1：智能测试场景拆分
  const handleAnalyzeScenarios = async () => {
    setAnalyzingScenarios(true);
    setCurrentStep(2); // 进入步骤3

    try {
      console.log('🎯 阶段1：开始智能测试场景拆分...');
      const result = await functionalTestCaseService.analyzeTestScenarios(requirementDoc, sessionId); console.log('🚀 测试场景拆分结果:', result);
      console.log('✅ 测试场景拆分完成:', result.data.scenarios);
      const scenarios = result.data.scenarios || result.data.modules || [];
      setTestScenarios(scenarios);
      
      // 🆕 默认展开第一个场景
      if (scenarios.length > 0) {
        setExpandedScenarios({ [scenarios[0].id]: true });
      }
      
      showToast.success(`成功拆分 ${scenarios.length} 个测试场景`);
    } catch (error: any) {
      console.error('❌ 测试场景拆分失败2:', error);
      showToast.error('测试场景拆分失败2：' + error.message || error);
      setCurrentStep(1); // 失败回退到步骤2
    } finally {
      setAnalyzingScenarios(false);
    }
  };

  // 兼容性方法
  const handleAnalyzeModules = handleAnalyzeScenarios;

  // 🆕 阶段2：为指定场景生成测试点（支持重新生成）
  const handleGeneratePoints = async (scenario: any, isRegenerate: boolean = false) => {
    // 验证：必须已有测试场景才能生成测试点
    if (!scenario || !scenario.id) {
      showToast.warning('请先添加测试场景');
      return;
    }

    setGeneratingPoints(prev => ({ ...prev, [scenario.id]: true }));

    try {
      console.log(`🎯 阶段2：${isRegenerate ? '重新' : ''}为场景 "${scenario.name}" 生成测试点...`);
      const result = await functionalTestCaseService.generateTestPointsForScenario(
        scenario.id,
        scenario.name,
        scenario.description,
        requirementDoc,
        scenario.relatedSections,
        sessionId
      );

      console.log('✅ 测试点生成完成:', result.data.testPoints);

      // 更新场景，添加测试点（重新生成时替换，否则追加）
      setTestScenarios(prev => prev.map(s =>
        s.id === scenario.id
          ? {
            ...s,
            testPoints: isRegenerate
              ? result.data.testPoints.map((tp: any) => ({ ...tp, testCases: [] })) // 重新生成时清空测试用例
              : result.data.testPoints
          }
          : s
      ));

      // 如果是重新生成，需要从草稿箱中移除该场景相关的测试用例
      if (isRegenerate) {
        setDraftCases(prev => prev.filter(c => c.scenarioId !== scenario.id));
      }

      // 自动展开该场景
      setExpandedScenarios(prev => ({ ...prev, [scenario.id]: true }));

      showToast.success(`${isRegenerate ? '重新' : ''}为场景 "${scenario.name}" 生成了 ${result.data.testPoints.length} 个测试点`);
    } catch (error: any) {
      console.error('❌ 生成测试点失败:', error);
      showToast.error('生成测试点失败：' + error.message);
    } finally {
      setGeneratingPoints(prev => ({ ...prev, [scenario.id]: false }));
    }
  };

  // 🆕 阶段3：为指定测试点生成测试用例（支持重新生成）
  const handleGenerateTestCaseForPoint = async (testPoint: any, scenario: any, isRegenerate: boolean = false) => {
    // 验证：必须已有测试点才能生成测试用例
    if (!testPoint || !testPoint.testPoint) {
      showToast.warning('请先为测试场景生成测试点');
      return;
    }

    const pointKey = `${scenario.id}-${testPoint.testPoint}`;
    setGeneratingCases(prev => ({ ...prev, [pointKey]: true }));

    try {
      console.log(`🎯 阶段3：${isRegenerate ? '重新' : ''}为测试点 "${testPoint.testPoint}" 生成测试用例...`);
      const result = await functionalTestCaseService.generateTestCaseForTestPoint(
        testPoint,
        scenario.id,
        scenario.name,
        scenario.description || '',
        requirementDoc,
        projectInfo.systemName || '',
        projectInfo.moduleName || '',
        scenario.relatedSections || [],  // 确保不是 undefined
        sessionId
      );

      console.log('✅ 测试用例生成完成:', result.data.testCases);
      console.log('📊 过滤统计:', {
        totalGenerated: result.data.totalGenerated,
        validCount: result.data.validCount,
        filteredCount: result.data.filteredCount
      });

      // 🆕 处理被过滤的用例（带标记）
      const filteredCases = (result.data.filteredCases || []).map((tc: any, index: number) => {
        const moduleName = projectInfo.moduleName || tc.module || '';
        const testCaseId = generateTestCaseId(moduleName, draftCases.length + result.data.testCases.length + index) + '-FILTERED';
        return {
          ...tc,
          id: testCaseId,
          caseId: testCaseId,
          selected: false, // 被过滤的用例默认不选中
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          testPointId: testPoint.testPoint,
          testPointName: testPoint.testPoint,
          isFiltered: true, // 标记为被过滤
          filterReason: tc.filterReason || '数据一致性验证失败'
        };
      });

      // 一个测试点可能生成多个测试用例
      const newCases = result.data.testCases.map((tc: any, index: number) => {
        console.log('🔍 原始测试用例数据:', { 
          name: tc.name, 
          sectionId: tc.sectionId, 
          sectionName: tc.sectionName,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          tcModule: tc.module,
          tcSystem: tc.system,
          projectInfoModule: projectInfo.moduleName,
          projectInfoSystem: projectInfo.systemName
        });
        // 确保测试用例有 testPurpose
        const testPurpose = tc.testPurpose || tc.description || '';

        // 确保每个测试点都有 testPurpose
        const processedTestPoints = (tc.testPoints || []).map((tp: any) => ({
          ...tp,
          testPurpose: tp.testPurpose || testPurpose,
          testScenario: tp.testScenario || scenario.name
        }));

        // 🆕 生成符合规范的测试用例ID
        const moduleName = projectInfo.moduleName || tc.module || '';
        const testCaseId = generateTestCaseId(moduleName, draftCases.length + index);

        return {
          ...tc,
          testPurpose: testPurpose,
          testPoints: processedTestPoints.length > 0 ? processedTestPoints : [{
            testPoint: testPoint.testPoint,
            testPurpose: testPurpose,
            // 🔧 修复：优先使用测试用例自己的步骤和预期结果，而不是测试点级别的默认值
            steps: tc.steps || testPoint.steps || '',
            expectedResult: tc.assertions || tc.expectedResult || testPoint.expectedResult || '',
            riskLevel: tc.riskLevel || testPoint.riskLevel || 'medium',
            testScenario: scenario.name
          }],
          id: testCaseId,  // 🔧 使用格式化的ID
          caseId: testCaseId,  // 🔧 额外保存一份作为显示用的用例编号
          selected: true,
          // 场景信息（用于前端显示和分组）
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          scenarioDescription: scenario.description || null,
          // 🔧 关联需求：使用需求文档的章节信息
          sectionId: tc.sectionId || '',  // 需求文档章节ID（如"1.1"）
          sectionName: tc.sectionName || '',  // 需求文档章节名称（如"登录页面"）
          section_id: tc.sectionId || '',  // 数据库字段
          section_name: tc.sectionName || '',  // 数据库字段
          sectionDescription: tc.sectionDescription || null,
          // 测试场景信息（前端显示用）
          testScenario: scenario.name,
          test_scenario: scenario.name,
          testPointId: testPoint.testPoint,
          testPointName: testPoint.testPoint,
          requirementDocId: requirementDocId,
          requirement_doc_id: requirementDocId,
          module: projectInfo.moduleName || tc.module || '',
          system: projectInfo.systemName || tc.system || ''
        };
      });

      // 如果是重新生成，先移除旧的测试用例
      if (isRegenerate) {
        // 从草稿箱中移除该测试点的旧用例
        setDraftCases(prev => prev.filter(c =>
          !(c.scenarioId === scenario.id && c.testPointId === testPoint.testPoint)
        ));
      }

      // 添加到草稿箱
      setDraftCases(prev => [...prev, ...newCases]);

      // 更新测试点，标记已生成（重新生成时替换，否则追加）
      // 🆕 同时存储有效用例、被过滤用例和统计信息
      setTestScenarios(prev => prev.map(s =>
        s.id === scenario.id
          ? {
            ...s,
            testPoints: s.testPoints?.map((tp: any) =>
              tp.testPoint === testPoint.testPoint
                ? {
                  ...tp,
                  testCases: isRegenerate
                    ? newCases
                    : [...(tp.testCases || []), ...newCases],
                  // 🆕 存储被过滤的用例
                  filteredCases: isRegenerate
                    ? filteredCases
                    : [...(tp.filteredCases || []), ...filteredCases],
                  // 🆕 存储统计信息
                  totalGenerated: isRegenerate
                    ? result.data.totalGenerated
                    : (tp.totalGenerated || 0) + result.data.totalGenerated,
                  filteredCount: isRegenerate
                    ? result.data.filteredCount
                    : (tp.filteredCount || 0) + result.data.filteredCount
                }
                : tp
            )
          }
          : s
      ));

      // 🆕 自动展开场景和测试点，显示生成的测试用例
      setExpandedScenarios(prev => ({ ...prev, [scenario.id]: true }));
      setExpandedTestPoints(prev => ({ ...prev, [pointKey]: true }));

      // 🆕 优化提示信息：包含过滤数量
      const filterInfo = result.data.filteredCount > 0 
        ? `（${result.data.filteredCount} 个因数据一致性问题被过滤）` 
        : '';
      showToast.success(`${isRegenerate ? '重新' : ''}为测试点 "${testPoint.testPoint}" 生成了 ${newCases.length} 个测试用例${filterInfo}`);
    } catch (error: any) {
      console.error('❌ 生成测试用例失败1:', error);
      showToast.error('生成测试用例失败1：' + error);
    } finally {
      setGeneratingCases(prev => ({ ...prev, [pointKey]: false }));
    }
  };

  // 🆕 一键批量生成场景所有测试点的测试用例
  const handleBatchGenerateTestCases = async (scenario: any) => {
    if (!scenario.testPoints || scenario.testPoints.length === 0) {
      showToast.warning('该场景暂无测试点，请先生成测试点');
      return;
    }

    // 验证：确保所有测试点都已存在
    const invalidPoints = scenario.testPoints.filter((tp: any) => !tp || !tp.testPoint);
    if (invalidPoints.length > 0) {
      showToast.warning('存在无效的测试点，请重新生成测试点');
      return;
    }

    // 筛选出还没生成测试用例的测试点
    const pendingPoints = scenario.testPoints.filter((tp: any) => !tp.testCases || tp.testCases.length === 0);

    if (pendingPoints.length === 0) {
      showToast.info('该场景所有测试点都已生成测试用例');
      return;
    }

    showToast.info(`开始为 ${pendingPoints.length} 个测试点批量生成测试用例...`);

    // 确保场景展开
    setExpandedScenarios(prev => ({ ...prev, [scenario.id]: true }));

    // 逐个生成
    for (let i = 0; i < pendingPoints.length; i++) {
      const testPoint = pendingPoints[i];
      try {
        await handleGenerateTestCaseForPoint(testPoint, scenario, false);
        // 每个测试点生成完后稍微延迟
        if (i < pendingPoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`生成测试点 "${testPoint.testPoint}" 的测试用例失败:`, error);
        // 继续生成下一个
      }
    }

    showToast.success(`批量生成完成！共为 ${pendingPoints.length} 个测试点生成了测试用例`);
  };

  // 🔧 切换测试场景选中状态（三级联动）
  const toggleScenarioSelect = (scenarioId: string) => {
    const isCurrentlySelected = selectedScenarios[scenarioId];
    const newScenarioSelected = !isCurrentlySelected;

    // 更新场景选中状态
    setSelectedScenarios(prev => ({
      ...prev,
      [scenarioId]: newScenarioSelected
    }));

    // 🆕 联动更新该场景下所有测试点和测试用例的选中状态
    if (newScenarioSelected) {
      // 勾选场景 -> 勾选所有测试点和用例
      const scenarioCases = draftCases.filter(tc => tc.scenarioId === scenarioId && !tc.saved);
      const newSelectedTestCases = { ...selectedTestCases };
      const newSelectedTestPoints = { ...selectedTestPoints };

      scenarioCases.forEach(tc => {
        newSelectedTestCases[tc.id] = true;
        // 同时勾选测试点
        const pointKey = `${scenarioId}-${tc.testPointId || tc.testPointName}`;
        newSelectedTestPoints[pointKey] = true;
      });

      setSelectedTestCases(newSelectedTestCases);
      setSelectedTestPoints(newSelectedTestPoints);
    } else {
      // 取消勾选场景 -> 取消所有测试点和用例
      const scenarioCases = draftCases.filter(tc => tc.scenarioId === scenarioId && !tc.saved);
      const newSelectedTestCases = { ...selectedTestCases };
      const newSelectedTestPoints = { ...selectedTestPoints };

      scenarioCases.forEach(tc => {
        delete newSelectedTestCases[tc.id];
        // 同时取消测试点
        const pointKey = `${scenarioId}-${tc.testPointId || tc.testPointName}`;
        delete newSelectedTestPoints[pointKey];
      });

      setSelectedTestCases(newSelectedTestCases);
      setSelectedTestPoints(newSelectedTestPoints);
    }
  };

  // 🆕 切换测试点选中状态（联动测试用例）
  const toggleTestPointSelect = (scenarioId: string, testPointName: string) => {
    const pointKey = `${scenarioId}-${testPointName}`;
    const isCurrentlySelected = selectedTestPoints[pointKey];
    const newPointSelected = !isCurrentlySelected;

    // 更新测试点选中状态
    setSelectedTestPoints(prev => ({
      ...prev,
      [pointKey]: newPointSelected
    }));

    // 🆕 联动更新该测试点下所有测试用例的选中状态
    const pointCases = draftCases.filter(tc => 
      tc.scenarioId === scenarioId && 
      (tc.testPointId === testPointName || tc.testPointName === testPointName) &&
      !tc.saved
    );

    const newSelectedTestCases = { ...selectedTestCases };
    pointCases.forEach(tc => {
      if (newPointSelected) {
        newSelectedTestCases[tc.id] = true;
      } else {
        delete newSelectedTestCases[tc.id];
      }
    });
    setSelectedTestCases(newSelectedTestCases);

    // 🆕 检查场景是否应该自动勾选/取消勾选
    if (newPointSelected) {
      // 检查该场景的所有用例是否都被勾选了
      const scenarioCases = draftCases.filter(tc => tc.scenarioId === scenarioId && !tc.saved);
      const allSelected = scenarioCases.every(tc => newSelectedTestCases[tc.id]);
      if (allSelected) {
        setSelectedScenarios(prev => ({ ...prev, [scenarioId]: true }));
      }
    } else {
      // 取消勾选测试点时，自动取消场景勾选
      setSelectedScenarios(prev => {
        const newScenarios = { ...prev };
        delete newScenarios[scenarioId];
        return newScenarios;
      });
    }
  };

  // 🆕 切换测试用例选中状态（反向联动测试点和场景）
  const toggleTestCaseSelect = (testCase: any) => {
    const isCurrentlySelected = selectedTestCases[testCase.id];
    const newCaseSelected = !isCurrentlySelected;

    // 更新测试用例选中状态
    const newSelectedTestCases = {
      ...selectedTestCases,
      [testCase.id]: newCaseSelected ? true : undefined
    };
    if (!newCaseSelected) {
      delete newSelectedTestCases[testCase.id];
    }
    setSelectedTestCases(newSelectedTestCases);

    const scenarioId = testCase.scenarioId;
    const testPointName = testCase.testPointId || testCase.testPointName;
    const pointKey = `${scenarioId}-${testPointName}`;

    if (newCaseSelected) {
      // 勾选用例时，检查该测试点的所有用例是否都被勾选
      const pointCases = draftCases.filter(tc => 
        tc.scenarioId === scenarioId && 
        (tc.testPointId === testPointName || tc.testPointName === testPointName) &&
        !tc.saved
      );
      const allPointCasesSelected = pointCases.every(tc => 
        tc.id === testCase.id ? true : newSelectedTestCases[tc.id]
      );
      
      if (allPointCasesSelected) {
        setSelectedTestPoints(prev => ({ ...prev, [pointKey]: true }));
        
        // 检查该场景的所有用例是否都被勾选
        const scenarioCases = draftCases.filter(tc => tc.scenarioId === scenarioId && !tc.saved);
        const allScenarioCasesSelected = scenarioCases.every(tc => 
          tc.id === testCase.id ? true : newSelectedTestCases[tc.id]
        );
        
        if (allScenarioCasesSelected) {
          setSelectedScenarios(prev => ({ ...prev, [scenarioId]: true }));
        }
      }
    } else {
      // 取消勾选用例时，自动取消测试点和场景勾选
      setSelectedTestPoints(prev => {
        const newPoints = { ...prev };
        delete newPoints[pointKey];
        return newPoints;
      });
      setSelectedScenarios(prev => {
        const newScenarios = { ...prev };
        delete newScenarios[scenarioId];
        return newScenarios;
      });
    }
  };

  // 全选所有已生成测试用例的测试场景
  const selectAllScenarios = () => {
    const newSelections: Record<string, boolean> = {};
    testScenarios.forEach(scenario => {
      // 🔧 修复：检查该场景是否有已生成的测试用例
      const hasGeneratedCases = draftCases.some(tc => tc.scenarioId === scenario.id && !tc.saved);
      if (hasGeneratedCases && !savedScenarios[scenario.id]) {
        newSelections[scenario.id] = true;
      }
    });
    setSelectedScenarios(newSelections);
  };

  // 取消全选
  const deselectAllScenarios = () => {
    setSelectedScenarios({});
  };


  // 打开详情对话框（支持查看单个或全部）
  const handleViewDetail = (testCase: any, allCases?: any[]) => {
    if (allCases && allCases.length > 0) {
      // 查看全部用例模式
      setViewingAllCases(allCases);
      setCurrentCaseIndex(0);
      // 🔥 创建新的对象副本，避免缓存问题
      setCurrentDetailCase({ ...allCases[0] });
    } else {
      // 查看单个用例
      setViewingAllCases([]);
      setCurrentCaseIndex(0);
      // 🔥 创建新的对象副本，避免缓存问题
      setCurrentDetailCase({ ...testCase });
    }
    setDetailModalOpen(true);
  };

  // 🆕 防止快速切换的状态
  const [isSwitching, setIsSwitching] = React.useState(false);

  // 切换查看的用例（在查看全部模式下，带防抖保护）
  const handleSwitchCase = (direction: 'prev' | 'next') => {
    if (viewingAllCases.length === 0) return;
    
    // 🔥 防止快速连续切换
    if (isSwitching) {
      console.log('切换中，请稍候...');
      return;
    }

    let newIndex = currentCaseIndex;
    if (direction === 'prev') {
      newIndex = currentCaseIndex > 0 ? currentCaseIndex - 1 : viewingAllCases.length - 1;
    } else {
      newIndex = currentCaseIndex < viewingAllCases.length - 1 ? currentCaseIndex + 1 : 0;
    }

    // 🔥 设置切换状态，防止快速连续切换
    setIsSwitching(true);
    
    setCurrentCaseIndex(newIndex);
    // 🔥 创建新的对象副本，确保 React 能检测到变化并重新渲染
    setCurrentDetailCase({ ...viewingAllCases[newIndex] });
    
    // 🔥 短暂延迟后解除切换锁定（给组件足够时间完成渲染和数据加载）
    setTimeout(() => {
      setIsSwitching(false);
    }, 300);
  };

  // 🆕 查看需求文档详情（弹窗显示，不跳转页面）
  const handleViewRequirementDoc = async (docId?: number) => {
    const targetDocId = docId || requirementDocId;
    
    if (!targetDocId) {
      setCurrentStep(1);
      showToast.info('请在上方查看需求文档内容');
      return;
    }

    setRequirementModalOpen(true);
    setRequirementLoading(true);
    setCopied(false); // 重置复制状态
    
    try {
      const doc = await requirementDocService.getById(targetDocId);
      setCurrentRequirementDoc(doc);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast.error('加载需求文档失败: ' + errorMessage);
      setRequirementModalOpen(false);
    } finally {
      setRequirementLoading(false);
    }
  };
  
  // 🆕 复制需求文档内容
  const handleCopyRequirementDoc = async () => {
    if (!currentRequirementDoc?.content) {
      showToast.warning('没有可复制的内容');
      return;
    }
    
    try {
      // 方法1：使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentRequirementDoc.content);
        setCopied(true);
        showToast.success('已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
      } else {
        // 方法2：降级使用传统方法
        const textarea = document.createElement('textarea');
        textarea.value = currentRequirementDoc.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful) {
          setCopied(true);
          showToast.success('已复制到剪贴板');
          setTimeout(() => setCopied(false), 2000);
        } else {
          showToast.error('复制失败，请手动选择并复制');
        }
      }
    } catch (error) {
      console.error('复制失败:', error);
      showToast.error('复制失败，请手动选择并复制');
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 保存详情修改
  const handleSaveDetail = (updatedTestCase: any) => {
    // 更新草稿箱中的用例
    setDraftCases(prev =>
      prev.map(c => c.id === updatedTestCase.id ? updatedTestCase : c)
    );

    // 更新当前查看的用例
    setCurrentDetailCase(updatedTestCase);

    // 如果是在查看全部用例模式下，也要更新 viewingAllCases
    if (viewingAllCases.length > 0) {
      setViewingAllCases(prev =>
        prev.map(c => c.id === updatedTestCase.id ? updatedTestCase : c)
      );
    }

    // 更新测试场景中的测试用例（如果存在）
    setTestScenarios(prev =>
      prev.map(scenario => {
        if (scenario.testPoints) {
          const updatedTestPoints = scenario.testPoints.map((tp: any) => {
            if (tp.testCases) {
              return {
                ...tp,
                testCases: tp.testCases.map((tc: any) =>
                  tc.id === updatedTestCase.id ? updatedTestCase : tc
                )
              };
            }
            return tp;
          });
          return { ...scenario, testPoints: updatedTestPoints };
        }
        return scenario;
      })
    );

    showToast.success('测试用例已更新');
  };

  // 保存选中用例（不跳转）- 🔧 基于单个测试用例的勾选状态
  const saveSelectedCases = async () => {
    // 1. 收集所有选中的测试用例（从草稿箱中收集，确保数据完整）
    const selectedCases: any[] = [];
    const selectedScenarioIds = new Set<string>();

    // 🔧 从草稿箱中收集被勾选的用例
    draftCases.forEach(tc => {
      if (selectedTestCases[tc.id] && !tc.saved) {
        const scenario = testScenarios.find(s => s.id === tc.scenarioId);
        if (scenario && !savedScenarios[scenario.id]) {
          // 🆕 构建需求来源信息（直接存储章节信息，不加前缀）
          const requirementSource = scenario.relatedSections?.length > 0 
            ? scenario.relatedSections.join(', ')
            : null;
          
          // 基础字段（新增）
          const baseFields = {
            projectVersionId: projectInfo.projectVersionId,  // 🆕 项目版本ID
            caseType: tc.caseType || 'FULL',                // 🆕 用例类型
            requirementSource,                               // 🆕 需求来源
            sectionId: tc.sectionId || '',                   // 🔧 需求文档章节ID
            sectionName: tc.sectionName || '',               // 🔧 需求文档章节名称
            sectionDescription: tc.sectionDescription || scenario.description || null,
            scenarioName: scenario.name,                     // 🆕 测试场景名称
            scenarioDescription: scenario.description || null, // 🆕 测试场景描述
            system: tc.system || projectInfo.systemName || '', // 🔧 确保system字段
            module: tc.module || projectInfo.moduleName || ''  // 🔧 确保module字段
          };
          
          // 如果测试用例有 testPoints，确保每个测试点都有 testPurpose
          let processedCase;
          if (tc.testPoints && Array.isArray(tc.testPoints)) {
            processedCase = {
              ...tc,
              ...baseFields,
              testPoints: tc.testPoints.map((tp: any) => ({
                ...tp,
                testPurpose: tp.testPurpose || tc.testPurpose || tc.description || ''
              }))
            };
          } else if (tc.testPointName || tc.testPointId) {
            // 如果没有 testPoints，从测试点信息创建
            processedCase = {
              ...tc,
              ...baseFields,
              testPoints: [{
                testPoint: tc.testPointName || tc.testPointId || '',
                testPurpose: tc.testPurpose || tc.description || '',
                steps: tc.steps || '',
                expectedResult: tc.assertions || tc.expectedResult || '',
                riskLevel: tc.riskLevel || 'medium'
              }]
            };
          } else {
            processedCase = { ...tc, ...baseFields };
          }

          selectedCases.push(processedCase);
          selectedScenarioIds.add(scenario.id);
        }
      }
    });

    // 2. 验证选择
    if (selectedCases.length === 0) {
      showToast.warning('请至少选择一个未保存的测试用例');
      return;
    }

    // 3. 调用后端API保存
    setSaving(true);
    try {
      // 🆕 首次保存时创建需求文档
      let docId = requirementDocId;
      if (!docId && requirementDoc) {
        try {
          const doc = await requirementDocService.create({
            title: pageName || `需求文档 - ${projectInfo.systemName || '未命名项目'}`,
            content: requirementDoc,
            summary: `AI生成的需求文档，包含 ${testScenarios.length} 个测试场景`,
            sourceFilename: axureFiles.length > 0 ? axureFiles[0].name : undefined,
            aiSessionId: sessionId,
            projectId: projectInfo.projectId || undefined,
            projectVersionId: projectInfo.projectVersionId || undefined,
            scenarioCount: testScenarios.length,
            system: projectInfo.systemName || undefined,  // 🆕 保存系统名称
            module: projectInfo.moduleName || undefined   // 🆕 保存模块名称
          });
          docId = doc.id;
          setRequirementDocId(doc.id);
          console.log('📄 需求文档创建成功:', doc.id);
        } catch (docError: any) {
          console.error('创建需求文档失败:', docError);
          // 需求文档创建失败不阻塞用例保存
        }
      }

      // 将需求文档ID和模块信息添加到用例中
      const casesWithDocId = selectedCases.map(tc => ({
        ...tc,
        requirementDocId: docId,
        system: tc.system || projectInfo.systemName || '',
        module: tc.module || projectInfo.moduleName || '',
        // 🔧 使用需求文档章节信息（关联需求）
        sectionName: tc.sectionName || tc.section_name || '',
        sectionId: tc.sectionId || tc.section_id || '',
        sectionDescription: tc.sectionDescription || tc.section_description || '',
        // 🔧 确保测试场景信息
        scenarioName: tc.scenarioName || tc.scenario_name || '',
        scenarioDescription: tc.scenarioDescription || tc.scenario_description || ''
      }));

      // 确保有 sessionId
      const finalSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!sessionId) {
        setSessionId(finalSessionId);
      }

      // 调试：打印第一个用例的关键字段
      console.log('📦 准备保存的测试用例 (第1个):', {
        name: casesWithDocId[0]?.name,
        system: casesWithDocId[0]?.system,
        module: casesWithDocId[0]?.module,
        sectionName: casesWithDocId[0]?.sectionName,
        sectionId: casesWithDocId[0]?.sectionId,
        scenarioName: casesWithDocId[0]?.scenarioName,  // 🔧 新增
        scenarioDescription: casesWithDocId[0]?.scenarioDescription,  // 🔧 新增
        requirementDocId: casesWithDocId[0]?.requirementDocId
      });
      console.log('📦 总共准备保存:', casesWithDocId.length, '个测试用例');
      
      await functionalTestCaseService.batchSave(casesWithDocId, finalSessionId);
      showToast.success(`成功保存 ${selectedCases.length} 个测试用例`);

      // 4. 🆕 标记场景为已保存（如果该场景的所有用例都已保存）
      const newSavedScenarios = { ...savedScenarios };
      selectedScenarioIds.forEach(id => {
        const scenarioCases = draftCases.filter(tc => tc.scenarioId === id);
        const allSaved = scenarioCases.every(tc => 
          selectedCases.some(sc => sc.id === tc.id) || tc.saved
        );
        if (allSaved) {
          newSavedScenarios[id] = true;
        }
      });
      setSavedScenarios(newSavedScenarios);

      // 5. 清除已保存用例的选中状态
      const newSelectedTestCases = { ...selectedTestCases };
      const newSelectedTestPoints = { ...selectedTestPoints };
      const newSelectedScenarios = { ...selectedScenarios };
      
      selectedCases.forEach(tc => {
        delete newSelectedTestCases[tc.id];
        const pointKey = `${tc.scenarioId}-${tc.testPointId || tc.testPointName}`;
        delete newSelectedTestPoints[pointKey];
      });
      
      selectedScenarioIds.forEach(id => {
        delete newSelectedScenarios[id];
      });
      
      setSelectedTestCases(newSelectedTestCases);
      setSelectedTestPoints(newSelectedTestPoints);
      setSelectedScenarios(newSelectedScenarios);

      // 6. 🆕 标记草稿箱中的用例为已保存（不移除，只标记）
      setDraftCases(prev =>
        prev.map(c => {
          const isSaved = selectedCases.some(sc => sc.id === c.id);
          return isSaved ? { ...c, saved: true } : c;
        })
      );
    } catch (error: any) {
      showToast.error('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 保存到用例库（并跳转）
  const saveToLibrary = async () => {
    // 🔧 使用 selectedTestCases 来收集选中的用例
    const selectedCases = draftCases.filter(c => selectedTestCases[c.id] && !c.saved);

    if (selectedCases.length === 0) {
      showToast.warning('请至少选择一个用例');
      return;
    }

    // 确保每个测试用例的测试点都包含 testPurpose，并添加新字段
    const processedCases = selectedCases.map(tc => {
      // 🆕 基础字段（新增）
      const baseFields = {
        projectVersionId: tc.projectVersionId || projectInfo.projectVersionId,  // 项目版本ID
        caseType: tc.caseType || 'FULL',                                        // 用例类型
        requirementSource: tc.requirementSource || null,                        // 需求来源
        sectionId: tc.sectionId || '',                                          // 🔧 需求文档章节ID
        sectionName: tc.sectionName || '',                                      // 🔧 需求文档章节名称
        sectionDescription: tc.sectionDescription || null,                      // 🆕 需求章节描述
        scenarioName: tc.scenarioName || '',                                    // 🆕 测试场景名称
        scenarioDescription: tc.scenarioDescription || null,                    // 🆕 测试场景描述
        system: tc.system || projectInfo.systemName || '',                      // 🔧 确保system字段
        module: tc.module || projectInfo.moduleName || ''                       // 🔧 确保module字段
      };
      
      // 如果测试用例有 testPoints，确保每个测试点都有 testPurpose
      if (tc.testPoints && Array.isArray(tc.testPoints)) {
        return {
          ...tc,
          ...baseFields,
          testPoints: tc.testPoints.map((tp: any) => ({
            ...tp,
            testPurpose: tp.testPurpose || tc.testPurpose || tc.description || ''
          }))
        };
      }
      // 如果没有 testPoints，从测试点信息创建
      if (tc.testPointName || tc.testPointId) {
        return {
          ...tc,
          ...baseFields,
          testPoints: [{
            testPoint: tc.testPointName || tc.testPointId || '',
            testPurpose: tc.testPurpose || tc.description || '',
            steps: tc.steps || '',
            expectedResult: tc.assertions || tc.expectedResult || '',
            riskLevel: tc.riskLevel || 'medium'
          }]
        };
      }
      return { ...tc, ...baseFields };
    });

    setSaving(true);
    try {
      // 🆕 首次保存时创建需求文档
      let docId = requirementDocId;
      if (!docId && requirementDoc) {
        try {
          const doc = await requirementDocService.create({
            title: pageName || `需求文档 - ${projectInfo.systemName || '未命名项目'}`,
            content: requirementDoc,
            summary: `AI生成的需求文档，包含 ${testScenarios.length} 个测试场景`,
            sourceFilename: axureFiles.length > 0 ? axureFiles[0].name : undefined,
            aiSessionId: sessionId,
            projectId: projectInfo.projectId || undefined,
            projectVersionId: projectInfo.projectVersionId || undefined,
            scenarioCount: testScenarios.length,
            system: projectInfo.systemName || undefined,  // 🆕 保存系统名称
            module: projectInfo.moduleName || undefined   // 🆕 保存模块名称
          });
          docId = doc.id;
          setRequirementDocId(doc.id);
          console.log('📄 需求文档创建成功:', doc.id);
        } catch (docError: any) {
          console.error('创建需求文档失败:', docError);
          // 需求文档创建失败不阻塞用例保存
        }
      }

      // 将需求文档ID和模块信息添加到用例中
      const casesWithDocId = processedCases.map(tc => ({
        ...tc,
        requirementDocId: docId,
        system: tc.system || projectInfo.systemName || '',
        module: tc.module || projectInfo.moduleName || '',
        // 🔧 使用需求文档章节信息（关联需求）
        sectionName: tc.sectionName || tc.section_name || '',
        sectionId: tc.sectionId || tc.section_id || '',
        sectionDescription: tc.sectionDescription || tc.section_description || '',
        // 🔧 确保测试场景信息
        scenarioName: tc.scenarioName || tc.scenario_name || '',
        scenarioDescription: tc.scenarioDescription || tc.scenario_description || ''
      }));

      // 确保有 sessionId
      const finalSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!sessionId) {
        setSessionId(finalSessionId);
      }

      // 调试：打印第一个用例的关键字段
      console.log('📦 准备保存的测试用例 (第1个):', {
        name: casesWithDocId[0]?.name,
        system: casesWithDocId[0]?.system,
        module: casesWithDocId[0]?.module,
        sectionName: casesWithDocId[0]?.sectionName,
        sectionId: casesWithDocId[0]?.sectionId,
        scenarioName: casesWithDocId[0]?.scenarioName,  // 🔧 新增
        scenarioDescription: casesWithDocId[0]?.scenarioDescription,  // 🔧 新增
        requirementDocId: casesWithDocId[0]?.requirementDocId
      });
      console.log('📦 总共准备保存:', casesWithDocId.length, '个测试用例');
      
      await functionalTestCaseService.batchSave(casesWithDocId, finalSessionId);
      showToast.success(`成功保存 ${processedCases.length} 个用例`);

      setTimeout(() => {
        navigate('/functional-test-cases');
      }, 1500);
    } catch (error: any) {
      showToast.error('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 切换用例选中状态
  const toggleCaseSelect = (id: string) => {
    setDraftCases(prev =>
      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };

  // 全选/取消全选
  const selectAll = () => {
    setDraftCases(prev => prev.map(c => ({ ...c, selected: true })));
  };

  const deselectAll = () => {
    setDraftCases(prev => prev.map(c => ({ ...c, selected: false })));
  };

  // 计算统计数据（用于底部固定栏 - 测试用例生成模式）
  // 🔧 修复：根据测试用例的实际勾选状态计算选中的用例数量
  const selectedCasesCount = Object.keys(selectedTestCases).filter(id => 
    selectedTestCases[id] && draftCases.some(tc => tc.id === id && !tc.saved)
  ).length;
  const avgQuality = draftCases.length > 0
    ? Math.round(draftCases.reduce((sum, c) => sum + (c.qualityScore || 85), 0) / draftCases.length)
    : 0;
  const totalTestPoints = draftCases.reduce((sum, c) => sum + (c.testPoints?.length || 0), 0);

  // 🆕 渲染测试用例模式的步骤1：选择需求文档
  const renderSelectRequirementDoc = () => (
    <StepCard
      stepNumber={1}
      title="选择需求文档"
      description="从已生成的需求文档中选择一个，基于此生成测试用例"
      onNext={() => {
        if (!selectedRequirementDoc) {
          showToast.warning('请先选择一个需求文档');
          return;
        }
        setCurrentStep(1);
      }}
      nextButtonText={selectedRequirementDoc ? '确认需求文档 →' : '请选择需求文档'}
      nextButtonDisabled={!selectedRequirementDoc}
      hideActions={false}
    >
      <div className="space-y-4">
        {/* 需求文档列表 */}
        {loadingDocs ? (
          <div className="flex items-center justify-center py-12">
            <Spin size="large" />
          </div>
        ) : requirementDocs.length === 0 ? (
          <Empty
            className="py-10"
            description={
              <div className="text-center">
                <p className="text-gray-500 mb-3 text-sm">暂无可用的需求文档</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModeChange('requirement')}
                  className="flex items-center justify-center"
                  icon={<Sparkles className="w-4 h-4 mr-2" />}
                  iconPosition="left"
                >
                  去生成需求文档
                </Button>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {requirementDocs.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleSelectRequirementDoc(doc)}
                className={clsx(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  selectedRequirementDoc?.id === doc.id
                    ? "border-purple-500 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20"
                    : "border-gray-200 hover:border-purple-300 hover:shadow-sm bg-white"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <FileText className={clsx(
                        "w-4 h-4",
                        selectedRequirementDoc?.id === doc.id ? "text-purple-600" : "text-gray-400"
                      )} />
                      {/* 🆕 显示文档ID */}
                      <span className="text-[12px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        #{doc.id}
                      </span>
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {doc.title}
                      </h3>
                      {/* 🆕 显示文档状态 */}
                      <span className={clsx(
                        "px-1.5 py-0.5 text-[12px] font-medium rounded-full flex-shrink-0",
                        doc.status === 'ACTIVE' && "bg-green-100 text-green-700 border border-green-300",
                        doc.status === 'ARCHIVED' && "bg-orange-100 text-orange-700 border border-orange-300",
                        doc.status === 'DELETED' && "bg-red-100 text-red-700 border border-red-300"
                      )}>
                        {doc.status === 'ACTIVE' ? '活跃' : doc.status === 'ARCHIVED' ? '已归档' : '已删除'}
                      </span>
                      {selectedRequirementDoc?.id === doc.id && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[12px] font-medium rounded-full flex-shrink-0">
                          已选择
                        </span>
                      )}
                    </div>
                    {doc.summary && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2 ml-6">
                        {doc.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[12px] text-gray-500 ml-6 flex-wrap">
                      {doc.project && (
                        <span className="flex items-center gap-0.5">
                          <FolderOpen className="w-3 h-3" />
                          {doc.project.name}
                          {doc.project_version && ` / ${doc.project_version.version_name}`}
                          {doc.module && ` / ${doc.module}`}
                        </span>
                      )}
                      {doc.source_filename && (
                        <span className="flex items-center gap-0.5">
                          <FileCode className="w-3 h-3" />
                          {doc.source_filename}
                        </span>
                      )}
                      {doc.users && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-3 h-3" />
                          {doc.users.username}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.created_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {/* <span className="flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        {doc.scenario_count} 个场景
                      </span>
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" />
                        {doc.test_case_count} 个用例
                      </span> */}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* 🆕 预览按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewRequirementDoc(doc.id);
                      }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
                      title="预览需求文档"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {/* 选中状态指示器 */}
                    <div className={clsx(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      selectedRequirementDoc?.id === doc.id
                        ? "border-purple-500 bg-purple-500"
                        : "border-gray-300"
                    )}>
                      {selectedRequirementDoc?.id === doc.id && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 刷新按钮 */}
        {requirementDocs.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRequirementDocs}
              disabled={loadingDocs}
            >
              {loadingDocs ? '加载中...' : '刷新列表'}
            </Button>
          </div>
        )}
      </div>
    </StepCard>
  );

  // 渲染步骤1：上传原型（需求文档生成模式）
  const renderStep1 = () => (
    <StepCard
      stepNumber={1}
      title="上传原型 / 需求文档"
      description="AI 直接解析 HTML / PDF / DOCX / Markdown / TXT，或直接粘贴文本内容"
      onNext={handleParse}
      nextButtonText={
        (parsing || generating) 
          ? 'AI生成中...' 
          : previewLoading 
            ? '正在读取文件...' 
            : showFilePreview
              ? '确认并生成需求文档'
              : '开始生成需求文档'
      }
      nextButtonDisabled={parsing || generating || previewLoading}
      hideActions={false}
    >
      {/* 左右分栏布局 */}
      <div className="grid grid-cols-[1.2fr,0.8fr] gap-6">
        {/* 左侧：文件上传区 + 解析结果 */}
        <div className="space-y-4">
          {/* 🆕 输入方式切换 */}
          <div className="bg-gradient-to-br from-blue-50 via-purple-50/50 to-pink-50/30 rounded-xl p-4 border border-purple-200/60 shadow-md">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                <FileText className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">选择输入方式</h3>
            </div>
            
            <Radio.Group
              value={inputMethod}
              onChange={e => {
                setInputMethod(e.target.value);
                // 清空之前的输入
                if (e.target.value === 'upload') {
                  setPastedText('');
                } else {
                  setAxureFiles([]);
                  setShowFilePreview(false);
                  setFilePreviewResult(null);
                }
              }}
              className="w-full radio-group-no-divider"
              buttonStyle="solid"
            >
              <div className="grid grid-cols-2 gap-3">
                <Radio.Button
                  value="upload"
                  className="text-center h-9 leading-[2.25rem] rounded-lg !font-semibold text-sm"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>上传文件</span>
                  </div>
                </Radio.Button>
                <Radio.Button
                  value="paste"
                  className="text-center h-9 leading-[2.25rem] rounded-lg !font-semibold text-sm paste-radio-button"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>粘贴文本</span>
                  </div>
                </Radio.Button>
              </div>
            </Radio.Group>
            <style>{`
              .radio-group-no-divider .ant-radio-button-wrapper:not(:first-child)::before {
                display: none !important;
              }
              .radio-group-no-divider .paste-radio-button::before {
                display: none !important;
              }
              .radio-group-no-divider .ant-radio-button-wrapper {
                border: 1px solid #d9d9d9 !important;
              }
              .radio-group-no-divider .ant-radio-button-wrapper:hover {
                border-color: #4096ff !important;
              }
              .radio-group-no-divider .ant-radio-button-wrapper-checked {
                border-color: #4096ff !important;
              }
            `}</style>

            <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
              {inputMethod === 'upload' ? 
                '📂 支持上传 HTML / PDF / DOCX / Markdown / TXT 文件' : 
                '📝 直接粘贴需求文档内容，无需上传文件（推荐用于文件损坏时）'}
            </p>
          </div>

          {/* 根据输入方式显示不同的输入组件 */}
          {inputMethod === 'upload' ? (
            // 文件上传组件
            <MultiFileUpload
              onFilesChange={setAxureFiles}
              onPageNameChange={setPageName}
              pageMode={pageMode}
              onPageModeChange={setPageMode}
              onPreviewFile={handlePreviewFile}
              onClearPreview={handleClearPreview}
              maxFiles={MAX_FILES} // 使用统一配置
              maxSize={MAX_FILE_SIZE} // 使用统一配置，确保 AI 模型最佳处理效果
            />
          ) : (
            // 🆕 文本输入框
            <>
              {/* 页面名称输入框 */}
              {/* <div className="bg-white rounded-xl p-4 border-2 border-dashed border-blue-300 shadow-md">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900">页面名称 <span className="text-red-500">*</span></h3>
                    <p className="text-xs text-gray-600">为该需求文档命名</p>
                  </div>
                </div>
                
                <Input
                  value={pageName}
                  onChange={e => setPageName(e.target.value)}
                  placeholder="例如：用户登录页"
                  className="w-full "
                  status={!pageName.trim() ? 'error' : ''}
                />
                {!pageName.trim() && (
                  <p className="text-xs text-red-500 mt-1.5">⚠ 页面名称为必填项</p>
                )}
              </div> */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-red-500">*</span> 页面名称
                  </label>
                  <input
                    type="text"
                    value={pageName}
                    onChange={e => setPageName(e.target.value)}
                    placeholder="请输入页面名称，例如：登录页面（新增）"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                  />
                  <p className="mt-2 text-sm text-gray-700">
                    提示：页面名称将用于标识产品需求文档页面，建议使用清晰明确的名称
                  </p>
                </div>
              {/* 文本输入框 */}
              {/* <div className="bg-white rounded-xl p-4 border-2 border-dashed border-purple-300 shadow-md"> */}
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-sm">
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900">输入需求文档内容 <span className="text-red-500">*</span></h3>
                    <p className="text-xs text-gray-600">从 Word 中复制内容后粘贴到下方</p>
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    {pastedText.length} / 至少50 字符
                  </div>
                </div>
                
                <Input.TextArea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="请粘贴需求文档内容...&#10;&#10;💡 提示：&#10;1. 在 Word 中打开文档&#10;2. 全选 (Ctrl+A) → 复制 (Ctrl+C)&#10;3. 粘贴到此处 (Ctrl+V)&#10;4. 点击下方「开始生成需求文档」按钮"
                  className="w-full font-mono text-xs"
                  rows={12}
                  style={{ 
                    resize: 'vertical',
                    minHeight: '250px'
                  }}
                  status={pastedText.length > 0 && pastedText.length < 50 ? 'error' : ''}
                />
                
                {pastedText.length > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                      <span className="font-medium text-gray-900">{pastedText.length}</span> 字符
                      {pastedText.length >= 50 ? (
                        <span className="ml-2 text-green-600 font-medium">✓ 可以生成</span>
                      ) : (
                        <span className="ml-2 text-orange-600 font-medium">⚠ 内容过少</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setPastedText('')}
                      className="text-gray-600"
                    >
                      清空
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 🆕 文件读取中提示 */}
          {previewLoading && (
            <AIThinking
              title="正在读取文件内容..."
              subtitle="正在提取文件中的文本内容，请稍候"
              progressItems={[
                { label: '读取文件数据...', status: 'processing' },
                { label: '解析文件格式', status: 'pending' },
                { label: '提取文本内容', status: 'pending' }
              ]}
            />
          )}

          {/* 🆕 文件内容预览（文件上传模式） */}
          {inputMethod === 'upload' && showFilePreview && filePreviewResult && !parsing && !generating && (
            <motion.div
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200/60 shadow-lg"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  {filePreviewResult.isScannedPdf ? (
                    <AlertTriangle className="w-7 h-7 text-white" />
                  ) : (
                    <CheckCircle className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-blue-900 mb-2">
                    {filePreviewResult.isScannedPdf ? '⚠️ 检测到扫描版PDF' : '文件读取成功！'}
                  </h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center bg-white/60 rounded-lg p-3 border border-blue-200/40">
                      <div className="text-sm text-blue-600 font-medium mb-1">文件名</div>
                      <div className="text-xs text-gray-700 font-semibold truncate">{filePreviewResult.fileName}</div>
                    </div>
                    <div className="text-center bg-white/60 rounded-lg p-3 border border-blue-200/40">
                      <div className="text-sm text-blue-600 font-medium mb-1">文件类型</div>
                      <div className="text-xs text-gray-900 font-bold">{filePreviewResult.fileType}</div>
                    </div>
                    <div className="text-center bg-white/60 rounded-lg p-3 border border-blue-200/40">
                      <div className="text-sm text-blue-600 font-medium mb-1">内容长度</div>
                      <div className="text-xs text-gray-900 font-bold">{filePreviewResult.content.length} 字符</div>
                    </div>
                  </div>
                  
                  {/* 🆕 格式警告信息 */}
                  {filePreviewResult.formatWarnings && filePreviewResult.formatWarnings.length > 0 && (
                    <div className={clsx(
                      "rounded-lg p-4 mb-4 border-2",
                      filePreviewResult.isScannedPdf 
                        ? "bg-red-50 border-red-300"
                        : "bg-orange-50 border-orange-300"
                    )}>
                      <h5 className={clsx(
                        "text-sm font-bold mb-2 flex items-center gap-2",
                        filePreviewResult.isScannedPdf ? "text-red-800" : "text-orange-800"
                      )}>
                        <AlertTriangle className="w-4 h-4" />
                        {filePreviewResult.isScannedPdf ? '严重警告' : '格式提示'}
                      </h5>
                      <ul className={clsx(
                        "text-xs space-y-1.5",
                        filePreviewResult.isScannedPdf ? "text-red-700" : "text-orange-700"
                      )}>
                        {filePreviewResult.formatWarnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-0.5">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* 🆕 额外提示信息 */}
                  {(filePreviewResult.hasImages || filePreviewResult.fileType === 'DOCX') && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800 font-medium flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">💡</span>
                        <span>
                          {filePreviewResult.fileType === 'DOCX' && '已尽可能保留表格、列表、标题等格式结构。'}
                          {filePreviewResult.hasImages && '图片内容无法直接提取，AI将基于文本内容生成需求。如需包含图片描述，请在"补充业务规则"中手动添加。'}
                        </span>
                      </p>
                    </div>
                  )}
                  
                  {/* 文件内容预览 */}
                  <div className="bg-white rounded-lg border border-blue-200 p-4 mb-4">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        文件内容
                        <span className="text-xs text-gray-400 font-normal ml-2">
                          {filePreviewResult.content?.length || 0} 字 · {filePreviewResult.content?.split('\n').length || 0} 行
                        </span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* 🆕 预览/编辑模式切换 */}
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setFilePreviewMode('preview')}
                            className={clsx(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                              filePreviewMode === 'preview'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            预览
                          </button>
                          <button
                            onClick={() => setFilePreviewMode('edit')}
                            className={clsx(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                              filePreviewMode === 'edit'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            )}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            编辑
                          </button>
                        </div>
                        
                        {/* 复制按钮 */}
                        <button
                          onClick={handleCopyFileContent}
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                            fileContentCopied
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                          )}
                        >
                          {fileContentCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              {/* 复制全部 */}
                            </>
                          )}
                        </button>
                        
                        {/* 关闭按钮 */}
                        <button
                          onClick={() => {
                            setShowFilePreview(false);
                            setFileContentCopied(false);
                            setFilePreviewMode('preview');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                        >
                          <X className="w-3.5 h-3.5" />
                          {/* 关闭 */}
                        </button>
                      </div>
                    </div>
                    
                    {/* 预览内容区域 */}
                    <div 
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto select-text"
                      style={{ maxHeight: '400px' }}
                    >
                      {filePreviewMode === 'preview' ? (
                        /* 预览模式：Markdown 渲染或纯文本 */
                        (filePreviewResult.fileType === 'Markdown' || 
                          filePreviewResult.fileType === 'DOCX' || 
                          filePreviewResult.content.includes('# ') ||
                          filePreviewResult.content.includes('## ')) ? (
                          <div
                            className="prose prose-slate max-w-none prose-sm select-text
                              prose-headings:text-gray-900
                              prose-h1:text-xl prose-h1:font-bold prose-h1:mb-3 prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2
                              prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-blue-700
                              prose-h3:text-base prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-2
                              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2
                              prose-ul:my-2 prose-ol:my-2
                              prose-li:text-gray-700 prose-li:my-0.5
                              prose-strong:text-gray-900
                              prose-table:w-full prose-table:border-collapse prose-table:text-xs prose-table:my-3
                              prose-thead:bg-blue-50
                              prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:text-left prose-th:font-semibold
                              prose-td:border prose-td:border-gray-300 prose-td:p-2
                              prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:shadow-sm
                            "
                            dangerouslySetInnerHTML={{ __html: marked.parse(filePreviewResult.content) as string }}
                          />
                        ) : (
                          /* 纯文本预览 */
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-mono max-w-full overflow-wrap-anywhere select-text">
                            {filePreviewResult.content}
                          </pre>
                        )
                      ) : (
                        /* 编辑模式：可编辑的文本框 */
                        <textarea
                          value={filePreviewResult.content}
                          onChange={(e) => {
                            setFilePreviewResult(prev => prev ? {
                              ...prev,
                              content: e.target.value
                            } : null);
                          }}
                          className="w-full h-full min-h-[350px] bg-white border border-gray-300 rounded-lg p-3 text-xs text-gray-700 font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="在此编辑文件内容..."
                          spellCheck={false}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  {/* <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowFilePreview(false);
                        setFilePreviewResult(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      重新选择文件
                    </button>
                    <button
                      onClick={handleParse}
                      disabled={parsing || generating}
                      className="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✨ 确认并生成需求文档
                    </button>
                  </div> */}
                </div>
              </div>
            </motion.div>
          )}

          {/* 🆕 AI生成需求文档进度 */}
          {(parsing || generating) && (
            <AIThinking
              title="正在直接生成需求文档..."
              subtitle="AI正在分析文件并生成结构化需求，预计需要 1-3 分钟"
              progressItems={[
                { label: '读取文件内容...', status: parsing ? 'processing' : 'completed' },
                { label: 'AI分析文件结构和元素', status: generating ? 'processing' : 'pending' },
                { label: '生成章节化需求文档', status: 'pending' }
              ]}
            />
          )}

          {/* 🆕 生成成功提示 */}
          {requirementDoc && !parsing && !generating && (
            <motion.div
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200/60 shadow-md shadow-green-500/10"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-green-900 mb-3">需求文档生成成功！</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center bg-white/60 rounded-lg p-3 border border-green-200/40">
                      <div className="text-2xl font-bold text-green-700 mb-0.5">{requirementDoc.length}</div>
                      <div className="text-xs font-medium text-green-600">文档字符数</div>
                    </div>
                    <div className="text-center bg-white/60 rounded-lg p-3 border border-green-200/40">
                      <div className="text-2xl font-bold text-green-700 mb-0.5">
                        {(requirementDoc.match(/###\s+[\d.]+/g) || []).length}
                      </div>
                      <div className="text-xs font-medium text-green-600">识别章节数</div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-green-700 bg-green-100/80 rounded-lg p-3 border border-green-200/50">
                    💡 AI 已直接分析 {
                      contentSourceType === 'html' ? 'HTML' :
                      contentSourceType === 'pdf' ? 'PDF' :
                      contentSourceType === 'docx' ? 'DOCX' :
                      contentSourceType === 'markdown' ? 'Markdown' :
                      contentSourceType === 'text' ? 'TXT' : '文档'
                    } 并生成需求文档，无需二次确认！
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 右侧：项目信息表单 */}
        <div className="space-y-4">
          {/* 表单卡片 */}
          <div className="bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 rounded-xl p-5 border border-purple-100/50 shadow-md shadow-purple-500/5 sticky top-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600
                              flex items-center justify-center shadow-md shadow-purple-500/25">
              <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-0.5">
                  补充项目信息
                </h3>
                <p className="text-xs font-medium text-gray-600">可选，帮助 AI 更好理解业务</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 平台类型 */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  平台类型 <span className="text-red-500">*</span>
                </label>
                <Radio.Group
                  value={platformType}
                  onChange={e => setPlatformType(e.target.value)}
                  className="w-full"
                  buttonStyle="solid"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Radio.Button
                      value="web"
                      className="text-center text-sm h-8 leading-8"
                    >
                      🖥️ Web端
                    </Radio.Button>
                    <Radio.Button
                      value="mobile"
                      className="text-center text-sm h-8 leading-8"
                    >
                      📱 移动端
                    </Radio.Button>
                  </div>
                </Radio.Group>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {platformType === 'web' ?
                    '识别 PC 端 Web 页面（列表页、表单页、详情页、弹窗等）' :
                    '识别移动端页面（TabBar 导航、卡片列表、长屏详情、多状态画面等）'}
                </p>
              </div>

              {/* 页面模式 */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  页面模式 <span className="text-red-500">*</span>
                </label>
                <Radio.Group
                  value={pageMode}
                  onChange={e => setPageMode(e.target.value)}
                  className="w-full"
                  buttonStyle="solid"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Radio.Button
                      value="new"
                      className="text-center text-sm h-8 leading-8"
                    >
                      🆕 新增页面
                    </Radio.Button>
                    <Radio.Button
                      value="modify"
                      className="text-center text-sm h-8 leading-8"
                    >
                      ✏️ 修改页面
                    </Radio.Button>
                  </div>
                </Radio.Group>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {pageMode === 'new' ?
                    '完整解析页面所有元素和功能' :
                    '识别红色标记的变更点，生成变更摘要'}
                </p>
              </div>

              {/* 项目名称 */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <Select
                  className="w-full compact-select"
                  size="middle"
                  placeholder="请选择项目"
                  value={projectInfo.projectId || undefined}
                  onChange={(value) => {
                    const selectedProject = systemOptions.find(sys => sys.id === value);
                    // 自动选择主线版本
                    const mainVersion = selectedProject?.project_versions?.find(v => v.is_main);
                    setProjectInfo(prev => ({ 
                      ...prev, 
                      projectId: value,
                      systemName: selectedProject?.name || '',
                      projectVersionId: mainVersion?.id || null
                    }));
                  }}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={systemOptions.map(sys => ({
                    label: sys.name,
                    value: sys.id
                  }))}
                />
                <p className="text-xs text-gray-600 mt-1.5">生成的测试用例会自动关联此项目</p>
              </div>

              {/* 项目版本 */}
              {projectInfo.projectId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-2">
                    项目版本 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    className="w-full compact-select"
                    size="middle"
                    placeholder="请选择版本"
                    value={projectInfo.projectVersionId || undefined}
                    onChange={(value) => setProjectInfo(prev => ({ ...prev, projectVersionId: value }))}
                    options={(() => {
                      const selectedProject = systemOptions.find(sys => sys.id === projectInfo.projectId);
                      return (selectedProject?.project_versions || []).map(v => ({
                        label: `${v.version_name} (${v.version_code})${v.is_main ? ' ⭐主线' : ''}`,
                        value: v.id
                      }));
                    })()}
                  />
                  <p className="text-xs text-gray-600 mt-2">生成的测试用例会关联此版本</p>
                </div>
              )}

              {/* 模块名称 */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  模块名称 <span className="text-red-500">*</span>
                </label>
                <Input
                  className="text-sm h-8 leading-8"
                  placeholder="例如：登录模块"
                  value={projectInfo.moduleName}
                  onChange={e => setProjectInfo(prev => ({ ...prev, moduleName: e.target.value }))}
                />
                <p className="text-xs text-gray-600 mt-2">生成的测试用例会自动填充此模块名称</p>
              </div>

              {/* 补充业务规则 */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  补充业务规则 <span className="text-gray-500 font-normal">(选填，辅助 AI 理解)</span>
                </label>
                <TextArea
                  rows={5}
                  placeholder={`每行一条规则，例如：
• 用户名和密码必须同时输入才能提交登录请求
• 密码错误超过5次后账户将被临时锁定10分钟
• 锁定期间再次尝试登录需等待解锁或通过管理员操作
• 登录成功后生成有效会话（Session/Cookie），过期时间为30分钟
• 用户勾选"记住我"后，下次访问自动填充用户名
• 同一账号在不同设备上登录时，旧会话应被强制下线（或提示）
• 验证码在30秒内有效，超时需重新获取
• 输入验证码错误3次后，需重新发送验证码
• 用户名支持中文、英文、数字及常见符号（如 _、.），但不能包含特殊字符如 < > & %
• 密码长度须在8-20位之间，且必须包含大小写字母+数字+特殊字符
• 登录页面应使用HTTPS加密传输，防止密码泄露
• 用户连续登录失败3次后，触发图形验证码机制
• 第三方登录（微信/Apple ID）成功后，需绑定本地账号或创建新账号
• 已注销的账号无法登录，系统应提示"该账号已停用"
• 登录成功后跳转至首页，失败则停留在登录页并显示错误信息
• 系统应记录登录日志，包括时间、IP地址、设备信息
• 手机号登录需先验证短信验证码，且验证码每分钟只能发送一次
• 账户被封禁后，任何登录尝试均返回"账户已被冻结"提示`}
                  value={projectInfo.businessRules}
                  onChange={e => setProjectInfo(prev => ({ ...prev, businessRules: e.target.value }))}
                  className="text-sm"
                />
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  💡 这些规则将作为 AI 提示词的一部分，帮助 AI 更准确地理解需求和生成测试点，不会直接出现在需求文档中
                </p>
              </div>

              {/* 提示信息 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <span className="text-base">💡</span>
                  填写说明
                </h4>
                <ul className="text-sm text-blue-800 space-y-2 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong className="font-semibold text-red-600">页面名称</strong>、<strong className="font-semibold">项目名称</strong>、<strong className="font-semibold">项目版本</strong> 和 <strong className="font-semibold">模块名称</strong> 为必填项，会自动关联到生成的测试用例中</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong className="font-semibold">补充业务规则</strong> 作为 AI 辅助提示，帮助生成更准确的边界条件、异常场景和风险测试点</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>AI 会自动判断用例类型（冒烟/全量），并记录需求来源</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  );

  // 🆕 渲染需求文档模式的步骤2：显示生成的需求文档
  const renderStep2ForRequirement = () => {
    return (
      <StepCard
        stepNumber={2}
        title="AI 生成的需求文档"
        description="您可以编辑修改，确认后进入下一步保存"
        onNext={() => setCurrentStep(2)}
        nextButtonText="确认并保存 →"
        nextButtonDisabled={!requirementDoc || generating}
        hideActions={preAnalyzing || generating}
      >
        {preAnalyzing ? (
          <AIThinking
            title="AI 正在预分析原型..."
            subtitle="识别不确定的关键信息，预计需要 10 秒"
            progressItems={[
              { label: '分析原型结构和字段', status: 'processing' },
              { label: '识别不确定信息', status: 'pending' },
              { label: '生成确认问题', status: 'pending' }
            ]}
          />
        ) : generating ? (
          <AIThinking
            title="AI 正在生成需求文档..."
            subtitle="预计需要 30-90 秒，请耐心等待"
            progressItems={[
              { label: '读取HTML文件内容...', status: 'completed' },
              { label: 'AI分析HTML结构和元素', status: 'processing' },
              { label: '生成结构化需求文档', status: 'pending' }
            ]}
          />
        ) : (
          <div className="space-y-6">
            <MarkdownEditor
              value={requirementDoc}
              onChange={setRequirementDoc}
              placeholder="AI 正在生成需求文档..."
            />
          </div>
        )}
      </StepCard>
    );
  };

  // 🆕 初始化文档标题（当进入保存步骤时）
  useEffect(() => {
    if (generatorMode === 'requirement' && currentStep === 2 && !docTitle) {
      setDocTitle(pageName || `需求文档 - ${projectInfo.systemName || '未命名'}`);
    }
  }, [generatorMode, currentStep, pageName, projectInfo.systemName]);

  // 🆕 保存需求文档（支持覆盖已有文档）
  const handleSaveRequirementDoc = async () => {
    if (!requirementDoc) {
      showToast.warning('需求文档内容为空');
      return;
    }

    const finalTitle = docTitle || `需求文档 - ${projectInfo.systemName || '未命名'}`;
    
    setDocSaving(true);
    try {
      // 先检查是否存在同名文档
      const existingDocs = await requirementDocService.getList({
        page: 1,
        pageSize: 100,
        search: finalTitle,
        status: 'ACTIVE'
      });
      
      // 查找完全匹配标题的文档
      const existingDoc = existingDocs.data.find(d => d.title === finalTitle);
      
      let doc;
      if (existingDoc) {
        // 存在同名文档，提示用户是否覆盖
        const shouldOverwrite = confirm(`已存在同名需求文档"${finalTitle}"，是否覆盖？\n\n点击"确定"覆盖更新，点击"取消"将创建新文档。`);
        
        if (shouldOverwrite) {
          // 覆盖更新
          doc = await requirementDocService.update(existingDoc.id, {
            content: requirementDoc,
            summary: `AI生成的需求文档，包含页面功能描述（已更新）`,
            projectId: projectInfo.projectId || undefined,
            projectVersionId: projectInfo.projectVersionId || undefined,
            system: projectInfo.systemName || undefined,  // 🆕 更新系统名称
            module: projectInfo.moduleName || undefined   // 🆕 更新模块名称
          });
          showToast.success('需求文档已更新！');
        } else {
          // 创建新文档（添加时间戳避免重名）
          const timestamp = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          doc = await requirementDocService.create({
            title: `${finalTitle} (${timestamp})`,
            content: requirementDoc,
            summary: `AI生成的需求文档，包含页面功能描述`,
            sourceFilename: axureFiles.length > 0 ? axureFiles[0].name : undefined,
            aiSessionId: sessionId,
            projectId: projectInfo.projectId || undefined,
            projectVersionId: projectInfo.projectVersionId || undefined,
            scenarioCount: 0,
            system: projectInfo.systemName || undefined,  // 🆕 保存系统名称
            module: projectInfo.moduleName || undefined   // 🆕 保存模块名称
          });
          showToast.success('需求文档保存成功！');
        }
      } else {
        // 不存在同名文档，直接创建
        doc = await requirementDocService.create({
          title: finalTitle,
          content: requirementDoc,
          summary: `AI生成的需求文档，包含页面功能描述`,
          sourceFilename: axureFiles.length > 0 ? axureFiles[0].name : undefined,
          aiSessionId: sessionId,
          projectId: projectInfo.projectId || undefined,
          projectVersionId: projectInfo.projectVersionId || undefined,
          scenarioCount: 0,
          system: projectInfo.systemName || undefined,  // 🆕 保存系统名称
          module: projectInfo.moduleName || undefined   // 🆕 保存模块名称
        });
        showToast.success('需求文档保存成功！');
      }
      
      setRequirementDocId(doc.id);
      
      // 询问是否继续生成测试用例
      setTimeout(() => {
        if (confirm('需求文档已保存，是否继续生成测试用例？')) {
          setSelectedRequirementDoc(doc as any);
          handleModeChange('testcase');
          setCurrentStep(0);
          loadRequirementDocs();
        } else {
          navigate('/requirement-docs');
        }
      }, 500);
    } catch (error: any) {
      showToast.error('保存失败：' + error.message);
    } finally {
      setDocSaving(false);
    }
  };

  // 🆕 渲染需求文档模式的步骤3：保存需求文档
  const renderSaveRequirementDoc = () => {
    return (
      <StepCard
        stepNumber={3}
        title="保存需求文档"
        description="确认文档标题并保存到需求文档库"
        hideActions={true}
      >
        <div className="space-y-6">
          {/* 文档标题 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              文档标题
            </label>
            <Input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="输入文档标题"
              size="large"
            />
          </div>

          {/* 文档预览 - 纯预览模式，不可编辑 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">
                文档预览
              </label>
              <span className="text-xs text-gray-500">{requirementDoc.length} 字</span>
            </div>
            <div 
              className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm overflow-auto"
              style={{ maxHeight: '400px' }}
            >
              <div
                className="prose prose-slate max-w-none prose-sm
                  prose-headings:text-gray-900
                  prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-blue-700
                  prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
                  prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-3
                  prose-ul:my-3 prose-ol:my-3
                  prose-li:text-gray-700 prose-li:my-1
                  prose-strong:text-gray-900
                  prose-table:w-full prose-table:border-collapse prose-table:text-sm prose-table:my-4
                  prose-thead:bg-blue-50
                  prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:text-left prose-th:font-semibold
                  prose-td:border prose-td:border-gray-300 prose-td:p-2
                "
                dangerouslySetInnerHTML={{ __html: marked.parse(requirementDoc) as string }}
              />
            </div>
          </div>

          {/* 关联信息 */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-100">
            <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              关联信息
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">项目：</span>
                <span className="text-gray-900">{projectInfo.systemName || '未选择'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">模块：</span>
                <span className="text-gray-900">{projectInfo.moduleName || '未填写'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">文件数：</span>
                <span className="text-gray-900">{axureFiles.length} 个</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">文档字数：</span>
                <span className="text-gray-900">{requirementDoc.length} 字</span>
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center px-5 py-2.5 text-gray-700 bg-white border border-gray-300 
                rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回编辑
            </button>
            <button
              onClick={handleSaveRequirementDoc}
              disabled={docSaving || !docTitle.trim()}
              className={clsx(
                "inline-flex items-center px-6 py-2.5 rounded-lg font-medium transition-all shadow-md",
                docSaving || !docTitle.trim()
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 hover:shadow-lg"
              )}
            >
              {docSaving ? (
                <>
                  <Spin size="small" className="mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存需求文档
                </>
              )}
            </button>
          </div>
        </div>
      </StepCard>
    );
  };

  // 渲染步骤2：需求文档（测试用例生成模式）
  const renderStep2 = () => {
    // 🆕 检查是否已有场景，如果有则显示"查看测试场景"按钮
    const hasExistingScenarios = testScenarios.length > 0;
    
    return (
    <StepCard
      stepNumber={2}
      title="AI 生成的需求文档"
      description="您可以编辑修改，以获得更精准的测试用例"
      onNext={hasExistingScenarios ? () => setCurrentStep(2) : handleAnalyzeScenarios}
      nextButtonText={
        analyzingScenarios 
          ? '分析测试场景中...' 
          : hasExistingScenarios 
            ? `查看测试场景 (${testScenarios.length}个) →`
            : '立即生成测试场景 →'
      }
      nextButtonDisabled={analyzingScenarios}
      hideActions={preAnalyzing || generating || analyzingScenarios}
    >
      {preAnalyzing ? (
        <AIThinking
          title="AI 正在预分析原型..."
          subtitle="识别不确定的关键信息，预计需要 10 秒"
          progressItems={[
            { label: '分析原型结构和字段', status: 'processing' },
            { label: '识别不确定信息', status: 'pending' },
            { label: '生成确认问题', status: 'pending' }
          ]}
        />
      ) : generating ? (
        <AIThinking
          title="AI 正在生成需求文档..."
          subtitle="预计需要 30-90 秒，请耐心等待（最长3分钟）"
          progressItems={[
            { label: '已分析原型结构', status: 'completed' },
            { label: '正在理解业务逻辑...', status: 'processing' },
            { label: '生成详细需求文档（包含字段定义、校验规则等）', status: 'pending' }
          ]}
        />
      ) : (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-200/60 shadow-inner">
          <MarkdownEditor
            value={requirementDoc}
            onChange={setRequirementDoc}
            placeholder="AI 正在生成需求文档..."
            rows={24}
          />
        </div>
      )}
    </StepCard>
  );
  };

  // 🆕 优先级排序函数（高优先级在前）
  const getPriorityOrder = (priority?: string): number => {
    switch (priority) {
      case 'high': return 0;
      case 'medium': return 1;
      case 'low': return 2;
      default: return 3; // 无优先级排最后
    }
  };

  // 🆕 风险等级排序函数（高风险在前）
  const getRiskLevelOrder = (riskLevel?: string): number => {
    switch (riskLevel) {
      case 'high': return 0;
      case 'medium': return 1;
      case 'low': return 2;
      default: return 3; // 无风险等级排最后
    }
  };

  // 🆕 用例类型排序函数（冒烟用例优先）
  const getCaseTypeOrder = (caseType?: string): number => {
    switch (caseType) {
      case 'SMOKE': return 0; // 冒烟用例最优先
      case 'FULL': return 1;
      case 'ABNORMAL': return 2;
      case 'BOUNDARY': return 3;
      default: return 4; // 其他类型排最后
    }
  };

  // 渲染步骤3：三阶段渐进式生成（新流程：测试场景 → 测试点 → 测试用例）
  const renderStep3 = () => {
    // 🆕 计算实际选中的用例数量（基于单个用例的勾选状态）
    const selectedCaseCount = Object.keys(selectedTestCases).filter(id => 
      selectedTestCases[id] && draftCases.some(tc => tc.id === id && !tc.saved)
    ).length;

    // 🆕 对测试场景进行排序：高优先级在前
    const sortedTestScenarios = [...testScenarios].sort((a, b) => {
      const priorityA = getPriorityOrder(a.priority);
      const priorityB = getPriorityOrder(b.priority);
      return priorityA - priorityB;
    });

    return (
      <div className="space-y-6">
        {/* 阶段1：分析测试场景中 */}
        {analyzingScenarios && (
          <AIThinking
            title="AI 正在分析测试场景..."
            subtitle="根据需求文档识别不同的测试场景（查询条件、列表展示、操作按钮等）"
            progressItems={[
              { label: '分析需求文档', status: 'processing' },
              { label: '识别页面类型', status: 'pending' },
              { label: '拆分测试场景', status: 'pending' }
            ]}
          />
        )}

        {/* 测试场景列表 */}
        {sortedTestScenarios.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-bold text-gray-900">
                测试场景
                <span className="ml-3 text-lg font-semibold text-gray-500">（共 {sortedTestScenarios.length} 个）</span>
              </h3>
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                点击"生成测试点"按钮开始第二阶段，然后为每个测试点生成测试用例
              </span>
            </div>

            {/* 场景卡片列表 */}
            {sortedTestScenarios.map((scenario) => {
              const isExpanded = expandedScenarios[scenario.id];
              const isGeneratingPointsForScenario = generatingPoints[scenario.id];
              const hasTestPoints = scenario.testPoints && scenario.testPoints.length > 0;
              // 🔧 修复：检查该场景是否有已生成的测试用例（从草稿箱中查找）
              const hasGeneratedCases = draftCases.some(tc => tc.scenarioId === scenario.id && !tc.saved);
              const isSelected = selectedScenarios[scenario.id];
              const isSaved = savedScenarios[scenario.id];
              
              // 🆕 计算半选状态（有部分用例被选中但未全选）
              const scenarioCases = draftCases.filter(tc => tc.scenarioId === scenario.id && !tc.saved);
              const selectedCasesInScenario = scenarioCases.filter(tc => selectedTestCases[tc.id]).length;
              const isIndeterminate = !isSelected && selectedCasesInScenario > 0 && selectedCasesInScenario < scenarioCases.length;

              return (
                <motion.div
                  key={scenario.id}
                  className={clsx(
                    "bg-white rounded-xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-all",
                    isSaved
                      ? "border-green-300 bg-green-50/30"
                      : isSelected
                        ? "border-purple-500 shadow-lg ring-4 ring-purple-500/20"
                        : "border-gray-200"
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* 场景头部 */}
                  <div className="p-6 bg-gradient-to-r from-gray-50 via-white to-purple-50/30">
                    <div className="space-y-3">
                      {/* 第一层：场景名称、优先级和操作按钮（全部在一行） */}
                      <div className="flex items-center justify-between gap-4">
                        {/* 左侧：复选框 + 场景名称 + 优先级 */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* 复选框 */}
                          <input
                            type="checkbox"
                            checked={isSelected || false}
                            disabled={!hasGeneratedCases || isSaved}
                            onChange={() => toggleScenarioSelect(scenario.id)}
                            ref={(el) => {
                              if (el) el.indeterminate = isIndeterminate;
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          />
                          
                          {/* 场景名称 */}
                          <h4 className="text-xl font-bold text-gray-900">
                            {scenario.name}
                          </h4>
                          
                          {/* 优先级标签 */}
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0",
                            scenario.priority === 'high' && "bg-red-100 text-red-700 border border-red-200",
                            scenario.priority === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                            scenario.priority === 'low' && "bg-green-100 text-green-700 border border-green-200"
                          )}>
                            {scenario.priority === 'high' ? '高优先级' : scenario.priority === 'medium' ? '中优先级' : '低优先级'}
                          </span>
                        </div>
                        
                        {/* 右侧：操作按钮 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* 生成测试点按钮 */}
                          {!hasTestPoints && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleGeneratePoints(scenario, false)}
                              isLoading={isGeneratingPointsForScenario}
                              disabled={isGeneratingPointsForScenario}
                            >
                              {isGeneratingPointsForScenario ? '生成中...' : '生成测试点'}
                            </Button>
                          )}

                          {/* 重新生成测试点按钮 */}
                          {hasTestPoints && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGeneratePoints(scenario, true)}
                              isLoading={isGeneratingPointsForScenario}
                              disabled={isGeneratingPointsForScenario}
                            >
                              {isGeneratingPointsForScenario ? '重新生成中...' : '重新生成测试点'}
                            </Button>
                          )}

                          {/* 一键批量生成测试用例按钮 */}
                          {hasTestPoints && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleBatchGenerateTestCases(scenario)}
                              disabled={isGeneratingPointsForScenario}
                            >
                              ⚡ 一键生成用例
                            </Button>
                          )}

                          {/* 展开/折叠测试点列表按钮 */}
                          {hasTestPoints && (
                            <button
                              onClick={() => {
                                setExpandedScenarios(prev => ({ ...prev, [scenario.id]: !prev[scenario.id] }));
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title={isExpanded ? '折叠测试点列表' : '展开测试点列表'}
                            >
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ArrowRight className="w-5 h-5 text-gray-600" />
                              </motion.div>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* 第二层：场景描述、关联需求和统计信息（下层） */}
                      <div className="space-y-2">
                        {/* 场景描述 */}
                        <p className="text-base text-gray-600 leading-relaxed">
                          {scenario.description}
                        </p>
                        
                        {/* 关联需求和统计信息 */}
                        <div className="flex items-center  gap-4 flex-wrap">
                          {/* 左侧：关联需求 */}
                          {scenario.relatedSections && scenario.relatedSections.length > 0 && requirementDocId && (
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                              <span className="inline-flex items-center gap-1 text-gray-600 flex-shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="font-medium">关联需求:</span>
                              </span>
                              {scenario.relatedSections.map((section: string, idx: number) => (
                                <Tooltip 
                                  key={`${scenario.id}-section-${idx}-${section}`}
                                  title="点击查看需求文档"
                                >
                                  <button
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 
                                      text-xs rounded border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap"
                                    onClick={() => handleViewRequirementDoc(requirementDocId)}
                                  >
                                    <span>📄</span>
                                    {section}
                                  </button>
                                </Tooltip>
                              ))}
                            </div>
                          )}
                          
                          {/* 右侧：统计信息卡片 */}
                          <div className="flex items-center gap-0 flex-shrink-0">
                            {/* 预估测试点数量 */}
                            {scenario.estimatedTestPoints && (
                              <div className="flex items-center gap-2  px-2 py-0.4 rounded-lg ">
                              {/* <div className="flex items-center gap-2 bg-blue-50 px-4 py-0.4 rounded-lg border border-blue-200"> */}
                                <Target className="w-4 h-4 text-blue-600" />
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xs text-blue-600 font-medium">预估</span>
                                  <span className="font-bold text text-blue-700">{scenario.estimatedTestPoints}</span>
                                  <span className="text-xs text-blue-600">个测试点</span>
                                </div>
                              </div>
                            )}
                            {/* 已生成测试点数量 */}
                            {hasTestPoints && (
                              <div className="flex items-center gap-2 px-2 py-0.4 rounded-lg ">
                              {/* <div className="flex items-center gap-2 bg-green-50 px-4 py-0.4 rounded-lg border border-green-200"> */}
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xs text-green-600 font-medium">已生成</span>
                                  <span className="font-bold text text-green-700">{scenario.testPoints.length}</span>
                                  <span className="text-xs text-green-600">个测试点</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 已保存标记 */}
                        {isSaved && (
                          <div className="flex items-center gap-2 text-sm font-bold text-green-700">
                            <CheckCircle className="w-4 h-4 fill-green-700" />
                            <span>✅ 已保存到用例库</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 测试点列表（可展开） */}
                  <AnimatePresence>
                    {isExpanded && hasTestPoints && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200 bg-gray-50"
                      >
                        <div className="p-5 space-y-3">
                          <p className="text-sm font-medium text-gray-700 mb-3">
                            测试点列表（共 {scenario.testPoints.length} 个）
                          </p>

                          {/* 🆕 对测试点进行排序：高风险在前 */}
                          {[...(scenario.testPoints || [])].sort((a: any, b: any) => {
                            const riskA = getRiskLevelOrder(a.riskLevel);
                            const riskB = getRiskLevelOrder(b.riskLevel);
                            return riskA - riskB;
                          }).map((testPoint: any, index: number) => {
                            const pointKey = `${scenario.id}-${testPoint.testPoint}`;
                            const isGeneratingCase = generatingCases[pointKey];
                            const hasTestCases = testPoint.testCases && testPoint.testCases.length > 0;
                            const testCasesCount = testPoint.testCases?.length || 0;
                            // 🆕 获取被过滤的用例数量
                            const filteredCasesCount = testPoint.filteredCases?.length || testPoint.filteredCount || 0;
                            const hasFilteredCases = filteredCasesCount > 0;
                            // 🆕 计算实际生成总数（有效 + 被过滤）
                            const actualTotalGenerated = testPoint.totalGenerated || (testCasesCount + filteredCasesCount);
                            const isTestPointExpanded = expandedTestPoints[pointKey];
                            const isTestPointSelected = selectedTestPoints[pointKey];
                            
                            // 🆕 计算测试点的半选状态
                            const pointCases = draftCases.filter(tc => 
                              tc.scenarioId === scenario.id && 
                              (tc.testPointId === testPoint.testPoint || tc.testPointName === testPoint.testPoint) &&
                              !tc.saved
                            );
                            const selectedCasesInPoint = pointCases.filter(tc => selectedTestCases[tc.id]).length;
                            const isPointIndeterminate = !isTestPointSelected && selectedCasesInPoint > 0 && selectedCasesInPoint < pointCases.length;

                            return (
                              <div key={index}>
                                {/* 测试点卡片 */}
                                <div className="rounded-xl p-6 border-2 bg-white border-gray-200 hover:border-purple-400 transition-all shadow-md hover:shadow-lg">
                                  <div className="flex items-start justify-between gap-5">
                                    <div className="flex items-start gap-4 flex-1">
                                      {/* 🆕 勾选框 */}
                                      {hasTestCases && !isSaved && (
                                        <div className="pt-1 mr-2">
                                          <input
                                            type="checkbox"
                                            checked={isTestPointSelected || false}
                                            onChange={() => toggleTestPointSelect(scenario.id, testPoint.testPoint)}
                                            ref={(el) => {
                                              if (el) el.indeterminate = isPointIndeterminate;
                                            }}
                                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                      )}
                                      {/* 序号 */}
                                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600
                                                      flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-lg shadow-purple-500/30">
                                        {index + 1}
                                      </div>

                                      {/* 测试点信息 */}
                                      <div className="flex-1 min-w-0">
                                        {/* 标题和风险等级 */}
                                        <div className="flex items-center gap-3 mb-3">
                                          <h5 className="font-bold text-gray-900 text-lg">
                                            {testPoint.testPoint}
                                          </h5>
                                          <span className={clsx(
                                            "px-3 py-1.5 rounded-full text-xs font-semibold",
                                            testPoint.riskLevel === 'high' && "bg-red-100 text-red-700 border border-red-200",
                                            testPoint.riskLevel === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                                            testPoint.riskLevel === 'low' && "bg-green-100 text-green-700 border border-green-200"
                                          )}>
                                            {testPoint.riskLevel === 'high' ? '高风险' : testPoint.riskLevel === 'medium' ? '中风险' : '低风险'}
                                          </span>
                                        </div>

                                        {/* 测试点描述 */}
                                        {testPoint.description && (
                                          <p className="text-base text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                            {testPoint.description}
                                          </p>
                                        )}

                                        {/* 覆盖范围和预估信息 */}
                                        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-600">
                                          {testPoint.coverageAreas && (
                                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                                              <span className="font-semibold text-gray-700">覆盖范围:</span>
                                              <span className="text-gray-900 font-medium">{testPoint.coverageAreas}</span>
                                            </div>
                                          )}
                                          {/* 预估用例数量 - 生成后更新为实际总数 */}
                                          {(testPoint.estimatedTestCases || hasTestCases) && (
                                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                                              <span className="font-semibold text-gray-700">
                                                {hasTestCases ? '已生成:' : '预估用例:'}
                                              </span>
                                              <span className="text-blue-600 font-bold">
                                                {hasTestCases ? actualTotalGenerated : testPoint.estimatedTestCases} 个
                                              </span>
                                            </div>
                                          )}
                                          {/* 已生成用例数量（有效） */}
                                          {hasTestCases && (
                                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                                              <CheckCircle className="w-4 h-4" />
                                              <span className="font-semibold">有效 {testCasesCount} 个</span>
                                            </div>
                                          )}
                                          {/* 🆕 被过滤用例数量 */}
                                          {hasFilteredCases && (
                                            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">
                                              <AlertTriangle className="w-4 h-4" />
                                              <span className="font-semibold">过滤 {filteredCasesCount} 个</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* 操作按钮组 - 统一模式：与测试场景和测试点一致 */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {/* 生成测试用例按钮 - 与"生成测试点"按钮样式一致 */}
                                      {!hasTestCases && (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleGenerateTestCaseForPoint(testPoint, scenario, false)}
                                          isLoading={isGeneratingCase}
                                          disabled={isGeneratingCase}
                                        >
                                          {isGeneratingCase ? '生成中...' : '生成用例'}
                                        </Button>
                                      )}

                                      {/* 重新生成测试用例按钮 */}
                                      {hasTestCases && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleGenerateTestCaseForPoint(testPoint, scenario, true)}
                                          isLoading={isGeneratingCase}
                                          disabled={isGeneratingCase}
                                        >
                                          {isGeneratingCase ? '重新生成中...' : '重新生成用例'}
                                        </Button>
                                      )}

                                      {/* 展开/折叠测试用例列表按钮 - 与测试场景展开按钮一致 */}
                                      {hasTestCases && (
                                        <button
                                          onClick={() => {
                                            setExpandedTestPoints(prev => ({ ...prev, [pointKey]: !prev[pointKey] }));
                                          }}
                                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                          title={isTestPointExpanded ? '折叠用例列表' : '展开用例列表'}
                                        >
                                          <motion.div
                                            animate={{ rotate: isTestPointExpanded ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                          >
                                            <ArrowRight className="w-5 h-5 text-gray-600" />
                                          </motion.div>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 测试用例列表（可展开，类似测试场景和测试点的关系） */}
                                <AnimatePresence>
                                  {isTestPointExpanded && (hasTestCases || hasFilteredCases) && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="border-t border-gray-200 bg-gray-50 mt-3"
                                    >
                                      <div className="p-5 space-y-3">
                                        <div className="flex items-center gap-4 mb-3">
                                          <p className="text-sm font-medium text-gray-700">
                                            测试用例列表（共 {testCasesCount} 个{hasFilteredCases ? `，过滤 ${filteredCasesCount} 个` : ''}）
                                          </p>
                                        </div>
                                        {/* 🆕 合并有效用例和被过滤用例，对测试用例进行排序：有效优先，然后冒烟用例优先，然后按优先级排序 */}
                                        {[
                                          ...(testPoint.testCases || []).map((tc: any) => ({ ...tc, _isFiltered: false })),
                                          ...(testPoint.filteredCases || []).map((tc: any) => ({ ...tc, _isFiltered: true }))
                                        ].sort((a: any, b: any) => {
                                          // 🆕 首先有效用例排在被过滤用例前面
                                          if (a._isFiltered !== b._isFiltered) {
                                            return a._isFiltered ? 1 : -1;
                                          }
                                          // 首先按用例类型排序（冒烟用例优先）
                                          const typeA = getCaseTypeOrder(a.caseType);
                                          const typeB = getCaseTypeOrder(b.caseType);
                                          if (typeA !== typeB) {
                                            return typeA - typeB;
                                          }
                                          // 用例类型相同时，按优先级排序
                                          const priorityA = getPriorityOrder(a.priority);
                                          const priorityB = getPriorityOrder(b.priority);
                                          return priorityA - priorityB;
                                        }).map((tc: any, tcIndex: number) => {
                                          const isTestCaseSelected = selectedTestCases[tc.id];
                                          const isFilteredCase = tc._isFiltered || tc.isFiltered;
                                          
                                          return (
                                          <div
                                            key={tcIndex}
                                            className={clsx(
                                              "rounded-xl p-5 border-2 transition-all shadow-md hover:shadow-lg",
                                              isFilteredCase 
                                                ? "bg-orange-50 border-orange-300 opacity-70" // 🆕 被过滤用例的特殊样式
                                                : "bg-white border-gray-200 hover:border-purple-400"
                                            )}
                                          >
                                            <div className="flex items-start justify-between gap-5">
                                              <div className="flex items-start gap-4 flex-1">
                                                {/* 🆕 勾选框 */}
                                                {!tc.saved && !isSaved && (
                                                  <div className="pt-1 mr-2">
                                                    <input
                                                      type="checkbox"
                                                      checked={isTestCaseSelected || false}
                                                      onChange={() => toggleTestCaseSelect(tc)}
                                                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                  </div>
                                                )}
                                                {/* 序号 */}
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 via-blue-400 to-blue-500
                                                                flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-purple-400/30">
                                                  {tcIndex + 1}
                                                </div>

                                                {/* 测试用例信息 */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                    <h6 className={clsx(
                                                      "font-bold text-base",
                                                      isFilteredCase ? "text-orange-700 line-through" : "text-gray-900"
                                                    )}>
                                                      {tc.name || `用例 ${tcIndex + 1}`}
                                                    </h6>
                                                    {/* 🆕 被过滤标签 */}
                                                    {isFilteredCase && (
                                                      <Tooltip title={tc.filterReason || '数据一致性验证失败'}>
                                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300 flex items-center gap-1 cursor-help">
                                                          <AlertTriangle className="w-3 h-3" />
                                                          已过滤
                                                        </span>
                                                      </Tooltip>
                                                    )}
                                                    {/* 🆕 用例类型标签（放在优先级前面） */}
                                                    {!isFilteredCase && (() => {
                                                      const typeInfo = getCaseTypeInfo(tc.caseType);
                                                      return (
                                                        <span className={clsx(
                                                          "px-2.5 py-1 rounded-full text-xs font-semibold",
                                                          typeInfo.tailwindBg,
                                                          typeInfo.tailwindText,
                                                          'border',
                                                          typeInfo.tailwindBorder
                                                        )}>
                                                          {typeInfo.emoji} {typeInfo.label}
                                                        </span>
                                                      );
                                                    })()}
                                                    {!isFilteredCase && (
                                                      <span className={clsx(
                                                        "px-2.5 py-1 rounded-full text-xs font-semibold",
                                                        tc.priority === 'high' && "bg-red-100 text-red-700 border border-red-200",
                                                        tc.priority === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                                                        tc.priority === 'low' && "bg-green-100 text-green-700 border border-green-200"
                                                      )}>
                                                        {tc.priority === 'high' ? '高优先级' : tc.priority === 'medium' ? '中优先级' : '低优先级'}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {tc.description && (
                                                    <p className={clsx(
                                                      "text-sm mb-3 line-clamp-2 leading-relaxed",
                                                      isFilteredCase ? "text-orange-600" : "text-gray-600"
                                                    )}>
                                                      {tc.description}
                                                    </p>
                                                  )}
                                                  {/* 🆕 被过滤原因显示 */}
                                                  {isFilteredCase && tc.filterReason && (
                                                    <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mb-3">
                                                      <p className="text-xs text-orange-700 font-medium flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                        <span>过滤原因：{tc.filterReason}</span>
                                                      </p>
                                                    </div>
                                                  )}
                                                  {/* 🆕 关联信息：场景和测试点 */}
                                                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                                                    {tc.testScenario && (
                                                      <div className="flex items-center gap-1.5">
                                                        <Target className="w-3.5 h-3.5" />
                                                        <span>场景：{tc.testScenario}</span>
                                                      </div>
                                                    )}
                                                    {(tc.testPointName || tc.testPointId || testPoint.testPoint) && (
                                                      <div className="flex items-center gap-1.5">
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                        <span>测试点：{tc.testPointName || tc.testPointId || testPoint.testPoint}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              {/* 操作按钮 */}
                                              <div className="flex items-center gap-2 flex-shrink-0">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleViewDetail(tc)}
                                                >
                                                  查看用例
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 草稿箱 */}
        {draftCases.length > 0 && (
          <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-2xl shadow-2xl p-10 mt-8 border border-purple-100/50">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 via-green-500 to-green-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-green-500/40 ring-4 ring-green-500/10">
                  {draftCases.length}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1.5">测试用例草稿箱</h3>
                  <p className="text-base font-medium text-gray-600">
                    已生成 {draftCases.length} 个用例，选中 {selectedCaseCount} 个用例
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="lg"
                icon={<Save className="w-5 h-5" />}
                onClick={saveSelectedCases}
                isLoading={saving}
                disabled={selectedCaseCount === 0}
                className="h-12 px-8 font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl"
              >
                保存选中用例 ({selectedCaseCount})
              </Button>
            </div>

            {/* 用例列表 */}
            <div className="space-y-4">
              {/* 🆕 对草稿箱中的测试用例进行排序：冒烟用例优先，然后按优先级排序 */}
              {[...draftCases].sort((a, b) => {
                // 首先按用例类型排序（冒烟用例优先）
                const typeA = getCaseTypeOrder(a.caseType);
                const typeB = getCaseTypeOrder(b.caseType);
                if (typeA !== typeB) {
                  return typeA - typeB;
                }
                // 用例类型相同时，按优先级排序
                const priorityA = getPriorityOrder(a.priority);
                const priorityB = getPriorityOrder(b.priority);
                return priorityA - priorityB;
              }).map((testCase) => (
                <DraftCaseCard
                  key={testCase.id}
                  id={testCase.id}
                  name={testCase.name || '未命名用例'}
                  description={testCase.description}
                  priority={(testCase.priority || 'medium') as 'critical' | 'high' | 'medium' | 'low'}
                  qualityScore={testCase.qualityScore || 85}
                  batchNumber={testCase.batchNumber || 0}
                  stepsCount={Array.isArray(testCase.steps) ? testCase.steps.length : (typeof testCase.steps === 'string' ? testCase.steps.split('\n').filter((s: string) => s.trim()).length : 0)}
                  selected={testCase.selected || false}
                  onToggleSelect={(id) => {
                    setDraftCases(prev =>
                      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
                    );
                  }}
                  sectionId={testCase.sectionId}
                  sectionName={testCase.sectionName}
                  testPointsCount={testCase.testPoints?.length || 0}
                  testPurpose={testCase.testPurpose}
                  testCase={testCase}
                  onViewDetail={() => handleViewDetail(testCase)}
                  saved={testCase.saved || false}
                />
              ))}
            </div>
          </div>
        )}

        {/* 空状态提示 */}
        {!analyzingScenarios && testScenarios.length === 0 && draftCases.length === 0 && (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-20 text-center border-2 border-dashed border-gray-200">
            <FileX className="w-20 h-20 mx-auto text-gray-300 mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              暂无测试场景
            </h3>
            <p className="text-base font-medium text-gray-600">
              点击上方"立即生成测试场景"按钮开始分析
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30 pb-32">
      {/* 页面头部 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* 标题区 */}
          <div className="flex items-center gap-3 mb-4">
            {/* AI 图标 */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30 ring-2 ring-purple-500/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 bg-clip-text text-transparent mb-0.5 tracking-tight">
                AI 智能生成器
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                {generatorMode === 'requirement' 
                  ? '从原型/业务文档生成结构化需求文档（HTML / PDF / DOCX / Markdown / TXT）'
                  : '基于需求文档批量生成测试用例'
                }
              </p>
            </div>
          </div>

          {/* 🆕 模式切换选项卡 */}
          <div className="flex items-center gap-1.5 mb-4 p-0.5 bg-gray-100 rounded-lg w-fit">
            <button
              onClick={() => handleModeChange('requirement')}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-md font-medium text-sm transition-all",
                generatorMode === 'requirement'
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              生成需求文档
            </button>
            <button
              onClick={() => handleModeChange('testcase')}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-md font-medium text-sm transition-all",
                generatorMode === 'testcase'
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <TestTube2 className="w-3.5 h-3.5" />
              生成测试用例
            </button>
          </div>

          {/* 进度指示器 */}
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={generatorMode === 'requirement' ? REQUIREMENT_STEPS.length : TESTCASE_STEPS.length}
            steps={generatorMode === 'requirement' ? REQUIREMENT_STEPS : TESTCASE_STEPS}
          />
        </div>
      </header>

      {/* 内容区 */}
      <div className={clsx(
        "mx-auto px-6 py-6",
        currentStep === 0 && "max-w-7xl",
        currentStep === 1 && "max-w-7xl",
        currentStep === 2 && "max-w-7xl"
      )}>
        <AnimatePresence mode="wait">
          {/* ========== 需求文档生成模式 ========== */}
          {generatorMode === 'requirement' && (
            <>
              {/* 步骤1：上传原型 */}
              {currentStep === 0 && (
                <motion.div
                  key="req-step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {renderStep1()}
                </motion.div>
              )}

              {/* 步骤2：生成需求文档 */}
              {currentStep === 1 && (
                <motion.div
                  key="req-step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <StepCard
                    stepNumber={1}
                    title="上传原型 / 需求文档"
                    isCompleted={true}
                    completedSummary={`已上传 ${axureFiles.length} 个文件`}
                    onEdit={() => setCurrentStep(0)}
                  >
                    <div></div>
                  </StepCard>
                  {renderStep2ForRequirement()}
                </motion.div>
              )}

              {/* 步骤3：保存需求文档 */}
              {currentStep === 2 && (
                <motion.div
                  key="req-step3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <StepCard
                    stepNumber={1}
                    title="上传原型 / 需求文档"
                    isCompleted={true}
                    completedSummary={`已上传 ${axureFiles.length} 个文件`}
                    onEdit={() => setCurrentStep(0)}
                  >
                    <div></div>
                  </StepCard>
                  <StepCard
                    stepNumber={2}
                    title="AI 生成需求文档"
                    isCompleted={true}
                    completedSummary={`需求文档已生成 (${requirementDoc.length} 字)`}
                    onEdit={() => setCurrentStep(1)}
                  >
                    <div></div>
                  </StepCard>
                  {renderSaveRequirementDoc()}
                </motion.div>
              )}
            </>
          )}

          {/* ========== 测试用例生成模式 ========== */}
          {generatorMode === 'testcase' && (
            <>
              {/* 步骤1：选择需求文档 */}
              {currentStep === 0 && (
                <motion.div
                  key="tc-step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {renderSelectRequirementDoc()}
                </motion.div>
              )}

              {/* 步骤2：生成测试用例 */}
              {currentStep === 1 && (
                <motion.div
                  key="tc-step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <StepCard
                    stepNumber={1}
                    title="选择需求文档"
                    isCompleted={true}
                    completedSummary={selectedRequirementDoc?.title || '已选择'}
                    onEdit={() => setCurrentStep(0)}
                  >
                    <div></div>
                  </StepCard>
                  {renderStep2()}
                </motion.div>
              )}

              {/* 步骤3：保存测试用例 */}
              {currentStep === 2 && (
                <motion.div
                  key="tc-step3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <StepCard
                    stepNumber={1}
                    title="选择需求文档"
                    isCompleted={true}
                    completedSummary={selectedRequirementDoc?.title || '已选择'}
                    onEdit={() => setCurrentStep(0)}
                  >
                    <div></div>
                  </StepCard>
                  <StepCard
                    stepNumber={2}
                    title="需求文档"
                    isCompleted={true}
                    completedSummary={`需求文档 (${requirementDoc.length} 字)`}
                    onEdit={() => setCurrentStep(1)}
                  >
                    <div></div>
                  </StepCard>
                  {renderStep3()}
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl
                      border-t border-gray-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            {/* 左侧统计 - 根据模式显示不同内容 */}
            <div className="flex items-center gap-6">
              {generatorMode === 'requirement' ? (
                // 需求文档模式：显示当前进度
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center shadow-sm ring-1 ring-purple-200/50">
                      <FileText className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 leading-none mb-0.5">需求文档生成</div>
                      <div className="text-xs font-medium text-gray-500">
                        步骤 {currentStep + 1} / 3：{REQUIREMENT_STEPS[currentStep]?.name || ''}
                      </div>
                    </div>
                  </div>

                  {requirementDoc && (
                    <>
                      <div className="w-px h-10 bg-gray-200/60" />
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center shadow-sm ring-1 ring-green-200/50">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900 leading-none mb-0.5">{requirementDoc.length}</div>
                          <div className="text-xs font-medium text-gray-600">文档字数</div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                // 测试用例模式：显示用例统计
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shadow-sm ring-1 ring-blue-200/50">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900 leading-none mb-0.5">{draftCases.length}</div>
                      <div className="text-xs font-medium text-gray-600">总用例</div>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200/60" />

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center shadow-sm ring-1 ring-green-200/50">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900 leading-none mb-0.5">
                        {selectedCasesCount}
                      </div>
                      <div className="text-xs font-medium text-gray-600">已选中（用例）</div>
                    </div>
                  </div>

                  {draftCases.length > 0 && (
                    <>
                      <div className="w-px h-10 bg-gray-200/60" />
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center shadow-sm ring-1 ring-amber-200/50">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900 leading-none mb-0.5">{avgQuality}</div>
                          <div className="text-xs font-medium text-gray-600">平均质量</div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* 右侧操作 - 根据模式显示不同按钮 */}
            <div className="flex items-center gap-2.5">
              {generatorMode === 'requirement' ? (
                // 需求文档模式的操作按钮
                <>
                  {currentStep > 0 && currentStep < 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<ArrowLeft className="w-3.5 h-3.5" />}
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="h-9 px-4 font-medium text-sm"
                    >
                      上一步
                    </Button>
                  )}
                </>
              ) : (
                // 测试用例模式的操作按钮
                <>
                  {currentStep > 0 && currentStep < 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<ArrowLeft className="w-3.5 h-3.5" />}
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="h-9 px-4 font-medium text-sm"
                    >
                      上一步
                    </Button>
                  )}

                  {currentStep === 2 && draftCases.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                        className="h-9 px-4 font-medium text-sm"
                      >
                        修改需求
                      </Button>
                      <Button
                        variant="outline"
                        size="default"
                        icon={<Save className="w-4 h-4" />}
                        isLoading={saving}
                        disabled={selectedCasesCount === 0}
                        onClick={saveSelectedCases}
                        className="h-9 px-5 font-semibold text-sm border-2"
                      >
                        保存选中用例 ({selectedCasesCount})
                      </Button>
                      <Button
                        variant="default"
                        size="default"
                        icon={<CheckCircle className="w-4 h-4" />}
                        isLoading={saving}
                        disabled={selectedCasesCount === 0}
                        onClick={saveToLibrary}
                        className="h-9 px-6 font-semibold text-sm shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                      >
                        保存并完成 ({selectedCasesCount})
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 智能补全对话框 */}
      {preAnalysisResult && (
        <SmartCompletionModal
          open={completionModalOpen}
          preAnalysisResult={preAnalysisResult}
          onConfirm={handleConfirmations}
          onSkip={handleSkipCompletion}
          loading={generating}
        />
      )}

      {/* 测试用例详情对话框 */}
      <TestCaseDetailModal
        key={`${currentDetailCase?.id || 'new'}-${currentCaseIndex}`}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setViewingAllCases([]);
          setCurrentCaseIndex(0);
        }}
        testCase={currentDetailCase}
        allCases={viewingAllCases}
        currentIndex={currentCaseIndex}
        onSwitchCase={handleSwitchCase}
        onSave={handleSaveDetail}
      />

      {/* 🆕 需求文档详情弹窗 */}
      <AntModal
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>需求文档详情</span>
            {currentRequirementDoc && (
              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                #{currentRequirementDoc.id}
              </span>
            )}
          </div>
        }
        open={requirementModalOpen}
        onCancel={() => {
          setRequirementModalOpen(false);
          setCurrentRequirementDoc(null);
        }}
        footer={null}
        width={1200}
        centered
        maskClosable={true}
        keyboard={true}
        styles={{
          content: {
            minHeight: '95vh',
            display: 'flex',
            flexDirection: 'column'
          },
          body: {
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            userSelect: 'text'
          }
        }}
        className="requirement-doc-modal"
        destroyOnHidden={true}
      >
        {requirementLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spin size="large" />
          </div>
        ) : currentRequirementDoc && (
          <div className="flex flex-col gap-6 h-full">
            {/* 文档信息 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{currentRequirementDoc.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {currentRequirementDoc.project && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {currentRequirementDoc.project.name}
                    {currentRequirementDoc.project_version && ` / ${currentRequirementDoc.project_version.version_name}`}
                    {currentRequirementDoc.module && ` / ${currentRequirementDoc.module}`}
                  </span>
                )}
                {currentRequirementDoc.users && (
                  <span className="flex items-center gap-1">
                    <span>👤</span>
                    {currentRequirementDoc.users.username}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span>📅</span>
                  {formatDate(currentRequirementDoc.created_at)}
                </span>
              </div>
            </div>
            
            {/* 需求文档内容 */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  需求文档内容
                  <span className="text-xs text-gray-400 font-normal ml-2">
                    {currentRequirementDoc.content?.length || 0} 字 · {currentRequirementDoc.content?.split('\n').length || 0} 行
                  </span>
                </h3>
                <button
                  onClick={handleCopyRequirementDoc}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                    copied
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      复制全部
                    </>
                  )}
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded-lg p-6 flex-1 overflow-y-auto select-text"
                style={{ minHeight: '400px', maxHeight: 'calc(95vh - 250px)' }}
              >
                <div
                  className="prose prose-slate max-w-none prose-sm select-text
                    prose-headings:text-gray-900
                    prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2
                    prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-blue-700
                    prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-3
                    prose-ul:my-3 prose-ol:my-3
                    prose-li:text-gray-700 prose-li:my-1
                    prose-strong:text-gray-900
                    prose-table:w-full prose-table:border-collapse prose-table:text-sm prose-table:my-4
                    prose-thead:bg-blue-50
                    prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:text-left prose-th:font-semibold
                    prose-td:border prose-td:border-gray-300 prose-td:p-2
                  "
                  dangerouslySetInnerHTML={{ __html: marked.parse(currentRequirementDoc.content || '') as string }}
                />
              </div>
            </div>
          </div>
        )}
      </AntModal>

      {/* 自定义样式 */}
      <style>{`
        .requirement-editor {
          font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
          font-size: 15px;
          line-height: 1.8;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 1rem;
          transition: all 0.3s ease;
          padding: 1.5rem;
        }

        .requirement-editor:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1), 0 4px 12px rgba(139, 92, 246, 0.05);
          outline: none;
        }

        /* Select 组件文字大小控制 */
        .compact-select .ant-select-selection-item,
        .compact-select .ant-select-selection-placeholder {
          font-size: 0.8rem !important; /* 14px - text-xs */
          line-height: 1.25rem !important;
        }

        .compact-select.ant-select .ant-select-selector {
          font-size: 0.75rem !important;
        }

        /* 下拉选项的文字大小 */
        .ant-select-dropdown .ant-select-item-option-content {
          font-size: 0.75rem !important;
        }

        /* 🆕 防止长内容撑开页面 */
        pre {
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          max-width: 100%;
        }

        /* 🆕 限制图片大小，防止撑开页面 */
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem 0;
        }

        /* 🆕 表格横向滚动 */
        table {
          max-width: 100%;
          overflow-x: auto;
          display: block;
        }

        /* 🆕 长文本自动换行 */
        .prose {
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        /* 🆕 Base64图片优化 */
        img[src^="data:image"] {
          max-width: 100%;
          max-height: 500px;
          object-fit: contain;
        }
      `}</style>
    </div>
  );
}
