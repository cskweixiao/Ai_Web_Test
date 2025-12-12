import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Loader2 } from 'lucide-react';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import { showToast } from '../utils/toast';
import { Modal } from 'antd';
import './FunctionalTestCaseExecute.css';

// 草稿缓存的 LocalStorage Key（执行页面专用）
const DRAFT_CACHE_KEY_EXECUTE = 'test_case_execute_draft_';

/**
 * 测试步骤执行结果
 */
interface StepExecutionResult {
  stepIndex: number;
  status: 'pass' | 'fail' | 'block' | null;
  note: string;
}

/**
 * 草稿数据接口
 */
interface DraftData {
  testCaseId: string;  // 记录是哪个测试用例的草稿
  finalResult: 'pass' | 'fail' | 'block' | '';
  actualResult: string;
  comments: string;
  stepResults: StepExecutionResult[];
  screenshotsCount: number; // 只记录数量，不保存实际图片数据
  timestamp: number;
}

/**
 * 功能测试用例执行页面 - 备选样式（与 Create/Edit/Detail 一致）
 */
export function FunctionalTestCaseExecuteAlt() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testCase, setTestCase] = useState<any>(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 执行结果数据
  const [finalResult, setFinalResult] = useState<'pass' | 'fail' | 'block' | ''>('');
  const [actualResult, setActualResult] = useState('');
  const [comments, setComments] = useState('');
  const [stepResults, setStepResults] = useState<StepExecutionResult[]>([]);
  const [screenshots, setScreenshots] = useState<Array<{ file: File; preview: string; name: string }>>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  
  // 草稿加载状态
  const [draftLoaded, setDraftLoaded] = useState(false);
  
  // 计时器
  useEffect(() => {
    const timer = setInterval(() => {
      setExecutionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isInFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  // 加载测试用例数据
  useEffect(() => {
    const loadTestCase = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const result = await functionalTestCaseService.getById(Number(id)) as { success: boolean; data?: any; error?: string };
        
        if (result.success && result.data) {
          setTestCase(result.data);
          
          // 解析测试步骤并初始化执行结果
          const stepsArray = result.data.steps?.split('\n').filter((s: string) => s.trim()) || [];
          const initialResults = stepsArray.map((_step: string, index: number) => ({
            stepIndex: index,
            status: null,
            note: ''
          }));
          setStepResults(initialResults);
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
      if (!id || draftLoaded || loading || !testCase) return;
      
      try {
        const draftKey = `${DRAFT_CACHE_KEY_EXECUTE}${id}`;
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
          timeText = `${daysDiff}天前`;
        } else {
          const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
          if (hoursDiff > 0) {
            timeText = `${hoursDiff}小时前`;
          } else {
            const minutesDiff = Math.floor(timeDiff / (1000 * 60));
            timeText = `${minutesDiff}分钟前`;
          }
        }
        
        // 计算草稿的执行进度
        const draftCompletedSteps = draft.stepResults.filter(r => r.status !== null).length;
        const draftTotalSteps = draft.stepResults.length;
        const draftProgress = draftTotalSteps > 0 ? Math.round((draftCompletedSteps / draftTotalSteps) * 100) : 0;
        
        const finalResultMap: { [key: string]: string } = {
          'pass': '✅ 通过',
          'fail': '❌ 失败',
          'block': '🚫 阻塞',
          '': '未选择'
        };
        
        Modal.confirm({
          title: '发现未完成的执行草稿',
          width: 600,
          content: (
            <div>
              <p>发现未完成的执行草稿（保存于 {timeText}）</p>
              <p>测试用例：{testCase?.name || '未知'}</p>
              <p>执行进度：{draftCompletedSteps}/{draftTotalSteps} 步骤 ({draftProgress}%)</p>
              <p>最终结果：{finalResultMap[draft.finalResult]}</p>
              {draft.screenshotsCount > 0 && <p>已上传截图：{draft.screenshotsCount} 张（草稿不保存图片）</p>}
              <br />
              <p>是否继续执行？</p>
            </div>
          ),
          okText: '恢复草稿',
          cancelText: '重新开始',
          onOk: () => {
            // 恢复草稿数据
            setFinalResult(draft.finalResult);
            setActualResult(draft.actualResult);
            setComments(draft.comments);
            setStepResults(draft.stepResults);
            showToast.success('已恢复上次执行的内容');
          },
          onCancel: () => {
            // 不恢复，清除草稿
            localStorage.removeItem(draftKey);
          }
        });
      } catch (error) {
        console.error('加载草稿失败:', error);
        if (id) {
          localStorage.removeItem(`${DRAFT_CACHE_KEY_EXECUTE}${id}`);
        }
      } finally {
        setDraftLoaded(true);
      }
    };
    
    // 等待数据加载完成后再检查草稿
    if (!loading && testCase) {
      checkDraft();
    }
  }, [id, loading, draftLoaded, testCase]);
  
  // 更新步骤执行结果
  const handleUpdateStepResult = (stepIndex: number, status: 'pass' | 'fail' | 'block') => {
    setStepResults(prev => prev.map(r => 
      r.stepIndex === stepIndex ? { ...r, status } : r
    ));
    
    // 自动定位到下一步（如果当前步骤通过）
    if (stepIndex < steps.length - 1 && status === 'pass') {
      setTimeout(() => {
        // 滚动到下一步
        const nextStepElement = document.querySelector(`[data-step-index="${stepIndex + 1}"]`);
        if (nextStepElement) {
          nextStepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
    
    // 自动判断最终结果
    setTimeout(() => {
      const updatedResults = stepResults.map(r => 
        r.stepIndex === stepIndex ? { ...r, status } : r
      );
      const allCompleted = updatedResults.every(r => r.status !== null);
      
      if (allCompleted) {
        const hasFail = updatedResults.some(r => r.status === 'fail');
        const hasBlock = updatedResults.some(r => r.status === 'block');
        const allPass = updatedResults.every(r => r.status === 'pass');
        
        if (allPass) {
          setFinalResult('pass');
          showToast.success('所有步骤已完成，建议最终结果：✅ 通过');
        } else if (hasFail) {
          setFinalResult('fail');
          showToast.error('所有步骤已完成，建议最终结果：❌ 失败');
        } else if (hasBlock) {
          setFinalResult('block');
          showToast.warning('所有步骤已完成，建议最终结果：🚫 阻塞');
        }
      }
    }, 100);
  };
  
  // 更新步骤备注
  const handleUpdateStepNote = (stepIndex: number, note: string) => {
    setStepResults(prev => prev.map(r => 
      r.stepIndex === stepIndex ? { ...r, note } : r
    ));
  };
  
  // 处理图片上传
  const handleImageUpload = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        showToast.error(`${file.name} 不是有效的图片文件`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast.error(`${file.name} 大小超过 10MB`);
        return false;
      }
      return true;
    });

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setScreenshots(prev => [...prev, {
            file,
            preview: e.target!.result as string,
            name: file.name
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageUpload(e.target.files);
      e.target.value = ''; // 重置 input，允许选择相同文件
    }
  };

  // 处理粘贴事件
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload([file]);
            showToast.success('图片已从剪贴板添加');
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
      showToast.success('图片已添加');
    }
  };

  // 打开图片预览
  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewImage(screenshots[index].preview);
  };

  // 关闭预览
  const closePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  // 上一张图片
  const showPrevImage = useCallback(() => {
    const newIndex = previewIndex > 0 ? previewIndex - 1 : screenshots.length - 1;
    setPreviewIndex(newIndex);
    setPreviewImage(screenshots[newIndex].preview);
  }, [previewIndex, screenshots]);

  // 下一张图片
  const showNextImage = useCallback(() => {
    const newIndex = previewIndex < screenshots.length - 1 ? previewIndex + 1 : 0;
    setPreviewIndex(newIndex);
    setPreviewImage(screenshots[newIndex].preview);
  }, [previewIndex, screenshots]);

  // 键盘事件处理
  useEffect(() => {
    if (!previewImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        showPrevImage();
      } else if (e.key === 'ArrowRight') {
        showNextImage();
      } else if (e.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, showPrevImage, showNextImage, closePreview]);
  
  /**
   * 保存草稿
   */
  const handleSaveDraft = useCallback((silent = false) => {
    if (!id) return;
    
    try {
      const draftData: DraftData = {
        testCaseId: id,
        finalResult,
        actualResult,
        comments,
        stepResults,
        screenshotsCount: screenshots.length, // 只保存数量，不保存实际图片
        timestamp: Date.now()
      };
      
      localStorage.setItem(`${DRAFT_CACHE_KEY_EXECUTE}${id}`, JSON.stringify(draftData));
      if (!silent) {
        showToast.success('执行记录草稿已保存');
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      if (!silent) {
        showToast.error('保存草稿失败');
      }
    }
  }, [id, finalResult, actualResult, comments, stepResults, screenshots.length]);
  
  /**
   * 自动保存草稿（每3分钟）
   */
  useEffect(() => {
    if (!id) return;
    
    // 检查是否有内容需要保存
    const hasContent = () => {
      return finalResult || 
             actualResult || 
             comments || 
             stepResults.some(r => r.status !== null || r.note) ||
             screenshots.length > 0;
    };
    
    // 设置定时器，每3分钟自动保存
    const autoSaveInterval = setInterval(() => {
      if (hasContent() && !saving) {
        handleSaveDraft(true); // 静默保存，不显示提示
        console.log('自动保存执行草稿:', new Date().toLocaleTimeString());
      }
    }, 3 * 60 * 1000); // 3分钟
    
    // 清除定时器
    return () => clearInterval(autoSaveInterval);
  }, [id, finalResult, actualResult, comments, stepResults, screenshots.length, saving, handleSaveDraft]);
  
  // 提交执行结果
  const handleSubmit = async () => {
    if (saving) return;
    
    if (!finalResult) {
      showToast.error('请选择最终测试结果');
      return;
    }
    
    if (!actualResult.trim()) {
      showToast.error('请填写实际结果总结');
      return;
    }
    
    // 检查是否所有步骤都已记录结果
    if (completedSteps < steps.length) {
      if (!confirm(`还有 ${steps.length - completedSteps} 个步骤未记录结果，确定要提交吗？`)) {
        return;
      }
    }
    
    try {
      setSaving(true);
      
      // 计算步骤统计
      const passedCount = stepResults.filter(r => r.status === 'pass').length;
      const failedCount = stepResults.filter(r => r.status === 'fail').length;
      const blockedCount = stepResults.filter(r => r.status === 'block').length;
      
      // 准备截图数据
      const screenshotData = screenshots.map(screenshot => ({
        fileName: screenshot.name,
        fileSize: screenshot.file.size,
        mimeType: screenshot.file.type,
        base64Data: screenshot.preview.split(',')[1], // 移除 data URL 前缀
        uploadedAt: new Date().toISOString()
      }));

      // 保存执行结果到数据库
      const result = await functionalTestCaseService.saveExecutionResult(Number(id), {
        testCaseName: testCase?.name || '未知测试用例',
        finalResult: finalResult as 'pass' | 'fail' | 'block',
        actualResult,
        comments: comments || undefined,
        durationMs: executionTime * 1000, // 转换为毫秒
        stepResults: steps.map((step: any, index: number) => ({
          stepIndex: index + 1,
          action: step.step,
          expected: step.expectedResult,
          result: stepResults[index]?.status,
          note: stepResults[index]?.note || ''
        })),
        totalSteps: steps.length,
        completedSteps,
        passedSteps: passedCount,
        failedSteps: failedCount,
        blockedSteps: blockedCount,
        screenshots: screenshotData.length > 0 ? screenshotData : undefined,
        metadata: {
          system: testCase?.system,
          module: testCase?.module,
          scenario_name: testCase?.testScenario || testCase?.scenarioName || testCase?.scenario_name,
          test_point_name: testCase?.testPoints?.[0]?.testPointName || testCase?.testPoints?.[0]?.testPoint || testCase?.test_point_name,
          priority: testCase?.priority,
          case_type: testCase?.testType || testCase?.caseType || testCase?.case_type,
          submitted_at: new Date().toISOString()
        }
      }) as { success: boolean; data?: { executionId: string }; error?: string };
      
      if (result.success) {
        // 清除草稿
        if (id) {
          localStorage.removeItem(`${DRAFT_CACHE_KEY_EXECUTE}${id}`);
        }
        
        const resultText = finalResult === 'pass' ? '✅ 通过' : finalResult === 'fail' ? '❌ 失败' : '🚫 阻塞';
        showToast.success(`执行结果已提交！最终结果：${resultText}，执行时长：${formatTime(executionTime)}`);
        setTimeout(() => {
          navigate('/functional-test-cases');
        }, 1000);
      } else {
        throw new Error(result.error || '提交失败');
      }
    } catch (error) {
      console.error('提交执行结果失败:', error);
      showToast.error('提交失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  };
  
  /**
   * 取消执行
   */
  const handleCancel = () => {
    // 检查是否有未保存的内容
    const hasContent = 
      finalResult || 
      actualResult || 
      comments || 
      stepResults.some(r => r.status !== null || r.note) ||
      screenshots.length > 0;
    
    if (hasContent) {
      Modal.confirm({
        title: '保存草稿？',
        content: '当前有未保存的执行记录，是否保存为草稿？',
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
  
  if (!testCase) {
    return null;
  }
  
  // 解析测试步骤 - 兼容多种字段名
  const stepsArray = testCase.steps?.split('\n').filter((s: string) => s.trim()) || [];
  const assertionsArray = (testCase.assertions || testCase.expected_result)?.split('\n').filter((s: string) => s.trim()) || [];
  const steps = stepsArray.map((step: string, index: number) => ({
    step: step.replace(/^\d+\.\s*/, ''),
    expectedResult: assertionsArray[index]?.replace(/^\d+\.\s*/, '') || ''
  }));
  
  const priorityBadge = testCase.priority === 'high' ? 'bg-red-100 text-red-700' :
                       testCase.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                       'bg-green-100 text-green-700';
  
  const priorityText = testCase.priority === 'high' ? '高' :
                      testCase.priority === 'medium' ? '中' : '低';
  
  // 计算执行进度
  const completedSteps = stepResults.filter(r => r.status !== null).length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
  
  return (
    <div className="min-h-screen bg-gray-50 p-0">
      {/* 图片预览模态框 */}
      {previewImage && screenshots.length > 0 && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img 
              src={previewImage} 
              alt={screenshots[previewIndex]?.name || "预览"} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={closePreview}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all border border-white/30"
              title="关闭 (ESC)"
            >
              ✕
            </button>
            
            {/* 底部信息栏 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
              <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
                {screenshots[previewIndex]?.name}
              </div>
              {screenshots.length > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      showPrevImage();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all border border-white/30 text-sm"
                    title="上一张 (←)"
                  >
                    ←
                  </button>
                  
                  <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md min-w-[50px] text-center">
                    {previewIndex + 1} / {screenshots.length}
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      showNextImage();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all border border-white/30 text-sm"
                    title="下一张 (→)"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 悬浮状态窗口 */}
      <div className="fixed top-4 right-3 z-[1000] bg-white/95 backdrop-blur-xl px-3.5 py-2 rounded-lg shadow-lg border border-gray-200 flex items-center gap-3 transition-all hover:shadow-xl hover:-translate-y-0.5" style={{ marginTop: `${Math.max(isFullscreen ? 1 : 5.3, (isFullscreen ? 0 : 9) - scrollY / 16)}rem`, marginLeft: '0.5rem' }}>
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">执行时长</div>
          <div className="text-[15px] font-bold font-mono text-gray-900 leading-none">{formatTime(executionTime)}</div>
        </div>
        <div className="w-px h-5 bg-gray-300"></div>
        <div className="w-[120px] flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] font-semibold text-gray-600">
            <span>测试进度</span>
            <span>{completedSteps}/{steps.length}</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-sm overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-sm transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto">
        {/* 用例信息卡片 */}
        <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-6 flex items-start justify-between gap-5">
            <div className="flex-1">
              {/* <div className="font-mono text-[15px] opacity-95 mb-2.5 tracking-wide font-medium">{ `TC_${String(testCase.id).padStart(5, '0')}`}</div> */}
              <h1 className="text-2xl font-bold mb-3.5 leading-[1.4] tracking-tight">{testCase.name || '执行测试用例'}</h1>
              <div className="flex gap-5 text-[13px] opacity-90">
                <div className="flex items-center gap-1.5">
                  <span>👤</span>
                  <span>创建者：{testCase.users?.username || '未知'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span>创建时间：{testCase.created_at ? new Date(testCase.created_at).toLocaleString('zh-CN') : '未知'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>最后更新：{testCase.updatedAt || testCase.updated_at ? new Date(testCase.updatedAt || testCase.updated_at).toLocaleString('zh-CN') : '未知'}</span>
                </div>
              </div>
              {(testCase.testScenario || testCase.scenarioName || testCase.scenario_name) && (testCase.testPoints?.[0]?.testPointName || testCase.testPoints?.[0]?.testPoint || testCase.test_point_name) && (
                <div className="mt-3.5 bg-white/15 rounded-md px-4 py-2.5 text-[13px] flex items-center gap-2">
                  📁 {testCase.system} → 📦 {testCase.module} → 📋 {testCase.testScenario || testCase.scenarioName || testCase.scenario_name} → 🎯 {testCase.testPoints?.[0]?.testPointName || testCase.testPoints?.[0]?.testPoint || testCase.test_point_name}
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
            
            
            {/* 基本信息 */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-semibold text-gray-700">
                <span>📋</span>
                <span>基本信息</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">所属项目</div>
                  <div className="text-xs font-semibold text-gray-900">{testCase.system || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">所属模块</div>
                  <div className="text-xs font-semibold text-gray-900">{testCase.module || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">测试场景</div>
                  <div className="text-xs font-semibold text-gray-900">{testCase.testScenario || testCase.scenarioName || testCase.scenario_name || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">测试点</div>
                  <div className="text-xs font-semibold text-gray-900">{testCase.testPoints?.[0]?.testPointName || testCase.testPoints?.[0]?.testPoint || testCase.test_point_name || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">用例类型</div>
                  <div className="text-xs font-semibold text-gray-900">
                    {testCase.testType || testCase.caseType || testCase.case_type 
                      ? (() => {
                          const type = testCase.testType || testCase.caseType || testCase.case_type;
                          const typeMap: { [key: string]: string } = {
                            'SMOKE': '冒烟用例',
                            'FULL': '全量用例',
                            'ABNORMAL': '异常用例',
                            'BOUNDARY': '边界用例',
                            'PERFORMANCE': '性能用例',
                            'SECURITY': '安全用例',
                            'USABILITY': '可用性用例',
                            'COMPATIBILITY': '兼容性用例',
                            'RELIABILITY': '可靠性用例'
                          };
                          return typeMap[type] || type;
                        })()
                      : '-'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">用例版本</div>
                  <div className="text-xs font-semibold text-gray-900">
                    {testCase.project_version?.version_code || testCase.project_version?.version_name || 'V1.0'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">用例ID</div>
                  <div className="text-xs font-semibold text-gray-900">{ `TC_${String(testCase.id).padStart(5, '0')}`}</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">用例优先级</div>
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${priorityBadge}`}>
                      {priorityText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 前置条件和测试数据 */}
            <div className="grid grid-cols-2 gap-3.5 mb-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-semibold text-gray-700">
                  <span>🔧</span>
                  <span>前置条件</span>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3 text-xs text-gray-700 leading-[1.6] min-h-[80px] whitespace-pre-wrap">
                  {testCase.preconditions || '无特殊前置条件'}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-semibold text-gray-700">
                  <span>📊</span>
                  <span>测试数据</span>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3 text-xs text-gray-700 leading-[1.6] min-h-[80px] whitespace-pre-wrap">
                  {testCase.testData || testCase.test_data || '参考测试步骤'}
                </div>
              </div>
            </div>
            
            {/* 测试步骤执行 */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-semibold text-gray-700">
                <span>📝</span>
                <span>测试步骤</span>
              </div>
              <div className="bg-green-50/50 border-l-[3px] border-green-500 px-3.5 py-2.5 rounded-[5px] mb-3.5">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-1">
                  <p className="text-xs font-semibold text-green-700 mb-1">💡 执行提示</p>
                  <p className="text-[11px] text-green-600 leading-relaxed">
                    请按照测试步骤逐步执行，记录每个步骤的执行结果和实际情况。执行完成后填写实际结果总结并提交。
                  </p>
                </div>
              </div>
            </div>
              <div className="steps-wrapper">
                <div className="steps-header">
                  <div>#</div>
                  <div>操作步骤</div>
                  <div>预期结果</div>
                  <div>执行状态</div>
                </div>
                <ul className="steps-list">
                  {steps.map((step: any, index: number) => {
                    const stepResult = stepResults[index];
                    const itemClass = 
                      stepResult?.status === 'pass' ? 'step-item passed' :
                      stepResult?.status === 'fail' ? 'step-item failed' :
                      stepResult?.status === 'block' ? 'step-item blocked' :
                      stepResult?.status === null && index === completedSteps ? 'step-item executing' :
                      'step-item';
                    const hasNote = stepResult?.note && stepResult.note.trim().length > 0;
                    
                    return (
                      <li 
                        key={index} 
                        className={`${itemClass} ${hasNote ? 'has-note' : ''}`}
                        data-step-index={index}
                      >
                        <div className="step-row">
                          <div className="step-col-no">{index + 1}</div>
                          <div className="step-col-text">{step.step}</div>
                          <div className="step-col-text">{step.expectedResult}</div>
                          <div className="step-col-actions">
                            <div className="status-btn-group">
                              <button
                                className={`status-btn pass ${stepResult?.status === 'pass' ? 'active' : ''}`}
                                onClick={() => handleUpdateStepResult(index, 'pass')}
                                title="通过"
                              >
                                ✓
                              </button>
                              <button
                                className={`status-btn fail ${stepResult?.status === 'fail' ? 'active' : ''}`}
                                onClick={() => handleUpdateStepResult(index, 'fail')}
                                title="失败"
                              >
                                ✗
                              </button>
                              <button
                                className={`status-btn block ${stepResult?.status === 'block' ? 'active' : ''}`}
                                onClick={() => handleUpdateStepResult(index, 'block')}
                                title="阻塞"
                              >
                                ⊗
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="step-note-area">
                          <textarea
                            className="step-note-input"
                            placeholder="备注说明（可选，失败或阻塞时建议填写）..."
                            value={stepResult?.note || ''}
                            onChange={(e) => handleUpdateStepNote(index, e.target.value)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            
            {/* 记录测试结果 */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2.5 text-[13px] font-semibold text-gray-700">
                <span>📝</span>
                <span>记录测试结果</span>
              </div>
              
              <div className="result-container">
                <div className="result-header">
                  <label className="form-label required result-header-label">
                    最终测试结果
                  </label>
                  <div className="result-options">
                    <div className="result-option-item">
                      <input
                        type="radio"
                        name="result"
                        id="pass"
                        value="pass"
                        className="result-option-input"
                        checked={finalResult === 'pass'}
                        onChange={() => setFinalResult('pass')}
                      />
                      <label htmlFor="pass" className="result-option-card pass">
                        <span className="result-icon">✅</span> 通过
                      </label>
                    </div>
                    <div className="result-option-item">
                      <input
                        type="radio"
                        name="result"
                        id="fail"
                        value="fail"
                        className="result-option-input"
                        checked={finalResult === 'fail'}
                        onChange={() => setFinalResult('fail')}
                      />
                      <label htmlFor="fail" className="result-option-card fail">
                        <span className="result-icon">❌</span> 失败
                      </label>
                    </div>
                    <div className="result-option-item">
                      <input
                        type="radio"
                        name="result"
                        id="block"
                        value="block"
                        className="result-option-input"
                        checked={finalResult === 'block'}
                        onChange={() => setFinalResult('block')}
                      />
                      <label htmlFor="block" className="result-option-card block" style={{ display: finalResult === 'block' ? 'flex' : 'flex' }}>
                        <span className="result-icon">🚫</span> 阻塞
                      </label>
                    </div>
                  </div>
                </div>

                <div className="result-grid">
                  <div className="result-main">
                    <div className="form-group">
                      <label className="form-label required">实际结果总结</label>
                      <textarea
                        className="modern-textarea actual-result-textarea"
                        placeholder="请详细描述测试执行后的实际情况..."
                        value={actualResult}
                        onChange={(e) => setActualResult(e.target.value)}
                      />
                    </div>
                    <div className="form-group form-group-last">
                      <label className="form-label">备注说明</label>
                      <textarea
                        className="modern-textarea comments-textarea"
                        placeholder="如有需要，请补充说明..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="result-side">
                    <div className="form-group upload-form-group">
                      <label className="form-label">证据截图</label>
                      <label 
                        htmlFor="fileInput" 
                        className="upload-area-compact"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          className="file-input-hidden" 
                          id="fileInput"
                          onChange={handleFileSelect}
                        />
                        <div className="upload-icon-large">📸</div>
                        <div className="upload-hint">点击上传图片</div>
                        <span className="upload-sub-hint">支持粘贴 / 拖拽</span>
                      </label>
                      
                      {screenshots.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[11px] text-gray-600 font-medium mb-2">
                            已上传 {screenshots.length} 张
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {screenshots.map((screenshot, index) => (
                              <div 
                                key={index} 
                                className="relative group"
                                style={{ width: 'calc(50% - 3px)' }}
                              >
                                <div 
                                  className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer w-full"
                                  onClick={() => openPreview(index)}
                                  title={`${screenshot.name} - 点击预览`}
                                >
                                  <span className="text-sm flex-shrink-0">📷</span>
                                  <span className="text-[11px] text-gray-700 font-medium group-hover:text-blue-600 truncate flex-1">
                                    {screenshot.name.split('.')[0]}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveImage(index);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all text-[9px] opacity-0 group-hover:opacity-100 shadow-md leading-none"
                                  title="删除"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 底部操作栏 */}
          <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-[5px] text-xs font-semibold hover:border-green-500 hover:text-green-500 transition-all"
            >
              取消
            </button>
            <button
              onClick={() => handleSaveDraft()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-[5px] text-xs font-semibold hover:border-green-500 hover:text-green-500 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              保存草稿
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-[5px] text-xs font-semibold hover:shadow-[0_6px_20px_rgba(72,187,120,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  提交结果
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

