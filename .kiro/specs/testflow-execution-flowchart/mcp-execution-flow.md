# MCP执行流程图

本文档详细描述Sakura AI自动化测试平台中MCP（Model Context Protocol）执行的完整流程，包括步骤解析、命令生成、执行和结果处理。

## MCP执行主流程

```mermaid
flowchart TB
    Start([开始执行步骤]) --> ParseStep[解析当前步骤]
    ParseStep --> GetSnapshot[获取页面快照]
    GetSnapshot --> AIAnalyze[AI分析步骤和快照]
    AIAnalyze --> GenerateCommand[生成MCP命令]
    GenerateCommand --> ValidateCommand{验证命令}
    ValidateCommand -- 有效 --> PreExecuteCheck[执行前检查]
    ValidateCommand -- 无效 --> HandleError[处理错误]
    
    PreExecuteCheck --> IsNavigate{是导航命令?}
    IsNavigate -- 是 --> SpecialNavigateHandling[特殊导航处理]
    IsNavigate -- 否 --> ExecuteCommand[执行MCP命令]
    
    SpecialNavigateHandling --> WaitForNavigation[等待导航完成]
    WaitForNavigation --> VerifyNavigation{验证导航}
    VerifyNavigation -- 成功 --> UpdateStatus[更新执行状态]
    VerifyNavigation -- 失败 --> RetryNavigation[重试导航]
    RetryNavigation --> ExecuteCommand
    
    ExecuteCommand --> CheckResult{检查结果}
    CheckResult -- 成功 --> VerifyExecution[验证执行结果]
    CheckResult -- 失败 --> RetryLogic{重试逻辑}
    
    VerifyExecution --> UpdateStatus
    RetryLogic -- 可重试 --> GetSnapshot
    RetryLogic -- 达到最大重试次数 --> FailStep[标记步骤失败]
    
    UpdateStatus --> End([结束步骤执行])
    HandleError --> FailStep
    FailStep --> End
```

## 步骤解析详细流程

```mermaid
flowchart TB
    Start([开始解析步骤]) --> ExtractStep[提取当前步骤文本]
    ExtractStep --> IdentifyType[识别步骤类型]
    
    IdentifyType --> IsNavigation{是导航操作?}
    IsNavigation -- 是 --> ExtractURL[提取URL]
    ExtractURL --> ValidateURL{URL有效?}
    ValidateURL -- 是 --> CreateNavigateCmd[创建navigate命令]
    ValidateURL -- 否 --> UseDefaultURL[使用默认URL]
    UseDefaultURL --> CreateNavigateCmd
    
    IsNavigation -- 否 --> IsClick{是点击操作?}
    IsClick -- 是 --> ExtractTarget[提取点击目标]
    ExtractTarget --> EnhanceSelector[增强选择器]
    EnhanceSelector --> CreateClickCmd[创建click命令]
    
    IsClick -- 否 --> IsInput{是输入操作?}
    IsInput -- 是 --> ExtractField[提取字段信息]
    ExtractField --> ExtractValue[提取输入值]
    ExtractValue --> EnhanceInputSelector[增强输入选择器]
    EnhanceInputSelector --> CreateFillCmd[创建fill命令]
    
    IsInput -- 否 --> IsWait{是等待操作?}
    IsWait -- 是 --> ExtractTimeout[提取等待时间]
    ExtractTimeout --> CreateWaitCmd[创建wait命令]
    
    IsWait -- 否 --> CreateDefaultCmd[创建默认命令]
    
    CreateNavigateCmd --> ReturnCommand[返回MCP命令]
    CreateClickCmd --> ReturnCommand
    CreateFillCmd --> ReturnCommand
    CreateWaitCmd --> ReturnCommand
    CreateDefaultCmd --> ReturnCommand
    
    ReturnCommand --> End([结束解析])
```

## URL提取逻辑改进

当前的URL提取逻辑存在问题，无法正确从步骤描述中提取完整URL。以下是改进的URL提取流程：

```mermaid
flowchart TB
    Start([开始URL提取]) --> CheckPattern{检查URL模式}
    CheckPattern -- 包含http --> ExtractFullURL[提取完整URL]
    CheckPattern -- 不包含http --> CheckDomain{检查域名模式}
    CheckDomain -- 包含域名 --> PrependHTTP[添加http://前缀]
    CheckDomain -- 不包含域名 --> UseDefault[使用默认URL]
    
    ExtractFullURL --> ValidateURL{验证URL格式}
    PrependHTTP --> ValidateURL
    UseDefault --> ValidateURL
    
    ValidateURL -- 有效 --> ReturnURL[返回有效URL]
    ValidateURL -- 无效 --> ReturnDefault[返回默认URL]
    
    ReturnURL --> End([结束URL提取])
    ReturnDefault --> End
```

## 选择器智能匹配流程

```mermaid
flowchart TB
    Start([开始选择器匹配]) --> AnalyzeSnapshot[分析页面快照]
    AnalyzeSnapshot --> ExtractElements[提取页面元素]
    ExtractElements --> MatchByText{按文本匹配?}
    MatchByText -- 匹配成功 --> CreateTextSelector[创建文本选择器]
    MatchByText -- 匹配失败 --> MatchByRole{按角色匹配?}
    MatchByRole -- 匹配成功 --> CreateRoleSelector[创建角色选择器]
    MatchByRole -- 匹配失败 --> MatchByType{按类型匹配?}
    MatchByType -- 匹配成功 --> CreateTypeSelector[创建类型选择器]
    MatchByType -- 匹配失败 --> CreateFallbackSelector[创建后备选择器]
    
    CreateTextSelector --> EnhanceSelector[增强选择器]
    CreateRoleSelector --> EnhanceSelector
    CreateTypeSelector --> EnhanceSelector
    CreateFallbackSelector --> EnhanceSelector
    
    EnhanceSelector --> ReturnSelector[返回最佳选择器]
    ReturnSelector --> End([结束选择器匹配])
```

