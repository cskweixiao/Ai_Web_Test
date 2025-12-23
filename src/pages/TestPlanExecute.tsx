import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  MinusCircle,
  SkipForward,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { showToast } from '../utils/toast';
import { testPlanService } from '../services/testPlanService';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import { testService } from '../services/testService';
import type { TestPlanCase } from '../types/testPlan';
import { useAuth } from '../contexts/AuthContext';
import { TestCaseExecutor, ExecutionResultData } from './FunctionalTestCaseExecuteAlt';

type ExecutionResult = 'pass' | 'fail' | 'block' | 'skip';

interface CaseExecutionState {
  caseId: number;
  caseName: string;
  caseType: string;
  finalResult: ExecutionResult | '';
  completed: boolean;
  // 🔥 添加详细执行信息字段
  executionDetails?: {
    execution_id?: string;
    duration_ms?: number;
    actualResult?: string;
    comments?: string;
    totalSteps?: number;
    completedSteps?: number;
    passedSteps?: number;
    failedSteps?: number;
    blockedSteps?: number;
    screenshots?: Array<{
      fileName: string;
      fileSize: number;
      mimeType: string;
      base64Data: string;
      uploadedAt: string;
    }>;
    // 🔥 新增：保存步骤执行结果
    stepResults?: Array<{
      stepIndex: number;
      status: 'pass' | 'fail' | 'block' | null;
      note: string;
    }>;
  };
}

