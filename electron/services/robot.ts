import Database from 'better-sqlite3'
import type { Robot, RobotCreate } from '../../src/types'

export function listRobots(db: Database.Database): Robot[] {
  return db.prepare('SELECT * FROM robots ORDER BY id').all() as Robot[]
}

export function createRobot(db: Database.Database, data: RobotCreate): Robot {
  const stmt = db.prepare(`
    INSERT INTO robots (name, model, type, location, purchaseDate, status, priorityScore)
    VALUES (?, ?, ?, ?, ?, 'idle', 1.0)
  `)
  const result = stmt.run(data.name, data.model, data.type, data.location, data.purchaseDate)
  return db.prepare('SELECT * FROM robots WHERE id = ?').get(result.lastInsertRowid) as Robot
}

export function updateRobot(
  db: Database.Database,
  id: number,
  data: Partial<RobotCreate> & { status?: Robot['status']; priorityScore?: number }
): Robot {
  const existing = db.prepare('SELECT * FROM robots WHERE id = ?').get(id) as Robot | undefined
  if (!existing) throw new Error('机器人不存在')

  const fields: string[] = []
  const values: any[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.model !== undefined) { fields.push('model = ?'); values.push(data.model) }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type) }
  if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location) }
  if (data.purchaseDate !== undefined) { fields.push('purchaseDate = ?'); values.push(data.purchaseDate) }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
  if (data.priorityScore !== undefined) { fields.push('priorityScore = ?'); values.push(data.priorityScore) }

  fields.push("updatedAt = datetime('now', 'localtime')")
  values.push(id)

  db.prepare(`UPDATE robots SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM robots WHERE id = ?').get(id) as Robot
}

export function deleteRobot(db: Database.Database, id: number): void {
  const inUse = db.prepare(`
    SELECT COUNT(*) as cnt FROM training_schedules
    WHERE robotId = ? AND status IN ('pending', 'allocated', 'in_progress')
  `).get(id) as { cnt: number }
  if (inUse.cnt > 0) throw new Error('该机器人有未完成的训练排期，无法删除')

  db.prepare('DELETE FROM robots WHERE id = ?').run(id)
}

export function getRobotStats(db: Database.Database): any {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM robots').get() as { cnt: number }
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM robots GROUP BY status
  `).all() as { status: string; cnt: number }[]
  const byType = db.prepare(`
    SELECT type, COUNT(*) as cnt FROM robots GROUP BY type
  `).all() as { type: string; cnt: number }[]

  const statusMap: Record<string, number> = {}
  byStatus.forEach(r => { statusMap[r.status] = r.cnt })
  const typeMap: Record<string, number> = {}
  byType.forEach(r => { typeMap[r.type] = r.cnt })

  return {
    total: total.cnt,
    byStatus: statusMap,
    byType: typeMap,
  }
}
