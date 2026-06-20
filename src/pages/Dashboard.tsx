import { useEffect, useState } from 'react'
import { Card, Row, Col, Progress, List, Tag, Empty, Spin } from 'antd'
import {
  RobotOutlined,
  CalendarOutlined,
  DollarOutlined,
  MedicineBoxOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Robot, TrainingSchedule, Bill } from '../types'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [robots, setRobots] = useState<Robot[]>([])
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [robotStats, setRobotStats] = useState<any>({})
  const [scheduleStats, setScheduleStats] = useState<any>({})
  const [billStats, setBillStats] = useState<any>({})

  const loadData = async () => {
    setLoading(true)
    try {
      const [r, s, b, rs, ss, bs] = await Promise.all([
        window.api.getRobots(),
        window.api.getSchedules({ date: dayjs().format('YYYY-MM-DD') }),
        window.api.getBills({
          startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().format('YYYY-MM-DD'),
        }),
        window.api.getRobotStats(),
        window.api.getScheduleStats(),
        window.api.getBillStats(),
      ])
      setRobots(r)
      setSchedules(s)
      setBills(b)
      setRobotStats(rs)
      setScheduleStats(ss)
      setBillStats(bs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const idleCount = robots.filter(r => r.status === 'idle').length
  const busyCount = robots.filter(r => r.status === 'busy').length
  const todayRevenue = billStats?.todayRevenue || 0
  const totalRevenue = billStats?.totalRevenue || 0

  const statusTag = (s: string) => {
    const map: Record<string, string> = {
      idle: 'tag-idle', busy: 'tag-busy',
      maintenance: 'tag-maintenance', offline: 'tag-offline',
    }
    const labelMap: Record<string, string> = {
      idle: '空闲', busy: '使用中', maintenance: '维护中', offline: '离线',
    }
    return <Tag className={map[s] || ''}>{labelMap[s] || s}</Tag>
  }

  const scheduleStatusTag = (s: string) => {
    const map: Record<string, string> = {
      pending: 'tag-pending', allocated: 'tag-allocated',
      in_progress: 'tag-in_progress', completed: 'tag-completed',
      cancelled: 'tag-cancelled',
    }
    const labelMap: Record<string, string> = {
      pending: '待分配', allocated: '已排期', in_progress: '训练中',
      completed: '已完成', cancelled: '已取消',
    }
    return <Tag className={map[s] || ''}>{labelMap[s] || s}</Tag>
  }

  if (loading) return <div style={{ padding: 100, textAlign: 'center' }}><Spin size="large" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">数据概览</div>
        <div className="page-subtitle">今日运营数据 · {dayjs().format('YYYY年MM月DD日 dddd')}</div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="label">机器人总数</div>
                <div className="value">{robots.length}</div>
                <div className="trend">
                  <ArrowUpOutlined /> 空闲 {idleCount} 台 · 占用 {busyCount} 台
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#e0f2fe', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <RobotOutlined style={{ fontSize: 24, color: '#0369a1' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="label">今日排期</div>
                <div className="value">{scheduleStats?.today || 0}</div>
                <div className="trend">
                  累计 {scheduleStats?.total || 0} 条排期记录
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#fef3c7', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <CalendarOutlined style={{ fontSize: 24, color: '#92400e' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="label">今日营收</div>
                <div className="value">¥{todayRevenue.toFixed(2)}</div>
                <div className="trend">
                  累计 ¥{totalRevenue.toFixed(2)}
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#dcfce7', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <DollarOutlined style={{ fontSize: 24, color: '#166534' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" bordered={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="label">医保核销</div>
                <div className="value">{billStats?.verified || 0}</div>
                <div className="trend">
                  待核销 {billStats?.unverified || 0} 笔
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#fce7f3', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MedicineBoxOutlined style={{ fontSize: 24, color: '#9d174d' }} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="机器人状态" bordered={false}>
            {robots.length === 0 ? (
              <Empty description="暂无机器人数据" />
            ) : (
              <List
                dataSource={robots.slice(0, 6)}
                renderItem={robot => (
                  <List.Item key={robot.id}>
                    <List.Item.Meta
                      title={
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>{robot.name}</span>
                          {statusTag(robot.status)}
                        </div>
                      }
                      description={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>
                            {robot.model} · {robot.location}
                          </span>
                          <Progress
                            percent={Math.min(100, (robot.dailyUsageMinutes / 480) * 100)}
                            size="small"
                            style={{ width: 120 }}
                            showInfo={false}
                          />
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="今日训练排期" bordered={false}>
            {schedules.length === 0 ? (
              <Empty description="今日暂无排期" />
            ) : (
              <List
                dataSource={schedules.slice(0, 6)}
                renderItem={sch => (
                  <List.Item key={sch.id}>
                    <List.Item.Meta
                      title={
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>{sch.patientName}</span>
                          {scheduleStatusTag(sch.status)}
                        </div>
                      }
                      description={
                        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                          <span>
                            {dayjs(sch.startTime).format('HH:mm')} - {dayjs(sch.endTime).format('HH:mm')}
                            {' · '}{sch.robotName || '未分配'}
                          </span>
                          <span>{sch.durationMinutes} 分钟</span>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
