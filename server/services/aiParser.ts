import { PlaywrightMcpClient } from './mcpClient.js';

export interface AIParseResult {
  success: boolean;
  steps: TestStep[];
  error?: string;
}

export interface AINextStepParseResult {
  success: boolean;
  step?: TestStep;
  remaining?: string;
  error?: string;
}

export interface TestStep {
  id: string;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  url?: string;
  condition?: string;
  text?: string;
  timeout?: number;
}

export interface MCPCommand {
  name: string;
  arguments: Record<string, any>;
}

export class AITestParser {
  private mcpClient: PlaywrightMcpClient;

  constructor(mcpClient: PlaywrightMcpClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * 基于MCP快照和用例描述，AI解析为可执行的步骤
   */
  async parseTestDescription(description: string, testName: string, runId: string, snapshot: any | null): Promise<AIParseResult> {
    try {
      // 将用例描述分割为步骤
      const steps = this.splitDescriptionToSteps(description);
      return { success: true, steps };
    } catch (error) {
      return { success: false, steps: [], error: `解析测试描述失败: ${error}` };
    }
  }

  /**
   * AI根据当前快照和下一条指令生成MCP命令
   */
  async parseNextStep(remainingStepsText: string, snapshot: any | null, runId: string): Promise<AINextStepParseResult> {
    try {
      if (!remainingStepsText?.trim()) {
        return { success: false, error: "没有剩余步骤" };
      }

      const lines = remainingStepsText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        return { success: false, error: "没有有效步骤" };
      }

      const nextStepText = lines[0].trim();
      const remaining = lines.slice(1).join('\n');

      // AI模拟：基于当前步骤文本和快照生成MCP命令
      const mcpCommand = await this.generateMCPCommand(nextStepText, snapshot);
      
      const step: TestStep = {
        id: `step-${Date.now()}`,
        action: mcpCommand.name,
        description: nextStepText,
        ...mcpCommand.arguments
      };

      return { success: true, step, remaining };
    } catch (error) {
      return { success: false, error: `解析下一步骤失败: ${error}` };
    }
  }

  /**
   * AI根据快照和断言描述生成断言命令
   */
  async parseAssertions(assertionsText: string, snapshot: any, runId: string): Promise<AIParseResult> {
    try {
      if (!assertionsText?.trim()) {
        return { success: true, steps: [] };
      }

      const assertionLines = assertionsText.split('\n').filter(line => line.trim());
      const steps: TestStep[] = [];

      for (let i = 0; i < assertionLines.length; i++) {
        const assertionText = assertionLines[i].trim();
        const mcpCommand = await this.generateAssertionCommand(assertionText, snapshot);
        
        steps.push({
          id: `assertion-${i + 1}`,
          action: mcpCommand.name,
          description: assertionText,
          ...mcpCommand.arguments
        });
      }

      return { success: true, steps };
    } catch (error) {
      return { success: false, steps: [], error: `解析断言失败: ${error}` };
    }
  }

  /**
   * 将用例描述分割为步骤
   */
  private splitDescriptionToSteps(description: string): TestStep[] {
    if (!description?.trim()) return [];
    
    const lines = description.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      action: 'pending', // 待AI解析
      description: line,
      order: index + 1
    }));
  }

  /**
   * AI模拟：根据步骤描述和快照生成MCP命令
   */
  private async generateMCPCommand(stepDescription: string, snapshot: any): Promise<MCPCommand> {
    const desc = stepDescription.toLowerCase();
    
    // 导航类指令
    if (desc.includes('打开') || desc.includes('访问') || desc.includes('导航到')) {
      const urlMatch = stepDescription.match(/https?:\/\/[^\s\u4e00-\u9fff]+/);
      const url = urlMatch ? urlMatch[0] : 'https://k8s-saas-tmp.ycb51.cn';
      return { name: 'navigate', arguments: { url } };
    }

    // 点击类指令
    if (desc.includes('点击') || desc.includes('单击') || desc.includes('按下')) {
      const target = this.extractTargetFromDescription(desc);
      return { name: 'click', arguments: { selector: target } };
    }

    // 输入类指令
    if (desc.includes('输入') || desc.includes('填写') || desc.includes('键入')) {
      const { selector, value } = this.extractInputInfo(desc);
      return { name: 'fill', arguments: { selector, value } };
    }

    // 等待类指令
    if (desc.includes('等待') || desc.includes('暂停')) {
      const timeout = this.extractTimeout(desc);
      return { name: 'wait', arguments: { timeout } };
    }

    // 截图类指令
    if (desc.includes('截图') || desc.includes('拍照')) {
      return { name: 'screenshot', arguments: {} };
    }

    // 默认等待
    return { name: 'wait', arguments: { timeout: 1000 } };
  }

  /**
   * AI模拟：根据断言描述和快照生成断言命令
   */
  private async generateAssertionCommand(assertionDescription: string, snapshot: any): Promise<MCPCommand> {
    const desc = assertionDescription.toLowerCase();

    // 页面可见性断言
    if (desc.includes('页面显示') || desc.includes('出现') || desc.includes('可见')) {
      const textMatch = desc.match(/['"]([^'"]+)['"]/);
      const expectedText = textMatch ? textMatch[1] : '';
      
      if (expectedText) {
        return { name: 'expect', arguments: { condition: 'contains_text', text: expectedText } };
      }
      
      return { name: 'expect', arguments: { condition: 'visible' } };
    }

    // 元素存在断言
    if (desc.includes('存在') || desc.includes('有')) {
      const selector = this.extractSelectorFromAssertion(desc);
      return { name: 'expect', arguments: { condition: 'element_exists', selector } };
    }

    // URL断言
    if (desc.includes('url') || desc.includes('地址')) {
      const urlMatch = desc.match(/https?:\/\/[^\s]+/);
      const expectedUrl = urlMatch ? urlMatch[0] : '';
      return { name: 'expect', arguments: { condition: 'url_changed', url: expectedUrl } };
    }

    // 默认可见性检查
    return { name: 'expect', arguments: { condition: 'visible' } };
  }

  private extractTargetFromDescription(description: string): string {
    if (description.includes('登录')) return 'text=登录';
    if (description.includes('按钮')) return 'button';
    if (description.includes('链接')) return 'a';
    if (description.includes('输入框')) return 'input';
    return 'body';
  }

  private extractInputInfo(description: string): { selector: string; value: string } {
    const valueMatch = description.match(/['"]([^'"]+)['"]/);
    const value = valueMatch ? valueMatch[1] : 'test';

    if (description.includes('用户名') || description.includes('账号')) {
      return { selector: 'input[name="username"]', value };
    }
    if (description.includes('密码')) {
      return { selector: 'input[type="password"]', value };
    }
    if (description.includes('邮箱')) {
      return { selector: 'input[type="email"]', value };
    }
    
    return { selector: 'input[type="text"]', value };
  }

  private extractTimeout(description: string): number {
    const match = description.match(/(\d+)秒/);
    return match ? parseInt(match[1]) * 1000 : 2000;
  }

  private extractSelectorFromAssertion(description: string): string {
    if (description.includes('按钮')) return 'button';
    if (description.includes('输入框')) return 'input';
    if (description.includes('文本')) return 'text';
    return 'body';
  }
}