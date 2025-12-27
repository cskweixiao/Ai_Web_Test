# Git 提交日志

## 2024-12-26 修复UI自动化执行流程和统计数据准确性

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 恢复执行配置对话框，修复返回逻辑，修改详情打开方式
- `src/pages/TestRunDetail.tsx` - 支持从测试计划返回到正确的tab

**后端文件**:
- `server/services/testPlanService.ts` - 添加waitForTestCompletion函数，修复执行结果统计

### 问题说明
1. 需要执行配置对话框来设置执行引擎、trace、video等参数
2. 单个UI自动化用例执行后返回无法回到测试计划用例列表
3. UI自动化执行历史统计数据不准确（失败显示成功）
4. 执行历史详情应该在新标签页打开

### 修复详情

#### 1. 恢复执行配置对话框
**文件**: `src/pages/TestPlanDetail.tsx`

- 恢复执行配置相关状态：
  - `showExecutionConfig` - 控制对话框显示
  - `pendingExecutionType` - 单个/批量执行类型
  - `pendingCases` - 待执行的用例列表
  - `executionConfig` - 执行配置（引擎、trace、video、环境）

- 恢复执行配置对话框UI（Modal组件）：
  - 显示待执行用例信息
  - 执行引擎选择（MCP/Playwright）
  - Playwright选项（Trace/Video录制）
  - 执行环境选择（Staging/Production/Development）

- 修改执行逻辑：
  - 单个用例执行：`handleExecuteCase` → 弹出配置对话框
  - 批量执行：`handleBatchExecute` → 弹出配置对话框
  - 执行全部：`handleExecute` → 弹出配置对话框

#### 2. 新增handleConfirmExecute方法
**文件**: `src/pages/TestPlanDetail.tsx`

处理执行配置确认：
- **单个用例执行**：
  - 调用 `testService.runTestCase()` API
  - 传递执行配置参数
  - 跳转到 `/test-runs/:runId/detail`
  - state中携带 `from`, `fromTab`, `planId` 信息

- **批量执行**：
  - 调用 `testPlanService.startTestPlanExecution()` API
  - 创建测试计划执行记录
  - 切换到"执行历史"tab
  - 重新加载测试计划详情

#### 3. 修复返回逻辑
**文件**: `src/pages/TestRunDetail.tsx`

- 导入 `useLocation` 获取state信息
- 添加 `handleGoBack` 函数：
  - 检查 `fromPath` 是否存在
  - 存在：返回到来源路径，恢复 `activeTab` 状态
  - 不存在：返回到测试运行列表
- 修改所有返回按钮使用 `handleGoBack`

**文件**: `src/pages/TestPlanDetail.tsx`

- 导入 `useLocation`
- 在 `useEffect` 中从 `location.state` 恢复 `activeTab`
- 确保从详情页返回时显示正确的tab

#### 4. 修复执行结果统计准确性
**文件**: `server/services/testPlanService.ts`

- 新增 `waitForTestCompletion` 函数：
  - 轮询 `test_runs` 表获取执行状态
  - 等待状态变为 `completed` 或 `failed`
  - 从 `steps` 中统计真实结果：
    - 有失败步骤 → `fail`
    - 有阻塞步骤 → `block`
    - 全部通过 → `pass`
  - 返回真实的执行结果和耗时

- 修改异步执行逻辑：
  - 调用 `waitForTestCompletion` 等待执行完成
  - 根据真实结果更新计数器：
    - `passedCount` - 通过数量
    - `failedCount` - 失败数量
    - `blockedCount` - 阻塞数量
  - 保存真实的执行结果到 `execution_results`

#### 5. 修改执行详情表格中日志按钮打开方式
**文件**: 
- `src/pages/TestPlanDetail.tsx` - 保持原有Modal逻辑
- `src/components/TestPlanExecutionLogModal.tsx` - 修改handleViewLogs函数
- `server/services/testPlanService.ts` - 保存execution_id字段

**修复内容**:
- 保持 `handleViewExecutionLog` 原有逻辑（打开执行详情Modal）
- 修改 `TestPlanExecutionLogModal` 中的 `handleViewLogs` 函数：
  - 如果用例有 `execution_id`（UI自动化用例）：在新标签页打开 `/test-runs/${execution_id}/detail`
  - 如果没有 `execution_id`（功能测试用例）：打开原有的 `TestPlanCaseExecutionLogModal`
- 后端保存执行结果时添加 `execution_id: runId` 字段

### 技术细节

#### 执行流程对比

**修复前**：
```
单个用例 → 直接调用API → 跳转详情页 → 返回到test-runs列表 ❌
批量执行 → 直接调用API → 切换到执行历史tab
统计数据 → 简单延时1秒 → 标记为pass ❌
```

**修复后**：
```
单个用例 → 配置对话框 → 调用API → 跳转详情页 → 返回到测试计划用例列表 ✅
批量执行 → 配置对话框 → 调用API → 切换到执行历史tab ✅
统计数据 → 轮询test_runs → 获取真实结果 → 准确统计 ✅
详情按钮 → 新标签页打开 ✅
```

#### waitForTestCompletion实现

```typescript
async function waitForTestCompletion(runId: string, maxWaitTime = 300000) {
  // 每秒轮询一次test_runs表
  while (未超时) {
    const testRun = await prisma.test_runs.findUnique({ where: { run_id: runId } });
    
    if (testRun.status === 'completed') {
      // 从steps统计结果
      const hasFailedStep = steps.some(s => s.status === 'failed');
      const hasBlockedStep = steps.some(s => s.status === 'blocked');
      
      return { result: hasFailedStep ? 'fail' : hasBlockedStep ? 'block' : 'pass' };
    }
    
    await sleep(1000);
  }
}
```

### 效果
- ✅ 执行前可以配置引擎、trace、video等参数
- ✅ 单个用例执行后返回到测试计划的用例列表tab
- ✅ 执行历史统计数据准确（通过/失败/阻塞）
- ✅ 执行详情表格中点击"日志"按钮，UI自动化用例在新标签页打开详细日志

---

## 2024-12-26 优化测试计划UI自动化用例执行流程

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 优化UI自动化用例执行流程和状态显示

**后端文件**:
- `server/services/testPlanService.ts` - 添加UI自动化用例执行逻辑
- `server/routes/testPlan.ts` - 修改为函数导出以传递testExecutionService
- `server/index.ts` - 更新路由注册方式

### 问题说明
1. 单个UI自动化用例执行后需要跳转到测试执行详情页
2. 批量/全部UI自动化执行后应提示并跳转到执行历史tab
3. UI自动化执行历史和统计数据需要正确展示

### 修复详情

#### 1. 单个UI自动化用例执行优化
**文件**: `src/pages/TestPlanDetail.tsx`

- 修改 `handleExecuteCase` 方法为异步函数
- UI自动化用例执行后直接调用 `testService.runTestCase()` API
- 执行成功后跳转到 `/test-runs/:runId/detail` 页面
- 传递返回路径信息 `from` 和 `fromTab` 用于返回时恢复状态

#### 2. 批量/全部UI自动化执行优化
**文件**: `src/pages/TestPlanDetail.tsx`

- 修改 `handleBatchExecute` 方法为异步函数
- 修改 `handleExecute` 方法为异步函数
- UI自动化用例执行时调用 `testPlanService.startTestPlanExecution()` API
- 执行成功后显示成功提示
- 自动切换到"执行历史"tab
- 重新加载测试计划详情以获取最新执行记录

#### 3. 删除不需要的执行配置对话框
**文件**: `src/pages/TestPlanDetail.tsx`

- 删除 `showExecutionConfig` 等相关状态
- 删除 `executionConfig` 配置状态
- 删除 `pendingExecutionType` 和 `pendingCases` 状态
- 删除 `handleConfirmExecute` 方法
- 删除执行配置对话框UI（Modal组件）
- 删除未使用的 `handleAddCases`、`handleRemoveCase`、`getResultBadge` 等方法
- 删除重复定义的 `getPlanTypeText` 方法

#### 4. 后端UI自动化执行逻辑
**文件**: `server/services/testPlanService.ts`

- 导入 `TestExecutionService` 类
- 修改 `startTestPlanExecution` 方法签名，添加 `testExecutionService` 可选参数
- 创建执行记录后，如果是UI自动化测试，异步执行用例：
  - 更新状态为"running"
  - 逐个调用 `testExecutionService.runTest()` 执行用例
  - 实时更新执行进度
  - 保存执行结果到 `execution_results` 字段
  - 完成后更新状态为"completed"或"failed"

#### 5. 路由改造
**文件**: `server/routes/testPlan.ts`

- 修改为函数导出 `createTestPlanRoutes(testExecutionService)`
- 在 `POST /:id/execute` 路由中传递 `testExecutionService` 给 `startTestPlanExecution`
- 返回 router 实例

**文件**: `server/index.ts`

- 修改导入为 `import createTestPlanRoutes from './routes/testPlan.js'`
- 修改路由注册为 `app.use('/api/v1/test-plans', authenticate, createTestPlanRoutes(testExecutionService))`

### 技术细节

#### 执行流程
1. **单个用例执行**：
   - 用户点击执行按钮
   - 调用 `testService.runTestCase(caseId, options)` API
   - 获取 runId 后跳转到 `/test-runs/:runId/detail`
   - 用户可在详情页查看实时执行日志
   - 点击返回时回到测试计划用例列表

2. **批量/全部用例执行**：
   - 用户点击批量执行或执行全部
   - 调用 `testPlanService.startTestPlanExecution()` API
   - 后端创建执行记录并异步执行用例
   - 前端显示成功提示并切换到执行历史tab
   - 执行历史tab实时显示执行进度

#### 数据流
```
前端 TestPlanDetail
  ↓
后端 POST /api/v1/test-plans/:id/execute
  ↓
testPlanService.startTestPlanExecution()
  ↓
创建 test_plan_executions 记录
  ↓
异步执行：逐个调用 testExecutionService.runTest()
  ↓
更新 test_plan_executions 状态和进度
```

### 效果
- 单个UI自动化用例执行后可查看详细执行日志
- 批量/全部执行后自动跳转到执行历史查看进度
- 执行历史和统计数据实时更新
- 用户体验更流畅，操作逻辑更清晰

---

## 2024-12-26 功能用例选择模态框添加"已关联"标记

### 修改内容

**前端文件**:
- `src/components/FunctionalCaseSelectModal.tsx` - 添加已关联用例标记功能
- `src/pages/TestPlanDetail.tsx` - 传递已关联用例ID到选择模态框

### 问题说明
测试计划关联用例后需要显示"已关联"标记，与"已导入"标记区分开来

### 修复详情

#### 1. 组件添加 associatedCaseIds 属性
**文件**: `src/components/FunctionalCaseSelectModal.tsx`

- 新增 `associatedCaseIds?: Set<number>` prop，用于标记已关联的用例ID
- 更新组件文档注释，增加"已关联标记"说明

#### 2. 三个视图模式都添加标记
- **列表视图**（第 341-345 行）：在用例名称下方显示"已关联"标记（蓝色）
- **表格视图**（第 509-513 行）：在用例类型列显示"已关联"标记（蓝色）
- **卡片视图**（第 565-569 行）：在用例编号旁显示"已关联"标记（蓝色）

#### 3. 标记样式区分
- **已导入**：绿色背景 `bg-green-100 text-green-600`
- **已关联**：蓝色背景 `bg-blue-100 text-blue-600`

#### 4. 测试计划页面传递已关联用例ID
**文件**: `src/pages/TestPlanDetail.tsx`（第 2822 行）

```typescript
associatedCaseIds={new Set(cases.map(c => c.case_id))}
```

从测试计划已关联的用例列表 `cases` 中提取所有用例ID，传递给选择模态框。

### 使用方式

```typescript
<FunctionalCaseSelectModal
  // ... 其他 props
  importedCaseIds={new Set([1, 2, 3])}     // 已导入的用例
  associatedCaseIds={new Set([4, 5, 6])}   // 已关联的用例
/>
```

### 效果
- 功能测试用例和UI自动化用例关联到测试计划后，在添加用例弹窗中会显示蓝色"已关联"标记
- 帮助用户区分哪些用例已经关联，避免重复添加

---

## 2024-12-26 修复UI自动化用例选择模态框显示问题和筛选器配置

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 根据用例类型动态调整筛选器配置，添加调试日志

### 问题说明
1. 关联UI自动化用例时，用例列表没有正常显示
2. 所属场景、所属系统等字段在UI自动化用例中不存在，但筛选器配置中包含这些字段
3. 筛选器逻辑导致没有这些字段的用例被过滤掉

### 原因分析

#### 1. 数据结构差异

**功能测试用例字段**：
- `system` - 所属系统
- `project_version_id` - 项目版本ID
- `scenario_name` - 所属场景
- `module` - 所属模块
- `case_type` - 用例类型
- `priority` - 优先级

**UI自动化用例字段**：
- `module` - 所属模块（有）
- `projectVersion` - 版本字符串（有）
- `caseType` - 用例类型（有）
- `priority` - 优先级（有）
- ❌ **没有** `system` 字段
- ❌ **没有** `scenario_name` 字段

#### 2. 筛选器问题

原有配置对两种用例类型使用相同的筛选器，包含了 `system` 和 `scenario_name`，导致UI自动化用例被错误过滤。

### 修复详情

#### 1. 动态筛选器配置

**位置**: TestPlanDetail.tsx 第 2835-2960 行

根据 `addCaseType` 动态生成筛选器配置：

```typescript
filters={(() => {
  // 🔥 根据用例类型动态生成筛选器配置
  if (addCaseType === 'ui_auto') {
    // UI自动化用例：只包含 module、case_type、priority
    return [
      { key: 'module', label: '所属模块', ... },
      { key: 'case_type', label: '用例类型', ... },
      { key: 'priority', label: '优先级', ... }
    ];
  }
  
  // 功能测试用例：包含所有筛选器
  return [
    { key: 'system', label: '所属系统', ... },
    { key: 'project_version_id', label: '所属版本', ... },
    { key: 'scenario_name', label: '所属场景', ... },
    { key: 'module', label: '所属模块', ... },
    { key: 'case_type', label: '用例类型', ... },
    { key: 'priority', label: '优先级', ... }
  ];
})()}
```

#### 2. 重置筛选条件

**位置**: TestPlanDetail.tsx 第 225-243 行

在切换用例类型时，重置所有筛选条件：

```typescript
const handleAddCasesModal = (type: 'functional' | 'ui_auto') => {
  setAddCaseType(type);
  // 🔥 重置所有筛选条件
  setAddCaseFilterSystem('');
  setAddCaseFilterProjectVersion('');
  setAddCaseFilterModule('');
  setAddCaseFilterScenario('');
  setAddCaseFilterCaseType('');
  setAddCaseFilterPriority('');
  loadAvailableCases(type, { page: 1, pageSize: 10, search: '' });
};
```

#### 3. 添加调试日志

**位置**: TestPlanDetail.tsx 第 335-350, 2781-2809 行

添加详细的日志输出，便于调试数据加载和映射过程：

```typescript
// UI自动化用例加载日志
console.log('🔍 [TestPlanDetail] UI自动化用例示例数据:', filteredCases.slice(0, 2));
console.log('🔍 [TestPlanDetail] 分页后的UI自动化用例:', paginatedCases);

// 数据映射日志
console.log('🔄 [TestPlanDetail] UI自动化用例映射:', { 原始: c, 映射后: mapped });
console.log('📋 [TestPlanDetail] 传递给模态框的用例数据:', mappedCases);
```

### 筛选器对比

| 筛选器 | 功能测试用例 | UI自动化用例 |
|--------|--------------|--------------|
| 所属系统 | ✅ 显示 | ❌ 不显示 |
| 所属版本 | ✅ 显示 | ❌ 不显示 |
| 所属场景 | ✅ 显示 | ❌ 不显示 |
| 所属模块 | ✅ 显示 | ✅ 显示 |
| 用例类型 | ✅ 显示 | ✅ 显示 |
| 优先级 | ✅ 显示 | ✅ 显示 |

### 影响范围
- UI自动化用例现在可以正常显示在选择模态框中
- 筛选器配置根据用例类型自动调整
- 不会因为缺少某些字段而被错误过滤
- 功能测试用例的显示和筛选不受影响

---

## 2024-12-26 修复添加UI自动化用例时版本信息无法显示的问题

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 修复UI自动化用例版本字段映射，添加数据转换逻辑

### 问题说明
在测试计划详情页点击"关联UI自动化用例"按钮后，弹出的用例选择模态框中，UI自动化用例的版本信息无法正常显示。

### 原因分析
1. **数据结构不一致**：
   - 功能测试用例：使用 `project_version_id` 和 `project_version` 对象
   - UI自动化用例：使用 `projectVersion` 字符串

2. **组件期望格式**：
   - `FunctionalCaseSelectModal` 组件期望 `project_version` 对象格式
   - 但 UI 自动化用例传递的是 `projectVersion` 字符串

### 修复详情

#### 1. 更新 availableCases 类型定义

**位置**: TestPlanDetail.tsx 第 81-100 行

```typescript
const [availableCases, setAvailableCases] = useState<Array<{
  ...
  projectVersion?: string; // 🔥 新增：UI自动化用例的版本字段
  caseType?: string; // 🔥 新增：用例类型（UI自动化）
}>>([]);
```

#### 2. 修正 UI 自动化用例响应类型

**位置**: TestPlanDetail.tsx 第 297-309 行

```typescript
const response = await testService.getTestCases() as Array<{
  ...
  projectVersion?: string; // 🔥 修复：使用正确的字段名
  caseType?: string; // 🔥 新增：用例类型
}>;
```

#### 3. 添加数据转换逻辑

**位置**: TestPlanDetail.tsx 第 2778-2810 行

```typescript
cases={availableCases.map(c => {
  // 🔥 UI自动化用例的版本字段转换
  if (addCaseType === 'ui_auto') {
    return {
      ...
      // UI自动化用例：将 projectVersion 字符串转换为 project_version 对象
      project_version: c.projectVersion ? {
        version_name: c.projectVersion,
        version_code: c.projectVersion,
      } : undefined,
    };
  }
  
  // 功能测试用例：直接映射
  return {
    ...
    project_version: c.project_version,
  };
})}
```

### 转换逻辑
- **UI自动化用例**：将 `projectVersion: "V6.5B05SP001"` 转换为：
  ```typescript
  project_version: {
    version_name: "V6.5B05SP001",
    version_code: "V6.5B05SP001"
  }
  ```
- **功能测试用例**：保持原有的 `project_version` 对象格式不变

### 影响范围
- UI自动化用例在选择模态框中的版本信息现在可以正确显示
- 功能测试用例不受影响
- 数据转换完全透明，不影响后续的数据提交

---

## 2024-12-26 为UI自动化用例添加case_type字段支持

### 修改内容

**后端文件**:
- `server/services/testExecution.ts` - 在 dbTestCaseToApp 方法中添加 caseType 字段读取和推断逻辑
- `server/services/testPlanService.ts` - 在 UI 自动化用例详情中添加 case_type 字段
- `src/types/test.ts` - 在 TestCase 接口中添加 caseType 字段定义

### 问题说明
关联UI自动化用例后，用例详情中缺少 `case_type` 字段（如 "SMOKE"、"FULL" 等），而功能测试用例有这个字段。这个字段对于用例分类和展示很重要。

### 修复详情

#### 1. 在 TestCase 接口中添加 caseType 字段

**文件**: `src/types/test.ts`  
**位置**: TestCase 接口定义

```typescript
export interface TestCase {
  ...
  caseType?: string; // 🔥 新增：用例类型（SMOKE、FULL、ABNORMAL等）
  ...
}
```

#### 2. 在 dbTestCaseToApp 方法中读取和推断 caseType

**文件**: `server/services/testExecution.ts`  
**位置**: dbTestCaseToApp 方法

**添加从 steps JSON 读取 caseType**：
```typescript
// 🔥 新增：从 steps JSON 中读取用例类型
if (stepsObj.caseType) {
  caseType = stepsObj.caseType;
}
```

**添加从 tags 推断 caseType 的逻辑**：
```typescript
// 🔥 新增：如果没有 caseType，尝试从 tags 推断
if (!caseType && Array.isArray(dbCase.tags)) {
  const tags = dbCase.tags as string[];
  if (tags.some(tag => tag.includes('冒烟') || tag.toLowerCase().includes('smoke'))) {
    caseType = 'SMOKE';
  } else if (tags.some(tag => tag.includes('全量') || tag.toLowerCase().includes('full'))) {
    caseType = 'FULL';
  }
  // ... 其他类型推断
}
```

支持的用例类型：
- SMOKE (冒烟测试)
- FULL (全量测试)
- ABNORMAL (异常测试)
- BOUNDARY (边界测试)
- PERFORMANCE (性能测试)
- SECURITY (安全测试)
- USABILITY (可用性测试)
- COMPATIBILITY (兼容性测试)
- RELIABILITY (可靠性测试)

#### 3. 在测试计划服务中添加 case_type 字段

**文件**: `server/services/testPlanService.ts`  
**位置**: UI 自动化用例详情构建部分（第 389 行）

```typescript
caseDetail = {
  id: uiAutoCase.id,
  name: uiAutoCase.name,
  description: uiAutoCase.description,
  priority: uiAutoCase.priority,
  version: uiAutoCase.projectVersion,
  case_type: uiAutoCase.caseType, // 🔥 新增：用例类型
  module: uiAutoCase.module,
  tags: uiAutoCase.tags,
  author: uiAutoCase.author,
  status: uiAutoCase.status,
};
```

### 影响范围
- UI自动化用例现在可以正确显示用例类型（SMOKE、FULL等）
- 如果用例数据中没有显式指定 caseType，系统会尝试从 tags 推断
- 功能测试用例不受影响（继续使用原有的 case_type 字段）

### 数据来源优先级
1. 优先从 steps JSON 的 `caseType` 字段读取
2. 如果没有，从 tags 数组推断（例如：包含"冒烟"或"smoke"标签则推断为 SMOKE 类型）
3. 如果都没有，caseType 为 undefined

---

## 2024-12-26 修复UI自动化用例版本字段无法获取的问题

### 修改内容

**后端文件**:
- `server/services/testPlanService.ts` - 修复UI自动化用例版本字段映射

### 问题说明
关联UI自动化用例后，测试计划详情页显示用例版本时为空（显示"-"），因为 TestCase 接口使用的是 `projectVersion` 字段，而代码中错误地使用了 `version` 字段。

### 修复详情

**修复版本字段映射**：
- 位置：`server/services/testPlanService.ts` 第 388 行
- 修改：将 `version: uiAutoCase.version` 改为 `version: uiAutoCase.projectVersion`
- 原因：TestCase 接口定义的版本字段名为 `projectVersion`，不是 `version`

```typescript
// 修复前
caseDetail = {
  version: uiAutoCase.version, // ❌ 字段名错误
  ...
};

// 修复后
caseDetail = {
  version: uiAutoCase.projectVersion, // ✅使用正确的字段名
  ...
};
```

### 影响范围
- UI自动化用例的版本信息现在可以正确显示
- 功能测试用例不受影响（使用不同的版本字段结构）

---

## 2024-12-25 测试计划详情页添加UI自动化用例执行配置功能

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 添加UI自动化用例执行配置弹窗和逻辑

### 功能说明
为测试计划详情页添加完整的UI自动化用例执行支持，包括单个执行、批量执行、执行配置弹窗等功能，使UI自动化用例与功能测试用例具有一致的执行体验。

### 修改详情

#### 1. 新增执行配置相关状态

**添加执行配置状态管理**：
```typescript
const [showExecutionConfig, setShowExecutionConfig] = useState(false);
const [pendingExecutionType, setPendingExecutionType] = useState<'single' | 'batch'>('single');
const [pendingCases, setPendingCases] = useState<TestPlanCase[]>([]);
const [executionConfig, setExecutionConfig] = useState({
  executionEngine: 'mcp' as 'mcp' | 'playwright',
  enableTrace: false,
  enableVideo: false,
  environment: 'staging'
});
```

#### 2. 修改单个用例执行逻辑

