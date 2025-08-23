import { Response } from 'express';
import { Page } from 'playwright';
import sharp from 'sharp';
import { PlaywrightMcpClient } from './mcpClient.js';
import * as fs from 'fs';
import * as path from 'path';

interface StreamConfig {
  fps: number;                 // 默认2FPS
  jpegQuality: number;         // 60
  width: number;               // 1024
  height: number;              // 768
  maskSelectors: string[];     // 脱敏选择器
}

interface StreamClient {
  response: Response;
  runId: string;
  userId: string;
  connectedAt: Date;
}

export class StreamService {
  private clients: Map<string, Set<StreamClient>>;
  private config: StreamConfig;
  private frameBuffer: Map<string, Buffer>;
  private timers: Map<string, NodeJS.Timeout>;        // 🔥 修正：定时器管理
  private mcpClients: Map<string, PlaywrightMcpClient>; // 🔥 MCP客户端缓存
  
  // 🔥 方案C性能统计
  private stats = {
    totalAttempts: 0,
    successfulScreenshots: 0,
    fallbackFrames: 0,
    averageProcessingTime: 0,
    lastResetTime: Date.now()
  };
  
  constructor(config: StreamConfig) {
    this.clients = new Map();
    this.config = config;
    this.frameBuffer = new Map();
    this.timers = new Map();
    this.mcpClients = new Map();
  }

  // 🔥 修正：基于fps定时取帧
  startStream(runId: string, page: Page): void {
    if (this.timers.has(runId)) return;
    
    const interval = Math.max(500, Math.floor(1000 / Math.min(2, this.config.fps || 1)));
    
    const timer = setInterval(async () => {
      try {
        console.log(`📸 [StreamService] 开始截图: ${runId}`);
        
        // 🔥 临时禁用mask避免黑屏
        const buffer = await page.screenshot({
          type: 'jpeg',
          quality: this.config.jpegQuality
          // mask: maskLocators.length > 0 ? maskLocators : undefined  // 🔥 临时注释
        });
        
        console.log(`✅ [StreamService] 截图成功: ${runId}, 大小: ${buffer.length}字节`);
        await this.pushFrame(runId, buffer);
        console.log(`📤 [StreamService] 推送帧完成: ${runId}`);
      } catch (error) {
        console.error(`❌ [StreamService] 截图失败: ${runId}`, error);
      }
    }, interval);
    
    this.timers.set(runId, timer);
    console.log(`📺 实时流已启动: ${runId}, fps: ${this.config.fps}, interval: ${interval}ms`);
  }

