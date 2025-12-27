# Git 提交说明

## 2024-12-24

### 修复：测试运行列表排序功能未生效

**修改文件：**
- `server/routes/test.ts`
- `src/services/testService.ts`

**问题描述：**
在 `TestRuns.tsx` 中调用 `testService.getAllTestRuns()` 时传递的排序参数（`sortBy: 'startedAt'`, `sortOrder: 'desc'`）没有起作用。虽然前端代码传递了排序参数，但后端 API 并未接收和处理这些参数。

**根本原因：**
1. **后端未接收排序参数**：`GET /tests/runs` 路由没有从查询参数中获取 `sortBy` 和 `sortOrder`
2. **前端未发送排序参数到后端**：`testService.getAllTestRuns()` 方法虽然接收了排序选项，但没有将其添加到 API 请求的查询参数中
3. **排序只在前端本地执行**：前端的排序逻辑对已从后端返回的数据进行排序，但这些数据已经被后端预先排序过，导致排序参数形同虚设

**解决方案：**

#### 1. 后端支持动态排序参数 (server/routes/test.ts)

**核心改进：**
- ✅ **接收排序参数**：从查询参数中获取 `sortBy` 和 `sortOrder`
- ✅ **动态排序逻辑**：根据参数选择排序字段（`startedAt`、`finishedAt`）
- ✅ **支持升序/降序**：根据 `sortOrder` 参数控制排序方向

**实现细节：**
```typescript
// 获取排序参数
const sortBy = (req.query.sortBy as string) || 'startedAt';
const sortOrder = (req.query.sortOrder as string) || 'desc';

// 动态排序逻辑
const allRuns = [...enrichedMemoryRuns, ...dbRunsFormatted].sort((a, b) => {
  let valueA: number;
  let valueB: number;

  if (sortBy === 'finishedAt') {
    valueA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
    valueB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
  } else {
    valueA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    valueB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
  }

  return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
});
```

#### 2. 前端传递排序参数到后端 (src/services/testService.ts)

**核心改进：**
- ✅ **构建查询参数**：将 `sortBy` 和 `sortOrder` 添加到 API 请求 URL
- ✅ **移除冗余的前端排序**：后端已处理排序，前端不需要再次排序
- ✅ **添加调试日志**：记录排序参数以便调试

**实现细节：**
```typescript
// 构建查询参数
const queryParams = new URLSearchParams();
if (options?.sortBy) {
  queryParams.append('sortBy', options.sortBy);
}
if (options?.sortOrder) {
  queryParams.append('sortOrder', options.sortOrder);
}

const url = queryParams.toString() 
  ? `${API_BASE_URL}/tests/runs?${queryParams.toString()}`
  : `${API_BASE_URL}/tests/runs`;

const response = await fetch(url, {
  headers: this.getAuthHeaders()
});
```

**修改效果：**
- ✅ 排序参数现在正确传递到后端并生效
- ✅ 测试运行列表按指定字段和顺序排序
- ✅ 支持按 `startedAt` 或 `finishedAt` 排序
- ✅ 支持升序（`asc`）或降序（`desc`）排序
- ✅ 默认按 `startedAt` 降序排序（最新的在前）

---

## 2024-12-24

### 修复：解决开发服务器热重载失效和端口占用问题

**修改文件：**
- `scripts/dev-server.cjs` (新增)
- `package.json`
- `server/index.ts`
- `热重载问题分析与解决方案.md` (新增)

**问题描述：**
修改代码后需要手动重启服务器，并且经常出现端口占用错误（EADDRINUSE: address already in use 0.0.0.0:3001）。之前的热重载功能失效。

**根本原因：**
1. **tsx watch 热重载机制失效**
   - WebSocket 连接未正确释放
   - 旧的 Node.js 进程未完全退出，仍占用端口 3001
   - 文件监视器在项目较大时可能失效或延迟

2. **端口占用冲突**
   - `tsx watch` 重启时，旧进程卡住不退出
   - 新进程尝试绑定同一端口，导致 EADDRINUSE 错误
   - 手动终止服务器后进程清理不彻底

3. **优雅关闭机制不完善**
   - SIGINT/SIGTERM 信号处理在某些情况下未执行
   - 强制终止（taskkill /F）绕过了清理逻辑
   - 异步清理操作未完成就退出

**解决方案：**

#### 1. 创建智能开发服务器启动脚本 (scripts/dev-server.cjs)

**核心功能：**
- ✅ **自动端口清理**：启动前检查并清理占用端口 3001 的进程
- ✅ **优雅关闭处理**：正确处理 SIGINT/SIGTERM 信号
- ✅ **进程监控**：监控子进程状态，确保正常退出
- ✅ **跨平台支持**：兼容 Windows（netstat + taskkill）和 Unix（lsof + kill）

**实现细节：**
```javascript
// 端口清理逻辑
async function cleanupPort(port) {
  // Windows: netstat -ano | findstr :3001 | findstr LISTENING
  // Unix: lsof -ti:3001
  
  // 提取进程 ID 并终止
  // Windows: taskkill /PID <pid> /F
  // Unix: kill -9 <pid>
}

// 启动 tsx watch 并监控
const serverProcess = spawn('npx', ['tsx', 'watch', '--clear-screen=false', 'server/index.ts']);

// 优雅关闭
process.on('SIGINT', async () => {
  serverProcess.kill('SIGTERM');
  // 5秒后强制终止
  setTimeout(() => serverProcess.kill('SIGKILL'), 5000);
  // 再次清理端口
  await cleanupPort(PORT);
});
```