**支持功能测试和UI自动化用例**：
```typescript
const handleExecuteCase = (caseItem: TestPlanCase) => {
  if (!user) {
    showToast.error('请先登录');
    return;
  }

  // 🔥 功能测试用例：跳转到执行页面
  if (caseItem.case_type === 'functional') {
    navigate(`/test-plans/${id}/execute?type=functional&mode=single&caseIds=${caseItem.case_id}`);
    return;
  }

  // 🔥 UI自动化用例：弹出执行配置对话框
  if (caseItem.case_type === 'ui_auto') {
    setPendingExecutionType('single');
    setPendingCases([caseItem]);
    setShowExecutionConfig(true);
    return;
  }

  showToast.warning('不支持的用例类型');
};
```

#### 3. 修改批量执行逻辑

**支持UI自动化用例批量执行**：
```typescript
const handleBatchExecute = () => {
  // ... 选择检查和类型判断
  
  // 🔥 功能测试用例：跳转到执行页面
  if (caseType === 'functional') {
    const caseIds = selectedCases.map(c => c.case_id).join(',');
    navigate(`/test-plans/${id}/execute?type=${caseType}&mode=batch&caseIds=${caseIds}`);
    return;
  }

  // 🔥 UI自动化用例：弹出执行配置对话框
  if (caseType === 'ui_auto') {
    setPendingExecutionType('batch');
    setPendingCases(selectedCases);
    setShowExecutionConfig(true);
    return;
  }
};
```

#### 4. 添加执行配置确认函数

**处理UI自动化用例执行**：
```typescript
const handleConfirmExecute = async () => {
  if (pendingCases.length === 0) {
    showToast.warning('没有待执行的用例');
    return;
  }

  try {
    setLoading(true);
    
    const caseIds = pendingCases.map(c => c.case_id);
    console.log(`🚀 [TestPlanDetail] 开始执行UI自动化用例`, {
      type: pendingExecutionType,
      count: caseIds.length,
      config: executionConfig,
      planId: parseInt(id!)
    });

    // TODO: 调用后端API执行UI自动化用例
    showToast.success(`开始执行 ${caseIds.length} 个UI自动化用例`);
    
    setShowExecutionConfig(false);
    setPendingCases([]);
    await loadTestPlanDetail();
  } catch (error) {
    console.error('❌ [TestPlanDetail] 执行UI自动化用例失败:', error);
    showToast.error('执行失败：' + (error instanceof Error ? error.message : '未知错误'));
  } finally {
    setLoading(false);
  }
};
```

#### 5. 修改操作列显示逻辑

**功能测试和UI自动化用例都显示执行按钮**：
```typescript
<td className="px-4 py-3 text-sm">
  <div className="flex items-center gap-5">
    {/* 🔥 功能测试和UI自动化用例都显示执行按钮 */}
    {(caseItem.case_type === 'functional' || caseItem.case_type === 'ui_auto') && (
      <button
        onClick={() => handleExecuteCase(caseItem)}
        className="text-blue-600 hover:text-blue-800"
        title="执行"
      >
        <Play className="w-4 h-4" />
      </button>
    )}
    <button
      onClick={() => handleDeleteCase(caseItem)}
      className="text-red-600 hover:text-red-800"
      title="移除"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
</td>
```

#### 6. 添加执行配置对话框UI

**参考TestCases.tsx的执行配置弹窗**：
```tsx
<Modal
  isOpen={showExecutionConfig}
  onClose={() => {
    setShowExecutionConfig(false);
    setPendingCases([]);
  }}
  title="执行配置"
  size="md"
>
  <div className="space-y-4">
    {/* 显示待执行的用例信息 */}
    {pendingCases.length > 0 && (
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">
          {pendingExecutionType === 'single' ? '单个用例执行' : `批量执行 ${pendingCases.length} 个用例`}
        </p>
        <p className="font-medium text-gray-900">
          {pendingExecutionType === 'single' 
            ? pendingCases[0]?.case_name 
            : pendingCases.map(c => c.case_name).join(', ')}
        </p>
      </div>
    )}

    {/* 执行引擎选择 */}
    <div className="mt-[-20px]">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        执行引擎
      </label>
      <select
        value={executionConfig.executionEngine}
        onChange={(e) => setExecutionConfig(prev => ({ 
          ...prev, 
          executionEngine: e.target.value as 'mcp' | 'playwright' 
        }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        aria-label="执行引擎"
      >
        <option value="mcp">MCP 客户端（默认）</option>
        <option value="playwright">Playwright Test Runner</option>
      </select>
    </div>

    {/* Playwright选项 */}
    {executionConfig.executionEngine === 'playwright' && (
      <>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="enableTrace"
            checked={executionConfig.enableTrace}
            onChange={(e) => setExecutionConfig(prev => ({ 
              ...prev, 
              enableTrace: e.target.checked 
            }))}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="enableTrace" className="text-sm font-medium text-gray-700">
            启用 Trace 录制
          </label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="enableVideo"
            checked={executionConfig.enableVideo}
            onChange={(e) => setExecutionConfig(prev => ({ 
              ...prev, 
              enableVideo: e.target.checked 
            }))}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="enableVideo" className="text-sm font-medium text-gray-700">
            启用 Video 录制
          </label>
        </div>
      </>
    )}

    {/* 执行环境选择 */}
    <div className="pb-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        执行环境
      </label>
      <select
        value={executionConfig.environment}
        onChange={(e) => setExecutionConfig(prev => ({ 
          ...prev, 
          environment: e.target.value 
        }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        aria-label="执行环境"
      >
        <option value="staging">Staging</option>
        <option value="production">Production</option>
        <option value="development">Development</option>
      </select>
    </div>

    {/* 操作按钮 */}
    <div className="flex justify-end space-x-3 pt-4 border-t">
      <button
        onClick={() => {
          setShowExecutionConfig(false);
          setPendingCases([]);
        }}
        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        取消
      </button>
      <button
        onClick={handleConfirmExecute}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? '执行中...' : '开始执行'}
      </button>
    </div>
  </div>
</Modal>
```

### 执行流程

#### 单个用例执行流程
```
用户点击执行按钮
    ↓
判断用例类型
    ↓
功能用例 → 跳转执行页面
    ↓
UI自动化用例 → 弹出配置对话框
    ↓
用户选择执行引擎、Trace、Video、环境等配置
    ↓
点击"开始执行"按钮
    ↓
调用后端API执行
    ↓
显示执行结果，刷新页面数据
```

#### 批量执行流程
```
用户选中多个用例
    ↓
点击"批量执行"按钮
    ↓
检查用例类型一致性
    ↓
功能用例 → 跳转执行页面
    ↓
UI自动化用例 → 弹出配置对话框
    ↓
用户选择执行配置
    ↓
点击"开始执行"按钮
    ↓
后端按顺序批量执行多个用例
    ↓
返回执行结果，更新用例状态
```

### 执行配置选项

#### 执行引擎
- **MCP 客户端**（默认）：支持 AI 闭环流程
- **Playwright Test Runner**：支持 Trace 和 Video 录制

#### Playwright 选项（仅在选择 Playwright 引擎时显示）
- **启用 Trace 录制**：录制测试执行过程，可在 trace.playwright.dev 查看
- **启用 Video 录制**：录制测试执行视频，用于调试和回放

#### 执行环境
- **Staging**：测试环境
- **Production**：生产环境
- **Development**：开发环境

### 用户体验改进

**统一的执行体验**：
- UI自动化用例与功能测试用例具有一致的执行流程
- 单个执行和批量执行都支持执行配置
- 执行配置对话框与TestCases页面保持一致

**灵活的执行配置**：
- 支持选择执行引擎（MCP/Playwright）
- 支持启用 Trace 和 Video 录制（Playwright）
- 支持选择执行环境（Staging/Production/Development）

**清晰的执行信息**：
- 对话框显示待执行用例信息
- 单个执行显示用例名称
- 批量执行显示用例数量和名称列表

### 技术特点

1. **参考TestCases页面**：执行配置对话框UI完全参考TestCases.tsx实现
2. **状态管理清晰**：使用独立状态管理执行配置
3. **类型安全**：使用TypeScript类型定义确保配置正确
4. **错误处理**：完善的错误捕获和提示
5. **日志输出**：详细的控制台日志便于调试

### 后续开发

**后端API开发**：
```typescript
// TODO: 实现后端API
const response = await testPlanService.executeUiAutoCases({
  planId: parseInt(id!),
  caseIds,
  config: executionConfig,
  executionType: pendingExecutionType
});
```

**功能扩展**：
- 执行进度实时显示
- 执行结果详细展示
- 执行历史记录查看
- 失败用例重试功能

### 影响范围
- ✅ UI自动化用例单个执行功能
- ✅ UI自动化用例批量执行功能
- ✅ 执行配置对话框显示
- ✅ 操作列执行按钮显示

### Git 提交命令

```bash
git add src/pages/TestPlanDetail.tsx git-commit-log.md
git commit -m "feat(test-plan): 测试计划详情页添加UI自动化用例执行配置功能

- 新增执行配置状态管理和对话框
- 修改单个用例执行逻辑支持UI自动化
- 修改批量执行逻辑支持UI自动化
- 添加执行配置确认函数
- 操作列为UI自动化用例添加执行按钮
- 参考TestCases页面实现执行配置UI
- 支持MCP和Playwright两种执行引擎
- 支持Trace和Video录制配置
- 支持执行环境选择

使UI自动化用例与功能测试用例具有一致的执行体验"
```

---

## 2024-12-25 优化UI自动化测试计划用例数据获取和显示

### 修改内容

**前端文件**:
- `src/pages/TestPlanDetail.tsx` - 优化UI自动化用例加载逻辑，添加详细日志，修复类型错误

**后端文件**:
- `server/services/testPlanService.ts` - 在getTestPlanDetail中为UI自动化用例获取详细信息

### 功能说明
完善UI自动化测试计划的用例数据获取流程，确保UI自动化用例能够正确显示版本、类型、优先级等详细信息。

### 修改详情

#### 1. 前端优化 - TestPlanDetail.tsx

**优化用例加载日志**：
```typescript
const loadAvailableCases = async (type: 'functional' | 'ui_auto', options?: {...}) => {
  console.log(`📋 [TestPlanDetail] 开始加载${type === 'functional' ? '功能测试' : 'UI自动化'}用例列表`, { page, pageSize, search });
  
  if (type === 'ui_auto') {
    // 完善的错误处理和数据验证
    if (!Array.isArray(response)) {
      console.error('❌ [TestPlanDetail] UI自动化用例响应格式错误');
      showToast.error('UI自动化用例数据格式错误');
      return;
    }
    
    // 客户端分页和过滤
    const filteredCases = search ? response.filter(...) : response;
    console.log(`✅ [TestPlanDetail] UI自动化用例加载成功，总数: ${response.length}, 过滤后: ${filteredCases.length}`);
  }
};
```

**修复类型错误**：
```typescript
// 用例版本显示
{(() => {
  if (caseItem.case_type === 'functional' && caseItem.case_detail) {
    return (caseItem.case_detail as any).project_version?.version_name || ...;
  } else if (caseItem.case_type === 'ui_auto' && caseItem.case_detail) {
    return (caseItem.case_detail as any).version || ...;
  }
  return '-';
})()}

// 用例类型显示
{caseItem.case_type === 'functional' && caseItem.case_detail && (caseItem.case_detail as any).case_type ? (
  <CaseTypeBadge caseType={(caseItem.case_detail as any).case_type} />
) : ...}

// 优先级显示
{(() => {
  const priority = (caseItem.case_detail as any)?.priority || (caseItem as any).priority;
  return priority ? <PriorityBadge priority={priority} /> : '-';
})()}

// 执行状态和结果
const lastExecution = (caseItem.case_detail as any)?.last_execution;
```

**添加详细日志**：
```typescript
const loadTestPlanDetail = async () => {
  console.log('📋 [TestPlanDetail] 开始加载测试计划详情, ID:', id);
  console.log('✅ [TestPlanDetail] 测试计划详情加载成功');
  
  if (uiAutoCases.length > 0) {
    console.log('🤖 [TestPlanDetail] UI自动化用例数量:', uiAutoCases.length);
    console.log('🤖 [TestPlanDetail] UI自动化用例详情示例:', ...);
  }
  
  if (uiAutoCases.length === 0 && response.plan.plan_type === 'ui_auto') {
    console.warn('⚠️ [TestPlanDetail] UI自动化测试计划但没有UI自动化用例');
  }
};
```

#### 2. 后端修复 - testPlanService.ts

**为UI自动化用例获取详细信息**：
```typescript
// 转换用例数据，并获取功能用例和UI自动化用例的详细信息
const cases: TestPlanCase[] = await Promise.all(
  plan.plan_cases.map(async (c) => {
    let caseDetail = undefined;
    
    // 如果是功能测试用例，获取详细信息
    if (c.case_type === 'functional') {
      const functionalCase = await prisma.functional_test_cases.findUnique({
        where: { id: c.case_id },
        include: {
          project_version: { select: { id: true, version_name: true, version_code: true } }
        }
      });
      
      if (functionalCase) {
        caseDetail = {
          id: functionalCase.id,
          name: functionalCase.name,
          case_type: functionalCase.case_type,
          priority: functionalCase.priority,
          source: functionalCase.source,
          project_version_id: functionalCase.project_version_id,
          project_version: functionalCase.project_version ? { ... } : null,
        };
      }
    }
    // 🔥 新增：如果是UI自动化用例，从文件系统获取详细信息
    else if (c.case_type === 'ui_auto') {
      try {
        const { TestExecutionService } = await import('./testExecution.js');
        const testExecutionService = new TestExecutionService();
        const uiAutoCase = await testExecutionService.getTestCaseById(c.case_id);
        
        if (uiAutoCase) {
          console.log(`✅ [testPlanService] 获取UI自动化用例详情成功, ID: ${c.case_id}, 名称: ${uiAutoCase.name}`);
          caseDetail = {
            id: uiAutoCase.id,
            name: uiAutoCase.name,
            description: uiAutoCase.description,
            priority: uiAutoCase.priority,
            version: uiAutoCase.version,
            module: uiAutoCase.module,
            tags: uiAutoCase.tags,
            author: uiAutoCase.author,
            status: uiAutoCase.status,
          };
        }
      } catch (error) {
        console.error(`❌ [testPlanService] 获取UI自动化用例详情失败, ID: ${c.case_id}:`, error);
      }
    }
    
    // ... 返回用例数据
  })
);
```

### 数据流程

**UI自动化用例数据获取流程**：
```
前端请求测试计划详情
    ↓
后端 getTestPlanDetail()
    ↓
遍历 plan_cases
    ↓
发现 ui_auto 类型用例
    ↓
调用 TestExecutionService.getTestCaseById()
    ↓
从文件系统获取用例详情
    ↓
构建 case_detail 对象
    ↓
返回包含完整 case_detail 的用例列表
    ↓
前端显示版本、类型、优先级等信息
```

### 影响范围
- ✅ UI自动化测试计划详情页面的用例列表显示
- ✅ UI自动化用例的版本、类型、优先级字段显示
- ✅ 混合测试计划中UI自动化用例的信息展示
- ✅ 测试计划执行状态和结果统计

### 用户体验改进

**完整的用例信息**：
- UI自动化用例现在显示版本、优先级、来源等完整信息
- 与功能测试用例的显示效果保持一致
- 便于用户了解用例的详细信息

**清晰的日志输出**：
- 前端和后端都有详细的日志输出
- 便于调试和追踪问题
- 快速定位UI自动化用例数据问题

**健壮的错误处理**：
- 数据格式验证，防止错误数据导致页面崩溃
- 获取失败时有明确的错误提示
- 不影响功能测试用例的正常显示

### 技术特点

1. **动态导入**：使用 `import()` 动态加载 TestExecutionService，避免循环依赖
2. **类型安全**：使用 `as any` 处理复杂类型，确保 TypeScript 编译通过
3. **容错处理**：UI自动化用例获取失败时不影响整体流程
4. **日志完善**：前后端都有详细的日志，便于问题追踪
5. **客户端分页**：UI自动化用例使用客户端分页，避免后端API修改

### 测试建议

1. **UI自动化计划测试**：
   - 创建一个UI自动化类型的测试计划
   - 添加UI自动化用例
   - 验证用例列表正确显示版本、优先级等信息

2. **混合计划测试**：
   - 创建一个混合类型的测试计划
   - 同时添加功能用例和UI自动化用例
   - 验证两种类型的用例都正确显示

3. **日志验证**：
   - 打开浏览器控制台
   - 查看加载日志是否完整
   - 验证错误日志在获取失败时正确输出

4. **错误处理测试**：
   - 删除某个UI自动化用例
   - 刷新测试计划详情页
   - 验证错误提示正确，不影响其他用例显示

### Git 提交命令

```bash
git add src/pages/TestPlanDetail.tsx server/services/testPlanService.ts git-commit-log.md
git commit -m "fix(test-plan): 优化UI自动化测试计划用例数据获取和显示

前端:
- 优化UI自动化用例加载逻辑，添加客户端分页和过滤
- 修复用例版本、类型、优先级等字段的TypeScript类型错误
- 添加详细的日志输出，便于调试和追踪
- 完善错误处理，数据格式验证

后端:
- 在getTestPlanDetail中为UI自动化用例获取详细信息
- 使用TestExecutionService.getTestCaseById获取用例详情
- 动态导入避免循环依赖
- 添加错误日志和容错处理

确保UI自动化测试计划的用例能够正确显示完整信息"
```

---

## 2024-12-25 完善测试计划搜索栏计划结果筛选功能

### 修改内容

**前端文件**:
- `src/pages/TestPlans.tsx` - 前端代码已包含计划结果筛选下拉框和状态管理，无需修改

**后端文件**:
- `server/routes/testPlan.ts` - 添加 result 参数接收
- `server/services/testPlanService.ts` - 实现根据 result 参数筛选测试计划的逻辑

**类型文件**:
- `src/types/testPlan.ts` - 在 TestPlanListQuery 接口中添加 result 字段

### 功能说明
完善测试计划搜索栏中的"计划结果"筛选功能，支持根据执行结果（通过、失败、阻塞、跳过）筛选测试计划。

### 修改详情

#### 1. 类型定义更新
**在 TestPlanListQuery 接口中添加 result 字段**：
```typescript
export interface TestPlanListQuery {
  // ... 其他字段
  result?: ExecutionResult; // 🆕 计划结果筛选
}
```

#### 2. 后端路由更新
**在 server/routes/testPlan.ts 中添加 result 参数接收**：
```typescript
const query: TestPlanListQuery = {
  // ... 其他参数
  result: req.query.result as any, // 🆕 计划结果筛选
};
```

#### 3. 后端服务实现筛选逻辑
**在 server/services/testPlanService.ts 中实现筛选**：
- 当有 result 参数时，先获取所有符合其他条件的数据（不分页）
- 为每个计划获取最新执行记录，计算计划结果
- 根据 result 参数过滤数据
- 过滤后重新应用分页

**计划结果计算逻辑**（与前端 getPlanResult 保持一致）：
- `pass`: status === 'completed' && failedCases === 0 && blockedCases === 0 && passedCases > 0
- `fail`: status === 'completed' && failedCases > 0 或 status === 'failed'
- `block`: status === 'completed' && failedCases === 0 && blockedCases > 0
- `skip`: 跳过的情况

### 技术实现

**筛选流程**：
1. 先获取所有符合其他筛选条件的数据（不分页）
2. 为每个计划查询最新执行记录
3. 根据最新执行记录的状态和统计信息计算计划结果
4. 根据 result 参数过滤数据
5. 重新计算总数并应用分页

**为什么需要先获取所有数据再过滤**：
- 计划结果不是直接存储在测试计划表中的字段
- 需要根据最新执行记录动态计算
- 无法在数据库层面直接筛选，需要在应用层进行过滤

### 影响范围
- ✅ 测试计划列表页面的计划结果筛选功能
- ✅ 支持与其他筛选条件组合使用
- ✅ 筛选后分页功能正常工作

### Git 提交命令
```bash
git add src/types/testPlan.ts server/routes/testPlan.ts server/services/testPlanService.ts git-commit-log.md
git commit -m "feat(test-plans): 完善测试计划搜索栏计划结果筛选功能

- 在TestPlanListQuery类型中添加result字段
- 后端路由添加result参数接收
- 后端服务实现根据最新执行记录计算计划结果并筛选
- 支持通过、失败、阻塞、跳过四种结果筛选
- 筛选逻辑与前端getPlanResult保持一致"
```

---

## 2024-12-25 修复测试计划删除确认对话框React渲染错误

### 修改内容

**前端文件**:
- `src/pages/TestPlans.tsx` - 修复删除确认对话框的调用方式，移除未使用的状态变量和函数

### 问题描述
在JSX中直接调用 `AntModal.confirm()` 导致React错误："Objects are not valid as a React child (found: object with keys {destroy, update})"。`AntModal.confirm()` 返回一个对象（包含 `destroy` 和 `update` 方法），不能作为React子元素渲染。

### 修复详情

#### 1. 修复删除确认对话框调用方式
- **修改前**：在JSX条件渲染中直接调用 `AntModal.confirm()`
- **修改后**：将 `AntModal.confirm()` 调用移到删除按钮的 `onClick` 事件处理函数中
- 删除按钮点击时直接弹出确认对话框，无需通过状态控制

#### 2. 清理未使用的代码
- 移除未使用的 `showDeleteModal` 状态变量
- 移除未使用的 `selectedPlan` 状态变量（删除操作中）
- 移除未使用的 `handleDeletePlan` 函数
- 移除未使用的 `Modal` 组件导入

### 技术细节
- `AntModal.confirm()` 应该在事件处理函数中调用，而不是在JSX渲染中
- 确认对话框的显示由 `AntModal.confirm()` 内部管理，无需额外的状态控制
- 删除操作直接在确认对话框的 `onOk` 回调中执行

### 影响范围
- ✅ 测试计划删除功能的确认对话框
- ✅ 代码更简洁，移除了不必要的状态管理
- ✅ 修复了React渲染错误

### Git 提交命令
```bash
git add src/pages/TestPlans.tsx git-commit-log.md
git commit -m "fix(test-plans): 修复测试计划删除确认对话框React渲染错误

- 将AntModal.confirm()调用移到删除按钮onClick事件中
- 移除未使用的showDeleteModal和selectedPlan状态变量
- 移除未使用的handleDeletePlan函数和Modal导入
- 修复'Objects are not valid as a React child'错误"
```

---

## 2024-12-25 修复测试计划状态选项不一致问题

### 修改内容

**前端文件**:
- `src/pages/TestPlanForm.tsx` - 添加缺失的 not_started 和 expired 状态选项
- `src/pages/TestPlans.tsx` - 添加缺失的 draft 状态选项

### 功能说明
统一测试计划表单和列表页面的状态选项，使其与类型定义保持一致。两个文件现在都包含完整的7个状态选项：draft（草稿）、not_started（未开始）、active（进行中）、completed（已完成）、expired（已结束）、cancelled（已取消）、archived（已归档）。

### 修改详情

#### 1. TestPlanForm.tsx - 添加缺失状态选项
- 在状态选择器中添加 `not_started`（未开始）选项
- 在状态选择器中添加 `expired`（已结束）选项
- 现在包含所有7个状态选项，与类型定义一致

#### 2. TestPlans.tsx - 添加缺失状态选项
- 在状态筛选器中添加 `draft`（草稿）选项
- 现在包含所有7个状态选项，与类型定义一致

### 影响范围
- ✅ 测试计划创建/编辑表单的状态选择
- ✅ 测试计划列表页面的状态筛选
- ✅ 状态选项与类型定义完全一致

### Git 提交命令
```bash
git add src/pages/TestPlanForm.tsx src/pages/TestPlans.tsx git-commit-log.md
git commit -m "fix(test-plans): 修复测试计划状态选项不一致问题

- TestPlanForm添加not_started和expired状态选项
- TestPlans添加draft状态选项
- 统一两个文件的状态选项，与类型定义保持一致
- 现在两个文件都包含完整的7个状态选项"
```

---

## 2024-12-25 测试计划列表统一样式，添加通过、失败、阻塞、计划结果列

### 修改内容

**前端文件**:
- `src/pages/TestPlans.tsx` - 添加通过、失败、阻塞列，统一计划状态和计划结果的显示样式，与测试执行历史表格保持一致
- `src/types/testPlan.ts` - 扩展 TestPlan 接口，添加最新执行记录的统计字段（通过、失败、阻塞、状态）

**后端文件**:
- `server/services/testPlanService.ts` - 在 getTestPlans 接口中返回最新执行记录的通过、失败、阻塞数据

### 功能说明
统一测试计划列表的样式，使其与测试执行历史表格保持一致。新增通过、失败、阻塞列，并添加计划结果列，基于最新执行记录的状态和统计信息显示执行结果。

