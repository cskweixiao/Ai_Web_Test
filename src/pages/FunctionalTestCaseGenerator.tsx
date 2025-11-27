import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Radio, Select } from 'antd';
import {
  Sparkles, FileText,
  ArrowLeft, ArrowRight, Save, FileX, CheckCircle, Target
} from 'lucide-react';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import * as systemService from '../services/systemService';
import { showToast } from '../utils/toast';
import { Button } from '../components/ui/button';
import { ProgressIndicator } from '../components/ai-generator/ProgressIndicator';
import { StepCard } from '../components/ai-generator/StepCard';
import { AIThinking } from '../components/ai-generator/AIThinking';
import { DraftCaseCard } from '../components/ai-generator/DraftCaseCard';
import { MultiFileUpload } from '../components/ai-generator/MultiFileUpload';
import { MarkdownEditor } from '../components/ai-generator/MarkdownEditor';
import { TestCaseDetailModal } from '../components/ai-generator/TestCaseDetailModal';
import { SmartCompletionModal } from '../components/ai-generator/SmartCompletionModal';
import type { PreAnalysisResult, UserConfirmation, EnhancedAxureData } from '../types/aiPreAnalysis';
import { clsx } from 'clsx';

const { TextArea } = Input;

// 步骤定义
const STEPS = [
  { name: '上传原型', description: '上传 Axure 文件' },
  { name: '需求文档', description: 'AI 生成需求' },
  { name: '生成用例', description: '批量生成' }
];

/**
 * AI测试用例生成器页面 - 重新设计版本
 */
