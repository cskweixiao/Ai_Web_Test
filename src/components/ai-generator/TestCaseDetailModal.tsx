import { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, FileText, Target, CheckCircle2, AlertCircle, Edit2, Save, X } from 'lucide-react';
import { Input } from 'antd';

const { TextArea } = Input;

// 定义测试用例类型
interface TestCase {
  id?: string | number;
  name?: string;
  priority?: 'high' | 'medium' | 'low';
  testScenario?: string;
  sectionId?: string;
  sectionName?: string;
  system?: string;
  module?: string;
  coverageAreas?: string;
  preconditions?: string;
  testData?: string;
  steps?: string;
  assertions?: string;
  testPoints?: Array<{
    testPoint?: string;          // 统一字段名称
    testPointName?: string;      // 兼容旧字段
    steps?: string;
    expectedResult?: string;
    riskLevel?: 'high' | 'medium' | 'low';
    description?: string;
    testPurpose?: string;        // 测试目的
    testScenario?: string;       // 测试场景
    coverageAreas?: string;       // 覆盖范围
  }>;
  [key: string]: unknown;
}

interface TestCaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase | null;
  onSave?: (updatedTestCase: TestCase) => void;
  allCases?: TestCase[]; // 全部用例列表
  currentIndex?: number; // 当前用例索引
  onSwitchCase?: (direction: 'prev' | 'next') => void; // 切换用例
}