#### 2. 更新 package.json 脚本配置

**修改内容：**
```json
{
  "scripts": {
    "dev:server": "node scripts/dev-server.cjs",      // 使用新脚本
    "dev:server:old": "tsx watch server/index.ts"     // 保留旧方式作为备用
  }
}
```

**使用方法：**
```bash
# 前后端同时启动（推荐）
npm run dev

# 仅启动后端（使用新脚本）
npm run dev:server

# 仅启动前端
npm run dev:frontend
```

#### 3. 增强服务器错误处理 (server/index.ts)

**添加端口占用错误处理：**
```typescript
// 在 server.listen() 之前添加
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${portNumber} 已被占用！`);
    console.error('\n💡 解决方案：');
    console.error('   1. 停止其他占用该端口的进程');
    console.error('   2. 或者修改 .env 文件中的 PORT 配置');
    console.error('   3. 使用命令查找占用进程: netstat -ano | findstr :' + portNumber);
    process.exit(1);
  } else {
    console.error('❌ 服务器启动错误:', error);
    process.exit(1);
  }
});
```

**优点：**
- 提供清晰的错误信息和解决建议
- 避免启动失败时无提示的情况
- 帮助开发者快速定位问题

#### 4. 创建问题分析文档 (热重载问题分析与解决方案.md)

**文档内容：**
- 📋 问题描述和现象
- 🔍 根本原因分析（tsx watch、端口占用、进程清理）
- 🔧 三种解决方案（开发脚本、手动清理、代码改进）
- 📌 最佳实践（正确启动/停止、环境配置、避免冲突）
- 🚀 验证方案（测试步骤、预期结果）
- 📊 性能优化建议（减少监视文件、使用 nodemon）
- 🐛 故障排查（常见问题和解决方法）

**验证测试：**

1. **停止所有进程**
   ```bash
   taskkill /IM node.exe /F
   ```

2. **使用新脚本启动**
   ```bash
   npm run dev
   ```
   
   **预期输出：**
   ```
   🔍 检查端口 3001 是否被占用...
   ✅ 端口 3001 可用
   🔄 启动热重载服务器（tsx watch）...
   ✅ 服务器已启动
   ```

3. **测试热重载**
   - 修改 `server/index.ts` 中的任意代码
   - 观察终端输出，应该看到服务器自动重启
   - 无 EADDRINUSE 错误

4. **测试优雅关闭**
   - 按 `Ctrl+C` 停止服务器
   - 应该看到：
     ```
     🔌 正在关闭服务器...
     🗄️ 正在关闭数据库连接...
     ✅ 服务器已完全关闭
     ```
   - 再次启动，无端口占用错误

**影响范围：**
- ✅ 开发体验提升：修改代码自动重载，无需手动重启
- ✅ 错误减少：避免端口占用导致的启动失败
- ✅ 稳定性提高：进程清理更彻底，减少僵尸进程
- ✅ 调试效率：清晰的错误提示和解决建议

**向后兼容：**
- ✅ 保留旧的启动方式 `dev:server:old`
- ✅ 现有功能不受影响
- ✅ 可随时回退到旧版本

**最佳实践：**
1. 使用 `npm run dev` 启动开发环境
2. 使用 `Ctrl+C` 正常停止服务（等待优雅关闭完成）
3. 避免同时在多个终端运行开发服务器
4. 遇到端口占用时，脚本会自动清理

**性能优化建议：**
- 如果热重载仍然较慢，可以在 `tsconfig.json` 中排除不需要监视的目录（node_modules, dist, artifacts 等）
- 考虑使用 nodemon 替代 tsx watch 以获得更好的性能

**手动清理端口命令（备用）：**
```powershell
# Windows：查找并终止占用端口的进程
netstat -ano | findstr :3001 | findstr LISTENING
taskkill /PID <PID> /F

