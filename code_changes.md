# 测试用例删除功能分析报告

## 问题描述
删除UI自动化测试用例后，测试执行记录依然存在。

## 原因分析

### 1. 数据库关系结构

根据 `prisma/schema.prisma` 分析，测试用例与执行记录的关系：

**test_cases 表关联的执行记录表：**

1. **test_case_executions 表** (单个测试用例执行记录)
   - 外键：`test_case_id` → `test_cases.id`
   - 级联删除：`onDelete: Cascade`
   - Schema定义（第346行）：
     ```prisma
     test_cases  test_cases  @relation(fields: [test_case_id], references: [id], onDelete: Cascade)
     ```

2. **test_run_results 表** (测试套件运行结果)
   - 外键：`case_id` → `test_cases.id`
   - 级联删除：`onDelete: Cascade`
   - Schema定义（第178行）：
     ```prisma
     test_cases  test_cases  @relation(fields: [case_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
     ```

### 2. 数据库迁移文件验证

在 `prisma/migrations/20251119171318_sync_schema_with_prisma/migration.sql` 中确认了外键约束：

**test_case_executions 外键（第621行）：**
```sql
ALTER TABLE `test_case_executions` 
ADD CONSTRAINT `test_case_executions_test_case_id_fkey` 
FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) 
ON DELETE CASCADE ON UPDATE CASCADE;
```

**test_run_results 外键（第664行）：**
```sql
ALTER TABLE `test_run_results` 
ADD CONSTRAINT `test_run_results_ibfk_2` 
FOREIGN KEY (`case_id`) REFERENCES `test_cases`(`id`) 
ON DELETE CASCADE ON UPDATE NO ACTION;
```

### 3. 删除逻辑实现

**后端删除实现** (`server/services/testExecution.ts` 第777-785行)：
```typescript
public async deleteTestCase(id: number): Promise<boolean> {
  try {
    await this.prisma.test_cases.delete({ where: { id } });
    return true;
  } catch (error) {
    console.error(`删除测试用例 ${id} 失败:`, error);
    return false;
  }
}
```

**前端删除实现** (`src/pages/TestCases.tsx` 第976-1007行)：
```typescript
const handleDeleteTestCase = (testCase: TestCase) => {
  AntModal.confirm({
    title: '确认删除',
    content: '您确定要删除测试用例吗？此操作无法撤销。',
    onOk: async () => {
      try {
        setLoading(true);
        await testService.deleteTestCase(testCase.id);
        await loadTestCases();
        showToast.success('测试用例删除成功！');
      } catch (error: any) {
        console.error('删除测试用例失败:', error);
        showToast.error(`删除失败: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
  });
};
```

## 结论

### 理论上：应该自动级联删除

根据代码分析：
1. ✅ 数据库schema已正确定义 `ON DELETE CASCADE`
2. ✅ 数据库迁移文件已正确添加外键约束
3. ✅ 删除逻辑使用Prisma的标准删除方法

**理论上，删除测试用例时，所有相关的测试执行记录（test_case_executions 和 test_run_results）会被自动级联删除。**

### 可能的问题原因

如果执行记录依然存在，可能的原因包括：

1. **数据库外键约束未生效**
   - 迁移脚本未正确执行
   - 数据库引擎不支持外键（如MyISAM，需使用InnoDB）
   - 外键约束被手动删除或未创建

2. **查看的是其他表的记录**
   - 可能看到的是其他测试用例的执行记录
   - 前端过滤条件有误

3. **前端缓存问题**
   - 删除后页面未刷新
   - 状态管理缓存未清除

4. **时序问题**
   - 删除操作尚未提交到数据库
   - 事务回滚

## 建议方案

### 方案1：验证数据库外键约束（推荐）

在数据库中执行以下SQL验证外键是否存在：

```sql
-- 检查 test_case_executions 外键
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE
FROM 
    information_schema.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'test_case_executions'
    AND REFERENCED_TABLE_NAME = 'test_cases';

-- 检查 test_run_results 外键
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE
FROM 
    information_schema.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'test_run_results'
    AND REFERENCED_TABLE_NAME = 'test_cases';
