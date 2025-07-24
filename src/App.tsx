import React, { useState, useCallback } from 'react';
import { Layout, Row, Col, Typography, Space, Divider, BackTop, Tabs } from 'antd';
import { RocketOutlined, ThunderboltOutlined, MessageOutlined } from '@ant-design/icons';
import StrategyForm from './components/StrategyForm';
import StrategyResult from './components/StrategyResult';
import BatchStrategyForm from './components/BatchStrategyForm';
import BatchStrategyResult from './components/BatchStrategyResult';
import PriceChart from './components/PriceChart';
import ContractInfo from './components/ContractInfo';
import ApiStatusIndicator from './components/ApiStatusIndicator';
import UserMenu from './components/auth/UserMenu';
import MessageCenter from './components/messages/MessageCenter';
import { AuthProvider } from './contexts/AuthContext';
import { StrategyEngine } from './utils/strategyEngine';
import { StrategyInput, StrategyOutput, ValidationError } from './types/strategy';
import { contractDataService, ContractMarketData } from './services/contractDataService';
import './App.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

const App: React.FC = () => {
  const [strategy, setStrategy] = useState<StrategyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [currentInput, setCurrentInput] = useState<StrategyInput | null>(null);
  const [contractData, setContractData] = useState<ContractMarketData | null>(null);
  const [batchStrategies, setBatchStrategies] = useState<StrategyOutput[]>([]);
  const [activeTab, setActiveTab] = useState('single');
  const [contractLoading, setContractLoading] = useState(false);

  // 获取合约数据
  const fetchContractData = useCallback(async (symbol: string) => {
    if (!symbol) return;

    setContractLoading(true);
    try {
      const data = await contractDataService.getContractMarketData(symbol);
      setContractData(data);
    } catch (error) {
      console.error('获取合约数据失败:', error);
    } finally {
      setContractLoading(false);
    }
  }, []);

  // 处理策略生成
  const handleStrategyGenerate = useCallback(async (input: StrategyInput) => {
    setLoading(true);
    setErrors([]);
    setCurrentInput(input);

    // 同时获取合约数据
    fetchContractData(input.symbol);

    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      const strategyEngine = new StrategyEngine();
      const result = strategyEngine.generateStrategy(input);

      if (result.errors) {
        setErrors(result.errors);
        setStrategy(null);
      } else if (result.strategy) {
        setStrategy(result.strategy);
        setErrors([]);
      }
    } catch (error) {
      console.error('策略生成失败:', error);
      setErrors([{ field: 'general', message: '策略生成失败，请稍后重试' }]);
    } finally {
      setLoading(false);
    }
  }, [fetchContractData]);

  // 处理批量策略生成
  const handleBatchGenerate = useCallback((strategies: StrategyOutput[]) => {
    setBatchStrategies(strategies);
    setActiveTab('batch'); // 自动切换到批量结果标签页
  }, []);

  return (
    <AuthProvider>
      <Layout className="app-layout">
      {/* 头部 */}
      <Header className="app-header">
        <div className="header-content">
          <Space size="middle" align="center">
            <RocketOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0, color: 'white' }}>
              加密货币谢林点交易策略平台
            </Title>
          </Space>
          <div style={{ marginLeft: 'auto' }}>
            <Space size="middle">
              <ApiStatusIndicator />
              <UserMenu />
            </Space>
          </div>
        </div>
      </Header>

      {/* 主要内容 */}
      <Content className="app-content">
        <div className="content-wrapper">
          {/* 产品介绍 */}
          <div className="intro-section">
            <Row justify="center">
              <Col xs={24} lg={20} xl={16}>
                <div className="intro-content">
                  <Title level={2} style={{ textAlign: 'center', marginBottom: 16 }}>
                    基于谢林点理论的精准合约交易策略
                  </Title>
                  <Paragraph style={{ textAlign: 'center', fontSize: 16, color: '#666' }}>
                    专注于永续合约交易，为交易者提供精准的进场点位、风险控制和收益预期分析
                  </Paragraph>
                  
                  <Row gutter={[32, 16]} style={{ marginTop: 32 }}>
                    <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                      <RocketOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                      <h4>精准定位</h4>
                      <p style={{ color: '#666' }}>基于谢林点提供最佳交易时机</p>
                    </Col>
                    <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                      <ThunderboltOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
                      <h4>风险可控</h4>
                      <p style={{ color: '#666' }}>通过ATR计算将风险降到最低</p>
                    </Col>
                    <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                      <RocketOutlined style={{ fontSize: 32, color: '#722ed1', marginBottom: 8 }} />
                      <h4>策略系统化</h4>
                      <p style={{ color: '#666' }}>将复杂决策简化为标准流程</p>
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>
          </div>

          <Divider />

          {/* 主要功能区域 */}
          <div className="main-section">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'single',
                  label: (
                    <Space>
                      <RocketOutlined />
                      单个策略生成
                    </Space>
                  ),
                  children: (
                    <Row gutter={[24, 24]}>
                      {/* 左侧输入表单 */}
                      <Col xs={24} lg={8}>
                        <StrategyForm
                          onSubmit={handleStrategyGenerate}
                          loading={loading}
                          errors={errors}
                        />
                      </Col>

                      {/* 右侧结果展示 */}
                      <Col xs={24} lg={16}>
                        {/* 合约信息 */}
                        <ContractInfo
                          contractData={contractData}
                          loading={contractLoading}
                        />

                        {/* 价格图表 */}
                        {currentInput && <PriceChart input={currentInput} />}

                        {/* 策略结果 */}
                        {strategy ? (
                          <StrategyResult strategy={strategy} />
                        ) : (
                          <div className="placeholder-content">
                            <div style={{
                              textAlign: 'center',
                              padding: '80px 20px',
                              background: '#fafafa',
                              borderRadius: 8,
                              border: '2px dashed #d9d9d9'
                            }}>
                              <RocketOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                              <Title level={4} style={{ color: '#999' }}>
                                请填写左侧表单生成合约交易策略
                              </Title>
                              <Paragraph style={{ color: '#999' }}>
                                输入合约币种信息和技术指标，系统将为您生成专业的合约交易策略分析
                              </Paragraph>
                            </div>
                          </div>
                        )}
                      </Col>
                    </Row>
                  )
                },
                {
                  key: 'batch',
                  label: (
                    <Space>
                      <ThunderboltOutlined />
                      批量策略生成
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      <BatchStrategyForm
                        onBatchGenerate={handleBatchGenerate}
                        strategyEngine={new StrategyEngine()}
                      />
                      <BatchStrategyResult strategies={batchStrategies} />
                    </Space>
                  )
                },
                {
                  key: 'messages',
                  label: (
                    <Space>
                      <MessageOutlined />
                      消息中心
                    </Space>
                  ),
                  children: <MessageCenter />
                }
              ]}
            />
          </div>
        </div>
      </Content>

      {/* 底部 */}
      <Footer className="app-footer">
        <div style={{ textAlign: 'center' }}>
          <Paragraph style={{ margin: 0, color: '#666' }}>
            加密货币谢林点交易策略平台 © 2024 | 
            <span style={{ marginLeft: 8 }}>
              基于谢林点理论的智能交易策略生成系统
            </span>
          </Paragraph>
          <Paragraph style={{ margin: '8px 0 0 0', fontSize: 12, color: '#999' }}>
            风险提示：加密货币交易存在高风险，请谨慎投资并做好风险管理
          </Paragraph>
        </div>
      </Footer>

        {/* 回到顶部 */}
        <BackTop />
      </Layout>
    </AuthProvider>
  );
};

export default App;
