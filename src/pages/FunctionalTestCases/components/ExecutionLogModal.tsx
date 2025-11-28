import React, { useState, useEffect } from 'react';
import { Modal, Timeline, Tag, Empty, Spin } from 'antd';
import { CheckCircle, XCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { ExecutionStatus, ExecutionLog } from '../types';

interface ExecutionLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: number;
}

export const ExecutionLogModal: React.FC<ExecutionLogModalProps> = ({
    isOpen,
    onClose,
    caseId
}) => {
    const [logs, setLogs] = useState<ExecutionLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && caseId) {
            loadLogs();
        }
    }, [isOpen, caseId]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual API call
            // const result = await functionalTestCaseService.getExecutionLogs(caseId);
            // setLogs(result.data);

            // Mock data for now
            await new Promise(resolve => setTimeout(resolve, 500));
            setLogs([
                {
                    id: '1',
                    status: 'passed',
                    executor: '张三',
                    time: new Date(Date.now() - 86400000).toISOString(),
                    comment: '测试通过，所有功能正常'
                },
                {
                    id: '2',
                    status: 'failed',
                    executor: '李四',
                    time: new Date(Date.now() - 172800000).toISOString(),
                    comment: '登录按钮无响应'
                },
                {
                    id: '3',
                    status: 'passed',
                    executor: '王五',
                    time: new Date(Date.now() - 259200000).toISOString(),
                    comment: '初次测试通过'
                }
            ]);
        } catch (error) {
            console.error('加载执行日志失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: ExecutionStatus) => {
        switch (status) {
            case 'passed':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'blocked':
                return <AlertCircle className="w-5 h-5 text-orange-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusTag = (status: ExecutionStatus) => {
        switch (status) {
            case 'passed':
                return <Tag color="success">通过</Tag>;
            case 'failed':
                return <Tag color="error">失败</Tag>;
            case 'blocked':
                return <Tag color="warning">受阻</Tag>;
            default:
                return <Tag color="default">未执行</Tag>;
        }
    };

    const getStatusColor = (status: ExecutionStatus) => {
        switch (status) {
            case 'passed': return 'green';
            case 'failed': return 'red';
            case 'blocked': return 'orange';
            default: return 'gray';
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-bold">执行记录日志</span>
                </div>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={700}
            className="execution-log-modal"
        >
            <div className="py-4">
                {loading ? (
                    <div className="text-center py-12">
                        <Spin size="large" />
                        <p className="text-gray-500 mt-4">加载执行日志中...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <Empty
                        description="暂无执行记录"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : (
                    <Timeline
                        items={logs.map(log => ({
                            dot: getStatusIcon(log.status),
                            color: getStatusColor(log.status),
                            children: (
                                <div className="pb-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        {getStatusTag(log.status)}
                                        <span className="text-sm text-gray-500">
                                            {new Date(log.time).toLocaleString('zh-CN')}
                                        </span>
                                        <span className="text-sm font-medium text-gray-700">
                                            执行人: {log.executor}
                                        </span>
                                    </div>
                                    {log.comment && (
                                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                {log.comment}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        }))}
                    />
                )}
            </div>
        </Modal>
    );
};
