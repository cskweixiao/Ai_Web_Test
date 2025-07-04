import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';

const executionTrendData = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i);
  return {
    date: format(date, 'MM-dd'),
    success: Math.floor(Math.random() * 20) + 80,
    failed: Math.floor(Math.random() * 15) + 5,
    total: 100
  };
});

const testCasePerformanceData = [
  { name: '用户登录流程', avgTime: 2.3, successRate: 95, runs: 150 },
  { name: '购物车功能', avgTime: 1.8, successRate: 88, runs: 120 },
  { name: '支付流程', avgTime: 4.2, successRate: 92, runs: 98 },
  { name: '用户注册', avgTime: 1.5, successRate: 96, runs: 85 },
  { name: '商品搜索', avgTime: 0.8, successRate: 90, runs: 200 },
];

const browserDistributionData = [
  { name: 'Chrome', value: 45, color: '#4285F4' },
  { name: 'Firefox', value: 25, color: '#FF7139' },
  { name: 'Safari', value: 20, color: '#00B4FF' },
  { name: 'Edge', value: 10, color: '#0078D4' },
];

const environmentStatsData = [
  { environment: 'Production', success: 94, failed: 6, total: 100 },
  { environment: 'Staging', success: 89, failed: 11, total: 100 },
  { environment: 'Development', success: 85, failed: 15, total: 100 },
];

export function Reports() {
  const [dateRange, setDateRange] = useState('30d');
  const [selectedEnvironment, setSelectedEnvironment] = useState('all');

  const totalRuns = executionTrendData.reduce((sum, day) => sum + day.total, 0);
  const totalSuccess = executionTrendData.reduce((sum, day) => sum + day.success, 0);
  const totalFailed = executionTrendData.reduce((sum, day) => sum + day.failed, 0);
  const avgSuccessRate = Math.round((totalSuccess / totalRuns) * 100);

  const avgExecutionTime = testCasePerformanceData.reduce((sum, test) => sum + test.avgTime, 0) / testCasePerformanceData.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">测试报告</h2>
          <p className="text-gray-600">分析测试执行趋势和性能指标</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="90d">最近90天</option>
          </select>
          <select
            value={selectedEnvironment}
            onChange={(e) => setSelectedEnvironment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">所有环境</option>
            <option value="production">生产环境</option>
            <option value="staging">预发环境</option>
            <option value="development">开发环境</option>
          </select>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            导出报告
          </motion.button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总执行次数</p>
              <p className="text-3xl font-bold text-gray-900">{totalRuns.toLocaleString()}</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                +15% 较上月
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">平均成功率</p>
              <p className="text-3xl font-bold text-gray-900">{avgSuccessRate}%</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <CheckCircle className="h-4 w-4 mr-1" />
                +2% 较上月
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">平均执行时间</p>
              <p className="text-3xl font-bold text-gray-900">{avgExecutionTime.toFixed(1)}分</p>
              <p className="text-sm text-red-600 flex items-center mt-1">
                <TrendingDown className="h-4 w-4 mr-1" />
                -5% 较上月
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">失败用例</p>
              <p className="text-3xl font-bold text-gray-900">{totalFailed.toLocaleString()}</p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingDown className="h-4 w-4 mr-1" />
                -12% 较上月
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">执行趋势分析</h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                成功
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
                失败
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={executionTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="success"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Browser Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">浏览器分布</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={browserDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {browserDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {browserDistributionData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="h-3 w-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Test Case Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">测试用例性能分析</h3>
          <div className="text-sm text-gray-600">按平均执行时间排序</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">测试用例</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">平均执行时间</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">成功率</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">执行次数</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">趋势</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {testCasePerformanceData.map((testCase, index) => (
                <motion.tr
                  key={testCase.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{testCase.name}</div>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-600">
                    {testCase.avgTime}分钟
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      testCase.successRate >= 95 ? 'bg-green-100 text-green-800' :
                      testCase.successRate >= 90 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {testCase.successRate}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-600">
                    {testCase.runs}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {Math.random() > 0.5 ? (
                      <TrendingUp className="h-4 w-4 text-green-500 inline" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500 inline" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Environment Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-6">环境统计</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={environmentStatsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="environment" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip />
            <Bar dataKey="success" fill="#10B981" name="成功" />
            <Bar dataKey="failed" fill="#EF4444" name="失败" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}