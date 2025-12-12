# 数据库迁移说明 - functional_test_executions 表

## 📋 问题描述

执行测试用例提交结果时报错：
```
The table `functional_test_executions` does not exist in the current database.
```

## 🔧 解决方案

需要在数据库中创建 `functional_test_executions` 表。

## 📝 迁移步骤

### 方法一：使用 Prisma Migrate（推荐）

```bash
# 1. 进入项目根目录
cd D:\King\Cursor\sakura-ai\test_flow

# 2. 执行数据库迁移
npx prisma migrate deploy

# 3. 验证迁移是否成功
npx prisma db pull
```

### 方法二：使用 Prisma DB Push（开发环境快速同步）

```bash
# 1. 进入项目根目录
cd D:\King\Cursor\sakura-ai\test_flow

# 2. 推送 schema 到数据库
npx prisma db push

# 3. 验证是否成功
npx prisma db pull
```

### 方法三：手动执行 SQL（如果上述方法失败）

1. 连接到 PostgreSQL 数据库
2. 执行以下 SQL：

```sql
-- 创建枚举类型（如果不存在）
DO $$ BEGIN
    CREATE TYPE "functional_execution_result" AS ENUM ('pass', 'fail', 'block');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建表
CREATE TABLE IF NOT EXISTS "functional_test_executions" (
    "id" VARCHAR(100) NOT NULL,
    "test_case_id" INTEGER NOT NULL,
    "test_case_name" VARCHAR(255) NOT NULL,
    "final_result" "functional_execution_result" NOT NULL,
    "actual_result" TEXT NOT NULL,
    "comments" TEXT,
    "duration_ms" INTEGER,
    "executed_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executor_id" INTEGER NOT NULL,
    "executor_department" VARCHAR(100),
    "step_results" JSON,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "completed_steps" INTEGER NOT NULL DEFAULT 0,
    "passed_steps" INTEGER NOT NULL DEFAULT 0,
    "failed_steps" INTEGER NOT NULL DEFAULT 0,
    "blocked_steps" INTEGER NOT NULL DEFAULT 0,
    "screenshots" JSON,
    "attachments" JSON,
    "metadata" JSON,
    CONSTRAINT "functional_test_executions_pkey" PRIMARY KEY ("id")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "functional_test_executions_test_case_id_idx" ON "functional_test_executions"("test_case_id");
CREATE INDEX IF NOT EXISTS "functional_test_executions_executor_id_idx" ON "functional_test_executions"("executor_id");
CREATE INDEX IF NOT EXISTS "functional_test_executions_executed_at_idx" ON "functional_test_executions"("executed_at");
CREATE INDEX IF NOT EXISTS "functional_test_executions_final_result_idx" ON "functional_test_executions"("final_result");
CREATE INDEX IF NOT EXISTS "functional_test_executions_executor_department_idx" ON "functional_test_executions"("executor_department");

-- 添加外键约束
ALTER TABLE "functional_test_executions" 
ADD CONSTRAINT "functional_test_executions_test_case_id_fkey" 
FOREIGN KEY ("test_case_id") REFERENCES "functional_test_cases"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "functional_test_executions" 
ADD CONSTRAINT "functional_test_executions_executor_id_fkey" 
FOREIGN KEY ("executor_id") REFERENCES "users"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;
```

## ✅ 验证迁移

执行以下 SQL 验证表是否创建成功：

```sql
-- 查看表结构
\d functional_test_executions

-- 或者
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'functional_test_executions';

-- 查看枚举类型
SELECT enum_range(NULL::functional_execution_result);
```

## 🔄 迁移后测试

1. 重启后端服务器
2. 打开测试用例执行页面
3. 填写测试结果并提交
4. 验证数据是否成功保存到数据库

```sql
-- 查询执行记录
SELECT * FROM functional_test_executions ORDER BY executed_at DESC LIMIT 5;
```

## 📊 表结构说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | VARCHAR(100) | UUID主键 |
| test_case_id | INTEGER | 测试用例ID（外键） |
| test_case_name | VARCHAR(255) | 测试用例名称 |
| final_result | ENUM | 最终结果（pass/fail/block） |
| actual_result | TEXT | 实际结果总结 |
| comments | TEXT | 备注说明 |
| duration_ms | INTEGER | 执行时长（毫秒） |
| executed_at | TIMESTAMP | 执行时间 |
| executor_id | INTEGER | 执行人ID（外键） |
| executor_department | VARCHAR(100) | 执行人部门 |
| step_results | JSON | 步骤执行详情 |
| total_steps | INTEGER | 总步骤数 |
| completed_steps | INTEGER | 完成步骤数 |
| passed_steps | INTEGER | 通过步骤数 |
| failed_steps | INTEGER | 失败步骤数 |
| blocked_steps | INTEGER | 阻塞步骤数 |
| screenshots | JSON | 截图附件 |
| attachments | JSON | 其他附件 |
| metadata | JSON | 元数据 |

## 🔗 相关表

- **functional_test_cases**: 功能测试用例表（主表）
- **users**: 用户表（执行人信息）

## ⚠️ 注意事项

1. 执行迁移前请备份数据库
2. 确保 `functional_test_cases` 和 `users` 表已存在
3. 确保数据库用户有创建表和索引的权限
4. PostgreSQL 数据库需要支持 JSON 类型

## 🐛 常见问题

### Q1: 枚举类型已存在错误

**错误信息**：`type "functional_execution_result" already exists`

**解决方案**：
```sql
-- 删除已存在的枚举类型（如果没有被使用）
DROP TYPE IF EXISTS functional_execution_result CASCADE;

-- 然后重新创建
CREATE TYPE "functional_execution_result" AS ENUM ('pass', 'fail', 'block');
```

### Q2: 外键约束失败

**错误信息**：`violates foreign key constraint`

**解决方案**：
- 确保 `functional_test_cases` 表存在
- 确保 `users` 表存在
- 检查引用的字段类型是否匹配

### Q3: 权限不足

**错误信息**：`permission denied`

**解决方案**：
```sql
-- 使用超级用户执行，或授予权限
GRANT ALL PRIVILEGES ON DATABASE your_database TO your_user;
```

## 📞 需要帮助？

如果遇到问题，请提供：
1. 错误信息截图
2. 数据库版本：`SELECT version();`
3. 现有表列表：`\dt`

