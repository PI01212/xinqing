/**
 * 心晴助手 - LLM客户端（智谱ChatGLM）
 * 
 * 功能：
 * - 封装智谱API调用
 * - 提供简单的聊天接口
 * - 错误处理和降级
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey?: string;
}

/**
 * 智谱ChatGLM客户端
 */
export class ZhipuClient {
  private config: LLMConfig;
  private apiKey: string | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.apiKey = this.getApiKey();
  }

  /**
   * 加载配置
   */
  private loadConfig(): LLMConfig {
    try {
      const configPath = path.join(__dirname, '../../config/llm-zhipu.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.log('[智谱] 配置文件不存在,使用默认配置');
      return {
        provider: 'zhipu',
        model: 'glm-4-flash',
      };
    }
  }

  /**
   * 获取API Key
   */
  private getApiKey(): string | null {
    // 优先使用环境变量
    const envKey = process.env.ZHIPU_API_KEY;
    if (envKey) {
      console.log('[智谱] 使用环境变量API Key');
      return envKey;
    }

    // 其次使用配置文件
    if (this.config.apiKey) {
      console.log('[智谱] 使用配置文件API Key');
      return this.config.apiKey;
    }

    console.log('[智谱] API Key未配置');
    return null;
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.apiKey !== null;
  }

  /**
   * 简单聊天接口
   */
  async simpleChat(message: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置,请设置环境变量ZHIPU_API_KEY或在config/llm-zhipu.json中配置');
    }

    try {
      return await this.callZhipuAPI(message);
    } catch (error: any) {
      console.error('[智谱] 调用失败:', error);
      throw new Error(`智谱服务出现错误: ${error.message}`);
    }
  }

  /**
   * 调用智谱API
   */
  private async callZhipuAPI(prompt: string): Promise<string> {
    const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'glm-4-flash',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,  // 低温度，保证稳定性
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): { provider: string; model: string } {
    return {
      provider: this.config.provider,
      model: this.config.model,
    };
  }
}

/**
 * 创建智谱客户端实例
 */
export function createZhipuClient(): ZhipuClient {
  return new ZhipuClient();
}
