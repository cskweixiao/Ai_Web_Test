export type ExecutionStatus = 'pending' | 'passed' | 'failed' | 'blocked';

export interface ExecutionLog {
    id: string;
    status: ExecutionStatus;
    executor: string;
    time: string;
    comment?: string;
}

export interface TestCaseItem {
    id: number;
    name: string;
    description?: string;
    system: string;
    module: string;
    priority: string;
    status: string;
    executionStatus: ExecutionStatus;
    lastRun?: string;
    logs: ExecutionLog[];
    created_at: string;
    users?: {
        username: string;
    };
}

export interface TestPointGroup {
    id: number;
    test_point_index: number;
    test_point_name: string;
    test_purpose?: string;
    steps: string;
    expected_result: string;
    risk_level: string;
    testCases: TestCaseItem[];
    progress: number; // 0-100
}

export interface TestScenarioGroup {
    id: string;
    name: string;
    description?: string;
    testPoints: TestPointGroup[];
    progress: number; // 0-100
}

export interface FilterState {
    search: string;
    system: string;
    module: string;
    source: string;
    priority: string;
    status: string;
    tag: string;
    sectionName: string;
    createdBy: string;
    startDate: string;
    endDate: string;
    riskLevel: string;
}

// 视图模式类型
export type ViewMode = 'card' | 'table' | 'kanban' | 'timeline';

// 视图组件通用属性
export interface ViewProps {
    testCases: any[];
    organizedData: TestScenarioGroup[];
    loading: boolean;
    selectedPoints: Set<number>;
    onToggleSelectPoint: (pointId: number) => void;
    onEditCase: (id: number) => void;
    onDeleteCase: (id: number, name: string) => void;
    onEditPoint: (point: TestPointGroup) => void;
    onDeletePoint: (pointId: number, pointName: string) => void;
    onUpdateExecutionStatus: (caseId: number, status: ExecutionStatus) => void;
    onViewLogs: (caseId: number) => void;
}
