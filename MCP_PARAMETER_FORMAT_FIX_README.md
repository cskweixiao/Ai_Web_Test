# MCP 参数格式修复说明

## 问题描述

在 TestFlow 自动化测试平台中，发现 MCP (Model Context Protocol) 工具调用存在参数格式不一致的问题，导致浏览器操作（如输入文本、点击元素）无法正常执行。虽然 MCP 层面返回成功，但浏览器端没有实际动作。

## 根本原因

系统中存在两种不同的参数格式：

### 错误格式（导致操作失败）
```javascript
// 输入操作
browser_type { 
  selector: "input[name='username']", 
  value: "admin" 
}

// 点击操作
browser_click { 
  selector: "text=登录" 
}
```

### 正确格式（操作成功）
```javascript
// 输入操作
browser_type { 
  ref: "e18", 
  text: "admin" 
}

// 点击操作
browser_click { 
  ref: "e19" 
}
```

## 修复方案

### 1. 统一参数格式
- 所有 MCP 工具调用统一使用 `ref` 和 `text` 参数格式
- 在执行操作前先通过 `findBestElement` 获取元素引用
- 添加参数格式验证和错误处理机制

### 2. 修复范围
- **预解析分支**：`testExecution.ts` 中的预解析逻辑
- **动态解析分支**：运行时动态生成的 MCP 命令
- **统一辅助方法**：添加元素查找和参数转换方法

### 3. 新增功能
- `findElementAndBuildCommand()`: 统一的元素查找和命令构建
- `convertToMCPFormat()`: 参数格式转换
- `validateMCPParameters()`: 参数格式验证
- 增强的错误处理和日志记录

## 修复后的工具调用规范

| 操作类型 | 工具名称 | 参数格式 | 示例 |
|---------|---------|---------|------|
| 点击 | `browser_click` | `{ ref: string }` | `{ ref: "e18" }` |
| 输入 | `browser_type` | `{ ref: string, text: string }` | `{ ref: "e19", text: "admin" }` |
| 等待 | `browser_wait_for` | `{ timeout: number }` | `{ timeout: 5000 }` |
| 导航 | `browser_navigate` | `{ url: string }` | `{ url: "https://example.com" }` |

## 验证方法

### 1. 运行验证脚本
```bash
node verify-mcp-parameter-fix.js
```

### 2. 运行单元测试
```bash
npm test server/services/__tests__/mcpParameterFormat.test.ts
```

### 3. 检查日志输出
正确的日志应该显示：
```
🔧 [runId] MCP工具调用: browser_type { "ref": "e18", "text": "admin" }
✅ [runId] MCP工具调用成功: browser_type
```

## 文件修改清单

### 主要修改文件
- `server/services/testExecution.ts`: 修复参数格式问题
- `server/utils/mcpToolMapper.js`: 工具名称映射（已存在）

### 新增文件
- `server/services/__tests__/mcpParameterFormat.test.ts`: 单元测试
- `verify-mcp-parameter-fix.js`: 验证脚本
- `jest.config.js`: Jest 配置
- `jest.setup.js`: Jest 设置

### 更新文档
- `.kiro/specs/testflow-execution-flowchart/mcp-execution-flow.md`: 流程文档
- `MCP_PARAMETER_FORMAT_FIX_README.md`: 本说明文档

## 错误处理改进

### 1. 详细错误日志
```javascript
console.error(`❌ [${runId}] 预解析分支执行失败:`);
console.error(`   🔍 选择器: ${step.selector}`);
console.error(`   🎯 操作类型: ${step.action}`);
console.error(`   📄 输入值: ${step.value || 'N/A'}`);
console.error(`   💥 错误详情: ${elementError.message}`);
```

### 2. 参数格式验证
```javascript
if (!this.validateMCPParameters(mcpCommand.name, mcpCommand.arguments)) {
  throw new Error(`参数格式验证失败: ${JSON.stringify(mcpCommand.arguments)}`);
}
```

### 3. 元素查找失败处理
- 记录详细的选择器信息
- 提供清晰的错误消息
- 实施回退机制

## 测试覆盖

### 单元测试覆盖范围
- 参数格式转换功能
- 元素查找功能
- 参数验证功能
- 错误处理逻辑
- MCPToolMapper 集成

### 集成测试
- 端到端 MCP 调用测试
- 浏览器操作验证
- 日志输出格式检查

## 性能影响

### 优化措施
- 元素查找结果缓存
- 参数格式验证优化
- 错误处理快速失败

### 监控指标
- MCP 调用成功率
- 元素查找成功率
- 参数格式转换耗时
- 错误恢复成功率

## 向后兼容性

- 保持 `mcpClient.ts` 中现有的正确实现不变
- 确保所有现有 API 接口保持兼容
- 添加渐进式的错误处理和回退机制

## 故障排除

### 常见问题

1. **仍然看到错误格式的 MCP 调用**
   - 检查是否所有分支都已修复
   - 验证 `findElementAndBuildCommand` 方法是否被正确调用

2. **元素查找失败**
   - 检查页面快照是否正确获取
   - 验证选择器是否准确
   - 查看 AI 匹配逻辑是否正常工作

3. **参数验证失败**
   - 检查参数格式是否符合规范
   - 验证必需参数是否存在
   - 查看参数值是否有效

### 调试步骤

1. 启用详细日志记录
2. 检查 MCP 工具调用日志
3. 验证元素查找过程
4. 分析参数格式转换
5. 查看错误处理流程

## 总结

通过这次修复，我们解决了 MCP 参数格式不一致的问题，统一了所有工具调用的参数格式，并增强了错误处理和日志记录功能。这将显著提高测试执行的成功率和系统的可维护性。