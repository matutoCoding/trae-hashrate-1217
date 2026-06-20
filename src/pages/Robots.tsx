import { useEffect, useState } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, DatePicker,
  Space, Popconfirm, App, Progress, InputNumber, Tooltip, Empty,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { Robot, RobotCreate } from '../types'

const typeOptions = [
  { value: 'upper_limb', label: '上肢机器人' },
  { value: 'lower_limb', label: '下肢机器人' },
  { value: 'hand', label: '手部机器人' },
  { value: 'balance', label: '平衡机器人' },
  { value: 'other', label: '其他' },
]

const statusOptions = [
  { value: 'idle', label: '空闲' },
  { value: 'busy', label: '使用中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'offline', label: '离线' },
]

export default function Robots() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [robots, setRobots] = useState<Robot[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Robot | null>(null)
  const [form] = Form.useForm<RobotCreate & { purchaseDate: Dayjs }>()
  const [detailRobot, setDetailRobot] = useState<Robot | null>(null)

  const loadRobots = async () => {
    setLoading(true)
    try {
      setRobots(await window.api.getRobots())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRobots()
  }, [])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data: RobotCreate = {
        name: values.name,
        model: values.model,
        type: values.type,
        location: values.location,
        purchaseDate: (values.purchaseDate as Dayjs).format('YYYY-MM-DD'),
      }
      if (editing) {
        await window.api.updateRobot(editing.id, data)
        message.success('更新成功')
      } else {
        await window.api.createRobot(data)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      loadRobots()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.deleteRobot(id)
      message.success('删除成功')
      loadRobots()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (r: Robot) => {
    setEditing(r)
    form.setFieldsValue({
      name: r.name,
      model: r.model,
      type: r.type,
      location: r.location,
      purchaseDate: dayjs(r.purchaseDate) as any,
    })
    setModalOpen(true)
  }

  const handleStatusChange = async (r: Robot, status: Robot['status']) => {
    try {
      await window.api.updateRobot(r.id, { status })
      message.success('状态更新成功')
      loadRobots()
    } catch (err: any) {
      message.error(err.message || '更新失败')
    }
  }

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

  const typeLabel = (t: string) => {
    return typeOptions.find(o => o.value === t)?.label || t
  }

  const columns = [
    { title: '编号', dataIndex: 'id', width: 70 },
    { title: '设备名称', dataIndex: 'name', width: 200 },
    { title: '型号', dataIndex: 'model', width: 150 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 130,
      render: (t: string) => typeLabel(t),
    },
    { title: '位置', dataIndex: 'location', width: 150 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: string, r: Robot) => (
        <Select
          size="small"
          value={s}
          style={{ width: 100 }}
          options={statusOptions}
          onChange={(val) => handleStatusChange(r, val as Robot['status'])}
          optionFilterProp="label"
        />
      ),
    },
    {
      title: '今日负载',
      width: 180,
      render: (_: any, r: Robot) => (
        <Tooltip title={`今日使用 ${r.dailyUsageMinutes}/480 分钟`}>
          <Progress
            percent={Math.min(100, (r.dailyUsageMinutes / 480) * 100)}
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      title: '累计使用',
      dataIndex: 'totalUsageMinutes',
      width: 120,
      render: (m: number) => `${(m / 60).toFixed(1)}h`,
    },
    {
      title: '优先级',
      dataIndex: 'priorityScore',
      width: 100,
      render: (s: number) => <Tag color="blue">{(s * 100).toFixed(0)}%</Tag>,
    },
    {
      title: '购置日期',
      dataIndex: 'purchaseDate',
      width: 130,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 180,
      render: (_: any, r: Robot) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => setDetailRobot(r)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该机器人？"
            onConfirm={() => handleDelete(r.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">康复机器人建档</div>
        <div className="page-subtitle">管理所有康复机器人设备信息、状态及负载情况</div>
      </div>

      <div className="toolbar">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          新建机器人
        </Button>
        <div className="toolbar-spacer" />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={robots}
        columns={columns}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editing ? '编辑机器人' : '新建机器人'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null) }}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="设备名称"
            name="name"
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder="如：上肢康复机器人-A1" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              label="设备型号"
              name="model"
              rules={[{ required: true, message: '请输入型号' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="如：RehabArm-X1" />
            </Form.Item>
            <Form.Item
              label="设备类型"
              name="type"
              rules={[{ required: true, message: '请选择类型' }]}
              style={{ flex: 1 }}
            >
              <Select options={typeOptions} />
            </Form.Item>
          </div>
          <Form.Item
            label="放置位置"
            name="location"
            rules={[{ required: true, message: '请输入放置位置' }]}
          >
            <Input placeholder="如：康复室A-01" />
          </Form.Item>
          <Form.Item
            label="购置日期"
            name="purchaseDate"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="机器人详情"
        open={!!detailRobot}
        onCancel={() => setDetailRobot(null)}
        footer={null}
        destroyOnClose
      >
        {detailRobot && (
          <div className="info-grid">
            <div className="info-item"><div className="label">设备名称</div><div className="value">{detailRobot.name}</div></div>
            <div className="info-item"><div className="label">型号</div><div className="value">{detailRobot.model}</div></div>
            <div className="info-item"><div className="label">类型</div><div className="value">{typeLabel(detailRobot.type)}</div></div>
            <div className="info-item"><div className="label">位置</div><div className="value">{detailRobot.location}</div></div>
            <div className="info-item"><div className="label">状态</div><div className="value">{statusTag(detailRobot.status)}</div></div>
            <div className="info-item"><div className="label">优先级</div><div className="value">{(detailRobot.priorityScore * 100).toFixed(0)}%</div></div>
            <div className="info-item"><div className="label">今日使用</div><div className="value">{detailRobot.dailyUsageMinutes} 分钟</div></div>
            <div className="info-item"><div className="label">累计使用</div><div className="value">{detailRobot.totalUsageMinutes} 分钟</div></div>
            <div className="info-item"><div className="label">购置日期</div><div className="value">{dayjs(detailRobot.purchaseDate).format('YYYY-MM-DD')}</div></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
