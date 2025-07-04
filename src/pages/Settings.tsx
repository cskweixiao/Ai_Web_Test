import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Bell,
  Database,
  Globe,
  Key,
  Save,
  TestTube,
  Server,
  Webhook,
  Mail,
  Smartphone
} from 'lucide-react';

interface SettingsSection {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'general',
    name: '常规设置',
    icon: SettingsIcon,
    description: '基本系统配置'
  },
  {
    id: 'users',
    name: '用户管理',
    icon: Users,
    description: '管理用户账户和权限'
  },
  {
    id: 'security',
    name: '安全配置',
    icon: Shield,
    description: '安全策略和认证设置'
  },
  {
    id: 'notifications',
    name: '通知设置',
    icon: Bell,
    description: '配置通知规则和渠道'
  },
  {
    id: 'database',
    name: '数据库配置',
    icon: Database,
    description: '数据存储和备份设置'
  },
  {
    id: 'integrations',
    name: '集成配置',
    icon: Globe,
    description: 'CI/CD 和第三方服务集成'
  }
];

export function Settings() {
  const [activeSection, setActiveSection] = useState('general');

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">系统设置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              系统名称
            </label>
            <input
              type="text"
              defaultValue="TestFlow 自动化测试平台"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              默认超时时间 (秒)
            </label>
            <input
              type="number"
              defaultValue="300"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最大并发数
            </label>
            <input
              type="number"
              defaultValue="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              日志保留天数
            </label>
            <input
              type="number"
              defaultValue="90"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">LLM 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LLM 提供商
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="openai">OpenAI GPT-4</option>
              <option value="azure">Azure OpenAI</option>
              <option value="local">本地 Llama 3</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API 密钥
            </label>
            <input
              type="password"
              placeholder="输入 API 密钥"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模型版本
            </label>
            <input
              type="text"
              defaultValue="gpt-4o"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">用户列表</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          添加用户
        </button>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                用户
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                角色
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最后登录
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[
              { name: '张三', email: 'zhang@example.com', role: '管理员', status: '活跃', lastLogin: '2小时前' },
              { name: '李四', email: 'li@example.com', role: '测试工程师', status: '活跃', lastLogin: '1天前' },
              { name: '王五', email: 'wang@example.com', role: '开发工程师', status: '不活跃', lastLogin: '7天前' },
            ].map((user, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.status === '活跃' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-4">编辑</button>
                  <button className="text-red-600 hover:text-red-900">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">CI/CD 集成</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { name: 'GitHub Actions', icon: Globe, status: '已连接', color: 'green' },
            { name: 'GitLab CI', icon: Globe, status: '未连接', color: 'gray' },
            { name: 'Jenkins', icon: Server, status: '已连接', color: 'green' },
            { name: 'Azure DevOps', icon: Globe, status: '未连接', color: 'gray' },
          ].map((integration, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <integration.icon className="h-8 w-8 text-gray-600" />
                  <div>
                    <h4 className="font-medium text-gray-900">{integration.name}</h4>
                    <span className={`text-sm ${
                      integration.color === 'green' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {integration.status}
                    </span>
                  </div>
                </div>
                <button className={`px-3 py-1 rounded text-sm ${
                  integration.color === 'green'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {integration.color === 'green' ? '管理' : '连接'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              placeholder="https://your-webhook-url.com/endpoint"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密钥
            </label>
            <input
              type="password"
              placeholder="输入 Webhook 密钥"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              触发事件
            </label>
            <div className="space-y-2">
              {[
                { id: 'test_started', label: '测试开始' },
                { id: 'test_completed', label: '测试完成' },
                { id: 'test_failed', label: '测试失败' },
                { id: 'test_timeout', label: '测试超时' },
              ].map((event) => (
                <label key={event.id} className="flex items-center">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">通知渠道</h3>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Mail className="h-6 w-6 text-blue-600" />
                <div>
                  <h4 className="font-medium text-gray-900">邮件通知</h4>
                  <p className="text-sm text-gray-500">通过邮件发送测试结果</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="ml-9 space-y-3">
              <input
                type="email"
                placeholder="admin@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Smartphone className="h-6 w-6 text-green-600" />
                <div>
                  <h4 className="font-medium text-gray-900">短信通知</h4>
                  <p className="text-sm text-gray-500">关键失败时发送短信</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Webhook className="h-6 w-6 text-purple-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Slack 集成</h4>
                  <p className="text-sm text-gray-500">发送通知到 Slack 频道</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="ml-9 space-y-3">
              <input
                type="text"
                placeholder="Slack Webhook URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">通知规则</h3>
        <div className="space-y-3">
          {[
            { label: '测试套件完成时通知', checked: true },
            { label: '测试失败时立即通知', checked: true },
            { label: '每日执行摘要', checked: true },
            { label: '性能异常警报', checked: false },
            { label: '新用户注册通知', checked: false },
          ].map((rule, index) => (
            <label key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{rule.label}</span>
              <input
                type="checkbox"
                defaultChecked={rule.checked}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'users':
        return renderUserManagement();
      case 'integrations':
        return renderIntegrations();
      case 'notifications':
        return renderNotifications();
      default:
        return (
          <div className="text-center py-12">
            <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">该功能正在开发中...</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
        <p className="text-gray-600">配置系统参数和集成设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            <nav className="space-y-1">
              {settingsSections.map((section) => {
                const Icon = section.icon;
                return (
                  <motion.button
                    key={section.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div>{section.name}</div>
                      <div className="text-xs text-gray-500 font-normal">
                        {section.description}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderSectionContent()}
              </motion.div>
            </AnimatePresence>

            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-end space-x-3">
                <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  重置
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="h-5 w-5 mr-2" />
                  保存设置
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}