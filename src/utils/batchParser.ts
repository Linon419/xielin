/**
 * 批量数据解析工具
 * 支持解析用户粘贴的多行数据，自动识别币种、策略类型和谢林点
 */

export interface BatchItem {
  symbol: string;
  type: '兜底区' | '探顶区';
  schellingPoint: number;
  originalText: string;
}

export interface ParseResult {
  success: boolean;
  items: BatchItem[];
  errors: string[];
}

export class BatchParser {
  // 策略类型关键词映射
  private static readonly TYPE_KEYWORDS = {
    '兜底区': ['兜底区', '兜底', '底部', '支撑', '底', 'support', 'bottom'],
    '探顶区': ['探顶区', '探顶', '顶部', '阻力', '顶', 'resistance', 'top', '突破', 'breakout']
  };

  // 币种名称正则表达式（支持字母、数字、常见符号）
  private static readonly SYMBOL_REGEX = /^[A-Za-z][A-Za-z0-9]*$/;

  // 数字正则表达式（支持小数）
  private static readonly NUMBER_REGEX = /\d+\.?\d*/;

  /**
   * 解析批量数据
   * @param text 用户输入的文本
   * @returns 解析结果
   */
  static parse(text: string): ParseResult {
    const lines = text.split('\n').filter(line => line.trim());
    const items: BatchItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const item = this.parseLine(line, i + 1);
        if (item) {
          items.push(item);
        }
      } catch (error) {
        errors.push(`第${i + 1}行解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return {
      success: errors.length === 0,
      items,
      errors
    };
  }

  /**
   * 解析单行数据
   * @param line 单行文本
   * @param lineNumber 行号
   * @returns 解析结果
   */
  private static parseLine(line: string, lineNumber: number): BatchItem | null {
    // 移除多余空格并分割
    const parts = line.replace(/\s+/g, ' ').trim().split(' ');
    
    if (parts.length < 3) {
      throw new Error(`格式不正确，至少需要3个部分（币种 策略类型 谢林点）`);
    }

    // 提取币种名称（第一个部分）
    const symbol = parts[0].toUpperCase();
    if (!this.SYMBOL_REGEX.test(symbol)) {
      throw new Error(`币种名称格式不正确: ${symbol}`);
    }

    // 查找策略类型
    let strategyType: '兜底区' | '探顶区' | null = null;
    let typeIndex = -1;

    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      for (const [type, keywords] of Object.entries(this.TYPE_KEYWORDS)) {
        if (keywords.some(keyword => part.includes(keyword))) {
          strategyType = type as '兜底区' | '探顶区';
          typeIndex = i;
          break;
        }
      }
      if (strategyType) break;
    }

    if (!strategyType) {
      throw new Error(`无法识别策略类型，支持的关键词: ${Object.values(this.TYPE_KEYWORDS).flat().join(', ')}`);
    }

    // 查找谢林点（最后一个数字）
    let schellingPoint: number | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      const match = parts[i].match(this.NUMBER_REGEX);
      if (match) {
        const num = parseFloat(match[0]);
        if (!isNaN(num) && num > 0) {
          schellingPoint = num;
          break;
        }
      }
    }

    if (schellingPoint === null) {
      throw new Error(`无法找到有效的谢林点数值`);
    }

    return {
      symbol,
      type: strategyType,
      schellingPoint,
      originalText: line
    };
  }

  /**
   * 验证解析结果
   * @param items 解析的项目列表
   * @returns 验证结果
   */
  static validate(items: BatchItem[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const symbols = new Set<string>();

    for (const item of items) {
      // 检查重复币种
      if (symbols.has(item.symbol)) {
        errors.push(`币种 ${item.symbol} 重复出现`);
      } else {
        symbols.add(item.symbol);
      }

      // 检查谢林点范围
      if (item.schellingPoint <= 0) {
        errors.push(`${item.symbol} 的谢林点必须大于0`);
      }

      if (item.schellingPoint > 1000000) {
        errors.push(`${item.symbol} 的谢林点过大，请检查数值`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 格式化示例文本
   * @returns 示例文本
   */
  static getExampleText(): string {
    return `CTC 谢林兜底区 0.81
SAHARA 谢林兜底区 0.088
PENGU 谢林探顶区 0.45
BTC 兜底区 42000
ETH 探顶区 3200.5`;
  }

  /**
   * 获取支持的格式说明
   * @returns 格式说明
   */
  static getFormatHelp(): string[] {
    return [
      '每行一个币种，格式：币种名称 策略类型 谢林点',
      '币种名称：支持字母和数字组合（如 BTC, ETH, UXLINK）',
      '策略类型关键词：',
      '  - 兜底区：兜底区、兜底、底部、支撑、底',
      '  - 探顶区：探顶区、探顶、顶部、阻力、顶、突破',
      '谢林点：正数，支持小数（如 0.81, 42000, 3200.5）',
      '示例：',
      '  CTC 谢林兜底区 0.81',
      '  PENGU 探顶区 0.45',
      '  BTC 兜底 42000'
    ];
  }
}
