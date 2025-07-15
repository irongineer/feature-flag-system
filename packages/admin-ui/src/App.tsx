import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { ProLayout } from '@ant-design/pro-components';
import { 
  FlagOutlined, 
  DashboardOutlined, 
  SettingOutlined,
  AuditOutlined,
  UserOutlined 
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import FlagList from './pages/FlagList';
import FlagDetail from './pages/FlagDetail';
import TenantSettings from './pages/TenantSettings';
import AuditLogs from './pages/AuditLogs';
import KillSwitch from './pages/KillSwitch';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const menuData = [
  {
    path: '/',
    name: 'ダッシュボード',
    icon: <DashboardOutlined />,
  },
  {
    path: '/flags',
    name: 'フラグ管理',
    icon: <FlagOutlined />,
    children: [
      {
        path: '/flags/list',
        name: 'フラグ一覧',
      },
      {
        path: '/flags/kill-switch',
        name: 'Kill-Switch',
      },
    ],
  },
  {
    path: '/tenants',
    name: 'テナント設定',
    icon: <UserOutlined />,
  },
  {
    path: '/audit',
    name: '監査ログ',
    icon: <AuditOutlined />,
  },
  {
    path: '/settings',
    name: '設定',
    icon: <SettingOutlined />,
  },
];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Router>
          <ProLayout
            title="Feature Flag Admin"
            logo="https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg"
            layout="side"
            navTheme="light"
            fixSiderbar
            fixedHeader
            menu={{
              type: 'group',
            }}
            route={{
              routes: menuData,
            }}
            data-testid="navigation"
            menuItemRender={(item, dom) => (
              <a
                onClick={() => {
                  window.history.pushState(null, '', item.path);
                  window.location.pathname = item.path || '/';
                }}
              >
                {dom}
              </a>
            )}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flags/list" element={<FlagList />} />
              <Route path="/flags/:id" element={<FlagDetail />} />
              <Route path="/flags/kill-switch" element={<KillSwitch />} />
              <Route path="/tenants" element={<TenantSettings />} />
              <Route path="/audit" element={<AuditLogs />} />
            </Routes>
          </ProLayout>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
