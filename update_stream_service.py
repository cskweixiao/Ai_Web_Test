# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("server/services/streamService.ts")
text = path.read_text(encoding="utf-8")

# Remove fs/path imports if present
text = text.replace("import * as fs from 'fs';\n", "")
text = text.replace("import * as path from 'path';\n", "")

# Ensure activeScreenshotTasks property exists
if "private activeScreenshotTasks" not in text:
    target = "  private mcpClients: Map<string, PlaywrightMcpClient>; // ?? MCP¿Í»§¶Ë»º´æ\n"
    text = text.replace(
        target,
        target + "  private activeScreenshotTasks: Set<string>;\n",
    )

if "this.activeScreenshotTasks = new Set();" not in text:
    text = text.replace(
        "    this.mcpClients = new Map();\n",
        "    this.mcpClients = new Map();\n    this.activeScreenshotTasks = new Set();\n",
    )

# Replace startStreamWithMcp implementation
start_signature = "  startStreamWithMcp(runId: string, mcpClient: PlaywrightMcpClient): void {"
start_index = text.find(start_signature)
if start_index == -1:
    raise SystemExit("startStreamWithMcp not found")

brace_depth = 0
end_index = None
for i in range(start_index, len(text)):
    ch = text[i]
    if ch == '{':
        brace_depth += 1
    elif ch == '}':
        brace_depth -= 1
        if brace_depth == 0:
            end_index = i
            break
if end_index is None:
    raise SystemExit("Unable to locate end of startStreamWithMcp")

new_start = """  startStreamWithMcp(runId: string, mcpClient: PlaywrightMcpClient): void {
    if (this.timers.has(runId)) {
      return;
    }

    const fps = this.config.fps > 0 ? this.config.fps : 1;
    const interval = Math.max(200, Math.floor(1000 / fps));
    this.mcpClients.set(runId, mcpClient);

    const timer = setInterval(async () => {
      if (this.activeScreenshotTasks.has(runId)) {
        return;
      }

      this.activeScreenshotTasks.add(runId);
      this.stats.totalAttempts += 1;

      try {
        const result = await mcpClient.takeScreenshotForStream({ runId });
        await this.pushFrameAndUpdateCache(runId, result.buffer);
        this.stats.successfulScreenshots += 1;
        this.updateAverageProcessingTime(result.durationMs ?? 0);
      } catch (error) {
        await this.handleStreamFailure(runId, error);
      } finally {
        this.activeScreenshotTasks.delete(runId);
      }
    }, interval);

    this.timers.set(runId, timer);
    console.log(`[StreamService] MCP stream started: ${runId}, interval=${interval}ms`);
  }
"""

text = text[:start_index] + new_start + text[end_index + 1:]

# Replace handleStreamFailure implementation
handle_signature = "  private async handleStreamFailure(runId: string, rawError: any): Promise<void> {"
start_index = text.find(handle_signature)
if start_index == -1:
    raise SystemExit("handleStreamFailure not found")
brace_depth = 0
end_index = None
for i in range(start_index, len(text)):
    ch = text[i]
    if ch == '{':
        brace_depth += 1
    elif ch == '}':
        brace_depth -= 1
        if brace_depth == 0:
            end_index = i
            break
if end_index is None:
    raise SystemExit("Unable to locate end of handleStreamFailure")

new_handle = """  private async handleStreamFailure(runId: string, rawError: unknown): Promise<void> {
    const message = rawError instanceof Error ? rawError.message : String(rawError ?? 'Unknown error');
    const shortId = runId.substring(0, 8);

    this.stats.fallbackFrames += 1;
    console.warn(`[StreamService] MCP screenshot failed (${shortId}): ${message}`);

    const cachedFrame = this.frameBuffer.get(runId);
    if (cachedFrame) {
      try {
        await this.pushFrameWithoutCache(runId, cachedFrame);
      } catch (pushError) {
        console.error(`[StreamService] failed to resend cached frame: ${runId}`, pushError);
      }
    } else {
      try {
        const placeholder = await this.createPlaceholderFrame();
        await this.pushFrameWithoutCache(runId, placeholder);
      } catch (placeholderError) {
        console.error(`[StreamService] failed to push placeholder frame: ${runId}`, placeholderError);
      }
    }

    const failureRate = this.stats.totalAttempts > 0
      ? (this.stats.fallbackFrames / this.stats.totalAttempts) * 100
      : 0;

    if (this.stats.totalAttempts > 20 && failureRate > 90) {
      console.error(`[StreamService] failure rate ${failureRate.toFixed(1)}%, pausing stream: ${runId}`);
      this.pauseStreamTemporarily(runId, 10000);
    }
  }
"""

text = text[:start_index] + new_handle + text[end_index + 1:]

path.write_text(text, encoding="utf-8")