export function FunctionalTestCaseGenerator() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // 系统字典选项
  const [systemOptions, setSystemOptions] = useState<Array<{ id: number; name: string }>>([]);

  // 步骤1状态
  const [axureFiles, setAxureFiles] = useState<File[]>([]);
  const [pageName, setPageName] = useState(''); // 新增:页面名称
  const [pageMode, setPageMode] = useState<'new' | 'modify'>('new'); // 🆕 页面模式：新增/修改
  const [platformType, setPlatformType] = useState<'web' | 'mobile'>('web'); // 🆕 平台类型：Web端/移动端
  const [projectInfo, setProjectInfo] = useState({
    systemName: '',      // 系统名称
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
  const [savedScenarios, setSavedScenarios] = useState<Record<string, boolean>>({}); // 🆕 已保存的测试场景
  const [saving, setSaving] = useState(false);
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

  // 步骤1：上传和解析 - 🆕 直接生成需求文档（跳过解析和二次确认）
  const handleParse = async () => {
    if (axureFiles.length === 0) {
      showToast.error('请先上传Axure文件');
      return;
    }

    // 验证至少有一个 HTML 文件
    const htmlFile = axureFiles.find(f => f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm'));
    if (!htmlFile) {
      showToast.error('至少需要一个 HTML 文件');
      return;
    }

    // 验证必填字段
    if (!projectInfo.systemName.trim()) {
      showToast.error('请填写系统名称');
      return;
    }
    if (!projectInfo.moduleName.trim()) {
      showToast.error('请填写模块名称');
      return;
    }

    // 🔥 修复：先进入步骤2，再显示loading，避免在步骤1下方显示loading
    setCurrentStep(1);
    setParsing(true);
    setGenerating(true);

    try {
      console.log('🚀 使用新的直接生成模式（跳过解析和二次确认）');

      // 🆕 直接调用新API，跳过解析和智能补全
      const result = await functionalTestCaseService.generateFromHtmlDirect(
        htmlFile,
        projectInfo.systemName,
        projectInfo.moduleName,
        pageMode, // 传递页面模式
        projectInfo.businessRules, // 传递补充业务规则
        platformType // 传递平台类型
      );

      // 设置会话ID和需求文档
      setSessionId(result.data.sessionId);
      setRequirementDoc(result.data.requirementDoc);

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
      const result = await functionalTestCaseService.analyzeTestScenarios(requirementDoc, sessionId);      console.log('🚀 测试场景拆分结果:', result);
      console.log('✅ 测试场景拆分完成:', result.data.scenarios);
      setTestScenarios(result.data.scenarios || result.data.modules || []); // 兼容旧接口
      showToast.success(`成功拆分 ${(result.data.scenarios || result.data.modules || []).length} 个测试场景`);
    } catch (error: any) {
      console.error('❌ 测试场景拆分失败:', error);
      showToast.error('测试场景拆分失败：' + error.message);
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
        scenario.description,
        requirementDoc,
        projectInfo.systemName,
        projectInfo.moduleName,
        scenario.relatedSections,
        sessionId
      );

      console.log('✅ 测试用例生成完成:', result.data.testCases);

      // 一个测试点可能生成多个测试用例
      const newCases = result.data.testCases.map((tc: any, index: number) => {
        // 确保测试用例有 testPurpose
        const testPurpose = tc.testPurpose || tc.description || '';
        
        // 确保每个测试点都有 testPurpose
        const processedTestPoints = (tc.testPoints || []).map((tp: any) => ({
          ...tp,
          testPurpose: tp.testPurpose || testPurpose,
          testScenario: tp.testScenario || scenario.name
        }));
        
        return {
          ...tc,
          testPurpose: testPurpose,
          testPoints: processedTestPoints.length > 0 ? processedTestPoints : [{
            testPoint: testPoint.testPoint,
            testPurpose: testPurpose,
            steps: testPoint.steps || tc.steps || '',
            expectedResult: testPoint.expectedResult || tc.assertions || '',
            riskLevel: testPoint.riskLevel || 'medium',
            testScenario: scenario.name
          }],
          id: `draft-${Date.now()}-${index}`,
          selected: true,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          testPointId: testPoint.testPoint,
          testPointName: testPoint.testPoint
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
                        : [...(tp.testCases || []), ...newCases] 
                    }
                  : tp
              )
            }
          : s
      ));

      showToast.success(`${isRegenerate ? '重新' : ''}为测试点 "${testPoint.testPoint}" 生成了 ${newCases.length} 个测试用例`);
    } catch (error: any) {
      console.error('❌ 生成测试用例失败:', error);
      showToast.error('生成测试用例失败：' + error.message);
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

  // 切换场景展开/折叠
  // 切换测试场景选中状态
  const toggleScenarioSelect = (scenarioId: string) => {
    setSelectedScenarios(prev => ({
      ...prev,
      [scenarioId]: !prev[scenarioId]
    }));
  };

  // 全选所有已生成测试用例的测试场景
  const selectAllScenarios = () => {
    const newSelections: Record<string, boolean> = {};
    testScenarios.forEach(scenario => {
      if (scenario.testCase && !savedScenarios[scenario.id]) {
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
      setCurrentDetailCase(allCases[0]);
    } else {
      // 查看单个用例
      setViewingAllCases([]);
      setCurrentCaseIndex(0);
      setCurrentDetailCase(testCase);
    }
    setDetailModalOpen(true);
  };

  // 切换查看的用例（在查看全部模式下）
  const handleSwitchCase = (direction: 'prev' | 'next') => {
    if (viewingAllCases.length === 0) return;
    
    let newIndex = currentCaseIndex;
    if (direction === 'prev') {
      newIndex = currentCaseIndex > 0 ? currentCaseIndex - 1 : viewingAllCases.length - 1;
    } else {
      newIndex = currentCaseIndex < viewingAllCases.length - 1 ? currentCaseIndex + 1 : 0;
    }
    
    setCurrentCaseIndex(newIndex);
    setCurrentDetailCase(viewingAllCases[newIndex]);
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

  // 保存选中用例（不跳转）- 基于测试场景维度
  const saveSelectedCases = async () => {
    // 1. 收集所有选中测试场景的测试用例（从草稿箱中收集，确保数据完整）
    const selectedCases: any[] = [];
    const selectedScenarioIds: string[] = [];

    // 从草稿箱中收集选中场景的所有用例
    testScenarios.forEach(scenario => {
      if (selectedScenarios[scenario.id] && !savedScenarios[scenario.id]) {
        // 从草稿箱中找到属于该场景的所有用例
        const scenarioCases = draftCases.filter(c => 
          c.scenarioId === scenario.id && !c.saved
        );
        
        if (scenarioCases.length > 0) {
          // 确保每个测试用例的测试点都包含 testPurpose
          const processedCases = scenarioCases.map(tc => {
            // 如果测试用例有 testPoints，确保每个测试点都有 testPurpose
            if (tc.testPoints && Array.isArray(tc.testPoints)) {
              return {
                ...tc,
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
                testPoints: [{
                  testPoint: tc.testPointName || tc.testPointId || '',
                  testPurpose: tc.testPurpose || tc.description || '',
                  steps: tc.steps || '',
                  expectedResult: tc.assertions || tc.expectedResult || '',
                  riskLevel: tc.riskLevel || 'medium'
                }]
              };
            }
            return tc;
          });
          
          selectedCases.push(...processedCases);
          selectedScenarioIds.push(scenario.id);
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
      console.log('📦 准备保存的测试用例:', selectedCases);
      await functionalTestCaseService.batchSave(selectedCases, sessionId);
      showToast.success(`成功保存 ${selectedCases.length} 个测试用例`);

      // 4. 🆕 标记为已保存（不再移除）
      const newSavedScenarios = { ...savedScenarios };
      selectedScenarioIds.forEach(id => {
        newSavedScenarios[id] = true;
      });
      setSavedScenarios(newSavedScenarios);

      // 5. 取消选中已保存的测试场景
      const newSelectedScenarios = { ...selectedScenarios };
      selectedScenarioIds.forEach(id => {
        delete newSelectedScenarios[id];
      });
      setSelectedScenarios(newSelectedScenarios);

      // 6. 🆕 标记草稿箱中的用例为已保存（不移除，只标记）
      setDraftCases(prev =>
        prev.map(c => {
          const isSaved = selectedCases.some(sc => sc.id === c.id);
          return isSaved ? { ...c, saved: true, selected: false } : c;
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
    const selectedCases = draftCases.filter(c => c.selected && !c.saved);

    if (selectedCases.length === 0) {
      showToast.warning('请至少选择一个用例');
      return;
    }

    // 确保每个测试用例的测试点都包含 testPurpose
    const processedCases = selectedCases.map(tc => {
      // 如果测试用例有 testPoints，确保每个测试点都有 testPurpose
      if (tc.testPoints && Array.isArray(tc.testPoints)) {
        return {
          ...tc,
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
          testPoints: [{
            testPoint: tc.testPointName || tc.testPointId || '',
            testPurpose: tc.testPurpose || tc.description || '',
            steps: tc.steps || '',
            expectedResult: tc.assertions || tc.expectedResult || '',
            riskLevel: tc.riskLevel || 'medium'
          }]
        };
      }
      return tc;
    });

    setSaving(true);
    try {
      console.log('📦 准备保存的测试用例:', processedCases);
      await functionalTestCaseService.batchSave(processedCases, sessionId);
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

  // 计算统计数据
  const selectedCount = draftCases.filter(c => c.selected).length;
  const avgQuality = draftCases.length > 0
    ? Math.round(draftCases.reduce((sum, c) => sum + (c.qualityScore || 85), 0) / draftCases.length)
    : 0;
  const totalTestPoints = draftCases.reduce((sum, c) => sum + (c.testPoints?.length || 0), 0);

  // 渲染步骤1：上传原型
  const renderStep1 = () => (
    <StepCard
      stepNumber={1}
      title="上传 Axure 原型"
      description="AI 直接解析 HTML，无需二次确认，快速生成需求文档"
      onNext={handleParse}
      nextButtonText={(parsing || generating) ? 'AI生成中...' : '开始生成需求文档'}
      nextButtonDisabled={axureFiles.length === 0 || parsing || generating}
      hideActions={false}
    >
      {/* 左右分栏布局 */}
      <div className="grid grid-cols-[1.2fr,0.8fr] gap-10">
        {/* 左侧：文件上传区 + 解析结果 */}
        <div className="space-y-6">
          {/* 多文件上传组件 */}
          <MultiFileUpload
            onFilesChange={setAxureFiles}
            onPageNameChange={setPageName}
            pageMode={pageMode}
            onPageModeChange={setPageMode}
            maxFiles={20}
            maxSize={50 * 1024 * 1024}
          />

          {/* 🆕 AI生成需求文档进度 */}
          {(parsing || generating) && (
            <AIThinking
              title="正在直接生成需求文档..."
              subtitle="AI正在分析HTML并生成结构化需求，预计需要 1-3 分钟"
              progressItems={[
                { label: '读取HTML文件内容...', status: parsing ? 'processing' : 'completed' },
                { label: 'AI分析HTML结构和元素', status: generating ? 'processing' : 'pending' },
                { label: '生成章节化需求文档', status: 'pending' }
              ]}
            />
          )}

          {/* 🆕 生成成功提示 */}
          {requirementDoc && !parsing && !generating && (
            <motion.div
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-200/60 shadow-lg shadow-green-500/10"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-green-900 mb-4">需求文档生成成功！</h4>
                  <div className="grid grid-cols-2 gap-6 mb-5">
                    <div className="text-center bg-white/60 rounded-xl p-4 border border-green-200/40">
                      <div className="text-3xl font-bold text-green-700 mb-1">{requirementDoc.length}</div>
                      <div className="text-sm font-medium text-green-600">文档字符数</div>
                    </div>
                    <div className="text-center bg-white/60 rounded-xl p-4 border border-green-200/40">
                      <div className="text-3xl font-bold text-green-700 mb-1">
                        {(requirementDoc.match(/###\s+[\d.]+/g) || []).length}
                      </div>
                      <div className="text-sm font-medium text-green-600">识别章节数</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-700 bg-green-100/80 rounded-xl p-4 border border-green-200/50">
                    💡 AI 已直接分析 HTML 并生成需求文档，无需二次确认！
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 右侧：项目信息表单 */}
        <div className="space-y-6">
          {/* 表单卡片 */}
          <div className="bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 rounded-2xl p-8 border border-purple-100/50 shadow-lg shadow-purple-500/5 sticky top-28">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600
                              flex items-center justify-center shadow-lg shadow-purple-500/30">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  补充项目信息
                </h3>
                <p className="text-sm font-medium text-gray-600">可选，帮助 AI 更好理解业务</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* 平台类型 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
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
                      className="text-center h-10 leading-10"
                    >
                      🖥️ Web端
                    </Radio.Button>
                    <Radio.Button
                      value="mobile"
                      className="text-center h-10 leading-10"
                    >
                      📱 移动端
                    </Radio.Button>
                  </div>
                </Radio.Group>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {platformType === 'web' ?
                    '识别 PC 端 Web 页面（列表页、表单页、详情页、弹窗等）' :
                    '识别移动端页面（TabBar 导航、卡片列表、长屏详情、多状态画面等）'}
                </p>
              </div>

              {/* 页面模式 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
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
                      className="text-center h-10 leading-10"
                    >
                      🆕 新增页面
                    </Radio.Button>
                    <Radio.Button
                      value="modify"
                      className="text-center h-10 leading-10"
                    >
                      ✏️ 修改页面
                    </Radio.Button>
                  </div>
                </Radio.Group>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {pageMode === 'new' ?
                    '完整解析页面所有元素和功能' :
                    '识别红色标记的变更点，生成变更摘要'}
                </p>
              </div>

              {/* 系统名称 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  系统名称 <span className="text-red-500">*</span>
                </label>
                <Select
                  className="w-full"
                  placeholder="请选择系统"
                  value={projectInfo.systemName || undefined}
                  onChange={(value) => setProjectInfo(prev => ({ ...prev, systemName: value }))}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={systemOptions.map(sys => ({
                    label: sys.name,
                    value: sys.name
                  }))}
                />
                <p className="text-sm text-gray-600 mt-2">生成的测试用例会自动填充此系统名称</p>
              </div>

              {/* 模块名称 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  模块名称 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="例如：订单管理"
                  value={projectInfo.moduleName}
                  onChange={e => setProjectInfo(prev => ({ ...prev, moduleName: e.target.value }))}
                />
                <p className="text-sm text-gray-600 mt-2">生成的测试用例会自动填充此模块名称</p>
              </div>

              {/* 补充业务规则 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  补充业务规则 <span className="text-gray-500 font-normal">(选填，辅助 AI 理解)</span>
                </label>
                <TextArea
                  rows={6}
                  placeholder="每行一条规则，例如：&#10;• 订单金额超过1000需审批&#10;• 库存不足时不能下单&#10;• 同一用户5分钟内不能重复下单&#10;• 支付超时30分钟自动取消订单"
                  value={projectInfo.businessRules}
                  onChange={e => setProjectInfo(prev => ({ ...prev, businessRules: e.target.value }))}
                />
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
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
                    <span><strong className="font-semibold">系统名称</strong> 和 <strong className="font-semibold">模块名称</strong> 为必填项，会自动填充到生成的测试用例中</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong className="font-semibold">补充业务规则</strong> 作为 AI 辅助提示，帮助生成更准确的边界条件、异常场景和风险测试点</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>页面名称会从 PRD 文档中自动提取，无需手动填写</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  );

  // 渲染步骤2：需求文档
  const renderStep2 = () => (
    <StepCard
      stepNumber={2}
      title="AI 生成的需求文档"
      description="您可以编辑修改，以获得更精准的测试用例"
      onNext={handleAnalyzeScenarios}
      nextButtonText={analyzingScenarios ? '分析测试场景中...' : '立即生成测试场景 →'}
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

  // 渲染步骤3：三阶段渐进式生成（新流程：测试场景 → 测试点 → 测试用例）
  const renderStep3 = () => {
    // 🆕 计算选中且未保存的测试场景数量
    const selectedCount = Object.keys(selectedScenarios).filter(
      key => selectedScenarios[key] && !savedScenarios[key]
    ).length;

    return (
      <div className="space-y-6">
        {/* 阶段1：分析测试场景中 */}
        {analyzingScenarios && (
          <AIThinking
            title="AI 正在分析测试场景..."
            subtitle="根据需求文档识别不同的测试场景（查询条件、列表展示、操作按钮等）"
            progressItems={[
              { label: '分析需求文档结构', status: 'processing' },
              { label: '识别页面类型', status: 'pending' },
              { label: '拆分测试场景', status: 'pending' }
            ]}
          />
        )}

        {/* 测试场景列表 */}
        {testScenarios.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-bold text-gray-900">
                测试场景
                <span className="ml-3 text-lg font-semibold text-gray-500">（共 {testScenarios.length} 个）</span>
              </h3>
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                点击"生成测试点"按钮开始第二阶段，然后为每个测试点生成测试用例
              </span>
            </div>

            {/* 场景卡片列表 */}
            {testScenarios.map((scenario) => {
              const isExpanded = expandedScenarios[scenario.id];
              const isGeneratingPointsForScenario = generatingPoints[scenario.id];
              const hasTestPoints = scenario.testPoints && scenario.testPoints.length > 0;
              const hasTestCase = scenario.testCase;
              const isSelected = selectedScenarios[scenario.id];
              const isSaved = savedScenarios[scenario.id];

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
                    <div className="flex items-start justify-between">
                      {/* 复选框 */}
                      <div className="pt-1 mr-4">
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          disabled={!hasTestCase || isSaved}
                          onChange={() => toggleScenarioSelect(scenario.id)}
                          className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={clsx(
                            "px-3 py-1.5 rounded-full text-xs font-semibold",
                            scenario.priority === 'high' && "bg-red-100 text-red-700 border border-red-200",
                            scenario.priority === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                            scenario.priority === 'low' && "bg-green-100 text-green-700 border border-green-200"
                          )}>
                            {scenario.priority === 'high' ? '高优先级' : scenario.priority === 'medium' ? '中优先级' : '低优先级'}
                          </span>
                          <span className="text-sm font-medium text-gray-600">
                            关联章节: {scenario.relatedSections.join(', ')}
                          </span>
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2.5">
                          {scenario.name}
                        </h4>
                        <p className="text-base text-gray-600 leading-relaxed">
                          {scenario.description}
                        </p>
                        {hasTestPoints && (
                          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>已生成 {scenario.testPoints.length} 个测试点</span>
                          </div>
                        )}
                        {isSaved && (
                          <div className="mt-3 flex items-center gap-2 text-sm font-bold text-green-700">
                            <CheckCircle className="w-4 h-4 fill-green-700" />
                            <span>✅ 已保存到用例库</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
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

                          {scenario.testPoints.map((testPoint: any, index: number) => {
                            const pointKey = `${scenario.id}-${testPoint.testPoint}`;
                            const isGeneratingCase = generatingCases[pointKey];
                            const hasTestCases = testPoint.testCases && testPoint.testCases.length > 0;
                            const testCasesCount = testPoint.testCases?.length || 0;
                            // 如果已生成用例，使用实际数量；否则使用预估值
                            const estimatedCases = hasTestCases ? testCasesCount : (testPoint.estimatedTestCases || 1);
                            const isTestPointExpanded = expandedTestPoints[pointKey];

                            return (
                              <div key={index}>
                                {/* 测试点卡片 */}
                                <div className="rounded-xl p-6 border-2 bg-white border-gray-200 hover:border-purple-400 transition-all shadow-md hover:shadow-lg">
                                  <div className="flex items-start justify-between gap-5">
                                    <div className="flex items-start gap-4 flex-1">
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
                                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                                            <span className="font-semibold text-gray-700">预估用例:</span>
                                            <span className="text-blue-600 font-bold">{estimatedCases} 个</span>
                                          </div>
                                          {hasTestCases && (
                                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                                              <CheckCircle className="w-4 h-4" />
                                              <span className="font-semibold">已生成 {testCasesCount} 个</span>
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
                                  {isTestPointExpanded && hasTestCases && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="border-t border-gray-200 bg-gray-50 mt-3"
                                    >
                                      <div className="p-5 space-y-3">
                                        <p className="text-sm font-medium text-gray-700 mb-3">
                                          测试用例列表（共 {testCasesCount} 个）
                                        </p>
                                        {testPoint.testCases.map((tc: any, tcIndex: number) => (
                                          <div
                                            key={tcIndex}
                                            className="rounded-xl p-5 border-2 bg-white border-gray-200 hover:border-purple-400 transition-all shadow-md hover:shadow-lg"
                                          >
                                            <div className="flex items-start justify-between gap-5">
                                              <div className="flex items-start gap-4 flex-1">
                                                {/* 序号 */}
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 via-blue-400 to-blue-500
                                                                flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-purple-400/30">
                                                  {tcIndex + 1}
                                                </div>
                                                
                                                {/* 测试用例信息 */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-3 mb-2">
                                                    <h6 className="font-bold text-gray-900 text-base">
                                                      {tc.name || `用例 ${tcIndex + 1}`}
                                                    </h6>
                                                    <span className={clsx(
                                                      "px-2.5 py-1 rounded-full text-xs font-semibold",
                                                      tc.priority === 'high' && "bg-red-100 text-red-700 border border-red-200",
                                                      tc.priority === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-200",
                                                      tc.priority === 'low' && "bg-green-100 text-green-700 border border-green-200"
                                                    )}>
                                                      {tc.priority === 'high' ? '高优先级' : tc.priority === 'medium' ? '中优先级' : '低优先级'}
                                                    </span>
                                                  </div>
                                                  {tc.description && (
                                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                                      {tc.description}
                                                    </p>
                                                  )}
                                                  {tc.testScenario && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                                      <Target className="w-3.5 h-3.5" />
                                                      <span>场景：{tc.testScenario}</span>
                                                    </div>
                                                  )}
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
                                        ))}
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
                    已生成 {draftCases.length} 个用例，选中 {selectedCount} 个测试场景
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="lg"
                icon={<Save className="w-5 h-5" />}
                onClick={saveSelectedCases}
                isLoading={saving}
                disabled={selectedCount === 0}
                className="h-12 px-8 font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl"
              >
                保存选中用例 ({selectedCount})
              </Button>
            </div>

            {/* 用例列表 */}
            <div className="space-y-4">
              {draftCases.map((testCase) => (
                <DraftCaseCard
                  key={testCase.id}
                  id={testCase.id}
                  name={testCase.name || '未命名用例'}
                  description={testCase.description}
                  priority={(testCase.priority || 'medium') as 'critical' | 'high' | 'medium' | 'low'}
                  qualityScore={testCase.qualityScore || 85}
                  batchNumber={testCase.batchNumber || 0}
                  stepsCount={testCase.steps?.split('\n').filter((s: string) => s.trim()).length || 0}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30 pb-40">
      {/* 页面头部 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* 标题区 */}
          <div className="flex items-center gap-5 mb-6">
            {/* AI 图标 */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center shadow-xl shadow-purple-500/40 ring-4 ring-purple-500/10">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 bg-clip-text text-transparent mb-1.5 tracking-tight">
                AI 测试用例生成器
              </h1>
              <p className="text-base text-gray-600 font-medium">
                从 Axure 原型到完整测试用例，一站式 AI 驱动
              </p>
            </div>
          </div>

          {/* 进度指示器 */}
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={STEPS.length}
            steps={STEPS}
          />
        </div>
      </header>

      {/* 内容区 */}
      <div className={clsx(
        "mx-auto px-8 py-10",
        currentStep === 0 && "max-w-7xl",
        currentStep === 1 && "max-w-5xl",
        currentStep === 2 && "max-w-7xl"
      )}>
        <AnimatePresence mode="wait">
          {/* 步骤1 */}
          {currentStep === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderStep1()}
            </motion.div>
          )}

          {/* 步骤2 */}
          {currentStep === 1 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* 已完成的步骤1 */}
              <StepCard
                stepNumber={1}
                title="上传 Axure 原型"
                isCompleted={true}
                completedSummary={`已上传 ${axureFiles.length} 个文件`}
                onEdit={() => setCurrentStep(0)}
              >
                <div></div>
              </StepCard>
              {renderStep2()}
            </motion.div>
          )}

          {/* 步骤3 */}
          {currentStep === 2 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* 已完成的步骤1和2 */}
              <StepCard
                stepNumber={1}
                title="上传 Axure 原型"
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
              {renderStep3()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl
                      border-t border-gray-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            {/* 左侧统计 */}
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shadow-sm ring-1 ring-blue-200/50">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1">{draftCases.length}</div>
                  <div className="text-sm font-medium text-gray-600">总用例</div>
                </div>
              </div>

              <div className="w-px h-12 bg-gray-200/60" />

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center shadow-sm ring-1 ring-green-200/50">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1">{selectedCount}</div>
                  <div className="text-sm font-medium text-gray-600">已选中</div>
                </div>
              </div>

              {draftCases.length > 0 && (
                <>
                  <div className="w-px h-12 bg-gray-200/60" />
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center shadow-sm ring-1 ring-amber-200/50">
                      <Sparkles className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-gray-900 leading-none mb-1">{avgQuality}</div>
                      <div className="text-sm font-medium text-gray-600">平均质量</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 右侧操作 */}
            <div className="flex items-center gap-3">
              {currentStep > 0 && currentStep < 2 && (
                <Button
                  variant="outline"
                  size="default"
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="h-11 px-6 font-medium"
                >
                  上一步
                </Button>
              )}

              {currentStep === 2 && draftCases.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setCurrentStep(1)}
                    className="h-11 px-6 font-medium"
                  >
                    修改需求
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    icon={<Save className="w-5 h-5" />}
                    isLoading={saving}
                    disabled={selectedCount === 0}
                    onClick={saveSelectedCases}
                    className="h-12 px-7 font-semibold border-2"
                  >
                    保存选中用例 ({selectedCount})
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    icon={<CheckCircle className="w-5 h-5" />}
                    isLoading={saving}
                    disabled={selectedCount === 0}
                    onClick={saveToLibrary}
                    className="h-12 px-8 font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all"
                  >
                    保存并完成 ({selectedCount})
                  </Button>
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
      `}</style>
    </div>
  );
}