export function TestCaseDetailModal({
  isOpen,
  onClose,
  testCase,
  onSave,
  allCases = [],
  currentIndex = 0,
  onSwitchCase
}: TestCaseDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<TestCase | null>(null);

  // 当testCase变化时，重置编辑状态
  useEffect(() => {
    if (testCase) {
      setEditedCase({ ...testCase });
      setIsEditing(false);
    }
  }, [testCase]);

  if (!testCase) return null;

  const hasMultipleCases = allCases && allCases.length > 1;
  const currentCase = isEditing ? editedCase : testCase;
  
  if (!currentCase) return null;
  
  // 判断是否显示测试用例的步骤（如果测试用例有独立的步骤，优先显示；否则显示测试点的步骤）
  const hasTestCaseSteps = currentCase.steps && typeof currentCase.steps === 'string' && currentCase.steps.trim().length > 0;
  const hasTestCaseAssertions = currentCase.assertions && typeof currentCase.assertions === 'string' && currentCase.assertions.trim().length > 0;
  
  // 如果测试用例没有步骤，则从测试点获取
  const displaySteps = hasTestCaseSteps ? (currentCase.steps as string) : (currentCase.testPoints?.[0]?.steps || '');
  const displayAssertions = hasTestCaseAssertions ? (currentCase.assertions as string) : (currentCase.testPoints?.[0]?.expectedResult || '');

  // 处理测试步骤中的测试数据填充
  const renderStepsWithTestData = (steps: string, testData?: string) => {
    if (!steps) return '';
    if (!testData) return steps;
    
    // 简单的占位符替换：将 {testData} 或类似的占位符替换为实际测试数据
    let result = steps;
    // 替换常见的占位符格式
    result = result.replace(/\{testData\}/g, testData);
    result = result.replace(/\{测试数据\}/g, testData);
    result = result.replace(/\$\{testData\}/g, testData);
    
    return result;
  };

  const filledSteps = renderStepsWithTestData(displaySteps || '', currentCase.testData);

  const handleSave = () => {
    if (onSave && editedCase) {
      onSave(editedCase);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedCase({ ...testCase });
    setIsEditing(false);
  };

  const updateField = (field: string, value: string | number | undefined) => {
    setEditedCase((prev: TestCase | null) => {
      if (!prev) {
        // 如果 prev 为 null，从 testCase 初始化
        if (testCase) {
          return {
            ...testCase,
            [field]: value
          };
        }
        return null;
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={true}
      title={
        <div className="flex items-center gap-3 w-full">
          <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
          <span className="font-semibold">测试用例详情</span>
          {hasMultipleCases && (
            <>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                {currentIndex + 1} / {allCases.length}
              </span>
              <div className="flex items-center gap-0.5 ml-2">
                <button
                  onClick={() => onSwitchCase?.('prev')}
                  className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-md transition-colors"
                  title="上一个"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSwitchCase?.('next')}
                  className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-md transition-colors"
                  title="下一个"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      }
      size="wide"
      closeOnClickOutside={false}
      footer={
        <div className="flex items-center justify-between w-full">
          {hasMultipleCases && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="default"
                onClick={() => onSwitchCase?.('prev')}
                className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all"
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                上一个
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => onSwitchCase?.('next')}
                className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all"
                icon={<ChevronRight className="w-4 h-4" />}
                iconPosition="right"
              >
                下一个
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  size="default"
                  className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all"
                  icon={<X className="w-4 h-4" />}
                >
                  取消
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleSave}
                  size="default"
                  className="h-9 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white border-0 shadow-sm hover:shadow-md active:shadow transition-all"
                  icon={<Save className="w-4 h-4 mr-1.5" />}
                >
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (testCase) {
                      setEditedCase({ ...testCase });
                      setIsEditing(true);
                    }
                  }}
                  size="default"
                  className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all"
                  icon={<Edit2 className="w-4 h-4 mr-1.5" />}
                >
                  编辑
                </Button>
                <Button 
                  variant="default" 
                  onClick={onClose}
                  size="default"
                  className="h-9 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white border-0 shadow-sm hover:shadow-md active:shadow transition-all"
                  icon={<X className="w-4 h-4" />}
                >
                  关闭
                </Button>
              </>
            )}
          </div>
        </div>
      }
      contentPadding="md"
    >
      <div className="space-y-5 pb-6">
        {/* 顶部：用例名称和关键信息 */}
        <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 rounded-xl p-6 border-2 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedCase?.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="text-xl font-bold mb-3"
                  placeholder="测试用例名称"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 mb-3">{currentCase.name}</h2>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {isEditing ? (
                  <select
                    value={editedCase?.priority || testCase?.priority || 'medium'}
                    onChange={(e) => {
                      const value = e.target.value as 'high' | 'medium' | 'low';
                      updateField('priority', value);
                    }}
                    className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                    title="选择优先级"
                    aria-label="选择优先级"
                  >
                    <option value="high">高优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="low">低优先级</option>
                  </select>
                ) : (
                  currentCase.priority && (
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-xs font-semibold",
                      currentCase.priority === 'high' && "bg-red-100 text-red-700 border border-red-300",
                      currentCase.priority === 'medium' && "bg-yellow-100 text-yellow-700 border border-yellow-300",
                      currentCase.priority === 'low' && "bg-green-100 text-green-700 border border-green-300"
                    )}>
                      {currentCase.priority === 'high' ? '高优先级' : currentCase.priority === 'medium' ? '中优先级' : '低优先级'}
                    </span>
                  )
                )}
                {currentCase.testScenario && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Target className="w-4 h-4" />
                    <span className="font-medium">场景：{currentCase.testScenario}</span>
                  </div>
                )}
                {currentCase.sectionId && (
                  <div className="text-gray-600">
                    <span className="font-medium">章节：</span>
                    <span>{currentCase.sectionId} {currentCase.sectionName || ''}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 系统信息和关联测试点 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-purple-200">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">系统</div>
              {isEditing ? (
                <Input
                  value={editedCase?.system || ''}
                  onChange={(e) => updateField('system', e.target.value)}
                  placeholder="系统名称"
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">{currentCase.system || '未指定'}</div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">模块</div>
              {isEditing ? (
                <Input
                  value={editedCase?.module || ''}
                  onChange={(e) => updateField('module', e.target.value)}
                  placeholder="模块名称"
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">{currentCase.module || '未指定'}</div>
              )}
            </div>
            {currentCase.testPoints && currentCase.testPoints.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">关联测试点</div>
                <div className="flex flex-wrap gap-2 min-w-0">
                  {currentCase.testPoints.map((tp, index) => {
                    // 统一字段名称：优先使用 testPoint，兼容 testPointName
                    const testPointName = tp.testPoint || tp.testPointName || '未命名测试点';
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg border border-blue-200 whitespace-nowrap"
                        title={tp.description || testPointName}
                      >
                        {testPointName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {currentCase.coverageAreas && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">覆盖范围</div>
                {isEditing ? (
                  <Input
                    value={editedCase?.coverageAreas || ''}
                    onChange={(e) => updateField('coverageAreas', e.target.value)}
                    placeholder="覆盖范围"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-900 line-clamp-2">{currentCase.coverageAreas}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 前置条件和测试数据 */}
        {(currentCase.preconditions || currentCase.testData) && (
          <div className="grid grid-cols-2 gap-4">
            {currentCase.preconditions && (
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <label className="text-xs font-semibold text-amber-800 uppercase tracking-wide">前置条件</label>
                </div>
                {isEditing ? (
                  <TextArea
                    value={editedCase?.preconditions || ''}
                    onChange={(e) => updateField('preconditions', e.target.value)}
                    rows={4}
                    placeholder="前置条件"
                  />
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed">{currentCase.preconditions}</p>
                )}
              </div>
            )}
            {currentCase.testData && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <label className="text-xs font-semibold text-blue-800 uppercase tracking-wide">测试数据</label>
                </div>
                {isEditing ? (
                  <TextArea
                    value={editedCase?.testData || ''}
                    onChange={(e) => updateField('testData', e.target.value)}
                    rows={4}
                    placeholder="测试数据"
                  />
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed">{currentCase.testData}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 测试步骤和预期结果 */}
        {(filledSteps || displayAssertions) && (
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded"></div>
              <h3 className="text-lg font-semibold text-gray-900">测试执行</h3>
            </div>
            
            <div className="space-y-5">
              {filledSteps && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <label className="text-sm font-semibold text-gray-700">测试步骤</label>
                    {currentCase.testData && (
                      <span className="text-xs text-blue-600 ml-2">（已填充测试数据）</span>
                    )}
                  </div>
                  {isEditing ? (
                    <TextArea
                      value={editedCase?.steps || ''}
                      onChange={(e) => updateField('steps', e.target.value)}
                      rows={8}
                      placeholder="测试步骤"
                      className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200"
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed m-0">{filledSteps}</pre>
                    </div>
                  )}
                </div>
              )}
              
              {displayAssertions && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <label className="text-sm font-semibold text-gray-700">预期结果</label>
                  </div>
                  {isEditing ? (
                    <TextArea
                      value={editedCase?.assertions || ''}
                      onChange={(e) => updateField('assertions', e.target.value)}
                      rows={6}
                      placeholder="预期结果"
                      className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200"
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed m-0">{displayAssertions}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