  // 🔥 新增：使用MCP客户端的实时流
  startStreamWithMcp(runId: string, mcpClient: PlaywrightMcpClient): void {
    console.log(`🎬 [StreamService] startStreamWithMcp被调用: ${runId}`);
    
    if (this.timers.has(runId)) {
      console.log(`⚠️ [StreamService] 定时器已存在，跳过: ${runId}`);
      return;
    }
    
    const interval = Math.max(500, Math.floor(1000 / Math.min(2, this.config.fps || 1)));
    this.mcpClients.set(runId, mcpClient);
    
    console.log(`⏰ [StreamService] 创建定时器: ${runId}, 间隔: ${interval}ms`);
    
    const timer = setInterval(async () => {
      try {
        console.log(`📸 [StreamService] 开始生成实时帧: ${runId}`);
        
        // 🔥 方案C：使用优化后的MCP截图（自动文件移动）
        const startTime = Date.now();
        this.stats.totalAttempts++;
        
        try {
          const tempFilename = `stream-${runId}-${Date.now()}.png`;
          const tempDir = path.join(process.cwd(), 'temp-screenshots');
          const tempPath = path.join(tempDir, tempFilename);
          
          // 🔥 确保目录存在
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`📁 [StreamService] 创建目录: ${tempDir}`);
          }
          
          console.log(`📸 [StreamService] 开始MCP截图 (循环修复版): ${runId}, 尝试次数: ${this.stats.totalAttempts}`);
          console.log(`📁 [StreamService] 目标路径: ${tempPath}`);
          
          // 🔥 调用优化后的截图方法（自动处理文件移动）
          let mcpError = null;
          try {
            await mcpClient.takeScreenshotForStream(tempPath);
          } catch (error: any) {
            mcpError = error;
            console.warn(`⚠️ [StreamService] MCP截图调用失败: ${error.message}`);
          }
          
          // 🔥 如果是"无页面"错误，立即跳过等待循环，直接生成时钟帧
          if (mcpError && mcpError.message && mcpError.message.includes('No open pages available')) {
            console.warn(`🚫 [StreamService] 浏览器无活动页面，跳过等待循环: ${runId}`);
            throw new Error('浏览器无活动页面，无法截图');
          }
          
          // 🔥 其他错误或成功情况，进行文件验证（但减少等待次数避免循环）
          let fileExists = false;
          const maxWait = 3; // 🔥 减少到3次，避免循环堆积
          for (let i = 0; i < maxWait; i++) {
            if (fs.existsSync(tempPath)) {
              const stats = fs.statSync(tempPath);
              if (stats.size > 0) {
                fileExists = true;
                console.log(`✅ [StreamService] 文件验证成功: ${tempPath} (${stats.size}字节, 第${i + 1}次检查)`);
                break;
              }
            }
            if (i < maxWait - 1) {
              console.log(`⏳ [StreamService] 等待文件生成... (${i + 1}/${maxWait}) [${runId.substring(0,8)}]`);
              
              // 🔥 修复：推送动态等待提示帧，不更新缓存
              try {
                const waitingFrame = await this.createWaitingFrame(i + 1, maxWait);
                await this.pushFrameWithoutCache(runId, waitingFrame);
                console.log(`📺 [StreamService] 推送等待提示帧 (${i + 1}/${maxWait}): ${runId.substring(0,8)}`);
              } catch (waitingError) {
                console.warn(`⚠️ [StreamService] 创建等待帧失败，使用缓存帧: ${waitingError.message}`);
                // 降级：推送缓存帧但不更新缓存
                const lastFrame = this.frameBuffer.get(runId);
                if (lastFrame) {
                  await this.pushFrameWithoutCache(runId, lastFrame);
                  console.log(`📺 [StreamService] 等待期间推送缓存帧(不更新): ${runId.substring(0,8)}`);
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          if (!fileExists) {
            console.warn(`🔍 [StreamService] 截图文件验证失败: ${tempPath}`);
            throw new Error(`截图文件未生成或为空: ${tempPath}`);
          }
          
          // 读取截图文件并转换为JPEG
          const imageBuffer = fs.readFileSync(tempPath);
          console.log(`📖 [StreamService] 读取图片文件: ${imageBuffer.length}字节`);
          
          const jpegBuffer = await sharp(imageBuffer)
            .jpeg({ quality: this.config.jpegQuality })
            .toBuffer();
          
          const processingTime = Date.now() - startTime;
          this.stats.successfulScreenshots++;
          this.updateAverageProcessingTime(processingTime);
          
          console.log(`✅ [StreamService] MCP截图成功: ${runId}, 处理时间: ${processingTime}ms, 成功率: ${(this.stats.successfulScreenshots / this.stats.totalAttempts * 100).toFixed(1)}%`);
          console.log(`🔄 [StreamService] 图片处理: ${imageBuffer.length}字节 -> ${jpegBuffer.length}字节`);
          
          await this.pushFrameAndUpdateCache(runId, jpegBuffer);
          console.log(`📤 [StreamService] 推送真实截图完成: ${runId}`);
          
          // 清理临时文件
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            console.warn(`🧹 [StreamService] 清理临时文件失败: ${tempPath}`, cleanupError);
          }
          
        } catch (mcpError: any) {
          // 🔥 统计失败次数
          this.stats.fallbackFrames++;
          const failureRate = (this.stats.fallbackFrames / this.stats.totalAttempts * 100).toFixed(1);
          
          // 🔥 循环保护：如果失败率超过90%且尝试次数大于20，暂时停止定时器
          if (this.stats.totalAttempts > 20 && parseFloat(failureRate) > 90) {
            console.error(`🚨 [StreamService] 失败率过高 (${failureRate}%)，暂停实时流避免循环: ${runId}`);
            this.pauseStreamTemporarily(runId, 10000); // 暂停10秒
            return; // 立即返回，不生成时钟帧
          }
          
          // 🔥 优化：更详细的错误分类和处理
          const errorMessage = mcpError.message || '未知错误';
          
          if (errorMessage.includes('浏览器无活动页面')) {
            console.warn(`🚫 [StreamService] 浏览器无活动页面: ${runId}, 失败率: ${failureRate}%`);
          } else if (errorMessage.includes('无法从MCP返回结果中提取实际文件路径')) {
            console.warn(`⚠️ [StreamService] MCP路径提取失败，使用时钟帧: ${runId}, 失败率: ${failureRate}%`);
          } else if (errorMessage.includes('截图文件处理失败')) {
            console.warn(`⚠️ [StreamService] MCP文件处理失败，使用时钟帧: ${runId}, 失败率: ${failureRate}%`);
          } else {
            console.warn(`⚠️ [StreamService] MCP截图失败，使用时钟帧: ${runId}, 失败率: ${failureRate}%`, errorMessage.substring(0, 100));
          }
          
          // 🔥 生成时钟帧（带错误保护）
          try {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
              <rect width="100%" height="100%" fill="#2c3e50"/>
              <text x="50%" y="35%" fill="#e74c3c" font-size="36" text-anchor="middle" dominant-baseline="middle">
                📷 截图处理中...
              </text>
              <text x="50%" y="50%" fill="#ecf0f1" font-size="28" text-anchor="middle" dominant-baseline="middle">
                测试正在执行
              </text>
              <text x="50%" y="65%" fill="#3498db" font-size="24" text-anchor="middle" dominant-baseline="middle">
                ${new Date().toLocaleTimeString()}
              </text>
            </svg>`;
            
            const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
            console.log(`🎨 [StreamService] 生成时钟帧: ${runId.substring(0,8)}, 大小: ${buffer.length}字节`);
            
            await this.pushFrameWithoutCache(runId, buffer);
            console.log(`📤 [StreamService] 推送时钟帧完成: ${runId.substring(0,8)}`);
          } catch (clockError) {
            console.error(`❌ [StreamService] 时钟帧生成失败: ${runId}`, clockError);
            
            // 🔥 修复黑屏问题：时钟帧失败时也要推送上一帧，避免完全黑屏
            const lastFrame = this.frameBuffer.get(runId);
            if (lastFrame) {
              console.log(`📺 [StreamService] 时钟帧失败，推送上一帧避免黑屏: ${runId.substring(0,8)}`);
              try {
                await this.pushFrameWithoutCache(runId, lastFrame);
              } catch (lastFrameError) {
                console.error(`❌ [StreamService] 推送上一帧也失败: ${runId}`, lastFrameError);
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [StreamService] MCP流截图失败 (${runId}):`, error);
      }
    }, interval);
    
    this.timers.set(runId, timer);
    console.log(`✅ [StreamService] MCP实时流已启动: ${runId}, fps: ${this.config.fps}, interval: ${interval}ms`);
  }

  // 🔥 新增：暂时暂停实时流，避免死循环
  private pauseStreamTemporarily(runId: string, pauseDurationMs: number): void {
    const timer = this.timers.get(runId);
    if (timer) {
      console.log(`⏸️ [StreamService] 暂停实时流: ${runId}, 持续时间: ${pauseDurationMs}ms`);
      
      clearInterval(timer);
      this.timers.delete(runId);
      
      // 重置统计信息以给系统一个新的机会
      this.stats.totalAttempts = 0;
      this.stats.fallbackFrames = 0;
      this.stats.successfulScreenshots = 0;
      
      // 在暂停时间后重新启动流（如果MCP客户端仍然存在）
      setTimeout(() => {
        const mcpClient = this.mcpClients.get(runId);
        if (mcpClient && !this.timers.has(runId)) {
          console.log(`▶️ [StreamService] 恢复实时流: ${runId}`);
          this.startStreamWithMcp(runId, mcpClient);
        }
      }, pauseDurationMs);
    }
  }

  // 🔥 修正：停止实时流，清理所有资源
  stopStream(runId: string): void {
    console.log(`🛑 [StreamService] 停止实时流: ${runId}`);
    
    const timer = this.timers.get(runId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(runId);
    }
    
    // 清理MCP客户端缓存
    this.mcpClients.delete(runId);
    
    // 关闭所有客户端连接
    const clients = this.clients.get(runId);
    if (clients) {
      for (const client of clients) {
        try {
          client.response.end();
        } catch (error) {
          // 忽略关闭错误
        }
      }
    }
    
    this.clients.delete(runId);
    this.frameBuffer.delete(runId);  // 🔥 也清理帧缓冲
    console.log(`📺 实时流已停止: ${runId}`);
  }

  // 注册客户端
  async registerClient(runId: string, response: Response, userId: string): Promise<void> {
    console.log(`🔍 [StreamService] 开始注册客户端:`, {
      runId,
      userId,
      hasExistingClients: this.clients.has(runId),
      totalRunIds: this.clients.size
    });

    if (!this.clients.has(runId)) {
      this.clients.set(runId, new Set());
      console.log(`🆕 [StreamService] 创建新的客户端集合: ${runId}`);
    }
    
    const client: StreamClient = {
      response,
      runId,
      userId,
      connectedAt: new Date()
    };
    
    this.clients.get(runId)!.add(client);
    console.log(`👥 [StreamService] 客户端已添加，当前客户端数量: ${this.clients.get(runId)!.size}`);
    
    // 初始化MJPEG流
    console.log(`🔧 [StreamService] 初始化MJPEG流: ${runId}`);
    this.initializeMjpegStream(response);
    
    // 🔥 修正：新连接立刻推送最后一帧或占位帧
    const lastFrame = this.frameBuffer.get(runId);
    console.log(`🖼️ [StreamService] 检查缓存帧:`, {
      runId,
      hasLastFrame: !!lastFrame,
      frameSize: lastFrame ? lastFrame.length : 0
    });

    if (lastFrame) {
      try {
        // 🔥 修复：直接按标准格式写入，不用buildMjpegFrame
        response.write(`--frame\r\n`);
        response.write(`Content-Type: image/jpeg\r\n`);
        response.write(`Content-Length: ${lastFrame.length}\r\n\r\n`);
        response.write(lastFrame);
        response.write(`\r\n`);
        console.log(`✅ [StreamService] 推送缓存帧成功: ${runId}, 大小: ${lastFrame.length}字节`);
      } catch (error) {
        console.error(`❌ [StreamService] 推送缓存帧失败:`, { runId, error });
      }
    } else {
      // 🔥 发送占位帧避免客户端超时
      try {
        console.log(`🎨 [StreamService] 开始创建占位帧: ${runId}`);
        const placeholderFrame = await this.createPlaceholderFrame();
        // 🔥 修复：直接按标准格式写入，不用buildMjpegFrame
        response.write(`--frame\r\n`);
        response.write(`Content-Type: image/jpeg\r\n`);
        response.write(`Content-Length: ${placeholderFrame.length}\r\n\r\n`);
        response.write(placeholderFrame);
        response.write(`\r\n`);
        console.log(`✅ [StreamService] 发送占位帧成功: ${runId}, 大小: ${placeholderFrame.length}字节`);
      } catch (error) {
        console.error(`❌ [StreamService] 发送占位帧失败:`, { runId, error });
      }
    }
    
    console.log(`✅ [StreamService] 实时流客户端注册完成: ${runId} (用户: ${userId})`);
  }

  // 🔥 新增：推送帧并更新缓存（真实截图用）
  async pushFrameAndUpdateCache(runId: string, screenshotBuffer: Buffer): Promise<void> {
    await this.pushFrameInternal(runId, screenshotBuffer, true);
  }
  
  // 🔥 新增：推送帧不更新缓存（等待帧/时钟帧用）
  async pushFrameWithoutCache(runId: string, screenshotBuffer: Buffer): Promise<void> {
    await this.pushFrameInternal(runId, screenshotBuffer, false);
  }
  
  // 🔥 保持兼容性：默认推送帧并更新缓存
  async pushFrame(runId: string, screenshotBuffer: Buffer): Promise<void> {
    await this.pushFrameAndUpdateCache(runId, screenshotBuffer);
  }

  // 🔥 统一的帧推送逻辑
  private async pushFrameInternal(runId: string, screenshotBuffer: Buffer, updateCache: boolean): Promise<void> {
    const clients = this.clients.get(runId);
    if (!clients || clients.size === 0) return;

    try {
      // 处理截图：调整大小、压缩（脱敏已在截图时处理）
      const processedFrame = await this.processScreenshot(screenshotBuffer);
      
      // 🔥 修复：按标准格式逐步写入MJPEG帧
      const failedClients: StreamClient[] = [];
      
      for (const client of clients) {
        try {
          // 🔥 修复：检查连接状态
          if (client.response.destroyed || client.response.socket?.destroyed) {
            console.log(`🚮 [StreamService] 检测到已断开的客户端: ${runId}`);
            failedClients.push(client);
            continue;
          }
          
          // 🔥 修复：添加连接错误保护的写入方法
          const safeWrite = (data: string | Buffer): boolean => {
            try {
              return client.response.write(data);
            } catch (error: any) {
              const errorCode = error.code || 'UNKNOWN';
              if (errorCode === 'ECONNRESET' || errorCode === 'EPIPE' || errorCode === 'ENOTFOUND') {
                console.log(`🔌 [StreamService] 客户端连接已断开 (${errorCode}): ${runId}`);
              } else {
                console.warn(`❌ [StreamService] 写入错误 (${errorCode}): ${runId}`, error.message);
              }
              return false;
            }
          };
          
          // 严格按照MJPEG标准格式写入，每步检查结果
          let written = safeWrite(`--frame\r\n`);
          if (written) written = safeWrite(`Content-Type: image/jpeg\r\n`);
          if (written) written = safeWrite(`Content-Length: ${processedFrame.length}\r\n\r\n`);
          if (written) written = safeWrite(processedFrame);
          if (written) written = safeWrite(`\r\n`);
          
          if (!written) {
            console.log(`📤 [StreamService] 客户端写入失败，移除: ${runId}`);
            failedClients.push(client);
          }
        } catch (error: any) {
          // 🔥 修复：详细记录不同类型的连接错误
          const errorCode = error.code || 'UNKNOWN';
          console.warn(`❌ [StreamService] 推送帧异常 (${errorCode}):`, { 
            runId, 
            errorCode, 
            errorMessage: error.message,
            clientId: client.userId 
          });
          failedClients.push(client);
        }
      }
      
      // 清理失败的客户端
      failedClients.forEach(client => {
        this.unregisterClient(runId, client.response);
      });
      
      // 🔥 修复：条件性缓存更新
      if (updateCache) {
        this.frameBuffer.set(runId, processedFrame);
        console.log(`💾 [StreamService] 缓存已更新: ${runId}`);
      } else {
        console.log(`📤 [StreamService] 推送临时帧，不更新缓存: ${runId}`);
      }
      
    } catch (error) {
      console.error(`处理实时流帧失败:`, error);
    }
  }

  // 移除客户端
  unregisterClient(runId: string, response: Response): void {
    const clients = this.clients.get(runId);
    if (!clients) return;
    
    const toRemove = Array.from(clients).find(c => c.response === response);
    if (toRemove) {
      clients.delete(toRemove);
      console.log(`📺 实时流客户端已移除: ${runId}`);
    }
    
    if (clients.size === 0) {
      this.clients.delete(runId);
      this.frameBuffer.delete(runId);
    }
  }

  private initializeMjpegStream(response: Response): void {
    response.status(200);
    response.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 🔥 关键：HTTP/1.1长连接设置
    (response as any).flushHeaders?.();
    response.setTimeout(0);
    if (response.socket) {
      response.socket.setKeepAlive(true, 10000);
      response.socket.setNoDelay(true);
    }
    
    console.log(`📡 [StreamService] MJPEG流头部已发送`);
  }

  private buildMjpegFrame(imageBuffer: Buffer): Buffer {
    const header = Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${imageBuffer.length}\r\n\r\n`);
    const footer = Buffer.from('\r\n');
    return Buffer.concat([header, imageBuffer, footer]);
  }

  private async processScreenshot(buffer: Buffer): Promise<Buffer> {
    // 使用sharp处理图片：调整大小、压缩
    return await sharp(buffer)
      .resize(this.config.width, this.config.height, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: this.config.jpegQuality })
      .toBuffer();
  }

  // 🔥 新增：创建占位帧避免客户端超时
  private async createPlaceholderFrame(): Promise<Buffer> {
    const text = '等待测试开始...';
    const width = this.config.width;
    const height = this.config.height;
    
    console.log(`🎨 [StreamService] 创建占位帧:`, {
      text,
      width,
      height,
      quality: this.config.jpegQuality
    });
    
    try {
      // 创建纯色背景图片，并在中间添加文字
      const buffer = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 45, g: 55, b: 72 } // 深灰色背景
        }
      })
      .composite([{
        input: Buffer.from(`
          <svg width="${width}" height="${height}">
            <rect width="${width}" height="${height}" fill="rgb(45,55,72)"/>
            <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
                  font-family="Arial, sans-serif" font-size="32" fill="white">
              ${text}
            </text>
            <circle cx="50%" cy="60%" r="8" fill="rgb(156,163,175)">
              <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
        `),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: this.config.jpegQuality })
      .toBuffer();
      
      console.log(`✅ [StreamService] 占位帧创建成功，大小: ${buffer.length}字节`);
      return buffer;
    } catch (error) {
      console.error(`❌ [StreamService] 创建占位帧失败:`, error);
      throw error;
    }
  }

  // 🔥 新增：创建动态等待提示帧
  private async createWaitingFrame(currentStep: number, totalSteps: number): Promise<Buffer> {
    const text = `⏳ 正在处理截图... (${currentStep}/${totalSteps})`;
    const width = this.config.width;
    const height = this.config.height;
    
    console.log(`🎨 [StreamService] 创建等待提示帧:`, {
      text,
      currentStep,
      totalSteps,
      width,
      height,
      quality: this.config.jpegQuality
    });
    
    try {
      // 计算进度百分比
      const progressPercent = (currentStep / totalSteps) * 100;
      const progressWidth = Math.floor((width * 0.6) * (progressPercent / 100));
      
      // 创建带进度条的等待提示帧
      const buffer = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 44, g: 62, b: 80 } // 深蓝灰色背景
        }
      })
      .composite([{
        input: Buffer.from(`
          <svg width="${width}" height="${height}">
            <rect width="${width}" height="${height}" fill="rgb(44,62,80)"/>
            
            <!-- 主标题 -->
            <text x="50%" y="40%" text-anchor="middle" dy="0.35em" 
                  font-family="Arial, sans-serif" font-size="28" fill="#e74c3c" font-weight="bold">
              ⏳ 正在处理截图...
            </text>
            
            <!-- 进度文本 -->
            <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
                  font-family="Arial, sans-serif" font-size="24" fill="#ecf0f1">
              (${currentStep}/${totalSteps})
            </text>
            
            <!-- 进度条背景 -->
            <rect x="20%" y="58%" width="60%" height="8" fill="#34495e" rx="4"/>
            
            <!-- 进度条 -->
            <rect x="20%" y="58%" width="${progressWidth}" height="8" fill="#3498db" rx="4">
              <animate attributeName="fill" values="#3498db;#2ecc71;#3498db" dur="1.5s" repeatCount="indefinite"/>
            </rect>
            
            <!-- 时间戳 -->
            <text x="50%" y="75%" text-anchor="middle" dy="0.35em" 
                  font-family="Arial, sans-serif" font-size="18" fill="#bdc3c7">
              ${new Date().toLocaleTimeString()}
            </text>
            
            <!-- 等待动画点 -->
            <circle cx="45%" cy="85%" r="4" fill="#95a5a6">
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50%" cy="85%" r="4" fill="#95a5a6">
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.33s" repeatCount="indefinite"/>
            </circle>
            <circle cx="55%" cy="85%" r="4" fill="#95a5a6">
              <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.66s" repeatCount="indefinite"/>
            </circle>
          </svg>
        `),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: this.config.jpegQuality })
      .toBuffer();
      
      console.log(`✅ [StreamService] 等待提示帧创建成功，大小: ${buffer.length}字节, 进度: ${progressPercent.toFixed(1)}%`);
      return buffer;
    } catch (error) {
      console.error(`❌ [StreamService] 创建等待提示帧失败:`, error);
      throw error;
    }
  }

  // 🔥 方案C统计方法
  private updateAverageProcessingTime(newTime: number): void {
    const total = this.stats.successfulScreenshots;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (total - 1) + newTime) / total;
  }

  // 🔥 获取方案C统计信息
  getPerformanceStats() {
    const uptime = Date.now() - this.stats.lastResetTime;
    return {
      ...this.stats,
      uptime,
      successRate: this.stats.totalAttempts > 0 ? 
        (this.stats.successfulScreenshots / this.stats.totalAttempts * 100).toFixed(1) : '0.0',
      failureRate: this.stats.totalAttempts > 0 ? 
        (this.stats.fallbackFrames / this.stats.totalAttempts * 100).toFixed(1) : '0.0'
    };
  }

  // 🔥 重置统计
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulScreenshots: 0,
      fallbackFrames: 0,
      averageProcessingTime: 0,
      lastResetTime: Date.now()
    };
    console.log(`📊 [StreamService] 统计数据已重置`);
  }
}

export { StreamConfig, StreamClient };