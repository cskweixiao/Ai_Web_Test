import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Radio } from 'antd';
import {
  Sparkles, Upload as UploadIcon, FileText, Zap, Shield,
  ArrowLeft, ArrowRight, Save, FileX, CheckCircle
} from 'lucide-react';
import { functionalTestCaseService } from '../services/functionalTestCaseService';
import { showToast } from '../utils/toast';
import { Button } from '../components/ui/button';
import { ProgressIndicator } from '../components/ai-generator/ProgressIndicator';
import { StepCard } from '../components/ai-generator/StepCard';
import { AIThinking } from '../components/ai-generator/AIThinking';
import { DraftCaseCard } from '../components/ai-generator/DraftCaseCard';
import { MultiFileUpload } from '../components/ai-generator/MultiFileUpload';
import { MarkdownEditor } from '../components/ai-generator/MarkdownEditor';
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

  // 步骤1状态
  const [axureFiles, setAxureFiles] = useState<File[]>([]);
  const [projectInfo, setProjectInfo] = useState({
    projectName: '',
    systemType: '2B',
    businessDomain: '',
    businessRules: '',
    constraints: '',
    description: ''
  });
  const [parseResult, setParseResult] = useState<any>(null);
  const [parsing, setParsing] = useState(false);

  // 步骤2状态
  const [requirementDoc, setRequirementDoc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sessionId, setSessionId] = useState('');

  // 步骤3状态
  const [batches, setBatches] = useState<any[]>([]);
  const [draftCases, setDraftCases] = useState<any[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [planningBatches, setPlanningBatches] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  // 步骤1：上传和解析
  const handleParse = async () => {
    if (axureFiles.length === 0) {
      showToast.error('请先上传Axure文件');
      return;
    }

    // 验证至少有一个 HTML 文件
    const hasHtml = axureFiles.some(f => f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm'));
    if (!hasHtml) {
      showToast.error('至少需要一个 HTML 文件');
      return;
    }

    setParsing(true);
    try {
      const result = await functionalTestCaseService.parseAxureMulti(axureFiles);
      setParseResult(result.data);
      setSessionId(result.data.sessionId);
      showToast.success('解析成功！');

      // 自动生成需求文档
      setCurrentStep(1);
      await generateRequirementDoc(result.data, result.data.sessionId);
    } catch (error: any) {
      showToast.error('解析失败：' + error.message);
    } finally {
      setParsing(false);
    }
  };

  // 生成需求文档
  const generateRequirementDoc = async (axureData: any, sid?: string) => {
    setGenerating(true);
    try {
      const businessRules = projectInfo.businessRules.split('\n').filter(r => r.trim());
      const constraints = projectInfo.constraints.split('\n').filter(c => c.trim());

      // 使用传入的 sessionId 或状态中的 sessionId
      const currentSessionId = sid || sessionId;

      const result = await functionalTestCaseService.generateRequirement(
        currentSessionId,
        axureData,
        { ...projectInfo, businessRules, constraints }
      );

      setRequirementDoc(result.data.requirementDoc);
    } catch (error: any) {
      showToast.error('生成需求文档失败：' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // 规划分批并生成
  const handlePlanAndGenerate = async () => {
    setCurrentStep(2);
    setPlanningBatches(true);

    try {
      const batchResult = await functionalTestCaseService.planBatches(sessionId, requirementDoc);
      console.log('📋 规划分批结果:', batchResult);
      console.log('📦 批次数组:', batchResult.data.batches);
      setBatches(batchResult.data.batches);
      console.log('✅ 批次状态已更新');
    } catch (error: any) {
      console.error('❌ 规划分批失败:', error);
      showToast.error('规划分批失败：' + error.message);
    } finally {
      setPlanningBatches(false);
    }
  };

  // 生成当前批次
  const generateCurrentBatch = async () => {
    if (currentBatchIndex >= batches.length) {
      showToast.info('所有批次已生成完毕');
      return;
    }

    const currentBatch = batches[currentBatchIndex];
    console.log('📦 开始生成批次:', currentBatch);
    setGeneratingBatch(true);

    try {
      const result = await functionalTestCaseService.generateBatch(
        sessionId,
        currentBatch.id,
        currentBatch.scenarios,
        requirementDoc,
        draftCases
      );

      console.log('✅ 批次生成结果:', result);
      console.log('📊 测试用例数组:', result.data.testCases);
      console.log('📏 生成了多少个用例:', result.data.testCases?.length);

      const newCases = result.data.testCases.map((tc: any, index: number) => ({
        ...tc,
        id: `draft-${Date.now()}-${index}`,
        batchNumber: currentBatchIndex + 1,
        selected: true
      }));

      console.log('🎨 处理后的用例数组:', newCases);

      setDraftCases(prev => {
        const updated = [...prev, ...newCases];
        console.log('📝 更新后的草稿箱:', updated);
        return updated;
      });
      setCurrentBatchIndex(prev => prev + 1);
      showToast.success(`第${currentBatchIndex + 1}批生成完成`);
    } catch (error: any) {
      console.error('❌ 生成批次失败:', error);
      showToast.error('生成失败：' + error.message);
    } finally {
      setGeneratingBatch(false);
    }
  };

  // 保存到用例库
  const saveToLibrary = async () => {
    const selectedCases = draftCases.filter(c => c.selected);

    if (selectedCases.length === 0) {
      showToast.warning('请至少选择一个用例');
      return;
    }

    setSaving(true);
    try {
      await functionalTestCaseService.batchSave(selectedCases, sessionId);
      showToast.success(`成功保存 ${selectedCases.length} 个用例`);

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

  // 渲染步骤1：上传原型
  const renderStep1 = () => (
    <StepCard
      stepNumber={1}
      title="上传 Axure 原型"
      description="支持 HTML + JS 文件，可拖拽整个文件夹"
      onNext={handleParse}
      nextButtonText={parsing ? '解析中...' : '开始解析'}
      nextButtonDisabled={axureFiles.length === 0 || parsing}
      hideActions={false}
    >
      {/* 左右分栏布局 */}
      <div className="grid grid-cols-[1.2fr,0.8fr] gap-8">
        {/* 左侧：文件上传区 + 解析结果 */}
        <div className="space-y-6">
          {/* 多文件上传组件 */}
          <MultiFileUpload
            onFilesChange={setAxureFiles}
            maxFiles={20}
            maxSize={50 * 1024 * 1024}
          />

          {/* 解析进度 */}
          {parsing && (
            <AIThinking
              title="正在解析原型文件..."
              subtitle="预计需要 10-30 秒"
              progressItems={[
                { label: '正在读取 HTML 结构...', status: 'processing' },
                { label: '解析 JS 交互逻辑', status: 'pending' },
                { label: '合并数据与提取交互关系', status: 'pending' }
              ]}
            />
          )}

          {/* 解析结果 */}
          {parseResult && !parsing && (
            <motion.div
              className="bg-green-50 rounded-xl p-6 border border-green-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 mb-3">解析成功！</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">{parseResult.pageCount}</div>
                      <div className="text-xs text-green-600 mt-1">页面数量</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">{parseResult.elementCount}</div>
                      <div className="text-xs text-green-600 mt-1">元素数量</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">{parseResult.interactionCount}</div>
                      <div className="text-xs text-green-600 mt-1">交互数量</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 右侧：项目信息表单 */}
        <div className="space-y-6">
          {/* 表单卡片 */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 sticky top-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500
                              flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  补充项目信息
                </h3>
                <p className="text-xs text-gray-500">可选,帮助 AI 更好理解业务</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  项目名称
                </label>
                <Input
                  placeholder="例如：电商后台管理系统"
                  value={projectInfo.projectName}
                  onChange={e => setProjectInfo(prev => ({ ...prev, projectName: e.target.value }))}
                />
              </div>

              {/* 系统类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  系统类型
                </label>
                <Radio.Group
                  value={projectInfo.systemType}
                  onChange={e => setProjectInfo(prev => ({ ...prev, systemType: e.target.value }))}
                  className="flex flex-col gap-2"
                >
                  <Radio value="2C">2C 面向用户</Radio>
                  <Radio value="2B">2B 面向企业</Radio>
                  <Radio value="internal">内部系统</Radio>
                </Radio.Group>
              </div>

              {/* 业务领域 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  业务领域
                </label>
                <Input
                  placeholder="例如：电商/零售"
                  value={projectInfo.businessDomain}
                  onChange={e => setProjectInfo(prev => ({ ...prev, businessDomain: e.target.value }))}
                />
              </div>

              {/* 业务规则 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  关键业务规则
                </label>
                <TextArea
                  rows={4}
                  placeholder="每行一条规则，例如：&#10;• 订单金额超过1000需审批&#10;• 库存不足时不能下单"
                  value={projectInfo.businessRules}
                  onChange={e => setProjectInfo(prev => ({ ...prev, businessRules: e.target.value }))}
                />
              </div>

              {/* 提示信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 leading-relaxed">
                  💡 提示：补充业务信息可以帮助 AI 生成更准确的测试用例,包括边界条件和异常场景。
                </p>
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
      description="您可以编辑修改,以获得更精准的测试用例"
      onNext={handlePlanAndGenerate}
      nextButtonText="生成测试用例 →"
      hideActions={generating}
    >
      {generating ? (
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
        <div className="bg-gray-50 rounded-xl p-6">
          <MarkdownEditor
            value={requirementDoc}
            onChange={setRequirementDoc}
            placeholder="AI 正在生成需求文档..."
            rows={20}
          />
        </div>
      )}
    </StepCard>
  );

  // 渲染步骤3：生成用例
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* 规划分批中的提示 */}
      {planningBatches && (
        <AIThinking
          title="AI 正在规划分批策略..."
          subtitle="分析需求文档,制定最优分批方案"
          progressItems={[
            { label: '分析需求复杂度', status: 'processing' },
            { label: '识别测试场景', status: 'pending' },
            { label: '制定分批策略', status: 'pending' }
          ]}
        />
      )}

      {/* 批次控制面板 */}
      <motion.div
        className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 进度环 */}
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="#e5e7eb"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="url(#gradient)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${batches.length > 0 ? (currentBatchIndex / batches.length) * 201 : 0} 201`}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">
                  {currentBatchIndex}/{batches.length}
                </span>
              </div>
            </div>

            {/* 文本信息 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                批次生成进度
              </h3>
              <p className="text-sm text-gray-600">
                已完成 {currentBatchIndex} 批,共 {batches.length} 批
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <Button
            variant="default"
            size="lg"
            icon={<Zap className="w-5 h-5" />}
            isLoading={generatingBatch}
            disabled={currentBatchIndex >= batches.length}
            onClick={() => {
              console.log('🔘 点击了生成下一批按钮');
              console.log('📊 当前状态:', {
                currentBatchIndex,
                batchesLength: batches.length,
                generatingBatch,
                disabled: currentBatchIndex >= batches.length
              });
              generateCurrentBatch();
            }}
          >
            {generatingBatch ? '生成中...' : '生成下一批'}
          </Button>
        </div>
      </motion.div>

      {/* AI生成中的提示 */}
      {generatingBatch && (
        <AIThinking
          title="AI 正在生成测试用例..."
          subtitle={`第 ${currentBatchIndex + 1}/${batches.length} 批,预计需要 20-60 秒`}
          progressItems={[
            { label: '分析需求文档', status: 'completed' },
            { label: '生成测试场景...', status: 'processing' },
            { label: '生成测试步骤和预期结果', status: 'pending' }
          ]}
        />
      )}

      {/* 草稿箱 */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600
                            flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {draftCases.length}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">草稿箱</h3>
              <p className="text-sm text-gray-500">
                已生成 {draftCases.length} 个用例,选中 {selectedCount} 个
              </p>
            </div>
          </div>

          {/* 批量操作 */}
          {draftCases.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                全选
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                取消全选
              </Button>
            </div>
          )}
        </div>

        {/* 用例网格 */}
        {draftCases.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
          >
            {draftCases.map(testCase => (
              <DraftCaseCard
                key={testCase.id}
                id={testCase.id}
                name={testCase.name}
                description={testCase.description}
                priority={testCase.priority}
                qualityScore={testCase.qualityScore}
                batchNumber={testCase.batchNumber}
                stepsCount={testCase.steps?.length}
                selected={testCase.selected}
                onToggleSelect={toggleCaseSelect}
              />
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-20">
            <FileX className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500 mb-2">暂无生成的用例</p>
            <p className="text-sm text-gray-400">
              点击上方"生成下一批"按钮开始生成用例
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 页面头部 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* 标题区 */}
          <div className="flex items-center gap-4 mb-4">
            {/* AI 图标 */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500
                            flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600
                             bg-clip-text text-transparent">
                AI 测试用例生成器
              </h1>
              <p className="text-sm text-gray-500">
                从 Axure 原型到完整测试用例,一站式 AI 驱动
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
        "mx-auto px-6 py-8",
        currentStep === 0 && "max-w-7xl",
        currentStep === 1 && "max-w-4xl",
        currentStep === 2 && "max-w-6xl"
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
              />
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
              />
              <StepCard
                stepNumber={2}
                title="AI 生成需求文档"
                isCompleted={true}
                completedSummary={`需求文档已生成 (${requirementDoc.length} 字)`}
                onEdit={() => setCurrentStep(1)}
              />
              {renderStep3()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg
                      border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧统计 */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{draftCases.length}</div>
                  <div className="text-xs text-gray-500">总用例</div>
                </div>
              </div>

              <div className="w-px h-10 bg-gray-200" />

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{selectedCount}</div>
                  <div className="text-xs text-gray-500">已选中</div>
                </div>
              </div>

              {draftCases.length > 0 && (
                <>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{avgQuality}</div>
                      <div className="text-xs text-gray-500">平均质量</div>
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
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  上一步
                </Button>
              )}

              {currentStep === 2 && draftCases.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                  >
                    修改需求
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    icon={<Save className="w-5 h-5" />}
                    isLoading={saving}
                    disabled={selectedCount === 0}
                    onClick={saveToLibrary}
                    className="px-8 shadow-lg"
                  >
                    💾 保存到用例库 ({selectedCount})
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 自定义样式 */}
      <style>{`
        .requirement-editor {
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.75;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          transition: all 0.2s ease;
        }

        .requirement-editor:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
        }
      `}</style>
    </div>
  );
}
