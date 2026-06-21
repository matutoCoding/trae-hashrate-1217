import { useEffect, useState } from 'react'
import {
  Card, Form, InputNumber, Button, App, Row, Col, Descriptions,
  Alert, Space, Tag, Divider,
} from 'antd'
import { SaveOutlined, CalculatorOutlined } from '@ant-design/icons'
import type { BillingRule, RuleUpdate } from '../types'

interface CalcPreview {
  duration: number
  basePrice: number
  extraPrice: number
  rawAmount: number
  finalAmount: number
  isBaseApplied: boolean
  isCapped: boolean
}

export default function Billing() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState<BillingRule | null>(null)
  const [form] = Form.useForm()
  const [preview, setPreview] = useState<CalcPreview | null>(null)

  const loadRule = async () => {
    setLoading(true)
    try {
      const r = await window.api.getBillingRule()
      setRule(r)
      form.setFieldsValue(r)
      calculatePreview(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRule()
  }, [])

  const calculatePreview = (r: BillingRule | null = rule) => {
    if (!r) return
    const cases: number[] = [15, 30, 60, 90, 120, 150, 180]
    const results = cases.map(d => {
      let isBaseApplied = d <= r.baseMinutes
      let actualDuration = d
      if (d <= r.baseMinutes) actualDuration = r.baseMinutes

      let extraMinutes = Math.max(0, d - r.baseMinutes)
      let raw = r.basePrice + extraMinutes * r.unitPricePerMinute

      if (d <= r.baseMinutes) {
        raw = r.basePrice
      }

      let isCapped = false
      if (raw >= r.maxPrice) {
        raw = r.maxPrice
        isCapped = true
        if (d > r.maxMinutes) {
          actualDuration = r.maxMinutes
        }
      }

      const extraPrice = Math.max(0, Math.round((raw - r.basePrice) * 100) / 100)
      raw = Math.round(raw * 100) / 100

      return {
        duration: d,
        basePrice: r.basePrice,
        extraPrice,
        rawAmount: raw,
        finalAmount: raw,
        isBaseApplied,
        isCapped,
      }
    })
    setPreview(results as any)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const data: RuleUpdate = {
        basePrice: values.basePrice,
        baseMinutes: values.baseMinutes,
        unitPricePerMinute: values.unitPricePerMinute,
        maxPrice: values.maxPrice,
        maxMinutes: values.maxMinutes,
      }
      const updated = await window.api.updateBillingRule(data)
      setRule(updated)
      calculatePreview(updated)
      message.success('计费规则已保存')
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCalcPreview = () => {
    const values = form.getFieldsValue()
    calculatePreview(values as BillingRule)
    message.success('预览已更新')
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">计费规则</div>
        <div className="page-subtitle">设置起步价、封顶价、超时单价，训练太短按起步价、太久按封顶价处理</div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <Card title="规则配置" bordered={false} loading={loading}>
            <Alert
              style={{ marginBottom: 20 }}
              type="info"
              showIcon
              message="规则说明"
              description={
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div>• 训练时长 ≤ 起步时长：按<strong>起步价</strong>收取</div>
                  <div>• 起步时长 ＜ 训练时长 ≤ 封顶时长：起步价 + 超时部分 × 超时单价</div>
                  <div>• 训练时长 ＞ 封顶时长：按<strong>封顶价</strong>收取（保护患者）</div>
                </div>
              }
            />
            <Form form={form} layout="vertical">
              <Divider style={{ margin: '8px 0 20px' }}>起步价规则</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="起步价（元）"
                    name="basePrice"
                    rules={[{ required: true, message: '请输入起步价' }]}
                  >
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="起步时长（分钟）"
                    name="baseMinutes"
                    rules={[{ required: true, message: '请输入起步时长' }]}
                  >
                    <InputNumber min={1} step={5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0 20px' }}>超时计费</Divider>
              <Form.Item
                label="超时单价（元/分钟）"
                name="unitPricePerMinute"
                rules={[{ required: true, message: '请输入超时单价' }]}
              >
                <InputNumber min={0} precision={2} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
              <Divider style={{ margin: '8px 0 20px' }}>封顶价规则（保护患者）</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="封顶价（元）"
                    name="maxPrice"
                    rules={[{ required: true, message: '请输入封顶价' }]}
                  >
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="封顶时长（分钟）"
                    name="maxMinutes"
                    rules={[{ required: true, message: '请输入封顶时长' }]}
                  >
                    <InputNumber min={1} step={5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                  保存规则
                </Button>
                <Button icon={<CalculatorOutlined />} onClick={handleCalcPreview}>
                  更新预览
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="计费预览（不同时长的计费结果）" bordered={false}>
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message="当前规则"
              description={
                rule && (
                  <div>
                    起步 <strong>¥{rule.basePrice}</strong>（{rule.baseMinutes}分钟）·
                    超时 <strong>¥{rule.unitPricePerMinute}/分钟</strong> ·
                    封顶 <strong>¥{rule.maxPrice}</strong>（{rule.maxMinutes}分钟）
                  </div>
                )
              }
            />
            {preview && Array.isArray(preview) && (
              <div className="bill-preview">
                {(preview as CalcPreview[]).map((p: CalcPreview, idx: number) => (
                  <div key={idx} style={{
                    marginBottom: idx < preview.length - 1 ? 12 : 0,
                    paddingBottom: idx < preview.length - 1 ? 12 : 0,
                    borderBottom: idx < preview.length - 1 ? '1px dashed #e5e7eb' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 15 }}>{p.duration} 分钟</strong>
                      <Space>
                        {p.isBaseApplied && <Tag color="blue" style={{ border: 'none' }}>触发起步价</Tag>}
                        {p.isCapped && <Tag color="red" style={{ border: 'none', background: '#fee2e2', color: '#991b1b' }}>触发封顶价</Tag>}
                        {!p.isBaseApplied && !p.isCapped && <Tag color="green" style={{ border: 'none' }}>正常计费</Tag>}
                      </Space>
                    </div>
                    <div className="bill-row">
                      <span className="label">起步价 ¥{rule?.basePrice} × {p.isBaseApplied ? '1（满起步）' : '1'}</span>
                      <span className="value">¥{p.basePrice.toFixed(2)}</span>
                    </div>
                    {p.extraPrice > 0 && (
                      <div className="bill-row">
                        <span className="label">超时费 ¥{rule?.unitPricePerMinute}/分钟</span>
                        <span className="value">+ ¥{p.extraPrice.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="bill-row total">
                      <span className="label">实收金额</span>
                      <span className="value">¥{p.finalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Descriptions
              size="small"
              column={1}
              style={{ marginTop: 20 }}
              bordered
              title="边界校验规则"
            >
              <Descriptions.Item label="起步价拦截">
                训练时长＜起步时长时，强制按起步时长计费，避免碎片训练收费过低
              </Descriptions.Item>
              <Descriptions.Item label="封顶价拦截">
                训练时长＞封顶时长时，超出部分不再计费，防止异常高额账单
              </Descriptions.Item>
              <Descriptions.Item label="金额校验">
                账单金额必须 ≥0 且 ≤封顶价；医保扣除后实付不得为负
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