# 一键清理（PowerShell）
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /PID %a /F
```

**相关 Issue：**
- 解决 #端口占用问题
- 改进 #热重载机制
- 优化 #开发体验

---

## 2024-12-24

### 修复：测试运行时间无法正常显示的问题

**修改文件：**
- `src/components/TestRunsTable.tsx`
- `src/pages/TestRuns.tsx`

**问题描述：**
测试运行列表中的开始时间和结束时间显示为 `-` 或无法正常显示。

**根本原因：**
1. **字段名不一致**：`TestRuns.tsx` 中使用 `startTime/endTime`，但 `TestRunsTable.tsx` 期望 `startedAt/finishedAt`
2. **日期类型不匹配**：后端返回的是 ISO 字符串格式的时间（如 `"2025-12-24T11:02:47.033Z"`），但前端 `safeFormat` 函数只能处理 `Date` 对象
3. **类型定义不准确**：接口定义中 `startedAt` 和 `finishedAt` 只声明为 `Date` 类型，没有考虑字符串类型
4. **排序逻辑缺陷**：排序时也只处理了 `Date` 对象，导致字符串类型的日期无法正确排序

**修复内容：**

#### 1. 修复字段名不一致问题（src/pages/TestRuns.tsx 第209-210行）

**修改前：**
```typescript
const processedRun = {
  startTime,  // ❌ 错误的字段名
  endTime,    // ❌ 错误的字段名
  ...
};
```

**修改后：**
```typescript
const processedRun = {
  startedAt: startTime,   // ✅ 正确的字段名
  finishedAt: endTime,    // ✅ 正确的字段名
  ...
};
```

**说明：**
这是导致时间无法显示的**主要原因**。`TestRunsTable` 组件期望接收 `startedAt` 和 `finishedAt` 字段，但实际传递的是 `startTime` 和 `endTime`，导致组件无法读取到时间数据。

#### 2. 增强 safeFormat 函数（src/components/TestRunsTable.tsx 第144-171行）

**修改前：**
```typescript
const safeFormat = (date: Date | null | undefined, formatStr: string): string => {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '-';
    }
    return format(date, formatStr);
  } catch (error) {
    return '日期格式化错误';
  }
};
```

**修改后：**
```typescript
const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
  try {
    if (!date) {
      return '-';
    }
    
    // 🔥 修复：处理字符串类型的日期
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '-';
    }
    
    // 验证日期有效性
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    return format(dateObj, formatStr);
  } catch (error) {
    console.error('日期格式化错误:', error, 'date:', date);
    return '-';
  }
};
```

**改进点：**
- ✅ 支持 `Date` 对象和 ISO 字符串两种格式
- ✅ 自动转换字符串为 Date 对象
- ✅ 增加错误日志，便于调试
- ✅ 更严格的类型检查

#### 3. 更新接口定义（第31-32行）

**修改前：**
```typescript
interface TestRun {
  startedAt: Date;
  finishedAt?: Date;
}
```

**修改后：**
```typescript
interface TestRun {
  // 支持 Date 对象或 ISO 字符串，因为从后端可能返回字符串
  startedAt: Date | string;
  finishedAt?: Date | string;
}
```

#### 4. 修复排序逻辑（第216-223行）

**修改前：**
```typescript
if (sortField === 'startedAt' || sortField === 'finishedAt') {
  const aDate = aValue instanceof Date ? aValue.getTime() : 0;
  const bDate = bValue instanceof Date ? bValue.getTime() : 0;
  return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
}
```

**修改后：**
```typescript
if (sortField === 'startedAt' || sortField === 'finishedAt') {
  // 🔥 修复：处理字符串类型的日期
  const aDate = aValue 
    ? (aValue instanceof Date ? aValue.getTime() : new Date(aValue as string).getTime())
    : 0;
  const bDate = bValue 
    ? (bValue instanceof Date ? bValue.getTime() : new Date(bValue as string).getTime())
    : 0;
  return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
}
```

**数据流分析：**

```
后端返回 (server/routes/test.ts)
  ↓
{
  startedAt: "2025-12-24T11:02:47.033Z",  // ISO 字符串
  finishedAt: "2025-12-24T11:03:05.433Z"
}
  ↓
前端接收 (TestRuns.tsx)
  ↓
前端处理：
  startTime = new Date(run.startedAt)  // 转换为 Date 对象
  ↓
  ❌ 修复前：{ startTime, endTime }  // 字段名错误
  ✅ 修复后：{ startedAt: startTime, finishedAt: endTime }  // 字段名正确
  ↓
传递给组件 (TestRunsTable.tsx)
  ↓
组件接收：run.startedAt, run.finishedAt
  ↓
safeFormat() 函数
  ↓
✅ 现在支持两种格式：
   - Date 对象：直接使用
   - ISO 字符串：自动转换为 Date 对象
  ↓
format(dateObj, 'yyyy-MM-dd HH:mm:ss')
  ↓
显示：2025-12-24 11:02:47
```

**修复效果：**

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 后端返回 ISO 字符串 | ❌ 显示 `-` | ✅ 正常显示时间 |
| 后端返回 Date 对象 | ✅ 正常显示 | ✅ 正常显示 |
| 时间为 null/undefined | ✅ 显示 `-` | ✅ 显示 `-` |
| 无效的时间字符串 | ❌ 报错 | ✅ 显示 `-` |
| 排序功能 | ❌ 字符串无法排序 | ✅ 正确排序 |

**测试验证：**
- ✅ 开始时间正常显示
- ✅ 结束时间正常显示
- ✅ Tooltip 显示正确
- ✅ 排序功能正常
- ✅ 无 TypeScript 编译错误
- ✅ 无运行时错误

**影响范围：**
- ✅ 数据处理层（TestRuns.tsx）：字段名统一
- ✅ 测试运行列表的时间显示（TestRunsTable.tsx 第493-494、502-503行）
- ✅ Tooltip 时间显示（第493、502行）
- ✅ 详情卡片时间显示（第467、470、578行）
- ✅ 时间字段排序功能（第216-223行）

**向后兼容：**
- ✅ 完全向后兼容
- ✅ 支持 Date 对象（旧格式）
- ✅ 支持 ISO 字符串（新格式）
- ✅ 自动适配两种格式

**最佳实践：**
1. 保持字段命名一致性：数据处理层和展示层使用相同的字段名
2. 前端应该在数据加载时统一转换日期格式
3. 组件层也应该支持多种格式以提高健壮性

**调试建议：**
如果时间仍然无法显示，请检查浏览器控制台的日志输出：
- `[runId] 时间数据:` - 查看数据处理后的时间字段
- `📅 safeFormat:` - 查看日期格式化过程
- 确认字段名是否为 `startedAt` 和 `finishedAt`

---

### 重构：统一测试运行时间字段，简化API返回数据

**修改文件：**
- `server/routes/test.ts`
- `src/components/TestRunsTable.tsx`
- `src/types/test.ts`

**问题描述：**
后端 `/api/tests/runs` 接口返回了多个冗余的时间字段，导致：
1. 前后端字段不一致（后端返回 `startTime/endTime`，前端使用 `startedAt/finishedAt`）
2. 类型定义混乱（`startTime`、`startedAt`、`actualStartedAt`、`endTime`、`endedAt`、`finishedAt` 共6个字段）
3. 维护困难，容易出错

**重构方案：**

#### 1. 统一时间字段命名

**删除的冗余字段：**
- ❌ `startTime`
- ❌ `endTime`
- ❌ `actualStartedAt`
- ❌ `endedAt`

**保留的标准字段：**
- ✅ `startedAt` - 测试开始时间（唯一标准）
- ✅ `finishedAt` - 测试完成时间（唯一标准）

#### 2. 后端接口优化 (server/routes/test.ts)

**GET /api/tests/runs 返回数据结构：**
```typescript
// 修改前（第497-498行）
{
  startTime: dbRun.startedAt || dbRun.queuedAt,
  endTime: dbRun.finishedAt,
  startedAt: dbRun.startedAt  // 冗余字段
}