## MCP命令执行流程

```mermaid
flowchart TB
    Start([开始执行MCP命令]) --> ValidateCommand{验证命令}
    ValidateCommand -- 有效 --> PrepareArgs[准备参数]
    ValidateCommand -- 无效 --> ReturnError[返回错误]
    
    PrepareArgs --> CallMCPTool[调用MCP工具]
    CallMCPTool --> WaitForResult[等待执行结果]
    WaitForResult --> CheckResult{检查结果}
    
    CheckResult -- 成功 --> GetSnapshot[获取更新后快照]
    CheckResult -- 失败 --> HandleError[处理错误]
    
    GetSnapshot --> UpdateState[更新状态]
    HandleError --> RetryLogic{可以重试?}
    RetryLogic -- 是 --> AdjustStrategy[调整策略]
    RetryLogic -- 否 --> FailExecution[执行失败]
    
    AdjustStrategy --> CallMCPTool
    UpdateState --> ReturnSuccess[返回成功]
    FailExecution --> ReturnError
    
    ReturnSuccess --> End([结束MCP执行])
    ReturnError --> End
```

## 错误处理和重试机制

```mermaid
flowchart TB
    Start([开始错误处理]) --> AnalyzeError[分析错误类型]
    AnalyzeError --> IsElementError{元素错误?}
    
    IsElementError -- 是 --> AdjustSelector[调整选择器]
    IsElementError -- 否 --> IsTimeoutError{超时错误?}
    
    IsTimeoutError -- 是 --> IncreaseTimeout[增加超时时间]
    IsTimeoutError -- 否 --> IsNavigationError{导航错误?}
    
    IsNavigationError -- 是 --> CheckURL[检查URL]
    IsNavigationError -- 否 --> IsGenericError{通用错误?}
    
    IsGenericError -- 是 --> WaitAndRetry[等待后重试]
    IsGenericError -- 否 --> CannotRecover[无法恢复]
    
    AdjustSelector --> RetryWithNewSelector[使用新选择器重试]
    IncreaseTimeout --> RetryWithNewTimeout[使用新超时重试]
    CheckURL --> RetryNavigation[重试导航]
    WaitAndRetry --> SimpleRetry[简单重试]
    CannotRecover --> FailWithError[失败并报告]
    
    RetryWithNewSelector --> End([结束错误处理])
    RetryWithNewTimeout --> End
    RetryNavigation --> End
    SimpleRetry --> End
    FailWithError --> End
```

## 关键改进点

1. **URL提取逻辑**：
   - 当前正则表达式 `/https?:\/\/[^\s\u4e00-\u9fff]+/` 无法正确处理中文URL或带路径的URL
   - 改进为 `/https?:\/\/[^\s]+/` 以捕获完整URL，包括路径部分

2. **步骤解析逻辑**：
   - 当前解析逻辑对于"1、进入网站https://..."格式的步骤无法正确识别为导航操作
   - 需要增强步骤类型识别，优先检查是否包含URL，而不仅依赖关键词

3. **选择器增强**：
   - 当前选择器过于简单，导致无法准确定位元素
   - 需要实现多层次选择器策略，包括文本、角色、类型和属性组合

4. **快照分析**：
   - 当前快照分析不充分，未能从快照中提取有用信息辅助选择器生成
   - 需要增强快照解析能力，提取页面结构和元素特征

5. **错误恢复**：
   - 当前错误处理机制简单，缺乏针对性恢复策略
   - 需要实现基于错误类型的智能恢复机制

## MCP 参数格式修复 (已完成)

6. **MCP 参数格式统一**：
   - **问题**：系统中存在两种不同的参数格式，导致浏览器操作失败
     - 错误格式：`browser_type { selector: "input[name='username']", value: "admin" }`
     - 正确格式：`browser_type { ref: "e18", text: "admin" }`
   - **解决方案**：
     - 统一所有 MCP 工具调用使用 `ref` 和 `text` 参数格式
     - 在执行操作前先通过 `findBestElement` 获取元素引用
     - 添加参数格式验证和错误处理机制
   - **修复范围**：
     - `testExecution.ts` 中的预解析分支和动态解析分支
     - 添加统一的元素查找和参数转换辅助方法
     - 增强错误处理和日志记录功能

7. **参数格式规范**：
   - **点击操作**：`browser_click { ref: "elementRef" }`
   - **输入操作**：`browser_type { ref: "elementRef", text: "inputValue" }`
   - **等待操作**：`browser_wait_for { timeout: milliseconds }`
   - **导航操作**：`browser_navigate { url: "targetUrl" }`

8. **验证和测试**：
   - 添加了完整的单元测试覆盖参数格式转换功能
   - 创建了专门的验证脚本 `verify-mcp-parameter-fix.js`
   - 实现了参数格式验证和错误恢复机制

这些流程图和改进点将帮助开发团队理解MCP执行过程中的关键环节，并针对性地解决当前存在的问题。