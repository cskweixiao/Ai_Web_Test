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
      // 🔥 增强日志：打印完整的剩余步骤
      console.log(`\n🔍 [${runId}] ===== AI解析步骤开始 =====`);
      console.log(`📋 [${runId}] 剩余步骤文本:\n${remainingStepsText}`);

      if (!remainingStepsText?.trim()) {
        console.log(`❌ [${runId}] 没有剩余步骤，解析结束`);
        return { success: false, error: "没有剩余步骤" };
      }

      const lines = remainingStepsText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        console.log(`❌ [${runId}] 没有有效步骤，解析结束`);
        return { success: false, error: "没有有效步骤" };
      }

      // 🔥 增强日志：打印所有拆分的步骤
      console.log(`📊 [${runId}] 拆分后的步骤数量: ${lines.length}`);
      lines.forEach((line, index) => {
        console.log(`   ${index + 1}. "${line}"`);
      });

      const nextStepText = lines[0].trim();
      const remaining = lines.slice(1).join('\n');

      console.log(`🎯 [${runId}] 当前解析步骤: "${nextStepText}"`);
      console.log(`📊 [${runId}] 剩余步骤数: ${lines.length - 1}`);

      // 🔥 增强日志：打印页面快照状态
      if (snapshot) {
        const snapshotLines = snapshot.split('\n');
        console.log(`📸 [${runId}] 页面快照状态: ${snapshotLines.length}行`);

        // 提取页面URL和标题
        const urlMatch = snapshot.match(/Page URL: ([^\n]+)/);
        const titleMatch = snapshot.match(/Page Title: ([^\n]+)/);

        if (urlMatch) console.log(`   🌐 URL: ${urlMatch[1]}`);
        if (titleMatch) console.log(`   📄 标题: ${titleMatch[1]}`);

        // 统计元素
        const elementTypes = ['textbox', 'button', 'link', 'input', 'checkbox', 'radio', 'combobox'];
        const foundTypes = elementTypes
          .map(type => {
            const count = (snapshot.match(new RegExp(type, 'g')) || []).length;
            return count > 0 ? `${type}(${count})` : null;
          })
          .filter(Boolean);

        if (foundTypes.length > 0) {
          console.log(`   🔍 页面元素: ${foundTypes.join(', ')}`);
        } else {
          console.log(`   ⚠️ 未在快照中发现常见交互元素`);
        }
      } else {
        console.log(`⚠️ [${runId}] 无页面快照可用，将使用默认解析策略`);
      }

      // AI模拟：基于当前步骤文本和快照生成MCP命令
      const mcpCommand = await this.generateMCPCommand(nextStepText, snapshot);

      // 🔥 增强日志：打印解析结果
      console.log(`🤖 [${runId}] AI解析结果:`);
      console.log(`   🎯 操作类型: ${mcpCommand.name}`);
      console.log(`   📋 参数: ${JSON.stringify(mcpCommand.arguments, null, 2)}`);

      const step: TestStep = {
        id: `step-${Date.now()}`,
        action: mcpCommand.name,
        description: nextStepText,
        ...mcpCommand.arguments
      };

      console.log(`✅ [${runId}] AI解析步骤完成: ${step.action} - ${step.description}`);
      console.log(`🔍 [${runId}] ===== AI解析步骤结束 =====\n`);

      return { success: true, step, remaining };
    } catch (error) {
      console.error(`❌ [${runId}] AI解析步骤失败: ${error}`);
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

    // 首先检查是否包含URL，这比关键词检测更可靠
    const urlMatch = stepDescription.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      // 如果找到URL，优先识别为导航操作，无论步骤描述中是否包含关键词
      const url = urlMatch[0];
      console.log(`🌐 检测到URL: ${url}`);
      return { name: 'navigate', arguments: { url } };
    }

    // 导航类指令 - 如果没有直接URL但有导航关键词
    if (desc.includes('打开') || desc.includes('访问') || desc.includes('导航到') ||
      desc.includes('进入') || desc.includes('打开网站') || desc.includes('进入网站')) {
      // 尝试从描述中提取可能的域名
      const domainMatch = desc.match(/([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9][-a-zA-Z0-9]*/);
      const url = domainMatch
        ? `https://${domainMatch[0]}`
        : 'https://k8s-saas-tmp.ycb51.cn';
      console.log(`🌐 从关键词提取域名: ${url}`);
      return { name: 'navigate', arguments: { url } };
    }

    // 点击类指令
    if (desc.includes('点击') || desc.includes('单击') || desc.includes('按下') || desc.includes('登入')) {
      const target = this.extractTargetFromDescription(desc);
      console.log(`🖱️ 提取点击目标: ${target}`);
      return { name: 'click', arguments: { selector: target } };
    }

    // 输入类指令
    if (desc.includes('输入') || desc.includes('填写') || desc.includes('键入')) {
      const { selector, value } = this.extractInputInfo(desc);
      console.log(`⌨️ 提取输入信息: 选择器=${selector}, 值=${value}`);
      return { name: 'fill', arguments: { selector, value } };
    }

    // 等待类指令
    if (desc.includes('等待') || desc.includes('暂停')) {
      const timeout = this.extractTimeout(desc);
      console.log(`⏱️ 提取等待时间: ${timeout}ms`);
      return { name: 'wait', arguments: { timeout } };
    }

    // 截图类指令
    if (desc.includes('截图') || desc.includes('拍照')) {
      console.log(`📸 识别为截图操作`);
      return { name: 'screenshot', arguments: {} };
    }

    // 默认等待
    console.log(`⚠️ 无法识别操作类型，使用默认等待`);
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