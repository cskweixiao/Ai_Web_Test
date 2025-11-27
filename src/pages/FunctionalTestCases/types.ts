export interface TestPointItem {
    id: number;
    test_point_index: number;
    test_point_name: string;
    test_purpose?: string;
    steps: string;
    expected_result: string;
    risk_level: string;
}

export interface TestCaseGroup {
    id: number;
    name: string;
    description?: string;
    system: string;
    module: string;
    priority: string;
    status: string;
    sectionName?: string;
    created_at: string;
    users?: {
        username: string;
    };
    testPoints: TestPointItem[];
}

export interface TestScenarioGroup {
    name: string;
    testCases: TestCaseGroup[];
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
    onEditPoint: (point: TestPointItem) => void;
    onDeletePoint: (pointId: number, pointName: string) => void;
}
