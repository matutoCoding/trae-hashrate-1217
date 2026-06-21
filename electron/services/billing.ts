import Database from 'better-sqlite3'
import type { BillingRule, Bill, InsuranceItem } from '../../src/types'

export interface BillingContext {
  durationMinutes: number
  rule: BillingRule
  insurance?: InsuranceItem | null
}

export interface BillingCalculation {
  basePrice: number
  extraPrice: number
  rawAmount: number
  finalAmount: number
  isCapped: boolean
  isBaseApplied: boolean
  insuranceDiscountRate: number
  insuranceDeductedAmount: number
  patientPayableAmount: number
  actualBilledMinutes: number
}

export function getBillingRule(db: Database.Database): BillingRule {
  return db.prepare('SELECT * FROM billing_rules ORDER BY id DESC LIMIT 1').get() as BillingRule
}

export function updateBillingRule(
  db: Database.Database,
  data: {
    basePrice: number
    baseMinutes: number
    unitPricePerMinute: number
    maxPrice: number
    maxMinutes: number
  }
): BillingRule {
  const { basePrice, baseMinutes, unitPricePerMinute, maxPrice, maxMinutes } = data
  if (basePrice < 0) throw new Error('起步价不能为负数')
  if (baseMinutes <= 0) throw new Error('起步时长必须大于0')
  if (unitPricePerMinute < 0) throw new Error('超时单价不能为负数')
  if (maxPrice <= 0) throw new Error('封顶价必须大于0')
  if (maxMinutes <= baseMinutes) throw new Error('封顶时长必须大于起步时长')
  if (maxPrice < basePrice) throw new Error('封顶价必须不小于起步价')

  db.prepare(`
    UPDATE billing_rules
    SET basePrice = ?, baseMinutes = ?, unitPricePerMinute = ?,
        maxPrice = ?, maxMinutes = ?, updatedAt = datetime('now', 'localtime')
  `).run(basePrice, baseMinutes, unitPricePerMinute, maxPrice, maxMinutes)

  return getBillingRule(db)
}

export function calculateBilling(ctx: BillingContext): BillingCalculation {
  const { durationMinutes, rule, insurance } = ctx

  let actualBilledMinutes = durationMinutes
  let isCapped = false
  let isBaseApplied = false

  const basePrice = rule.basePrice
  let extraMinutes = Math.max(0, durationMinutes - rule.baseMinutes)
  let extraPrice = extraMinutes * rule.unitPricePerMinute
  let rawAmount = basePrice + extraPrice

  if (durationMinutes <= rule.baseMinutes) {
    actualBilledMinutes = rule.baseMinutes
    isBaseApplied = true
    rawAmount = rule.basePrice
    extraPrice = 0
    extraMinutes = 0
  }

  if (rawAmount >= rule.maxPrice) {
    rawAmount = rule.maxPrice
    isCapped = true
    extraMinutes = Math.max(0, actualBilledMinutes - rule.baseMinutes)
    extraPrice = rule.maxPrice - rule.basePrice
    if (durationMinutes > rule.maxMinutes) {
      actualBilledMinutes = rule.maxMinutes
    }
  }

  rawAmount = Math.round(rawAmount * 100) / 100
  extraPrice = Math.round(extraPrice * 100) / 100

  let insuranceDiscountRate = 0
  let insuranceDeductedAmount = 0

  if (insurance && insurance.isActive) {
    insuranceDiscountRate = insurance.discountRate
    const deductionLimit = insurance.maxReimbursement
    const theoreticalDeduction = Math.round(rawAmount * insuranceDiscountRate * 100) / 100
    insuranceDeductedAmount = Math.min(theoreticalDeduction, deductionLimit)
    insuranceDeductedAmount = Math.round(insuranceDeductedAmount * 100) / 100
  }

  const cappedFinal = Math.min(rawAmount, rule.maxPrice)
  const patientPayableAmount = Math.round(Math.max(0, cappedFinal - insuranceDeductedAmount) * 100) / 100

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    extraPrice,
    rawAmount: Math.round(cappedFinal * 100) / 100,
    finalAmount: patientPayableAmount,
    isCapped,
    isBaseApplied,
    insuranceDiscountRate,
    insuranceDeductedAmount,
    patientPayableAmount,
    actualBilledMinutes,
  }
}

export function validateBillAmounts(calc: BillingCalculation, rule: BillingRule): boolean {
  if (calc.finalAmount < -0.01) return false
  if (calc.rawAmount > rule.maxPrice + 0.01) return false
  if (calc.rawAmount < -0.01) return false
  if (calc.insuranceDeductedAmount > calc.rawAmount + 0.01) return false
  if (calc.patientPayableAmount < -0.01) return false
  if (calc.extraPrice < -0.01) return false
  if (calc.basePrice < -0.01) return false
  return true
}
