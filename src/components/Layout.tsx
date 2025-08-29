import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  FileCode,
  Play,
  BarChart3,
  Settings,
  Bot,
  Menu,
  X,
  Factory,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: '仪表板', href: '/', icon: Home },
  { name: '测试用例', href: '/test-cases', icon: FileCode },
  { name: '测试执行', href: '/test-runs', icon: Play },
  { name: '测试报告', href: '/reports', icon: BarChart3 },
  { name: '测试工厂', href: '/test-factory', icon: Factory },
  { name: 'AI 助手', href: '/llm-assistant', icon: Bot },
  { name: '设置', href: '/settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPage = navigationItems.find(item => item.href === location.pathname);

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 flex w-72 flex-col bg-[var(--color-bg-primary)] shadow-lg border-r border-[var(--color-border)]"
            >
              <div className="flex h-20 items-center justify-between px-6 border-b border-[var(--color-border)]">
                <Logo size="md" showText={true} />
                <motion.button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              <nav className="flex-1 px-6 py-8 space-y-3">
                {navigationItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <NavLink
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={clsx(
                          'group flex items-center px-4 py-3 rounded-2xl text-base font-medium transition-all duration-300 relative overflow-hidden',
                          isActive
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                        )}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <motion.div
                            className="absolute inset-0 bg-purple-600 rounded-2xl"
                            layoutId="activeBackground"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        
                        <motion.div
                          className="relative flex items-center"
                          whileHover={{ x: 4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Icon className={clsx(
                            "mr-4 h-5 w-5 transition-transform group-hover:scale-110",
                            isActive ? "text-white" : "text-gray-500 dark:text-gray-400"
                          )} />
                          <span className="relative">{item.name}</span>
                        </motion.div>
                      </NavLink>
                    </motion.div>
                  );
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-bg-primary)] border-r border-[var(--color-border)]">
          <div className="flex h-20 items-center px-6 border-b border-gray-200/50 dark:border-gray-700/50">
            <Logo size="lg" showText={true} />
          </div>
          <nav className="flex-1 px-6 py-8 space-y-3">
            {navigationItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <NavLink
                    to={item.href}
                    className={clsx(
                      'group flex items-center px-4 py-3 rounded-2xl text-base font-medium transition-all duration-300 relative overflow-hidden',
                      isActive
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-purple-600 rounded-2xl"
                        layoutId="desktopActiveBackground"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <motion.div
                      className="relative flex items-center"
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Icon className={clsx(
                        "mr-4 h-5 w-5 transition-transform group-hover:scale-110",
                        isActive ? "text-white" : "text-gray-500 dark:text-gray-400"
                      )} />
                      <span className="relative">{item.name}</span>
                    </motion.div>
                  </NavLink>
                </motion.div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top navigation */}
        <motion.div 
          className="sticky top-0 z-40 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex h-20 items-center justify-between px-6 sm:px-8 lg:px-10">
            <div className="flex items-center">
              <motion.button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Menu className="h-5 w-5" />
              </motion.button>
              <div className="ml-4 lg:ml-0">
                <motion.h1 
                  className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentPage?.name || '系统自动化测试工具'}
                </motion.h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <motion.div 
                className="flex items-center space-x-2 px-3 py-2 rounded-full bg-green-50 dark:bg-green-900/30"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div 
                  className="h-2 w-2 bg-green-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                ></motion.div>
                <span className="text-sm font-medium text-green-700 dark:text-green-400">系统正常</span>
              </motion.div>
              <ThemeToggle size="md" />
              <motion.div 
                className="h-10 w-10 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded-full shadow-md cursor-pointer"
                whileHover={{ scale: 1.1, boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)' }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              ></motion.div>
            </div>
          </div>
        </motion.div>

        {/* Page content */}
        <motion.main 
          className="flex-1 p-6 sm:p-8 lg:p-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}