// 修改后
{
  startedAt: dbRun.startedAt || dbRun.queuedAt,
  finishedAt: dbRun.finishedAt
}
```

**GET /api/tests/runs/:runId 返回数据结构：**
```typescript
// 修改前（第322-335行）
{
  startTime: dbRun.startedAt || dbRun.queuedAt,
  endTime: dbRun.finishedAt,
  startedAt: dbRun.startedAt ? new Date(dbRun.startedAt) : undefined
}

// 修改后
{
  startedAt: dbRun.startedAt || dbRun.queuedAt,
  finishedAt: dbRun.finishedAt
}
```

#### 3. 前端组件优化 (src/components/TestRunsTable.tsx)

**接口定义：**
```typescript
// 修改前（第30-31行）
interface TestRun {
  startTime: Date;
  endTime?: Date;
}

// 修改后
interface TestRun {
  startedAt: Date;
  finishedAt?: Date;
}
```

**排序字段：**
```typescript
// 修改前（第61行）
type SortField = 'name' | 'status' | 'startTime' | 'endTime' | ...;

// 修改后
type SortField = 'name' | 'status' | 'startedAt' | 'finishedAt' | ...;
```

**所有使用处更新：**
- 表头排序按钮（第264、271行）
- 数据显示（第492、501行）
- Tooltip 显示（第466、469行）
- 详情卡片（第574行）

#### 4. 类型定义优化 (src/types/test.ts)

**TestRun 接口简化：**
```typescript
// 修改前（第141-162行）
export interface TestRun {
  startedAt: Date;
  actualStartedAt?: Date;  // 冗余
  endedAt?: Date;          // 冗余
  finishedAt?: Date;       // 冗余
  startTime?: Date;        // 冗余
}

