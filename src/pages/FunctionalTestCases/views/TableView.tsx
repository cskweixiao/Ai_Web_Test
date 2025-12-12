import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Table, Button, Space, Tooltip, Checkbox, Pagination, Tag } from 'antd';
import { Edit3, Trash2, Eye, FileText, User, Bot, PlayCircle, RotateCcw } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { ViewProps } from '../types';
import { getCaseTypeInfo } from '../../../utils/caseTypeHelper';

// 平铺后的行数据类型
interface FlatRowData {
    key: string;
    rowIndex: number;
    // 测试点信息
    test_point_id: number;
    test_point_index: number;
    test_point_name: string;
    test_purpose?: string;
    test_point_risk_level: string;
    // 测试用例信息
    id: number;
    case_id?: string;  // 🆕 格式化的用例编号
    name: string;
    description?: string;
    system: string;
    module: string;
    priority: string;
    status: string;
    section_name?: string;
    section_description?: string;  // 🆕 需求章节描述
    scenario_name?: string;  // 🆕 测试场景名称
    scenario_description?: string;  // 🆕 测试场景描述
    tags?: string;
    source?: string;
    case_type?: string;  // 🆕 用例类型
    project_version_id?: number;  // 🆕 项目版本ID
    project_version?: {  // 🆕 项目版本信息
        id: number;
        version_name: string;
        version_code: string;
        is_main: boolean;
    };
    requirement_source?: string;  // 🆕 需求来源
    execution_status?: string | null;  // 🆕 执行状态: 'pass', 'fail', 'block', null
    last_executed_at?: string | null;  // 🆕 最后执行时间
    last_executor?: string | null;  // 🆕 最后执行人
    created_at: string;
    users?: {
        username: string;
    };
}

// 默认列宽配置
const defaultColumnWidths: Record<string, number> = {
    select: 50,
    id: 80,
    system: 180,
    module: 90,
    scenario_name: 200,
    test_point_name: 200,
    name: 320,
    project_version: 100,
    case_type: 80,
    priority: 80,
    execution_status: 90,
    source: 90,
    creator: 90,
    created_at: 140,
    actions: 160,
};