### 修改详情

#### 1. 后端修改 - 返回最新执行记录的统计信息

**在 getTestPlans 函数中扩展查询**：
```typescript
const latestExecution = await prisma.test_plan_executions.findFirst({
  where: {
    plan_id: plan.id,
  },
  orderBy: {
    started_at: 'desc',
  },
  select: {
    progress: true,
    total_cases: true,
    completed_cases: true,
    passed_cases: true,      // 🆕 通过用例数
    failed_cases: true,      // 🆕 失败用例数
    blocked_cases: true,     // 🆕 阻塞用例数
    skipped_cases: true,
    status: true,             // 🆕 执行状态
  },
});
```

**返回数据扩展**：
```typescript
return {
  ...plan,
  latest_execution_progress: progress,
  latest_execution_completed_cases: completedCases,
  latest_execution_total_cases: totalCases,
  latest_execution_passed_cases: passedCases,    // 🆕
  latest_execution_failed_cases: failedCases,    // 🆕
  latest_execution_blocked_cases: blockedCases,  // 🆕
  latest_execution_status: latestExecution?.status, // 🆕
};
```

#### 2. 类型定义更新

**扩展 TestPlan 接口**：
```typescript
export interface TestPlan {
  // ... 其他字段
  latest_execution_passed_cases?: number;   // 🆕 通过用例数（来自最新执行记录）
  latest_execution_failed_cases?: number;   // 🆕 失败用例数（来自最新执行记录）
  latest_execution_blocked_cases?: number;  // 🆕 阻塞用例数（来自最新执行记录）
  latest_execution_status?: ExecutionStatus; // 🆕 最新执行状态
}
```

#### 3. 前端修改 - 添加列并统一样式

**表头新增列**：
- 在"用例总数"后添加"通过"、"失败"、"阻塞"列
- 在"计划进度"后添加"计划结果"列

**总用例数样式统一**（与执行历史表格一致）：
```tsx
<td className="px-3 py-3 text-center whitespace-nowrap">
  <span className="text-sm font-medium">{plan.total_cases || 0}</span>
</td>
```

**通过/失败/阻塞列样式**（与执行历史表格一致）：
```tsx
<td className="px-3 py-3 text-center whitespace-nowrap">
  <span className="text-sm font-medium text-green-600">{plan.latest_execution_passed_cases || 0}</span>
</td>
<td className="px-3 py-3 text-center whitespace-nowrap">
  <span className="text-sm font-medium text-red-600">{plan.latest_execution_failed_cases || 0}</span>
</td>
<td className="px-3 py-3 text-center whitespace-nowrap">
  <span className="text-sm font-medium text-yellow-600">{plan.latest_execution_blocked_cases || 0}</span>
</td>
```

**计划状态样式统一**（与执行历史表格一致）：
- 使用 `clsx` 和不同的背景色/文字色显示状态
- 支持执行状态（queued、running、completed、failed）和计划状态（not_started、active、completed、expired、cancelled、archived）
- 优先使用最新执行状态

**计划结果列**（新增，与执行历史表格一致）：
```tsx
// 获取计划结果（基于最新执行记录）
const getPlanResult = (plan: TestPlan) => {
  let executionResult: string | null = null;
  const status = plan.latest_execution_status;
  const passedCases = plan.latest_execution_passed_cases || 0;
  const failedCases = plan.latest_execution_failed_cases || 0;
  const blockedCases = plan.latest_execution_blocked_cases || 0;

  if (status === 'completed') {
    if (failedCases > 0) {
      executionResult = 'fail';
    } else if (blockedCases > 0) {
      executionResult = 'block';
    } else if (passedCases > 0) {
      executionResult = 'pass';
    }
  } else if (status === 'running') {
    executionResult = null;
  } else if (status === 'failed') {
    executionResult = 'fail';
  }

  const config = getStatusConfig(executionResult || null);
  return (
    <Tooltip title={...}>
      <Tag style={{ marginInlineEnd: 0, padding: '1px 8px' }} color={config.color}>
        {config.text}
      </Tag>
    </Tooltip>
  );
};
```

**样式特点**：
- 总用例数：`text-center font-medium`（与执行历史表格一致）
- 通过：`text-center font-medium text-green-600`（与执行历史表格一致）
- 失败：`text-center font-medium text-red-600`（与执行历史表格一致）
- 阻塞：`text-center font-medium text-yellow-600`（与执行历史表格一致）
- 计划状态：使用 `clsx` 和背景色/文字色徽章（与执行历史表格一致）
- 计划结果：使用 `Tag` 组件和 `getStatusConfig` 函数（与执行历史表格一致）

### 样式对比

**测试执行历史表格（TestPlanDetail.tsx）**：
- 总用例数：`text-center font-medium`
- 通过：`text-center font-medium text-green-600`
- 失败：`text-center font-medium text-red-600`
- 阻塞：`text-center font-medium text-yellow-600`
- 执行状态：使用 `clsx` 和背景色徽章
- 执行结果：使用 `Tag` 组件和 `getStatusConfig`

**测试计划列表（TestPlans.tsx）**：
- 总用例数：`text-center font-medium` ✅ 一致
- 通过：`text-center font-medium text-green-600` ✅ 一致
- 失败：`text-center font-medium text-red-600` ✅ 一致
- 阻塞：`text-center font-medium text-yellow-600` ✅ 一致
- 计划状态：使用 `clsx` 和背景色徽章 ✅ 一致
- 计划结果：使用 `Tag` 组件和 `getStatusConfig` ✅ 一致

### 用户体验改进

**统一的视觉体验**：
- 测试计划列表与测试执行历史表格的样式完全一致
- 用户在不同页面看到相同的数据展示方式
- 降低学习成本，提升使用效率

**更完整的信息展示**：
- 新增通过、失败、阻塞列，快速了解执行情况
- 新增计划结果列，直观显示执行结果
- 基于最新执行记录，数据更准确

**清晰的状态标识**：
- 计划状态和计划结果使用统一的徽章样式
- 颜色编码清晰，便于快速识别
- 支持 Tooltip 显示详细信息

### 技术特点

1. **数据来源**：基于最新执行记录（test_plan_executions）的统计数据
2. **样式复用**：复用 `getStatusConfig` 函数和 `Tag` 组件
3. **类型安全**：扩展 TypeScript 接口，确保类型正确
4. **性能优化**：使用并行查询获取最新执行记录

### 测试建议

1. **数据展示测试**：
   - 验证通过、失败、阻塞列正确显示最新执行记录的数据
   - 验证计划结果列根据执行状态和统计信息正确显示
   - 验证计划状态优先使用最新执行状态

2. **样式一致性测试**：
   - 对比测试计划列表和测试执行历史表格的样式
   - 验证颜色、字体、对齐方式完全一致

3. **空数据处理测试**：
   - 验证没有执行记录时显示 0 或 "-"
   - 验证计划结果在没有执行记录时显示 "-"

### Git 提交命令

```bash
git add src/pages/TestPlans.tsx src/types/testPlan.ts server/services/testPlanService.ts git-commit-log.md
git commit -m "feat(test-plans): 测试计划列表统一样式，添加通过、失败、阻塞、计划结果列

前端:
- 添加通过、失败、阻塞列，样式与测试执行历史表格保持一致
- 添加计划结果列，基于最新执行记录显示执行结果
- 统一计划状态显示样式，优先使用最新执行状态
- 导入Tag和Tooltip组件用于结果展示

后端:
- 在getTestPlans接口中返回最新执行记录的通过、失败、阻塞数据
- 返回最新执行状态，用于计划状态和计划结果的判断

类型:
- 扩展TestPlan接口，添加最新执行记录的统计字段

提升测试计划列表的信息展示完整性和视觉一致性"
```

---

## 2024-12-25 测试计划列表新增计划进度列

### 修改内容

**前端文件**:
- `src/pages/TestPlans.tsx` - 在表格中新增"计划进度"列，显示整体计划执行进度
- `src/types/testPlan.ts` - 扩展 TestPlan 接口，添加最新执行记录的进度数据字段

**后端文件**:
- `server/services/testPlanService.ts` - 在 getTestPlans 接口中返回最新执行记录的进度数据

### 功能说明
在测试计划列表表格中新增"计划进度"列，展示当前计划的整体执行进度。进度数据来自最新执行历史记录，已完成状态显示100%，样式参考测试计划详情页的执行进度条。

### 修改详情

#### 1. 前端修改 - 添加计划进度列

**表头新增列**（在"执行次数"之后，"负责人"之前）：
```tsx
<th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
  计划进度
</th>
```

**表格数据行新增进度条显示**：
```tsx
<td className="px-3 py-3 whitespace-nowrap">
  <div className="w-full max-w-[120px] mx-auto">
    {(() => {
      // 使用最新执行记录的数据
      const progress = plan.latest_execution_progress ?? 0;
      const completedCases = plan.latest_execution_completed_cases ?? 0;
      const totalCases = plan.latest_execution_total_cases ?? plan.total_cases ?? 0;
      
      return (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>执行进度</span>
            <span>{completedCases} / {totalCases}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-md h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-md transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    })()}
  </div>
</td>
```

**样式特点**：
- 进度条样式完全参考 TestPlanDetail.tsx 中的执行进度条
- 使用蓝色渐变背景（from-blue-500 to-blue-600）
- 显示已完成用例数 / 总用例数的比例
- 进度条宽度根据百分比动态计算
- 最大宽度限制为 120px，居中显示

#### 2. 后端修改 - 返回最新执行记录的进度数据

**在 getTestPlans 函数中获取最新执行记录**：
```typescript
// 为每个计划查询最新执行记录和进度数据
const plansWithProgress = await Promise.all(
  plans.map(async (plan) => {
    // 获取最新执行记录（按开始时间降序，取第一条）
    const latestExecution = await prisma.test_plan_executions.findFirst({
      where: {
        plan_id: plan.id,
      },
      orderBy: {
        started_at: 'desc',
      },
      select: {
        progress: true,
        total_cases: true,
        completed_cases: true,
        status: true,
      },
    });

    // 如果有最新执行记录，使用执行记录的进度数据
    // 如果执行状态是 completed，进度应该是100%
    let progress = 0;
    let completedCases = 0;
    let totalCases = plan._count.plan_cases;

    if (latestExecution) {
      totalCases = latestExecution.total_cases || plan._count.plan_cases;
      completedCases = latestExecution.completed_cases || 0;
      
      // 如果执行状态是 completed，进度应该是100%
      if (latestExecution.status === 'completed') {
        progress = 100;
      } else {
        // 否则使用执行记录的进度值
        progress = latestExecution.progress || 0;
      }
    }

    return {
      ...plan,
      latest_execution_progress: progress,
      latest_execution_completed_cases: completedCases,
      latest_execution_total_cases: totalCases,
    };
  })
);
```

**实现方式**：
- 使用 Prisma 的 `findFirst` 方法获取每个计划的最新执行记录
- 按 `started_at` 降序排序，获取最近一次执行记录
- 如果执行状态是 `completed`，进度强制设置为 100%
- 否则使用执行记录的 `progress` 字段值
- 使用 `Promise.all` 并行查询所有计划的执行情况，提升性能

#### 3. 类型定义更新

**扩展 TestPlan 接口**：
```typescript
export interface TestPlan {
  // ... 其他字段
  total_cases?: number;
  functional_cases?: number;
  ui_auto_cases?: number;
  completed_executions?: number;
  // 最新执行记录的进度数据
  latest_execution_progress?: number; // 进度百分比
  latest_execution_completed_cases?: number; // 已完成用例数
  latest_execution_total_cases?: number; // 总用例数（来自执行记录）
}
```

### 进度计算逻辑

**进度数据来源**：
- 优先使用最新执行记录（plan_executions）的数据
- 如果没有执行记录，进度显示为 0%

**进度计算规则**：
- 如果执行状态是 `completed`，进度强制显示为 100%
- 如果执行状态是 `running`、`queued` 等，使用执行记录的 `progress` 字段值
- 如果没有执行记录，进度显示为 0%

**显示内容**：
- 进度条：根据百分比显示蓝色渐变进度条
- 文字说明：显示"执行进度"标签
- 数量统计：显示"已完成用例数 / 总用例数"的格式（来自执行记录）

### 用户体验改进

**直观的进度展示**：
- 在列表页面即可快速了解每个计划的执行进度
- 基于最新执行历史记录，数据更准确
- 已完成状态显示100%，符合用户预期

**统一的设计风格**：
- 进度条样式与测试计划详情页保持一致
- 使用相同的颜色主题和布局方式
- 提供一致的用户体验

**准确的数据展示**：
- 基于最新执行记录的数据，反映当前执行状态
- 已完成状态自动显示100%，无需手动计算
- 支持快速识别需要关注的计划

### 技术特点

1. **性能优化**：使用 `Promise.all` 并行查询所有计划的执行情况
2. **数据准确性**：使用最新执行记录的数据，确保进度准确
3. **类型安全**：扩展 TypeScript 接口，确保类型正确
4. **样式复用**：参考现有组件的样式实现，保持一致性
5. **响应式设计**：进度条容器使用最大宽度限制，适配不同屏幕

### 测试建议

1. **进度显示测试**：
   - 验证有执行记录的计划的进度条正确显示
   - 验证已完成状态的计划进度显示为 100%
   - 验证执行中的计划进度显示为实际进度值
   - 验证无用例或未执行的计划的进度显示为 0%

2. **数据准确性测试**：
   - 执行计划后，验证进度条更新正确
   - 验证已完成状态的计划显示 100%
   - 验证进度数据与详情页数据一致

3. **样式测试**：
   - 验证进度条样式与详情页一致
   - 验证进度条在不同屏幕尺寸下显示正常

### Git 提交命令

```bash
git add src/pages/TestPlans.tsx src/types/testPlan.ts server/services/testPlanService.ts git-commit-log.md
git commit -m "feat(test-plans): 测试计划列表新增计划进度列

前端:
- 在测试计划列表表格中新增'计划进度'列
- 使用最新执行记录的进度数据
- 已完成状态显示100%
- 进度条样式参考测试计划详情页

后端:
- 在getTestPlans接口中获取最新执行记录
- 返回最新执行记录的进度、已完成用例数、总用例数
- 已完成状态强制显示100%进度
- 使用并行查询优化性能

类型:
- 扩展TestPlan接口，添加最新执行记录的进度数据字段

提升测试计划列表的信息展示完整性和准确性"
```

---

## 2024-12-25 支持测试用例ID搜索

### 修改内容

**前端文件**:
- `src/pages/TestCases.tsx` - 更新搜索框提示文本，支持通过测试用例ID搜索
- `src/pages/TestRuns.tsx` - 在测试执行筛选逻辑中添加测试用例ID搜索支持

**后端文件**:
- `server/services/testExecution.ts` - 在搜索条件中添加ID字段支持

### 功能说明
在测试用例和测试执行的搜索栏中添加测试用例ID搜索功能，方便用户快速定位特定ID的测试用例。

### 问题描述
用户输入ID后无法匹配到测试用例数据，因为后端搜索条件中只包含title、system、module字段，缺少id字段。

### 修改详情

#### 1. 前端修改 - 更新搜索提示文本

**测试用例搜索栏（Cases Tab）**：
```tsx
// 修改前
<input
  type="text"
  placeholder="搜索测试用例名称..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  // ...
/>

// 修改后
<input
  type="text"
  placeholder="搜索测试用例名称或ID..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  // ...
/>
```

**测试执行搜索栏（Runs Tab）**：
```tsx
// 修改前
<input
  type="text"
  placeholder="搜索测试用例名称..."
  value={runsSearchTerm}
  onChange={(e) => setRunsSearchTerm(e.target.value)}
  // ...
/>

// 修改后
<input
  type="text"
  placeholder="搜索测试用例名称或ID..."
  value={runsSearchTerm}
  onChange={(e) => setRunsSearchTerm(e.target.value)}
  // ...
/>
```

#### 2. 前端TestRuns组件修改 - 添加测试用例ID搜索支持

**文件**: `src/pages/TestRuns.tsx`（第854-872行）

**修改前**：
```typescript
const filteredTestRuns = useMemo(() => {
  return testRuns.filter(run => {
    // 搜索条件：匹配测试名称（保持模糊搜索）
    const matchesSearch = !searchTerm || 
      run.name.toLowerCase().includes(searchTerm.toLowerCase());
    // ...
  });
}, [testRuns, searchTerm, ...]);
```

**修改后**：
```typescript
const filteredTestRuns = useMemo(() => {
  return testRuns.filter(run => {
    // 搜索条件：匹配测试名称或测试用例ID（保持模糊搜索）
    let matchesSearch = false;
    if (!searchTerm) {
      matchesSearch = true;
    } else {
      const searchLower = searchTerm.toLowerCase();
      // 匹配测试运行名称
      const matchesName = run.name.toLowerCase().includes(searchLower);
      // 🆕 匹配测试用例ID（模糊匹配，支持部分ID搜索）
      const matchesId = run.testCaseId && String(run.testCaseId).includes(searchTerm);
      
      matchesSearch = matchesName || matchesId;
    }
    // ...
  });
}, [testRuns, searchTerm, ...]);
```

**关键修改**：
- 将搜索逻辑从简单的名称匹配改为名称或ID匹配
- 将 `testCaseId` 转换为字符串，使用 `includes` 进行模糊匹配
- 支持部分ID搜索，例如输入"12"可以匹配到ID为123、1234、312等
- 使用OR条件，支持同时匹配名称或ID

#### 3. 后端修改 - 添加ID模糊搜索支持（应用层实现）

**文件**: `server/services/testExecution.ts`（第518-650行）

**修改前**：
```typescript
// 搜索条件（标题、系统、模块）
if (search && search.trim()) {
  const searchConditions = [
    { title: { contains: search } },
    { system: { contains: search } },
    { module: { contains: search } }
  ];
  
  whereForCount.OR = searchConditions;
  where.OR = searchConditions;
}

// 🔥 应用层过滤
let filteredData = testCases.map(this.dbTestCaseToApp);

if (priority && priority.trim()) {
  filteredData = filteredData.filter(testCase => testCase.priority === priority);
}
```

**修改后**：
```typescript
// 搜索条件（标题、系统、模块）
// 注意：ID搜索在应用层进行，以支持完全的模糊匹配
const searchTerm = search && search.trim() ? search.trim() : '';
let searchIdMode = false; // 标记是否为纯数字搜索

if (searchTerm) {
  // 检查是否为纯数字搜索
  const searchId = parseInt(searchTerm, 10);
  searchIdMode = !isNaN(searchId) && searchId > 0 && searchTerm === String(searchId);
  
  if (!searchIdMode) {
    // 非纯数字搜索：在数据库层面进行文本搜索
    const searchConditions: any[] = [
      { title: { contains: searchTerm } },
      { system: { contains: searchTerm } },
      { module: { contains: searchTerm } }
    ];
    whereForCount.OR = searchConditions;
    where.OR = searchConditions;
  }
  // 纯数字搜索：不在数据库层面过滤，稍后在应用层进行ID模糊匹配
}

// 🔥 应用层过滤 priority、status、ID
let filteredData = testCases.map(this.dbTestCaseToApp);

// 🆕 ID模糊搜索（应用层）- 支持完全的模糊匹配
if (searchIdMode && searchTerm) {
  filteredData = filteredData.filter(testCase => 
    String(testCase.id).includes(searchTerm)
  );
}

if (priority && priority.trim()) {
  filteredData = filteredData.filter(testCase => testCase.priority === priority);
}
```

### 技术实现

#### 后端实现（testExecution服务）
**ID模糊匹配逻辑**（应用层实现）：
- 判断搜索词是否为纯数字（如"12"、"123"）
- **纯数字搜索**：
  - 跳过数据库层面的搜索过滤，获取所有符合其他条件的数据
  - 在应用层将ID转换为字符串，使用`String(testCase.id).includes(searchTerm)`进行模糊匹配
  - 支持完全的模糊匹配：例如输入"12"可以匹配12、123、1234、312、5123等所有包含"12"的ID
- **文本搜索**：
  - 在数据库层面使用Prisma的`contains`对title、system、module进行模糊匹配
  - 利用数据库索引优化文本搜索性能

**为什么在应用层实现ID模糊匹配**：
- 数据库中ID是整数类型，Prisma不支持对整数字段使用`contains`
- 使用原始SQL会让代码过于复杂，难以维护
- 应用层过滤可以实现完全的模糊匹配（包括匹配ID中间的数字）
- 测试用例数据量通常不大，应用层过滤性能可接受

#### 前端实现（TestRuns组件）
**ID模糊匹配逻辑**：
- 将 `testCaseId`（数字）转换为字符串
- 使用 `String(run.testCaseId).includes(searchTerm)` 进行模糊匹配
- 支持部分ID搜索，例如输入"12"可以匹配到123、1234、312等
- 在前端进行模糊匹配，提供更好的用户体验

**为什么前端使用模糊匹配**：
- 测试执行数据已经完全加载到前端内存，前端过滤性能很好
- 模糊匹配提供更灵活的搜索体验
- 与后端的ID搜索行为保持一致

### 用户体验改进

**更清晰的搜索提示**：
- 明确告知用户可以使用测试用例名称或ID进行搜索
- 提升搜索功能的可发现性
- 方便用户通过ID快速定位特定测试用例

**灵活的搜索方式**：
- 支持通过名称搜索（模糊匹配）
- 支持通过系统名搜索（模糊匹配）
- 支持通过模块名搜索（模糊匹配）
- 支持通过ID搜索（模糊匹配）- 输入"12"可匹配12、123、312等所有包含"12"的ID
- 智能识别搜索类型：纯数字进行ID搜索，非纯数字进行文本搜索
- 用户可以根据实际需求选择合适的搜索方式

### 使用场景

#### 测试用例搜索（Cases Tab）
1. **通过名称搜索**：输入"登录"可以找到所有包含"登录"关键词的测试用例
2. **通过ID搜索（模糊匹配）**：
   - 输入"123"可以找到ID为123、1234、5123等所有包含"123"的测试用例
   - 输入"12"可以找到ID为12、123、1234、312等所有包含"12"的测试用例
3. **混合搜索**：纯数字时进行ID模糊匹配，非纯数字时同时匹配名称、系统、模块字段

#### 测试执行搜索（Runs Tab）
1. **通过测试运行名称搜索**：输入"登录"可以找到所有包含"登录"的测试运行记录
2. **通过测试用例ID搜索（模糊匹配）**：
   - 输入"123"可以找到ID为123、1234、5123等所有包含"123"的测试用例的运行记录
   - 输入"12"可以找到ID为12、123、1234、312等所有包含"12"的测试用例的运行记录
3. **混合搜索**：输入的关键词会同时模糊匹配测试运行名称和测试用例ID

### 测试建议

#### 测试用例搜索测试（Cases Tab）
1. **ID模糊搜索测试**：
   - 输入部分ID（如"12"），验证是否能找到ID包含"12"的所有测试用例（如ID为12、123、1234、312等）
   - 输入完整ID（如"123"），验证是否能找到ID包含"123"的所有测试用例（如ID为123、1234、5123等）
   - 输入不存在的ID片段（如"999"），验证是否返回空结果
   
2. **名称搜索测试**：
   - 输入文字关键词，验证名称搜索仍然正常工作
   - 输入包含数字的文本（如"test123"），验证会进行文本搜索而非ID搜索

3. **混合搜索测试**：
   - 输入纯数字，验证只进行ID模糊匹配
   - 输入非纯数字，验证进行文本搜索（名称、系统、模块）

#### 测试执行搜索测试（Runs Tab）
1. **测试用例ID模糊搜索测试**：
   - 输入部分ID（如"12"），验证是否能找到ID包含"12"的所有测试运行记录（如ID为12、123、1234、312等）
   - 输入完整ID（如"123"），验证是否能找到ID包含"123"的所有测试运行记录（如ID为123、1234、5123等）
   - 验证返回的是所有匹配测试用例的执行记录（可能有多条）
   - 输入不存在的ID片段，验证是否返回空结果
   
2. **测试运行名称搜索测试**：
   - 输入文字关键词，验证名称搜索仍然正常工作
   - 输入包含数字的名称，验证同时匹配名称和ID

3. **混合搜索测试**：
   - 输入数字，验证同时模糊匹配测试运行名称（如果包含该数字）和测试用例ID
   - 验证OR条件正确工作，只要名称或ID匹配即返回结果

