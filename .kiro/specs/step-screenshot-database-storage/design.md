# 步骤截图数据库存储功能设计文档

## 概述

本设计文档描述了如何实现测试步骤截图的数据库存储功能。系统将在每个测试步骤执行后自动截图，并将截图信息存储到数据库中，同时保持与现有测试执行流程的兼容性。

## 架构

### 整体架构
```
TestExecutionService
    ↓
ScreenshotService (新增)
    ↓
Database (step_screenshots表) + File System
```

### 数据流
1. 测试步骤执行完成 → 触发截图
2. MCP客户端生成截图文件 → 返回文件路径
3. ScreenshotService处理截图信息 → 存储到数据库
4. 更新测试运行状态 → 包含截图引用

## 组件和接口

### 1. 数据库模型

#### 新增表：step_screenshots
```sql
CREATE TABLE step_screenshots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  run_id VARCHAR(255) NOT NULL,           -- 测试运行ID (UUID)
  test_case_id INT,                       -- 关联的测试用例ID
  step_index INT NOT NULL,                -- 步骤索引 (1, 2, 3, 'final')
  step_description TEXT,                  -- 步骤描述
  status ENUM('success', 'failed', 'error', 'completed') NOT NULL,
  file_path VARCHAR(1024) NOT NULL,       -- 截图文件路径
  file_name VARCHAR(255) NOT NULL,        -- 截图文件名
  file_size BIGINT,                       -- 文件大小(字节)
  mime_type VARCHAR(100) DEFAULT 'image/png',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_exists BOOLEAN DEFAULT TRUE,       -- 文件是否存在
  
  INDEX idx_run_id (run_id),
  INDEX idx_test_case_id (test_case_id),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
);
```

#### Prisma Schema 更新
```prisma
model step_screenshots {
  id               Int                           @id @default(autoincrement())
  run_id           String                        @db.VarChar(255)
  test_case_id     Int?
  step_index       String                        @db.VarChar(50)  // 支持 '1', '2', 'final' 等
  step_description String?                       @db.Text
  status           step_screenshots_status
  file_path        String                        @db.VarChar(1024)
  file_name        String                        @db.VarChar(255)
  file_size        BigInt?
  mime_type        String?                       @default("image/png") @db.VarChar(100)
  created_at       DateTime?                     @default(now()) @db.Timestamp(0)
  file_exists      Boolean                       @default(true)
  test_cases       test_cases?                   @relation(fields: [test_case_id], references: [id], onDelete: SetNull)

  @@index([run_id], map: "idx_run_id")
  @@index([test_case_id], map: "idx_test_case_id") 
  @@index([created_at], map: "idx_created_at")
}

enum step_screenshots_status {
  success
  failed
  error
  completed
}
```

### 2. ScreenshotService 服务类

```typescript
export interface ScreenshotRecord {
  id?: number;
  runId: string;
  testCaseId?: number;
  stepIndex: string | number;
  stepDescription?: string;
  status: 'success' | 'failed' | 'error' | 'completed';
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  createdAt?: Date;
  fileExists?: boolean;
}

export class ScreenshotService {
  // 保存截图记录到数据库
  async saveScreenshot(record: ScreenshotRecord): Promise<ScreenshotRecord>
  
  // 获取测试运行的所有截图
  async getScreenshotsByRunId(runId: string): Promise<ScreenshotRecord[]>
  
  // 获取特定步骤的截图
  async getStepScreenshot(runId: string, stepIndex: string | number): Promise<ScreenshotRecord | null>
  
  // 检查截图文件是否存在
  async verifyScreenshotFile(screenshotId: number): Promise<boolean>
  
  // 清理过期截图
  async cleanupExpiredScreenshots(daysToKeep: number): Promise<number>
  
  // 获取存储统计信息
  async getStorageStats(): Promise<StorageStats>
}
```

### 3. 增强的 TestExecutionService

修改现有的 `takeStepScreenshot` 方法：