export const TableView: React.FC<ViewProps> = ({
    testCases,
    loading,
    selectedPoints,
    onToggleSelectPoint,
    onBatchSelectPoints,
    onViewDetail,
    onEditCase,
    onDeleteCase,
    onViewLogs,
    onExecuteCase,
    pagination,
    onPageChange
}) => {
    // 列宽状态管理
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...defaultColumnWidths });
    
    // 拖动状态
    const dragStateRef = useRef<{
        isDragging: boolean;
        startX: number;
        startWidth: number;
        columnKey: string;
    } | null>(null);

    // 开始拖动
    const handleMouseDown = useCallback((columnKey: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startWidth = columnWidths[columnKey] || defaultColumnWidths[columnKey] || 100;
        
        dragStateRef.current = {
            isDragging: true,
            startX: e.clientX,
            startWidth,
            columnKey,
        };
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [columnWidths]);

    // 拖动过程
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStateRef.current?.isDragging) return;
            
            const { startX, startWidth, columnKey } = dragStateRef.current;
            const diff = e.clientX - startX;
            const newWidth = Math.max(50, Math.min(800, startWidth + diff));
            
            // 直接更新状态，因为我们只在拖动时更新
            setColumnWidths(prev => ({
                ...prev,
                [columnKey]: newWidth,
            }));
        };

        const handleMouseUp = () => {
            if (dragStateRef.current?.isDragging) {
                dragStateRef.current = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // 双击重置单列宽度
    const handleDoubleClick = useCallback((key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setColumnWidths((prev) => ({
            ...prev,
            [key]: defaultColumnWidths[key] || 100,
        }));
    }, []);

    // 重置所有列宽
    const handleResetAllWidths = useCallback(() => {
        setColumnWidths({ ...defaultColumnWidths });
    }, []);

    // 将测试用例数据转换为平铺的行数据
    const flatData: FlatRowData[] = useMemo(() => {
        if (!testCases || testCases.length === 0) return [];

        return testCases.map((row, index) => ({
            key: `${row.test_point_id || row.id}-${index}`,
            // 🆕 序号倒序：总数 - 当前位置，最新的数据序号最大
            rowIndex: (pagination?.total || testCases.length) - ((pagination?.page || 1) - 1) * (pagination?.pageSize || 20) - index,
            // 测试点信息
            test_point_id: row.test_point_id,
            test_point_index: row.test_point_index,
            test_point_name: row.test_point_name || '未命名测试点',
            test_purpose: row.test_purpose,
            test_point_risk_level: row.test_point_risk_level || 'medium',
            // 测试用例信息
            id: row.id,
            case_id: row.case_id,  // 🆕 格式化的用例编号
            name: row.name || '未命名用例',
            description: row.description,
            system: row.system || '-',
            module: row.module || '-',
            priority: row.priority || 'medium',
            status: row.status || 'DRAFT',
            section_name: row.section_name || '未分类',
            scenario_name: row.scenario_name,  // 🆕 测试场景名称
            scenario_description: row.scenario_description,  // 🆕 测试场景描述
            section_description: row.section_description,  // 🆕 测试场景描述
            tags: row.tags,
            source: row.source || 'MANUAL',
            case_type: row.case_type || 'FULL',  // 🆕 用例类型
            project_version_id: row.project_version_id,  // 🆕 项目版本ID
            project_version: row.project_version,  // 🆕 项目版本信息
            requirement_source: row.requirement_source,  // 🆕 需求来源
            execution_status: row.execution_status,  // 🆕 执行状态
            last_executed_at: row.last_executed_at,  // 🆕 最后执行时间
            last_executor: row.last_executor,  // 🆕 最后执行人
            created_at: row.created_at,
            users: row.users
        }));
    }, [testCases, pagination?.page, pagination?.pageSize, pagination?.total]);

    // 优先级配置
    const getPriorityConfig = (priority: string) => {
        switch (priority) {
            case 'critical': return { color: '#c53030', bg: '#fed7d7', text: '紧急' };
            case 'high': return { color: '#c53030', bg: '#fed7d7', text: '高' };
            case 'medium': return { color: '#c05621', bg: '#feebc8', text: '中' };
            case 'low': return { color: '#2f855a', bg: '#c6f6d5', text: '低' };
            default: return { color: '#4a5568', bg: '#e2e8f0', text: priority };
        }
    };

    // 来源配置
    const getSourceConfig = (source: string) => {
        if (source === 'AI_GENERATED') {
            return { color: '#6b46c1', bg: '#e9d8fd', text: 'AI生成', icon: <Bot className="w-3 h-3 mr-1" /> };
        }
        return { color: '#4a5568', bg: '#e2e8f0', text: '手动创建', icon: <User className="w-3 h-3 mr-1" /> };
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

    // 格式化日期
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // 🆕 计算当前页全选状态
    const currentPagePointIds = useMemo(() => {
        return flatData.map(row => row.test_point_id);
    }, [flatData]);

    const currentPageSelectedCount = useMemo(() => {
        return currentPagePointIds.filter(id => selectedPoints.has(id)).length;
    }, [currentPagePointIds, selectedPoints]);

    const isAllCurrentPageSelected = currentPagePointIds.length > 0 && currentPageSelectedCount === currentPagePointIds.length;
    const isIndeterminate = currentPageSelectedCount > 0 && currentPageSelectedCount < currentPagePointIds.length;

    // 表格列定义
    const columns: ColumnsType<FlatRowData> = useMemo(() => [
        {
            title: (
                <div style={{ paddingLeft: '16px' }}>
                    <Checkbox
                        checked={isAllCurrentPageSelected}
                        indeterminate={isIndeterminate}
                        onChange={(e) => {
                            if (onBatchSelectPoints) {
                                // 使用批量选择函数，一次性更新状态
                                onBatchSelectPoints(currentPagePointIds, e.target.checked);
                            } else {
                                // 降级处理：逐个调用
                                currentPagePointIds.forEach(id => {
                                    const isSelected = selectedPoints.has(id);
                                    if (e.target.checked && !isSelected) {
                                        onToggleSelectPoint(id);
                                    } else if (!e.target.checked && isSelected) {
                                        onToggleSelectPoint(id);
                                    }
                                });
                            }
                        }}
                    />
                </div>
            ),
            dataIndex: 'select',
            key: 'select',
            width: 50,
            fixed: 'left',
            render: (_, record) => (
                <div style={{ paddingLeft: '15px' }}>
                    <Checkbox
                        checked={selectedPoints.has(record.test_point_id)}
                        onChange={() => onToggleSelectPoint(record.test_point_id)}
                    />
                </div>
            ),
        },
        // {
        //     title: '序号',
        //     dataIndex: 'rowIndex',
        //     key: 'rowIndex',
        //     width: 50,
        //     fixed: 'left',
        //     render: (index: number) => (
        //         <span className="text-gray-500 font-medium">{index}</span>
        //     ),
        // },
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
            sorter: (a, b) => a.id - b.id,
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'descend',
            render: (id: number) => (
                <span className="font-mono font-semibold text-indigo-600 text-sm whitespace-nowrap">
                    {/* {record.case_id ? record.case_id : `TC_${String(id).padStart(5, '0')}`} */}
                    {`TC_${String(id).padStart(5, '0')}`}
                </span>
            ),
        },
        {
            title: <div style={{ paddingRight: '24px' }}>所属项目</div>,
            dataIndex: 'system',
            key: 'system',
            width: 180,
            fixed: 'left',
            ellipsis: { showTitle: false },
            render: (text: string) => (
                <div style={{ paddingRight: '0px' }}>
                    <Tooltip title={text} placement="topLeft">
                        <span className="text-gray-700 block truncate">{text || '-'}</span>
                    </Tooltip>
                </div>
            ),
        },
        {
            title: <div style={{ paddingLeft: '5px' }}>所属模块</div>,
            dataIndex: 'module',
            key: 'module',
            width: 90,
            ellipsis: { showTitle: false },
            render: (text: string) => (
                <div style={{ paddingLeft: '5px' }}>
                <Tooltip title={text} placement="topLeft">
                    <span className="text-gray-700 block truncate">{text || '-'}</span>
                </Tooltip>
                </div>
            ),
        },
        {
            title: '测试场景',
            dataIndex: 'scenario_name',  // 🔧 改为显示测试场景名称
            key: 'scenario_name',
            width: 200,
            ellipsis: { showTitle: false },
            render: (text: string, record) => (
                <Tooltip 
                    title={
                        <div className="text-xs">
                            <div className="font-medium">{text || record.scenario_name || '未分类'}</div>
                            {record.scenario_description && (
                                <div className="mt-1 text-gray-300">{record.scenario_description}</div>
                            )}
                        </div>
                    } 
                    placement="topLeft"
                    styles={{ body: { minWidth: '360px', maxWidth: '450px', padding: '8px' } }}
                >
                    <div className="overflow-hidden">
                        <div className="text-gray-800 font-medium truncate">{text || record.scenario_name || '未分类'}</div>
                        {record.scenario_description && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {/* {record.scenario_description} */}
                            </div>
                        )}
                    </div>
                </Tooltip>
            ),
        },
        {
            title: '测试点',
            dataIndex: 'test_point_name',
            key: 'test_point_name',
            width: 200,
            ellipsis: { showTitle: false },
            render: (text: string, record) => (
                <Tooltip 
                    title={
                        <div className="text-xs">
                            <div className="font-medium">{text}</div>
                            {record.test_purpose && (
                                <div className="mt-1 text-gray-300">{record.test_purpose}</div>
                            )}
                        </div>
                    } 
                    placement="topLeft"
                    styles={{ body: { minWidth: '360px', maxWidth: '450px', padding: '8px' } }}
                >
                    <div className="overflow-hidden">
                        <div className="flex flex-col items-normal gap-0">
                            <span className="text-gray-700 truncate">{text}</span>
                            {record.test_purpose && (
                                <div className="text-xs text-gray-500 mt-0.5 truncate">
                                    {/* {record.test_purpose} */}
                                </div>
                            )}
                        </div>
                    </div>
                </Tooltip>
            ),
        },
        // {
        //     title: '用例ID',
        //     dataIndex: 'id',
        //     key: 'id',
        //     width: 80,
        //     render: (id: number) => (
        //         <span className="font-mono font-semibold text-indigo-600 text-sm whitespace-nowrap">
        //             {/* {record.case_id ? record.case_id : `TC_${String(id).padStart(5, '0')}`} */}
        //             {`TC_${String(id).padStart(5, '0')}`}
        //         </span>
        //     ),
        // },
        {
            title: '用例标题',
            dataIndex: 'name',
            key: 'name',
            width: 320,
            ellipsis: { showTitle: false },
            render: (text: string, record) => (
                <Tooltip 
                    title={
                        <div className="text-xs">
                            <div className="font-medium">{text}</div>
                            {record.description && (
                                <div className="mt-1 text-gray-300">{record.description}</div>
                            )}
                        </div>
                    }
                    placement="topLeft"
                    styles={{ body: { minWidth: '460px', maxWidth: '550px', padding: '8px' } }}
                >
                    <div className="overflow-hidden">
                        <div className="text-gray-900 font-medium truncate">
                            {text}
                        </div>
                        {record.description && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {/* {record.description} */}
                            </div>
                        )}
                    </div>
                </Tooltip>
            ),
        },
        {
            title: '用例版本',
            dataIndex: 'project_version',
            key: 'project_version',
            width: 100,
            align: 'center',
            sorter: (a, b) => a.project_version?.version_code.localeCompare(b.project_version?.version_code || ''),
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'ascend',
            render: (version: FlatRowData['project_version']) => {
                if (!version) {
                    return <span className="text-gray-400 text-xs">-</span>;
                }
                return (
                    <Tooltip title={`${version.version_name} (${version.version_code})`}>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ 
                                backgroundColor: version.is_main ? '#c6f6d5' : '#e2e8f0', 
                                color: version.is_main ? '#276749' : '#4a5568' 
                            }}
                        >
                            {version.is_main && <span>⭐</span>}
                            <span className="truncate max-w-[60px]">{version.version_code}</span>
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: '用例类型',
            dataIndex: 'case_type',
            key: 'case_type',
            width: 80,
            align: 'center',
            sorter: (a, b) => a.case_type?.localeCompare(b.case_type || '') || 0,
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'ascend',
            render: (caseType: string) => {
                const config = getCaseTypeConfig(caseType);
                return (
                    <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: config.bg, color: config.color }}
                    >
                        {config.text}
                    </span>
                );
            },
        },
        {
            title: '优先级',
            dataIndex: 'priority',
            key: 'priority',
            width: 80,
            align: 'center',
            sorter: (a, b) => a.priority?.localeCompare(b.priority || '') || 0,
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'ascend',
            render: (priority: string) => {
                const config = getPriorityConfig(priority);
                return (
                    <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: config.bg, color: config.color }}
                    >
                        {config.text}
                    </span>
                );
            },
        },
        // { 
        //     title: '执行状态',
        //     dataIndex: 'status',
        //     key: 'status',
        //     width: 90,
        //     align: 'center',
        //     render: (status: string) => {
        //         const getStatusColor = (status: string) => {
        //             switch (status) {
        //                 case 'completed': return 'green';
        //                 case 'running': return 'red';
        //                 case 'pending': return 'gray';
        //                 default: return 'gray';
        //             }
        //         };
        //         const getStatusText = (status: string) => {
        //             switch (status) {
        //                 case 'completed': return '已完成';
        //                 case 'running': return '进行中';
        //                 case 'pending': return '未开始';
        //                 default: return '已完成';
        //             }
        //         };
        //         return <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>;
        //     },
        // },
        {
            title: '执行结果',
            dataIndex: 'execution_status',
            key: 'execution_status',
            width: 90,
            align: 'center',
            sorter: (a, b) => a.execution_status?.localeCompare(b.execution_status || '') || 0,
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'ascend',
            render: (execution_status: string | null, record: FlatRowData) => {
                // 根据实际执行结果展示状态
                const getStatusConfig = (status: string | null) => {
                    switch (status) {
                        case 'pass':
                            return { color: 'success', text: '✓ 通过', icon: '✓' };
                        case 'fail':
                            return { color: 'error', text: '✗ 失败', icon: '✗' };
                        case 'block':
                            return { color: 'warning', text: '⚠ 阻塞', icon: '⚠' };
                        default:
                            return { color: 'default', text: '未执行', icon: '-' };
                    }
                };
                
                const config = getStatusConfig(execution_status);
                
                return (
                    <Tooltip 
                        placement="top"
                        styles={{ body: { padding: '8px', fontSize: '13px' } }}
                        title={
                            execution_status && record.last_executed_at ? (
                                <div>
                                    <div>执行人: {record.last_executor || '未知'}</div>
                                    <div>执行时间: {new Date(record.last_executed_at).toLocaleString('zh-CN')}</div>
                                    <div>执行结果: {execution_status === 'pass' ? '通过' : execution_status === 'fail' ? '失败' : execution_status === 'block' ? '阻塞' : '未知'}</div>
                                </div>
                            ) : '暂无执行记录'
                        }
                    >
                        <Tag color={config.color}>{config.text}</Tag>
                        {/* {execution_status === 'pass' && <Tag className='inline-flex items-center gap-1' color="success"><CheckCircle className="w-4 h-4 text-green-500 dark:text-green-500" /> 通过</Tag>}
                        {execution_status === 'fail' && <Tag className='inline-flex items-center gap-1' color="error"><XCircle className="w-4 h-4 text-red-500" /> 失败</Tag>}
                        {execution_status === 'block' && <Tag className='inline-flex items-center gap-1' color="warning"><AlertCircle className="w-4 h-4 text-orange-500" /> 阻塞</Tag>}
                        {execution_status === null && <Tag className='inline-flex items-center gap-1' color="default"><Clock className="w-4 h-4 text-gray-500" /> 未执行</Tag>} */}
                    </Tooltip>
                );
            },
        },
        // {
        //     title: '风险',
        //     dataIndex: 'test_point_risk_level',
        //     key: 'risk_level',
        //     width: 70,
        //     align: 'center',
        //     render: (risk: string) => {
        //         const config = getRiskConfig(risk);
        //         return (
        //             <span
        //                 className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
        //                 style={{ backgroundColor: config.bg, color: config.color }}
        //             >
        //                 {config.text}
        //             </span>
        //         );
        //     },
        // },
        {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            width: 90,
            align: 'center',
            sorter: (a, b) => a.source?.localeCompare(b.source || '') || 0,
            sortDirections: ['ascend', 'descend'],
            defaultSortOrder: 'ascend',
            render: (source: string) => {
                const config = getSourceConfig(source);
                return (
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: config.bg, color: config.color }}
                    >
                        {config.icon}
                        <span className="ml-0.5">{source === 'AI_GENERATED' ? 'AI' : '手动'}</span>
                    </span>
                );
            },
        },
        {
            title: '创建者',
            dataIndex: 'users',
            key: 'creator',
            width: 90,
            align: 'center',
            ellipsis: { showTitle: false },
            render: (users: { username: string } | undefined) => (
                <Tooltip title={users?.username} placement="topLeft">
                    <div className="flex items-center justify-center gap-1 text-gray-600 overflow-hidden">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm truncate">{users?.username || '-'}</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 140,
            align: 'center',
            render: (date: string) => (
                <span className="text-gray-500 text-sm whitespace-nowrap">
                    {formatDate(date)}
                </span>
            ),
        },
        {
            title: <div style={{ paddingLeft: '4px', textAlign: 'left' }}>操作</div>,
            key: 'actions',
            width: 160,
            fixed: 'right',
            // align: 'center',
            render: (_, record) => (
                <Space size={8} className="flex-nowrap">
                    <Tooltip title="查看详情">
                        <Button
                            type="text"
                            size="small"
                            className="!px-1.5 hover:!bg-blue-50 hover:!text-blue-600 transition-all"
                            icon={<Eye className="w-4 h-4" />}
                            onClick={() => onViewDetail(record.id)}
                        />
                    </Tooltip>
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            size="small"
                            className="!px-1.5 hover:!bg-indigo-50 hover:!text-indigo-600 transition-all"
                            icon={<Edit3 className="w-4 h-4" />}
                            onClick={() => onEditCase(record.id)}
                        />
                    </Tooltip>
                    {/* <Dropdown
                        menu={{
                            items: [
                                {
                                    key: 'default',
                                    label: '执行测试（原型样式）',
                                    icon: <PlayCircle className="w-3.5 h-3.5" />,
                                    onClick: () => onExecuteCase(record.id, 'default'),
                                },
                                {
                                    key: 'alt',
                                    label: '执行测试（备选样式）',
                                    icon: <PlayCircle className="w-3.5 h-3.5" />,
                                    onClick: () => onExecuteCase(record.id, 'alt'),
                                },
                            ],
                        }}
                        trigger={['click']}
                    >
                        <Tooltip title="执行用例">
                            <Button
                                type="text"
                                size="small"
                                className="!px-1.5 hover:!bg-emerald-50 hover:!text-emerald-600 transition-all"
                                icon={<PlayCircle className="w-4 h-4" />}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </Tooltip>
                    </Dropdown> */}
                    <Tooltip title="执行用例">
                        <Button
                            type="text"
                            size="small"
                            className="!px-1.5 hover:!bg-emerald-50 hover:!text-emerald-600 transition-all"
                            icon={<PlayCircle className="w-4 h-4" />}
                            onClick={() => onExecuteCase(record.id, 'alt')}
                        />
                    </Tooltip>
                    <Tooltip title="执行日志">
                        <Button
                            type="text"
                            size="small"
                            className="!px-1.5 hover:!bg-green-50 hover:!text-green-600 transition-all"
                            icon={<FileText className="w-4 h-4" />}
                            onClick={() => onViewLogs(record.id)}
                        />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button
                            type="text"
                            size="small"
                            danger
                            className="!px-1.5 hover:!bg-red-50 transition-all"
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => onDeleteCase(record.id, record.name)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ], [
        isAllCurrentPageSelected,
        isIndeterminate,
        currentPagePointIds,
        selectedPoints,
        onBatchSelectPoints,
        onToggleSelectPoint,
        onViewDetail,
        onEditCase,
        onDeleteCase,
        onViewLogs,
        onExecuteCase,
    ]);

    // 将列配置转换为可调整宽度的列配置
    const resizableColumns: ColumnsType<FlatRowData> = useMemo(() => {
        return columns.map((col) => {
            const columnKey = col.key as string;
            const currentWidth = columnWidths[columnKey] || (col.width as number) || 100;
            const originalTitle = col.title;
            
            // 为标题添加拖动区域（覆盖在原有分割线位置）
            const titleWithHandle = (
                <>
                    {originalTitle as React.ReactNode}
                    {/* 拖动区域 - 覆盖在表格原有分割线上 */}
                    <div
                        className="column-resize-handle"
                        onMouseDown={(e) => handleMouseDown(columnKey, e)}
                        onDoubleClick={(e) => handleDoubleClick(columnKey, e)}
                    />
                </>
            );
            
            return {
                ...col,
                title: titleWithHandle,
                width: currentWidth,
            };
        });
    }, [columns, columnWidths, handleMouseDown, handleDoubleClick]);

    // 处理分页变化
    const handlePageChange = (page: number, pageSize: number) => {
        if (onPageChange) {
            onPageChange(page, pageSize);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-gray-500 mt-4">加载测试用例中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 表格 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <Table
                    columns={resizableColumns}
                    dataSource={flatData}
                    rowKey="key"
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 1900, y: 'calc(100vh - 420px)' }}
                    size="middle"
                    className="functional-test-table"
                    tableLayout="fixed"
                    rowClassName={(record, index) => {
                        // 对同一测试场景的行添加分组效果
                        const prevRecord = flatData[index - 1];
                        if (index > 0 && prevRecord && prevRecord.section_name !== record.section_name) {
                            return 'border-t-2 border-t-gray-200';
                        }
                        return '';
                    }}
                    locale={{
                        emptyText: (
                            <div className="py-16 text-center">
                                <div className="text-gray-400 mb-2">
                                    <FileText className="w-12 h-12 mx-auto" />
                                </div>
                                <p className="text-gray-500">未找到符合条件的测试用例</p>
                            </div>
                        )
                    }}
                />

                {/* 分页 */}
                {pagination && pagination.total > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-500">
                                共 <span className="font-semibold text-gray-700">{pagination.total}</span> 条记录，
                                第 <span className="font-semibold text-gray-700">{pagination.page}</span> / <span className="font-semibold text-gray-700">{pagination.totalPages}</span> 页
                            </div>
                            <Tooltip title="重置列宽（双击列边框可重置单列）">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                                    onClick={handleResetAllWidths}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    重置列宽
                                </Button>
                            </Tooltip>
                        </div>
                        <Pagination
                            current={pagination.page}
                            pageSize={pagination.pageSize}
                            total={pagination.total}
                            showSizeChanger
                            showQuickJumper
                            pageSizeOptions={['10', '20', '50', '100']}
                            onChange={handlePageChange}
                            onShowSizeChange={handlePageChange}
                            locale={{
                                items_per_page: '条/页',
                                jump_to: '跳至',
                                page: '页',
                                prev_page: '上一页',
                                next_page: '下一页'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