// 修改后
export interface TestRun {
  startedAt: Date;
  finishedAt?: Date;
}
```

**优化效果：**

| 方面 | 修改前 | 修改后 | 改进 |
|------|--------|--------|------|
| 时间字段数量 | 6个 | 2个 | ⬇️ 减少67% |
| 字段一致性 | ❌ 不一致 | ✅ 完全一致 | 100% |
| 代码可维护性 | ⚠️ 混乱 | ✅ 清晰 | 显著提升 |
| API 响应大小 | 较大 | 较小 | 减少冗余 |

**修改涉及的代码行数：**
- `server/routes/test.ts`: 6处修改
- `src/components/TestRunsTable.tsx`: 8处修改
- `src/types/test.ts`: 1处修改

**向后兼容性：**
- ⚠️ **破坏性变更**：前端必须同步更新
- 建议：前后端同时部署

**测试验证：**
- ✅ 后端返回数据结构正确
- ✅ 前端显示时间正确
- ✅ 排序功能正常
- ✅ 无 TypeScript 编译错误（新增）
- ✅ 字段命名统一

**优势：**
1. ✅ 消除字段冗余，减少混淆
2. ✅ 前后端字段完全一致
3. ✅ 代码更易维护和理解
4. ✅ API 响应更简洁
5. ✅ 类型定义更清晰

---

### 修复：测试运行列表时间显示错误和排序功能

**修改文件：**
- `src/pages/TestRuns.tsx`
- `src/services/testService.ts`

**问题描述：**
1. **时间显示不正确**：后端返回的 `startTime` 字段值不正确（例如：显示11:08，但实际测试在11:02开始），前端刷新后时间会变
2. **缺少排序功能**：刷新页面时直接使用 `fetch` 调用API，没有使用排序功能，导致测试运行列表顺序混乱

**根本原因：**
- 后端返回多个时间字段（`startTime`、`startedAt`、`actualStartedAt`），前端使用了不准确的 `startTime` 字段
- 直接使用 `fetch` API 而不是 `testService.getAllTestRuns()` 方法，无法使用排序功能

**修复内容：**

#### 1. 优化 TestRuns.tsx 数据加载逻辑

**修改前（第169-171行）：**
```typescript
const response = await fetch(`${getApiBaseUrl('/api/tests/runs')}`, {
  headers
});
```

**修改后：**
```typescript
// 使用 testService.getAllTestRuns() 方法，支持排序
// 按 startedAt 降序排列，最新的测试显示在最前面
const apiData = await testService.getAllTestRuns({
  sortBy: 'startedAt',
  sortOrder: 'desc'
});
```

#### 2. 修复时间字段使用优先级

**修改前（第191行）：**
```typescript
startTime = run.startTime ? new Date(run.startTime) : null;
```

**修改后（第178行）：**
```typescript
// 优先使用 startedAt，其次是 actualStartedAt，最后才是 startTime
const startTimeField = run.startedAt || run.actualStartedAt || run.startTime;
startTime = startTimeField ? new Date(startTimeField) : new Date();
```

#### 3. 同样修复结束时间字段

```typescript
// 优先使用 finishedAt，其次是 endedAt，最后才是 endTime
const endTimeField = run.finishedAt || run.endedAt || run.endTime;
endTime = endTimeField ? new Date(endTimeField) : undefined;
```

#### 4. 代码优化
- 删除了不再需要的备用套件数据加载逻辑（原269-349行）
- 简化了数据加载流程
- 修复了 TypeScript 类型错误（startTime 不能为 null）

**修复效果：**

**时间字段优先级：**
| 字段 | 说明 | 优先级 |
|------|------|--------|
| `startedAt` | 测试开始时间（最准确） | ⭐⭐⭐ 最高 |
| `actualStartedAt` | 实际开始执行时间 | ⭐⭐ 高 |
| `startTime` | 开始时间（可能不准确）| ⭐ 低 |

**排序规则：**
- 默认按 `startedAt` 降序排列（最新的在前）
- 数据加载后自动排序，无需额外操作
- 刷新页面时保持排序一致性

**解决的问题：**
1. ✅ 修复时间显示不准确的问题（使用 startedAt 而不是 startTime）
2. ✅ 修复刷新后时间变化的问题（统一时间字段来源）
3. ✅ 添加自动排序功能（最新测试显示在最前）
4. ✅ 简化了代码逻辑，提高可维护性
5. ✅ 修复了 TypeScript 类型错误

**技术细节：**
```typescript
// 数据示例（来自用户提供的JSON）
{
  "startedAt": "2025-12-24T11:02:47.033Z",      // ✅ 正确的时间
  "actualStartedAt": "2025-12-24T11:02:47.956Z", // ✅ 实际开始时间
  "startTime": "2025-12-24T11:08:48.953Z",      // ❌ 错误的时间（比startedAt晚6分钟）
  "finishedAt": "2025-12-24T11:03:05.433Z"
}
```

**影响范围：**
- 测试运行列表页面 (TestRuns.tsx)
- 所有显示测试运行时间的地方
- 测试运行列表的排序顺序

**测试验证：**
- ✅ 时间显示正确且一致
- ✅ 刷新页面后时间不再变化
- ✅ 最新的测试运行显示在最前面
- ✅ 无新的 TypeScript 编译错误
- ✅ 代码逻辑更加清晰

**用户体验提升：**
1. ✅ 时间显示准确可靠
2. ✅ 最新测试始终在最前面，便于查看
3. ✅ 刷新页面后数据显示一致
4. ✅ 无需手动排序或筛选

---

### 功能增强：测试运行列表支持前端排序

**修改文件：**
- `src/services/testService.ts`

**变更内容：**

#### 1. getAllTestRuns() 方法增强
- **优化前**：从 `/api/tests/runs` 接口获取数据后直接返回，无排序功能
- **优化后**：
  - 支持可选的排序参数 `sortBy` 和 `sortOrder`
  - 可按 `startedAt`、`finishedAt`、`startTime` 字段排序
  - 支持升序（asc）或降序（desc）排列
  - 默认不排序，保持后端原始顺序

#### 2. API 签名
```typescript
async getAllTestRuns(options?: {
  sortBy?: 'startedAt' | 'finishedAt' | 'startTime';
  sortOrder?: 'asc' | 'desc';
}): Promise<TestRun[]>
```

#### 3. 排序实现细节
- 前端排序：在获取数据后进行客户端排序，不依赖后端修改
- 日期比较：使用 `getTime()` 转换为时间戳进行数值比较
- 空值处理：缺失的日期字段视为时间戳 0（最早）
- 性能优化：使用原生 `Array.sort()` 方法，适合中小数据量（< 1000条）

#### 4. 使用示例

**默认不排序：**
```typescript
const testRuns = await testService.getAllTestRuns();
```

**按开始时间降序（最新在前）：**
```typescript
const testRuns = await testService.getAllTestRuns({
  sortBy: 'startedAt',
  sortOrder: 'desc'  // 最常用：最新的测试显示在最前面
});
```

**按开始时间升序（最旧在前）：**
```typescript
const testRuns = await testService.getAllTestRuns({
  sortBy: 'startedAt',
  sortOrder: 'asc'
});
```

**按完成时间排序：**
```typescript
const testRuns = await testService.getAllTestRuns({
  sortBy: 'finishedAt',
  sortOrder: 'desc'
});
```

#### 5. 技术细节
```typescript
// 排序逻辑片段（testService.ts 第575-585行）
testRuns = testRuns.sort((a, b) => {
  const dateA = a[sortBy] ? new Date(a[sortBy] as Date).getTime() : 0;
  const dateB = b[sortBy] ? new Date(b[sortBy] as Date).getTime() : 0;
  
  // desc: 最新的在前面（时间大的在前）
  // asc: 最旧的在前面（时间小的在前）
  return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
});
```

**解决的问题：**
- ✅ 测试运行列表无法按时间排序，用户难以快速找到最新的测试记录
- ✅ 后端未提供排序功能，通过前端排序快速实现需求
- ✅ 灵活支持多种排序字段和顺序

**优势：**
1. ✅ 向后兼容：不传参数时保持原有行为
2. ✅ 灵活性高：支持多种排序字段和方向
3. ✅ 实现简单：纯前端排序，无需后端改动
4. ✅ 性能良好：适用于常规数据量
5. ✅ 类型安全：TypeScript 类型约束确保参数正确

**影响范围：**
- 所有调用 `testService.getAllTestRuns()` 的组件
- 可选功能，不影响现有调用

**使用建议：**
- **推荐用法**：`{ sortBy: 'startedAt', sortOrder: 'desc' }` - 最新的测试显示在前
- **适用场景**：需要按时间顺序查看测试记录的页面
- **性能考虑**：数据量 < 1000 条时性能良好；大数据量建议后端实现分页+排序

**测试验证：**
- ✅ 无参数调用：返回原始顺序 ✓
- ✅ 降序排序：最新记录在前 ✓
- ✅ 升序排序：最旧记录在前 ✓
- ✅ 空值处理：缺失日期字段不报错 ✓
- ✅ 类型检查：TypeScript 编译通过 ✓

**相关文档：**
- 详细使用指南：`getAllTestRuns使用示例.md`

---

### 优化：修复缓存统计页面数据显示问题

**修改文件：**
- `src/pages/CacheStats.tsx`

**变更内容：**

#### 1. 修复趋势图数据显示问题
- **问题**：当后端不返回 `trendData` 字段时，趋势图显示"暂无数据"占位，导致图表渲染异常
- **修复**：
  - 改进 `getTrendData()` 函数，当没有趋势数据时，基于当前统计生成一个实时数据点
  - 在 `renderTrendChart()` 中添加空数据检测，优雅地显示"暂无趋势数据"提示
  - 优化图表坐标轴标签，提升可读性

#### 2. 统一 hitRate 数据类型处理
- **问题**：后端返回的 `hitRate` 存在类型不一致（有的是数字，有的是字符串"100.0"）
- **修复**：
  - 新增 `formatHitRate()` 工具函数，统一处理数字和字符串类型的命中率
  - 替换所有视图中的 hitRate 显示逻辑，使用统一的格式化函数
  - 确保所有命中率都显示为一致的 `X.X%` 格式

#### 3. 优化饼图数据处理
- **改进前**：当没有任何数据时，饼图为空或显示异常
- **改进后**：
  - 检测数据状态，当总请求为0时显示"暂无数据"占位
  - 当只有命中或只有未命中时，正确处理单一数据项
  - 动态构建饼图数据数组，避免空值项

#### 4. 代码重构和优化
- 提取公共的 `formatHitRate()` 函数，减少重复代码
- 统一所有视图（概览、分类、经典、详细）的数据显示逻辑
- 改进错误处理和边界情况处理

**修复的视图组件：**
1. ✅ 顶部分类卡片（元素缓存/操作缓存/断言缓存）
2. ✅ 概览视图 - 趋势图和命中率分析
3. ✅ 分类视图 - 大卡片和对比表格
4. ✅ 经典视图 - 趋势图和饼图
5. ✅ 详细视图 - 完整统计表格

**技术细节：**
```typescript
// 新增的工具函数
const formatHitRate = (rate: number | string | undefined | null): string => {
  if (rate === undefined || rate === null) return '0.0';
  const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
  return isNaN(numRate) ? '0.0' : numRate.toFixed(1);
};
```

**后端返回数据示例：**
```json
{
  "breakdown": {
    "element": { "hitRate": 0 },
    "operation": { "hitRate": "100.0" },  // 字符串类型
    "assertion": { "hitRate": 0 }
  }
}
```

**解决的问题：**
- 修复了命中率显示不一致的问题（有的显示"100.0%"，有的显示"0%"）
- 修复了趋势图在无数据时显示异常的问题
- 修复了饼图在边界情况下的显示问题
- 提升了代码可维护性和一致性

**影响范围：**
- 缓存统计页面的所有视图模式
- 所有显示缓存命中率的地方

**测试验证：**
- ✅ 无 linter 错误
- ✅ 正确处理字符串类型的 hitRate
- ✅ 正确处理数字类型的 hitRate
- ✅ 正确处理 null/undefined 情况
- ✅ 所有视图显示一致

---

### 修复：过滤文档中的base64图片，优化AI输入长度

**修改文件：**
- `server/routes/axure.ts`

**变更内容：**

#### 1. 文档图片过滤（核心优化）
- **HTML文件**：自动过滤 `<img>` 标签中的base64图片，替换为简单的位置标记
- **DOCX文件**：改用 `mammoth.convertToHtml()` 转换为HTML（保留文档结构），然后过滤base64图片
- **Markdown文件**：过滤 `![alt](data:image/...)` 和 HTML 格式的base64图片
- **PDF文件**：使用 `pdf-parse` 提取纯文本，本身不包含图片

#### 2. 图片过滤策略
- 识别并移除 `src="data:image/...;base64,..."` 格式的图片
- 识别并移除超长 src 属性（>1000字符，可能是base64）
- 替换为简洁标记：`<img src="[图片1: 描述]" alt="图片1" />`（HTML）
- 或：`![图片1]([图片1: 描述])`（Markdown）
- 保留图片的 alt 文本（如果有）

#### 3. 详细日志输出
```
🖼️  已过滤 N 个base64图片
📊 过滤前: XXX 字符，过滤后: YYY 字符
📉 减少: ZZZ 字符 (百分比%)
```

#### 4. 内容长度安全检查（备用方案）
- 在过滤图片后，如果内容仍然超过 200,000 字符，进行智能截断
- 保留开头70%和结尾30%的内容
- 添加提示标记和建议（拆分文档处理）

**解决的问题：**
- 修复了当上传的文档包含大量图片时，base64编码导致内容超出AI模型限制的问题
- 错误信息：`Range of input length should be [1, 258048]`
- 根本原因：Word文档转HTML时，图片被转换为base64编码，单张图片可能几万到几十万字符

**技术细节：**
- **之前的方案**：使用 `mammoth.extractRawText()` 提取纯文本，丢失文档结构
- **优化后方案**：使用 `mammoth.convertToHtml()` 保留结构，过滤base64图片
- **过滤效果**：一张普通图片的base64编码约20,000-100,000字符，过滤后仅20-30字符
- **AI模型限制**：258,048 字符（系统提示词+用户提示词）
- **安全阈值**：200,000 字符（为系统提示词预留约58,000字符空间）

**影响范围：**
- 所有通过文件上传生成需求文档的功能（HTML、DOCX、Markdown、PDF）
- ✅ 所有通过文本粘贴生成需求文档的功能（已修复遗漏）

**优势：**
1. ✅ 保留文档结构和格式
2. ✅ 标记图片位置，AI能理解图片的上下文
3. ✅ 大幅减少输入长度（图片多的文档可减少90%+）
4. ✅ 避免简单粗暴的截断，保持内容完整性
5. ✅ 详细的日志便于诊断和优化

---

### 🔧 修复记录

**2024-12-24 第二次修复：完善文本输入的图片过滤**

**问题：**
- 第一次修复只在文件上传路径中添加了图片过滤
- 遗漏了 `/api/v1/axure/generate-from-text` 接口的文本输入图片过滤
- 用户通过文本粘贴功能输入包含base64图片的内容时，仍然会超出限制

**修复内容：**
- 在 `/generate-from-text` 接口中添加完整的图片过滤逻辑（第1044-1082行）
- 支持过滤Markdown格式：`![alt](data:image/...)`
- 支持过滤HTML格式：`<img src="data:image/...">`
- 与文件上传路径的过滤逻辑保持一致

**测试用例：**
```json
{
  "text": "文本内容...\n\n![图片](data:image/png;base64,iVBORw0KGgoAAAA...很长的base64)\n\n更多文本...",
  "systemName": "系统名称",
  "moduleName": "模块名称"
}
```

**预期结果：**
```
🖼️  【文本图片过滤】检测到并过滤了base64图片
   - 图片数量: 1 个
   📊 过滤前: 50000 字符
   📊 过滤后: 200 字符
   📉 减少: 49800 字符 (99.6%)
