import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// 主题上下文类型
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}

// 主题上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 深色模式主题配置
export const darkThemeConfig = {
  token: {
    // 深色模式颜色系统
    colorBgBase: '#0f172a',
    colorBgContainer: '#1e293b',
    colorBgLayout: '#0f172a',
    colorText: '#f1f5f9',
    colorTextSecondary: '#cbd5e1',
    colorTextTertiary: '#94a3b8',
    colorBorder: '#334155',
    colorBorderSecondary: '#475569',
    colorPrimary: '#3b82f6',
    colorSuccess: '#10b981',
    colorError: '#ef4444',
    colorWarning: '#f59e0b',
    colorInfo: '#06b6d4',
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
      itemSelectedBg: 'rgba(59, 130, 246, 0.1)',
      itemHoverBg: 'rgba(148, 163, 184, 0.1)',
      colorText: '#f1f5f9',
    },
    Button: {
      colorText: '#f1f5f9',
      colorBgContainer: '#334155',
      colorBorder: '#475569',
    },
    Input: {
      colorBgContainer: '#334155',
      colorBorder: '#475569',
      colorText: '#f1f5f9',
    },
  },
};

// 主题 Hook
export function useTheme(): ThemeContextType {
  const [isDark, setIsDark] = useState(() => {
    // 从 localStorage 读取用户偏好
    const saved = localStorage.getItem('theme-mode');
    if (saved) {
      return saved === 'dark';
    }
    // 检查系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // 保存到 localStorage
    localStorage.setItem('theme-mode', isDark ? 'dark' : 'light');
    
    // 设置 HTML 类名用于 CSS 变量
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return {
    isDark,
    toggleTheme,
    theme: isDark ? 'dark' : 'light',
  };
}

// 主题提供者组件
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeValue = useTheme();
  
  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// 使用主题上下文的 Hook
export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}