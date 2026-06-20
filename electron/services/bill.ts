import Database from 'better-sqlite3'
import dayjs from 'dayjs'
import type { Bill, BillQuery, InsuranceItem, InsuranceCreate } from '../../src/types'
import { getBillingRule, calculateBilling, validateBillAmounts } from './billing'

export function listBills(db: Database.Database, query?: BillQuery): Bill[] {
  const conditions: string[] = []
  const params: any[] = []

  if (query?.startDate) {
    conditions.push("DATE(createdAt) >= ?")
    params.push(query.startDate)
  }
  if (query?.endDate) {
    conditions.push("DATE(createdAt) <= ?")
    params.push(query.endDate)
  }
  if (query?.patientName) {
    conditions.push("patientName LIKE ?")
    params.push(`%${query.patientName}%`)
  }
  if (query?.isVerified === true) {
    conditions.push("verifiedAt IS NOT NULL")
  } else if (query?.isVerified === false) {
    conditions.push("verifiedAt IS NULL")
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM bills ${where} ORDER BY createdAt DESC`).all(...params) as Bill[]
}

export function getBillById(db: Database.Database, id: number): Bill | null {
  return db.prepare('SELECT * FROM bills WHERE id = ?').get(id) as Bill | null
}

export function verifyInsurance(
  db: Database.Database,
  billId: number,
  insuranceId: number
): Bill {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as Bill | undefined
  if (!bill) throw new Error('账单不存在')
  if (bill.verifiedAt) throw new Error('该账单已核销医保')

  const insurance = db.prepare('SELECT * FROM insurance_items WHERE id = ? AND isActive = 1').get(insuranceId) as InsuranceItem | undefined
  if (!insurance) throw new Error('医保项目不存在或已停用')

  const rule = getBillingRule(db)
  const calc = calculateBilling({
    durationMinutes: bill.actualDurationMinutes,
    rule,
    insurance,
  })

  if (!validateBillAmounts(calc, rule)) {
    throw new Error('重新计费校验失败')
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE bills
      SET insuranceId = ?,
          insuranceName = ?,
          insuranceDiscountRate = ?,
          insuranceDeductedAmount = ?,
          patientPayableAmount = ?,
          finalAmount = ?,
          verifiedAt = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      insuranceId, insurance.name,
      calc.insuranceDiscountRate,
      calc.insuranceDeductedAmount,
      calc.patientPayableAmount,
      calc.patientPayableAmount,
      billId
    )

    db.prepare(`
      UPDATE training_schedules SET insuranceId = ? WHERE id = ?
    `).run(insuranceId, bill.scheduleId)

    return db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as Bill
  })

  return tx()
}

export function getBillStats(db: Database.Database): any {
  const today = dayjs().format('YYYY-MM-DD')
  const total = db.prepare('SELECT COUNT(*) as cnt FROM bills').get() as { cnt: number }
  const todayBills = db.prepare(`
    SELECT COUNT(*) as cnt FROM bills WHERE DATE(createdAt) = ?
  `).get(today) as { cnt: number }

  const revenue = db.prepare(`
    SELECT
      COALESCE(SUM(patientPayableAmount), 0) as totalRevenue,
      COALESCE(SUM(insuranceDeductedAmount), 0) as totalInsurance
    FROM bills
  `).get() as { totalRevenue: number; totalInsurance: number }

  const totalRevenue = revenue.totalRevenue || 0
  const totalInsurance = revenue.totalInsurance || 0

  const todayRevenue = db.prepare(`
    SELECT COALESCE(SUM(patientPayableAmount),0) as amount
    FROM bills WHERE DATE(createdAt) = ?
  `).get(today) as { amount: number }

  const verified = db.prepare(`
    SELECT COUNT(*) as cnt FROM bills WHERE verifiedAt IS NOT NULL
  `).get() as { cnt: number }

  return {
    total: total.cnt,
    today: todayBills.cnt,
    totalRevenue: totalRevenue || 0,
    todayRevenue: todayRevenue.amount || 0,
    totalInsurance: totalInsurance || 0,
    verified: verified.cnt,
    unverified: total.cnt - verified.cnt,
  }
}