```

**前端响应增强：**
现在后端会在响应中返回过滤信息：
```json
{
  "success": true,
  "data": {
    "sessionId": "...",
    "requirementDoc": "...",
    "sections": [...],
    "contentSourceType": "text",
    "filterInfo": {
      "imagesFiltered": 8,
      "originalLength": 1057392,
      "filteredLength": 4149,
      "reductionPercent": "99.6"
    }
  }
}
```

这样前端可以：
1. 知道内容被过滤了
2. 显示过滤统计给用户
3. 提示用户：虽然你发送了很大的文件，但我们已经优化处理了

---

### 优化：测试运行进度条增加动画效果

**修改文件：**
- `src/components/TestRunsTable.tsx`
- `tailwind.config.js`

**变更内容：**

#### 1. 进度条动画效果
- **优化前**：进度条为静态蓝色条，无动画效果
- **优化后**：
  - 当测试状态为 `running`（进行中）时，进度条显示从左到右滑动的渐变动画
  - 使用蓝色到浅蓝色的渐变效果（`#3b82f6 → #60a5fa → #3b82f6`）
  - 动画持续时间：1.5秒，无限循环，缓入缓出
  - 非运行状态的进度条保持静态蓝色显示

#### 2. 条件渲染优化
- 根据 `run.status === 'running'` 判断是否应用动画效果
- 只有运行中的测试才显示动画，已完成、失败、队列中等状态不显示动画
- 通过内联样式动态设置背景渐变和动画参数