```typescript
private async takeStepScreenshot(
  runId: string, 
  stepIndex: number | string, 
  status: 'success' | 'failed' | 'error' | 'completed', 
  description: string
): Promise<void> {
  try {
    // 1. 生成截图文件名
    const timestamp = Date.now();
    const sanitizedDescription = description.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
    const filename = `${runId}-step-${stepIndex}-${status}-${timestamp}.png`;
    
    // 2. 调用MCP客户端截图
    await this.mcpClient.takeScreenshot(filename);
    
    // 3. 获取文件信息
    const filePath = path.join('screenshots', filename);
    const fullPath = path.join(process.cwd(), filePath);
    
    let fileSize = 0;
    try {
      const stats = await fs.promises.stat(fullPath);
      fileSize = stats.size;
    } catch (error) {
      console.warn(`无法获取截图文件大小: ${error}`);
    }
    
    // 4. 保存到数据库
    const testRun = testRunStore.get(runId);
    const screenshotRecord: ScreenshotRecord = {
      runId,
      testCaseId: testRun?.testCaseId,
      stepIndex: stepIndex.toString(),
      stepDescription: description,
      status,
      filePath,
      fileName: filename,
      fileSize,
      mimeType: 'image/png'
    };
    
    await this.screenshotService.saveScreenshot(screenshotRecord);
    
    console.log(`✅ [${runId}] 截图已保存到数据库: ${filename}`);
    this.addLog(runId, `✅ 截图已保存: ${filename}`, 'success');
    
  } catch (error: any) {
    console.error(`❌ [${runId}] 截图保存失败: ${error.message}`);
    this.addLog(runId, `❌ 截图保存失败: ${error.message}`, 'warning');
  }
}
```

### 4. API 接口扩展

```typescript
// 获取测试运行的截图列表
GET /api/test-runs/:runId/screenshots
Response: ScreenshotRecord[]

// 获取特定步骤截图
GET /api/test-runs/:runId/screenshots/:stepIndex
Response: ScreenshotRecord

// 下载截图文件
GET /api/screenshots/:filename
Response: File (image/png)

// 截图管理接口
DELETE /api/screenshots/cleanup?days=30
Response: { deletedCount: number }

GET /api/screenshots/stats
Response: StorageStats
```

## 数据模型

### ScreenshotRecord
- **id**: 主键，自增ID
- **runId**: 测试运行UUID，关联测试执行
- **testCaseId**: 测试用例ID，可为空
- **stepIndex**: 步骤索引，支持数字和字符串（如'final'）
- **stepDescription**: 步骤描述，便于理解截图内容
- **status**: 截图状态，表示步骤执行结果
- **filePath**: 相对文件路径，用于Web访问
- **fileName**: 文件名，便于管理
- **fileSize**: 文件大小，用于存储统计
- **mimeType**: MIME类型，默认image/png
- **createdAt**: 创建时间
- **fileExists**: 文件存在标志，用于检测文件丢失

### StorageStats
```typescript
interface StorageStats {
  totalScreenshots: number;
  totalSize: number;
  avgFileSize: number;
  oldestScreenshot: Date;
  newestScreenshot: Date;
  missingFiles: number;
}
```

## 错误处理

### 1. 截图失败处理
- 截图操作失败时记录错误日志
- 不中断测试执行流程
- 在数据库中记录失败状态

### 2. 文件系统错误
- 磁盘空间不足时记录警告
- 文件权限问题时尝试修复
- 文件丢失时更新数据库状态

### 3. 数据库错误
- 数据库连接失败时使用本地缓存
- 约束违反时记录详细错误信息
- 事务失败时进行回滚

## 测试策略

### 1. 单元测试
- ScreenshotService 的所有方法
- 文件操作的边界情况
- 数据库操作的异常处理

### 2. 集成测试
- 完整的截图保存流程
- API接口的正确性
- 文件清理功能

### 3. 性能测试
- 大量截图的存储性能
- 数据库查询效率
- 文件系统I/O性能

## 部署考虑

### 1. 数据库迁移
- 创建新表的迁移脚本
- 索引优化
- 数据类型兼容性

### 2. 文件存储
- 确保screenshots目录存在
- 设置适当的文件权限
- 考虑CDN或对象存储集成

### 3. 配置管理
- 截图保留天数配置
- 存储路径配置
- 文件大小限制配置