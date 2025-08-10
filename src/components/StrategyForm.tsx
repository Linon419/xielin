import React, { useCallback, useState } from 'react';
import {
  Form,
  Select,
  InputNumber,
  Button,
  Card,
  Space,
  Collapse,
  Alert,
  Tooltip,
  AutoComplete,
  Spin,
  message
} from 'antd';
import { InfoCircleOutlined, SettingOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { StrategyInput, ValidationError } from '../types/strategy';
import { contractDataService, ContractMarketData, ATRData } from '../services/contractDataService';
import SubscribeButton from './SubscribeButton';

const { Option } = Select;
const { Panel } = Collapse;

interface StrategyFormProps {
  onSubmit: (data: StrategyInput) => void;
  loading?: boolean;
  errors?: ValidationError[];
}

const StrategyForm: React.FC<StrategyFormProps> = ({ onSubmit, loading, errors }) => {
  const [form] = Form.useForm();
  const [contractData, setContractData] = useState<ContractMarketData | null>(null);
  const [atrData, setATRData] = useState<ATRData | null>(null);
  const [symbolOptions, setSymbolOptions] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  // 搜索合约币种
  const handleSymbolSearch = useCallback(async (value: string) => {
    if (value.length < 2) {
      setSymbolOptions([]);
      return;
    }

    try {
      const symbols = await contractDataService.searchContractSymbols(value);
      setSymbolOptions(symbols);
    } catch (error) {
      console.error('搜索合约币种失败:', error);
    }
  }, []);

  // 自动获取合约数据
  const fetchContractData = useCallback(async (symbol: string) => {
    if (!symbol || !autoFillEnabled) return;

    console.log(`[StrategyForm] 开始获取合约数据: ${symbol}`);
    setLoadingData(true);
    try {
      // 获取当前表单中的ATR回看画幅设置
      const atrLookback = form.getFieldValue('atrLookback') || 3;
      console.log(`[StrategyForm] ATR回看画幅: ${atrLookback}`);

      console.log(`[StrategyForm] 调用API获取数据...`);
      const [contract, atr] = await Promise.all([
        contractDataService.getContractMarketData(symbol),
        contractDataService.getContractATRData(symbol, atrLookback)
      ]);

      console.log(`[StrategyForm] 合约数据:`, contract);
      console.log(`[StrategyForm] ATR数据:`, atr);

      if (contract) {
        setContractData(contract);
        form.setFieldsValue({
          currentPrice: contract.price
        });
        console.log(`[StrategyForm] 设置当前价格: ${contract.price}`);
      }

      if (atr) {
        setATRData(atr);
        form.setFieldsValue({
          atr4h: atr.atr4h,
          atr15m: atr.atr15m,
          atr1d: atr.atr1d
        });
        console.log(`[StrategyForm] 设置ATR数据: 4h=${atr.atr4h}, 15m=${atr.atr15m}, 1d=${atr.atr1d}`);
      }

      if (contract || atr) {
        message.success('合约数据获取成功！');
        console.log(`[StrategyForm] 数据获取成功`);
      } else {
        message.warning('未能获取到该合约的数据，请手动输入');
        console.log(`[StrategyForm] 未获取到数据`);
      }
    } catch (error) {
      console.error('[StrategyForm] 获取合约数据失败:', error);
      message.error('获取合约数据失败，请检查网络连接或手动输入');
    } finally {
      setLoadingData(false);
      console.log(`[StrategyForm] 数据获取完成`);
    }
  }, [form, autoFillEnabled]);

  // 处理合约币种选择
  const handleSymbolSelect = useCallback((value: string) => {
    form.setFieldsValue({ symbol: value });
    setSelectedSymbol(value);
    fetchContractData(value);
  }, [form, fetchContractData]);

  // 手动刷新合约数据
  const handleRefreshData = useCallback(() => {
    const symbol = form.getFieldValue('symbol');
    if (symbol) {
      fetchContractData(symbol);
    } else {
      message.warning('请先输入合约币种名称');
    }
  }, [form, fetchContractData]);

  // 处理表单提交
  const handleSubmit = useCallback((values: any) => {
    const strategyInput: StrategyInput = {
      symbol: values.symbol?.toUpperCase(),
      type: values.type,
      schellingPoint: values.schellingPoint,
      currentPrice: values.currentPrice,
      high24h: contractData?.high24h,     // 传递24小时最高价格
      low24h: contractData?.low24h,       // 传递24小时最低价格
      atr4h: values.atr4h,
      atr15m: values.atr15m,
      atr1d: atrData?.atr1d,           // 传递日线ATR
      atr4hMax: atrData?.atr4h_max,    // 传递ATR最大值
      atr15mMax: atrData?.atr15m_max,  // 传递ATR最大值
      atr1dMax: atrData?.atr1d_max,    // 传递日线ATR最大值
      leverageAtrType: values.leverageAtrType || '4h', // 杠杆计算ATR类型
      operationCycle: values.operationCycle || '1分钟'
    };
    onSubmit(strategyInput);
  }, [onSubmit, atrData, contractData]);

  // 获取字段错误信息
  const getFieldError = (fieldName: string) => {
    return errors?.find(error => error.field === fieldName)?.message;
  };

  return (
    <Card 
      title="策略参数输入" 
      className="strategy-form-card"
      style={{ height: 'fit-content' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        size="middle"
      >
        {/* 基础信息 */}
        <div className="form-section">
          <h4 style={{ marginBottom: 16, color: '#1890ff' }}>基础信息</h4>
          
          <Form.Item
            label={
              <Space>
                合约币种
                <Tooltip title="输入要分析的合约币种名称，支持永续合约自动搜索和数据获取">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
                <Button
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => setAutoFillEnabled(!autoFillEnabled)}
                  style={{
                    color: autoFillEnabled ? '#52c41a' : '#999',
                    padding: 0
                  }}
                >
                  {autoFillEnabled ? '自动获取' : '手动输入'}
                </Button>
              </Space>
            }
            name="symbol"
            rules={[{ required: true, message: '请输入合约币种名称' }]}
            validateStatus={getFieldError('symbol') ? 'error' : ''}
            help={getFieldError('symbol')}
          >
            <div>
              <AutoComplete
                placeholder="如: UXLINK, SWARMS, BTC (永续合约)"
                options={symbolOptions.map(symbol => ({ value: symbol, label: symbol }))}
                onSearch={handleSymbolSearch}
                onSelect={handleSymbolSelect}
                style={{ textTransform: 'uppercase', width: '100%' }}
                filterOption={false}
              />
              {selectedSymbol && (
                <div style={{ marginTop: 8 }}>
                  <Space>
                    <span style={{ fontSize: 12, color: '#666' }}>订阅此币种消息：</span>
                    <SubscribeButton
                      symbol={selectedSymbol}
                      size="small"
                      type="default"
                      showText={true}
                    />
                  </Space>
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            label="谢林点类型"
            name="type"
            rules={[{ required: true, message: '请选择谢林点类型' }]}
          >
            <Select placeholder="选择谢林点类型">
              <Option value="兜底区">兜底区 (支撑位策略)</Option>
              <Option value="探顶区">探顶区 (突破策略)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={
              <Space>
                谢林点位
                <Tooltip title="关键的价格支撑或阻力位">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            name="schellingPoint"
            rules={[{ required: true, message: '请输入谢林点位' }]}
            validateStatus={getFieldError('schellingPoint') ? 'error' : ''}
            help={getFieldError('schellingPoint')}
          >
            <InputNumber
              placeholder="0.000000"
              style={{ width: '100%' }}
              step={0.000001}
              precision={6}
              min={0}
            />
          </Form.Item>
        </div>

        {/* 价格数据 */}
        <div className="form-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: '#1890ff' }}>价格数据</h4>
            <Space>
              {contractData && (
                <span style={{ fontSize: 12, color: '#666' }}>
                  更新时间: {new Date(contractData.lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                loading={loadingData}
                onClick={handleRefreshData}
                disabled={!form.getFieldValue('symbol')}
              >
                刷新
              </Button>
            </Space>
          </div>

          {contractData && (
            <Alert
              message={
                <Space>
                  <span>{contractData.symbol} 合约实时数据:</span>
                  <span style={{ fontWeight: 'bold' }}>
                    ${contractData.price.toFixed(6)}
                  </span>
                  <span style={{
                    color: contractData.change24h >= 0 ? '#52c41a' : '#ff4d4f',
                    fontWeight: 'bold'
                  }}>
                    {contractData.change24h >= 0 ? '+' : ''}{contractData.change24h.toFixed(2)}%
                  </span>
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
          
          <Form.Item
            label={
              <Space>
                当前价格
                {loadingData && <Spin size="small" />}
                {contractData && !loadingData && (
                  <Tooltip title="合约数据已自动获取">
                    <ThunderboltOutlined style={{ color: '#52c41a' }} />
                  </Tooltip>
                )}
              </Space>
            }
            name="currentPrice"
            rules={[{ required: true, message: '请输入当前价格' }]}
            validateStatus={getFieldError('currentPrice') ? 'error' : ''}
            help={getFieldError('currentPrice')}
          >
            <InputNumber
              placeholder="0.000000"
              style={{ width: '100%' }}
              step={0.000001}
              precision={6}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                4小时ATR
                <Tooltip title="4小时平均真实波幅，用于计算杠杆倍数">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
                {loadingData && <Spin size="small" />}
                {atrData && !loadingData && (
                  <Tooltip title={`数据已自动获取${atrData.exchanges?.['4h'] ? ` (来源: ${atrData.exchanges['4h']})` : ''}`}>
                    <ThunderboltOutlined style={{ color: '#52c41a' }} />
                  </Tooltip>
                )}
                {atrData?.exchanges?.['4h'] && !loadingData && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                    [{atrData.exchanges['4h']}]
                  </span>
                )}
                {atrData?.atr4h_max && !loadingData && (
                  <Tooltip title={`近3根K线最大值: ${atrData.atr4h_max.toFixed(6)} (用于保守计算)`}>
                    <span style={{
                      fontSize: '12px',
                      color: atrData.atr4h_max > atrData.atr4h ? '#ff7875' : '#52c41a',
                      marginLeft: '4px'
                    }}>
                      [Max: {atrData.atr4h_max.toFixed(6)}]
                    </span>
                  </Tooltip>
                )}
              </Space>
            }
            name="atr4h"
            rules={[{ required: true, message: '请输入4小时ATR' }]}
            validateStatus={getFieldError('atr4h') ? 'error' : ''}
            help={getFieldError('atr4h')}
          >
            <InputNumber
              placeholder="0.000000"
              style={{ width: '100%' }}
              step={0.000001}
              precision={6}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                15分钟ATR
                <Tooltip title="15分钟平均真实波幅，用于计算止损止盈">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
                {loadingData && <Spin size="small" />}
                {atrData && !loadingData && (
                  <Tooltip title={`数据已自动获取${atrData.exchanges?.['15m'] ? ` (来源: ${atrData.exchanges['15m']})` : ''}`}>
                    <ThunderboltOutlined style={{ color: '#52c41a' }} />
                  </Tooltip>
                )}
                {atrData?.exchanges?.['15m'] && !loadingData && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                    [{atrData.exchanges['15m']}]
                  </span>
                )}
                {atrData?.atr15m_max && !loadingData && (
                  <Tooltip title={`近3根K线最大值: ${atrData.atr15m_max.toFixed(6)} (用于保守计算)`}>
                    <span style={{
                      fontSize: '12px',
                      color: atrData.atr15m_max > atrData.atr15m ? '#ff7875' : '#52c41a',
                      marginLeft: '4px'
                    }}>
                      [Max: {atrData.atr15m_max.toFixed(6)}]
                    </span>
                  </Tooltip>
                )}
              </Space>
            }
            name="atr15m"
            rules={[{ required: true, message: '请输入15分钟ATR' }]}
            validateStatus={getFieldError('atr15m') ? 'error' : ''}
            help={getFieldError('atr15m')}
          >
            <InputNumber
              placeholder="0.000000"
              style={{ width: '100%' }}
              step={0.000001}
              precision={6}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                日线ATR
                <Tooltip title="日线平均真实波幅，可用于计算杠杆倍数（更保守）">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
                {loadingData && <Spin size="small" />}
                {atrData && !loadingData && (
                  <Tooltip title={`数据已自动获取${atrData.exchanges?.['1d'] ? ` (来源: ${atrData.exchanges['1d']})` : ''}`}>
                    <ThunderboltOutlined style={{ color: '#52c41a' }} />
                  </Tooltip>
                )}
                {atrData?.exchanges?.['1d'] && !loadingData && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                    [{atrData.exchanges['1d']}]
                  </span>
                )}
                {atrData?.atr1d_max && !loadingData && (
                  <Tooltip title={`近3根K线最大值: ${atrData.atr1d_max.toFixed(6)} (用于保守计算)`}>
                    <span style={{
                      fontSize: '12px',
                      color: atrData.atr1d_max > atrData.atr1d ? '#ff7875' : '#52c41a',
                      marginLeft: '4px'
                    }}>
                      [Max: {atrData.atr1d_max.toFixed(6)}]
                    </span>
                  </Tooltip>
                )}
              </Space>
            }
            name="atr1d"
            validateStatus={getFieldError('atr1d') ? 'error' : ''}
            help={getFieldError('atr1d')}
          >
            <InputNumber
              placeholder="0.000000"
              style={{ width: '100%' }}
              step={0.000001}
              precision={6}
              min={0}
            />
          </Form.Item>
        </div>

        {/* 高级选项 */}
        <Collapse
          ghost
        >
          <Panel 
            header={
              <Space>
                <SettingOutlined />
                高级选项
              </Space>
            } 
            key="advanced"
          >


            <Form.Item
              label="操作周期"
              name="operationCycle"
              initialValue="1分钟"
            >
              <Select>
                <Option value="1分钟">1分钟</Option>
                <Option value="5分钟">5分钟</Option>
                <Option value="15分钟">15分钟</Option>
                <Option value="1小时">1小时</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  杠杆计算ATR类型
                  <Tooltip title="选择用于计算杠杆倍数的ATR类型。4小时ATR适合短期交易，日线ATR更保守适合长期持仓。">
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  </Tooltip>
                </Space>
              }
              name="leverageAtrType"
              initialValue="4h"
            >
              <Select>
                <Option value="4h">4小时ATR（默认）</Option>
                <Option value="1d">日线ATR（保守）</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  ATR回看画幅
                  <Tooltip title="用于计算ATR最大值的K线数量，影响杠杆和止损止盈计算的保守程度。数值越大越保守。">
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  </Tooltip>
                </Space>
              }
              name="atrLookback"
              initialValue={3}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  min={1}
                  max={10}
                  step={1}
                  style={{ width: 'calc(100% - 40px)' }}
                  placeholder="回看K线数量"
                  addonAfter="个画幅"
                />
                <Tooltip title="重新获取ATR数据">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      const symbol = form.getFieldValue('symbol');
                      if (symbol) {
                        fetchContractData(symbol);
                      } else {
                        message.warning('请先选择币种');
                      }
                    }}
                    loading={loadingData}
                  />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
          </Panel>
        </Collapse>

        {/* 错误提示 */}
        {errors && errors.length > 0 && (
          <Alert
            message="输入验证失败"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {errors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            }
            type="error"
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 提交按钮 */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            size="large"
            block
            style={{ 
              height: 48,
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            生成交易策略
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default StrategyForm;