#### 3. Tailwind配置扩展
- 在 `tailwind.config.js` 中添加自定义动画 `progress-shimmer`
- 添加对应的 keyframes `progressShimmer`，实现背景位置的平滑移动
- 配置 `backgroundPosition` 从 `-200%` 到 `200%` 的过渡效果

**技术细节：**

**组件代码（TestRunsTable.tsx 第397-415行）：**
```jsx
<div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden relative">
  <div
    className={clsx(
      "h-full rounded-full transition-all duration-300",
      run.status === 'running' 
        ? "bg-blue-500 relative" 
        : "bg-blue-500"
    )}
    style={{ 
      width: `${run.progress}%`,
      ...(run.status === 'running' ? {
        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
        backgroundSize: '200% 100%',
        animation: 'progressShimmer 1.5s ease-in-out infinite'
      } : {})
    }}
  />
</div>
```

**Tailwind配置（tailwind.config.js）：**
```javascript
animation: {
  'progress-shimmer': 'progressShimmer 1.5s ease-in-out infinite',
},
keyframes: {
  progressShimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
}
```

**解决的问题：**
- 提升了测试运行过程中的视觉反馈
- 用户可以更直观地看到测试正在进行中
- 区分运行中和已完成的测试状态

**视觉效果：**
- 🔵 运行中：动态渐变闪烁效果，从左向右滑动
- 🔵 已完成/失败/其他：静态纯色进度条

