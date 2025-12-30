import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TestCases } from './pages/TestCases';
import { TestCaseDetail } from './pages/TestCaseDetail';
import { TestRuns } from './pages/TestRuns';
import { TestRunDetail } from './pages/TestRunDetail';
import { TestReports } from './pages/TestReports';
import Settings from './pages/Settings';
import CacheStats from './pages/CacheStats';
import { LLMAssistant } from './pages/LLMAssistant';
import { TestFactory } from './pages/TestFactory.tsx';
import { Login } from './pages/Login';
import { UserManagement } from './pages/UserManagement';
import { FunctionalTestCases } from './pages/FunctionalTestCases/index';
import { FunctionalTestCaseGenerator } from './pages/FunctionalTestCaseGenerator';
import { FunctionalTestCaseCreate } from './pages/FunctionalTestCaseCreate';
import { FunctionalTestCaseCreateSimple } from './pages/FunctionalTestCaseCreateSimple';
import { FunctionalTestCaseEdit } from './pages/FunctionalTestCaseEdit';
import { FunctionalTestCaseDetail } from './pages/FunctionalTestCaseDetail';
import { FunctionalTestCaseExecute } from './pages/FunctionalTestCaseExecute';
import { FunctionalTestCaseExecuteAlt } from './pages/FunctionalTestCaseExecuteAlt';
import { FunctionalTestPointEdit } from './pages/FunctionalTestPointEdit';
import SystemManagement from './pages/SystemManagement';
import KnowledgeManagement from './pages/KnowledgeManagement';
import RequirementDocs from './pages/RequirementDocs';
import { TestPlans } from './pages/TestPlans';
import { TestPlanForm } from './pages/TestPlanForm';
import { TestPlanDetail } from './pages/TestPlanDetail';
import { TestPlanAddCases } from './pages/TestPlanAddCases';
import { TestPlanExecute } from './pages/TestPlanExecute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/toast';
import { NotFoundPage, ServerErrorPage, ForbiddenPage } from './pages/ErrorPage';
import { useSetupToast } from './utils/toast';
import { ThemeProvider, useThemeContext } from './hooks/useTheme.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabProvider } from './contexts/TabContext';
import { testService } from './services/testService';
import './styles/globals.css';

