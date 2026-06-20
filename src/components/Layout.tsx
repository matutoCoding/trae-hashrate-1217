import { useState } from 'react'
import { Layout, Menu, theme } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  RobotOutlined,
  CalendarOutlined,
  DollarOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/robots', icon: <RobotOutlined />, label: '康复机器人' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '训练排期' },
  { key: '/billing', icon: <DollarOutlined />, label: '计费规则' },
  { key: '/bills', icon: <FileTextOutlined />, label: '账单管理' },
  { key: '/insurance', icon: <MedicineBoxOutlined />, label: '医保项目' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const selectedKey = menuItems.find(item => {
    if (item.key === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.key)
  })?.key || '/'

  return (
    <>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={220}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            fontWeight: 700,
            fontSize: collapsed ? 16 : 18,
            color: '#1677ff',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {collapsed ? '康' : '康复机器人系统'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
            {menuItems.find(m => m.key === selectedKey)?.label as string}
          </div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>
            康复训练管理中心
          </div>
        </Header>
        <Content
          style={{
            margin: 0,
            padding: 0,
            minHeight: 280,
            background: '#f5f7fa',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </>
  )
}
