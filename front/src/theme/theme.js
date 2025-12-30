// 全局设计系统令牌
// 这是整个应用程序 UI 的单一真实来源

export const themeTokens = {
  colors: {
    // 主品牌色系 - 浅蓝色 (Sky Blue)
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',  // 主色 Sky 500
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    // 中性色系  
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db', 
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    // 功能色系
    success: '#10b981',
    warning: '#f59e0b', 
    error: '#ef4444',
    info: '#06b6d4',
    // 深色模式支持
    dark: {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b', 
      textPrimary: '#f1f5f9',
      border: '#334155',
    },
  },
  spacing: {
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px  
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
  },
  borderRadius: {
    none: '0',
    sm: '0.375rem',  // 6px
    md: '0.625rem',  // 10px (Chrome-like)
    lg: '0.875rem',  // 14px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    // 玻璃拟态效果
    glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px  
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
    },
    fontWeight: {
      thin: 100,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    lineHeight: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
  },
};

// Ant Design 主题配置
// 将我们的设计令牌映射到 Ant Design 的 theme.token 对象
export const antdThemeConfig = {
  token: {
    // 颜色系统 - 使用新的设计令牌
    colorPrimary: themeTokens.colors.primary[500],
    colorBgBase: themeTokens.colors.gray[50],
    colorBgContainer: '#ffffff',
    colorBgLayout: themeTokens.colors.gray[50],
    colorText: themeTokens.colors.gray[900],
    colorTextSecondary: themeTokens.colors.gray[600],
    colorTextTertiary: themeTokens.colors.gray[500],
    colorBorder: themeTokens.colors.gray[200],
    colorBorderSecondary: themeTokens.colors.gray[100],
    colorSuccess: themeTokens.colors.success,
    colorError: themeTokens.colors.error,
    colorWarning: themeTokens.colors.warning,
    colorInfo: themeTokens.colors.info,
    
    // 间距系统
    padding: 16,
    paddingXS: 4, 
    paddingSM: 8,
    paddingLG: 24,
    paddingXL: 32,
    
    // 边框圆角 - 更新为更现代的圆角
    borderRadius: 10, // md
    borderRadiusSM: 6, // sm
    borderRadiusLG: 14, // lg
    borderRadiusXS: 2,
    
    // 字体系统
    fontFamily: themeTokens.typography.fontFamily.sans.join(', '),
    fontSize: 14, // 默认字体大小调整为14px，更符合Chrome紧凑风格
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontWeightStrong: themeTokens.typography.fontWeight.semibold,
    
    // 阴影
    boxShadow: themeTokens.shadows.sm,
    boxShadowSecondary: themeTokens.shadows.md,
    boxShadowTertiary: themeTokens.shadows.lg,
  },
  components: {
    // 自定义组件样式
    Layout: {
      bodyBg: themeTokens.colors.gray[50],
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      headerHeight: 64,
      headerPadding: '0 24px',
    },
    Card: {
      boxShadowTertiary: themeTokens.shadows.lg,
      borderRadiusLG: 14,
      paddingLG: 24,
      headerBg: 'transparent',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: themeTokens.colors.primary[50],
      itemSelectedColor: themeTokens.colors.primary[600],
      itemHoverBg: themeTokens.colors.gray[50],
      itemActiveBg: themeTokens.colors.primary[50],
      borderRadius: 10,
    },
    Button: {
      borderRadius: 8, // 按钮保持稍微小一点的圆角
      controlHeight: 36, // 稍微减小高度，更紧凑
      paddingContentHorizontal: 16,
      fontWeight: themeTokens.typography.fontWeight.medium,
      colorPrimary: themeTokens.colors.primary[500],
      algorithm: true, // 启用算法生成悬停色
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
      paddingBlock: 8,
      paddingInline: 12,
      activeBorderColor: themeTokens.colors.primary[500],
      hoverBorderColor: themeTokens.colors.primary[400],
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Table: {
      borderRadiusLG: 14,
      headerBg: themeTokens.colors.gray[50],
      headerSplitColor: themeTokens.colors.gray[200],
      rowHoverBg: themeTokens.colors.primary[50], // 悬停行颜色
    },
    Tabs: {
      itemColor: themeTokens.colors.gray[500],
      itemSelectedColor: themeTokens.colors.primary[500],
      itemHoverColor: themeTokens.colors.primary[400],
      inkBarColor: themeTokens.colors.primary[500],
    },
  },
};
