import React from 'react';
import { Table, Tag, Button, Space, Tooltip, Progress, Select } from 'antd';
import { Edit3, Trash2, ChevronRight, ChevronDown, FileText, PlayCircle, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { ViewProps, TestScenarioGroup, TestPointGroup, TestCaseItem, ExecutionStatus } from '../types';

export const TableView: React.FC<ViewProps> = ({
    organizedData,
    loading,
    onEditCase,
    onDeleteCase,
    onEditPoint,
    onDeletePoint,
    onUpdateExecutionStatus,
    onViewLogs
}) => {

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

    const getRiskLevelText = (level: string) => {
        switch (level) {
            case 'high': return '高';
            case 'medium': return '中';
            case 'low': return '低';
            default: return level;
        }
    };

    const getStatusTag = (status: ExecutionStatus) => {
        switch (status) {
            case 'passed': return <Tag color="success" icon={<CheckCircle className="w-3 h-3 mr-1" />}>通过</Tag>;
            case 'failed': return <Tag color="error" icon={<XCircle className="w-3 h-3 mr-1" />}>失败</Tag>;
            case 'blocked': return <Tag color="warning" icon={<AlertCircle className="w-3 h-3 mr-1" />}>受阻</Tag>;
            default: return <Tag color="default" icon={<Clock className="w-3 h-3 mr-1" />}>未执行</Tag>;
        }
    };

    // Level 3: Test Cases
    const expandedPointRender = (point: TestPointGroup) => {
        const caseColumns: ColumnsType<TestCaseItem> = [
            {
                title: '测试用例名称',
                dataIndex: 'name',
                key: 'name',
                width: 300,
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
                title: '优先级',
                dataIndex: 'priority',
                key: 'priority',
                width: 100,
                render: (priority: string) => (
                    <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>
                ),
            },
            {
                title: '执行状态',
                dataIndex: 'executionStatus',
                key: 'executionStatus',
                width: 150,
                render: (status: ExecutionStatus, record) => (
                    <Select
                        value={status || 'pending'}
                        onChange={(val) => onUpdateExecutionStatus(record.id, val)}
                        style={{ width: 120 }}
                        options={[
                            { label: <span className="text-gray-500">未执行</span>, value: 'pending' },
                            { label: <span className="text-green-600">通过</span>, value: 'passed' },
                            { label: <span className="text-red-600">失败</span>, value: 'failed' },
                            { label: <span className="text-orange-600">受阻</span>, value: 'blocked' },
                        ]}
                        size="small"
                        variant="borderless"
                        className="font-medium"
                    />
                ),
            },
            {
                title: '最后执行',
                dataIndex: 'lastRun',
                key: 'lastRun',
                width: 150,
                render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
            },
            {
                title: '操作',
                key: 'actions',
                width: 150,
                render: (_, record) => (
                    <Space size="small">
                        <Tooltip title="执行日志">
                            <Button
                                type="text"
                                size="small"
                                icon={<FileText className="w-4 h-4 text-gray-500" />}
                                onClick={() => onViewLogs(record.id)}
                            />
                        </Tooltip>
                        <Tooltip title="编辑">
                            <Button
                                type="text"
                                size="small"
                                icon={<Edit3 className="w-4 h-4 text-blue-500" />}
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

        return (
            <div className="pl-12 pr-4 py-2 bg-white">
                <Table
                    columns={caseColumns}
                    dataSource={point.testCases}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    bordered={false}
                    showHeader={true}
                />
            </div>
        );
    };

    // Level 2: Test Points
    const expandedScenarioRender = (scenario: TestScenarioGroup) => {
        const pointColumns: ColumnsType<TestPointGroup> = [
            {
                title: '测试点',
                dataIndex: 'test_point_name',
                key: 'name',
                width: 250,
                render: (text, record) => (
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {record.test_point_index}
                        </span>
                        <span className="font-medium">{text}</span>
                    </div>
                ),
            },
            {
                title: '测试目的',
                dataIndex: 'test_purpose',
                key: 'purpose',
                width: 200,
                ellipsis: true,
            },
            {
                title: '进度',
                key: 'progress',
                width: 200,
                render: (_, record) => (
                    <div className="w-full pr-4">
                        <Progress percent={record.progress} size="small" steps={5} strokeColor="#52c41a" />
                    </div>
                ),
            },
            {
                title: '风险等级',
                dataIndex: 'risk_level',
                key: 'risk',
                width: 100,
                render: (level: string) => (
                    <Tag color={getPriorityColor(level)}>{getRiskLevelText(level)}</Tag>
                ),
            },
            {
                title: '操作',
                key: 'actions',
                width: 100,
                render: (_, record) => (
                    <Space size="small">
                        <Tooltip title="编辑测试点">
                            <Button
                                type="text"
                                size="small"
                                icon={<Edit3 className="w-3.5 h-3.5" />}
                                onClick={() => onEditPoint(record)}
                            />
                        </Tooltip>
                        <Tooltip title="删除测试点">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => onDeletePoint(record.id, record.test_point_name)}
                            />
                        </Tooltip>
                    </Space>
                ),
            },
        ];

        return (
            <div className="pl-8 pr-4 py-3 bg-gray-50/50 rounded-lg mx-4 mb-2 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">测试点列表</h4>
                <Table
                    columns={pointColumns}
                    dataSource={scenario.testPoints}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    expandable={{
                        expandedRowRender: expandedPointRender,
                        expandIcon: ({ expanded, onExpand, record }) => (
                            <button
                                onClick={(e) => onExpand(record, e)}
                                className="p-1 hover:bg-blue-100 rounded transition-colors mr-2"
                            >
                                {expanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                        ),
                    }}
                />
            </div>
        );
    };

    // Level 1: Scenarios
    const scenarioColumns: ColumnsType<TestScenarioGroup> = [
        {
            title: '测试场景',
            dataIndex: 'name',
            key: 'name',
            width: 300,
            render: (text) => (
                <div className="font-bold text-gray-800 text-base">{text}</div>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            width: 300,
            ellipsis: true,
            render: (text) => text || <span className="text-gray-400 italic">无描述</span>,
        },
        {
            title: '总体进度',
            key: 'progress',
            width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Progress percent={record.progress} strokeColor={{ from: '#108ee9', to: '#87d068' }} />
                    {record.progress === 100 && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
            ),
        },
        {
            title: '包含测试点',
            key: 'pointsCount',
            width: 120,
            align: 'center',
            render: (_, record) => (
                <Tag color="blue">{record.testPoints.length} 个测试点</Tag>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-4">加载测试用例中...</p>
            </div>
        );
    }

    if (organizedData.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500">未找到符合条件的测试用例</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <Table
                columns={scenarioColumns}
                dataSource={organizedData}
                rowKey="id"
                loading={loading}
                pagination={false} // Pagination is handled externally
                expandable={{
                    expandedRowRender: expandedScenarioRender,
                    expandIcon: ({ expanded, onExpand, record }) => (
                        <button
                            onClick={(e) => onExpand(record, e)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                            {expanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-600" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            )}
                        </button>
                    ),
                }}
                scroll={{ x: 1200 }}
            />
        </div>
    );
};
