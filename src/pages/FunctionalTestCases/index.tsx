import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, Trash2 } from 'lucide-react';
import { functionalTestCaseService } from '../../services/functionalTestCaseService';
import * as systemService from '../../services/systemService';
import { showToast } from '../../utils/toast';
import { TestCaseDetailModal } from '../../components/ai-generator/TestCaseDetailModal';
import { FilterBar } from './components/FilterBar';
import { ViewSwitcher } from './components/ViewSwitcher';
import { CardView } from './views/CardView';
import { TableView } from './views/TableView';
import { KanbanView } from './views/KanbanView';
import { TimelineView } from './views/TimelineView';
import { FilterState, TestScenarioGroup, TestPointGroup, TestCaseItem, ViewMode, ExecutionStatus } from './types';
import { SystemOption } from '../../types/test';
import { ExecutionLogModal } from './components/ExecutionLogModal';

// LocalStorage key for view preference
const VIEW_PREFERENCE_KEY = 'functional-test-cases-view-mode';

export function FunctionalTestCases() {
    const navigate = useNavigate();

    // View State - 从 localStorage 读取用户偏好，默认为表格视图
    const [currentView, setCurrentView] = useState<ViewMode>(() => {
        const saved = localStorage.getItem(VIEW_PREFERENCE_KEY);
        return (saved as ViewMode) || 'table';
    });

    // State
    const [testCases, setTestCases] = useState<any[]>([]); // Raw flat data
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0
    });

    const [filters, setFilters] = useState<FilterState>({
        search: '',
        system: '',
        module: '',
        source: '',
        priority: '',
        status: '',
        tag: '',
        sectionName: '',
        createdBy: '',
        startDate: '',
        endDate: '',
        riskLevel: ''
    });

    const [systemOptions, setSystemOptions] = useState<SystemOption[]>([]);
    const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());

    // Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [currentDetailCase, setCurrentDetailCase] = useState<any>(null);
    const [logModalOpen, setLogModalOpen] = useState(false);
    const [currentLogCaseId, setCurrentLogCaseId] = useState<number | null>(null);

    // 保存视图偏好到 localStorage
    const handleViewChange = (view: ViewMode) => {
        setCurrentView(view);
        localStorage.setItem(VIEW_PREFERENCE_KEY, view);
        // 切换视图时清空选中状态
        setSelectedPoints(new Set());
    };

    // Load Data
    const loadData = async () => {
        setLoading(true);
        try {
            const result = await functionalTestCaseService.getFlatList({
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...filters
            });

            setTestCases(result.data || []);
            setPagination(prev => ({
                ...prev,
                total: result.pagination?.total || 0,
                totalPages: result.pagination?.totalPages || 0
            }));
        } catch (error: any) {
            showToast.error('加载数据失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Load Systems
    useEffect(() => {
        const loadSystems = async () => {
            try {
                const systems = await systemService.getActiveSystems();
                setSystemOptions(systems);
            } catch (error) {
                console.error('加载系统列表失败:', error);
            }
        };
        loadSystems();
    }, []);

    // Reload on filter/page change
    useEffect(() => {
        loadData();
    }, [pagination.page, pagination.pageSize, filters]);

    // Clear selection on data change
    useEffect(() => {
        setSelectedPoints(new Set());
    }, [testCases]);

    // Organize Data: Scenario -> Point -> Case
    const organizedData = useMemo(() => {
        if (!testCases || testCases.length === 0) return [];

        const scenarioMap = new Map<string, TestScenarioGroup>();

        testCases.forEach((row) => {
            // 1. Identify Scenario
            // Assuming 'tags' or 'section_name' identifies the scenario. 
            // If tags is an array string "['Scenario A']", we might need to parse it.
            // For now, using tags as string or '未分类'.
            const scenarioName = row.tags || '未分类';
            const scenarioId = scenarioName; // Use name as ID for now if no specific ID

            if (!scenarioMap.has(scenarioId)) {
                scenarioMap.set(scenarioId, {
                    id: scenarioId,
                    name: scenarioName,
                    description: '', // Scenario description might not be in flat list row
                    testPoints: [],
                    progress: 0
                });
            }
            const scenario = scenarioMap.get(scenarioId)!;

            // 2. Identify Test Point
            const pointId = row.test_point_id;
            let point = scenario.testPoints.find(p => p.id === pointId);

            if (!point) {
                point = {
                    id: pointId,
                    test_point_index: row.test_point_index,
                    test_point_name: row.test_point_name || '未命名测试点',
                    test_purpose: row.test_purpose,
                    steps: row.test_point_steps || '',
                    expected_result: row.test_point_expected_result || '',
                    risk_level: row.test_point_risk_level || 'medium',
                    testCases: [],
                    progress: 0
                };
                scenario.testPoints.push(point);
            }

            // 3. Add Test Case
            // Check if case already exists (unlikely in flat list unless duplicate rows)
            if (!point.testCases.some(tc => tc.id === row.id)) {
                point.testCases.push({
                    id: row.id,
                    name: row.name || '未命名用例',
                    description: row.description,
                    system: row.system || '',
                    module: row.module || '',
                    priority: row.priority || 'medium',
                    status: row.status || 'DRAFT',
                    executionStatus: row.execution_status || 'pending', // Assuming backend returns execution_status
                    lastRun: row.last_run,
                    logs: row.execution_logs || [], // Assuming backend returns logs
                    created_at: row.created_at,
                    users: row.users
                });
            }
        });

        // Calculate Progress
        const scenarios = Array.from(scenarioMap.values());
        scenarios.forEach(scenario => {
            let scenarioTotalCases = 0;
            let scenarioCompletedCases = 0;

            scenario.testPoints.forEach(point => {
                const total = point.testCases.length;
                // Usually 'passed' is 100%, 'failed' is also executed. 
                // Let's count 'passed', 'failed', 'blocked' as executed.
                const executed = point.testCases.filter(tc => ['passed', 'failed', 'blocked'].includes(tc.executionStatus)).length;

                point.progress = total > 0 ? Math.round((executed / total) * 100) : 0;

                scenarioTotalCases += total;
                scenarioCompletedCases += executed;
            });

            scenario.progress = scenarioTotalCases > 0 ? Math.round((scenarioCompletedCases / scenarioTotalCases) * 100) : 0;
        });

        return scenarios;
    }, [testCases]);

    // Handlers
    const handleBatchDelete = async () => {
        if (selectedPoints.size === 0) {
            showToast.warning('请选择要删除的测试点');
            return;
        }

        if (!window.confirm(`确定要删除 ${selectedPoints.size} 个测试点吗？`)) {
            return;
        }

        try {
            await functionalTestCaseService.batchDelete(Array.from(selectedPoints));
            showToast.success(`已删除 ${selectedPoints.size} 个测试点`);
            loadData();
            setSelectedPoints(new Set());
        } catch (error: any) {
            showToast.error(error.message || '批量删除失败');
        }
    };

    const handleToggleSelectPoint = (pointId: number) => {
        const newSelected = new Set(selectedPoints);
        if (newSelected.has(pointId)) {
            newSelected.delete(pointId);
        } else {
            newSelected.add(pointId);
        }
        setSelectedPoints(newSelected);
    };

    const handleEditCase = (id: number) => {
        const testCase = testCases.find(tc => tc.id === id);
        if (testCase) {
            setCurrentDetailCase(testCase);
            setDetailModalOpen(true);
        }
    };

    const handleDeleteCase = async (id: number, name: string) => {
        if (!window.confirm(`确定要删除测试用例 "${name}" 吗？`)) return;
        try {
            await functionalTestCaseService.delete(id);
            showToast.success('测试用例已删除');
            loadData();
        } catch (error: any) {
            showToast.error('删除失败: ' + error.message);
        }
    };

    const handleEditPoint = (point: TestPointGroup) => {
        // For now, we edit the first case of the point or just open a modal?
        // Since points are tied to cases, maybe we just pick one case to edit context?
        // Or maybe we need a specific Point Edit Modal.
        // Reusing handleEditCase for the first case for now as fallback.
        if (point.testCases.length > 0) {
            handleEditCase(point.testCases[0].id);
        }
    };

    const handleDeletePoint = async (pointId: number, pointName: string) => {
        if (!window.confirm(`确定要删除测试点 "${pointName}" 吗？`)) return;
        try {
            await functionalTestCaseService.batchDelete([pointId]);
            showToast.success('测试点已删除');
            loadData();
        } catch (error: any) {
            showToast.error('删除失败: ' + error.message);
        }
    };

    const handleSaveDetail = async (updatedTestCase: any) => {
        try {
            await functionalTestCaseService.update(updatedTestCase.id, {
                name: updatedTestCase.name,
                description: updatedTestCase.description,
                testPoints: updatedTestCase.testPoints,
                system: updatedTestCase.system,
                module: updatedTestCase.module,
                priority: updatedTestCase.priority,
                tags: updatedTestCase.tags,
                sectionId: updatedTestCase.sectionId,
                sectionName: updatedTestCase.sectionName
            });
            showToast.success('测试用例已更新');
            setDetailModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast.error('更新失败: ' + error.message);
        }
    };

    const handleUpdateExecutionStatus = async (caseId: number, status: ExecutionStatus) => {
        try {
            // Optimistic update
            setTestCases(prev => prev.map(tc => tc.id === caseId ? { ...tc, execution_status: status } : tc));

            await functionalTestCaseService.update(caseId, { executionStatus: status });
            showToast.success('执行状态已更新');
            // No need to reload data if optimistic update is enough, but for consistency:
            // loadData(); 
        } catch (error: any) {
            showToast.error('更新状态失败: ' + error.message);
            loadData(); // Revert on error
        }
    };

    const handleViewLogs = (caseId: number) => {
        setCurrentLogCaseId(caseId);
        setLogModalOpen(true);
    };

    // 视图组件的通用属性
    const viewProps = {
        testCases,
        organizedData,
        loading,
        selectedPoints,
        onToggleSelectPoint: handleToggleSelectPoint,
        onEditCase: handleEditCase,
        onDeleteCase: handleDeleteCase,
        onEditPoint: handleEditPoint,
        onDeletePoint: handleDeletePoint,
        onUpdateExecutionStatus: handleUpdateExecutionStatus,
        onViewLogs: handleViewLogs
    };

    // 渲染当前视图
    const renderCurrentView = () => {
        switch (currentView) {
            case 'card':
                return <CardView {...viewProps} />;
            case 'table':
                return <TableView {...viewProps} />;
            case 'kanban':
                return <KanbanView {...viewProps} />;
            case 'timeline':
                return <TimelineView {...viewProps} />;
            default:
                return <TableView {...viewProps} />;
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-gray-50/50">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        功能测试用例
                        {selectedPoints.size > 0 && (
                            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                已选择 {selectedPoints.size} 项
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">管理和组织您的功能测试场景</p>
                </div>
                <div className="flex gap-3">
                    {selectedPoints.size > 0 && (
                        <button
                            onClick={handleBatchDelete}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm hover:shadow-md"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            批量删除 ({selectedPoints.size})
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/functional-test-cases/generator')}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <Bot className="w-4 h-4 mr-2" />
                        AI 生成器
                    </button>
                    <button
                        onClick={() => navigate('/functional-test-cases/create')}
                        className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        手动创建
                    </button>
                </div>
            </div>

            {/* View Switcher and Filter Bar */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <ViewSwitcher currentView={currentView} onViewChange={handleViewChange} />

                <div className="text-sm text-gray-500">
                    共 {pagination.total} 个测试用例
                </div>
            </div>

            {/* Filter Bar */}
            <FilterBar
                filters={filters}
                setFilters={setFilters}
                onSearch={() => setPagination(prev => ({ ...prev, page: 1 }))}
                onReset={() => {
                    setFilters({
                        search: '', system: '', module: '', source: '', priority: '', status: '', tag: '',
                        sectionName: '', createdBy: '', startDate: '', endDate: '', riskLevel: ''
                    });
                    setPagination(prev => ({ ...prev, page: 1 }));
                }}
                systemOptions={systemOptions}
            />

            {/* Content - 渲染当前视图 */}
            <div className="mt-6">
                {renderCurrentView()}
            </div>

            {/* Pagination - 仅在卡片和时间线视图显示 */}
            {(currentView === 'card' || currentView === 'timeline') && pagination.total > 0 && (
                <div className="mt-8 flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-sm text-gray-500">
                        显示 {((pagination.page - 1) * pagination.pageSize) + 1} 到 {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，共 {pagination.total} 条结果
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            上一页
                        </button>
                        <button
                            disabled={pagination.page === pagination.totalPages}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {detailModalOpen && currentDetailCase && (
                <TestCaseDetailModal
                    isOpen={detailModalOpen}
                    onClose={() => setDetailModalOpen(false)}
                    testCase={currentDetailCase}
                    onSave={handleSaveDetail}
                />
            )}

            {/* Execution Log Modal */}
            {logModalOpen && currentLogCaseId && (
                <ExecutionLogModal
                    isOpen={logModalOpen}
                    onClose={() => setLogModalOpen(false)}
                    caseId={currentLogCaseId}
                />
            )}
        </div>
    );
}