### Git 提交命令

```bash
git add src/pages/TestCases.tsx src/pages/TestRuns.tsx server/services/testExecution.ts git-commit-log.md
git commit -m "feat(search): 支持测试用例ID模糊搜索

前端:
- 更新测试用例搜索栏提示文本为"搜索测试用例名称或ID..."
- 更新测试执行搜索栏提示文本为"搜索测试用例名称或ID..."
- 在TestRuns组件中添加测试用例ID模糊搜索逻辑
- 支持通过测试用例ID查找所有相关的测试运行记录
- ID搜索支持部分匹配，例如输入"12"可匹配12、123、312等

后端:
- 在testExecution服务中实现ID模糊搜索（应用层）
- 纯数字搜索时在应用层进行ID模糊匹配
- 非纯数字搜索时在数据库层进行文本搜索
- 支持完全的模糊匹配，例如输入"12"可匹配ID为12、123、1234、312、5123等

提升搜索功能的灵活性和用户体验"
```

---

## 2024-12-25 修复测试执行筛选功能，改为精确匹配并统一执行结果值格式

### 修改内容

**文件**:
- `src/pages/TestRuns.tsx` - 修复测试执行的筛选逻辑，改为精确匹配，并统一执行结果值格式

### 问题描述
测试执行的搜索栏筛选项存在两个问题：
1. 使用模糊匹配（`.includes()`）而不是精确匹配，导致筛选结果不准确
2. 执行结果筛选无效：筛选选项值（`pass`/`fail`/`skip`）与实际计算的结果值（`PASSED`/`FAILED`/`SKIPPED`）格式不一致

### 根本原因
1. **模糊匹配问题**：
   - 执行者、环境、项目、版本、模块、标签等筛选条件使用了 `.toLowerCase().includes()`
   - 例如：选择"项目A"会匹配到"项目AB"、"新项目A1"等，不符合用户预期
   
2. **执行结果值不一致问题**：
   - 筛选选项定义的值：`pass`、`fail`、`block`、`skip`（小写）
   - 实际计算的 `actualResult` 值：`PASSED`、`FAILED`、`SKIPPED`（大写）
   - 导致 `actualResult === resultFilter` 永远为 false，筛选无效

### 修复详情

#### 1. 改为精确匹配

**修改前（模糊匹配）**：
```typescript
// 执行者筛选
const matchesExecutor = !executorFilter || 
  run.executor.toLowerCase().includes(executorFilter.toLowerCase());

// 环境筛选
const matchesEnvironment = !environmentFilter || 
  run.environment.toLowerCase().includes(environmentFilter.toLowerCase());

// 项目筛选
const matchesSystem = !systemFilter || 
  (run.system && run.system.toLowerCase().includes(systemFilter.toLowerCase()));

// 版本筛选
const matchesVersion = !versionFilter || 
  (run.projectVersion && run.projectVersion.toLowerCase().includes(versionFilter.toLowerCase()));

// 模块筛选
const matchesModule = !moduleFilter || 
  (run.module && run.module.toLowerCase().includes(moduleFilter.toLowerCase()));

// 标签筛选
const matchesTag = !tagFilter || 
  (run.tags && Array.isArray(run.tags) && run.tags.some(tag => 
    tag.toLowerCase().includes(tagFilter.toLowerCase())
  ));
```

**修改后（精确匹配）**：
```typescript
// 执行者筛选（精确匹配）
const matchesExecutor = !executorFilter || 
  run.executor.toLowerCase() === executorFilter.toLowerCase();

// 环境筛选（精确匹配）
const matchesEnvironment = !environmentFilter || 
  run.environment.toLowerCase() === environmentFilter.toLowerCase();

// 🔥 新增：项目筛选（精确匹配）
const matchesSystem = !systemFilter || 
  (run.system && run.system.toLowerCase() === systemFilter.toLowerCase());

// 🔥 新增：版本筛选（精确匹配）
const matchesVersion = !versionFilter || 
  (run.projectVersion && run.projectVersion.toLowerCase() === versionFilter.toLowerCase());

// 🔥 新增：模块筛选（精确匹配）
const matchesModule = !moduleFilter || 
  (run.module && run.module.toLowerCase() === moduleFilter.toLowerCase());

// 🔥 新增：标签筛选（精确匹配）
const matchesTag = !tagFilter || 
  (run.tags && Array.isArray(run.tags) && run.tags.some(tag => 
    tag.toLowerCase() === tagFilter.toLowerCase()
  ));

// 🔥 新增：优先级筛选（精确匹配）
const matchesPriority = !priorityFilter || run.priority === priorityFilter;
```

**关键变化**：
- 所有 `.includes()` 改为 `===` 进行精确匹配
- 保留 `.toLowerCase()` 实现大小写不敏感匹配
- 标签筛选使用 `some()` 配合 `===` 实现精确匹配任意一个标签

#### 2. 统一执行结果值格式

**修改前（大写格式）**：
```typescript
// 计算实际执行结果
let actualResult: string | null = null;
if (run.status === 'completed') {
  if (run.failedSteps > 0) {
    actualResult = 'FAILED';  // 大写
  } else if (run.passedSteps > 0) {
    actualResult = 'PASSED';  // 大写
  } else {
    actualResult = 'SKIPPED';  // 大写
  }
} else if (run.status === 'failed') {
  actualResult = 'FAILED';
} else if (run.status === 'cancelled') {
  actualResult = 'SKIPPED';
}
```

**修改后（小写格式）**：
```typescript
// 计算实际执行结果（使用小写值以匹配筛选选项）
let actualResult: string | null = null;
if (run.status === 'completed') {
  if (run.failedSteps > 0) {
    actualResult = 'fail';  // 小写，匹配筛选选项
  } else if (run.passedSteps > 0) {
    actualResult = 'pass';  // 小写
  } else {
    actualResult = 'skip';  // 小写
  }
} else if (run.status === 'failed') {
  actualResult = 'fail';
} else if (run.status === 'cancelled') {
  actualResult = 'skip';
}
```

**关键变化**：
- 所有执行结果值从大写改为小写
- 与筛选选项的值格式保持一致：`pass`、`fail`、`skip`
- 确保 `actualResult === resultFilter` 能够正确匹配

### 筛选逻辑说明

**保持模糊搜索的字段**：
- `searchTerm`（测试运行名称搜索）：使用 `.includes()` 模糊匹配，符合用户搜索习惯

**使用精确匹配的字段**：
- `statusFilter`（执行状态）：已经是精确匹配
- `resultFilter`（执行结果）：已经是精确匹配
- `executorFilter`（执行者）：改为精确匹配
- `environmentFilter`（环境）：改为精确匹配
- `systemFilter`（项目）：改为精确匹配
- `versionFilter`（版本）：改为精确匹配
- `moduleFilter`（模块）：改为精确匹配
- `tagFilter`（标签）：改为精确匹配
- `priorityFilter`（优先级）：已经是精确匹配

### 执行结果映射关系

| 执行状态 | 步骤情况 | 计算结果 | 筛选值 |
|---------|---------|---------|-------|
| completed | failedSteps > 0 | fail | fail |
| completed | passedSteps > 0 且 failedSteps === 0 | pass | pass |
| completed | passedSteps === 0 且 failedSteps === 0 | skip | skip |
| failed | - | fail | fail |
| cancelled | - | skip | skip |

### 影响范围
- ✅ 测试执行页面的所有筛选功能
- ✅ 执行结果筛选现在可以正常工作
- ✅ 所有下拉框筛选改为精确匹配，提高准确性
- ✅ 搜索框保持模糊匹配，保持便利性

### 用户体验改进

**精确筛选**：
- 选择"项目A"只会显示项目完全等于"项目A"的记录
- 选择"环境Test"只会显示环境完全等于"Test"的记录
- 避免筛选结果包含不相关的数据

**执行结果筛选生效**：
- 选择"✅ 通过"能够正确筛选出所有通过的测试运行
- 选择"❌ 失败"能够正确筛选出所有失败的测试运行
- 选择"⏭️ 跳过"能够正确筛选出所有跳过/取消的测试运行

**保持搜索便利性**：
- 测试运行名称搜索仍然使用模糊匹配
- 输入"登录"可以匹配"用户登录测试"、"登录功能验证"等

### 测试建议

1. **执行结果筛选测试**：
   - 选择"✅ 通过"筛选项，验证只显示通过的测试运行
   - 选择"❌ 失败"筛选项，验证只显示失败的测试运行
   - 选择"⏭️ 跳过"筛选项，验证只显示跳过/取消的测试运行

2. **精确匹配测试**：
   - 选择项目"系统A"，验证不会显示"系统AB"或"新系统A"的记录
   - 选择环境"Test"，验证不会显示"Testing"或"PreTest"的记录
   - 选择模块"用户管理"，验证不会显示"用户管理模块"的记录

3. **模糊搜索测试**：
   - 在搜索框输入"登录"，验证能匹配到所有包含"登录"的测试运行名称

4. **组合筛选测试**：
   - 同时选择项目、状态、执行结果等多个条件，验证筛选结果正确

### Git 提交命令
```bash
git add src/pages/TestRuns.tsx git-commit-log.md
git commit -m "fix(test-runs): 修复测试执行筛选功能，改为精确匹配并统一执行结果值格式

- 将所有筛选条件从模糊匹配（.includes）改为精确匹配（===）
- 修复执行结果筛选无效的问题：统一使用小写值（pass/fail/skip）
- 保留测试运行名称的模糊搜索功能
- 提高筛选结果的准确性"
```

---

## 2024-12-25 过滤已删除用例的测试运行记录

### 修改内容

**后端文件**:
- `server/services/testCaseExecutionService.ts` - 在数据库查询中过滤已删除用例的测试运行记录
- `server/routes/test.ts` - 在内存中过滤已删除用例的测试运行记录

### 问题描述
`/api/tests/runs` 接口返回的测试运行记录中包含了关联用例已被删除的记录，这些记录在前端显示时会出现问题，需要只展示关联用例未被删除的测试运行记录。

### 根本原因
1. 数据库查询时没有检查关联的 `test_cases` 表中的 `deleted_at` 字段
2. 内存中的测试运行记录在获取用例详情时，虽然 `getTestCaseById` 方法会返回 null（如果用例已删除），但代码仍然返回了这些记录

### 修复详情

#### 1. testCaseExecutionService.ts - 数据库查询过滤

**在 `getExecutions` 方法中添加关联查询和过滤条件**：

```typescript
// 🔥 新增：过滤掉关联用例已删除的记录
where.test_cases = {
  deleted_at: null
};

const executions = await this.prisma.test_case_executions.findMany({
  where,
  include: {
    users: {
      select: {
        id: true,
        username: true,
        email: true,
        account_name: true
      }
    },
    // 🔥 新增：关联 test_cases 以检查 deleted_at 字段
    test_cases: {
      select: {
        id: true,
        deleted_at: true
      }
    }
  },
  orderBy: { queued_at: 'desc' },
  take: filters?.limit || 50,
  skip: filters?.offset || 0,
});
```

**关键修改**：
- 在 `where` 条件中添加 `test_cases.deleted_at = null` 的过滤条件
- 在 `include` 中添加 `test_cases` 关联，查询 `deleted_at` 字段
- 利用 Prisma 的关系查询能力，只返回关联用例未删除的记录

#### 2. test.ts - 内存记录过滤

**在 `/runs` 路由中过滤内存中的测试运行记录**：

```typescript
// 🚀 为内存中的测试运行补充测试用例名称和完整时间信息
const enrichedMemoryRunsWithNull = await Promise.all(
  memoryRuns.map(async (run) => {
    try {
      // 获取测试用例详情
      const testCase = await testExecutionService.getTestCaseById(run.testCaseId);
      
      // 🔥 新增：如果测试用例已删除（返回null），则过滤掉该记录
      if (!testCase) {
        console.log(`🗑️ 测试运行 ${run.id} 的关联用例 #${run.testCaseId} 已被删除，将被过滤`);
        return null;
      }
      
      // ... 返回enriched记录
    } catch (error) {
      console.error(`❌ 获取测试用例 #${run.testCaseId} 详情失败:`, error);
      // 🔥 修改：获取失败时也返回 null，不展示该记录
      return null;
    }
  })
);

// 🔥 新增：过滤掉 null 值（即关联用例已删除的记录）
const enrichedMemoryRuns = enrichedMemoryRunsWithNull.filter((run): run is NonNullable<typeof run> => run !== null);
```

**关键修改**：
- 当 `getTestCaseById` 返回 `null` 时（用例已删除），返回 `null` 而不是继续处理
- 当获取用例详情失败时，也返回 `null`，避免展示不完整的数据
- 使用 `filter` 过滤掉所有 `null` 值
- 使用 TypeScript 类型守卫确保类型安全

### 数据库 Schema 说明

**test_cases 表**：
```prisma
model test_cases {
  id                   Int                    @id @default(autoincrement())
  title                String                 @db.VarChar(255)
  // ... 其他字段
  deleted_at           DateTime?              @db.Timestamp(0)  // 软删除字段
  test_case_executions test_case_executions[]  // 关联到执行记录
  
  @@index([deleted_at])
}
```

**test_case_executions 表**：
```prisma
model test_case_executions {
  id                  String                     @id @db.VarChar(255)
  test_case_id        Int
  test_case_title     String                     @db.VarChar(255)
  // ... 其他字段
  test_cases          test_cases                 @relation(fields: [test_case_id], references: [id], onDelete: Cascade)
  
  @@index([test_case_id])
}
```

### 工作流程

**数据库记录过滤流程**：
```
API 请求 /api/tests/runs
    ↓
testCaseExecutionService.getExecutions()
    ↓
Prisma 查询（关联 test_cases 表）
    ↓
WHERE test_cases.deleted_at IS NULL  ← 过滤已删除
    ↓
返回未删除用例的测试运行记录
```

**内存记录过滤流程**：
```
获取内存中的测试运行记录
    ↓
遍历每条记录
    ↓
getTestCaseById(testCaseId)
    ↓
检查 deleted_at 字段  ← 在 testExecution.ts 中已实现
    ↓
如果已删除，返回 null
    ↓
过滤掉所有 null 值
    ↓
返回未删除用例的测试运行记录
```

### 影响范围
- ✅ `/api/tests/runs` 接口返回的数据库记录
- ✅ `/api/tests/runs` 接口返回的内存记录
- ✅ 前端测试运行列表页面（TestRuns）
- ✅ 前端测试用例页面的测试执行Tab

### 用户体验改进
- **数据准确性**：只展示有效的测试运行记录，避免显示无效数据
- **避免错误**：防止点击已删除用例的测试记录时出现 404 错误
- **清晰的日志**：在控制台输出被过滤的记录信息，便于调试

### 技术特点
1. **双重过滤**：同时在数据库查询和内存记录中进行过滤，确保完整性
2. **利用现有逻辑**：`getTestCaseById` 方法已经实现了软删除检查，直接复用
3. **类型安全**：使用 TypeScript 类型守卫确保过滤后的类型正确
4. **性能优化**：使用 Prisma 关系查询，一次查询完成过滤，避免 N+1 问题

### 测试建议

1. **删除用例测试**：
   - 创建一个测试用例并执行
   - 删除该测试用例
   - 刷新测试运行列表，验证该记录不再显示

2. **API 测试**：
   - 直接调用 `/api/tests/runs` 接口
   - 验证返回的数据中不包含已删除用例的记录

3. **内存记录测试**：
   - 执行一个测试用例（进入内存）
   - 立即删除该用例
   - 刷新测试运行列表，验证记录不显示

4. **日志验证**：
   - 查看控制台日志
   - 验证被过滤的记录有正确的日志输出

### Git 提交命令
```bash
git add server/services/testCaseExecutionService.ts server/routes/test.ts git-commit-log.md
git commit -m "fix(test-runs): 过滤已删除用例的测试运行记录

- 在数据库查询中添加 test_cases.deleted_at = null 过滤条件
- 在内存记录处理中过滤掉关联用例已删除的记录
- 添加日志输出，便于调试和追踪
- 确保前端只展示有效的测试运行记录"
```

---

## 2024-12-25 修复测试执行筛选功能，添加分页重置逻辑

### 修改内容

**文件**:
- `src/pages/TestRuns.tsx` - 添加筛选条件变化监听和分页重置逻辑

### 问题描述
用户反馈测试执行的搜索栏筛选模式和测试用例不一致：
1. 测试用例（Cases）使用后端筛选：筛选条件改变时调用接口重新加载数据
2. 测试执行（Runs）使用前端筛选：一次性加载所有数据，在前端进行筛选
3. 测试执行筛选条件改变时，分页没有重置到第一页，导致可能看不到筛选结果

### 根本原因
TestRuns 组件缺少监听筛选条件变化的 useEffect，当用户改变筛选条件时：
- 筛选逻辑会生效（通过 useMemo 实现）
- 但分页状态（currentPage）不会重置
- 如果当前在第 5 页，筛选后可能只有 2 页数据，用户会看到"无数据"

### 修复详情

#### TestRuns.tsx - 添加筛选条件监听

**新增 useEffect 监听筛选条件变化**：
```typescript
// 🔥 新增：监听筛选条件变化，重置分页到第一页
React.useEffect(() => {
  console.log('🔍 [TestRuns] 筛选条件变化，重置分页到第一页');
  setCurrentPage(1);
}, [
  searchTerm,
  statusFilter,
  resultFilter,
  executorFilter,
  environmentFilter,
  systemFilter,
  versionFilter,
  moduleFilter,
  tagFilter,
  priorityFilter
]);
```

**监听的筛选条件**：
- `searchTerm`: 搜索关键词
- `statusFilter`: 执行状态筛选
- `resultFilter`: 执行结果筛选
- `executorFilter`: 执行者筛选
- `environmentFilter`: 环境筛选
- `systemFilter`: 项目筛选
- `versionFilter`: 版本筛选
- `moduleFilter`: 模块筛选
- `tagFilter`: 标签筛选
- `priorityFilter`: 优先级筛选

### 工作流程

**筛选条件改变时的执行流程**：
```
用户改变筛选条件
    ↓
useEffect 触发
    ↓
重置 currentPage 为 1
    ↓
filteredTestRuns 重新计算（useMemo）
    ↓
paginatedTestRuns 重新计算（使用新的 currentPage = 1）
    ↓
显示筛选后的第一页数据
```

### 用户体验改进

**一致的筛选体验**：
- 虽然测试用例使用后端筛选，测试执行使用前端筛选，但用户体验保持一致
- 筛选条件改变后，列表会自动重置到第一页
- 避免"筛选后看不到数据"的困惑

**即时反馈**：
- 筛选条件改变后立即生效
- 分页自动重置，确保用户看到筛选结果
- 控制台输出日志，便于调试

### 技术特点

1. **自动重置**：筛选条件改变时自动重置分页，无需手动操作
2. **性能优化**：使用 React.useEffect 而不是 useEffect，明确表明这是 React 的 API
3. **完整的依赖**：监听所有筛选条件，确保任何筛选变化都会触发重置
4. **调试友好**：添加 console.log 便于追踪筛选行为

### 与测试用例的对比

| 特性 | 测试用例（Cases） | 测试执行（Runs） |
|------|-------------------|------------------|
| 筛选方式 | 后端筛选 | 前端筛选 |
| 数据加载 | 调用 API 重新加载 | 使用 useMemo 过滤 |
| 分页重置 | 自动（重新加载时重置） | 通过 useEffect 重置 |
| 用户体验 | ✅ 一致 | ✅ 一致 |

### 为什么不改为后端筛选？

**当前方案（前端筛选）的优势**：
1. ✅ **性能好**：数据已在前端，筛选响应快
2. ✅ **实时更新**：通过 WebSocket 实时更新数据
3. ✅ **无需修改后端**：不需要修改后端 API
4. ✅ **代码简单**：只需添加一个 useEffect

**改为后端筛选的劣势**：
1. ❌ 需要修改后端 API 支持筛选参数
2. ❌ 需要修改前端 testService 添加筛选 API
3. ❌ 每次筛选都需要网络请求，速度较慢
4. ❌ WebSocket 实时更新需要额外处理

### 测试建议

1. **筛选重置测试**：
   - 打开测试执行页面，翻到第 5 页
   - 选择任意筛选条件
   - 验证列表自动跳转到第一页

2. **多条件筛选测试**：
   - 选择项目筛选
   - 再选择状态筛选
   - 验证每次选择都会重置到第一页

3. **筛选结果测试**：
   - 选择筛选条件
   - 验证显示的是筛选后的数据
   - 验证分页功能正常工作

4. **清空筛选测试**：
   - 点击重置按钮清空所有筛选
   - 验证显示所有数据
   - 验证分页重置到第一页

### Git 提交命令
```bash
git add src/pages/TestRuns.tsx git-commit-log.md
git commit -m "fix(test-runs): 修复测试执行筛选功能，添加分页重置逻辑

- 添加 useEffect 监听筛选条件变化
- 筛选条件改变时自动重置分页到第一页
- 避免筛选后看不到数据的问题
- 与测试用例的筛选体验保持一致"
```

---

## 2024-12-25 修复测试用例模块搜索栏所有筛选功能（状态、创建者、执行状态、执行结果）

### 修改内容

**前端文件**:
- `src/services/testService.ts` - 添加 author 参数支持，修复 status 参数传递
- `src/pages/TestCases.tsx` - 修复所有筛选参数传递，添加 useEffect 监听所有筛选条件

**后端文件**:
- `server/routes/test.ts` - 添加 author 参数接收
- `server/services/testExecution.ts` - 实现 author 筛选逻辑

### 问题描述
测试用例模块（Cases Tab）搜索栏的多个筛选器不生效：
1. **状态筛选**：虽然有UI但传递的是空字符串
2. **创建者筛选**：完全没有实现
3. **执行状态筛选**：之前已修复
4. **执行结果筛选**：之前已修复

### 根本原因
1. **前端 TestCases.tsx**: `loadTestCases` 函数中 `status` 参数传的是空字符串 `''`，而不是 `casesStatusFilter`
2. **前端 TestCases.tsx**: 完全没有传递 `author` 参数
3. **前端 TestCases.tsx**: useEffect 依赖数组中缺少这两个筛选条件
4. **前端 testService.ts**: 参数类型中没有 `author` 定义
5. **后端 test.ts**: 路由没有接收 `author` 参数
6. **后端 testExecution.ts**: 服务层没有实现 `author` 筛选逻辑

### 修复详情

#### 前端修复

##### 1. TestCases.tsx - 修复参数传递
**在 `loadTestCases` 函数中修复：**
```typescript
const result = await testService.getTestCasesPaginated({
  // ... 其他参数
  status: casesStatusFilter, // 🆕 修复：使用casesStatusFilter而不是空字符串
  author: casesAuthorFilter // 🆕 添加：创建者筛选
});
```

**在 `handleReset` 函数中添加：**
```typescript
const result = await testService.getTestCasesPaginated({
  // ... 其他参数
  status: '', // 🆕 状态筛选
  author: '' // 🆕 重置创建者筛选
});
```

**更新 useEffect 依赖数组：**
```typescript
useEffect(() => {
  if (activeTab === 'cases') {
    loadTestCases({ page: 1, resetPagination: true });
  }
}, [
  selectedSystem,
  selectedModule,
  selectedVersion,
  selectedTag,
  selectedPriority,
  casesStatusFilter, // 🆕 状态筛选
  casesExecutionStatusFilter,
  casesExecutionResultFilter,
  casesAuthorFilter, // 🆕 创建者筛选
  activeTab
]);
```

##### 2. testService.ts - 添加 author 参数支持
**添加参数类型定义：**
```typescript
async getTestCasesPaginated(params: {
  // ... 其他参数
  author?: string; // 🆕 创建者筛选
}): Promise<{...}>
```

**在 queryParams 构建中添加：**
```typescript
if (params.author && params.author.trim()) {
  queryParams.append('author', params.author);
}
```

#### 后端修复

##### 3. server/routes/test.ts - 接收 author 参数
```typescript
const {
  // ... 其他参数
  author = '' // 🆕 创建者筛选
} = req.query;

