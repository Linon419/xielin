import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Alert,
  Table,
  Tag,
  Tooltip,
  message,
  Collapse,
  Typography,
  Divider,
  Progress,
  InputNumber,
  Form,
  Select
} from 'antd';
import {
  ThunderboltOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ClearOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { BatchParser, BatchItem, ParseResult } from '../utils/batchParser';
import { StrategyInput, StrategyOutput } from '../types/strategy';
import { contractDataService } from '../services/contractDataService';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface BatchStrategyFormProps {
  onBatchGenerate: (strategies: StrategyOutput[]) => void;
  strategyEngine: any;
}

interface ProcessingItem extends BatchItem {
  status: 'pending' | 'processing' | 'success' | 'error';
  strategy?: StrategyOutput;
  error?: string;
  progress?: number;
}

const BatchStrategyForm: React.FC<BatchStrategyFormProps> = ({
  onBatchGenerate,
  strategyEngine
}) => {
  const [inputText, setInputText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const [completedStrategies, setCompletedStrategies] = useState<StrategyOutput[]>([]);
  const [atrLookback, setAtrLookback] = useState(3); // ATR回看画幅配置

  // 解析输入文本
  const handleParse = () => {
    if (!inputText.trim()) {
      message.warning('请输入要处理的数据');
      return;
    }

    const result = BatchParser.parse(inputText);
    setParseResult(result);

    if (result.success) {
      message.success(`成功解析 ${result.items.length} 个币种`);
    } else {
      message.error(`解析失败，发现 ${result.errors.length} 个错误`);
    }
  };

  // 批量生成策略
  const handleBatchGenerate = async () => {
    if (!parseResult || !parseResult.success || parseResult.items.length === 0) {
      message.error('请先解析数据');
      return;
    }

    setProcessing(true);
    setCompletedStrategies([]);
    
    // 初始化处理项目
    const items: ProcessingItem[] = parseResult.items.map(item => ({
      ...item,
      leverageAtrType: item.leverageAtrType || '4h', // 默认使用4h ATR
      status: 'pending',
      progress: 0
    }));
    setProcessingItems(items);

    const strategies: StrategyOutput[] = [];

    // 逐个处理每个币种
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 更新状态为处理中
      setProcessingItems(prev => 
        prev.map((p, idx) => 
          idx === i ? { ...p, status: 'processing', progress: 10 } : p
        )
      );

      try {
        // 获取合约数据
        setProcessingItems(prev => 
          prev.map((p, idx) => 
            idx === i ? { ...p, progress: 30 } : p
          )
        );

        const [contractData, atrData] = await Promise.all([
          contractDataService.getContractMarketData(item.symbol),
          contractDataService.getContractATRData(item.symbol, atrLookback)
        ]);

        setProcessingItems(prev => 
          prev.map((p, idx) => 
            idx === i ? { ...p, progress: 70 } : p
          )
        );

        if (!contractData || !atrData) {
          throw new Error(`无法获取 ${item.symbol} 的市场数据`);
        }

        // 构建策略输入
        const strategyInput: StrategyInput = {
          symbol: item.symbol,
          type: item.type,
          schellingPoint: item.schellingPoint,
          currentPrice: contractData.price,
          high24h: contractData.high24h,
          low24h: contractData.low24h,
          atr4h: atrData.atr4h,
          atr15m: atrData.atr15m,
          atr1d: atrData.atr1d,
          atr4hMax: atrData.atr4h_max,
          atr15mMax: atrData.atr15m_max,
          atr1dMax: atrData.atr1d_max,
          leverageAtrType: item.leverageAtrType || '4h', // 使用用户选择的ATR类型
          operationCycle: '1分钟',
          strictValidation: false // 批量模式使用宽松验证
        };

        // 调试日志：检查ATR数据和用户选择
        console.log(`[BatchStrategy] ${item.symbol} - 用户选择ATR类型: ${item.leverageAtrType || '4h'}`);
        console.log(`[BatchStrategy] ${item.symbol} - ATR数据:`, {
          atr4h: atrData.atr4h,
          atr4hMax: atrData.atr4h_max,
          atr1d: atrData.atr1d,
          atr1dMax: atrData.atr1d_max,
          hasAtr1d: atrData.atr1d !== undefined,
          atr1dType: typeof atrData.atr1d
        });
        console.log(`[BatchStrategy] ${item.symbol} - 策略输入数据:`, {
          leverageAtrType: strategyInput.leverageAtrType,
          atr1d: strategyInput.atr1d,
          atr1dMax: strategyInput.atr1dMax
        });

        // 生成策略
        const result = strategyEngine.generateStrategy(strategyInput);
        if (result.strategy) {
          strategies.push(result.strategy);
        } else {
          throw new Error(result.errors?.map((e: any) => e.message).join(', ') || '策略生成失败');
        }

        // 更新状态为成功
        setProcessingItems(prev =>
          prev.map((p, idx) =>
            idx === i ? {
              ...p,
              status: 'success',
              strategy: result.strategy,
              progress: 100
            } : p
          )
        );

      } catch (error) {
        // 更新状态为错误
        setProcessingItems(prev => 
          prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'error', 
              error: error instanceof Error ? error.message : '未知错误',
              progress: 0
            } : p
          )
        );
      }

      // 添加延迟避免请求过快
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setProcessing(false);
    setCompletedStrategies(strategies);

    if (strategies.length > 0) {
      message.success(`成功生成 ${strategies.length} 个策略`);
      onBatchGenerate(strategies);
    } else {
      message.error('没有成功生成任何策略');
    }
  };

  // 清空数据
  const handleClear = () => {
    setInputText('');
    setParseResult(null);
    setProcessingItems([]);
    setCompletedStrategies([]);
  };

  // 插入示例数据
  const handleInsertExample = () => {
    setInputText(BatchParser.getExampleText());
  };

  // 表格列定义
  const columns = [
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string) => <Tag color="blue">{symbol}</Tag>
    },
    {
      title: '策略类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === '兜底区' ? 'green' : 'orange'}>{type}</Tag>
      )
    },
    {
      title: '谢林点',
      dataIndex: 'schellingPoint',
      key: 'schellingPoint',
      render: (point: number) => point.toFixed(6)
    },
    {
      title: (
        <Space>
          杠杆ATR类型
          <Tooltip title="选择用于计算杠杆倍数的ATR类型。4小时ATR适合短期交易，日线ATR更保守适合长期持仓。">
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'leverageAtrType',
      key: 'leverageAtrType',
      width: 150,
      render: (leverageAtrType: '4h' | '1d' | undefined, record: ProcessingItem, index: number) => (
        <Select
          value={leverageAtrType || '4h'}
          style={{ width: '100%' }}
          size="small"
          onChange={(value: '4h' | '1d') => {
            const newItems = [...processingItems];
            newItems[index] = { ...newItems[index], leverageAtrType: value };
            setProcessingItems(newItems);
          }}
          disabled={record.status === 'processing'}
        >
          <Option value="4h">4小时ATR</Option>
          <Option value="1d">日线ATR（保守）</Option>
        </Select>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ProcessingItem) => {
        const statusConfig = {
          pending: { color: 'default', text: '等待中' },
          processing: { color: 'processing', text: '处理中' },
          success: { color: 'success', text: '成功' },
          error: { color: 'error', text: '失败' }
        };
        
        const config = statusConfig[status as keyof typeof statusConfig];
        
        return (
          <Space direction="vertical" size="small">
            <Tag color={config.color}>{config.text}</Tag>
            {status === 'processing' && record.progress && (
              <Progress percent={record.progress} size="small" />
            )}
            {status === 'error' && record.error && (
              <Text type="danger" style={{ fontSize: '12px' }}>
                {record.error}
              </Text>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          批量策略生成
        </Space>
      }
      extra={
        <Space>
          <Button 
            icon={<FileTextOutlined />} 
            onClick={handleInsertExample}
            size="small"
          >
            插入示例
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleClear}
            size="small"
          >
            清空
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 配置选项 */}
        <Collapse ghost>
          <Panel
            header={
              <Space>
                <InfoCircleOutlined />
                批量策略配置
              </Space>
            }
            key="config"
          >
            <Form layout="inline">
              <Form.Item
                label={
                  <Space>
                    ATR回看画幅
                    <Tooltip title="用于计算ATR最大值的K线数量，影响杠杆和止损止盈计算的保守程度。数值越大越保守。">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber
                  value={atrLookback}
                  onChange={(value) => setAtrLookback(value || 3)}
                  min={1}
                  max={10}
                  step={1}
                  style={{ width: 120 }}
                  addonAfter="个画幅"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    批量设置杠杆ATR类型
                    <Tooltip title="一键为所有币种设置相同的杠杆计算ATR类型">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Space>
                  <Select
                    placeholder="选择ATR类型"
                    style={{ width: 150 }}
                    onChange={(value: '4h' | '1d') => {
                      const newItems = processingItems.map(item => ({
                        ...item,
                        leverageAtrType: value
                      }));
                      setProcessingItems(newItems);
                    }}
                    disabled={processing}
                  >
                    <Option value="4h">4小时ATR</Option>
                    <Option value="1d">日线ATR（保守）</Option>
                  </Select>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    应用到所有币种
                  </Text>
                </Space>
              </Form.Item>
            </Form>
          </Panel>
        </Collapse>

        {/* 输入区域 */}
        <div>
          <Paragraph>
            <Text strong>粘贴多个币种数据，每行一个：</Text>
          </Paragraph>
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="CTC 谢林兜底区 0.81&#10;SAHARA 谢林兜底区 0.088&#10;PENGU 谢林探顶区 0.45"
            rows={6}
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Button 
              type="primary" 
              icon={<InfoCircleOutlined />}
              onClick={handleParse}
            >
              解析数据
            </Button>
            {parseResult && parseResult.success && (
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />}
                onClick={handleBatchGenerate}
                loading={processing}
                disabled={processing}
              >
                批量生成策略
              </Button>
            )}
          </Space>
        </div>

        {/* 格式说明 */}
        <Collapse ghost>
          <Panel header="格式说明" key="help">
            <ul>
              {BatchParser.getFormatHelp().map((help, index) => (
                <li key={index}>{help}</li>
              ))}
            </ul>
          </Panel>
        </Collapse>

        {/* 解析结果 */}
        {parseResult && (
          <div>
            {parseResult.errors.length > 0 && (
              <Alert
                type="error"
                message="解析错误"
                description={
                  <ul>
                    {parseResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {parseResult.items.length > 0 && (
              <div>
                <Divider orientation="left">解析结果 ({parseResult.items.length} 个币种)</Divider>
                <Table
                  dataSource={processingItems.length > 0 ? processingItems : parseResult.items.map(item => ({
                    ...item,
                    status: 'pending' as const,
                    progress: 0
                  }))}
                  columns={columns}
                  rowKey="symbol"
                  size="small"
                  pagination={false}
                />
              </div>
            )}
          </div>
        )}

        {/* 处理进度提示 */}
        {processing && (
          <Alert
            type="info"
            message="正在批量生成策略..."
            description="请耐心等待，系统正在获取市场数据并生成策略"
            showIcon
          />
        )}

        {/* 完成提示 */}
        {completedStrategies.length > 0 && !processing && (
          <Alert
            type="success"
            message={`批量生成完成！成功生成 ${completedStrategies.length} 个策略`}
            description="策略结果已显示在下方，您可以查看详细信息"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

export default BatchStrategyForm;
