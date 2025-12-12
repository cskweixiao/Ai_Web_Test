# 执行时长时间一致性修复（完整版）

## 问题描述

测试执行完成后，页面显示的时间、前端传参的时间、数据库存储的时间三者不一致。

### 第一个问题示例
- **执行时长**: 7.530s
- **开始时间**: 2025-12-12 15:02:43.364
- **结束时间**: 2025-12-12 15:02:50.894
- **问题**: 存入数据库后，时间显示不一致

### 第二个问题示例（更严重）
**前端传参：**
- durationMs: 5355 (5.355s)
- startedAt: "2025-12-12 15:12:51.776"
- finishedAt: "2025-12-12 15:12:57.131"

**页面显示：**
- 执行时长：6.514s (6514ms)
- 开始时间：2025-12-12 15:12:51.776
- 结束时间：2025-12-12 15:12:58.290

**数据库存入：**
- duration_ms: 5389

**三者完全不一致！**

## 根本原因

### 原因1：后端添加了8小时偏移量

```typescript
// ❌ 旧代码（有问题）
const chinaOffset = 8 * 60 * 60 * 1000; // 8小时
startDate = new Date(localDate.getTime() + chinaOffset);
```

### 原因2：前端使用日志时间而非实际执行时间

前端从**所有日志的第一条和最后一条**提取时间，但：
- 第一条日志可能在测试准备阶段就记录了
- 最后一条日志可能包含测试清理、保存结果等后续操作
- 导致日志时间跨度 > 实际测试执行时间

### 原因3：WebSocket 消息中缺少开始时间

后端发送的 `test_complete` 消息只包含结束时间，缺少开始时间：

```typescript
// ❌ 旧代码
this.wsManager.sendTestComplete(runId, {
  status: finalStatus,
  endedAt: testRun.endedAt,  // 只有结束时间
  duration,
  // ... 缺少 startedAt
});
```

### 问题流程：
1. **后端**：记录实际开始时间（actualStartedAt）和结束时间（finishedAt）
2. **后端**：发送 WebSocket 消息时**只包含结束时间**
3. **前端**：无法从 WebSocket 获取开始时间，只能从日志提取
4. **前端**：日志时间 ≠ 实际执行时间
5. **前端**：传给后端的参数基于日志时间
6. **后端**：添加8小时偏移量
7. **结果**：三者完全不一致

## 修复方案

### 修复1：移除8小时偏移量

```typescript
// ✅ 新代码（server/services/testCaseExecutionService.ts）
// 直接将 "yyyy-MM-dd HH:mm:ss.SSS" 转换为 ISO 格式
const isoString = startedAt.replace(' ', 'T');
startDate = new Date(isoString);
// ❌ 删除：const chinaOffset = 8 * 60 * 60 * 1000;
// ❌ 删除：startDate = new Date(localDate.getTime() + chinaOffset);
```

### 修复2：WebSocket 消息包含完整时间信息

```typescript
// ✅ 新代码（server/services/testExecution.ts）
this.wsManager.sendTestComplete(runId, {
  status: finalStatus,
  startedAt: testRun.actualStartedAt || testRun.startedAt, // 🔥 新增
  endedAt: testRun.endedAt,
  actualStartedAt: testRun.actualStartedAt, // 🔥 新增：实际开始时间
  actualEndedAt: testRun.finishedAt,        // 🔥 新增：实际结束时间
  duration,
  // ...
});
```

### 修复3：前端优先使用 WebSocket 消息中的时间

```typescript
// ✅ 新代码（src/pages/TestRunDetail.tsx）
// 处理 test_complete 消息时
const messageStartTime = data.actualStartedAt || data.startedAt;
const messageEndTime = data.actualEndedAt || data.endedAt;

if (messageStartTime && messageEndTime) {
  const start = new Date(messageStartTime);
  const end = new Date(messageEndTime);
  const calcDuration = end.getTime() - start.getTime();
  
  // 更新显示
  setStartTime(start);
  setEndTime(end);
  setDuration(formatDuration(calcDuration));
  
  // 同步到数据库
  syncDurationToBackend(id, calcDuration, start, end);
}
```

### 修复后的流程：
1. **后端**：记录实际开始时间（actualStartedAt）和结束时间（actualEndedAt）
2. **后端**：在 WebSocket 消息中**包含开始和结束时间**
3. **前端**：从 WebSocket 消息中获取准确的时间
4. **前端**：计算 `durationMs = actualEndedAt - actualStartedAt`
5. **前端**：将准确的时间发送给后端
6. **后端**：直接解析时间，**不添加偏移**
7. **数据库**：存储准确的时间
8. **结果**：三者完全一致 ✅

## 时间一致性验证

修复后添加了自动验证逻辑：

```typescript
// 计算数据库中的时间差
const dbDuration = updateData.finished_at.getTime() - updateData.started_at.getTime();
const isConsistent = Math.abs(dbDuration - durationMs) < 10; // 允许10ms误差

console.log(`📊 [${id}] 时间一致性检查:`, {
  前端计算的时长: `${durationMs}ms`,
  数据库时间差: `${dbDuration}ms`,
  是否一致: isConsistent ? '✅ 一致' : '❌ 不一致',
  误差: `${Math.abs(dbDuration - durationMs)}ms`
});
```

## 修改的文件

### 后端修改

1. **`server/services/testCaseExecutionService.ts`**
   - `updateExecutionDuration()` 方法
   - 移除了8小时偏移量的添加
   - 添加了时间一致性验证日志

2. **`server/services/testExecution.ts`**
   - 修改 `sendTestComplete` 调用
   - 添加 `startedAt`, `actualStartedAt`, `actualEndedAt` 字段
   - 确保 WebSocket 消息包含完整的时间信息

### 前端修改

3. **`src/pages/TestRunDetail.tsx`**
   - 添加 `TestCompleteData` 接口定义
   - 修改 `test_complete` 消息处理逻辑
   - 优先使用 WebSocket 消息中的时间
   - 修改 useEffect，防止日志时间覆盖 WebSocket 时间

## 测试方法

1. 运行一个测试用例
2. 等待测试完成
3. 查看控制台日志，确认时间一致性检查显示 `✅ 一致`
4. 在数据库中查询 `test_case_executions` 表：
   ```sql
   SELECT 
     id,
     started_at,
     finished_at,
     duration_ms,
     TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000 as calculated_ms
   FROM test_case_executions
   WHERE id = 'your-test-id';
   ```
5. 验证 `duration_ms = calculated_ms`

## 预期结果

- ✅ 前端显示的开始时间 = 数据库存储的开始时间
- ✅ 前端显示的结束时间 = 数据库存储的结束时间
- ✅ 前端计算的 durationMs = 数据库中 finished_at - started_at
- ✅ 时间一致性验证日志显示"一致"

## 注意事项

1. **时区处理**：前端和后端现在都使用本地时间，不再手动添加时区偏移
2. **Prisma行为**：Prisma 会自动处理时区转换，我们只需要传入正确的 Date 对象
3. **向后兼容**：此修复不影响已存在的测试记录

## 相关问题

- 修复前：执行时长与时间戳不匹配
- 修复后：三者完全一致（started_at、finished_at、duration_ms）

---

**修复日期**: 2025-12-12  
**修复版本**: v1.0.0  
**修复者**: AI Assistant

