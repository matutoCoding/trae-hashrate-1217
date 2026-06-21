import { useEffect, useState, useMemo } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, DatePicker,
  InputNumber, Space, Popconfirm, App, Card, Row, Col, Tooltip,
  Empty, Alert,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type {
  TrainingSchedule, ScheduleCreate, ScheduleQuery,
  ScheduleStatus, InsuranceItem, AllocationResult,
} from '../types'

const statusOptions: { label: string; value: ScheduleStatus }[] = [
  { label: '待分配', value: 'pending' },
  { label: '已排期', value: 'allocated' },
  { label: '训练中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

export default function SchedulePage() {
  const { message, modal } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([])
  const [insurance, setInsurance] = useState<InsuranceItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingSchedule | null>(null)
  const [form] = Form.useForm()
  const [filterDate, setFilterDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'))
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | undefined>()
  const [patientSearch, setPatientSearch] = useState('')
  const [allocationPreview, setAllocationPreview] = useState<AllocationResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const query: ScheduleQuery = {}
      if (filterDate) query.date = filterDate
      if (filterStatus) query.status = filterStatus
      if (patientSearch) query.patientName = patientSearch
      const [list, ins] = await Promise.all([
        window.api.getSchedules(query),
        window.api.getInsuranceItems(),
      ])
      setSchedules(list)
      setInsurance(ins.filter(i => i.isActive))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filterDate, filterStatus, patientSearch])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data: ScheduleCreate = {
        patientName: values.patientName,
        patientIdCard: values.patientIdCard,
        patientPhone: values.patientPhone,
        diagnosis: values.diagnosis,
        startTime: values.startTime.format('YYYY-MM-DD HH:mm:00'),
        durationMinutes: values.durationMinutes,
        insuranceId: values.insuranceId || undefined,
        remark: values.remark,
      }
      if (editing) {
        await window.api.updateSchedule(editing.id, data)
        message.success('更新成功')
      } else {
        await window.api.createSchedule(data)
        message.success('排期创建成功，系统已自动分配机器人')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      setShowPreview(false)
      setAllocationPreview(null)
      loadData()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const checkAllocation = async () => {
    try {
      const startTime = form.getFieldValue('startTime')
      const duration = form.getFieldValue('durationMinutes')
      if (!startTime || !duration) {
        message.warning('请先填写时间和时长')
        return
      }
      const result = await window.api.checkAvailable(
        startTime.format('YYYY-MM-DD HH:mm:00'),
        duration,
      )
      setAllocationPreview(result)
      setShowPreview(true)
      if (result.success) {
        message.success(`可分配：${result.robot?.name}`)
      } else {
        message.warning(result.reason)
      }
    } catch (err: any) {
      message.error(err.message || '检查失败')
    }
  }

  const handleStart = async (s: TrainingSchedule) => {
    try {
      await window.api.startSchedule(s.id)
      message.success('训练已开始')
      loadData()
    } catch (err: any) {
      message.error(err.message || '开始失败')
    }
  }

  const handleComplete = async (s: TrainingSchedule) => {
    modal.confirm({
      title: '确认结束训练并生成账单？',
      content: `患者：${s.patientName}${s.actualStartTime ? `\n已开始于：${dayjs(s.actualStartTime).format('YYYY-MM-DD HH:mm')}` : ''}`,
      onOk: async () => {
        try {
          const bill = await window.api.completeSchedule(s.id)
          message.success(`训练完成，账单金额：¥${bill.patientPayableAmount.toFixed(2)}`)
          loadData()
        } catch (err: any) {
          message.error(err.message || '操作失败')
        }
      },
      okText: '确认结束',
      cancelText: '取消',
    })
  }

  const handleCancel = async (id: number) => {
    try {
      await window.api.cancelSchedule(id)
      message.success('排期已取消')
      loadData()
    } catch (err: any) {
      message.error(err.message || '取消失败')
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      startTime: dayjs().add(1, 'hour').minute(0).second(0),
      durationMinutes: 45,
    })
    setAllocationPreview(null)
    setShowPreview(false)
    setModalOpen(true)
  }

  const openEdit = (s: TrainingSchedule) => {
    setEditing(s)
    form.setFieldsValue({
      patientName: s.patientName,
      patientIdCard: s.patientIdCard,
      patientPhone: s.patientPhone,
      diagnosis: s.diagnosis,
      startTime: dayjs(s.startTime),
      durationMinutes: s.durationMinutes,
      insuranceId: s.insuranceId || null,
      remark: s.remark || '',
    })
    setAllocationPreview(null)
    setShowPreview(false)
    setModalOpen(true)
  }

  const statusTag = (s: string) => {
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

  const todayStats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const list = schedules.filter(s => dayjs(s.startTime).format('YYYY-MM-DD') === today)
    return {
      total: list.length,
      allocated: list.filter(s => s.status === 'allocated').length,
      inProgress: list.filter(s => s.status === 'in_progress').length,
      completed: list.filter(s => s.status === 'completed').length,
    }
  }, [schedules])

  const columns = [
    { title: '编号', dataIndex: 'id', width: 70 },
    {
      title: '患者信息',
      width: 220,
      render: (_: any, s: TrainingSchedule) => (
        <div>
          <div style={{ fontWeight: 500 }}>{s.patientName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {s.patientPhone} · {s.patientIdCard.slice(-4).padStart(s.patientIdCard.length, '*')}
          </div>
        </div>
      ),
    },
    { title: '诊断', dataIndex: 'diagnosis', width: 160, ellipsis: true },
    {
      title: '训练时间',
      width: 220,
      render: (_: any, s: TrainingSchedule) => (
        <div>
          <div>{dayjs(s.startTime).format('MM-DD HH:mm')} ~ {dayjs(s.endTime).format('HH:mm')}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{s.durationMinutes} 分钟</div>
        </div>
      ),
    },
    {
      title: '分配机器人',
      width: 200,
      render: (_: any, s: TrainingSchedule) => (
        <div>
          {s.robotName ? (
            <Tooltip title={s.robotName}>
              <span style={{ fontWeight: 500 }}>{s.robotName}</span>
            </Tooltip>
          ) : (
            <Tag color="default">待分配</Tag>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => statusTag(s),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 240,
      render: (_: any, s: TrainingSchedule) => (
        <Space size="small" direction="vertical" style={{ width: '100%' }}>
          <Space size="small" wrap>
            {s.status === 'allocated' && (
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStart(s)}
              >
                开始训练
              </Button>
            )}
            {s.status === 'in_progress' && (
              <>
                <span style={{ fontSize: 11, color: '#92400e' }}>
                  开始于 {dayjs(s.actualStartTime).format('HH:mm')}
                </span>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleComplete(s)}
                >
                  结束
                </Button>
              </>
            )}
            {!['completed', 'cancelled', 'in_progress'].includes(s.status) && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(s)}
              >
                编辑
              </Button>
            )}
            {!['completed', 'cancelled', 'in_progress'].includes(s.status) && (
              <Popconfirm
                title="取消该排期？"
                onConfirm={() => handleCancel(s.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>取消</Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">训练排期</div>
        <div className="page-subtitle">患者只选择时间，系统自动从空闲设备择优分配，避免时间碎片</div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}><Card bordered={false}><div className="label" style={{ fontSize: 12, color: '#6b7280' }}>今日排期</div><div style={{ fontSize: 24, fontWeight: 700 }}>{todayStats.total}</div></Card></Col>
        <Col xs={12} sm={6}><Card bordered={false}><div className="label" style={{ fontSize: 12, color: '#6b7280' }}>已排期</div><div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>{todayStats.allocated}</div></Card></Col>
        <Col xs={12} sm={6}><Card bordered={false}><div className="label" style={{ fontSize: 12, color: '#6b7280' }}>训练中</div><div style={{ fontSize: 24, fontWeight: 700, color: '#92400e' }}>{todayStats.inProgress}</div></Card></Col>
        <Col xs={12} sm={6}><Card bordered={false}><div className="label" style={{ fontSize: 12, color: '#6b7280' }}>已完成</div><div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>{todayStats.completed}</div></Card></Col>
      </Row>

      <div className="toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建排期</Button>
        <DatePicker
          placeholder="选择日期"
          allowClear
          value={filterDate ? dayjs(filterDate) : null}
          onChange={d => setFilterDate(d ? d.format('YYYY-MM-DD') : null)}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 140 }}
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions}
        />
        <Input.Search
          placeholder="搜索患者姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={setPatientSearch}
        />
        <div className="toolbar-spacer" />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={schedules}
        columns={columns}
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无排期记录" /> }}
      />

      <Modal
        title={editing ? '编辑排期' : '新建训练排期'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); setShowPreview(false) }}
        okText="确定提交"
        cancelText="取消"
        destroyOnClose
        width={680}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={checkAllocation}>检测分配可用性</Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="患者姓名" name="patientName" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="患者真实姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="patientPhone" rules={[{ required: true, message: '请输入电话' }]}>
                <Input placeholder="11位手机号" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="身份证号" name="patientIdCard" rules={[{ required: true, message: '请输入身份证' }, { len: 18, message: '身份证18位' }]}>
                <Input placeholder="18位身份证号" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="临床诊断" name="diagnosis" rules={[{ required: true, message: '请输入诊断' }]}>
                <Input placeholder="如：脑卒中后上肢功能障碍" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="开始时间" name="startTime" rules={[{ required: true, message: '请选择时间' }]}>
                <DatePicker
                  showTime={{ showSecond: false, minuteStep: 15 }}
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm"
                  minDate={dayjs()}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="训练时长（分钟）" name="durationMinutes" rules={[{ required: true, message: '请输入时长' }]}>
                <InputNumber min={10} max={240} step={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="医保项目（可选）" name="insuranceId">
                <Select
                  allowClear
                  placeholder="选择医保项目"
                  options={insurance.map(i => ({
                    value: i.id,
                    label: `${i.name} (报销${(i.discountRate * 100).toFixed(0)}%，上限¥${i.maxReimbursement})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="特殊情况说明" />
              </Form.Item>
            </Col>
          </Row>

          {showPreview && allocationPreview && (
            <Alert
              type={allocationPreview.success ? 'success' : 'warning'}
              showIcon
              message={allocationPreview.success ? '分配检测结果' : '分配失败'}
              description={
                <div style={{ marginTop: 8 }}>
                  {allocationPreview.success && allocationPreview.robot && (
                    <div>
                      <div><strong>最优分配：</strong>{allocationPreview.robot.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        型号：{allocationPreview.robot.model} · 位置：{allocationPreview.robot.location}
                      </div>
                    </div>
                  )}
                  {!allocationPreview.success && (
                    <div>
                      <div>{allocationPreview.reason}</div>
                      {allocationPreview.alternatives && allocationPreview.alternatives.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                          其他时段备选设备：{allocationPreview.alternatives.map(a => a.name).join('、')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />
          )}
        </Form>
      </Modal>
    </div>
  )
}