```

### 方案2：手动级联删除（如果外键约束失效）

如果外键约束未生效，可以在代码中手动实现级联删除：

```typescript
public async deleteTestCase(id: number): Promise<boolean> {
  try {
    // 开启事务
    await this.prisma.$transaction(async (tx) => {
      // 1. 删除相关的执行记录
      await tx.test_case_executions.deleteMany({
        where: { test_case_id: id }
      });
      
      // 2. 删除相关的运行结果
      await tx.test_run_results.deleteMany({
        where: { case_id: id }
      });
      
      // 3. 删除测试用例本身
      await tx.test_cases.delete({
        where: { id }
      });
    });
    
    console.log(`✅ 测试用例 ${id} 及相关执行记录已删除`);
    return true;
  } catch (error) {
    console.error(`删除测试用例 ${id} 失败:`, error);
    return false;
  }
}
```

### 方案3：软删除（最安全的方案）

实现软删除机制，保留历史执行记录用于数据分析：

1. 在 test_cases 表添加 `deleted_at` 字段
2. 修改删除逻辑为更新 `deleted_at` 时间戳
3. 查询时过滤已删除的记录

这样可以：
- ✅ 保留历史执行数据用于分析
- ✅ 避免级联删除问题
- ✅ 支持数据恢复

## 推荐执行步骤

1. **立即验证**：执行方案1的SQL检查外键约束是否存在
2. **根据结果选择**：
   - 如果外键存在且 DELETE_RULE 为 CASCADE → 问题可能是前端缓存或查询过滤
   - 如果外键不存在或 DELETE_RULE 不是 CASCADE → 使用方案2手动级联删除
3. **长期优化**：考虑实施方案3的软删除机制

## 风险评估

### 不删除执行记录的影响：
- ⚠️ 数据库存储空间浪费
- ⚠️ 孤立数据（orphaned records）影响数据完整性
- ⚠️ 可能导致查询性能下降
- ℹ️ 但历史执行记录仍有分析价值

### 级联删除的影响：
- ⚠️ 丢失历史执行数据，无法追溯
- ⚠️ 影响统计分析和报表
- ✅ 保持数据一致性
- ✅ 减少存储空间

**建议：采用软删除方案（方案3），平衡数据完整性和历史追溯需求。**

---

---

## ✅ 已实施：软删除方案

### 实施时间：2024-12-24

### 修改内容

#### 1. 数据库Schema修改

**文件：** `prisma/schema.prisma`

在 `test_cases` 表添加软删除字段：

```prisma
model test_cases {
  id                   Int                    @id @default(autoincrement())
  title                String                 @db.VarChar(255)
  steps                Json?
  tags                 Json?
  system               String?                @db.VarChar(100)
  module               String?                @db.VarChar(100)
  project              String?                @db.VarChar(100)
  created_at           DateTime?              @default(now()) @db.Timestamp(0)
  updated_at           DateTime?              @updatedAt @db.Timestamp(0)
  deleted_at           DateTime?              @db.Timestamp(0)  // 🆕 软删除字段
  // ... 其他关系字段
  
  @@index([deleted_at])  // 🆕 添加索引优化查询性能
}
```

**迁移文件：** `prisma/migrations/add_soft_delete_to_test_cases.sql`

#### 2. 后端服务修改

**文件：** `server/services/testExecution.ts`

##### 2.1 修改删除方法（软删除）

```typescript
public async deleteTestCase(id: number): Promise<boolean> {
  try {
    // 🔥 软删除：只更新deleted_at字段，不真正删除数据
    await this.prisma.test_cases.update({ 
      where: { id },
      data: { deleted_at: new Date() }
    });
    console.log(`✅ 测试用例 ${id} 已软删除（保留执行记录用于数据分析）`);
    return true;
  } catch (error) {
    console.error(`删除测试用例 ${id} 失败:`, error);
    return false;
  }
}
```

##### 2.2 修改查询方法（过滤已删除）

**findTestCaseById：**
```typescript
public async findTestCaseById(id: number): Promise<TestCase | null> {
  const testCase = await this.prisma.test_cases.findUnique({ 
    where: { id },
    select: {
      // ... 字段
      deleted_at: true
    }
  });
  // 🔥 软删除：如果已删除，返回null
  if (testCase && testCase.deleted_at) {
    return null;
  }
  return testCase ? this.dbTestCaseToApp(testCase) : null;
}
```

**getTestCases：**
```typescript
public async getTestCases(): Promise<TestCase[]> {
  const testCases = await this.prisma.test_cases.findMany({
    where: {
      deleted_at: null // 🔥 软删除：只查询未删除的记录
    },
    // ... select字段
  });
  return testCases.map(this.dbTestCaseToApp);
}
```

**getTestCasesPaginated：**
```typescript
public async getTestCasesPaginated(params: {...}): Promise<{...}> {
  const whereForCount: any = {
    deleted_at: null // 🔥 软删除：只查询未删除的记录
  };
  
  const where: any = {
    deleted_at: null // 🔥 软删除：只查询未删除的记录
  };
  // ... 其他查询逻辑
}
```

#### 3. 前端修改

**文件：** `src/pages/TestCases.tsx`

##### 3.1 单个删除提示优化

```typescript
const handleDeleteTestCase = (testCase: TestCase) => {
  AntModal.confirm({
    title: '确认删除',
    content: (
      <div className="space-y-2">
        <p>
          您确定要删除测试用例 "
          <span className="font-medium">{testCase.name}</span>" 吗？
        </p>
        <p className="text-xs text-gray-500">
          注意：测试用例的历史执行记录将被保留，用于数据分析和统计。
        </p>
      </div>
    ),
    // ...
    onOk: async () => {
      try {
        setLoading(true);
        await testService.deleteTestCase(testCase.id);
        // 🔥 软删除：后端只标记deleted_at，重新加载时会自动过滤掉已删除的记录
        await loadTestCases();
        showToast.success('测试用例删除成功！');
      } catch (error: any) {
        // ... 错误处理
      }
    },
  });
};
```

##### 3.2 批量删除提示优化

```typescript
const handleBatchDelete = () => {
  AntModal.confirm({
    title: '批量删除确认',
    content: (
      <div className="space-y-2">
        <p>
          您确定要删除选中的 <span className="font-medium text-red-600">{selectedTestCaseIds.length}</span> 个测试用例吗？
        </p>
        <p className="text-xs text-gray-500">
          注意：测试用例的历史执行记录将被保留，用于数据分析和统计。
        </p>
      </div>
    ),
    // ... 删除逻辑
    onOk: async () => {
      // ... 删除操作
      // 🔥 软删除：重新加载时会自动过滤掉已删除的记录，清空选择
      await loadTestCases();
      setSelectedTestCaseIds([]);
    }
  });
};
```

### 实现效果

#### ✅ 数据库层面
- 测试用例标记为已删除（`deleted_at` 字段有值）
- 相关的执行记录（`test_case_executions` 和 `test_run_results`）**完整保留**
- 支持数据分析和历史追溯

#### ✅ 后端API层面
- 所有查询接口自动过滤已删除的测试用例
- 删除操作改为更新 `deleted_at` 字段
- 已删除的测试用例无法通过ID查询

#### ✅ 前端UI层面
- 删除后自动从列表中移除（通过重新加载实现）
- **内存中的数据会被移除**，用户体验等同于真删除
- 提示用户历史执行记录会被保留

### 回答用户问题

**问题：内存中是否需要删除？**

**答案：是的，需要从前端显示列表中移除。**

**实现方式：**
1. 后端软删除后，查询接口会过滤掉已删除的记录
2. 前端调用 `loadTestCases()` 重新加载数据
3. 由于后端已过滤，前端获取的数据中不包含已删除的记录
4. 用户看到的效果：**记录从列表中消失**，等同于真删除
5. 实际数据库：**记录仍存在**，只是标记了 `deleted_at`

**优势：**
- ✅ 用户体验：看起来像真删除，界面清爽
- ✅ 数据安全：历史数据保留，可用于分析
- ✅ 审计追溯：可以查看删除历史
- ✅ 执行记录：完整保留，不影响统计

### 部署步骤

1. **✅ 执行数据库同步（已完成）：**
   ```bash
   # 已成功执行
   npx prisma db push
   
   # 执行结果：
   # ✔ Your database is now in sync with your Prisma schema. Done in 151ms
   # ✔ Generated Prisma Client
   ```
   
   **说明：** 由于数据库与迁移历史不同步，使用 `prisma db push` 直接同步 schema，避免数据丢失。

2. **重启后端服务：**
   ```bash
   # 重启Node.js服务以加载新代码
   npm run dev  # 开发环境
   # 或
   pm2 restart server  # 生产环境
   ```

3. **验证功能：**
   
   详细验证步骤请参考 `验证软删除功能.md` 文件。
   
   快速验证：
   - 删除一个测试用例
   - 确认界面上记录消失
   - 确认删除提示中说明会保留执行记录
   - 检查数据库 `deleted_at` 字段有值
   - 确认执行记录仍然存在

---

**分析时间：** 2024-12-24  
**实施时间：** 2024-12-24  
**修改文件：**
- ✅ prisma/schema.prisma (添加deleted_at字段)
- ✅ prisma/migrations/add_soft_delete_to_test_cases.sql (新建迁移文件)
- ✅ server/services/testExecution.ts (修改删除和查询逻辑)
- ✅ src/pages/TestCases.tsx (优化删除提示)

**原始分析文件：**
- src/components/TestCaseTable.tsx (L686-692)
- src/pages/TestCases.tsx (L976-1007)
- server/services/testExecution.ts (L777-785)
- prisma/schema.prisma (L150-182, L322-355)
- prisma/migrations/20251119171318_sync_schema_with_prisma/migration.sql (L621, L664)

