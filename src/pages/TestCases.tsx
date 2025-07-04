import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
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
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';

// 简化的测试用例接口
interface TestCase {
  id: number;
  name: string;
  steps: string;
  assertions: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'disabled';
  lastRun: string;
  success_rate: number;
  author: string;
  created: string;
}

// 表单数据接口
interface CreateTestCaseForm {
  name: string;
  steps: string;
  assertions: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'disabled';
  tags: string;
}

export function TestCases() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [runningTestId, setRunningTestId] = useState<number | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTestCase, setDeletingTestCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState<CreateTestCaseForm>({
    name: '',
    steps: '',
    assertions: '',
    priority: 'medium',
    status: 'draft',
    tags: ''
  });

  // 加载测试用例
  useEffect(() => {
    loadTestCases();
  }, []);

  const loadTestCases = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/tests/cases');
      const data = await response.json();
      setTestCases(data || []);
    } catch (error) {
      console.error('加载测试用例失败:', error);
      setTestCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestCase = async () => {
    if (!formData.name.trim()) {
      alert('请输入测试用例名称');
      return;
    }
    
    if (!formData.steps.trim()) {
      alert('请输入测试步骤');
      return;
    }

    try {
      setLoading(true);
      
      if (editingTestCase) {
        // 编辑模式
        const updatedTestCase = {
          ...editingTestCase,
          name: formData.name.trim(),
          steps: formData.steps.trim(),
          assertions: formData.assertions.trim(),
          priority: formData.priority,
          status: formData.status,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        };

        const response = await fetch(`http://localhost:3001/api/tests/cases/${editingTestCase.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedTestCase)
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await loadTestCases();
            resetForm();
            alert('测试用例更新成功！');
          } else {
            throw new Error(result.error || '更新失败');
          }
        } else {
          throw new Error('网络请求失败');
        }
      } else {
        // 创建模式
        const newTestCase = {
          name: formData.name.trim(),
          steps: formData.steps.trim(),
          assertions: formData.assertions.trim(),
          priority: formData.priority,
          status: formData.status,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          author: '当前用户',
          created: new Date().toISOString().split('T')[0],
          lastRun: '从未运行',
          success_rate: 0
        };

        const response = await fetch('http://localhost:3001/api/tests/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newTestCase)
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await loadTestCases();
            resetForm();
            alert('测试用例创建成功！');
          } else {
            throw new Error(result.error || '创建失败');
          }
        } else {
          throw new Error('网络请求失败');
        }
      }
    } catch (error: any) {
      console.error('操作测试用例失败:', error);
      alert(`操作失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTestCase = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setFormData({
      name: testCase.name,
      steps: testCase.steps,
      assertions: testCase.assertions,
      priority: testCase.priority,
      status: testCase.status,
      tags: testCase.tags.join(', ')
    });
    setShowCreateModal(true);
  };

  const handleDeleteTestCase = (testCase: TestCase) => {
    setDeletingTestCase(testCase);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingTestCase) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/tests/cases/${deletingTestCase.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadTestCases();
          setShowDeleteModal(false);
          setDeletingTestCase(null);
          alert('测试用例删除成功！');
        } else {
          throw new Error(result.error || '删除失败');
        }
      } else {
        throw new Error('网络请求失败');
      }
    } catch (error: any) {
      console.error('删除测试用例失败:', error);
      alert(`删除失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      steps: '',
      assertions: '',
      priority: 'medium',
      status: 'draft',
      tags: ''
    });
    setShowCreateModal(false);
    setEditingTestCase(null);
  };

  const allTags = Array.from(new Set(testCases.flatMap(tc => tc.tags)));

  const filteredTestCases = testCases.filter(testCase => {
    const matchesSearch = testCase.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         testCase.steps.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         testCase.assertions.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === '' || testCase.tags.includes(selectedTag);
    const matchesPriority = selectedPriority === '' || testCase.priority === selectedPriority;
    
    return matchesSearch && matchesTag && matchesPriority;
  });

  const handleRunTest = async (testCase: TestCase) => {
    if (runningTestId) {
      alert('已有测试在运行中，请等待完成');
      return;
    }

    setRunningTestId(testCase.id);
    
    try {
      console.log(`🚀 开始执行测试: ${testCase.name}`);
      
      // 调用后端API执行测试
      const response = await fetch('http://localhost:3001/api/tests/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testCaseId: testCase.id,
          environment: 'staging'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`✅ 测试开始执行: ${testCase.name}\n运行ID: ${result.runId}`);
        
        // 可以在这里添加WebSocket监听测试执行状态
        console.log('测试运行ID:', result.runId);
        
        // 模拟等待测试完成（实际应该通过WebSocket实时更新）
        setTimeout(() => {
          alert(`🎉 测试执行完成: ${testCase.name}`);
          setRunningTestId(null);
        }, 10000); // 10秒后模拟完成
        
      } else {
        throw new Error(result.error || '启动测试失败');
      }
      
    } catch (error: any) {
      console.error('执行测试失败:', error);
      alert(`❌ 执行测试失败: ${error.message}`);
      setRunningTestId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'disabled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">测试用例管理</h2>
          <p className="text-gray-600">创建、编辑和管理您的自动化测试用例</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          创建测试用例
        </motion.button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索测试用例..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tag Filter */}
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={allTags.length === 0}
          >
            <option value="">所有标签</option>
            {allTags.map(tag => (
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

          {/* Stats */}
          <div className="flex items-center justify-end text-sm text-gray-600">
            显示 {filteredTestCases.length} / {testCases.length} 个用例
          </div>
        </div>
      </div>

      {/* Empty State */}
      {testCases.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="mx-auto w-32 h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <FileText className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">暂无测试用例</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            您还没有创建任何测试用例。点击下方按钮创建您的第一个自动化测试用例，开始您的测试之旅。
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
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
      {loading && (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      )}

      {/* Test Cases Grid */}
      {!loading && filteredTestCases.length > 0 && (
        <div className="grid gap-6">
          <AnimatePresence>
            {filteredTestCases.map((testCase, index) => (
              <motion.div
                key={testCase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{testCase.name}</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">测试步骤</span>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{testCase.steps || '暂无步骤描述'}</p>
                      </div>
                      {testCase.assertions && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">断言预期</span>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{testCase.assertions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleRunTest(testCase)}
                      disabled={runningTestId === testCase.id}
                      className={clsx(
                        "p-1 transition-colors",
                        runningTestId === testCase.id 
                          ? "text-blue-600 cursor-not-allowed" 
                          : "text-gray-400 hover:text-blue-600"
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
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEditTestCase(testCase)}
                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                      title="编辑测试用例"
                    >
                      <Edit3 className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteTestCase(testCase)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除测试用例"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {testCase.tags.map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Status and Priority */}
                <div className="flex items-center justify-between mb-4">
                  <span className={clsx(
                    'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                    getPriorityColor(testCase.priority)
                  )}>
                    优先级: {testCase.priority === 'high' ? '高' : testCase.priority === 'medium' ? '中' : '低'}
                  </span>
                  <span className={clsx(
                    'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                    getStatusColor(testCase.status)
                  )}>
                    {testCase.status === 'active' ? '活跃' : testCase.status === 'draft' ? '草稿' : '禁用'}
                  </span>
                </div>

                {/* Success Rate */}
                {testCase.success_rate > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">成功率</span>
                      <span className="font-medium text-gray-900">{testCase.success_rate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${testCase.success_rate}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                  <div className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {testCase.author}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {testCase.lastRun}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTestCase ? '编辑测试用例' : '创建新测试用例'}
                </h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    用例名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入测试用例名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    测试步骤 *
                  </label>
                  <textarea
                    rows={4}
                    value={formData.steps}
                    onChange={(e) => setFormData(prev => ({ ...prev, steps: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例如：&#10;1. 打开登录页面&#10;2. 输入用户名和密码&#10;3. 点击登录按钮&#10;4. 验证页面跳转"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    断言预期
                  </label>
                  <textarea
                    rows={3}
                    value={formData.assertions}
                    onChange={(e) => setFormData(prev => ({ ...prev, assertions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例如：&#10;• 页面成功跳转到首页&#10;• 显示用户昵称&#10;• 退出按钮可见"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                      <option value="draft">草稿</option>
                      <option value="active">活跃</option>
                      <option value="disabled">禁用</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标签 (用逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="登录, 认证, 核心功能"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={resetForm}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateTestCase}
                  disabled={loading || !formData.name.trim() || !formData.steps.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {editingTestCase ? '更新中...' : '创建中...'}
                    </>
                  ) : (
                    editingTestCase ? '更新用例' : '创建用例'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && deletingTestCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="px-6 py-4">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  您确定要删除测试用例 "<span className="font-medium">{deletingTestCase.name}</span>" 吗？
                  此操作无法撤销。
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletingTestCase(null);
                    }}
                    disabled={loading}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        删除中...
                      </>
                    ) : (
                      '确认删除'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}