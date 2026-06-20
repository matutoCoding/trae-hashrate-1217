import Database from 'better-sqlite3'
import type { InsuranceItem, InsuranceCreate } from '../../src/types'

export function listInsuranceItems(db: Database.Database): InsuranceItem[] {
  return db.prepare('SELECT * FROM insurance_items ORDER BY isActive DESC, id').all() as InsuranceItem[]
}

export function createInsuranceItem(
  db: Database.Database,
  data: InsuranceCreate
): InsuranceItem {
  if (data.discountRate < 0 || data.discountRate > 1) {
    throw new Error('报销比例必须在0到1之间')
  }
  if (data.maxReimbursement < 0) {
    throw new Error('最高报销金额不能为负')
  }

  const stmt = db.prepare(`
    INSERT INTO insurance_items (code, name, category, discountRate, maxReimbursement, isActive)
    VALUES (?, ?, ?, ?, ?, 1)
  `)
  const result = stmt.run(data.code, data.name, data.category, data.discountRate, data.maxReimbursement)
  return db.prepare('SELECT * FROM insurance_items WHERE id = ?').get(result.lastInsertRowid) as InsuranceItem
}

export function updateInsuranceItem(
  db: Database.Database,
  id: number,
  data: Partial<InsuranceCreate> & { isActive?: boolean }
): InsuranceItem {
  const existing = db.prepare('SELECT * FROM insurance_items WHERE id = ?').get(id) as InsuranceItem | undefined
  if (!existing) throw new Error('医保项目不存在')

  const fields: string[] = []
  const values: any[] = []

  if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code) }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category) }
  if (data.discountRate !== undefined) {
    if (data.discountRate < 0 || data.discountRate > 1) throw new Error('报销比例必须在0到1之间')
    fields.push('discountRate = ?'); values.push(data.discountRate)
  }
  if (data.maxReimbursement !== undefined) {
    if (data.maxReimbursement < 0) throw new Error('最高报销金额不能为负')
    fields.push('maxReimbursement = ?'); values.push(data.maxReimbursement)
  }
  if (data.isActive !== undefined) { fields.push('isActive = ?'); values.push(data.isActive ? 1 : 0) }

  fields.push("updatedAt = datetime('now', 'localtime')")
  values.push(id)

  db.prepare(`UPDATE insurance_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM insurance_items WHERE id = ?').get(id) as InsuranceItem
}

export function deleteInsuranceItem(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM insurance_items WHERE id = ?').run(id)
}