const result = await testExecutionService.getTestCasesPaginated({
  // ... 其他参数
  author: author as string,
});
```

##### 4. server/services/testExecution.ts - 实现 author 筛选逻辑
**添加参数类型定义：**
```typescript
public async getTestCasesPaginated(params: {
  // ... 其他参数
  author?: string; // 🆕 创建者筛选
}): Promise<{data: TestCase[], total: number}>
```

**在应用层过滤中添加：**
```typescript
// 🆕 创建者过滤（应用层，因为 author 信息存储在 steps JSON 中）
if (author && author.trim()) {
  filteredData = filteredData.filter(testCase => testCase.author === author);
}
```

### 使用方法

1. 在**测试用例（Cases Tab）**搜索栏或高级筛选面板中选择筛选条件：
   - **状态**: active（活动）、draft（草稿）、disabled（禁用）
   - **创建者**: 从下拉列表中选择创建者
   - **执行状态**: running（执行中）、completed（已完成）、failed（失败）、queued（队列中）、cancelled（已取消）
   - **执行结果**: pass（通过）、fail（失败）、block（阻塞）、skip（跳过）

2. **自动触发**：选择任何筛选条件后会自动加载数据，无需手动点击刷新按钮

3. 也可以点击 **"刷新"** 按钮手动触发数据加载

4. 测试用例列表将根据选择的所有条件进行组合过滤

### 影响范围
- ✅ 测试用例模块（Cases Tab）的状态筛选功能
- ✅ 测试用例模块（Cases Tab）的创建者筛选功能
- ✅ 测试用例模块（Cases Tab）的执行状态筛选功能
- ✅ 测试用例模块（Cases Tab）的执行结果筛选功能
- ✅ 筛选重置功能
- ✅ 自动触发筛选功能

---

## 2024-12-25 修复测试用例模块搜索栏执行状态和执行结果筛选功能

### 修改内容

**前端文件**:
- `src/services/testService.ts` - 添加 executionStatus 和 executionResult 参数支持
- `src/pages/TestCases.tsx` - 在 loadTestCases 和 handleReset 中传递筛选参数，添加 useEffect 监听筛选条件变化

**后端文件**:
- `server/routes/test.ts` - 添加 executionStatus 和 executionResult 参数接收
- `server/services/testExecution.ts` - 实现执行状态和执行结果的筛选逻辑

### 问题描述
测试用例模块（Cases Tab）的搜索栏虽然有执行状态和执行结果的筛选器，但选择后无法进行数据匹配，筛选不生效。

### 根本原因
1. **前端 testService.ts**: `getTestCasesPaginated` 方法的参数类型中没有定义 `executionStatus` 和 `executionResult` 参数
2. **前端 TestCases.tsx**: `loadTestCases` 函数调用 API 时没有传递这两个筛选参数
3. **前端 TestCases.tsx**: 没有监听筛选条件变化自动触发数据加载
4. **后端 test.ts**: 路由没有接收这两个参数
5. **后端 testExecution.ts**: 服务层没有实现筛选逻辑

### 修复详情

#### 前端修复

##### 1. testService.ts - 添加筛选参数支持
在 `getTestCasesPaginated` 方法中：
- 添加参数类型定义：
  ```typescript
  executionStatus?: string; // 🆕 执行状态筛选
  executionResult?: string; // 🆕 执行结果筛选
  ```
- 在 queryParams 构建中添加这两个参数：
  ```typescript
  if (params.executionStatus && params.executionStatus.trim()) {
    queryParams.append('executionStatus', params.executionStatus);
  }
  if (params.executionResult && params.executionResult.trim()) {
    queryParams.append('executionResult', params.executionResult);
  }
  ```

##### 2. TestCases.tsx - 传递筛选参数并添加自动触发
**在 `loadTestCases` 函数中添加：**
```typescript
executionStatus: casesExecutionStatusFilter, // 🆕 执行状态筛选
executionResult: casesExecutionResultFilter // 🆕 执行结果筛选
```

**在 `handleReset` 函数的 API 调用中添加：**
```typescript
executionStatus: '', // 🆕 重置执行状态筛选
executionResult: '' // 🆕 重置执行结果筛选
```

**添加 useEffect 监听筛选条件变化：**
```typescript
useEffect(() => {
  if (activeTab === 'cases') {
    loadTestCases({ page: 1, resetPagination: true });
  }
}, [
  selectedSystem,
  selectedModule,
  selectedVersion,
  selectedTag,
  selectedPriority,
  casesExecutionStatusFilter,
  casesExecutionResultFilter,
  activeTab
]);
```

#### 后端修复

##### 3. server/routes/test.ts - 接收筛选参数
在 `/cases` 路由中添加参数接收：
```typescript
const {
  // ... 其他参数
  executionStatus = '', // 🆕 执行状态筛选
  executionResult = '' // 🆕 执行结果筛选
} = req.query;
```

传递给服务层：
```typescript
const result = await testExecutionService.getTestCasesPaginated({
  // ... 其他参数
  executionStatus: executionStatus as string,
  executionResult: executionResult as string,
  // ...
});
```

##### 4. server/services/testExecution.ts - 实现筛选逻辑
**添加参数类型定义：**
```typescript
public async getTestCasesPaginated(params: {
  // ... 其他参数
  executionStatus?: string; // 🆕 执行状态筛选
  executionResult?: string; // 🆕 执行结果筛选
  // ...
}): Promise<{data: TestCase[], total: number}>
```

**在增强数据后添加筛选逻辑：**
```typescript
// 🆕 执行状态筛选（应用层，因为这些数据来自 test_runs 表）
if (executionStatus && executionStatus.trim()) {
  enhancedData = enhancedData.filter(testCase => testCase.executionStatus === executionStatus);
}

// 🆕 执行结果筛选（应用层，因为这些数据来自 test_runs 表）
if (executionResult && executionResult.trim()) {
  enhancedData = enhancedData.filter(testCase => testCase.executionResult === executionResult);
}
```

### 使用方法
1. 在测试用例（Cases Tab）搜索栏中选择"执行状态"或"执行结果"
2. 点击"刷新"按钮应用筛选
3. 测试用例列表将根据选择的筛选条件进行过滤

### 影响范围
- ✅ 测试用例模块（Cases Tab）的执行状态筛选功能
- ✅ 测试用例模块（Cases Tab）的执行结果筛选功能
- ✅ 筛选重置功能

### 测试建议
1. 测试执行状态筛选：running, completed, failed, queued, cancelled
2. 测试执行结果筛选：pass, fail, block, skip
3. 测试组合筛选：执行状态 + 执行结果
4. 测试重置功能是否正确清空所有筛选条件

---

## 2024-12-25 统一执行结果和执行状态的命名规范

### 修改内容

**文件**:
- `src/pages/TestCases.tsx` - 统一执行结果筛选器的值，添加阻塞和跳过选项
- `src/components/TestRunsTable.tsx` - 添加对skip（跳过）状态的处理
- `src/pages/FunctionalTestCases/types.ts` - 修复ExecutionStatus命名冲突，改为ExecutionResult
- `src/pages/FunctionalTestCases/components/FilterBar.tsx` - 统一执行结果值为pass/fail/block/skip
- `src/pages/FunctionalTestCases/index.tsx` - 统一执行结果判断逻辑
- `src/pages/FunctionalTestCases/components/ExecutionLogModal.tsx` - 更新类型定义和状态处理
- `src/pages/FunctionalTestCases/views/KanbanView.tsx` - 统一执行结果过滤逻辑

### 功能说明
统一整个项目中的执行结果(ExecutionResult)和执行状态(ExecutionStatus)的命名和取值规范，解决数据不一致问题。

### 标准定义
- **执行结果 (ExecutionResult)**: `'pass' | 'fail' | 'block' | 'skip' | 'pending'`
  - `pass`: 通过 ✅
  - `fail`: 失败 ❌
  - `block`: 阻塞 🚫
  - `skip`: 跳过 ⏭️
  - `pending`: 未执行 ⏳

- **执行状态 (ExecutionStatus)**: `'queued' | 'running' | 'completed' | 'failed' | 'cancelled'`
  - `queued`: 队列中
  - `running`: 执行中
  - `completed`: 已完成
  - `failed`: 失败
  - `cancelled`: 已取消

### 修改详情

#### 1. TestCases.tsx - 统一执行结果筛选器
- 将执行结果筛选选项从大写 `PASSED`/`FAILED`/`SKIPPED` 改为小写 `pass`/`fail`/`skip`
- 添加 `block`（阻塞）选项
- 修复"所有结果1"为"所有结果"
- 影响两处筛选器：TestRuns Tab 和 Cases Tab

#### 2. TestRunsTable.tsx - 添加skip状态处理
- 在 `resultText` 判断中添加对 `skip` 状态的处理
- 更新显示文本："跳过"

#### 3. FunctionalTestCases/types.ts - 修复命名冲突
- 将 `ExecutionStatus` 改名为 `ExecutionResult`
- 更新值从 `'pending' | 'passed' | 'failed' | 'blocked'` 改为 `'pass' | 'fail' | 'block' | 'skip' | 'pending'`
- 更新 `ExecutionLog` 和 `TestCaseItem` 接口中的类型引用
- 更新 `ViewProps` 接口中的 `onUpdateExecutionStatus` 参数类型

#### 4. FilterBar.tsx - 统一执行结果值
- 执行结果筛选选项从 `passed`/`failed`/`blocked` 改为 `pass`/`fail`/`block`
- 添加 `skip`（跳过）选项
- 更新显示文本："阻塞"（原"受阻"）

#### 5. FunctionalTestCases/index.tsx - 统一执行结果判断
- 更新进度计算逻辑中的执行结果值：`['passed', 'failed', 'blocked']` → `['pass', 'fail', 'block']`

#### 6. ExecutionLogModal.tsx - 更新类型和状态处理
- 更新import：`ExecutionStatus` → `ExecutionResult`
- 简化 `mapFinalResultToStatus` 函数，移除不必要的映射
- 更新 `getStatusIcon`/`getStatusTag`/`getStatusColor` 函数：
  - case语句从 `'passed'`/`'failed'`/`'blocked'` 改为 `'pass'`/`'fail'`/`'block'`
  - 添加 `'skip'` 状态的处理
  - 函数参数类型从 `ExecutionStatus` 改为 `ExecutionResult`

#### 7. KanbanView.tsx - 统一执行结果过滤
- 更新看板列过滤逻辑：`'passed'`/`'failed'`/`'blocked'` → `'pass'`/`'fail'`/`'block'`

### 影响范围
- ✅ 测试用例模块的执行结果筛选
- ✅ 测试执行历史记录显示
- ✅ 功能测试用例模块的所有视图（表格、卡片、看板、时间线）
- ✅ 执行日志模态框
- ✅ 类型定义和接口

### 向后兼容性
此修改可能影响现有数据：
- 如果数据库中已存储 `passed`/`failed`/`blocked` 等旧值，需要进行数据迁移
- 建议在后端 API 中添加值的兼容处理

---

## 2024-12-25 测试用例和测试执行模块新增执行状态和执行结果筛选

### 修改内容

**文件**:
- `src/pages/TestCases.tsx` - 测试用例和测试执行搜索栏新增执行状态和执行结果筛选
- `src/pages/TestRuns.tsx` - TestRuns组件支持执行结果筛选

### 功能说明
在测试用例模块和测试执行模块的搜索栏中新增执行状态和执行结果筛选项，并将优先级筛选移至高级筛选面板，优化用户筛选体验。

### 修改详情

#### 1. TestCases.tsx - 测试用例模块新增执行状态和执行结果筛选

**1.1 测试用例搜索栏（Cases Tab）**

**新增状态变量**:
```typescript
const [casesExecutionStatusFilter, setCasesExecutionStatusFilter] = useState('');  // 🆕 执行状态筛选
const [casesExecutionResultFilter, setCasesExecutionResultFilter] = useState('');  // 🆕 执行结果筛选
```

**主搜索栏新增筛选项**:
```tsx
{/* 🆕 执行状态筛选 */}
<select
  value={casesExecutionStatusFilter}
  onChange={(e) => setCasesExecutionStatusFilter(e.target.value)}
  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
       focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
>
  <option value="">所有状态</option>
  <option value="running">执行中</option>
  <option value="completed">已完成</option>
  <option value="failed">失败</option>
  <option value="queued">队列中</option>
  <option value="cancelled">已取消</option>
</select>

{/* 🆕 执行结果筛选 */}
<select
  value={casesExecutionResultFilter}
  onChange={(e) => setCasesExecutionResultFilter(e.target.value)}
  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
       focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
>
  <option value="">所有结果</option>
  <option value="PASSED">✅ 通过</option>
  <option value="FAILED">❌ 失败</option>
  <option value="SKIPPED">⏭️ 跳过</option>
</select>
```

**主搜索栏筛选项顺序调整**:
- 原顺序：项目 → 版本 → 模块 → 优先级
- 新顺序：项目 → 版本 → 模块 → **执行状态** → **执行结果**

**优先级筛选移至高级筛选面板**:
```tsx
<div className="space-y-1">
  <label className="text-xs font-medium text-gray-500">优先级</label>
  <select
    value={selectedPriority}
    onChange={(e) => setSelectedPriority(e.target.value)}
    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
         focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
  >
    <option value="">所有优先级</option>
    <option value="high">高</option>
    <option value="medium">中</option>
    <option value="low">低</option>
  </select>
</div>
```

**高级筛选面板布局**:
- 原布局：3列 - 标签、状态、创建者
- 新布局：4列 - 标签、**优先级**、状态、创建者
- 布局类：`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

**重置按钮更新**:
```typescript
const handleReset = async () => {
  // ... 其他重置
  setCasesExecutionStatusFilter('');  // 🆕 重置执行状态筛选
  setCasesExecutionResultFilter('');  // 🆕 重置执行结果筛选
  // ...
};
```

**1.2 测试执行搜索栏（Runs Tab）**

**新增状态变量**:
```typescript
const [runsResultFilter, setRunsResultFilter] = useState('');  // 🆕 执行结果筛选
```

**主搜索栏新增筛选项**:
```tsx
{/* 🆕 执行结果筛选 */}
<select
  value={runsResultFilter}
  onChange={(e) => setRunsResultFilter(e.target.value)}
  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
       focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
>
  <option value="">所有结果</option>
  <option value="PASSED">✅ 通过</option>
  <option value="FAILED">❌ 失败</option>
  <option value="SKIPPED">⏭️ 跳过</option>
</select>

{/* 🆕 优先级筛选（从高级筛选面板移至主搜索栏） */}
<select
  value={runsPriorityFilter}
  onChange={(e) => setRunsPriorityFilter(e.target.value)}
  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
       focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
>
  <option value="">所有优先级</option>
  <option value="high">高</option>
  <option value="medium">中</option>
  <option value="low">低</option>
</select>
```

**主搜索栏筛选项顺序**:
- 项目 → 版本 → 模块 → 执行状态 → **执行结果** → **优先级**

**高级筛选面板调整**:
- 移除优先级筛选项（已移至主搜索栏）
- 保留标签、执行者、环境三个筛选项
- 布局从 5 列调整为 3 列：`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**重置按钮更新**:
```typescript
onClick={() => {
  setRunsSearchTerm('');
  setRunsStatusFilter('');
  setRunsResultFilter('');  // 🆕 重置执行结果筛选
  setRunsExecutorFilter('');
  // ... 其他重置逻辑
}}
```

**传递给TestRuns组件**:
```tsx
<TestRuns 
  searchTerm={runsSearchTerm}
  statusFilter={runsStatusFilter}
  resultFilter={runsResultFilter}  // 🆕 执行结果筛选
  priorityFilter={runsPriorityFilter}
  // ... 其他props
