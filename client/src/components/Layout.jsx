import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Clock, 
  History, 
  Bot,
  Zap
} from 'lucide-react';
import LiveExecutionView from './LiveExecutionView';

export default function Layout({ children }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/schedules', icon: Clock, label: 'Schedules' },
    { path: '/history', icon: History, label: 'History' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">AI Automation</h1>
              <p className="text-xs text-gray-500">Web Testing Tool</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-primary-700 font-medium mb-1">
              <Zap className="w-4 h-4" />
              AI Powered
            </div>
            <p className="text-xs text-gray-600">
              Natural language test automation with intelligent step interpretation
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-8 overflow-auto">
          {children}
        </div>
      </main>

      {/* Live Execution View */}
      <LiveExecutionView />
    </div>
  );
}
