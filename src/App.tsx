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
import './styles/globals.css';

function AppContent() {
  // 设置Toast实例
  useSetupToast();
  // 获取主题状态
  const { isDark } = useThemeContext();

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