export function TestPlanExecute() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const executionType = searchParams.get('type') as 'functional' | 'ui_auto' || 'functional';
  const executionMode = searchParams.get('mode') as 'single' | 'batch' | 'all' || 'all'; // 默认为 all
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [planCases, setPlanCases] = useState<TestPlanCase[]>([]);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [caseStates, setCaseStates] = useState<Map<number, CaseExecutionState>>(new Map());
  const [executionId, setExecutionId] = useState<string>('');
  const [seconds, setSeconds] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 🔥 使用 ref 跟踪是否已提交结果，避免依赖问题
  const hasSubmittedResultsRef = useRef(false);
  const executionIdRef = useRef<string>('');
  
  // 当前用例的详细数据
  const [currentTestCase, setCurrentTestCase] = useState<Record<string, unknown> | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);

  // 计时器
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 格式化时间
  const formattedTime = useMemo(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [seconds]);

  const loadPlanAndCases = useCallback(async () => {
    if (!id || !user) return;

    setLoading(true);
    let createdExecutionId: string | null = null;
    
    try {
      // 获取测试计划详情
      const planDetail = await testPlanService.getTestPlanDetail(parseInt(id));
      
      // 获取 URL 参数中的 caseIds（单个用例执行）
      const caseIdsParam = searchParams.get('caseIds');
      let filteredCases: TestPlanCase[];
      
      if (caseIdsParam) {
        // 如果指定了 caseIds，只执行指定的用例
        const caseIds = caseIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        filteredCases = planDetail.cases.filter(
          (c) => c.case_type === executionType && caseIds.includes(c.case_id)
        );
      } else {
        // 否则执行所有指定类型的用例
        filteredCases = planDetail.cases.filter(
          (c) => c.case_type === executionType
        );
      }

      if (filteredCases.length === 0) {
        showToast.error('没有找到要执行的用例');
        navigate(`/test-plans/${id}`);
        return;
      }

      setPlanCases(filteredCases);

      // 🔥 修复：在确认有用例后再创建执行记录
      try {
        const execution = await testPlanService.startTestPlanExecution({
          plan_id: parseInt(id),
          executor_id: user.id,
          execution_type: executionType,
          case_ids: filteredCases.map((c) => c.case_id),
        });
        createdExecutionId = execution.id;
        setExecutionId(execution.id);
        executionIdRef.current = execution.id;
      } catch (execError) {
        console.error('创建执行记录失败:', execError);
        showToast.error('创建执行记录失败');
        navigate(`/test-plans/${id}`);
        return;
      }

      // 如果是UI自动化，直接开始自动执行
      if (executionType === 'ui_auto') {
        await executeUIAutoCases(filteredCases);
      } else {
        // 功能测试，加载第一个用例的详情
        await loadCaseDetails(filteredCases[0]);
      }
    } catch (error) {
      console.error('加载测试计划失败:', error);
      showToast.error('加载测试计划失败');
      
      // 🔥 修复：如果已创建执行记录，删除它
      if (createdExecutionId) {
        try {
          await testPlanService.deleteTestPlanExecution(createdExecutionId);
          console.log('已删除执行记录:', createdExecutionId);
        } catch (deleteError) {
          console.error('删除执行记录失败:', deleteError);
        }
      }
      
      navigate(`/test-plans/${id}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, executionType, searchParams]);

  // 加载测试计划和用例
  useEffect(() => {
    loadPlanAndCases();
  }, [loadPlanAndCases]);

  // 🔥 修复：页面卸载时，如果未提交任何结果，删除执行记录
  useEffect(() => {
    return () => {
      // 组件卸载时，如果已创建执行记录但未提交任何结果，删除它
      const execId = executionIdRef.current;
      const hasSubmitted = hasSubmittedResultsRef.current;
      
      if (execId && !hasSubmitted) {
        console.log('🧹 页面卸载，未提交结果，删除执行记录:', execId);
        testPlanService.deleteTestPlanExecution(execId).catch((error) => {
          console.error('删除执行记录失败:', error);
        });
      }
    };
  }, []); // 空依赖，只在卸载时执行

  // 加载用例详情（功能测试）
  const loadCaseDetails = async (planCase: TestPlanCase) => {
    try {
      setLoadingCase(true);
      const result = await functionalTestCaseService.getById(planCase.case_id) as { success: boolean; data?: Record<string, unknown> };
      
      if (result.success && result.data) {
        setCurrentTestCase(result.data);
        
        // 初始化执行状态（如果还没有）
        if (!caseStates.has(planCase.case_id)) {
          const state: CaseExecutionState = {
            caseId: planCase.case_id,
            caseName: planCase.case_name,
            caseType: planCase.case_type,
            finalResult: '',
            completed: false,
          };
          setCaseStates((prev) => new Map(prev).set(planCase.case_id, state));
        }
      }
    } catch (error) {
      console.error('加载用例详情失败:', error);
      showToast.error('加载用例详情失败');
    } finally {
      setLoadingCase(false);
    }
  };

  // 执行UI自动化用例
  const executeUIAutoCases = async (cases: TestPlanCase[]) => {
    setExecuting(true);
    
    let passedCount = 0;
    let failedCount = 0;
    
    try {
      for (let i = 0; i < cases.length; i++) {
        const planCase = cases[i];
        setCurrentCaseIndex(i);

        try {
          // 执行UI自动化用例
          console.log('执行UI自动化用例:', planCase.case_name);
          
          const runResult = await testService.runTest({
            testCaseId: planCase.case_id,
            environment: 'default',
          });

          console.log('执行结果:', runResult);

          // 等待执行完成（这里简化处理，实际应该监听WebSocket）
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // 更新执行结果
          await testPlanService.updateTestPlanCaseStatus(
            parseInt(id!),
            planCase.case_id,
            planCase.case_type,
            'pass'
          );

          passedCount++;

          const state: CaseExecutionState = {
            caseId: planCase.case_id,
            caseName: planCase.case_name,
            caseType: planCase.case_type,
            finalResult: 'pass',
            completed: true,
          };

          setCaseStates((prev) => new Map(prev).set(planCase.case_id, state));

          // 更新执行进度
          try {
            await testPlanService.updateTestPlanExecution(executionId, {
              status: 'running',
              progress: Math.round(((i + 1) / cases.length) * 100),
              completed_cases: i + 1,
              passed_cases: passedCount,
              failed_cases: failedCount,
            });
          } catch (updateError) {
            // 如果执行记录已被删除（用户取消），则忽略错误
            if ((updateError as { code?: string })?.code !== 'P2025') {
              console.error('更新执行进度失败:', updateError);
            }
          }
        } catch (error) {
          console.error('执行用例失败:', planCase.case_name, error);
          
          // 执行失败
          failedCount++;
          
          try {
            await testPlanService.updateTestPlanCaseStatus(
              parseInt(id!),
              planCase.case_id,
              planCase.case_type,
              'fail'
            );
          } catch (updateError) {
            console.error('更新用例状态失败:', updateError);
          }

          const state: CaseExecutionState = {
            caseId: planCase.case_id,
            caseName: planCase.case_name,
            caseType: planCase.case_type,
            finalResult: 'fail',
            completed: true,
          };

          setCaseStates((prev) => new Map(prev).set(planCase.case_id, state));

          // 更新执行进度
          try {
            await testPlanService.updateTestPlanExecution(executionId, {
              status: 'running',
              progress: Math.round(((i + 1) / cases.length) * 100),
              completed_cases: i + 1,
              passed_cases: passedCount,
              failed_cases: failedCount,
            });
          } catch (updateError) {
            console.error('更新执行进度失败:', updateError);
          }
        }
      }

      // 完成执行
      try {
        await testPlanService.updateTestPlanExecution(executionId, {
          status: 'completed',
          progress: 100,
          completed_cases: cases.length,
          passed_cases: passedCount,
          failed_cases: failedCount,
          finished_at: new Date(),
          duration_ms: seconds * 1000,
        });
      } catch (updateError) {
        // 如果执行记录已被删除（用户取消），则忽略错误
        if ((updateError as { code?: string })?.code !== 'P2025') {
          console.error('更新执行状态失败:', updateError);
        }
      }

      showToast.success(`UI自动化执行完成: 通过 ${passedCount}, 失败 ${failedCount}`);
      
      // 延迟1秒后返回，让用户看到结果
      setTimeout(() => {
        navigate(`/test-plans/${id}`);
      }, 1000);
    } catch (error) {
      console.error('执行UI自动化失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast.error('执行UI自动化失败: ' + errorMessage);
      
      // 更新执行状态为失败
      try {
        await testPlanService.updateTestPlanExecution(executionId, {
          status: 'failed',
          error_message: errorMessage,
          finished_at: new Date(),
          duration_ms: seconds * 1000,
        });
      } catch (updateError) {
        // 如果执行记录已被删除（用户取消），则忽略错误
        if ((updateError as { code?: string })?.code !== 'P2025') {
          console.error('更新执行状态失败:', updateError);
        }
      }
    } finally {
      setExecuting(false);
    }
  };

  // 当前用例状态
  const currentCase = planCases[currentCaseIndex];
  const currentCaseId = currentCase?.case_id;
  const currentCaseState = caseStates.get(currentCaseId || 0);

  // 🔥 获取当前用例的已提交数据（如果有）- 使用 useMemo 避免重复创建对象
  const currentCaseInitialData = useMemo(() => {
    if (!currentCase) {
      console.log('🔄 [获取初始数据] 没有 currentCase');
      return undefined;
    }
    
    const state = currentCaseState;
    if (!state) {
      console.log('🔄 [获取初始数据] case_id', currentCase.case_id, '没有 state');
      return undefined;
    }
    
    if (!state.completed) {
      console.log('🔄 [获取初始数据] case_id', currentCase.case_id, '未完成');
      return undefined;
    }
    
    if (!state.executionDetails) {
      console.log('🔄 [获取初始数据] case_id', currentCase.case_id, '没有 executionDetails');
      return undefined;
    }
    
    // 从 executionDetails 恢复执行结果
    console.log('✅ [获取初始数据] 为用例恢复执行结果:', {
      case_id: currentCase.case_id,
      case_name: currentCase.case_name,
      finalResult: state.finalResult,
      actualResult长度: state.executionDetails.actualResult?.length || 0,
      comments长度: state.executionDetails.comments?.length || 0,
      executionTime: Math.floor((state.executionDetails.duration_ms || 0) / 1000),
    });
    
    // 🔥 从 base64 恢复截图数据
    const restoredScreenshots = (state.executionDetails.screenshots || []).map((screenshot) => {
      try {
        // 从 base64 重建 File 对象用于预览和重新提交
        const base64Data = `data:${screenshot.mimeType};base64,${screenshot.base64Data}`;
        const arr = base64Data.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || screenshot.mimeType;
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const file = new File([blob], screenshot.fileName, { type: mime });
        
        return {
          file,
          preview: base64Data,
          name: screenshot.fileName
        };
      } catch (error) {
        console.error('恢复截图失败:', screenshot.fileName, error);
        return null;
      }
    }).filter(Boolean) as Array<{ file: File; preview: string; name: string }>;
    
    const initialData = {
      finalResult: state.finalResult as 'pass' | 'fail' | 'block' | '',
      actualResult: state.executionDetails.actualResult || '',
      comments: state.executionDetails.comments || '',
      stepResults: state.executionDetails.stepResults || [], // 🔥 恢复步骤执行结果
      screenshots: restoredScreenshots, // 🔥 从 base64 恢复截图
      executionTime: Math.floor((state.executionDetails.duration_ms || 0) / 1000),
    };
    
    console.log('📋 [恢复执行结果] 完整数据:', {
      stepResults数量: initialData.stepResults.length,
      步骤状态: initialData.stepResults.map((s, i) => `步骤${i+1}:${s.status || '未执行'}`),
      screenshots数量: initialData.screenshots.length,
      截图列表: initialData.screenshots.map(s => s.name),
    });
    
    return initialData;
  }, [currentCase, currentCaseState]); // 🔥 只在当前用例或其状态改变时重新计算

  // 保存当前用例执行结果
  const handleSaveCurrentCase = async (result: ExecutionResultData) => {
    if (!currentCase) return;

    // 🔥 调试日志：查看提交的原始数据
    console.log('🔍 [提交结果] 原始数据:', {
      currentCaseIndex,
      currentCase: {
        case_id: currentCase.case_id,
        case_name: currentCase.case_name,
      },
      result: {
        finalResult: result.finalResult,
        actualResult: result.actualResult?.substring(0, 50) + '...',
        comments: result.comments?.substring(0, 30),
        executionTime: result.executionTime,
        stepResults数量: result.stepResults.length,
        screenshots数量: result.screenshots.length,
      },
    });

    // 🔥 验证：确保用户真正提交了结果，未提交结果不应该生成执行历史记录
    if (!result.finalResult || !result.actualResult?.trim()) {
      console.warn('⚠️ 未提交完整结果，不创建执行历史记录');
      showToast.error('请填写完整的执行结果');
      return;
    }

    try {
      // 保存执行结果，获取execution_id
      const saveResult = await functionalTestCaseService.saveExecutionResult(currentCase.case_id, {
        testCaseName: currentCase.case_name,
        finalResult: result.finalResult as 'pass' | 'fail' | 'block',
        actualResult: result.actualResult,
        comments: result.comments || undefined,
        durationMs: result.executionTime * 1000,
        stepResults: result.stepResults.map((step) => ({
          stepIndex: step.stepIndex + 1,
          action: '',
          expected: '',
          result: step.status,
          note: step.note,
        })),
        totalSteps: result.stepResults.length,
        completedSteps: result.stepResults.filter(r => r.status !== null).length,
        passedSteps: result.stepResults.filter(r => r.status === 'pass').length,
        failedSteps: result.stepResults.filter(r => r.status === 'fail').length,
        blockedSteps: result.stepResults.filter(r => r.status === 'block').length,
        screenshots: result.screenshots.map(s => ({
          fileName: s.name,
          fileSize: s.file.size,
          mimeType: s.file.type,
          base64Data: s.preview.split(',')[1],
          uploadedAt: new Date().toISOString(),
        })),
      }) as { success: boolean; data?: { executionId: string } };

      // 提取execution_id
      const execution_id = saveResult?.data?.executionId;

      // 🔥 标记已提交结果
      hasSubmittedResultsRef.current = true;

      // 更新测试计划用例状态
      await testPlanService.updateTestPlanCaseStatus(
        parseInt(id!),
        currentCase.case_id,
        currentCase.case_type,
        result.finalResult as ExecutionResult
      );

      // 标记为已完成，保存完整的执行详情
      const newState: CaseExecutionState = {
        caseId: currentCase.case_id,
        caseName: currentCase.case_name,
        caseType: currentCase.case_type,
        finalResult: result.finalResult as ExecutionResult,
        completed: true,
        // 🔥 保存详细执行信息
        executionDetails: {
          execution_id: execution_id,
          duration_ms: result.executionTime * 1000,
          actualResult: result.actualResult,
          comments: result.comments || undefined,
          totalSteps: result.stepResults.length,
          completedSteps: result.stepResults.filter(r => r.status !== null).length,
          passedSteps: result.stepResults.filter(r => r.status === 'pass').length,
          failedSteps: result.stepResults.filter(r => r.status === 'fail').length,
          blockedSteps: result.stepResults.filter(r => r.status === 'block').length,
          screenshots: result.screenshots.map(s => ({
            fileName: s.name,
            fileSize: s.file.size,
            mimeType: s.file.type,
            base64Data: s.preview.split(',')[1],
            uploadedAt: new Date().toISOString(),
          })),
          // 🔥 保存步骤执行结果，以便恢复
          stepResults: result.stepResults,
        },
      };
      
      // 🔥 调试日志：查看保存的 newState
      console.log('💾 [保存状态] newState:', {
        caseId: newState.caseId,
        caseName: newState.caseName,
        finalResult: newState.finalResult,
        completed: newState.completed,
        有executionDetails: !!newState.executionDetails,
        executionDetails: newState.executionDetails ? {
          有execution_id: !!newState.executionDetails.execution_id,
          有actualResult: !!newState.executionDetails.actualResult,
          有screenshots: !!newState.executionDetails.screenshots && newState.executionDetails.screenshots.length > 0,
          步骤统计: {
            total: newState.executionDetails.totalSteps,
            passed: newState.executionDetails.passedSteps,
            failed: newState.executionDetails.failedSteps,
            blocked: newState.executionDetails.blockedSteps,
          },
        } : null,
      });
      
      // 🔥 修复：先更新 allCompletedCases，再更新 React 状态
      // 构建包含当前用例的完整状态 Map
      const allCompletedCases = new Map(caseStates);
      allCompletedCases.set(currentCase.case_id, newState); // 添加当前刚完成的用例
      
      // 然后再更新 React 状态（这是异步的）
      setCaseStates(allCompletedCases);

      // 更新执行进度和execution_results
      const completedCount = Array.from(allCompletedCases.values()).filter(s => s.completed).length;
      const passedCount = Array.from(allCompletedCases.values()).filter(s => s.finalResult === 'pass').length;
      const failedCount = Array.from(allCompletedCases.values()).filter(s => s.finalResult === 'fail').length;
      const blockedCount = Array.from(allCompletedCases.values()).filter(s => s.finalResult === 'block').length;
      
      // 🔥 调试日志：查看构建前的状态
      console.log('🔍 [构建executionResults前] 当前状态:', {
        currentCaseIndex,
        completedCount,
        planCases数量: planCases.length,
        execution_id,
        allCompletedCases数量: allCompletedCases.size,
        allCompletedCases内容: Array.from(allCompletedCases.entries()).map(([caseId, state]) => ({
          caseId,
          completed: state.completed,
          result: state.finalResult,
          有executionDetails: !!state.executionDetails,
        })),
      });
      
      const executionResults = planCases
        .filter(pc => {
          const state = allCompletedCases.get(pc.case_id);
          // 🔥 修复：只包含 completed: true 的用例
          return state && state.completed === true;
        })
        .map((pc) => {
          const state = allCompletedCases.get(pc.case_id);
          if (!state) {
            console.warn(`⚠️ [构建executionResults] case_id ${pc.case_id} 没有 state`);
            return null;
          }
          
          console.log(`🔍 [构建executionResults] case_id ${pc.case_id}:`, {
            completed: state.completed,
            finalResult: state.finalResult,
            有executionDetails: !!state.executionDetails,
          });
          
          // 🔥 判断是否是当前刚提交的用例
          if (pc.case_id === currentCase.case_id) {
            console.log(`✅ [构建executionResults] case_id ${pc.case_id} - 当前用例分支`);
            // 当前用例，使用刚提交的 result 数据
            return {
              case_id: pc.case_id,
              case_name: pc.case_name,
              case_type: pc.case_type,
              result: result.finalResult as ExecutionResult,
              duration_ms: result.executionTime * 1000,
              execution_id: execution_id,
              executed_at: new Date().toISOString(),
              executor_name: user?.accountName || user?.username,
              // 🔥 增加详细信息字段
              actualResult: result.actualResult,
              comments: result.comments || undefined,
              totalSteps: result.stepResults.length,
              completedSteps: result.stepResults.filter(r => r.status !== null).length,
              passedSteps: result.stepResults.filter(r => r.status === 'pass').length,
              failedSteps: result.stepResults.filter(r => r.status === 'fail').length,
              blockedSteps: result.stepResults.filter(r => r.status === 'block').length,
              screenshots: result.screenshots.map(s => ({
                fileName: s.name,
                fileSize: s.file.size,
                mimeType: s.file.type,
                base64Data: s.preview.split(',')[1],
                uploadedAt: new Date().toISOString(),
              })),
            };
          } else if (state.executionDetails) {
            console.log(`📂 [构建executionResults] case_id ${pc.case_id} - 之前执行用例分支（有executionDetails）`);
            // 🔥 之前执行的用例，从 state.executionDetails 中读取完整的详细信息
            return {
              case_id: pc.case_id,
              case_name: pc.case_name,
              case_type: pc.case_type,
              result: state.finalResult,
              executed_at: new Date().toISOString(),
              executor_name: user?.accountName || user?.username,
              // 从 executionDetails 中读取详细信息
              execution_id: state.executionDetails.execution_id,
              duration_ms: state.executionDetails.duration_ms,
              actualResult: state.executionDetails.actualResult,
              comments: state.executionDetails.comments,
              totalSteps: state.executionDetails.totalSteps,
              completedSteps: state.executionDetails.completedSteps,
              passedSteps: state.executionDetails.passedSteps,
              failedSteps: state.executionDetails.failedSteps,
              blockedSteps: state.executionDetails.blockedSteps,
              screenshots: state.executionDetails.screenshots,
            };
          } else {
            console.log(`⚠️ [构建executionResults] case_id ${pc.case_id} - else分支（无executionDetails），state:`, {
              finalResult: state.finalResult,
              completed: state.completed,
              有executionDetails: !!state.executionDetails,
            });
            // 没有详细信息的情况（比如跳过的用例）
            return {
              case_id: pc.case_id,
              case_name: pc.case_name,
              case_type: pc.case_type,
              result: state.finalResult,
              executed_at: new Date().toISOString(),
              executor_name: user?.accountName || user?.username,
            };
          }
        })
        .filter(Boolean);
      
      // 🔥 调试日志：检查 executionResults 的数据
      console.log('📊 [批量执行] 当前 executionResults:', {
        总数量: executionResults.length,
        当前用例索引: currentCaseIndex,
        已完成数量: completedCount,
        用例详情: executionResults.map((r: unknown) => {
          const record = r as Record<string, unknown>;
          return {
            case_id: record.case_id,
            case_name: record.case_name,
            result: record.result,
            有execution_id: !!record.execution_id,
            有actualResult: !!record.actualResult,
            有screenshots: !!record.screenshots && Array.isArray(record.screenshots) && record.screenshots.length > 0,
            步骤统计: {
              total: record.totalSteps,
              passed: record.passedSteps,
              failed: record.failedSteps,
              blocked: record.blockedSteps,
            },
          };
        }),
      });

      // 🔥 更新执行进度（如果记录已被删除则忽略错误）
      try {
        await testPlanService.updateTestPlanExecution(executionId, {
          status: 'running',
          progress: Math.round((completedCount / planCases.length) * 100),
          completed_cases: completedCount,
          passed_cases: passedCount,
          failed_cases: failedCount,
          blocked_cases: blockedCount,
          execution_results: executionResults,
        });
        console.log('✅ [批量执行] 执行进度已更新');
      } catch (updateError) {
        // 如果执行记录已被删除（用户取消），则忽略错误
        if ((updateError as { code?: string })?.code !== 'P2025') {
          console.error('更新执行进度失败:', updateError);
        }
      }

      // 单个用例执行时，执行完成后立即返回
      if (isSingleCaseExecution) {
        try {
          await testPlanService.updateTestPlanExecution(executionId, {
            status: 'completed',
            progress: 100,
            completed_cases: 1,
            passed_cases: result.finalResult === 'pass' ? 1 : 0,
            failed_cases: result.finalResult === 'fail' ? 1 : 0,
            blocked_cases: result.finalResult === 'block' ? 1 : 0,
            skipped_cases: 0,
            finished_at: new Date(),
            duration_ms: result.executionTime * 1000,
            execution_results: executionResults,
          });
        } catch (updateError) {
          // 如果执行记录已被删除（用户取消），则忽略错误
          if ((updateError as { code?: string })?.code !== 'P2025') {
            console.error('更新执行状态失败:', updateError);
          }
        }

        showToast.success('执行结果已保存');
        setTimeout(() => {
          navigate(`/test-plans/${id}`);
        }, 1000);
        return;
      }

      showToast.success('执行结果已保存');

      // 如果还有下一个用例，自动跳转
      if (currentCaseIndex < planCases.length - 1) {
        handleNextCase();
      } else {
        // 所有用例执行完成
        try {
          await testPlanService.updateTestPlanExecution(executionId, {
            status: 'completed',
            progress: 100,
            completed_cases: planCases.length,
            finished_at: new Date(),
            duration_ms: seconds * 1000,
            execution_results: executionResults,
          });
        } catch (updateError) {
          // 如果执行记录已被删除（用户取消），则忽略错误
          if ((updateError as { code?: string })?.code !== 'P2025') {
            console.error('更新执行状态失败:', updateError);
          }
        }

        showToast.success('所有用例执行完成');
        setTimeout(() => {
          navigate(`/test-plans/${id}`);
        }, 1000);
      }
    } catch (error) {
      console.error('保存执行结果失败:', error);
      showToast.error('保存执行结果失败');
      throw error; // 重新抛出错误，让 TestCaseExecutor 知道保存失败
    }
  };

  // 跳过当前用例
  const handleSkipCurrentCase = async () => {
    if (!currentCase) return;

    try {
      await testPlanService.updateTestPlanCaseStatus(
        parseInt(id!),
        currentCase.case_id,
        currentCase.case_type,
        'skip'
      );

      const newState: CaseExecutionState = {
        caseId: currentCase.case_id,
        caseName: currentCase.case_name,
        caseType: currentCase.case_type,
        finalResult: 'skip',
        completed: true,
      };

      setCaseStates((prev) => new Map(prev).set(currentCase.case_id, newState));

      // 更新执行结果列表
      const completedCount = Array.from(caseStates.values()).filter(s => s.completed).length + 1;
      const skippedCount = Array.from(caseStates.values()).filter(s => s.finalResult === 'skip').length + 1;
      
      const executionResults = planCases.slice(0, completedCount).map((pc, idx) => {
        const state = caseStates.get(pc.case_id);
        if (idx === currentCaseIndex) {
          return {
            case_id: pc.case_id,
            case_name: pc.case_name,
            case_type: pc.case_type,
            result: 'skip' as ExecutionResult,
            executed_at: new Date().toISOString(),
            executor_name: user?.accountName || user?.username,
          };
        } else if (state) {
          return {
            case_id: pc.case_id,
            case_name: pc.case_name,
            case_type: pc.case_type,
            result: state.finalResult,
            executed_at: new Date().toISOString(),
            executor_name: user?.accountName || user?.username,
          };
        }
        return null;
      }).filter(Boolean);

      showToast.info('已跳过当前用例');
      
      if (currentCaseIndex < planCases.length - 1) {
        // 更新进度
        try {
          await testPlanService.updateTestPlanExecution(executionId, {
            status: 'running',
            progress: Math.round((completedCount / planCases.length) * 100),
            completed_cases: completedCount,
            skipped_cases: skippedCount,
            execution_results: executionResults,
          });
        } catch (updateError) {
          // 如果执行记录已被删除（用户取消），则忽略错误
          if ((updateError as { code?: string })?.code !== 'P2025') {
            console.error('更新执行进度失败:', updateError);
          }
        }
        handleNextCase();
      } else {
        // 最后一个用例，返回测试计划
        try {
          await testPlanService.updateTestPlanExecution(executionId, {
            status: 'completed',
            progress: 100,
            completed_cases: planCases.length,
            finished_at: new Date(),
            duration_ms: seconds * 1000,
            execution_results: executionResults,
          });
        } catch (updateError) {
          // 如果执行记录已被删除（用户取消），则忽略错误
          if ((updateError as { code?: string })?.code !== 'P2025') {
            console.error('更新执行状态失败:', updateError);
          }
        }
        
        navigate(`/test-plans/${id}`);
      }
    } catch (error) {
      console.error('跳过用例失败:', error);
      showToast.error('跳过用例失败');
    }
  };

  // 上一个用例
  const handlePrevCase = async () => {
    if (currentCaseIndex > 0) {
      const prevIndex = currentCaseIndex - 1;
      setCurrentCaseIndex(prevIndex);
      
      // 加载上一个用例详情
      const prevCase = planCases[prevIndex];
      await loadCaseDetails(prevCase);
    }
  };

  // 下一个用例
  const handleNextCase = async () => {
    if (currentCaseIndex < planCases.length - 1) {
      const nextIndex = currentCaseIndex + 1;
      setCurrentCaseIndex(nextIndex);
      
      // 加载下一个用例详情
      const nextCase = planCases[nextIndex];
      await loadCaseDetails(nextCase);
    }
  };

  // 判断是否为单个用例执行（通过 mode 参数判断）
  const isSingleCaseExecution = useMemo(() => {
    const result = executionMode === 'single';
    if (result) {
      console.log('单个用例执行模式');
    } else {
      console.log('批量/全部执行模式:', executionMode);
    }
    return result;
  }, [executionMode]);

  // 统计信息
  const statistics = useMemo(() => {
    const total = planCases.length;
    let completed = 0;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let skipped = 0;

    planCases.forEach((planCase) => {
      const state = caseStates.get(planCase.case_id);
      if (state?.completed) {
        completed++;
        if (state.finalResult === 'pass') passed++;
        else if (state.finalResult === 'fail') failed++;
        else if (state.finalResult === 'block') blocked++;
        else if (state.finalResult === 'skip') skipped++;
      }
    });

    return { total, completed, passed, failed, blocked, skipped };
  }, [planCases, caseStates]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // UI自动化执行中
  if (executionType === 'ui_auto' && executing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                正在执行UI自动化测试
              </h2>
              <p className="text-gray-600 mb-6">
                当前: {currentCaseIndex + 1} / {planCases.length}
              </p>
              
              {currentCase && (
                <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="font-medium text-gray-900 mb-2">
                    {currentCase.case_name}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                  <div className="text-sm text-gray-500">总计</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{statistics.completed}</div>
                  <div className="text-sm text-gray-500">已完成</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{statistics.passed}</div>
                  <div className="text-sm text-gray-500">通过</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
                  <div className="text-sm text-gray-500">失败</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{statistics.skipped}</div>
                  <div className="text-sm text-gray-500">跳过</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 功能测试手动执行界面
  if (!currentCase || !currentTestCase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* 顶部导航 */}
          <div className="mb-6">
            <button
              onClick={() => navigate(`/test-plans/${id}`)}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              返回测试计划
            </button>
            
            {/* 进度条 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">
                    执行进度: {currentCaseIndex + 1} / {planCases.length}
                  </span>
                  <span className="text-sm text-gray-500">
                    用时: {formattedTime}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">通过: {statistics.passed}</span>
                  <span className="text-red-600">失败: {statistics.failed}</span>
                  <span className="text-yellow-600">阻塞: {statistics.blocked}</span>
                  <span className="text-gray-600">跳过: {statistics.skipped}</span>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(statistics.completed / statistics.total) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            {loadingCase ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500">加载用例中...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 text-gray-300 mx-auto mb-4">📋</div>
                <p className="text-gray-500">没有找到要执行的用例</p>
                <button
                  onClick={() => navigate(`/test-plans/${id}`)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  返回测试计划
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 左右分栏布局 */}
      <div className="flex h-screen overflow-hidden">
        {/* 左侧栏：进度和用例列表（单个用例执行时隐藏）*/}
        {!isSingleCaseExecution && (
          <div 
            className={clsx(
              'flex-shrink-0 transition-all duration-300 relative',
              sidebarCollapsed ? 'w-10' : 'w-[500px]'
            )}
          >
          <div className="h-full flex flex-col">
            {!sidebarCollapsed && (
              <>
                {/* 返回按钮 */}
                <div className="px-4 pt-4 pb-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/test-plans/${id}`)}
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    返回测试计划
                  </button>
                </div>

                {/* 进度卡片 */}
                <div className="px-4 pb-3 flex-shrink-0">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">
                          执行进度
                        </span>
                        <span className="text-xs text-gray-500">
                          {formattedTime}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {currentCaseIndex + 1} / {planCases.length}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round((statistics.completed / statistics.total) * 100)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(statistics.completed / statistics.total) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* 统计信息 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <span className="text-gray-600">通过</span>
                        <span className="font-semibold text-green-600">{statistics.passed}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <span className="text-gray-600">失败</span>
                        <span className="font-semibold text-red-600">{statistics.failed}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                        <span className="text-gray-600">阻塞</span>
                        <span className="font-semibold text-yellow-600">{statistics.blocked}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">跳过</span>
                        <span className="font-semibold text-gray-600">{statistics.skipped}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 用例列表 */}
                <div className="px-4 flex-1 min-h-0">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        用例列表 ({planCases.length})
                      </h3>
                    </div>
                    
                    <div className="overflow-y-auto p-3 flex-1">
                      <div className="space-y-2">
                        {planCases.map((planCase, index) => {
                          const state = caseStates.get(planCase.case_id);
                          const isActive = index === currentCaseIndex;
                          
                          return (
                            <button
                              key={planCase.id}
                              onClick={() => {
                                setCurrentCaseIndex(index);
                                loadCaseDetails(planCase);
                              }}
                              className={clsx(
                                'w-full text-left p-3 rounded-lg transition-all text-xs',
                                isActive && 'bg-blue-50 border-2 border-blue-500 shadow-sm',
                                !isActive && 'border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex-shrink-0">
                                  {state?.completed ? (
                                    state.finalResult === 'pass' ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : state.finalResult === 'fail' ? (
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    ) : state.finalResult === 'block' ? (
                                      <MinusCircle className="w-4 h-4 text-yellow-600" />
                                    ) : (
                                      <SkipForward className="w-4 h-4 text-gray-400" />
                                    )
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={clsx(
                                    'font-medium',
                                    isActive ? 'text-blue-900' : 'text-gray-900'
                                  )}>
                                    {index + 1}. {planCase.case_name}
                                  </div>
                                </div>
                                {state?.completed && (
                                    <div className={clsx(
                                      'text-xs px-2 py-0.5 rounded inline-block',
                                      state.finalResult === 'pass' && 'bg-green-100 text-green-700',
                                      state.finalResult === 'fail' && 'bg-red-100 text-red-700',
                                      state.finalResult === 'block' && 'bg-yellow-100 text-yellow-700',
                                      state.finalResult === 'skip' && 'bg-gray-100 text-gray-700'
                                    )}>
                                      {state.finalResult === 'pass' && '已通过'}
                                      {state.finalResult === 'fail' && '已失败'}
                                      {state.finalResult === 'block' && '已阻塞'}
                                      {state.finalResult === 'skip' && '已跳过'}
                                    </div>
                                  )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* 收起/展开按钮 - 放在右上角 */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={clsx(
              'absolute top-4 p-1.5 bg-white rounded-full shadow-md border border-gray-200 hover:bg-gray-50 hover:shadow-lg transition-all z-10',
              sidebarCollapsed ? 'left-[0px]' : 'right-4'
            )}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
        )}

        {/* 右侧栏：测试用例执行器 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-0">
          <TestCaseExecutor
            testCase={currentTestCase}
            onSubmit={handleSaveCurrentCase}
            onCancel={async () => {
              // 如果已创建执行记录，取消时删除它
              if (executionId) {
                try {
                  await testPlanService.deleteTestPlanExecution(executionId);
                  console.log('已删除执行记录:', executionId);
                } catch (error) {
                  console.error('删除执行记录失败:', error);
                  // 即使删除失败也继续返回
                }
              }
              navigate(`/test-plans/${id}`);
            }}
            showBatchControls={!isSingleCaseExecution}
            onPrevious={handlePrevCase}
            onSkip={handleSkipCurrentCase}
            hasPrevious={!isSingleCaseExecution && currentCaseIndex > 0}
            hasNext={!isSingleCaseExecution && currentCaseIndex < planCases.length - 1}
            hideBackButton={!isSingleCaseExecution}
            inTestPlan={false}
            initialData={currentCaseInitialData}
          />
        </div>
      </div>
    </div>
  );
}
