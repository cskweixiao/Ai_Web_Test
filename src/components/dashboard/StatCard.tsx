import React from 'react';
import { Statistic } from 'antd';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  title: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
  loading?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  value,
  title,
  prefix,
  suffix,
  valueStyle,
  loading = false,
  trend,
}) => {
  // 根据标题确定主题色
  const getThemeColor = (title: string) => {
    if (title.includes('成功率')) {
      return {
        gradient: 'from-emerald-500 to-teal-500',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        lightBg: 'bg-gradient-to-br from-emerald-50/50 to-teal-50/30',
      };
    } else if (title.includes('今日执行') || title.includes('执行')) {
      return {
        gradient: 'from-sky-500 to-blue-500',
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
        lightBg: 'bg-gradient-to-br from-sky-50/50 to-blue-50/30',
      };
    } else if (title.includes('时长') || title.includes('平均')) {
      return {
        gradient: 'from-amber-500 to-orange-500',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        lightBg: 'bg-gradient-to-br from-amber-50/50 to-orange-50/30',
      };
    } else if (title.includes('失败')) {
      return {
        gradient: 'from-rose-500 to-red-500',
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        lightBg: 'bg-gradient-to-br from-rose-50/50 to-red-50/30',
      };
    }
    return {
      gradient: 'from-slate-500 to-gray-500',
      iconBg: 'bg-slate-50',
      iconColor: 'text-slate-600',
      lightBg: 'bg-gradient-to-br from-slate-50/50 to-gray-50/30',
    };
  };

  const theme = getThemeColor(title);

  if (loading) {
    return (
      <div className="h-full min-h-[160px] bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 animate-pulse">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-slate-100 rounded"></div>
            <div className="h-8 w-24 bg-slate-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="h-full"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className={`relative h-full min-h-[160px] rounded-2xl border border-slate-100 ${theme.lightBg} backdrop-blur-sm overflow-hidden group hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300`}>
        {/* 装饰性渐变条 */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient}`}></div>
        
        <div className="relative p-6 flex flex-col justify-between h-full">
          {/* 图标和标题 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-slate-500 text-sm font-medium mb-1">
                {title}
              </p>
              
              {/* 趋势指示器（可选） */}
              {trend && (
                <div className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                  trend.isPositive 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-rose-700 bg-rose-50'
                }`}>
                  <span>{trend.isPositive ? '↑' : '↓'}</span>
                  <span className="ml-1">{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>
            
            {/* 图标容器 */}
            <motion.div
              className={`${theme.iconBg} rounded-xl p-3 ${theme.iconColor} group-hover:scale-110 transition-transform duration-300`}
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-2xl leading-none flex items-center justify-center">
                {icon}
              </div>
            </motion.div>
          </div>

          {/* 数值显示 */}
          <div>
            <Statistic
              value={value}
              prefix={prefix}
              suffix={suffix}
              valueStyle={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#0f172a', // Slate 900
                lineHeight: 1,
                ...valueStyle,
              }}
              className="stat-value"
            />
          </div>
        </div>

        {/* 背景装饰圆 */}
        <div className={`absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br ${theme.gradient} opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity duration-300`}></div>
      </div>
    </motion.div>
  );
};
