# MCP 参数格式修复需求文档

## 介绍

当前系统中存在 MCP 工具调用参数格式不一致的问题，导致浏览器操作（如输入文本、点击元素）无法正常执行。虽然 MCP 层面返回成功，但浏览器端没有实际动作，这是因为参数字段名称和格式不符合 MCP 工具的约定。

## 需求

### 需求 1：统一 MCP 工具参数格式

**用户故事：** 作为测试执行引擎，我希望所有 MCP 工具调用都使用正确的参数格式，以确保浏览器操作能够正常执行。

#### 验收标准

1. WHEN 执行填充操作 THEN 系统应使用 `{ ref: elementRef, text: inputValue }` 参数格式调用 `browser_type` 工具
2. WHEN 执行点击操作 THEN 系统应使用 `{ ref: elementRef }` 参数格式调用 `browser_click` 工具
3. WHEN 系统需要定位元素 THEN 系统应先调用 `findBestElement` 方法获取元素的 `ref` 引用
4. WHEN 使用预解析分支执行操作 THEN 系统应使用与 `executeMcpStep` 方法相同的参数格式

### 需求 2：修复预解析分支参数格式

**用户故事：** 作为测试执行引擎，我希望预解析分支使用正确的参数格式，以确保与动态解析分支的一致性。

#### 验收标准

1. WHEN 步骤已包含预解析的 action 和参数 THEN 系统应先通过 `findBestElement` 获取元素引用
2. WHEN 构建 MCP 命令参数 THEN 系统应使用 `ref` 和 `text` 字段而不是 `selector` 和 `value` 字段
3. WHEN 执行点击操作 THEN 系统应使用 `{ ref: elementRef }` 参数
4. WHEN 执行输入操作 THEN 系统应使用 `{ ref: elementRef, text: inputValue }` 参数

### 需求 3：修复动态解析分支参数格式

**用户故事：** 作为测试执行引擎，我希望动态解析分支使用正确的参数格式，以确保浏览器操作的成功执行。

#### 验收标准

1. WHEN 动态解析输入操作 THEN 系统应先通过 `findBestElement` 获取元素引用
2. WHEN 构建输入操作的 MCP 命令 THEN 系统应使用 `{ ref: elementRef, text: inputValue }` 参数
3. WHEN 动态解析点击操作 THEN 系统应使用 `{ ref: elementRef }` 参数
4. WHEN 无法找到匹配元素 THEN 系统应返回明确的错误信息

### 需求 4：保持向后兼容性

**用户故事：** 作为系统维护者，我希望修复不会破坏现有的正常工作流程，特别是 `mcpClient.ts` 中已经正确工作的部分。

#### 验收标准

1. WHEN 修复参数格式 THEN `mcpClient.ts` 中的 `executeMcpStep` 方法应保持不变
2. WHEN 修复完成 THEN 所有现有的测试用例应继续正常工作
3. WHEN 系统运行 THEN 应能看到正确的 MCP 工具调用日志格式
4. WHEN 出现错误 THEN 系统应提供清晰的错误信息和回退机制

### 需求 5：增强错误处理和日志记录

**用户故事：** 作为开发者，我希望能够通过日志清楚地看到 MCP 工具调用的参数格式，以便于调试和验证修复效果。

#### 验收标准

1. WHEN 调用 MCP 工具 THEN 系统应记录完整的工具名称和参数信息
2. WHEN 元素查找失败 THEN 系统应记录详细的错误信息和尝试的选择器
3. WHEN 参数格式转换 THEN 系统应记录转换前后的参数对比
4. WHEN 操作成功 THEN 系统应记录成功的操作类型和目标元素信息