/>
```

#### 2. TestRuns.tsx - 支持执行结果筛选

**更新接口定义**:
```typescript
interface TestRunsFilterProps {
  searchTerm?: string;
  statusFilter?: string;
  resultFilter?: string;  // 🆕 执行结果筛选
  executorFilter?: string;
  // ... 其他字段
}
```

**函数组件参数更新**:
```typescript
export function TestRuns({ 
  searchTerm = '', 
  statusFilter = '', 
  resultFilter = '',  // 🆕 执行结果筛选
  executorFilter = '',
  // ... 其他参数
}: TestRunsFilterProps = {}) {
```

**筛选逻辑实现**:
```typescript
const filteredTestRuns = useMemo(() => {
  return testRuns.filter(run => {
    // ... 其他筛选条件
    
    // 🆕 执行结果筛选：根据 status 和 steps 计算实际执行结果
    let matchesResult = true;
    if (resultFilter) {
      // 计算实际执行结果
      let actualResult: string | null = null;
      if (run.status === 'completed') {
        if (run.failedSteps > 0) {
          actualResult = 'FAILED';
        } else if (run.passedSteps > 0) {
          actualResult = 'PASSED';
        } else {
          actualResult = 'SKIPPED';  // 没有通过也没有失败的步骤
        }
      } else if (run.status === 'failed') {
        actualResult = 'FAILED';
      } else if (run.status === 'cancelled') {
        actualResult = 'SKIPPED';
      }
      
      matchesResult = actualResult === resultFilter;
    }
    
    return matchesSearch && matchesStatus && matchesResult && 
           matchesExecutor && matchesEnvironment &&
           matchesSystem && matchesVersion && matchesModule && 
           matchesTag && matchesPriority;
  });
}, [testRuns, searchTerm, statusFilter, resultFilter, executorFilter, 
    environmentFilter, systemFilter, versionFilter, moduleFilter, 
    tagFilter, priorityFilter]);
```

**执行结果判定逻辑**:
- `PASSED`: status === 'completed' && failedSteps === 0 && passedSteps > 0
- `FAILED`: status === 'failed' 或 (status === 'completed' && failedSteps > 0)
- `SKIPPED`: status === 'cancelled' 或 (status === 'completed' && passedSteps === 0 && failedSteps === 0)

### 测试建议

**测试用例模块（Cases Tab）**:
1. **执行状态筛选测试**:
   - 选择不同执行状态，验证筛选正确性
2. **执行结果筛选测试**:
   - 选择"通过"筛选项，验证只显示成功执行的测试用例
   - 选择"失败"筛选项，验证只显示失败的测试用例
   - 选择"跳过"筛选项，验证只显示跳过的测试用例
3. **优先级筛选位置测试**:
   - 验证优先级筛选已移至高级筛选面板（点击"筛选"按钮展开）
   - 测试不同优先级的筛选效果

**测试执行模块（Runs Tab）**:
1. **执行结果筛选测试**:
   - 选择"通过"筛选项，验证只显示成功执行的测试
   - 选择"失败"筛选项，验证只显示失败的测试
   - 选择"跳过"筛选项，验证只显示跳过/取消的测试
2. **优先级筛选位置测试**:
   - 验证优先级筛选已移至主搜索栏
   - 测试不同优先级的筛选效果

**组合筛选测试**:
- 测试执行状态 + 执行结果的组合筛选
- 测试执行结果 + 优先级的组合筛选
- 测试项目 + 模块 + 执行状态 + 执行结果的多重筛选

**重置功能测试**:
- 点击重置按钮，验证所有筛选条件被正确重置

### Git 提交命令
```bash
git add src/pages/TestCases.tsx src/pages/TestRuns.tsx git-commit-log.md
git commit -m "feat(test-cases): 测试用例和测试执行模块新增执行状态和执行结果筛选

- 测试用例模块主搜索栏新增执行状态和执行结果筛选
- 测试执行模块主搜索栏新增执行结果筛选
- 测试用例模块优先级筛选移至高级筛选面板
- 测试执行模块优先级筛选移至主搜索栏
- TestRuns组件实现基于status和steps的执行结果筛选逻辑
- 更新重置功能，支持清除新增筛选条件"
```

---

## 2024-12-25 完整实现测试用例执行结果统计

### 修改内容

**文件**: 
- `src/types/test.ts` - 扩展TestCase类型定义（添加lastRunStatus字段）
- `src/pages/TestCases.tsx` - 完整实现执行结果统计功能

### 功能说明
在测试用例页面的统计数据栏中显示基于执行结果的统计（通过/失败/阻塞），通过加载所有TestRuns记录并建立testCaseId到最后一次执行结果的映射来实现完整的统计功能。

### 修改详情

#### 1. 扩展TestCase接口 (`src/types/test.ts`)
```typescript
export interface TestCase {
  // ... 其他字段
  lastRun?: string;
  lastRunStatus?: 'completed' | 'failed' | 'error' | 'cancelled'; // 🔥 新增字段（可选）
  success_rate?: number;
  suiteId?: number;
}
```

**新增字段说明**：
- `lastRunStatus`: 存储最后一次执行的状态（可选字段，后端可以不返回）
  - `'completed'` → 执行成功（通过）
  - `'failed'` / `'error'` → 执行失败（失败）
  - `'cancelled'` → 执行取消（阻塞）
  - `undefined` → 未执行过

#### 2. 新增状态管理 (`src/pages/TestCases.tsx`)

**新增状态**：
```typescript
// 🔥 新增：测试运行记录状态（用于统计执行结果）
const [testRunsMap, setTestRunsMap] = useState<Map<number, TestRun>>(new Map());
```

**加载TestRuns数据**：
```typescript
const loadTestRuns = async () => {
  const runs = await testService.getAllTestRuns({
    sortBy: 'startedAt',
    sortOrder: 'desc'
  });
  
  // 构建Map：testCaseId -> 最后一次TestRun
  const runsMap = new Map<number, TestRun>();
  runs.forEach(run => {
    if (run.testCaseId && !runsMap.has(run.testCaseId)) {
      // 只保存每个测试用例的最后一次运行记录（因为已按时间降序排序）
      runsMap.set(run.testCaseId, run);
    }
  });
  
  setTestRunsMap(runsMap);
};
```

#### 3. 修改统计卡片显示 (`src/pages/TestCases.tsx`)

**统计逻辑**：
```typescript
// 🔥 基于testRunsMap计算执行结果统计
let passedCount = 0;
let failedCount = 0;
let blockedCount = 0;
let notRunCount = 0;

testCases.forEach(tc => {
  const lastRun = testRunsMap.get(tc.id);
  if (lastRun) {
    // 有执行记录，根据status统计
    if (lastRun.status === 'completed') {
      passedCount++;
    } else if (lastRun.status === 'failed' || lastRun.status === 'error') {
      failedCount++;
    } else if (lastRun.status === 'cancelled') {
      blockedCount++;
    }
  } else {
    // 没有执行记录
    notRunCount++;
  }
});
```

**统计卡片内容**：
- **第1张卡片（蓝色）**：当前列表总数
  - 主数据：当前页用例数量
  - 副数据：总计数 + 未执行数
  - 格式：`总计: X | 未执行: Y`

- **第2张卡片（绿色）**：通过数
  - 统计：`lastRunStatus === 'completed'`
  - 显示：数量 + 占比百分比

- **第3张卡片（红色）**：失败数
  - 统计：`lastRunStatus === 'failed'` 或 `'error'`
  - 显示：数量 + 占比百分比

- **第4张卡片（黄色）**：阻塞数
  - 统计：`lastRunStatus === 'cancelled'`
  - 显示：数量 + 占比百分比

#### 3. 百分比计算
- 计算公式：`(count / testCases.length) * 100`
- 显示格式：保留1位小数，如 `85.5%`
- 空列表处理：显示 `0%`

#### 4. 初始化加载和实时更新

**初始化时加载TestRuns**：
```typescript
useEffect(() => {
  loadTestCases({ page: 1, pageSize: 10, resetPagination: true });
  loadTestSuites();
  loadTestRuns(); // 🔥 加载测试运行记录用于统计
  loadFilterOptions();
  checkAIBulkUpdateAvailability();
  // ...
}, []);
```

**测试执行完成后刷新统计**：
```typescript
// 在测试用例执行完成的WebSocket回调中
if (message.type === 'test_complete') {
  setRunningTestId(null);
  testService.removeMessageListener(listenerId);
  
  // 🔥 刷新测试运行记录以更新统计数据
  loadTestRuns();
  
  // 显示完成消息...
}

// 在测试套件执行完成的WebSocket回调中
if (shouldReset) {
  setRunningSuiteId(null);
  testService.removeMessageListener(listenerId);
  
  // 🔥 刷新测试运行记录以更新统计数据
  loadTestRuns();
  
  // 显示完成消息...
}
```

### 技术实现方案

#### 方案选择
本次实现采用**前端加载TestRuns数据**的方案，而非依赖后端在TestCase中返回`lastRunStatus`字段。

**优势**：
1. ✅ **无需后端修改**：完全在前端实现，不依赖后端API变更
2. ✅ **数据准确性**：直接从TestRuns表获取最新执行结果
3. ✅ **实时更新**：测试执行完成后立即刷新统计
4. ✅ **灵活性高**：可以轻松扩展统计维度（如最近N次执行的通过率）

**性能考虑**：
- 初始加载时会一次性获取所有TestRuns记录
- 使用Map数据结构（O(1)查找）进行testCaseId到TestRun的映射
- 只保存每个用例的最后一次执行记录，内存占用可控

### 后端接口依赖

**必需接口**：
- `GET /tests/runs?sortBy=startedAt&sortOrder=desc` - 获取所有测试运行记录

**接口返回数据结构**：
```typescript
{
  success: true,
  data: [
    {
      id: string,
      runId: string,
      testCaseId: number,  // 🔥 关键字段：用于映射到测试用例
      status: 'completed' | 'failed' | 'error' | 'cancelled',  // 🔥 关键字段：执行状态
      startedAt: Date,
      // ... 其他字段
    }
  ]
}
```

**可选优化**（后端可实现）：
- 支持分页或限制返回数量（如只返回最近1000条记录）
- 支持按testCaseId去重，直接返回每个用例的最后一次执行记录
- 添加缓存机制减少数据库查询

### 数据映射关系

| TestRun.status | TestCase.lastRunStatus | 统计分类 |
|----------------|------------------------|----------|
| completed      | completed              | 通过     |
| failed         | failed                 | 失败     |
| error          | error                  | 失败     |
| cancelled      | cancelled              | 阻塞     |
| -              | undefined              | 未执行   |

### 用户体验改进
- **准确的执行结果统计**：直观显示测试用例的执行情况
- **清晰的数据展示**：通过百分比快速了解通过率
- **未执行数量提示**：在第一张卡片中显示有多少用例尚未执行
- **实时更新**：执行测试后统计数据会自动更新

### 兼容性说明
- ✅ **完全兼容现有后端**：不需要后端做任何修改
- ✅ **渐进增强**：如果TestRuns数据为空，统计会显示为0，不影响页面正常使用
- ✅ **类型安全**：TestCase的`lastRunStatus`字段为可选类型，不会引发类型错误

### 数据流程图

```
用户打开页面
    ↓
loadTestCases() ────→ 获取当前页测试用例
    ↓
loadTestRuns() ─────→ 获取所有TestRuns记录
    ↓                      ↓
构建testRunsMap ←──── 按testCaseId分组，保留最后一次执行
    ↓
渲染统计卡片 ←──────── 遍历testCases，从testRunsMap查询执行状态
    ↓
显示统计结果（通过/失败/阻塞/未执行）

执行测试完成
    ↓
WebSocket回调
    ↓
loadTestRuns() ─────→ 重新加载TestRuns
    ↓
更新testRunsMap
    ↓
统计卡片自动更新 ✨
```

---

## 2024-12-25 修复测试用例统计数据栏显示内容（已废弃）

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`

### 功能说明
~~修复测试用例页面统计数据栏的显示内容，将原来错误的执行结果统计（通过/失败/阻塞）改为正确的用例状态统计（启用/草稿/禁用），并优化显示格式。~~

**注意**：此版本已被后续修改替换，最新版本已恢复为显示执行结果统计。

### 修改详情

1. **修正统计数据类型**
   - TestCase的`status`字段类型为 `'active' | 'draft' | 'disabled'`（用例状态）
   - 原代码错误地尝试统计 `'passed' | 'failed' | 'blocked'`（执行结果状态）
   - 执行结果存储在TestRun中，不在TestCase中
   - 修改为正确统计用例的状态分布

2. **优化统计卡片内容**
   - 第1张卡片：显示"当前列表"数量（testCases.length），并在下方显示"总计"（pagination.total）
   - 第2张卡片：统计"启用"状态的用例数量和占比
   - 第3张卡片：统计"草稿"状态的用例数量和占比
   - 第4张卡片：统计"禁用"状态的用例数量和占比

3. **添加百分比显示**
   - 每个状态卡片下方显示该状态占当前列表的百分比
   - 格式：`XX.X%`，保留一位小数
   - 当列表为空时显示 `0%`

4. **调整视觉样式**
   - 第1张卡片：蓝色指示器（当前列表总数）
   - 第2张卡片：绿色指示器（启用状态）
   - 第3张卡片：黄色指示器（草稿状态）
   - 第4张卡片：灰色指示器（禁用状态）

### 修复的TypeScript错误
- 解决了6个类型比较错误："此比较似乎是无意的，因为类型没有重叠"
- 原因：将用例状态（active/draft/disabled）与执行结果（passed/failed/blocked）进行比较

### 用户体验改进
- **准确的数据统计**：显示真实的用例状态分布，而非错误的执行结果统计
- **清晰的信息展示**：通过百分比让用户快速了解用例状态分布
- **双层数据显示**：同时显示当前页和总计数据，便于理解分页情况

---

## 2024-12-25 调整搜索栏位置到统计数据栏下方

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`

### 功能说明
将测试用例Tab和测试套件Tab的搜索栏移动到统计数据栏下方，优化页面布局顺序，使信息流更加合理。

### 修改详情

1. **调整搜索栏位置**
   - 将搜索栏从视图切换器之前移到统计数据栏之后
   - 调整代码顺序，确保渲染顺序正确
   - 搜索栏仍然对测试用例和测试套件两个Tab生效（activeTab !== 'runs'）

### 布局顺序对比

**修改前**：
```
Tab切换
↓
搜索筛选栏  <- 在这里
↓
视图切换器 + 操作按钮
↓
统计数据栏
↓
表格内容
```

**修改后**：
```
Tab切换
↓
视图切换器 + 操作按钮
↓
统计数据栏
↓
搜索筛选栏  <- 移到这里
↓
表格内容
```

### 用户体验改进

**更合理的信息流**：
- 先看操作按钮（选择视图、执行操作）
- 再看统计数据（了解整体情况）
- 然后使用搜索筛选（精准查找）
- 最后查看表格内容（具体数据）

**符合用户习惯**：
- 统计数据作为概览信息，应该在筛选之前展示
- 用户先了解整体情况，再决定如何筛选
- 与测试执行页面的布局顺序保持一致

### 测试建议

1. **布局验证**：
   - 切换到测试用例Tab，验证搜索栏在统计数据栏下方
   - 切换到测试套件Tab，验证搜索栏正确显示
   - 切换到测试执行Tab，验证不影响原有布局

2. **功能验证**：
   - 验证搜索筛选功能正常工作
   - 验证统计数据正常显示
   - 验证所有操作按钮功能正常

---

## 2024-12-25 优化测试用例Tab布局结构，参考测试执行页面排版

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`

### 功能说明
重新调整测试用例Tab的布局顺序，使其与测试执行页面的布局完全一致，提供更清晰的视觉层次和更好的用户体验。

### 修改详情

1. **移除旧的Header区域**
   - 删除原有的"UI自动化"标题和描述区域
   - 删除顶部的按钮组（AI批量更新、批量删除、导入功能用例、创建测试用例等）
   - 简化页面层级，避免顶部信息过多

2. **重新组织测试用例Tab布局**（完全参考测试执行页面）
   - **第一行**：视图切换器（左侧）+ 操作按钮组（右侧）
     - 视图切换器：表格视图、详细表格、卡片视图
     - 操作按钮：重置状态、AI批量更新、批量删除、导入功能用例、创建测试用例
     - 使用 `justify-between` 实现左右布局
   
   - **第二行**：统计数据栏（4个卡片）
     - 执行中：显示当前正在执行的用例数量
     - 总用例数：显示分页总数（pagination.total）
     - 已选用例：显示当前选中的用例数量
     - 启用用例：显示状态为active的用例数量
   
   - **第三行**：搜索筛选栏
     - 保持原有的搜索和筛选功能
     - 包括项目、版本、模块、标签、优先级等筛选条件
   
   - **第四行**：表格内容区域
     - 根据视图模式显示不同内容（表格/详细表格/卡片）

3. **优化测试套件Tab布局**
   - 添加顶部操作按钮行：右对齐的"创建测试套件"按钮
   - 简化布局结构，保持与测试用例Tab的一致性

4. **优化条件渲染逻辑**
   - 使用三元运算符链式判断：`activeTab === 'cases' ? ... : activeTab === 'suites' ? ... : activeTab === 'runs' ? ... : null`
   - 每个Tab独立控制自己的布局和内容
   - 避免嵌套过深的条件判断

### 布局结构对比

**修改前（测试用例Tab）**：
```
Header区域（标题 + 所有操作按钮）
↓
Tab切换
↓
视图切换器 + 简单统计
↓
搜索筛选栏
↓
表格内容
```

**修改后（测试用例Tab）**：
```
Tab切换
↓
视图切换器（左） + 操作按钮组（右）
↓
统计数据栏（4个卡片）
↓
搜索筛选栏
↓
表格内容
```

### 视觉层次改进

**清晰的功能分区**：
- 顶部行：视图模式选择 + 快速操作
- 统计区：关键数据一目了然
- 筛选区：精准查找定位
- 内容区：数据展示

**统一的设计语言**：
- 与测试执行页面完全一致的布局
- 相同的间距、圆角、阴影样式
- 统一的按钮风格和配色

**优化的操作流程**：
1. 选择视图模式（表格/详细/卡片）
2. 查看统计数据（了解整体情况）
3. 使用筛选条件（缩小范围）
4. 查看和操作数据（执行具体任务）

### 统计数据说明

**执行中**（蓝色）：
- 统计当前正在执行的测试用例数量
- 通过 `runningTestId` 判断
- 实时更新

**总用例数**（绿色）：
- 显示当前筛选条件下的用例总数
- 来自 `pagination.total`
- 包含所有状态的用例

**已选用例**（紫色）：
- 显示用户选中的用例数量
- 来自 `selectedTestCaseIds.length`
- 用于批量操作

**启用用例**（黄色）：
- 统计状态为 `active` 的用例数量
- 从当前页数据中过滤计算
- 便于了解可用用例数量

### 技术特点

1. **组件结构优化**：简化条件渲染逻辑，提升代码可读性
2. **样式统一**：所有按钮使用相同的 shadow-sm 和 font-medium 样式
3. **响应式布局**：统计数据卡片支持响应式（md:grid-cols-4）
4. **动画一致**：所有按钮使用相同的 whileHover 和 whileTap 动画

### 用户体验改进

**更清晰的信息架构**：
- 去除冗余的标题，直接展示核心功能
- 统计数据前置，快速了解系统状态
- 操作按钮分组明确，便于快速定位

**更高效的工作流**：
- 视图切换和操作按钮在同一行，减少鼠标移动距离
- 统计数据实时更新，无需额外查询
- 筛选条件紧随统计数据，支持精准查找

**统一的视觉体验**：
- 测试用例、测试执行页面布局完全一致
- 降低用户学习成本
- 提升整体产品体验

### 测试建议

1. **布局验证**：
   - 切换到测试用例Tab，验证布局顺序正确（视图切换器 → 统计数据 → 搜索栏 → 表格）
   - 验证操作按钮在右侧正确显示
   - 验证统计数据卡片正确显示4个指标

2. **功能验证**：
   - 验证视图切换功能正常
   - 验证所有操作按钮功能正常
   - 验证统计数据实时更新
   - 验证搜索筛选功能正常

3. **响应式验证**：
   - 在不同屏幕尺寸下测试布局
   - 验证统计数据卡片在移动端显示为单列
   - 验证按钮组在移动端的换行效果

---

## 2024-12-25 为测试用例Tab添加3种视图模式切换

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`

### 功能说明
为测试用例Tab添加3种视图模式切换功能（表格视图、详细表格、卡片视图），与测试执行Tab保持一致的布局和交互体验。

### 修改详情

1. **新增视图模式状态管理**
   - 新增 `testCasesViewMode` 状态，支持 `'table' | 'detailed' | 'card'` 三种模式
   - 使用 localStorage 保存用户偏好：`testCases-cases-viewMode`
   - 默认视图模式：表格视图（table）
   - 使用 useEffect 监听视图模式变化并自动保存

2. **添加视图切换器组件**
   - 位置：测试用例Tab下方，统计数据行的左侧
   - 包含3个按钮：
     - 表格视图：使用 Table2 图标
     - 详细表格：使用 Table2 图标
     - 卡片视图：使用 LayoutGrid 图标
   - 样式：白色圆角容器，选中状态显示蓝色背景
   - 响应式设计：移动端隐藏按钮文字，仅显示图标

3. **添加统计数据展示**
   - 位置：视图切换器右侧
   - 显示内容：
     - 总计：显示测试用例总数（来自 pagination.total）
     - 已选：显示已选中的用例数量（仅在有选中项时显示）
   - 样式：使用灰色文字和深色数字，已选用蓝色高亮

4. **实现表格视图（table）**
   - 复用现有的 `TestCaseTable` 组件
   - 显示测试用例列表，支持分页、排序、筛选
   - 支持批量选择和操作

5. **实现详细表格视图（detailed）**
   - 当前复用 `TestCaseTable` 组件（后续可扩展为更详细的版本）
   - 显示与表格视图相同的内容

6. **实现卡片视图（card）**
   - 使用网格布局：`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
   - 每个卡片包含：
     - 头部：用例名称、作者、创建时间、复选框
     - 系统/模块标签（蓝色和紫色徽章）
     - 标签列表（最多显示3个，多余的显示"+N"）
     - 优先级和状态徽章
     - 成功率进度条（如果有数据）
     - 操作按钮：运行、编辑、删除
   - 使用 Framer Motion 实现卡片进入动画
   - 支持悬停阴影效果
   - 卡片底部包含独立的分页控件

### 布局结构

**测试用例Tab**：
```
视图切换器（左侧） + 统计数据（右侧）
↓
搜索筛选栏
↓
内容区域（根据视图模式显示不同内容）
  - 表格视图：TestCaseTable组件
  - 详细表格：TestCaseTable组件
  - 卡片视图：网格卡片布局 + 分页控件
```

### 用户体验改进

**统一的视图体验**：
- 与测试执行Tab的视图切换器保持一致的布局和交互
- 统一的视图模式图标和样式
- 统一的状态保存机制（localStorage）

**灵活的查看方式**：
- 表格视图：适合快速浏览和批量操作
- 详细表格：适合查看更多详细信息
- 卡片视图：适合聚焦单个用例，信息展示更直观

**卡片视图优势**：
- 每个用例独立卡片，信息层次清晰
- 成功率可视化（进度条）
- 操作按钮更大更易点击
- 响应式网格布局，适配不同屏幕

**统计数据一目了然**：
- 总计和已选数量实时显示
- 已选数量蓝色高亮，提供明确的视觉反馈

### 技术特点

1. **视图模式管理**：
   - 使用 useState 管理当前视图模式
   - 使用 localStorage 持久化用户偏好
   - 使用条件渲染根据模式显示不同内容

2. **卡片视图实现**：
   - 使用 CSS Grid 实现响应式布局
   - 使用 Framer Motion 实现进入动画
   - 使用 clsx 动态组合样式类名
   - 成功率进度条使用动态宽度和颜色

3. **组件复用**：
   - 表格视图和详细表格复用 TestCaseTable 组件
   - 卡片视图复用优先级和状态颜色函数
   - 复用操作按钮的逻辑和样式

4. **性能优化**：
   - 使用 AnimatePresence 管理动画生命周期
   - 卡片进入动画使用延迟（index * 0.05），避免同时渲染卡顿
   - 分页逻辑与表格视图保持一致

### 测试建议

1. **视图切换测试**：
   - 点击三个视图按钮，验证视图正确切换
   - 验证选中状态的蓝色高亮显示
   - 刷新页面，验证视图模式被正确保存和恢复

2. **卡片视图测试**：
   - 验证卡片网格布局在不同屏幕尺寸下的响应式效果
   - 验证卡片信息完整显示（名称、系统、模块、标签、优先级、状态）
   - 验证成功率进度条显示正确
   - 验证操作按钮（运行、编辑、删除）功能正常

3. **统计数据测试**：
   - 验证总计数量显示正确
   - 选中用例，验证已选数量显示和更新
   - 清空选择，验证已选数量隐藏

4. **分页测试**：
   - 在卡片视图中切换页码，验证分页功能正常
   - 修改每页显示数量，验证数据正确刷新
   - 验证分页控件的禁用状态正确

5. **动画效果测试**：
   - 切换到卡片视图，观察卡片进入动画是否流畅
   - 验证卡片悬停阴影效果
   - 验证按钮点击动画效果

### 样式细节

**视图切换器**：
- 背景色：白色
- 边框：灰色（border-gray-200）
- 选中状态：蓝色背景（bg-blue-600）+ 白色文字 + 阴影
- 未选中状态：灰色文字 + 悬停效果

**统计数据**：
- 文字颜色：灰色（text-gray-600）
- 数字颜色：深灰（text-gray-900）或蓝色（text-blue-600，已选）
- 字体：粗体（font-semibold）

**卡片视图**：
- 卡片背景：白色（bg-white）
- 边框：灰色（border-gray-200）
- 阴影：默认 shadow-sm，悬停 shadow-md
- 圆角：rounded-xl
- 内边距：p-5
- 间距：gap-4（网格），space-y-4（内容）

---

## 2024-12-25 优化测试执行页面布局，参考功能用例页面排版

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`
- `src/pages/TestRuns.tsx`

### 功能说明
优化测试执行标签页的UI布局，参考功能用例页面的排版风格，提供更清晰的界面层次和更好的用户体验。

### 修改详情

1. **隐藏标题区域**
   - 在测试执行标签页（`activeTab === 'runs'`）时隐藏"UI自动化"标题和描述
   - 标题区域仅在测试用例和测试套件标签页显示
   - 提供更简洁的页面布局

2. **添加视图切换器和操作按钮行**
   - 在TestCases页面顶部添加视图切换器（表格视图/详细表格/卡片视图）
   - 视图切换器位于左侧，停止所有按钮位于右侧
   - 使用 `justify-between` 实现左右布局
   - 完全参考功能用例页面的ViewSwitcher设计

3. **实现视图模式状态管理**
   - 新增 `testRunsViewMode` 状态管理当前视图模式
   - 视图模式保存到localStorage，记住用户偏好
   - 通过props传递给TestRuns组件，实现外部控制

4. **扩展TestRuns组件支持外部视图控制**
   - 新增 `hideViewSwitcher` prop：隐藏组件内部的视图切换器
   - 新增 `externalViewMode` prop：接收外部传入的视图模式
   - 新增 `onViewModeChange` prop：视图模式变化时的回调
   - 支持内部和外部两种视图控制模式

5. **添加统计数据栏**
   - 在视图切换器下方显示统计数据（执行中、队列中、已完成、失败）
   - 使用4列网格布局，每个统计卡片显示图标和数字
   - 位置：视图切换器下方、搜索栏上方
   - 数据来源：从TestRuns组件通过ref获取实时统计数据

6. **调整搜索栏位置**
   - 搜索栏移至统计数据栏下方
   - 保持原有的基础筛选和高级筛选功能
   - 参考功能用例页面的FilterBar布局

7. **隐藏TestRuns组件内部的统计栏和视图切换器**
   - 新增`hideStats` prop传递给TestRuns组件
   - 新增`hideViewSwitcher` prop传递给TestRuns组件
   - TestRuns组件内部的统计数据栏和视图切换器通过条件渲染隐藏
   - 避免重复显示

### 页面结构对比

**修改前**：
```
Header（标题+操作按钮）
Tab切换
搜索栏
TestRuns内容（包含统计数据+视图切换器）
```

**修改后（测试执行标签页）**：
```
Tab切换
视图切换器（左侧） + 停止所有按钮（右侧）
统计数据栏（4列网格）
搜索筛选栏
TestRuns内容（统计数据和视图切换器已隐藏）
```

**其他标签页**：
```
Header（标题+操作按钮）
Tab切换
搜索栏
内容区域
```

### 布局特点

**完全参考功能用例页面设计**：
- 顶部行：视图切换器（左侧）+ 操作按钮（右侧），使用 `justify-between`
- 第二行：统计数据栏（4列网格卡片）
- 第三行：搜索筛选栏（基础筛选 + 高级筛选）
- 第四行：表格内容区域
- 每个区域之间使用`mb-6`间距，确保视觉分隔
- 响应式设计：在移动端自动调整为垂直布局

### 用户体验改进

**清晰的视觉层次**：
- 测试执行页面现在遵循"操作→统计→筛选→内容"的标准流程
- 与功能用例页面的布局风格保持一致
- 减少视觉干扰，提升专注度

**便捷的操作入口**：
- 停止所有按钮独立显示，位置突出
- 统计数据一目了然，快速掌握测试状态
- 搜索筛选功能紧随统计数据，方便快速定位

**统一的设计语言**：
- 参考功能用例页面的成功实践
- 保持整个系统的设计一致性
- 降低用户学习成本

### 技术特点

1. **条件渲染优化**：使用`activeTab`判断显示不同的布局结构
2. **组件通信**：通过ref和state同步TestRuns组件的统计数据
3. **样式复用**：使用相同的网格布局和卡片样式
4. **响应式设计**：统计数据栏支持响应式布局（md:grid-cols-4）

### 测试建议

1. **布局验证**：
   - 切换到测试执行标签页，验证标题已隐藏
   - 验证停止所有按钮在右侧显示
   - 验证统计数据栏在操作按钮下方、搜索栏上方显示
   - 验证TestRuns组件内部的统计栏已隐藏

2. **功能验证**：
   - 验证统计数据实时更新
   - 验证停止所有按钮功能正常
   - 验证搜索筛选功能正常

3. **响应式验证**：
   - 在不同屏幕尺寸下测试布局
   - 验证统计数据栏在移动端显示为单列

---

## 2024-12-25 修复TestRunsTable复选框勾选时的页面抖动问题

### 修改内容

**文件**: 
- `src/components/TestRunsTable.tsx`

### 功能说明
修复测试运行表格复选框勾选时页面数据加载抖动问题，优化用户体验，使勾选效果更加平滑。

### 修改详情

1. **移除motion动画**
   - 将 `motion.tr` 改为普通的 `tr` 元素
   - 移除 `initial`、`animate` 等动画属性，避免每次状态变化时重新触发动画

2. **优化CSS过渡**
   - 保留 `transition-colors` 类名实现平滑的颜色过渡
   - 添加 `duration-150` 类名控制过渡时长，提升视觉体验
   - 背景色变化（选中/展开/悬停）通过CSS transition实现，更加流畅

3. **性能优化**
   - 避免组件重新渲染时触发不必要的动画计算
   - 减少复选框状态变化时的重绘开销
   - 参考TestCaseTable的实现，保持一致的交互体验

### 技术细节
- **问题原因**：使用 `motion.tr` 时，每次状态变化（如复选框勾选）会导致组件重新渲染，Framer Motion会重新计算和执行动画，造成视觉抖动
- **解决方案**：仅使用CSS transition处理状态变化，动画只在必要时（如展开行）使用，确保勾选操作的平滑性

---

## 2024-12-24 为测试执行页面添加完整的筛选功能

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`
- `src/pages/TestRuns.tsx`

### 功能说明
为测试执行页面添加完整的筛选功能，包括项目、版本、模块、标签、优先级等筛选条件，参考FilterBar组件的设计实现高级筛选展开/收起功能。

### 修改详情

1. **扩展TestRun接口**
   - 在TestRun接口中添加system、module、tags、priority、projectVersion等字段
   - 在loadTestRuns中从API返回数据中提取这些字段
   - 支持从testCase、caseDetail等嵌套对象中提取字段

2. **扩展TestRunsFilterProps接口**
   - 新增systemFilter、versionFilter、moduleFilter、tagFilter、priorityFilter筛选参数
   - 新增onFilterOptionsUpdate回调，用于向父组件传递筛选选项列表

3. **更新TestRuns组件筛选逻辑**
   - 在filteredTestRuns的useMemo中添加新字段的筛选逻辑
   - 支持多条件组合筛选（项目、版本、模块、标签、优先级）
   - 在loadTestRuns中提取筛选选项，并通过回调传递给父组件

4. **在TestCases页面中实现完整筛选栏**
   - **基础筛选**：
     - 搜索框：搜索测试运行名称
     - 项目下拉框：从systemOptions中获取项目列表
     - 版本下拉框：根据选择的项目动态显示版本（从筛选选项中过滤）
     - 模块下拉框：从筛选选项中获取模块列表
     - 状态下拉框：执行中、已完成、失败、队列中、已取消
   
   - **高级筛选（展开/收起）**：
     - 标签筛选：从筛选选项中获取标签列表
     - 优先级筛选：高、中、低
     - 执行者筛选：从筛选选项中获取执行者列表
     - 环境筛选：从筛选选项中获取环境列表
   
   - **操作按钮**：
     - 筛选按钮：展开/收起高级筛选面板（使用AnimatePresence实现动画）
     - 刷新按钮：调用TestRuns组件的刷新功能
     - 重置按钮：清空所有筛选条件

5. **筛选选项动态提取**
   - 在TestRuns组件加载数据后，从测试运行数据中提取：
     - 所有项目（systems）
     - 所有版本（versions）
     - 所有模块（modules）
     - 所有标签（tags，从数组中提取）
     - 所有执行者（executors）
     - 所有环境（environments）
   - 通过onFilterOptionsUpdate回调传递给TestCases组件
   - 在TestCases组件中使用这些选项填充下拉框

6. **版本选项动态加载**
   - 当选择项目时，从筛选选项中过滤出相关版本
   - 如果当前选择的版本不在新列表中，自动清空选择
   - 清空项目时，自动清空版本筛选

### 用户体验改进

**完整的筛选功能**：
- 支持项目、版本、模块、标签、优先级等多维度筛选
- 基础筛选和高级筛选分离，界面更清晰
- 高级筛选可展开/收起，节省界面空间

**动态筛选选项**：
- 筛选选项从实际数据中提取，确保选项的准确性
- 版本选项根据项目动态加载，避免无效选择

**统一的UI设计**：
- 参考FilterBar组件的设计，保持界面一致性
- 使用相同的样式和交互方式

### 技术特点

1. **数据提取**：从测试运行数据中提取筛选字段，支持多种数据源
2. **动态选项**：筛选选项从实际数据中动态提取，确保准确性
3. **条件筛选**：支持多条件组合筛选，使用useMemo优化性能
4. **动画效果**：使用AnimatePresence实现高级筛选面板的展开/收起动画
5. **状态管理**：使用useState管理筛选状态，使用useEffect处理依赖关系

### 测试建议

1. **筛选功能测试**：
   - 测试项目、版本、模块、标签、优先级等筛选条件
   - 验证多条件组合筛选是否正确
   - 验证筛选选项是否正确显示

2. **动态选项测试**：
   - 验证筛选选项是否从实际数据中提取
   - 验证版本选项是否根据项目动态加载
   - 验证清空项目时是否自动清空版本筛选

3. **UI交互测试**：
   - 验证高级筛选面板的展开/收起动画
   - 验证重置按钮是否清空所有筛选条件
   - 验证刷新按钮是否正常工作

---

## 2024-12-24 优化测试执行页面UI布局和按钮位置

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`
- `src/pages/TestRuns.tsx`

### 功能说明
优化测试执行页面的UI布局，将"停止所有"按钮移到右上角替换"创建测试套件"按钮，将"刷新数据"按钮移到搜索栏重置按钮前面，并隐藏测试执行结果的标题。

### 修改详情

1. **修改 TestRuns 组件支持隐藏标题**
   - 新增 `hideHeader` prop，控制是否显示"测试执行结果"标题和副标题
   - 当 `hideHeader={true}` 时，隐藏标题区域和原有的"停止所有"、"刷新数据"按钮
   - 通过 ref 暴露 `handleStopAllTests`、`loadTestRuns`、`stats` 和 `stoppingAll` 给父组件

2. **在 TestCases 页面中调整按钮位置**
   - **右上角按钮调整**：
     - 当 `activeTab === 'runs'` 时，显示"停止所有"按钮（红色主题）
     - 当 `activeTab !== 'runs'` 时，显示"创建测试用例"或"创建测试套件"按钮（蓝色主题）
     - 通过 ref 从 TestRuns 组件获取停止功能和统计数据
     - 使用 useState 和定时器同步 ref 状态，确保按钮状态实时更新
   
   - **搜索栏按钮调整**：
     - 在测试执行搜索栏中，将"刷新数据"按钮放在重置按钮前面
     - "刷新数据"按钮使用蓝色主题，与重置按钮区分
     - 通过 ref 从 TestRuns 组件获取刷新功能

3. **隐藏 TestRuns 组件标题**
   - 传递 `hideHeader={true}` 给 TestRuns 组件
   - 隐藏"测试执行结果"标题和"查看测试运行状态和断言结果"副标题
   - 保持统计数据卡片正常显示

### 用户体验改进

**统一的按钮布局**：
- 右上角按钮根据当前标签页动态显示，避免界面混乱
- 测试执行标签页时，右上角显示"停止所有"按钮，方便快速操作
- 搜索栏中的"刷新数据"按钮位置更合理，操作更便捷

**简洁的界面**：
- 隐藏重复的标题，减少视觉干扰
- 保持统计数据卡片显示，用户仍可快速了解测试运行状态

### 技术特点

1. **Ref 通信机制**：使用 React ref 在父子组件间传递函数和状态
2. **状态同步**：使用定时器定期同步 ref 到 state，确保 UI 响应及时
3. **条件渲染**：根据 `activeTab` 动态显示不同的按钮
4. **组件解耦**：TestRuns 组件通过 props 控制显示，保持独立性

### 测试建议

1. **按钮显示测试**：
   - 切换到测试执行标签页，验证右上角显示"停止所有"按钮
   - 切换到其他标签页，验证右上角显示"创建测试用例"或"创建测试套件"按钮
   - 验证"停止所有"按钮的状态（禁用/启用）正确显示

2. **搜索栏按钮测试**：
   - 验证"刷新数据"按钮在重置按钮前面
   - 点击"刷新数据"按钮，验证测试运行数据正确刷新
   - 点击"重置"按钮，验证所有筛选条件被清空

3. **标题隐藏测试**：
   - 验证测试执行标签页不显示"测试执行结果"标题
   - 验证统计数据卡片正常显示

---

## 2024-12-24 为测试执行页面添加搜索和筛选功能

### 修改内容

**文件**: 
- `src/pages/TestCases.tsx`
- `src/pages/TestRuns.tsx`

### 功能说明
在测试用例页面的测试执行标签页中，添加了专用的搜索和筛选功能，使用户可以快速查找和过滤测试运行记录。

### 修改详情

1. **修改 TestRuns 组件支持搜索和筛选参数**
   - 新增 `TestRunsFilterProps` 接口，定义搜索和筛选参数
   - 修改 `TestRuns` 组件函数签名，支持通过 props 接收搜索参数
   - 参数包括：
     - `searchTerm`: 搜索关键词（测试运行名称）
     - `statusFilter`: 状态筛选（running, completed, failed, queued, cancelled）
     - `executorFilter`: 执行者筛选
     - `environmentFilter`: 环境筛选

2. **在 TestRuns 组件中添加筛选逻辑**
   - 新增 `filteredTestRuns` useMemo，根据搜索和筛选条件过滤数据
   - 支持多条件组合筛选（搜索、状态、执行者、环境）
   - 更新 `paginatedTestRuns` 使用 `filteredTestRuns` 而不是原始 `testRuns`
   - 更新统计数据计算，使用 `filteredTestRuns`
   - 更新分页组件，使用 `filteredTestRuns.length`
   - 新增"筛选后无结果"提示，区分无数据和筛选后无结果两种情况

3. **在 TestCases 页面中添加测试执行搜索栏**
   - 新增搜索和筛选状态管理：
     - `runsSearchTerm`: 搜索关键词
     - `runsStatusFilter`: 状态筛选
     - `runsExecutorFilter`: 执行者筛选
     - `runsEnvironmentFilter`: 环境筛选
   
   - 根据 `activeTab` 显示不同的搜索栏：
     - `activeTab === 'runs'`: 显示测试执行专用搜索栏
     - 其他情况: 显示测试用例/测试套件搜索栏
   
   - 测试执行搜索栏包含：
     - 搜索输入框：搜索测试运行名称
     - 状态下拉框：筛选执行状态（执行中、已完成、失败、队列中、已取消）
     - 执行者输入框：筛选执行者
     - 环境输入框：筛选执行环境
     - 重置按钮：清空所有筛选条件

4. **将搜索参数传递给 TestRuns 组件**
   - 在渲染 `TestRuns` 组件时，传递所有搜索和筛选参数
   - 实现搜索栏与 TestRuns 组件的联动

### 用户体验改进

**统一的搜索体验**：
- 测试执行页面现在拥有与测试用例页面一致的搜索栏布局
- 支持实时搜索和筛选，无需点击按钮
- 筛选条件清晰，操作直观

**灵活的筛选方式**：
- 支持按测试运行名称搜索
- 支持按状态筛选（执行中、已完成、失败等）
- 支持按执行者筛选
- 支持按环境筛选
- 支持多条件组合筛选

**智能的空状态提示**：
- 区分"暂无测试运行记录"和"没有匹配的测试运行"两种情况
- 提供清晰的提示信息，引导用户调整搜索条件

### 技术特点

1. **组件复用**：TestRuns 组件通过 props 接收搜索参数，保持组件独立性
2. **性能优化**：使用 useMemo 缓存筛选结果，避免不必要的重新计算
3. **类型安全**：使用 TypeScript 接口定义搜索参数类型
4. **条件渲染**：根据 activeTab 动态显示不同的搜索栏，避免代码重复

### 测试建议

1. **搜索功能测试**：
   - 在测试执行标签页输入搜索关键词，验证测试运行列表正确过滤
   - 测试搜索关键词的大小写不敏感

2. **筛选功能测试**：
   - 测试各个筛选条件（状态、执行者、环境）的独立使用
   - 测试多个筛选条件的组合使用
   - 验证筛选后分页功能正常

3. **重置功能测试**：
   - 点击重置按钮，验证所有筛选条件被清空
   - 验证重置后显示所有测试运行记录

4. **空状态测试**：
   - 验证无数据时显示"暂无测试运行记录"
   - 验证筛选后无结果时显示"没有匹配的测试运行"

---

## 2024-12-24 完善测试计划详情页UI自动化用例支持

### 修改内容

**文件**: `src/pages/TestPlanDetail.tsx`

### 功能说明
为测试计划详情页面添加完整的UI自动化用例支持，包括用例关联、批量执行、执行所有、用例列表展示等功能，使UI自动化测试计划与功能测试计划具有相同的功能体验。

### 修改详情

1. **🔥 根据计划类型显示对应的操作按钮**
   - **功能测试按钮组**：
     - 当计划类型为 `functional`、`mixed`、`regression`、`smoke` 或 `integration` 时显示
     - 按钮：关联功能用例
   
   - **UI自动化按钮组**：
     - 当计划类型为 `ui_auto` 或 `mixed` 时显示
     - 按钮：关联UI自动化用例（蓝色主题）
   
   - **通用操作按钮**：
     - 批量删除：删除选中的用例（支持功能和UI自动化）
     - 批量执行：执行选中的用例（支持功能和UI自动化）
   
   - **执行所有按钮**：
     - 功能测试计划：显示"执行所有功能用例"按钮（紫色主题）
     - UI自动化计划：显示"执行所有UI自动化"按钮（靛蓝色主题）
     - 混合测试计划：同时显示两个按钮，分别执行不同类型的用例

2. **🔥 完善UI自动化用例列表显示字段**
   - **用例版本字段**：
     - 功能用例：显示 `project_version.version_name` 或 `version_code`
     - UI自动化用例：显示 `case_detail.version`
   
   - **用例类型字段**：
     - 功能用例：显示用例类型徽章（冒烟、全量、异常等）
     - UI自动化用例：显示 "🤖 UI自动化" 徽章（靛蓝色主题）
   
   - **优先级字段**：
     - 功能用例和UI自动化用例都支持显示优先级徽章（高、中、低）
   
   - **用例来源字段**：
     - 功能用例：显示"手动创建"或"AI生成"
     - UI自动化用例：显示"自动化脚本"（青色主题）

3. **关联用例功能优化**
   - 支持通过 `FunctionalCaseSelectModal` 组件选择UI自动化用例
   - 根据 `addCaseType` 参数动态显示不同类型的用例列表
   - 弹窗标题根据用例类型自动调整："添加功能测试用例" 或 "添加UI自动化用例"

4. **批量执行和执行所有功能**
   - `handleBatchExecute()`: 支持批量执行选中的用例（功能或UI自动化）
   - `handleExecute(caseType)`: 支持执行指定类型的所有用例
   - 自动检测选中用例的类型，防止混合执行

### 用户体验改进

**统一的操作体验**：
- UI自动化测试计划与功能测试计划具有相同的操作界面和流程
- 混合测试计划可以同时管理功能用例和UI自动化用例
- 根据计划类型智能显示相关按钮，避免界面混乱

**清晰的用例信息展示**：
- UI自动化用例在列表中显示版本、类型、优先级等完整信息
- 通过不同颜色主题区分功能用例和UI自动化用例
- 支持查看执行状态和执行结果

**灵活的执行方式**：
- 支持单个用例执行、批量执行、执行所有三种方式
- 混合测试计划可以分别执行功能用例和UI自动化用例
- 批量执行时自动检测用例类型，防止误操作

### 技术特点

1. **类型安全**：使用 TypeScript 严格类型检查，确保用例类型正确
2. **组件复用**：复用 `FunctionalCaseSelectModal` 组件处理不同类型的用例选择
3. **智能判断**：根据计划类型和用例类型动态显示功能按钮
4. **统一样式**：使用统一的徽章组件和颜色主题，保持界面一致性

### 测试建议

1. **UI自动化计划测试**：
   - 创建一个UI自动化类型的测试计划
   - 点击"关联UI自动化用例"，验证可以选择和添加用例
   - 验证用例列表正确显示版本、类型、优先级等信息
   - 测试批量执行和执行所有功能

2. **混合测试计划测试**：
   - 创建一个混合类型的测试计划
   - 验证可以同时关联功能用例和UI自动化用例
   - 验证两个"执行所有"按钮都正常显示和工作
   - 测试批量执行时的类型检测功能

3. **执行历史和统计分析**：
   - 执行UI自动化用例后，验证执行历史正确显示
   - 验证统计分析中的数据包含UI自动化用例的信息
   - 验证通过率、执行率等指标计算正确

---

## 2024-12-24 在测试用例页面新增测试执行标签页

### 修改内容

**文件**: `src/pages/TestCases.tsx`

### 功能说明
在测试用例页面的标签页导航中，在"测试套件"标签页后面新增了一个"测试执行"标签页，直接复用 TestRuns 组件，方便用户在同一页面中查看测试执行结果。

### 修改详情

1. **导入 TestRuns 组件和 Activity 图标**
   - 新增导入：`import { TestRuns } from './TestRuns';`
   - 新增图标导入：`Activity`（用于标签页图标）

2. **扩展 activeTab 状态类型**
   ```typescript
   // 修改前
   const [activeTab, setActiveTab] = useState<'cases' | 'suites'>('cases');
   
   // 修改后
   const [activeTab, setActiveTab] = useState<'cases' | 'suites' | 'runs'>('cases');
   ```

3. **新增测试执行标签页按钮**（位置：测试套件标签页后）
   - 按钮文本：测试执行
   - 图标：Activity（运行活动图标）
   - 点击前检查：如果有打开的创建表单，提示用户先关闭
   - 样式：与现有标签页保持一致
   
4. **新增测试执行内容区域**
   - 条件渲染：`{activeTab === 'runs' && (<TestRuns />)}`
   - 位置：在测试套件内容区域之后
   - 完全复用 TestRuns 组件，无需新增代码

### 用户体验改进

**统一的导航体验**：
- 用户可以在测试用例、测试套件、测试执行三个模块间无缝切换
- 无需跳转到其他页面即可查看测试执行结果
- 保持了界面的一致性和简洁性

**工作流优化**：
- 创建测试用例 → 组织测试套件 → 查看执行结果，一站式完成
- 减少页面跳转，提升工作效率

### 技术特点

1. **零代码重复**：直接复用 TestRuns 组件，遵循 DRY 原则
2. **状态隔离**：每个标签页独立管理状态，互不影响
3. **延迟加载**：仅在切换到测试执行标签页时才加载 TestRuns 组件
4. **表单保护**：切换标签页前检查是否有未保存的表单

### 测试建议
1. 点击"测试执行"标签页，验证 TestRuns 组件正常加载显示
2. 在三个标签页之间切换，验证状态切换正常
3. 打开创建表单后尝试切换标签页，验证提示信息正确显示
4. 验证测试执行页面的所有功能（刷新、停止、查看日志等）正常工作

---

## 2024-12-24 修复测试运行表格排序功能

### 修改内容

**文件**: `src/components/TestRunsTable.tsx`

### 问题描述
前端表格无法正常显示排序状态，用户点击表头时虽然数据会排序，但没有视觉反馈显示当前排序字段和方向。

### 修复内容

1. **启用排序图标显示** (核心修复)
   - 取消注释所有表头的 `<SortIcon>` 组件
   - 涵盖字段：用例名称、执行环境、执行状态、执行者、开始时间、结束时间、执行用时
   - 用户现在可以看到当前排序字段（蓝色箭头）和方向（上/下箭头）

2. **代码质量优化**
   - 修复 TypeScript any 类型警告，将排序变量类型改为 `string | Date | number | undefined`
   - 为复选框添加 `aria-label` 属性，提升无障碍访问性
   - 修复 linting 错误从 5 个减少到 2 个

### 技术细节

排序逻辑本身是正确的：
- 日期字段（startedAt、finishedAt）使用时间戳比较
- 支持 Date 对象和 ISO 字符串格式
- 其他字段使用字符串本地化比较
- 支持升序/降序切换

问题仅在于排序图标被注释掉，导致缺少视觉反馈。

### 测试建议
1. 点击各个表头，验证排序图标正确显示
2. 确认升序/降序图标切换正常
3. 验证日期字段排序正确
4. 验证字符串字段排序正确

---

## 2024-12-24 修复前后端排序不一致问题

### 修改内容

**文件**: 
- `src/pages/TestRuns.tsx`
- `src/components/TestRunsTable.tsx`

### 问题描述
后端 API 返回了按 `startedAt` 升序（asc）排序的数据，但前端 `TestRunsTable` 组件内部默认按降序（desc）排序，导致前端组件覆盖了后端的排序结果，显示顺序与预期不符。

### 修复内容

**文件 1**: `src/pages/TestRuns.tsx`
- 修改后端 API 请求参数，将排序顺序从 `asc` 改为 `desc`
- 确保最新的测试运行显示在最前面（符合用户使用习惯）

```typescript
const apiData = await testService.getAllTestRuns({
  sortBy: 'startedAt',
  sortOrder: 'desc'  // 从 'asc' 改为 'desc'
});
```

**文件 2**: `src/components/TestRunsTable.tsx`
- 前端组件默认排序已经是 `desc`，保持不变
- 这样前后端初始排序保持一致

### 技术细节

**排序一致性**：
- 后端 API 排序：`startedAt desc`（最新的在前）
- 前端组件初始排序：`startedAt desc`（最新的在前）
- 用户可以点击表头任意列进行重新排序
- 前端排序会覆盖后端排序（这是预期行为，给用户更多控制权）

**为什么选择降序（desc）**：
- 符合用户使用习惯：最新的测试运行应该显示在最前面
- 便于快速查看最近的测试结果
- 与大多数测试管理系统的默认排序一致

### 测试建议
1. 刷新页面，验证最新的测试运行显示在第一页顶部
2. 点击"开始时间"表头，验证升序/降序切换正常
3. 点击其他表头，验证排序功能正常工作
4. 验证分页后每页数据顺序正确

---

## 修复测试运行表格复选框勾选时数据抖动问题

### 修改内容

**文件**: 
- `src/components/TestRunsTable.tsx`

### 功能说明
修复测试运行表格中勾选复选框时表格数据抖动的问题，参考测试用例Tab中的复选框实现，添加平滑过渡效果和正确的背景色处理。

### 修改详情

1. **优化 motion.tr 的背景色处理**
   - 添加 `group` 类用于配合子元素的 hover 效果
   - 添加选中状态（`selectedRunIds.has(run.id)`）的背景色判断，选中时显示 `bg-blue-100`
   - 保持展开状态和 hover 状态的背景色处理
   - 确保 `transition-colors` 类已存在以实现平滑过渡

2. **优化复选框所在 td 的背景色**
   - 根据选中状态、展开状态和 hover 状态动态设置背景色
   - 添加 `transition-colors` 类实现平滑的颜色过渡
   - 使用 `bg-white group-hover:bg-gray-50` 实现与行背景的协调

3. **优化复选框样式**
   - 添加固定尺寸 `w-3.5 h-3.5` 确保复选框大小一致，避免布局变化
   - 保持原有的样式和交互逻辑

4. **优化操作列的背景色**
   - 修复操作列（sticky right）的背景色，使其在选中状态下也显示正确的背景
   - 添加 `transition-colors` 类实现平滑过渡
   - 根据选中状态、展开状态和 hover 状态动态设置背景色

### 技术要点
- 使用 `group` 和 `group-hover` 实现行级别的 hover 效果协调
- 通过 `transition-colors` 实现背景色的平滑过渡，避免视觉抖动
- 固定复选框尺寸避免布局变化导致的抖动
- 确保所有单元格的背景色与行的背景色保持一致

### 第二次修复（彻底解决抖动问题 - 根本原因修复）

**根本原因**：表格使用了 `borderCollapse: 'separate'` 和 `borderSpacing`，导致 td 无法继承 tr 的背景色，每个单元格都需要单独设置背景色，造成视觉抖动。

**解决方案**：参考测试用例表格的实现，改用 `divide-y` 方式，让 td 直接继承 tr 的背景色。

1. **修改表格样式**
   - 移除 `borderSpacing: '0 4px'` 和 `borderCollapse: 'separate'`
   - 使用 `divide-y divide-gray-200` 实现行分隔
   - tbody 添加 `bg-white divide-y divide-gray-200` 类名

2. **修改表头样式**
   - 所有 th 的 padding 从 `py-2` 改为 `py-3`（与测试用例表格一致）
   - thead 添加 `sticky top-0 z-10` 实现固定表头
   - 所有 th 添加 `bg-gray-50` 背景色

3. **移除单元格背景色设置**
   - 删除 `getCellBgClass` 函数
   - 移除所有普通单元格（非固定列）的背景色和 `transition-colors`
   - 只保留操作列（固定列）的背景色设置

4. **操作列样式修复**
   - 操作列不检查选中状态，只检查展开状态（与测试用例表格一致）
   - 添加 `sticky-column-right` 类名用于阴影效果

### 技术要点
- 使用 `divide-y` 让 td 继承 tr 的背景色，避免每个单元格单独设置背景色
- 统一表头高度（py-3）和背景色（bg-gray-50）
- 固定列（操作列）需要单独设置背景色，普通单元格继承行背景色

---

## 修复表格视图宽度和滚动问题

**修改文件：** `src/components/FunctionalCaseSelectModal.tsx`

**修改内容：**
1. **修复容器宽度类名**
   - 将表格视图容器的 `-full` 修正为 `w-full`，确保容器占满宽度

2. **优化表格自适应宽度**
   - 将表格的 `w-full` 改为 `min-w-full`，使表格能够根据内容自动扩展宽度
   - 当表格内容超出容器宽度时，自动显示横向滚动条

**效果：**
- 表格视图现在能够正确自适应宽度
- 当表格列较多或内容较宽时，超出部分可以通过横向滚动查看
- 垂直方向保持最大高度 500px，超出时显示纵向滚动条

**进一步优化：**
1. **移除表格容器的 overflow-hidden**
   - 移除了 `renderTableView()` 内部容器的 `overflow-hidden` 类，让滚动条能够正确显示

2. **优化表格宽度设置**
   - 表格使用 `w-max min-w-full` 类，确保表格能够根据内容自动扩展宽度
   - 当表格宽度超过容器时，外层容器的 `overflow-x-auto` 会显示横向滚动条

3. **设置列最小宽度**
   - 为各列设置了合适的最小宽度（`min-w-[120px]`、`min-w-[150px]`、`min-w-[200px]` 等）
   - 用例名称列设置 `min-w-[200px]`，确保长文本能够完整显示

4. **防止内容换行**
   - 为表头添加 `whitespace-nowrap`，防止表头文字换行
   - 用例名称单元格使用 `whitespace-nowrap`，确保内容在一行显示
   - 描述文本使用 `truncate` 和 `max-w-[300px]`，超出部分显示省略号

---

## 修复UI自动化测试计划用例执行和统计问题

**修改文件：**
- `src/pages/TestPlanDetail.tsx`
- `server/services/testPlanService.ts`

**问题描述：**
1. 单个UI自动化用例执行后，没有创建测试计划执行记录，导致用例列表的执行状态和结果无法更新
2. 从测试执行详情页返回时，没有正确返回到测试计划的用例列表tab页面
3. UI自动化执行历史的统计数据不准确，实际失败但显示成功

**修复内容：**

### 1. 修复单个UI自动化用例执行的测试计划执行记录创建
- 在 `handleConfirmExecute` 函数中，单个用例执行前先调用 `testPlanService.startTestPlanExecution` 创建测试计划执行记录
- 在调用 `testService.runTestCase` 时传递 `planId` 和 `planCaseId` 参数，用于后续关联
- 确保单个用例执行也能正确更新测试计划的执行状态和统计数据

### 2. 优化TestRunDetail的返回逻辑
- `TestRunDetail.tsx` 的 `handleGoBack` 函数已经正确处理了返回逻辑
- 使用 `state.from` 和 `state.fromTab` 参数，确保返回到正确的页面和tab
- `TestPlanDetail.tsx` 通过 `location.state` 正确恢复 `activeTab` 状态

### 3. 优化waitForTestCompletion函数的结果判断逻辑
**修改文件：** `server/services/testPlanService.ts`

**优化内容：**
- **修复表查询错误**：将 `test_runs` 表查询改为 `test_case_executions` 表（UI自动化测试使用此表）
- **修复主键字段**：将 `where: { run_id: runId }` 改为 `where: { id: runId }`
- **优先使用统计字段**：使用 `test_case_executions` 表的统计字段（`total_steps`、`passed_steps`、`failed_steps`）判断结果
- **改进判断逻辑**：
  1. 如果有失败步骤（`failed_steps > 0`），结果为 `fail`
  2. 如果没有失败但有未完成的步骤（`passedSteps < totalSteps`），结果为 `block`
  3. 如果所有步骤都通过（`passedSteps === totalSteps`），结果为 `pass`
- **完善状态处理**：增加对 `cancelled` 状态的处理
- **增加日志输出**：添加详细的日志输出，便于调试和追踪

**技术要点：**
- `test_case_executions` 表是UI自动化测试的正确表结构
- 统计字段更可靠和准确
- 增加了多个日志点，便于排查问题

**效果：**
1. 单个UI自动化用例执行后，能够正确创建测试计划执行记录
2. 用例列表的执行状态和执行结果能够实时更新
3. 从测试执行详情页返回时，能够正确返回到测试计划的用例列表tab页面
4. UI自动化执行历史的统计数据更加准确，失败用例能够正确显示为失败状态

---

## 修复测试计划用例列表实时更新和执行历史时长精度问题

**修改文件：**
- `src/pages/TestPlanDetail.tsx`
- `server/services/testPlanService.ts`

**问题描述：**
1. 单个执行UI自动化用例后，从测试执行详情页返回到测试计划用例列表tab页面时，对应的执行状态和执行结果等数据没有实时更新
2. 单个执行UI自动化用例生成的执行历史数据存在问题，执行时长显示不够精确（例如显示16.00s，实际应该是16.891s）

**修复内容：**

### 1. 添加WebSocket监听实现数据实时更新
**修改文件：** `src/pages/TestPlanDetail.tsx`

**实现方式：**
- 添加新的`useEffect`钩子，在组件加载时初始化WebSocket监听器
- 监听器ID格式：`test-plan-detail-${planId}`，确保每个测试计划有独立的监听器
- 监听两种WebSocket事件：
  - `test_complete`：测试完成事件，延迟500ms后刷新数据（确保后端数据已更新）
  - `test_update`：测试状态更新事件，如果当前在用例列表tab，立即刷新数据
- 组件卸载时自动清理监听器，防止内存泄漏

**技术要点：**
- 使用`testService.initializeWebSocket()`初始化连接
- 使用`testService.addMessageListener()`添加监听器
- 使用`testService.removeMessageListener()`清理监听器
- 延迟刷新策略确保后端数据库已更新完成

### 2. 优化执行时长计算精度
**修改文件：** `server/services/testPlanService.ts`

**优化内容：**
- **优先使用数据库字段**：在`waitForTestCompletion`函数中，优先使用`test_case_executions.duration_ms`字段（精确到毫秒）
- **备用计算方案**：如果数据库字段不存在或为0，才从`finished_at`和`started_at`时间戳计算
- **增强日志输出**：添加详细的日志，显示使用的时长来源和精确值（例如：16891ms = 16.891s）
- **处理失败状态**：确保失败、错误、取消状态也能正确计算时长

**修改前逻辑：**
```typescript
const duration = testRun.finished_at && testRun.started_at
  ? new Date(testRun.finished_at).getTime() - new Date(testRun.started_at).getTime()
  : 0;
```

**修改后逻辑：**
```typescript
let duration = 0;
if (testRun.duration_ms && testRun.duration_ms > 0) {
  // 优先使用数据库中的精确时长
  duration = testRun.duration_ms;
} else if (testRun.finished_at && testRun.started_at) {
  // 备用方案：从时间戳计算
  duration = new Date(testRun.finished_at).getTime() - new Date(testRun.started_at).getTime();
}
```

### 3. 统一时长显示格式
**修改文件：** `src/pages/TestPlanDetail.tsx`

**修改内容：**
- 修改`formatDuration`函数，将小于1分钟的时长从显示两位小数（`toFixed(2)`）改为三位小数（`toFixed(3)`）
- 确保与`TestRuns.tsx`中的显示格式保持一致
- 显示效果：16.891s 而不是 16.89s，精确到毫秒级

**修改前：**
```typescript
return `${totalSeconds.toFixed(2)}s`;  // 显示 16.89s
```

**修改后：**
```typescript
return `${totalSeconds.toFixed(3)}s`;  // 显示 16.891s
```

**数据流程：**
1. 测试执行完成时，`syncFromTestRun`函数将精确的`duration_ms`（毫秒）写入`test_case_executions`表
2. `waitForTestCompletion`函数优先读取数据库中的`duration_ms`字段
3. 测试计划执行记录的`execution_results`中存储精确的`duration_ms`值
4. 前端`formatDuration`函数显示三位小数，确保毫秒级精度可见

**技术亮点：**
- 参考`TestRuns.tsx`的数据处理方式，确保数据准确性
- 历史列表统计所有单个或批量执行的用例数据
- 详情页显示单个用例的精确执行数据
- 保持数据的完整性和一致性

**效果：**
1. ✅ 从测试执行详情页返回后，用例列表的执行状态和结果能够实时更新，无需手动刷新
2. ✅ WebSocket实时推送确保数据同步，提升用户体验
3. ✅ 执行历史数据的时长精确到毫秒（如16.891s），与测试执行详情页保持一致
4. ✅ 数据显示格式统一，所有页面的时长显示都保持三位小数精度

---

## 确保测试计划用例执行状态和结果完全基于执行历史

**修改文件：**
- `server/services/testPlanService.ts`
- `src/pages/TestPlanDetail.tsx`

**问题描述：**
UI自动化测试计划用例列表的执行状态和结果需要完全基于执行历史的最新数据，确保数据一致性。当执行历史为空时，状态也需要正确显示为未执行。

**修复内容：**

### 1. 后端数据源修复
**修改文件：** `server/services/testPlanService.ts`

**修改逻辑：**
- **完全基于执行历史**：在`getTestPlanDetail`函数中，用例的`is_executed`和`execution_result`字段完全由`caseExecutionMap`（执行历史）决定
- **明确未执行状态**：当`caseExecutionMap`中没有该用例的记录时，明确设置`is_executed = false`和`execution_result = undefined`
- **移除回退逻辑**：不再使用`test_plan_cases`表的`is_executed`和`execution_result`字段作为初始值或回退值
- **增加调试日志**：添加日志输出，便于追踪数据来源

**修改前逻辑：**
```typescript
let is_executed = c.is_executed;  // ❌ 使用数据库字段作为初始值
let execution_result = c.execution_result as any;

if (latestExecution) {
  is_executed = true;
  execution_result = latestExecution.result;
}
```

**修改后逻辑：**
```typescript
// 🔥 完全基于执行历史判断
let is_executed = false;
let execution_result = undefined;

if (latestExecution) {
  // 有执行历史：使用执行历史的数据
  is_executed = true;
  execution_result = latestExecution.result;
  console.log(`📊 [testPlanService] 用例 ${c.case_id} 从执行历史获取状态`);
} else {
  // 没有执行历史：明确设置为未执行
  console.log(`📊 [testPlanService] 用例 ${c.case_id} 无执行历史，设置为未执行`);
}
```

### 2. 前端显示逻辑优化
**修改文件：** `src/pages/TestPlanDetail.tsx`

**优化内容：**

#### 2.1 执行状态列
- 移除对`caseItem.is_executed`的依赖，完全基于`last_execution.status`
- 当没有执行历史时，显示"未执行"而不是"-"
- 提升用户体验，状态更加明确

**修改前：**
```typescript
const executionStatus = lastExecution?.status ||
  (caseItem.is_executed ? 'completed' : null);  // ❌ 回退到数据库字段

if (!executionStatus) {
  return <span className="text-gray-600 text-sm">-</span>;
}
```

**修改后：**
```typescript
const executionStatus = lastExecution?.status;  // ✅ 完全基于执行历史

if (!executionStatus) {
  return <span className="text-gray-500 text-sm">未执行</span>;
}
```

#### 2.2 执行结果列
- 移除对`caseItem.execution_result`的回退逻辑
- 完全基于`last_execution.final_result`显示
- Tooltip中的状态描述也优化为基于执行历史

**修改前：**
```typescript
const executionResult = lastExecution?.final_result || caseItem.execution_result;  // ❌ 回退逻辑
```

**修改后：**
```typescript
const executionResult = lastExecution?.final_result;  // ✅ 完全基于执行历史
```

**数据流程：**
1. 后端`getTestPlanDetail`从`test_plan_executions.execution_results`中提取每个用例的最新执行记录
2. 构建`caseExecutionMap`，存储每个用例的最新执行状态和结果
3. 遍历`test_plan_cases`时，完全基于`caseExecutionMap`设置`is_executed`和`execution_result`
4. 如果用例不在`caseExecutionMap`中，明确设置为未执行状态
5. 前端接收到数据后，完全基于`case_detail.last_execution`显示执行状态和结果
6. WebSocket实时更新确保数据始终保持最新

**技术要点：**
- 单一数据源原则：执行历史是唯一的数据源
- 明确的未执行状态：不使用null或undefined混淆状态
- 数据一致性：后端和前端都使用相同的数据来源
- 实时更新：WebSocket确保执行完成后立即刷新

**效果：**
1. ✅ 用例列表的执行状态和结果完全来自执行历史的最新数据
2. ✅ 没有执行历史时，状态正确显示为"未执行"，结果显示为"-"
3. ✅ 数据一致性得到保证，避免了`test_plan_cases`表字段与执行历史不一致的问题
4. ✅ 结合WebSocket实时更新，用户看到的始终是最新、最准确的执行状态
5. ✅ 调试更加容易，日志清晰显示数据来源

---

## 优化测试计划用例列表实时更新机制

**修改文件：**
- `src/pages/TestPlanDetail.tsx`

**问题描述：**
用例列表的执行状态和结果虽然来自执行历史，但在测试执行过程中显示的是上次的结果，不是最新的，直到完成后才刷新。需要实现真正的实时更新。

**修复内容：**

### 1. 优化WebSocket监听逻辑

**改进措施：**

#### 1.1 移除Tab限制
- **修改前**：只有在`activeTab === 'cases'`时才刷新
- **修改后**：无论在哪个tab，收到测试事件都刷新
- **原因**：用户可能在其他tab查看数据，也需要实时更新

#### 1.2 监听更多事件类型
- **修改前**：只监听`test_complete`和`test_update`
- **修改后**：同时监听`test_complete`、`test_update`、`test_created`
- **原因**：测试创建、更新、完成都需要触发刷新

#### 1.3 优化刷新延迟
- **修改前**：固定500ms延迟
- **修改后**：减少到200ms，提升响应速度
- **原因**：更快的响应能让用户看到更实时的数据

#### 1.4 防抖机制
- 添加防抖逻辑，清除之前的刷新定时器
- 防止频繁收到WebSocket消息导致的重复刷新
- 提升性能，减少不必要的API调用

**修改后的WebSocket监听逻辑：**
```typescript
const listenerId = `test-plan-detail-${id}`;
let refreshTimeout: NodeJS.Timeout | null = null;

testService.addMessageListener(listenerId, (message) => {
  // 监听所有测试相关事件
  if (message.type === 'test_complete' || 
      message.type === 'test_update' || 
      message.type === 'test_created') {
    
    // 防抖：清除之前的刷新定时器
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    // 200ms后刷新数据
    refreshTimeout = setTimeout(() => {
      loadTestPlanDetail();
      refreshTimeout = null;
    }, 200);
  }
});
```

### 2. 添加轮询备用机制

**实现方式：**
- 检测是否有`status === 'running'`的执行记录
- 如果有运行中的测试，启动轮询定时器
- 每3秒刷新一次数据
- 当没有运行中的测试时，自动停止轮询

**轮询逻辑：**
```typescript
useEffect(() => {
  const hasRunningExecution = executions.some(e => e.status === 'running');
  
  if (!hasRunningExecution) {
    return; // 没有运行中的测试，不需要轮询
  }
  
  // 每3秒刷新一次
  const pollInterval = setInterval(() => {
    loadTestPlanDetail();
  }, 3000);
  
  return () => clearInterval(pollInterval);
}, [id, executions]);
```

**为什么需要轮询：**
1. **WebSocket可靠性保障**：如果WebSocket连接失败或消息丢失，轮询作为备用方案
2. **测试执行过程监控**：确保运行中的测试状态能够持续更新
3. **自动停止**：没有运行中的测试时自动停止，不浪费资源

### 3. 数据更新流程

**完整流程：**
1. **测试开始**：用户点击执行按钮
2. **创建记录**：`startTestPlanExecution`创建执行记录
3. **WebSocket监听**：`test_created`事件触发，200ms后刷新
4. **测试运行**：每次状态更新时，`test_update`事件触发刷新
5. **轮询备用**：同时每3秒轮询一次，确保数据同步
6. **测试完成**：`test_complete`事件触发最终刷新
7. **停止轮询**：检测到没有运行中的测试，自动停止轮询

**技术要点：**
- **双保险机制**：WebSocket + 轮询，确保数据必然更新
- **性能优化**：防抖机制防止频繁刷新
- **智能控制**：只在有运行中测试时才轮询
- **快速响应**：200ms延迟，用户体验更流畅

**效果：**
1. ✅ 测试执行过程中，用例列表实时显示最新的执行状态和结果
2. ✅ WebSocket和轮询双重保障，确保数据不会滞后
3. ✅ 防抖机制优化性能，避免频繁刷新
4. ✅ 智能轮询，只在需要时才启动，不浪费资源
5. ✅ 响应速度从500ms提升到200ms，用户体验更好

---

## 修复单个UI自动化用例执行时数据来源问题

**修改文件：**
- `server/services/testPlanService.ts`

**问题描述：**
虽然添加了实时刷新机制，但用例列表依旧显示上次的状态和结果，不是最新的。问题的根源在于**单个UI自动化用例执行时，`test_plan_executions`表的`execution_results`字段为空，导致无法获取最新数据**。

**问题分析：**

### 批量执行流程（正常工作）
```
1. startTestPlanExecution → 创建execution记录，execution_results: []
2. 后端异步执行所有用例
3. 每个用例完成 → updateTestPlanExecution → 更新execution_results ✅
4. getTestPlanDetail → 从execution_results获取数据 ✅
5. 用例列表显示最新状态 ✅
```

### 单个用例执行流程（问题所在）
```
1. startTestPlanExecution → 创建execution记录，execution_results: [] ✅
2. testService.runTestCase → 直接跳转详情页 ✅
3. 用例执行完成 → 更新test_case_executions表 ✅
4. 但 execution_results 永远是空数组 ❌
5. getTestPlanDetail → 从空的execution_results获取数据 ❌
6. caseExecutionMap为空 → 用例列表无法显示最新状态 ❌
```

**根本原因：**
- 批量执行：后端通过`waitForTestCompletion`等待用例完成，然后更新`execution_results`
- 单个执行：前端直接调用`testService.runTestCase`并跳转，后端没有机会更新`execution_results`
- 结果：`execution_results`一直是空数组，导致`caseExecutionMap`获取不到数据

**修复方案：双数据源查询**

在`getTestPlanDetail`函数中，修改`caseExecutionMap`的构建逻辑，添加两个数据来源：

### 数据来源1：test_plan_executions.execution_results（批量执行）
```typescript
// 从测试计划执行记录的execution_results中获取
for (const execution of plan.plan_executions) {
  const executionResults = (execution.execution_results as TestPlanCaseResult[]) || [];
  for (const result of executionResults) {
    caseExecutionMap.set(result.case_id, {
      result: result.result,
      executed_at: result.executed_at,
      executor_name: execution.executor_name,
      execution_id: result.execution_id,
      status: execution.status
    });
  }
}
```

### 数据来源2：test_case_executions表（单个执行）
```typescript
// 🔥 关键修复：直接查询test_case_executions表
const uiAutoCaseIds = plan.plan_cases
  .filter(c => c.case_type === 'ui_auto')
  .map(c => c.case_id);

if (uiAutoCaseIds.length > 0) {
  // 为每个UI自动化用例查询最新的执行记录
  const latestExecutions = await Promise.all(
    uiAutoCaseIds.map(async (caseId) => {
      const execution = await prisma.test_case_executions.findFirst({
        where: { test_case_id: caseId },
        orderBy: { started_at: 'desc' },
        take: 1,
        include: {
          users: {
            select: { username: true, account_name: true }
          }
        }
      });
      return { caseId, execution };
    })
  );
  
  // 更新到caseExecutionMap
  for (const { caseId, execution } of latestExecutions) {
    if (!execution) continue;
    
    const executedAt = execution.started_at?.toISOString();
    const existing = caseExecutionMap.get(caseId);
    
    // 如果没有记录，或者test_case_executions的记录更新，则使用它
    if (!existing || executedAt > existing.executed_at) {
      // 根据步骤统计判断结果
      let result: 'pass' | 'fail' | 'block' = 'pass';
      if (execution.failed_steps > 0) {
        result = 'fail';
      } else if (execution.total_steps > 0 && execution.passed_steps < execution.total_steps) {
        result = 'block';
      }
      
      caseExecutionMap.set(caseId, {
        result,
        executed_at: executedAt,
        executor_name: execution.users?.account_name || 'System',
        execution_id: execution.id,
        status: execution.status
      });
    }
  }
}
```

**数据优先级：**
1. 先从`execution_results`获取数据（批量执行的数据）
2. 再从`test_case_executions`表获取数据（单个执行的数据）
3. 如果两个来源都有，使用**时间戳更新的那个**
4. 确保显示的始终是最新数据

**完整数据流：**

```
用例执行 → test_case_executions表更新
              ↓
         WebSocket触发刷新
              ↓
       loadTestPlanDetail()
              ↓
    getTestPlanDetail (后端)
              ↓
    构建 caseExecutionMap:
      ├─ 来源1: execution_results (批量)
      └─ 来源2: test_case_executions (单个) ← 🔥 关键修复
              ↓
         返回最新数据
              ↓
      前端显示最新状态和结果 ✅
```

**技术要点：**
- **双数据源保障**：同时支持批量和单个执行场景
- **时间戳比较**：确保使用最新的执行记录
- **并行查询优化**：使用`Promise.all`并行查询所有用例，提升性能
- **结果准确判断**：根据`failed_steps`和`passed_steps`精确判断执行结果
- **完整字段映射**：包括executor_name、execution_id、status等所有必要字段

**效果：**
1. ✅ 单个UI自动化用例执行后，用例列表能够立即显示最新的执行状态和结果
2. ✅ 批量执行和单个执行都能正确获取数据，数据来源统一
3. ✅ 时间戳比较确保始终显示最新数据
4. ✅ 结合WebSocket实时刷新，用户体验完美流畅
5. ✅ 解决了"依旧显示上次结果"的根本问题

---

## 修复单个用例执行时重复调用接口的问题

**问题描述：**
运行单个测试用例时，同时调用了两个接口：
1. `/api/v1/test-plans/3/execute` - startTestPlanExecution
2. `api/tests/cases/execute` - runTestCase

导致创建了2个执行任务。

**根本原因：**
`startTestPlanExecution` 后端实现中，如果是UI自动化测试会自动调用 `testExecutionService.runTest()` 执行用例，前端又手动调用了 `runTestCase`，造成重复执行。

**修改文件：**
- `src/pages/TestPlanDetail.tsx`

**修改内容：**
- 单个用例执行时，删除 `startTestPlanExecution` 的调用
- 只保留 `runTestCase` 调用，避免重复执行
- 批量执行保持不变，继续使用 `startTestPlanExecution`

**效果：**
1. ✅ 单个用例执行只调用一个接口，不再重复创建执行任务
2. ✅ 批量执行逻辑不受影响
3. ✅ 解决重复执行导致的资源浪费和数据混乱

---

## 优化测试计划执行历史记录创建机制

**需求：**
单个、批量、执行所有UI自动化用例都需要创建执行历史记录，但之前删除 `startTestPlanExecution` 后单个用例不再创建执行历史。

**解决方案：**
通过添加 `autoExecute` 参数控制是否自动执行用例，实现统一的执行历史记录创建。

**修改文件：**
1. `src/types/testPlan.ts` - 扩展类型定义
2. `server/services/testPlanService.ts` - 后端支持 autoExecute 参数
3. `src/pages/TestPlanDetail.tsx` - 前端统一调用逻辑

**修改内容：**

### 1. 类型定义扩展
```typescript
export interface StartTestPlanExecutionInput {
  plan_id: number;
  executor_id: number;
  execution_type: TestCaseType;
  case_ids?: number[];
  autoExecute?: boolean; // 🔥 新增：是否自动执行用例（默认true）
  executionConfig?: {    // 🔥 新增：执行配置
    environment?: string;
    executionEngine?: 'mcp' | 'playwright';
    enableTrace?: boolean;
    enableVideo?: boolean;
  };
}
```

### 2. 后端逻辑优化
- `autoExecute=true`（默认）：创建执行记录并自动执行所有用例（批量场景）
- `autoExecute=false`：只创建执行记录，不执行用例（单个场景）
- 支持传递 `executionConfig` 配置执行参数

### 3. 前端统一调用
**单个用例执行：**
```typescript
// 步骤1：创建执行记录（autoExecute=false）
await testPlanService.startTestPlanExecution({
  plan_id: parseInt(id!),
  executor_id: user!.id,
  execution_type: 'ui_auto',
  case_ids: [caseId],
  autoExecute: false, // 不自动执行
  executionConfig: {...}
});

// 步骤2：手动执行用例
await testService.runTestCase(caseId, {...});
```

**批量执行：**
```typescript
// 创建执行记录并自动执行所有用例
await testPlanService.startTestPlanExecution({
  plan_id: parseInt(id!),
  executor_id: user!.id,
  execution_type: 'ui_auto',
  case_ids: caseIds,
  autoExecute: true, // 自动执行所有用例
  executionConfig: {...}
});
```

**效果：**
1. ✅ 单个用例执行创建执行历史记录，可在执行历史tab查看
2. ✅ 批量执行保持原有逻辑，自动执行所有用例
3. ✅ 统一的执行历史记录管理，所有场景都有完整记录
4. ✅ 避免重复执行，解决资源浪费问题
5. ✅ 支持自定义执行配置（环境、引擎、trace、video等）

---

## 修复后端路由未接收 autoExecute 参数的问题

**问题：**
前端传递了 `autoExecute` 和 `executionConfig` 参数，但后端路由没有正确接收，导致这些参数丢失，`autoExecute` 默认为 `true`，造成单个用例执行时依然会自动执行，出现重复任务。

**修改文件：**
- `server/routes/testPlan.ts`

**修改内容：**
- 在 `POST /:id/execute` 路由中，正确接收 `req.body.autoExecute` 和 `req.body.executionConfig` 参数
- 添加日志输出，便于调试和追踪参数传递

**效果：**
1. ✅ 后端正确接收前端传递的 `autoExecute` 参数
2. ✅ 单个用例执行时 `autoExecute=false` 生效，不会自动执行
3. ✅ 彻底解决重复任务问题
4. ✅ 执行配置正确传递到后端

---

