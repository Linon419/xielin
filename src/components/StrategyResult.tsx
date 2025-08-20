import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Tabs,
  Steps,
  List,
  Tag,
  Progress,
  Space,
  Divider,
  Alert,
  Tooltip,
  Select
} from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { StrategyOutput } from '../types/strategy';
import SubscribeButton from './SubscribeButton';

const { TabPane } = Tabs;
const { Step } = Steps;
const { Option } = Select;

interface StrategyResultProps {
  strategy: StrategyOutput;
}

const StrategyResult: React.FC<StrategyResultProps> = ({ strategy }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAtrType, setSelectedAtrType] = useState<'4h' | '1d'>(strategy.leverageAtrType || '4h');
  const [filterBaseType, setFilterBaseType] = useState<'currentPrice' | 'schellingPoint'>('schellingPoint');

  // 动态计算杠杆倍数
  const calculateDynamicLeverage = (atrType: '4h' | '1d'): number => {
    let atr: number, atrMax: number | undefined;

    if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
      atr = strategy.atr1d;
      atrMax = strategy.atr1dMax;
    } else {
      atr = strategy.atr4h || 0;
      atrMax = strategy.atr4hMax;
    }

    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const currentPrice = strategy.currentPrice || 0;

    if (currentPrice > 0 && atrForCalculation > 0) {
      return Math.floor(currentPrice / atrForCalculation);
    }

    return strategy.basic?.recommendedLeverage || 0;
  };

  // 计算滤波区间
  const calculateFilterRange = (atrType: '4h' | '1d', baseType: 'currentPrice' | 'schellingPoint') => {
    let atr: number, atrMax: number | undefined;

    if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
      atr = strategy.atr1d;
      atrMax = strategy.atr1dMax;
    } else {
      atr = strategy.atr4h || 0;
      atrMax = strategy.atr4hMax;
    }

    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const basePrice = baseType === 'currentPrice' ? (strategy.currentPrice || 0) : (strategy.schellingPoint || 0);

    if (basePrice > 0 && atrForCalculation > 0) {
      return {
        lower: basePrice - atrForCalculation,
        upper: basePrice + atrForCalculation,
        basePrice,
        atr: atrForCalculation
      };
    }

    return null;
  };

  // 计算动态最小回调波幅
  const calculateDynamicMinRetracementAmplitude = (atrType: '4h' | '1d'): number => {
    let atr: number, atrMax: number | undefined;

    if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
      atr = strategy.atr1d;
      atrMax = strategy.atr1dMax;
    } else {
      atr = strategy.atr4h || 0;
      atrMax = strategy.atr4hMax;
    }

    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const currentPrice = strategy.currentPrice || 0;

    if (currentPrice > 0 && atrForCalculation > 0) {
      return atrForCalculation / currentPrice;
    }

    return strategy.basic?.minRetracementAmplitude || 0;
  };

  const dynamicLeverage = calculateDynamicLeverage(selectedAtrType);
  const filterRange = calculateFilterRange(selectedAtrType, filterBaseType);
  const dynamicMinRetracementAmplitude = calculateDynamicMinRetracementAmplitude(selectedAtrType);

  // 获取风险等级颜色
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'green';
      case 'medium': return 'orange';
      case 'high': return 'red';
      default: return 'blue';
    }
  };

  // 获取置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#52c41a';
    if (confidence >= 60) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div className="strategy-result">
      {/* 策略概览卡片 */}
      <Card className="strategy-overview-card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 20 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space align="center">
                <h2 style={{ margin: 0, fontSize: 20 }}>
                  {strategy.basic.strategyName}
                </h2>
                {strategy.symbol && (
                  <SubscribeButton
                    symbol={strategy.symbol}
                    size="small"
                    type="text"
                  />
                )}
              </Space>
            </Col>
            <Col>
              <Badge 
                color={getRiskColor(strategy.basic.riskLevel)} 
                text={`${strategy.basic.riskLevel === 'low' ? '低' : 
                       strategy.basic.riskLevel === 'medium' ? '中等' : '高'}风险`}
                style={{ fontSize: 14 }}
              />
            </Col>
          </Row>
        </div>

        {/* 关键指标 */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                value={selectedAtrType}
                size="small"
                style={{ width: '100%' }}
                onChange={(value: '4h' | '1d') => setSelectedAtrType(value)}
              >
                <Option value="4h">4小时ATR</Option>
                <Option value="1d">日线ATR（保守）</Option>
              </Select>

              <Tooltip
                title={
                  <div>
                    <div><strong>杠杆计算公式：</strong></div>
                    {(() => {
                      const atrTypeLabel = selectedAtrType === '1d' ? '日线' : '4小时';
                      let atr: number, atrMax: number | undefined;

                      if (selectedAtrType === '1d') {
                        atr = strategy.atr1d || 0;
                        atrMax = strategy.atr1dMax;
                      } else {
                        atr = strategy.atr4h || 0;
                        atrMax = strategy.atr4hMax;
                      }

                      const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
                      const baseMultiplier = strategy.currentPrice && atrForCalculation ?
                        strategy.currentPrice / atrForCalculation : 0;

                      return (
                        <>
                          <div>基础倍数 = 当前价格 ÷ {atrTypeLabel}ATR最大值</div>
                          <div>= {strategy.currentPrice?.toFixed(2)} ÷ {atrForCalculation.toFixed(6)}</div>
                          <div>= {baseMultiplier.toFixed(2)}</div>
                          <div style={{ marginTop: 8 }}>
                            <div>建议杠杆 = Math.floor(基础倍数)</div>
                            <div>= Math.floor({baseMultiplier.toFixed(2)})</div>
                            <div>= <strong>{dynamicLeverage}倍</strong></div>
                          </div>
                          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                            使用{atrTypeLabel}ATR计算杠杆
                          </div>
                        </>
                      );
                    })()}
                  </div>
                }
                placement="top"
              >
                <div style={{ cursor: 'help' }}>
                  <Statistic
                    title="推荐杠杆"
                    value={dynamicLeverage}
                    suffix="倍"
                    prefix={<RiseOutlined />}
                  />
                </div>
              </Tooltip>
            </Space>
          </Col>
          <Col xs={12} sm={6}>
            {strategy.operations.riskControl.atrInfo && (
              <Tooltip
                title={
                  <div>
                    <div>止盈百分比基于15分钟ATR最大值计算</div>
                    <div>反映币种的内在波动性特征</div>
                    <div>计算公式：15min最大ATR ÷ 当前价格 × 100%</div>
                    <div>= {strategy.operations.riskControl.atrInfo.atr15mMax.toFixed(6)} ÷ {strategy.currentPrice?.toFixed(2) || 'N/A'} × 100%</div>
                    <div>= <strong>{strategy.operations.riskControl.atrInfo.takeProfitPercent.toFixed(2)}%</strong></div>
                  </div>
                }
                placement="top"
              >
                <div style={{ cursor: 'help' }}>
                  <Statistic
                    title="止盈百分比"
                    value={strategy.operations.riskControl.atrInfo.takeProfitPercent.toFixed(2)}
                    suffix="%"
                    prefix={<RiseOutlined />}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </div>
              </Tooltip>
            )}
            {!strategy.operations.riskControl.atrInfo && (
              <Statistic
                title="止盈百分比"
                value="N/A"
                suffix="%"
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#999' }}
              />
            )}
          </Col>

          <Col xs={12} sm={6}>
            <Statistic
              title="风险回报比"
              value={strategy.basic.riskRewardRatio}
              prefix={<DollarOutlined />}
            />
          </Col>

          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>滤波区间基准：</span>
                <Select
                  value={filterBaseType}
                  size="small"
                  style={{ width: '120px' }}
                  onChange={(value: 'currentPrice' | 'schellingPoint') => setFilterBaseType(value)}
                >
                  <Option value="schellingPoint">谢林点</Option>
                  <Option value="currentPrice">当前价格</Option>
                </Select>
              </div>

              {filterRange && (
                <Tooltip
                  title={
                    <div>
                      <div><strong>滤波区间计算公式：</strong></div>
                      <div>基准价格 = {filterBaseType === 'currentPrice' ? '当前价格' : '谢林点'}</div>
                      <div>使用ATR = {selectedAtrType === '1d' ? '日线' : '4小时'}ATR最大值</div>
                      <div>下限 = {filterRange.basePrice.toFixed(6)} - {filterRange.atr.toFixed(6)}</div>
                      <div>上限 = {filterRange.basePrice.toFixed(6)} + {filterRange.atr.toFixed(6)}</div>
                      <div style={{ marginTop: 8 }}>
                        <div>滤波区间：<strong>{filterRange.lower.toFixed(6)} - {filterRange.upper.toFixed(6)}</strong></div>
                      </div>
                    </div>
                  }
                  placement="top"
                >
                  <div style={{ cursor: 'help', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      滤波区间 ({selectedAtrType === '1d' ? '日线' : '4小时'}ATR)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                      {filterRange.lower.toFixed(6)} - {filterRange.upper.toFixed(6)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                      基于{filterBaseType === 'currentPrice' ? '当前价格' : '谢林点'} ± ATR
                    </div>
                  </div>
                </Tooltip>
              )}

              {!filterRange && (
                <div style={{ padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#f5f5f5' }}>
                  <div style={{ fontSize: '12px', color: '#999' }}>滤波区间</div>
                  <div style={{ fontSize: '14px', color: '#999' }}>数据不可用</div>
                </div>
              )}
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Tooltip
              title={
                <div>
                  <div><strong>最小回调波幅计算公式：</strong></div>
                  <div>最小回调波幅 = ATR ÷ 当前价格</div>
                  <div>使用ATR = {selectedAtrType === '1d' ? '日线' : '4小时'}ATR最大值</div>
                  <div>= {(() => {
                    let atr: number, atrMax: number | undefined;
                    if (selectedAtrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
                      atr = strategy.atr1d;
                      atrMax = strategy.atr1dMax;
                    } else {
                      atr = strategy.atr4h || 0;
                      atrMax = strategy.atr4hMax;
                    }
                    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
                    const currentPrice = strategy.currentPrice || 0;
                    return `${atrForCalculation.toFixed(6)} ÷ ${currentPrice.toFixed(6)}`;
                  })()}</div>
                  <div style={{ marginTop: 8 }}>
                    <div>最小回调波幅：<strong>{(dynamicMinRetracementAmplitude * 100).toFixed(2)}%</strong></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    表示基于波动性的最小回调幅度，用于判断趋势回调的有效性
                  </div>
                </div>
              }
              placement="top"
            >
              <div style={{ cursor: 'help', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  最小回调波幅 ({selectedAtrType === '1d' ? '日线' : '4小时'}ATR)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#722ed1' }}>
                  {(dynamicMinRetracementAmplitude * 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                  ATR ÷ 当前价格
                </div>
              </div>
            </Tooltip>
          </Col>

          {strategy.high24h && (
            <Col xs={12} sm={6}>
              <Statistic
                title="24h最高价"
                value={strategy.high24h.toFixed(2)}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
          )}
          {strategy.low24h && (
            <Col xs={12} sm={6}>
              <Statistic
                title="24h最低价"
                value={strategy.low24h.toFixed(2)}
                prefix={<FallOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
          )}
        </Row>

        {/* 置信度和建议 */}
        <Divider />
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 8 }}>策略置信度:</span>
              <Progress 
                percent={strategy.basic.confidence} 
                size="small"
                strokeColor={getConfidenceColor(strategy.basic.confidence)}
                style={{ width: 120, display: 'inline-block' }}
              />
              <span style={{ marginLeft: 8, fontWeight: 'bold' }}>
                {strategy.basic.confidence}%
              </span>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <Alert
              message={strategy.analysis.recommendation}
              type={strategy.basic.confidence >= 70 ? 'success' : 
                    strategy.basic.confidence >= 50 ? 'warning' : 'error'}
              showIcon
              style={{ marginBottom: 0 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 详细信息标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
          {/* 操作指南 */}
          <TabPane tab="操作指南" key="operations">
            <Tabs defaultActiveKey="entry" type="card">
              <TabPane tab="开仓策略" key="entry">
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card size="small" title="开仓信息">
                      <Statistic
                        title="建议开仓价位"
                        value={strategy.operations.entry.price.toFixed(6)}
                        style={{ marginBottom: 16 }}
                      />
                      <p><strong>开仓时机:</strong> {strategy.operations.entry.timing}</p>
                      <p><strong>仓位规模:</strong> {strategy.operations.entry.positionSize}</p>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card size="small" title="开仓条件">
                      <List
                        size="small"
                        dataSource={strategy.operations.entry.conditions}
                        renderItem={(item, index) => (
                          <List.Item>
                            <Badge count={index + 1} size="small" />
                            <span style={{ marginLeft: 8 }}>{item}</span>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </TabPane>

              <TabPane tab="风险控制" key="risk">
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Statistic
                      title="止损价位"
                      value={strategy.operations.riskControl.stopLoss.toFixed(6)}
                      prefix={<FallOutlined />}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Col>
                  <Col xs={24} lg={8}>
                    <Statistic
                      title="止盈价位"
                      value={strategy.operations.riskControl.takeProfit.toFixed(6)}
                      prefix={<RiseOutlined />}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col xs={24} lg={8}>
                    <div>
                      <p style={{ margin: 0, color: '#666' }}>对冲策略</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>
                        {strategy.operations.riskControl.hedgeStrategy}
                      </p>
                    </div>
                  </Col>
                </Row>

                {/* ATR百分比信息 */}
                {strategy.operations.riskControl.atrInfo && (
                  <>
                    <Divider orientation="left">15分钟ATR止损止盈百分比</Divider>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} lg={6}>
                        <Statistic
                          title="当前15分钟ATR"
                          value={strategy.operations.riskControl.atrInfo.atr15m.toFixed(6)}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Col>
                      <Col xs={24} lg={6}>
                        <Statistic
                          title="使用ATR最大值"
                          value={strategy.operations.riskControl.atrInfo.atr15mMax.toFixed(6)}
                          valueStyle={{ color: '#fa8c16' }}
                          suffix={strategy.operations.riskControl.atrInfo.atr15mMax > strategy.operations.riskControl.atrInfo.atr15m ? ' (保守)' : ''}
                        />
                      </Col>
                      <Col xs={24} lg={6}>
                        <Statistic
                          title="止损百分比"
                          value={strategy.operations.riskControl.atrInfo.stopLossPercent.toFixed(2)}
                          suffix="%"
                          prefix={<FallOutlined />}
                          valueStyle={{ color: '#cf1322' }}
                        />
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          15min最大ATR({strategy.operations.riskControl.atrInfo.atr15mMax.toFixed(6)}) ÷ 价格 × {strategy.operations.riskControl.atrInfo.riskMultiplier}
                        </div>
                      </Col>
                    </Row>
                  </>
                )}

                <Divider />
                <h4>仓位管理建议:</h4>
                <List
                  dataSource={strategy.operations.riskControl.positionManagement}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta description={item} />
                    </List.Item>
                  )}
                />
              </TabPane>

              <TabPane tab="退出策略" key="exit">
                <h4>分批止盈目标:</h4>
                <Steps direction="vertical" size="small" current={-1}>
                  {strategy.operations.exit.profitTargets.map((target, index) => (
                    <Step
                      key={index}
                      title={`第${index + 1}目标: ${target.toFixed(6)}`}
                      description={`建议平仓${index === 0 ? '30%' : index === 1 ? '50%' : '剩余'}仓位`}
                    />
                  ))}
                </Steps>
                
                <Divider />
                <h4>退出条件:</h4>
                <List
                  dataSource={strategy.operations.exit.exitConditions}
                  renderItem={(item) => (
                    <List.Item>
                      <Tag color="blue">{item}</Tag>
                    </List.Item>
                  )}
                />

                {strategy.operations.exit.trailingStop.enabled && (
                  <>
                    <Divider />
                    <Alert
                      message="移动止损已启用"
                      description={`移动止损比例: ${strategy.operations.exit.trailingStop.percentage}%`}
                      type="info"
                      showIcon
                    />
                  </>
                )}
              </TabPane>
            </Tabs>
          </TabPane>

          {/* 分析预期 */}
          <TabPane tab="分析预期" key="analysis">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="历史成功率"
                  value={strategy.analysis.successRate}
                  suffix="%"
                  valueStyle={{ color: strategy.analysis.successRate >= 70 ? '#3f8600' : '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div>
                  <p style={{ margin: 0, color: '#666' }}>预期时间周期</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>
                    <ClockCircleOutlined style={{ marginRight: 8 }} />
                    {strategy.analysis.timeframe}
                  </p>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div>
                  <p style={{ margin: 0, color: '#666' }}>资金使用效率</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>
                    {strategy.analysis.capitalEfficiency}
                  </p>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div>
                  <p style={{ margin: 0, color: '#666' }}>距离目标</p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 20, 
                    fontWeight: 'bold',
                    color: Math.abs(strategy.analysis.distanceToTarget) <= 5 ? '#3f8600' : '#faad14'
                  }}>
                    {strategy.analysis.distanceToTarget > 0 ? '+' : ''}
                    {strategy.analysis.distanceToTarget.toFixed(1)}%
                  </p>
                </div>
              </Col>
            </Row>

            <Divider />
            <h4>适用市场条件:</h4>
            <Space wrap>
              {strategy.analysis.marketConditions.map((condition, index) => (
                <Tag key={index} color="geekblue">{condition}</Tag>
              ))}
            </Space>
          </TabPane>

          {/* 风险提示 */}
          <TabPane tab="风险提示" key="risks">
            <Alert
              message="最坏情况预估"
              description={strategy.risks.worstCase}
              type="error"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Card size="small" title="主要风险" style={{ marginBottom: 16 }}>
                  <List
                    size="small"
                    dataSource={strategy.risks.primaryRisks}
                    renderItem={(item) => (
                      <List.Item>
                        <FallOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                        {item}
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="风险缓解措施">
                  <List
                    size="small"
                    dataSource={strategy.risks.mitigation}
                    renderItem={(item) => (
                      <List.Item>
                        <RiseOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                        {item}
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default StrategyResult;
