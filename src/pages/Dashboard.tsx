import React from 'react';
import { Row, Col } from 'antd';
import { motion } from 'framer-motion';
import {
  FileTextOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TrophyOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { StatCard } from '../components/dashboard/StatCard';
import { ChartCard } from '../components/dashboard/ChartCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';

// 模拟数据
const chartData = [
  { x: '01-01', y: 85 },
  { x: '01-02', y: 90 },
  { x: '01-03', y: 82 },
  { x: '01-04', y: 88 },
  { x: '01-05', y: 92 },
  { x: '01-06', y: 89 },
  { x: '01-07', y: 94 },
];

const recentActivities = [
  {
    id: 1,
    description: '执行了登录流程测试',
    timestamp: '10分钟前',
    status: 'success' as const,
    user: '系统管理员',
  },
  {
    id: 2,
    description: '购物车功能测试执行失败',
    timestamp: '25分钟前',
    status: 'error' as const,
    user: '测试工程师',
  },
  {
    id: 3,
    description: '支付流程测试执行成功',
    timestamp: '1小时前',
    status: 'success' as const,
    user: '自动化脚本',
  },
  {
    id: 4,
    description: '用户注册测试通过验证',
    timestamp: '2小时前',
    status: 'success' as const,
    user: '质量保证团队',
  },
  {
    id: 5,
    description: '开始执行性能测试套件',
    timestamp: '3小时前',
    status: 'info' as const,
    user: '性能测试员',
  },
];

export function Dashboard() {
  return (
    <motion.div 
      className="min-h-screen bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* 统计卡片区域 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<FileTextOutlined />}
                title="总测试用例"
                value={248}
                prefix={<TrophyOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#262626' }}
              />
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<PlayCircleOutlined />}
                title="今日执行"
                value={64}
                suffix="次"
                valueStyle={{ color: '#52c41a' }}
              />
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<ClockCircleOutlined />}
                title="平均执行时间"
                value="2.3"
                suffix="分钟"
                valueStyle={{ color: '#faad14' }}
              />
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<UserOutlined />}
                title="活跃用户"
                value={12}
                suffix="人"
                valueStyle={{ color: '#1677ff' }}
              />
            </motion.div>
          </Col>
        </Row>
      </motion.div>

      {/* 图表区域 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} lg={16}>
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <ChartCard
                title="执行成功率趋势"
                chartData={chartData}
                height={450}
                chartType="area"
              />
            </motion.div>
          </Col>
          <Col xs={24} lg={8}>
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <RecentActivityCard
                title="最近活动"
                activities={recentActivities}
                maxItems={5}
              />
            </motion.div>
          </Col>
        </Row>
      </motion.div>

      {/* 错误统计区域 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<BugOutlined />}
                title="本周发现问题"
                value={23}
                suffix="个"
                valueStyle={{ color: '#f5222d' }}
              />
            </motion.div>
          </Col>
          <Col xs={24} sm={12}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StatCard
                icon={<TrophyOutlined />}
                title="成功率"
                value="94.2"
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            </motion.div>
          </Col>
        </Row>
      </motion.div>
    </motion.div>
  );
}