// 浅色主题 - 浅蓝色风格 (Chrome 适配优化版)
const antdThemeConfig = {
  token: {
    // 颜色系统 - 使用更清新的浅蓝色 (Sky Blue)
    colorPrimary: '#0ea5e9', // Sky 500 - 保持良好的对比度
    colorPrimaryActive: '#0284c7', // Sky 600
    colorPrimaryHover: '#38bdf8', // Sky 400
    
    // 背景色 - 使用冷灰色系 (Slate) 配合蓝色
    colorBgBase: '#f8fafc', // Slate 50
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f1f5f9', // Slate 100
    
    // 文本色
    colorText: '#0f172a', // Slate 900
    colorTextSecondary: '#475569', // Slate 600
    colorTextTertiary: '#94a3b8', // Slate 400
    
    // 边框色
    colorBorder: '#e2e8f0', // Slate 200
    colorBorderSecondary: '#f1f5f9', // Slate 100
    
    // 功能色
    colorSuccess: '#10b981',
    colorError: '#ef4444',
    colorWarning: '#f59e0b',
    colorInfo: '#06b6d4',

    // 间距与布局 - 适配 Chrome 的舒适密度
    padding: 16,
    paddingXS: 8,
    paddingSM: 12,
    paddingLG: 24,
    paddingXL: 32,

    // 圆角 - 现代 Chrome 风格 (更圆润)
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 12,
    borderRadiusXS: 4,

    // 字体
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    fontSize: 14, // 保持 14px 以获得最佳信息密度
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontWeightStrong: 600,

    // 阴影 - 更柔和的阴影
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    boxShadowSecondary: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    boxShadowTertiary: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  components: {
    Layout: {
      bodyBg: '#f1f5f9',
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      headerHeight: 64,
      headerPadding: '0 24px',
    },
    Card: {
      boxShadowTertiary: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)', // 更轻的卡片阴影
      borderRadiusLG: 12,
      paddingLG: 24,
      headerBg: 'transparent',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#e0f2fe', // Sky 100
      itemSelectedColor: '#0284c7', // Sky 600
      itemHoverBg: '#f0f9ff', // Sky 50
      itemActiveBg: '#e0f2fe', // Sky 100
      borderRadius: 8,
      itemHeight: 40, // 稍微增加菜单项高度，便于点击
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36, // 36px 是 Chrome 比较标准的按钮高度
      controlHeightSM: 28,
      controlHeightLG: 44,
      paddingContentHorizontal: 16,
      fontWeight: 500,
      contentFontSize: 14,
      colorPrimary: '#0ea5e9',
      algorithm: true,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
      paddingBlock: 6,
      paddingInline: 12,
      activeBorderColor: '#0ea5e9',
      hoverBorderColor: '#38bdf8',
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Table: {
      borderRadiusLG: 12,
      headerBg: '#f8fafc',
      headerSplitColor: '#e2e8f0',
      rowHoverBg: '#f0f9ff', // Sky 50
      padding: 12, // 单元格内边距
    },
    Tabs: {
      itemColor: '#64748b', // Slate 500
      itemSelectedColor: '#0ea5e9', // Sky 500
      itemHoverColor: '#38bdf8', // Sky 400
      inkBarColor: '#0ea5e9', // Sky 500
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Modal: {
      borderRadiusLG: 16, // 模态框更圆润
    }
  },
};

// 深色主题
const darkThemeConfig = {
  token: {
    colorBgBase: '#0f172a',
    colorBgContainer: '#1e293b',
    colorBgLayout: '#0f172a',
    colorText: '#f1f5f9',
    colorTextSecondary: '#cbd5e1',
    colorTextTertiary: '#94a3b8',
    colorBorder: '#334155',
    colorBorderSecondary: '#475569',
    colorPrimary: '#38bdf8', // Sky 400 (在深色模式下使用稍亮的蓝色)
    colorSuccess: '#10b981',
    colorError: '#ef4444',
    colorWarning: '#f59e0b',
    colorInfo: '#06b6d4',
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif",
    borderRadius: 10,
    borderRadiusSM: 6,
    borderRadiusLG: 14,
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.25)',
    boxShadowSecondary:
      '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2)',
    boxShadowTertiary:
      '0 10px 15px -3px rgba(0,0,0,0.35), 0 4px 6px -2px rgba(0,0,0,0.25)',
  },
  components: {
    Layout: {
      bodyBg: '#0f172a',
      headerBg: '#1e293b',
      siderBg: '#1e293b',
    },
    Card: {
      colorBgContainer: '#1e293b',
      colorBorderSecondary: '#334155',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(14, 165, 233, 0.15)', // Sky with opacity
      itemHoverBg: 'rgba(148, 163, 184, 0.1)',
      colorText: '#f1f5f9',
      itemSelectedColor: '#38bdf8', // Sky 400
    },
    Button: {
      colorText: '#f1f5f9',
      colorBgContainer: '#334155',
      colorBorder: '#475569',
      controlHeight: 36,
    },
    Input: {
      colorBgContainer: '#334155',
      colorBorder: '#475569',
      colorText: '#f1f5f9',
      controlHeight: 36,
    },
    Select: {
      controlHeight: 36,
    },
    Table: {
      rowHoverBg: 'rgba(14, 165, 233, 0.1)',
    }
  },
};

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Spin size="large" />
        <div className="mt-4 text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Admin Only Route component - 只有超级管理员才能访问
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Spin size="large" />
        <div className="mt-4 text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

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
        <Routes>
          {/* 登录页面 - 不需要认证 */}
          <Route path="/login" element={<Login />} />

          {/* 受保护的路由 - 需要认证 */}
          <Route path="/*" element={
            <ProtectedRoute>
              <TabProvider>
                <Layout>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />

                      {/* 测试用例路由 */}
                      <Route path="/test-cases" element={<TestCases />} />
                      <Route path="/test-cases/new" element={<TestCaseDetail />} />
                      <Route path="/test-cases/:id/edit" element={<TestCaseDetail />} />

                      {/* 功能测试用例路由 */}
                      <Route path="/functional-test-cases" element={<FunctionalTestCases />} />
                      <Route path="/functional-test-cases/generator" element={<FunctionalTestCaseGenerator />} />
                      <Route path="/functional-test-cases/create" element={<FunctionalTestCaseCreateSimple />} />
                      <Route path="/functional-test-cases/create-simple" element={<FunctionalTestCaseCreate />} />
                      <Route path="/functional-test-cases/:id/edit" element={<FunctionalTestCaseEdit />} />
                      <Route path="/functional-test-cases/:id/detail" element={<FunctionalTestCaseDetail />} />
                      <Route path="/functional-test-cases/:id/execute" element={<FunctionalTestCaseExecute />} />
                      <Route path="/functional-test-cases/:id/execute-alt" element={<FunctionalTestCaseExecuteAlt />} />
                      <Route path="/functional-test-cases/test-points/:testPointId/edit" element={<FunctionalTestPointEdit />} />

                      {/* 测试执行路由 */}
                      <Route path="/test-runs" element={
                        <ErrorBoundary>
                          <TestRuns />
                        </ErrorBoundary>
                      } />
                      <Route path="/test-runs/:id/detail" element={<TestRunDetail />} />

                      {/* 测试计划路由 */}
                      <Route path="/test-plans" element={<TestPlans />} />
                      <Route path="/test-plans/create" element={<TestPlanForm />} />
                      <Route path="/test-plans/:id" element={<TestPlanDetail />} />
                      <Route path="/test-plans/:id/edit" element={<TestPlanForm />} />
                      <Route path="/test-plans/:id/add-cases" element={<TestPlanAddCases />} />
                      <Route path="/test-plans/:id/execute" element={<TestPlanExecute />} />

                      <Route path="/reports" element={<TestReports />} />
                      <Route path="/llm-assistant" element={<LLMAssistant />} />
                      <Route path="/test-factory" element={<TestFactory />} />

                      {/* 系统字典管理 */}
                      <Route path="/systems" element={<SystemManagement />} />

                      {/* 知识库管理 */}
                      <Route path="/knowledge" element={<KnowledgeManagement />} />

                      {/* 需求文档管理 */}
                      <Route path="/requirement-docs" element={<RequirementDocs />} />

                      {/* 用户管理 - 仅超级管理员可访问 */}
                      <Route path="/user-management" element={
                        <AdminRoute>
                          <UserManagement />
                        </AdminRoute>
                      } />

                      <Route path="/settings" element={<Settings />} />
                      <Route path="/cache-stats" element={<CacheStats />} />

                      {/* 错误页面 */}
                      <Route path="/error/403" element={<ForbiddenPage />} />
                      <Route path="/error/500" element={<ServerErrorPage />} />

                      {/* 404 页面 - 必须放在最后 */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </ErrorBoundary>
                </Layout>
              </TabProvider>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
