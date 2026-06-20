import { useEffect, useState } from 'react'
import {
  Table, Button, Tag, Modal, Form, Select, DatePicker,
  Space, App, Card, Row, Col, Descriptions,
  Empty, Input,
} from 'antd'
import {
  EyeOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Bill, BillQuery, InsuranceItem } from '../types'

export default function BillsPage() {
  const { message, modal } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [bills, setBills] = useState<Bill[]>([])
  const [insurance, setInsurance] = useState<InsuranceItem[]>([])
  const [detailBill, setDetailBill] = useState<Bill | null>(null)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyBillId, setVerifyBillId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const [startDate, setStartDate] = useState<string | null>(
    dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  )
  const [endDate, setEndDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'))
  const [patientName, setPatientName] = useState('')
  const [isVerified, setIsVerified] = useState<boolean | undefined>(undefined)

  const loadData = async () => {
    setLoading(true)
    try {
      const query: BillQuery = {}
      if (startDate) query.startDate = startDate
      if (endDate) query.endDate = endDate
      if (patientName) query.patientName = patientName
      if (isVerified !== undefined) query.isVerified = isVerified
      const [list, ins] = await Promise.all([
        window.api.getBills(query),
        window.api.getInsuranceItems(),
      ])
      setBills(list)
      setInsurance(ins.filter(i => i.isActive))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate, patientName, isVerified])

  const openVerify = (bill: Bill) => {
    setVerifyBillId(bill.id)
    setVerifyOpen(true)
    form.resetFields()
  }

  const handleVerify = async () => {
    try {
      const values = await form.validateFields()
      if (!verifyBillId) return
      const bill = await window.api.verifyInsurance(verifyBillId, values.insuranceId)
      setDetailBill(bill)
      setVerifyOpen(false)
      setVerifyBillId(null)
      message.success('医保核销成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '核销失败')
    }
  }

  const columns = [
    { title: '账单号', dataIndex: 'id', width: 80 },
    {
      title: '患者',
      width: 180,
      render: (_: any, b: Bill) => (
        <div>
          <div style={{ fontWeight: 500 }}>{b.patientName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {b.patientIdCard.slice(-6).padStart(b.patientIdCard.length, '*')}
          </div>
        </div>
      ),
    },
    {
      title: '机器人',
      dataIndex: 'robotName',
      width: 180,
    },
    {
      title: '实际训练',
      width: 120,
      render: (_: any, b: Bill) => {
        const tags: JSX.Element[] = []
        if (b.isBaseApplied) tags.push(<Tag color="blue" key="base">起步</Tag>)
        if (b.isCapped) tags.push(<Tag color="red" key="cap">封顶</Tag>)
        return (
          <div>
            <div>{b.actualDurationMinutes} 分钟</div>
            <div>{tags}</div>
          </div>
        )
      },
    },
    {
      title: '原始金额',
      width: 110,
      align: 'right' as const,
      render: (_: any, b: Bill) => <strong>¥{b.rawAmount.toFixed(2)}</strong>,
    },
    {
      title: '医保扣除',
      width: 130,
      align: 'right' as const,
      render: (_: any, b: Bill) => b.insuranceDeductedAmount > 0 ? (
        <span style={{ color: '#10b981' }}>-¥{b.insuranceDeductedAmount.toFixed(2)}</span>
      ) : (
        <span style={{ color: '#9ca3af' }}>-</span>
      ),
    },
    {
      title: '患者应付',
      dataIndex: 'patientPayableAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <strong style={{ color: '#dc2626', fontSize: 15 }}>¥{v.toFixed(2)}</strong>,
    },
    {
      title: '医保项目',
      width: 150,
      render: (_: any, b: Bill) => (
        b.insuranceName ? (
          <div>
            <div style={{ fontSize: 12 }}>{b.insuranceName}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              报销 {(b.insuranceDiscountRate * 100).toFixed(0)}%
            </div>
          </div>
        ) : <Tag color="default">未核销</Tag>
      ),
    },
    {
      title: '核销状态',
      width: 100,
      render: (_: any, b: Bill) => b.verifiedAt ? (
        <Tag color="green">已核销</Tag>
      ) : (
        <Tag color="orange">待核销</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 160,
      render: (_: any, b: Bill) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailBill(b)}
          >
            详情
          </Button>
          {!b.verifiedAt && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => openVerify(b)}
            >
              核销
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const stats = {
    total: bills.length,
    totalAmount: bills.reduce((s, b) => s + b.patientPayableAmount, 0),
    totalInsurance: bills.reduce((s, b) => s + b.insuranceDeductedAmount, 0),
    verifiedCount: bills.filter(b => b.verifiedAt).length,
    baseCount: bills.filter(b => b.isBaseApplied).length,
    capCount: bills.filter(b => b.isCapped).length,
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">账单管理</div>
        <div className="page-subtitle">自动生成训练账单，支持医保项目核销，起步价/封顶价自动处理边界</div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={4}><Card bordered={false}><div style={{ fontSize: 12, color: '#6b7280' }}>账单总数</div><div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div></Card></Col>
        <Col xs={12} sm={8} md={4}><Card bordered={false}><div style={{ fontSize: 12, color: '#6b7280' }}>患者总支付</div><div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>¥{stats.totalAmount.toFixed(0)}</div></Card></Col>
        <Col xs={12} sm={8} md={4}><Card bordered={false}><div style={{ fontSize: 12, color: '#6b7280' }}>医保已核销</div><div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>¥{stats.totalInsurance.toFixed(0)}</div></Card></Col>
        <Col xs={12} sm={8} md={4}><Card bordered={false}><div style={{ fontSize: 12, color: '#6b7280' }}>已核销/起步价触发封顶触发</div><div style={{ fontSize: 22, fontWeight: 700 }}>{stats.verifiedCount}/{stats.baseCount}/{stats.capCount}</div></Card></Col>
      </Row>

      <div className="toolbar">
        <DatePicker
          placeholder="开始日期"
          allowClear
          value={startDate ? dayjs(startDate) : null}
          onChange={d => setStartDate(d ? d.format('YYYY-MM-DD') : null)}
        />
        <DatePicker
          placeholder="结束日期"
          allowClear
          value={endDate ? dayjs(endDate) : null}
          onChange={d => setEndDate(d ? d.format('YYYY-MM-DD') : null)}
        />
        <Input.Search
          placeholder="患者姓名"
          allowClear
          style={{ width: 160 }}
          onSearch={setPatientName}
        />
        <Select
          placeholder="核销状态"
          allowClear
          style={{ width: 140 }}
          value={isVerified}
          onChange={setIsVerified}
          options={[
            { label: '已核销', value: true },
            { label: '待核销', value: false },
          ]}
        />
        <div className="toolbar-spacer" />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={bills}
        columns={columns}
        scroll={{ x: 1500 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无账单记录" /> }}
        summary={pageData => {
          const pageAmount = pageData.reduce((s, b) => s + b.patientPayableAmount, 0)
          const pageInsurance = pageData.reduce((s, b) => s + b.insuranceDeductedAmount, 0)
          return (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <strong>本页合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <span style={{ color: '#10b981' }}>-¥{pageInsurance.toFixed(2)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <strong style={{ color: '#dc2626' }}>¥{pageAmount.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} colSpan={5} />
              </Table.Summary.Row>
            </Table.Summary>
          )
        }}
      />

      <Modal
        title="账单详情"
        open={!!detailBill}
        onCancel={() => setDetailBill(null)}
        footer={null}
        destroyOnClose
        width={560}
      >
        {detailBill && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="账单号">{detailBill.id}</Descriptions.Item>
              <Descriptions.Item label="关联排期">#{detailBill.scheduleId}</Descriptions.Item>
              <Descriptions.Item label="患者姓名">{detailBill.patientName}</Descriptions.Item>
              <Descriptions.Item label="身份证">{detailBill.patientIdCard}</Descriptions.Item>
              <Descriptions.Item label="使用机器人" span={2}>{detailBill.robotName}</Descriptions.Item>
              <Descriptions.Item label="实际训练时长" span={2}>
                {detailBill.actualDurationMinutes} 分钟
                {detailBill.isBaseApplied && <Tag color="blue" style={{ marginLeft: 8 }}>起步价生效</Tag>}
                {detailBill.isCapped && <Tag color="red" style={{ marginLeft: 8 }}>封顶价生效</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <div className="bill-preview" style={{ marginTop: 16 }}>
              <div className="bill-row">
                <span className="label">起步价</span>
                <span className="value">¥{detailBill.basePrice.toFixed(2)}</span>
              </div>
              {detailBill.extraPrice > 0 && (
                <div className="bill-row">
                  <span className="label">超时费用</span>
                  <span className="value">+ ¥{detailBill.extraPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="bill-row">
                <span className="label">原始金额合计</span>
                <span className="value">¥{detailBill.rawAmount.toFixed(2)}</span>
              </div>
              {detailBill.insuranceDeductedAmount > 0 && (
                <div className="bill-row">
                  <span className="label">
                    医保扣除（{detailBill.insuranceName} {(detailBill.insuranceDiscountRate * 100).toFixed(0)}%）
                  </span>
                  <span className="value" style={{ color: '#10b981' }}>
                    - ¥{detailBill.insuranceDeductedAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="bill-row total">
                <span className="label">患者实付金额</span>
                <span className="value">¥{detailBill.patientPayableAmount.toFixed(2)}</span>
              </div>
            </div>

            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="创建时间">{dayjs(detailBill.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="核销时间">{detailBill.verifiedAt ? dayjs(detailBill.verifiedAt).format('YYYY-MM-DD HH:mm:ss') : '未核销'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title="医保核销"
        open={verifyOpen}
        onOk={handleVerify}
        onCancel={() => { setVerifyOpen(false); setVerifyBillId(null) }}
        okText="确认核销"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="选择医保项目"
            name="insuranceId"
            rules={[{ required: true, message: '请选择医保项目' }]}
          >
            <Select
              placeholder="选择核销项目"
              options={insurance.map(i => ({
                value: i.id,
                label: `${i.name} | 报销${(i.discountRate * 100).toFixed(0)}% | 最高¥${i.maxReimbursement}`,
              }))}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
