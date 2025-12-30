import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError(null);
    setLoading(true);

    try {
      await login(values.username, values.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f9ff] relative overflow-hidden">
      {/* 装饰背景圆 - 左上角 */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      {/* 装饰背景圆 - 右下角 */}
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      
      {/* 渐变网格背景 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e0f2fe_1px,transparent_1px),linear-gradient(to_bottom,#e0f2fe_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md px-4 relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8 md:p-10">
          {/* Logo 区域 */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-blue-50 rounded-2xl p-4 shadow-sm"
            >
              <img
                src="/logo1.svg"
                alt="Ai Web Test Logo"
                className="w-full h-full object-contain"
              />
            </motion.div>
            
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold text-slate-900 mb-2 font-display">
                Ai Web Test
              </h1>
              <p className="text-slate-500 text-sm tracking-wide">
                企业级智能自动化测试平台
              </p>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setError(null)}
                  className="rounded-xl border-red-100 bg-red-50 text-red-600"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}
            size="large"
            className="space-y-4"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
              className="mb-4"
            >
              <Input
                prefix={<UserOutlined className="text-slate-400 mr-2" />}
                placeholder="用户名"
                className="h-12 bg-slate-50 border-slate-200 hover:bg-white focus:bg-white transition-all rounded-xl"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
              className="mb-6"
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                placeholder="密码"
                className="h-12 bg-slate-50 border-slate-200 hover:bg-white focus:bg-white transition-all rounded-xl"
              />
            </Form.Item>

            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-12 rounded-xl bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-500/30 text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? '登录中...' : '登 录'}
              </Button>
            </Form.Item>
          </Form>

          {/* 底部提示 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 pt-6 border-t border-slate-100"
          >
            <div className="bg-blue-50/50 rounded-xl p-4">
              <p className="text-slate-500 text-xs text-center mb-3 font-medium uppercase tracking-wider">
                体验账号
              </p>
              <div className="flex justify-center gap-8 text-sm">
                <div className="text-center">
                  <span className="text-slate-400 text-xs block mb-1">Username</span>
                  <code className="bg-white text-sky-600 px-2 py-1 rounded border border-blue-100 font-mono">admin</code>
                </div>
                <div className="text-center">
                  <span className="text-slate-400 text-xs block mb-1">Password</span>
                  <code className="bg-white text-sky-600 px-2 py-1 rounded border border-blue-100 font-mono">admin</code>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-400 text-xs">
            © {new Date().getFullYear()} Ai Web Test. Powered by AI & Automation
          </p>
        </div>
      </motion.div>
    </div>
  );
};
