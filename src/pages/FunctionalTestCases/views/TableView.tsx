import React from 'react';
import { Table, Tag, Button, Space, Tooltip } from 'antd';
import { Edit3, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { ViewProps, TestCaseGroup, TestPointItem } from '../types';

export const TableView: React.FC<ViewProps> = ({
    organizedData,
    loading,
    selectedPoints,
    onToggleSelectPoint,
    onEditCase,
    onDeleteCase,
    onEditPoint,
    onDeletePoint,
}) => {
    // 将组织化数据扁平化为表格数据
    const tableData = organizedData.flatMap(scenario =>
        scenario.testCases.map(testCase => ({
            ...testCase,
            scenarioName: scenario.name,
        }))
    );

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'red';
            case 'high': return 'orange';
            case 'medium': return 'blue';
            case 'low': return 'default';
            default: return 'default';
        }
    };

    const getPriorityText = (priority: string) => {
        switch (priority) {
            case 'critical': return '紧急';
            case 'high': return '高';
            case 'medium': return '中';
            case 'low': return '低';
            default: return priority;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PUBLISHED': return 'green';
            case 'DRAFT': return 'gold';
            case 'ARCHIVED': return 'default';
            default: return 'default';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'PUBLISHED': return '已发布';
            case 'DRAFT': return '草稿';
            case 'ARCHIVED': return '已归档';
            default: return status;
        }
    };

    const getRiskLevelText = (level: string) => {
        switch (level) {
            case 'high': return '高';
            case 'medium': return '中';
            case 'low': return '低';
            default: return level;
        }
    };

    const columns: ColumnsType<TestCaseGroup & { scenarioName: string }> = [
        {
            title: '测试用例名称',
            dataIndex: 'name',
            key: 'name',
            width: 300,
            fixed: 'left',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (text, record) => (
                <div>
                    <div className="font-medium text-gray-900">{text}</div>
                    {record.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{record.description}</div>
                    )}
                </div>
            ),
        },
        {
            title: '场景',
            dataIndex: 'scenarioName',
            key: 'scenarioName',
            width: 150,
            filters: Array.from(new Set(tableData.map(item => item.scenarioName))).map(name => ({
                text: name,
                value: name,
            })),
            onFilter: (value, record) => record.scenarioName === value,
        },
        {
            title: '系统',
            dataIndex: 'system',
            key: 'system',
            width: 120,
            filters: Array.from(new Set(tableData.map(item => item.system))).map(sys => ({
                text: sys,
                value: sys,
            })),
            onFilter: (value, record) => record.system === value,
        },
        {
            title: '模块',
            dataIndex: 'module',
            key: 'module',
            width: 120,
        },
        {
            title: '优先级',
            dataIndex: 'priority',
            key: 'priority',
            width: 100,
            sorter: (a, b) => {
                const order = { critical: 4, high: 3, medium: 2, low: 1 };
                return (order[a.priority as keyof typeof order] || 0) - (order[b.priority as keyof typeof order] || 0);
            },
            render: (priority: string) => (
                <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            filters: [
                { text: '已发布', value: 'PUBLISHED' },
                { text: '草稿', value: 'DRAFT' },
                { text: '已归档', value: 'ARCHIVED' },
            ],
            onFilter: (value, record) => record.status === value,
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
            ),
        },
        {
            title: '测试点',
            dataIndex: 'testPoints',
            key: 'testPointsCount',
            width: 100,
            align: 'center',
            sorter: (a, b) => a.testPoints.length - b.testPoints.length,
            render: (testPoints: TestPointItem[]) => (
                <span className="text-blue-600 font-medium">{testPoints.length}</span>
            ),
        },
        {
            title: '创建人',
            dataIndex: ['users', 'username'],
            key: 'creator',
            width: 120,
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            size="small"
                            icon={<Edit3 className="w-4 h-4" />}
                            onClick={() => onEditCase(record.id)}
                        />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => onDeleteCase(record.id, record.name)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    // 展开行渲染测试点
    const expandedRowRender = (record: TestCaseGroup) => {
        const testPointColumns: ColumnsType<TestPointItem> = [
            {
                title: '序号',
                dataIndex: 'test_point_index',
                key: 'test_point_index',
                width: 80,
                align: 'center',
            },
            {
                title: '测试点名称',
                dataIndex: 'test_point_name',
                key: 'test_point_name',
                width: 250,
            },
            {
                title: '测试目的',
                dataIndex: 'test_purpose',
                key: 'test_purpose',
                width: 200,
                ellipsis: true,
            },
            {
                title: '测试步骤',
                dataIndex: 'steps',
                key: 'steps',
                width: 250,
                ellipsis: true,
            },
            {
                title: '预期结果',
                dataIndex: 'expected_result',
                key: 'expected_result',
                width: 200,
                ellipsis: true,
            },
            {
                title: '风险等级',
                dataIndex: 'risk_level',
                key: 'risk_level',
                width: 100,
                render: (level: string) => (
                    <Tag color={getPriorityColor(level)}>{getRiskLevelText(level)}</Tag>
                ),
            },
            {
                title: '操作',
                key: 'actions',
                width: 120,
                render: (_, point) => (
                    <Space size="small">
                        <Tooltip title="编辑">
                            <Button
                                type="text"
                                size="small"
                                icon={<Edit3 className="w-3.5 h-3.5" />}
                                onClick={() => onEditPoint(point)}
                            />
                        </Tooltip>
                        <Tooltip title="删除">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => onDeletePoint(point.id, point.test_point_name)}
                            />
                        </Tooltip>
                    </Space>
                ),
            },
        ];

        return (
            <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">测试点列表</h4>
                <Table
                    columns={testPointColumns}
                    dataSource={record.testPoints}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    rowSelection={{
                        selectedRowKeys: Array.from(selectedPoints),
                        onChange: (selectedRowKeys) => {
                            // 处理选中状态变化
                            const currentPointIds = new Set(record.testPoints.map(p => p.id));
                            selectedRowKeys.forEach(key => {
                                if (currentPointIds.has(key as number)) {
                                    onToggleSelectPoint(key as number);
                                }
                            });
                        },
                    }}
                />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">加载测试用例中...</p>
            </div>
        );
    }

    if (tableData.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500">未找到符合条件的测试用例</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <Table
                columns={columns}
                dataSource={tableData}
                rowKey="id"
                loading={loading}
                pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                }}
                expandable={{
                    expandedRowRender,
                    expandIcon: ({ expanded, onExpand, record }) => (
                        <button
                            onClick={(e) => onExpand(record, e)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                            {expanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                        </button>
                    ),
                }}
                scroll={{ x: 1500 }}
                locale={{
                    emptyText: '暂无数据',
                    filterConfirm: '确定',
                    filterReset: '重置',
                    selectAll: '全选',
                    selectInvert: '反选',
                }}
            />
        </div>
    );
};
