import React from 'react';
import { Row, Col, Segmented, Button, Space } from 'antd';
import { motion } from 'framer-motion';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BugOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { StatCard } from '../components/dashboard/StatCard';
import { ChartCard } from '../components/dashboard/ChartCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';

// 固定数据（后续对接后端时替换为接口 + 适配器）
const chartData = [
  { x: '周一', y: 92 },
  { x: '周二', y: 90 },
  { x: '周三', y: 94 },
  { x: '周四', y: 91 },
  { x: '周五', y: 95 },
  { x: '周六', y: 93 },
  { x: '周日', y: 96 },
];

const recentActivities = [
  { id: 1, description: '执行了登录流程测试', timestamp: '10分钟前', status: 'success' as const, user: '系统管理员' },
  { id: 2, description: '购物车功能测试执行失败', timestamp: '25分钟前', status: 'error' as const, user: '测试工程师' },
  { id: 3, description: '支付流程测试执行成功', timestamp: '1小时前', status: 'success' as const, user: '自动化脚本' },
  { id: 4, description: '用户注册测试通过验证', timestamp: '2小时前', status: 'success' as const, user: '质量保证团队' },
  { id: 5, description: '开始执行性能测试套件', timestamp: '3小时前', status: 'info' as const, user: '性能测试员' },
];

// 统一卡片底板（不侵入子组件）
const CardShell: React.FC<React.PropsWithChildren<{ hover?: boolean }>> = ({ children, hover = true }) => (
  <motion.div
    className="rounded-2xl border border-slate-200/80 bg-white/75 backdrop-blur-sm shadow-sm overflow-hidden"
    whileHover={hover ? { y: -6, boxShadow: '0 12px 30px rgba(15,23,42,0.08)' } : undefined}
    transition={{ duration: 0.2 }}
  >
    <div className="p-4 sm:p-5 lg:p-6">{children}</div>
  </motion.div>
);

export function Dashboard() {
  return (
    <motion.div
      className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* 顶部工具条（精简） */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">工作台</h1>
              <p className="mt-1 text-slate-600">轻量看板：KPI × 4 + 趋势 × 1 + 活动 × 1</p>
            </div>
            <div className="flex items-center gap-3">
              <Segmented options={['近7天', '近14天', '近30天']} defaultValue="近7天" size="middle" />
              <Space>
                <Button type="primary" icon={<PlusOutlined />}>新建测试</Button>
              </Space>
            </div>
          </div>
        </motion.div>

        {/* KPI 四宫格 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Row gutter={[24, 24]} className="mb-8">
            <Col xs={24} sm={12} lg={6}>
              <CardShell>
                <StatCard icon={<TrophyOutlined />} title="成功率" value="94.2" suffix="%" valueStyle={{ color: '#16a34a' }} />
              </CardShell>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <CardShell>
                <StatCard icon={<PlayCircleOutlined />} title="今日执行" value={64} suffix="次" valueStyle={{ color: '#1677ff' }} />
              </CardShell>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <CardShell>
                <StatCard icon={<ClockCircleOutlined />} title="平均执行时长" value="2.3" suffix="分钟" valueStyle={{ color: '#f59e0b' }} />
              </CardShell>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <CardShell>
                <StatCard icon={<BugOutlined />} title="本周失败" value={23} suffix="个" valueStyle={{ color: '#ef4444' }} />
              </CardShell>
            </Col>
          </Row>
        </motion.div>

        {/* 主趋势 + 最近活动 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Row gutter={[24, 24]} className="mb-8">
            <Col xs={24} lg={16}>
              <CardShell>
                <ChartCard title="近7天成功率趋势" chartData={chartData} height={380} chartType="area" />
              </CardShell>
            </Col>
            <Col xs={24} lg={8}>
              <CardShell>
                <RecentActivityCard title="最近活动" activities={recentActivities} maxItems={5} />
              </CardShell>
            </Col>
          </Row>
        </motion.div>

        {/* 适度留白：克制比堆砌更高级 */}
        <div className="h-2" />
      </div>
    </motion.div>
  );
}