**影响范围：**
- 测试运行列表页面的进度条显示
- 所有处于运行状态的测试执行记录

**兼容性：**
- ✅ 不影响现有功能
- ✅ 向后兼容
- ✅ 无 linting 错误（新代码）
- ✅ 性能影响可忽略（纯CSS动画）

**用户体验提升：**
1. ✅ 更好的视觉反馈，明确表示测试正在进行
2. ✅ 美观的动画效果，提升整体界面质感
3. ✅ 状态区分明显，一眼识别运行状态

#### 4. 修复构建错误
- **问题**：Tailwind 配置文件使用 ES6 模块语法导致 PostCSS 编译错误
  - 错误信息：`ENOENT: no such file or directory, open 'C:\Users\Ankki\AppData\Local\Temp\node-jiti\test_flow-tailwind.config.js.7b545325.js'`
- **修复**：
  - 将 `tailwind.config.js` 从 ES6 模块格式（`export default`）改为 CommonJS 格式（`module.exports`）
  - 修复 `TestRunsTable.tsx` 中进度条 `<td>` 标签的结构错误（内容被错误地放在标签外）
- **技术说明**：
  - 虽然 `package.json` 中设置了 `"type": "module"`，但 Tailwind CSS 的 PostCSS 插件在某些情况下对 CommonJS 格式支持更稳定
  - 使用 `module.exports` 确保配置文件能被正确加载和编译

#### 5. 修复 CSS 文件加载错误（500 错误）和 jiti 临时文件错误
- **问题1**：CSS 文件返回 500 内部服务器错误
  - 错误信息：`GET http://172.19.1.111:5173/src/index.css?t=... net::ERR_ABORTED 500 (Internal Server Error)`
  - 错误信息：`GET http://172.19.1.111:5173/src/styles/globals.css?t=... net::ERR_ABORTED 500 (Internal Server Error)`
- **问题2**：jiti 临时文件写入失败
  - 错误信息：`ENOENT: no such file or directory, open 'C:\Users\Ankki\AppData\Local\Temp\node-jiti\test_flow-tailwind.config.js.7b545325.js'`
  - 根本原因：即使使用 `module.exports`，当 `package.json` 中设置了 `"type": "module"` 时，`.js` 文件仍会被 jiti 尝试处理，导致临时文件写入失败
- **修复方案**：
  - 将 `tailwind.config.js` 重命名为 `tailwind.config.cjs`
  - 将 `postcss.config.js` 重命名为 `postcss.config.cjs`
  - 使用 `.cjs` 扩展名明确告诉 Node.js 这些是 CommonJS 模块，避免 jiti 处理
- **技术说明**：
  - `.cjs` 扩展名强制 Node.js 将其识别为 CommonJS 模块
  - 即使 `package.json` 中有 `"type": "module"`，`.cjs` 文件也会被当作 CommonJS 处理
  - jiti 不会尝试处理 `.cjs` 文件，避免了临时文件写入问题
  - PostCSS 和 Tailwind 都能正确识别 `.cjs` 配置文件

**修复的构建问题：**
- ✅ Tailwind 配置文件格式兼容性问题
- ✅ PostCSS 配置文件格式兼容性问题
- ✅ 组件 HTML 结构错误
- ✅ CSS 文件编译错误（500 错误）

#### 6. 修复进度条动画不显示问题
- **问题**：运行中的测试进度条动画不显示
- **根本原因**：
  - 之前使用内联样式设置动画 `animation: 'progressShimmer 1.5s ease-in-out infinite'`
  - 但 CSS keyframes 名称是 `progressShimmer`，而 Tailwind 动画类名是 `progress-shimmer`（带连字符）
  - 内联样式中的动画名称无法正确匹配 Tailwind 的 keyframes
- **修复方案**：
  - 改用 Tailwind 的 `animate-progress-shimmer` 类名来应用动画
  - 使用 Tailwind 的渐变类 `bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600` 替代内联渐变
  - 使用内联样式设置 `backgroundSize: '200% 100%'` 来支持动画效果
- **技术说明**：
  - Tailwind 的动画类名会自动匹配对应的 keyframes
  - 使用 Tailwind 类名比内联样式更可靠，且能正确应用动画
  - `backgroundSize: '200% 100%'` 是动画效果的关键，让渐变背景可以滑动

**修复后的效果：**
- ✅ 运行中的测试进度条显示流畅的渐变动画
- ✅ 动画从左到右循环滑动
- ✅ 非运行状态的进度条保持静态显示

