import { useEffect, useState } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select,
  Space, Popconfirm, App, InputNumber, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { InsuranceItem, InsuranceCreate } from '../types'

const categoryOptions = [
  { value: '康复治疗', label: '康复治疗' },
  { value: '物理治疗', label: '物理治疗' },
  { value: '作业治疗', label: '作业治疗' },
  { value: '其他', label: '其他' },
]

export default function Insurance() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<InsuranceItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InsuranceItem | null>(null)
  const [form] = Form.useForm<InsuranceCreate & { isActive: boolean }>()

  const loadItems = async () => {
    setLoading(true)
    try {
      setItems(await window.api.getInsuranceItems())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data: InsuranceCreate = {
        code: values.code,
        name: values.name,
        category: values.category,
        discountRate: values.discountRate / 100,
        maxReimbursement: values.maxReimbursement,
      }
      if (editing) {
        await window.api.updateInsuranceItem(editing.id, {
          ...data,
          isActive: values.isActive,
        })
        message.success('更新成功')
      } else {
        await window.api.createInsuranceItem(data)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      loadItems()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.deleteInsuranceItem(id)
      message.success('删除成功')
      loadItems()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const handleToggle = async (item: InsuranceItem, checked: boolean) => {
    try {
      await window.api.updateInsuranceItem(item.id, { isActive: checked })
      message.success(checked ? '已启用' : '已停用')
      loadItems()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true })
    setModalOpen(true)
  }

  const openEdit = (item: InsuranceItem) => {
    setEditing(item)
    form.setFieldsValue({
      code: item.code,
      name: item.name,
      category: item.category,
      discountRate: item.discountRate * 100,
      maxReimbursement: item.maxReimbursement,
      isActive: !!item.isActive,
    })
    setModalOpen(true)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '项目编码',
      dataIndex: 'code',
      width: 130,
      render: (c: string) => <code style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>{c}</code>,
    },
    { title: '项目名称', dataIndex: 'name', width: 200 },
    { title: '分类', dataIndex: 'category', width: 120 },
    {
      title: '报销比例',
      dataIndex: 'discountRate',
      width: 120,
      align: 'right' as const,
      render: (r: number) => <Tag color="green">{(r * 100).toFixed(0)}%</Tag>,
    },
    {
      title: '最高报销额',
      dataIndex: 'maxReimbursement',
      width: 140,
      align: 'right' as const,
      render: (m: number) => <strong>¥{m.toFixed(2)}</strong>,
    },
    {
      title: '状态',
      width: 100,
      render: (_: any, item: InsuranceItem) => (
        <Space>
          <Switch
            size="small"
            checked={!!item.isActive}
            onChange={c => handleToggle(item, c)}
          />
          <span style={{ fontSize: 12, color: item.isActive ? '#166534' : '#6b7280' }}>
            {item.isActive ? '启用' : '停用'}
          </span>
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 150,
      render: (_: any, item: InsuranceItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(item.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">医保项目管理</div>
        <div className="page-subtitle">管理医保核销项目，设置报销比例和上限金额</div>
      </div>

      <div className="toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建医保项目</Button>
        <div className="toolbar-spacer" />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? '编辑医保项目' : '新建医保项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null) }}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item label="项目编码" name="code" rules={[{ required: true, message: '请输入编码' }]} style={{ flex: 1 }}>
              <Input placeholder="如：REHAB001" />
            </Form.Item>
            <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择' }]} style={{ flex: 1 }}>
              <Select options={categoryOptions} />
            </Form.Item>
          </div>
          <Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：机器人辅助训练" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item label="报销比例（%）" name="discountRate" rules={[{ required: true, message: '请输入' }]} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} step={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="最高报销额（元）" name="maxReimbursement" rules={[{ required: true, message: '请输入' }]} style={{ flex: 1 }}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item label="启用状态" name="isActive" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
