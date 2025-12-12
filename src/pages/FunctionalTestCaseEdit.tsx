import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import * as systemService from '../services/systemService';
import type { SystemOption, ProjectVersion } from '../types/test';
import { showToast } from '../utils/toast';
import { Input, Select, Modal } from 'antd';

const { Option } = Select;
const { TextArea } = Input;

// 草稿缓存的 LocalStorage Key（编辑页面专用）
const DRAFT_CACHE_KEY_EDIT = 'test_case_edit_draft_';

/**
 * 测试步骤接口
 */
interface TestStep {
  id: string;
  step: string;
  expectedResult: string;
}

/**
 * 表单数据接口
 */
interface FormData {
  caseId: string;
  title: string;
  project: string;
  module: string;
  scenario: string;
  testPoint: string;
  caseType: string;
  caseVersion: string;
  priority: 'low' | 'medium' | 'high';
  preconditions: string;
  testData: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 场景数据接口
 */
interface ScenarioData {
  value: string;
  label: string;
  testPoints: Array<{ value: string; label: string }>;
}

/**
 * 草稿数据接口
 */
interface DraftData {
  testCaseId: string;  // 记录是哪个测试用例的草稿
  formData: FormData;
  testSteps: TestStep[];
  scenariosData: ScenarioData[];
  timestamp: number;
}

/**
 * 功能测试用例编辑页面
 */
export function FunctionalTestCaseEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingData, setGeneratingData] = useState(false);
  
  // 系统字典列表
  const [systemOptions, setSystemOptions] = useState<SystemOption[]>([]);
  // 项目版本列表
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  // 测试场景列表
  const [scenariosData, setScenariosData] = useState<Array<{ value: string; label: string; testPoints: Array<{ value: string; label: string }> }>>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  // 模块列表
  const [modulesData, setModulesData] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<FormData>({
    caseId: '',
    title: '',
    project: '',
    module: '',
    scenario: '',
    testPoint: '',
    caseType: '',
    caseVersion: '',
    priority: 'high',
    preconditions: '',
    testData: '',
    remarks: '',
    createdBy: '',
    createdAt: '',
    updatedAt: ''
  });
  
  // 测试步骤
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    { id: `step-${Date.now()}`, step: '', expectedResult: '' }
  ]);
  
  // 草稿加载状态
  const [draftLoaded, setDraftLoaded] = useState(false);
  
  // 拖拽相关状态
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  
  // 获取当前选中场景的测试点列表
  const currentTestPoints = scenariosData.find(s => s.value === formData.scenario)?.testPoints || [];
  
  // 加载系统字典列表
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

  // 根据选择的项目加载版本列表
  useEffect(() => {
    const loadProjectVersions = async () => {
      if (!formData.project) {
        setProjectVersions([]);
        return;
      }

      // 根据项目名称找到项目ID
      const selectedSystem = systemOptions.find(s => s.name === formData.project);
      if (!selectedSystem) {
        setProjectVersions([]);
        return;
      }

      try {
        setLoadingVersions(true);
        const versions = await systemService.getProjectVersions(selectedSystem.id);
        setProjectVersions(versions);
      } catch (error) {
        console.error('加载项目版本失败:', error);
        setProjectVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadProjectVersions();
  }, [formData.project, systemOptions]);

  // 根据选择的项目加载测试场景列表
  useEffect(() => {
    const loadScenarios = async () => {
      if (!formData.project) {
        setScenariosData([]);
        return;
      }

      try {
        setLoadingScenarios(true);
        const scenarios = await functionalTestCaseService.getScenariosBySystem(formData.project);
        
        // 确保当前场景在列表中（用于编辑时显示）
        let finalScenarios = scenarios;
        if (formData.scenario) {
          const scenarioExists = scenarios.some(s => s.value === formData.scenario || s.label === formData.scenario);
          if (!scenarioExists) {
            // 添加当前场景到列表
            const currentScenario = {
              value: formData.scenario,
              label: formData.scenario,
              testPoints: formData.testPoint ? [{ value: formData.testPoint, label: formData.testPoint }] : []
            };
            finalScenarios = [...scenarios, currentScenario];
          } else if (formData.testPoint) {
            // 场景存在，确保测试点也在列表中
            finalScenarios = scenarios.map(s => {
              if (s.value === formData.scenario || s.label === formData.scenario) {
                const testPointExists = s.testPoints.some(p => p.value === formData.testPoint || p.label === formData.testPoint);
                if (!testPointExists) {
                  return {
                    ...s,
                    testPoints: [...s.testPoints, { value: formData.testPoint, label: formData.testPoint }]
                  };
                }
              }
              return s;
            });
          }
        }
        
        setScenariosData(finalScenarios);
      } catch (error) {
        console.error('加载测试场景失败:', error);
        // 如果加载失败但有当前场景，至少添加当前场景
        if (formData.scenario) {
          setScenariosData([{
            value: formData.scenario,
            label: formData.scenario,
            testPoints: formData.testPoint ? [{ value: formData.testPoint, label: formData.testPoint }] : []
          }]);
        } else {
          setScenariosData([]);
        }
      } finally {
        setLoadingScenarios(false);
      }
    };

    loadScenarios();
  }, [formData.project, formData.scenario, formData.testPoint]);

  // 根据选择的项目加载模块列表
  useEffect(() => {
    const loadModules = async () => {
      if (!formData.project) {
        setModulesData([]);
        return;
      }

      try {
        setLoadingModules(true);
        const modules = await functionalTestCaseService.getModulesBySystem(formData.project);
        
        // 确保当前模块在列表中（用于编辑时显示）
        let finalModules = modules;
        if (formData.module) {
          const moduleExists = modules.some(m => m.value === formData.module || m.label === formData.module);
          if (!moduleExists) {
            finalModules = [...modules, { value: formData.module, label: formData.module }];
          }
        }
        
        setModulesData(finalModules);
      } catch (error) {
        console.error('加载模块列表失败:', error);
        // 如果加载失败但有当前模块，至少添加当前模块
        if (formData.module) {
          setModulesData([{ value: formData.module, label: formData.module }]);
        } else {
          setModulesData([]);
        }
      } finally {
        setLoadingModules(false);
      }
    };

    loadModules();
  }, [formData.project, formData.module]);

  
  // 加载测试用例数据
  useEffect(() => {
    const loadTestCase = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const result = await functionalTestCaseService.getById(Number(id));
        
        if (result.success && result.data) {
          const testCase = result.data;
          
          // 反向映射用例类型（从数据库枚举值转换为表单值）
          const reverseCaseTypeMap: { [key: string]: string } = {
            'SMOKE': 'smoke',
            'FULL': 'full',
            'ABNORMAL': 'abnormal',
            'BOUNDARY': 'boundary',
            'PERFORMANCE': 'performance',
            'SECURITY': 'security',
            'USABILITY': 'usability',
            'COMPATIBILITY': 'compatibility',
            'RELIABILITY': 'reliability'
          };
          // 兼容多种字段名：优先使用下划线命名（后端返回格式）
          const dbCaseType = testCase.test_type || testCase.case_type || testCase.testType || testCase.caseType || '';
          const formCaseType = reverseCaseTypeMap[dbCaseType] || '';
          
          // 填充表单数据 - 兼容多种字段名
          setFormData({
            caseId: testCase.caseId || testCase.case_id || testCase.id?.toString() || '',
            title: testCase.name || '',
            project: testCase.system || '',
            module: testCase.module || '',
            scenario: testCase.testScenario || testCase.scenarioName || testCase.scenario_name || '',
            testPoint: testCase.testPoints?.[0]?.testPointName || testCase.testPoints?.[0]?.testPoint || testCase.test_point_name || '',
            caseType: formCaseType,
            caseVersion: testCase.project_version?.version_name || testCase.project_version?.version_code || '',
            priority: testCase.priority || 'medium',
            preconditions: testCase.preconditions || '',
            testData: testCase.testData || testCase.test_data || '',
            remarks: testCase.description || '',
            createdBy: testCase.createdBy?.toString() || testCase.users?.username || '',
            createdAt: testCase.createdAt || testCase.created_at || '',
            updatedAt: testCase.updatedAt || testCase.updated_at || ''
          });
          
          // 解析测试步骤 - 兼容多种字段名
          if (testCase.steps) {
            const stepsArray = testCase.steps.split('\n').filter(s => s.trim());
            const assertionsArray = (testCase.assertions || testCase.expected_result)?.split('\n').filter(s => s.trim()) || [];
            
            const parsedSteps: TestStep[] = stepsArray.map((step, index) => ({
              id: `step-${Date.now()}-${index}`,
              step: step.replace(/^\d+\.\s*/, ''),
              expectedResult: assertionsArray[index]?.replace(/^\d+\.\s*/, '') || ''
            }));
            
            if (parsedSteps.length > 0) {
              setTestSteps(parsedSteps);
            }
          }
        } else {
          showToast.error('加载测试用例失败');
          navigate('/functional-test-cases');
        }
      } catch (error) {
        console.error('加载测试用例失败:', error);
        showToast.error('加载测试用例失败');
        navigate('/functional-test-cases');
      } finally {
        setLoading(false);
      }
    };
    
    loadTestCase();
  }, [id, navigate]);
  
  // 检查草稿（在数据加载完成后）
  useEffect(() => {
    const checkDraft = () => {
      if (!id || draftLoaded || loading) return;
      
      try {
        const draftKey = `${DRAFT_CACHE_KEY_EDIT}${id}`;
        const draftStr = localStorage.getItem(draftKey);
        if (!draftStr) {
          setDraftLoaded(true);
          return;
        }
        
        const draft: DraftData = JSON.parse(draftStr);
        const timeDiff = Date.now() - draft.timestamp;
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        // 格式化时间显示
        let timeText = '';
        if (daysDiff > 0) {
          timeText = ` ${daysDiff}天 前`;
        } else {
          const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
          if (hoursDiff > 0) {
            timeText = ` ${hoursDiff}小时 前`;
          } else {
            const minutesDiff = Math.floor(timeDiff / (1000 * 60));
            timeText = ` ${minutesDiff}分钟 前`;
          }
        }
        
        // 处理显示文本
        const displayModule = draft.formData.module || '未选择';
        
        let displayScenario = '未选择';
        if (draft.formData.scenario) {
          if (draft.formData.scenario.startsWith('custom-')) {
            const scenario = draft.scenariosData?.find(s => s.value === draft.formData.scenario);
            displayScenario = scenario ? `${scenario.label}（已添加）` : draft.formData.scenario;
          } else {
            displayScenario = draft.formData.scenario;
          }
        }
        
        let displayTestPoint = '未选择';
        if (draft.formData.testPoint) {
          if (draft.formData.testPoint.startsWith('custom-point-')) {
            const scenario = draft.scenariosData?.find(s => s.value === draft.formData.scenario);
            const testPoint = scenario?.testPoints?.find(tp => tp.value === draft.formData.testPoint);
            displayTestPoint = testPoint ? `${testPoint.label}（已添加）` : draft.formData.testPoint;
          } else {
            displayTestPoint = draft.formData.testPoint;
          }
        }
        
        Modal.confirm({
          title: '发现未完成的草稿',
          width: 600,
          content: (
            <div>
              <p>发现未完成的草稿（保存于{timeText}）</p>
              <p>所属项目：{draft.formData.project || '未选择'}</p>
              <p>所属模块：{displayModule}</p>
              <p>测试场景：{displayScenario}</p>
              <p>测试点：{displayTestPoint}</p>
              <p>用例标题：{draft.formData.title || '未填写'}</p>
              <br />
              <p>是否继续编辑？</p>
            </div>
          ),
          okText: '恢复草稿',
          cancelText: '使用原数据',
          onOk: () => {
            // 恢复草稿数据
            setFormData(draft.formData);
            setTestSteps(draft.testSteps);
            if (draft.scenariosData && draft.scenariosData.length > 0) {
              setScenariosData(draft.scenariosData);
            }
            showToast.success('已恢复上次编辑的内容');
          },
          onCancel: () => {
            // 不恢复，清除草稿
            localStorage.removeItem(draftKey);
          }
        });
      } catch (error) {
        console.error('加载草稿失败:', error);
        if (id) {
          localStorage.removeItem(`${DRAFT_CACHE_KEY_EDIT}${id}`);
        }
      } finally {
        setDraftLoaded(true);
      }
    };
    
    // 等待数据加载完成后再检查草稿
    if (!loading && formData.project) {
      checkDraft();
    }
  }, [id, loading, draftLoaded, formData.project]);
  
  /**
   * 处理表单字段变更
   */
  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 如果切换项目，重置版本、模块、场景和测试点选择（与创建页面保持一致）
    if (field === 'project') {
      setFormData(prev => ({ ...prev, caseVersion: '', module: '', scenario: '', testPoint: '' }));
    }
    
    // 如果切换场景，重置测试点
    if (field === 'scenario') {
      setFormData(prev => ({ ...prev, testPoint: '' }));
    }
  };
  
  /**
   * 添加测试步骤
   */
  const handleAddStep = () => {
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      step: '',
      expectedResult: ''
    };
    setTestSteps(prev => [...prev, newStep]);
  };
  
  /**
   * 删除测试步骤
   */
  const handleDeleteStep = (stepId: string) => {
    if (testSteps.length <= 1) {
      showToast.error('至少保留一个测试步骤');
      return;
    }
    setTestSteps(prev => prev.filter(s => s.id !== stepId));
  };
  
  /**
   * 更新测试步骤
   */
  const handleUpdateStep = (stepId: string, field: 'step' | 'expectedResult', value: string) => {
    setTestSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, [field]: value } : s
    ));
  };
  
  /**
   * 在指定位置之前插入步骤
   */
  const handleInsertBefore = (stepId: string) => {
    const index = testSteps.findIndex(s => s.id === stepId);
    if (index === -1) return;
    
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      step: '',
      expectedResult: ''
    };
    
    const newSteps = [...testSteps];
    newSteps.splice(index, 0, newStep);
    setTestSteps(newSteps);
  };
  
  /**
   * 在指定位置之后插入步骤
   */
  const handleInsertAfter = (stepId: string) => {
    const index = testSteps.findIndex(s => s.id === stepId);
    if (index === -1) return;
    
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      step: '',
      expectedResult: ''
    };
    
    const newSteps = [...testSteps];
    newSteps.splice(index + 1, 0, newStep);
    setTestSteps(newSteps);
  };
  
  /**
   * 复制测试步骤
   */
  const handleCopyStep = (stepId: string) => {
    const step = testSteps.find(s => s.id === stepId);
    if (!step) return;
    
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      step: step.step,
      expectedResult: step.expectedResult
    };
    
    const index = testSteps.findIndex(s => s.id === stepId);
    const newSteps = [...testSteps];
    newSteps.splice(index + 1, 0, newStep);
    setTestSteps(newSteps);
  };
  
  /**
   * 拖拽开始
   */
  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  /**
   * 拖拽经过
   */
  const handleDragOver = (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || draggedStepId === targetStepId) return;
    
    const draggedIndex = testSteps.findIndex(s => s.id === draggedStepId);
    const targetIndex = testSteps.findIndex(s => s.id === targetStepId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newSteps = [...testSteps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedStep);
    setTestSteps(newSteps);
  };
  
  /**
   * 拖拽结束
   */
  const handleDragEnd = () => {
    setDraggedStepId(null);
  };
  
  /**
   * AI生成测试数据
   */
  const handleGenerateTestData = async () => {
    if (!formData.title) {
      showToast.error('请先填写测试用例标题，AI将根据标题生成测试数据');
      return;
    }
    
    setGeneratingData(true);
    
    // 模拟AI生成（实际应调用后端API）
    setTimeout(() => {
      const mockData = `用户名：testuser001\n密码：Test@123456\n邮箱：testuser@example.com\n手机号：13800138000\n验证码：888888`;
      setFormData(prev => ({ ...prev, testData: mockData }));
      setGeneratingData(false);
      showToast.success('测试数据已生成');
    }, 2000);
  };
  
  /**
   * 表单验证（与创建页面保持一致）
   */
  const validateForm = (): boolean => {
    // 验证基本信息
    if (!formData.project) {
      showToast.error('请选择所属项目');
      return false;
    }
    
    if (!formData.module) {
      showToast.error('请选择所属模块');
      return false;
    }
    
    // 验证场景和测试点
    if (!formData.scenario) {
      showToast.error('请选择测试场景');
      return false;
    }
    
    if (!formData.testPoint) {
      showToast.error('请选择测试点');
      return false;
    }
    
    // 验证用例信息
    if (!formData.caseType) {
      showToast.error('请选择用例类型');
      return false;
    }
    
    if (!formData.caseVersion) {
      showToast.error('请选择用例版本');
      return false;
    }
    
    if (!formData.caseId) {
      showToast.error('请填写用例ID');
      return false;
    }
    
    if (!formData.title) {
      showToast.error('请填写用例标题');
      return false;
    }
    
    // 验证测试步骤
    const hasValidSteps = testSteps.some(s => s.step.trim() !== '');
    if (!hasValidSteps) {
      showToast.error('请至少填写一个测试步骤');
      return false;
    }
    
    return true;
  };
  
  /**
   * 保存草稿
   */
  const handleSaveDraft = useCallback((silent = false) => {
    if (!id) return;
    
    try {
      const draftData: DraftData = {
        testCaseId: id,
        formData,
        testSteps,
        scenariosData,
        timestamp: Date.now()
      };
      
      localStorage.setItem(`${DRAFT_CACHE_KEY_EDIT}${id}`, JSON.stringify(draftData));
      if (!silent) {
        showToast.success('测试用例草稿已保存');
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      if (!silent) {
        showToast.error('保存草稿失败');
      }
    }
  }, [id, formData, testSteps, scenariosData]);
  
  /**
   * 自动保存草稿（每3分钟）
   */
  useEffect(() => {
    if (!id) return;
    
    // 检查是否有内容需要保存
    const hasContent = () => {
      return formData.title || 
             formData.caseId || 
             testSteps.some(s => s.step || s.expectedResult);
    };
    
    // 设置定时器，每3分钟自动保存
    const autoSaveInterval = setInterval(() => {
      if (hasContent() && !saving) {
        handleSaveDraft(true); // 静默保存，不显示提示
        console.log('自动保存草稿:', new Date().toLocaleTimeString());
      }
    }, 3 * 60 * 1000); // 3分钟
    
    // 清除定时器
    return () => clearInterval(autoSaveInterval);
  }, [id, formData, testSteps, saving, handleSaveDraft]);
  
  /**
   * 提交保存
   */
  const handleSubmit = async () => {
    if (saving) return;
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      // 构建测试步骤文本
      const stepsText = testSteps
        .filter(s => s.step.trim())
        .map((s, index) => `${index + 1}. ${s.step}`)
        .join('\n');
      
      const assertionsText = testSteps
        .filter(s => s.expectedResult.trim())
        .map((s, index) => `${index + 1}. ${s.expectedResult}`)
        .join('\n');
      
      // 映射用例类型到数据库枚举值（与创建页面保持一致）
      const caseTypeMap: { [key: string]: string } = {
        'smoke': 'SMOKE',
        'full': 'FULL',
        'abnormal': 'ABNORMAL',
        'boundary': 'BOUNDARY',
        'performance': 'PERFORMANCE',
        'security': 'SECURITY',
        'usability': 'USABILITY',
        'compatibility': 'COMPATIBILITY',
        'reliability': 'RELIABILITY'
      };
      const mappedCaseType = caseTypeMap[formData.caseType] || 'FULL';
      
      // 获取场景和测试点的显示名称（如果从下拉选择，需要获取label）
      // 如果是直接输入的文本，直接使用
      const scenarioLabel = formData.scenario;
      const testPointLabel = formData.testPoint;
      
      // 构建更新数据（与创建页面保持一致的数据结构）
      const updateData = {
        // 用例基本信息
        caseId: formData.caseId,  // 用例编号
        name: formData.title,
        description: formData.remarks,
        system: formData.project,
        module: formData.module,
        priority: formData.priority,
        
        // 用例类型（发送映射后的数据库枚举值）
        caseType: mappedCaseType,
        testType: mappedCaseType,
        
        // 场景和分类信息
        testScenario: scenarioLabel,
        scenarioName: scenarioLabel,
        scenarioDescription: `验证${scenarioLabel}功能`,
        tags: scenarioLabel,
        coverageAreas: scenarioLabel,
        
        // 测试步骤和预期结果
        steps: stepsText,
        assertions: assertionsText,
        expectedResult: assertionsText,
        
        // 测试相关信息
        preconditions: formData.preconditions,
        testData: formData.testData,
        
        // 测试点信息
        testPoints: [{
          testPoint: testPointLabel,
          testPointName: testPointLabel,
          testPurpose: `验证${testPointLabel}功能`,
          steps: stepsText,
          expectedResult: assertionsText,
          riskLevel: 'medium' as const,
          testScenario: scenarioLabel
        }]
      };
      
      // 调用更新API
      const result = await functionalTestCaseService.update(Number(id), updateData);
      
      if (result.success) {
        // 清除草稿
        if (id) {
          localStorage.removeItem(`${DRAFT_CACHE_KEY_EDIT}${id}`);
        }
        
        showToast.success('测试用例已保存！');
        setTimeout(() => {
          navigate('/functional-test-cases');
        }, 1000);
      } else {
        showToast.error('保存失败：' + result.error);
      }
    } catch (error) {
      console.error('保存测试用例失败:', error);
      showToast.error('保存失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  };
  
  /**
   * 取消编辑
   */
  const handleCancel = () => {
    // 检查是否有未保存的内容
    const hasContent = 
      formData.title || 
      formData.caseId || 
      testSteps.some(s => s.step || s.expectedResult);
    
    if (hasContent) {
      Modal.confirm({
        title: '保存草稿？',
        content: '当前有未保存的内容，是否保存为草稿？',
        okText: '保存并离开',
        cancelText: '直接离开',
        onOk: () => {
          handleSaveDraft();
          navigate('/functional-test-cases');
        },
        onCancel: () => {
          navigate('/functional-test-cases');
        }
      });
    } else {
      navigate('/functional-test-cases');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-0">
      <div className="max-w-[1100px] mx-auto">
        {/* 用例信息卡片 */}
        <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-6 flex items-start justify-between gap-5">
            <div className="flex-1">
              {/* <div className="font-mono text-[15px] opacity-95 mb-2.5 tracking-wide font-medium">{ `TC_${String(id).padStart(5, '0')}`}</div> */}
              <h1 className="text-2xl font-bold mb-3.5 leading-[1.4] tracking-tight">{formData.title || '编辑测试用例'}</h1>
              <div className="flex gap-5 text-[13px] opacity-90">
                <div className="flex items-center gap-1.5">
                  <span>👤</span>
                  <span>创建者：{formData.createdBy || '未知'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span>创建时间：{formData.createdAt ? new Date(formData.createdAt).toLocaleString('zh-CN') : '未知'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>最后更新：{formData.updatedAt ? new Date(formData.updatedAt).toLocaleString('zh-CN') : '未知'}</span>
                </div>
              </div>
              {(formData.project || formData.module || formData.scenario || formData.testPoint) && (
                <div className="mt-3.5 bg-white/15 rounded-md px-4 py-2.5 text-[13px] flex items-center gap-2">
                  {formData.project && `📁 ${formData.project}`}
                  {formData.module && ` → 📦 ${formData.module}`}
                  {formData.scenario && ` → 📋 ${formData.scenario}`}
                  {formData.testPoint && ` → 🎯 ${formData.testPoint}`}
                </div>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="bg-white/20 hover:bg-white/30 border border-white/30 hover:border-white/50 text-white px-5 py-2.5 rounded-md text-sm font-medium transition-all"
            >
              返回列表
            </button>
          </div>

          <div className="overflow-hidden">
          {/* 提示信息 */}
          <div className="px-6 py-5">
            <div className="bg-orange-50/50 border-l-[3px] border-orange-500 px-3.5 py-2.5 rounded-[5px] mb-4">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-1">
                  <p className="text-xs font-semibold text-orange-700 mb-1">💡 编辑提示</p>
                  <p className="text-[11px] text-orange-600 leading-relaxed">
                    请仔细填写测试用例信息，确保测试步骤清晰、预期结果明确。带 * 号的为必填项。
                  </p>
                </div>
              </div>
            </div>
            
            {/* 基本信息 */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">📋 基本信息</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3.5 mb-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    所属项目 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.project || undefined}
                    onChange={(value) => handleFieldChange('project', value)}
                    placeholder="请选择项目"
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择项目</Option>
                    {systemOptions.map(sys => (
                      <Option key={sys.id} value={sys.name}>{sys.name}</Option>
                    ))}
                  </Select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    所属模块 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.module || undefined}
                    onChange={(value) => handleFieldChange('module', value)}
                    placeholder={formData.project ? (loadingModules ? "加载中..." : "请选择模块") : "请先选择项目"}
                    disabled={!formData.project || loadingModules}
                    loading={loadingModules}
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择模块</Option>
                    {modulesData.map(m => (
                      <Option key={m.value} value={m.value}>{m.label}</Option>
                    ))}
                  </Select>
                  {formData.project && modulesData.length === 0 && !loadingModules && (
                    <div className="text-xs text-gray-500 mt-1">该项目暂无模块数据</div>
                  )}
                </div>
              </div>
                
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    测试场景 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.scenario || undefined}
                    onChange={(value) => handleFieldChange('scenario', value)}
                    placeholder={formData.project ? (loadingScenarios ? "加载中..." : "请选择测试场景") : "请先选择项目"}
                    disabled={!formData.project || loadingScenarios}
                    loading={loadingScenarios}
                    showSearch
                    allowClear
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择测试场景</Option>
                    {scenariosData.map(s => (
                      <Option key={s.value} value={s.value}>{s.label}</Option>
                    ))}
                  </Select>
                  {formData.project && scenariosData.length === 0 && !loadingScenarios && (
                    <div className="text-xs text-gray-500 mt-1">该项目暂无测试场景数据</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    测试点 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.testPoint || undefined}
                    onChange={(value) => handleFieldChange('testPoint', value)}
                    placeholder={formData.scenario ? "请选择测试点" : "请先选择测试场景"}
                    disabled={!formData.scenario}
                    showSearch
                    allowClear
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择测试点</Option>
                    {currentTestPoints.map(p => (
                      <Option key={p.value} value={p.value}>{p.label}</Option>
                    ))}
                  </Select>
                  {formData.scenario && currentTestPoints.length === 0 && (
                    <div className="text-xs text-gray-500 mt-1">该场景暂无测试点数据</div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 用例信息 */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">📝 用例信息</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3.5 mb-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    用例类型 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.caseType || undefined}
                    onChange={(value) => handleFieldChange('caseType', value)}
                    placeholder="请选择用例类型"
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择用例类型</Option>
                    <Option value="smoke">冒烟用例</Option>
                    <Option value="full">全量用例</Option>
                    <Option value="abnormal">异常用例</Option>
                    <Option value="boundary">边界用例</Option>
                    <Option value="performance">性能用例</Option>
                    <Option value="security">安全用例</Option>
                    <Option value="usability">可用性用例</Option>
                    <Option value="compatibility">兼容性用例</Option>
                    <Option value="reliability">可靠性用例</Option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    用例版本 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    suffixIcon={<ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-all" style={{ marginTop: '-0px' }} />}
                    value={formData.caseVersion || undefined}
                    onChange={(value) => handleFieldChange('caseVersion', value)}
                    placeholder={formData.project ? (loadingVersions ? "加载中..." : "请选择用例版本") : "请先选择项目"}
                    disabled={!formData.project || loadingVersions}
                    loading={loadingVersions}
                    showSearch
                    allowClear
                    className="w-full [&_.ant-select-selector]:!h-[32px] [&_.ant-select-selector]:!py-[7px] [&_.ant-select-selector]:!px-2.5 [&_.ant-select-selector]:!text-[13px] [&_.ant-select-selector]:!rounded-[5px] [&_.ant-select-selector]:!border-gray-300"
                  >
                    <Option value="">请选择用例版本</Option>
                    {projectVersions
                      .filter(v => v.status === 'active')
                      .map(version => (
                        <Option key={version.id} value={version.version_name}>
                          {version.version_name} {version.is_main ? '(主线)' : ''}
                        </Option>
                      ))}
                  </Select>
                  {formData.project && projectVersions.length === 0 && !loadingVersions && (
                    <div className="text-xs text-gray-500 mt-1">该项目暂无版本数据</div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3.5 mb-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    用例ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={`TC_${String(id).padStart(5, '0')}`}
                    onChange={(e) => handleFieldChange('caseId', e.target.value)}
                    placeholder="格式：TC_模块_序号，例如：TC_LOGIN_001"
                    className="!h-[32px] !py-[7px] !px-2.5 !text-[13px] !rounded-[5px]"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    用例优先级 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2.5">
                    <label className="flex-1">
                      <input
                        type="radio"
                        name="priority"
                        value="high"
                        checked={formData.priority === 'high'}
                        onChange={(e) => handleFieldChange('priority', e.target.value)}
                        className="hidden peer"
                      />
                      <div className="h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-[5px] cursor-pointer transition-all peer-checked:border-orange-500 peer-checked:bg-orange-50/50 peer-checked:text-orange-700 text-xs font-medium">
                        高
                      </div>
                    </label>
                    <label className="flex-1">
                      <input
                        type="radio"
                        name="priority"
                        value="medium"
                        checked={formData.priority === 'medium'}
                        onChange={(e) => handleFieldChange('priority', e.target.value)}
                        className="hidden peer"
                      />
                      <div className="h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-[5px] cursor-pointer transition-all peer-checked:border-orange-500 peer-checked:bg-orange-50/50 peer-checked:text-orange-700 text-xs font-medium">
                        中
                      </div>
                    </label>
                    <label className="flex-1">
                      <input
                        type="radio"
                        name="priority"
                        value="low"
                        checked={formData.priority === 'low'}
                        onChange={(e) => handleFieldChange('priority', e.target.value)}
                        className="hidden peer"
                      />
                      <div className="h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-[5px] cursor-pointer transition-all peer-checked:border-orange-500 peer-checked:bg-orange-50/50 peer-checked:text-orange-700 text-xs font-medium">
                        低
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  用例标题 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="请输入清晰简洁的测试用例标题"
                  className="!h-[32px] !py-[7px] !px-2.5 !text-[13px] !rounded-[5px]"
                />
              </div>
            </div>
            
            {/* 前置条件和测试数据 */}
            <div className="grid grid-cols-2 gap-3.5 mb-5">
              <div>
                <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-800 mb-1.5">🔧 前置条件</span>
                </div>
                <TextArea
                  value={formData.preconditions}
                  onChange={(e) => handleFieldChange('preconditions', e.target.value)}
                  placeholder="请描述执行此测试用例前需要满足的条件..."
                  rows={5}
                  className="!py-2 !px-2.5 !text-[13px] !leading-[1.5] !rounded-[5px]"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-3 pb-2 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-800">📊 测试数据</span>
                  <button
                    onClick={handleGenerateTestData}
                    disabled={generatingData}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[11px] font-semibold rounded-[4px] hover:shadow-[0_4px_12px_rgba(237,137,54,0.4)] hover:-translate-y-px transition-all disabled:opacity-50"
                  >
                    {generatingData ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        🤖 AI 自动生成
                      </>
                    )}
                  </button>
                </div>
                <TextArea
                  value={formData.testData}
                  onChange={(e) => handleFieldChange('testData', e.target.value)}
                  placeholder="请描述测试过程中使用的数据..."
                  rows={5}
                  className="!py-2 !px-2.5 !text-[13px] !leading-[1.5] !rounded-[5px]"
                />
              </div>
            </div>
            
            {/* 测试步骤 */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">📝 测试步骤</span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="space-y-2">
                  {testSteps.map((step, index) => (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, step.id)}
                      onDragOver={(e) => handleDragOver(e, step.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border border-gray-200 rounded-[5px] p-2 transition-all hover:border-gray-300 hover:shadow-sm ${
                        draggedStepId === step.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex items-center justify-center w-[18px] h-[18px] text-sm flex-shrink-0"
                          title="拖动排序"
                        >
                          ⋮⋮
                        </div>
                        
                        <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5 tracking-wide">
                              操作步骤
                            </div>
                            <TextArea
                              value={step.step}
                              onChange={(e) => handleUpdateStep(step.id, 'step', e.target.value)}
                              placeholder="请输入操作步骤..."
                              rows={2}
                              className="!text-xs !py-1.5 !px-2 !rounded-[4px] !min-h-[40px] !max-h-[200px]"
                            />
                          </div>
                          
                          <div>
                            <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5 tracking-wide">
                              预期结果
                            </div>
                            <TextArea
                              value={step.expectedResult}
                              onChange={(e) => handleUpdateStep(step.id, 'expectedResult', e.target.value)}
                              placeholder="请输入预期结果..."
                              rows={2}
                              className="!text-xs !py-1.5 !px-2 !rounded-[4px] !min-h-[40px] !max-h-[200px]"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => handleInsertBefore(step.id)}
                            className="w-[22px] h-[22px] flex items-center justify-center border border-gray-300 bg-white rounded-[3px] hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-px transition-all text-[11px] text-gray-600"
                            title="在上方插入"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleInsertAfter(step.id)}
                            className="w-[22px] h-[22px] flex items-center justify-center border border-gray-300 bg-white rounded-[3px] hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-px transition-all text-[11px] text-gray-600"
                            title="在下方插入"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleCopyStep(step.id)}
                            className="w-[22px] h-[22px] flex items-center justify-center border border-gray-300 bg-white rounded-[3px] hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-px transition-all text-[11px] text-gray-600"
                            title="复制"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
                            className="w-[22px] h-[22px] flex items-center justify-center border border-gray-300 bg-white rounded-[3px] hover:bg-red-50 hover:border-red-400 hover:-translate-y-px transition-all text-[11px] text-red-600"
                            title="删除"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleAddStep}
                    className="w-full py-2 border border-dashed border-gray-300 bg-white rounded-[5px] text-gray-600 text-xs font-medium hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50/30 transition-all"
                  >
                    ➕ 添加步骤
                  </button>
                </div>
              </div>
            </div>
            
            {/* 备注说明 */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">💡 备注说明</span>
              </div>
              <TextArea
                value={formData.remarks}
                onChange={(e) => handleFieldChange('remarks', e.target.value)}
                placeholder="补充说明或注意事项..."
                rows={4}
                className="!py-2 !px-2.5 !text-[13px] !leading-[1.5] !rounded-[5px]"
              />
            </div>
          </div>
          
          {/* 底部操作栏 */}
          <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-[5px] text-xs font-semibold hover:border-orange-500 hover:text-orange-500 transition-all"
            >
              取消
            </button>
            <button
              onClick={() => handleSaveDraft()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-[5px] text-xs font-semibold hover:border-orange-500 hover:text-orange-500 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              保存草稿
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-[5px] text-xs font-semibold hover:shadow-[0_6px_20px_rgba(237,137,54,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  保存用例
                </>
              )}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

