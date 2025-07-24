/**
 * 错误边界组件 - 捕获和处理React错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Card, Typography, Collapse, Alert } from 'antd';
import { 
  BugOutlined, 
  ReloadOutlined, 
  HomeOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary捕获到错误:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // 调用外部错误处理函数
    this.props.onError?.(error, errorInfo);

    // 发送错误报告到服务器（可选）
    this.reportError(error, errorInfo);
  }

  reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // 这里可以发送错误报告到服务器
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorId: this.state.errorId
      };

      console.log('错误报告:', errorReport);
      
      // 实际项目中可以发送到错误监控服务
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // });
      
    } catch (reportError) {
      console.error('发送错误报告失败:', reportError);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div style={{ padding: '20px', minHeight: '400px' }}>
          <Result
            status="error"
            icon={<BugOutlined />}
            title="页面出现错误"
            subTitle="抱歉，页面遇到了一些问题。您可以尝试刷新页面或返回首页。"
            extra={[
              <Button 
                type="primary" 
                key="retry" 
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                重试
              </Button>,
              <Button 
                key="reload" 
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
              >
                刷新页面
              </Button>,
              <Button 
                key="home" 
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
              >
                返回首页
              </Button>
            ]}
          />

          {/* 错误详情（开发环境显示） */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Card 
              title={
                <span>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  错误详情 (开发模式)
                </span>
              }
              style={{ marginTop: 20 }}
            >
              <Alert
                message="错误ID"
                description={this.state.errorId}
                type="info"
                style={{ marginBottom: 16 }}
              />

              <Collapse>
                <Panel header="错误信息" key="error">
                  <Paragraph>
                    <Text strong>错误类型:</Text> {this.state.error.name}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>错误消息:</Text> {this.state.error.message}
                  </Paragraph>
                  {this.state.error.stack && (
                    <Paragraph>
                      <Text strong>错误堆栈:</Text>
                      <pre style={{ 
                        background: '#f5f5f5', 
                        padding: '10px', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px'
                      }}>
                        {this.state.error.stack}
                      </pre>
                    </Paragraph>
                  )}
                </Panel>

                {this.state.errorInfo && (
                  <Panel header="组件堆栈" key="componentStack">
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: '10px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Panel>
                )}
              </Collapse>
            </Card>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// 高阶组件版本
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook版本（用于函数组件内部错误处理）
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error('组件错误:', error, errorInfo);
    
    // 这里可以添加错误上报逻辑
    // reportError(error, errorInfo);
  }, []);

  return handleError;
};

export default ErrorBoundary;
