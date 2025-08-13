import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TestCases } from './pages/TestCases';
import { TestRuns } from './pages/TestRuns';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { LLMAssistant } from './pages/LLMAssistant';
import { TestFactory } from './pages/TestFactory.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/toast';
import { useSetupToast } from './utils/toast';
import { antdThemeConfig } from './theme/theme';
import { ThemeProvider, useThemeContext, darkThemeConfig } from './hooks/useTheme.tsx';
import { testService } from './services/testService';
import './styles/globals.css';

function AppContent() {
  // 设置Toast实例
  useSetupToast();
  // 获取主题状态
  const { isDark } = useThemeContext();

  // 🚀 全局资源清理 - 修复getComputedStyle错误
  React.useEffect(() => {
    // 页面卸载时清理所有资源
    const handleBeforeUnload = () => {
      console.log('🧹 页面即将卸载，清理所有资源...');
      testService.destroy();
    };

    const handleUnload = () => {
      console.log('🧹 页面卸载，强制清理资源...');
      testService.destroy();
    };

    // 监听页面卸载事件
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // 组件卸载时清理
    return () => {
      console.log('🧹 App组件卸载，清理所有资源...');
      testService.destroy();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  return (
    <ConfigProvider theme={isDark ? darkThemeConfig : antdThemeConfig}>
      <Router>
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/test-cases" element={<TestCases />} />
              <Route path="/test-runs" element={
                <ErrorBoundary>
                  <TestRuns />
                </ErrorBoundary>
              } />
              <Route path="/reports" element={<Reports />} />
              <Route path="/llm-assistant" element={<LLMAssistant />} />
              <Route path="/test-factory" element={<TestFactory />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;