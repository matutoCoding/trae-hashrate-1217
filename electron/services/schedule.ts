import Database from 'better-sqlite3'
import dayjs from 'dayjs'
import type {
  TrainingSchedule, ScheduleCreate, ScheduleQuery, ScheduleStatus, Bill
} from '../../src/types'
import { allocateRobot, getRobotDailyScheduledMinutes } from './allocation'
import { getBillingRule, calculateBilling, validateBillAmounts } from './billing'

function generateRobotName(db: Database.Database, robotId: number): string {
  const r = db.prepare('SELECT name FROM robots WHERE id = ?').get(robotId) as { name: string } | undefined
  return r?.name || ''
}

export function listSchedules(
  db: Database.Database,
  query?: ScheduleQuery
): TrainingSchedule[] {
  const conditions: string[] = []
  const params: any[] = []

  if (query?.date) {
    conditions.push("DATE(startTime) = ?")
    params.push(query.date)
  }
  if (query?.status) {
    conditions.push("status = ?")
    params.push(query.status)
  }
  if (query?.robotId) {
    conditions.push("robotId = ?")
    params.push(query.robotId)
  }
  if (query?.patientName) {
    conditions.push("patientName LIKE ?")
    params.push(`%${query.patientName}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`
    SELECT s.*, r.name as robotName
    FROM training_schedules s
    LEFT JOIN robots r ON s.robotId = r.id
    ${where}
    ORDER BY s.startTime DESC
  `).all(...params) as TrainingSchedule[]
}

export function createSchedule(
  db: Database.Database,
  data: ScheduleCreate
): TrainingSchedule {
  if (data.durationMinutes < 10) throw new Error('训练时长不能少于10分钟')
  if (data.durationMinutes > 240) throw new Error('单次训练不能超过240分钟')

  const rule = getBillingRule(db)
  if (data.durationMinutes > rule.maxMinutes * 2) {
    throw new Error(`单次训练过长，请分多次预约（建议单次不超过${rule.maxMinutes}分钟）`)
  }

  const startTime = dayjs(data.startTime).format('YYYY-MM-DD HH:mm:ss')
  const endTime = dayjs(startTime).add(data.durationMinutes, 'minute').format('YYYY-MM-DD HH:mm:ss')

  const allocation = allocateRobot(db, {
    startTime,
    durationMinutes: data.durationMinutes,
  })

  if (!allocation.success || !allocation.robot) {
    throw new Error(allocation.reason || '系统无法自动分配机器人，请调整时间')
  }

  const robotId = allocation.robot.id

  const tx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO training_schedules
      (patientName, patientIdCard, patientPhone, diagnosis, startTime, endTime,
       durationMinutes, robotId, status, insuranceId, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'allocated', ?, ?)
    `)
    const result = stmt.run(
      data.patientName, data.patientIdCard, data.patientPhone, data.diagnosis,
      startTime, endTime, data.durationMinutes, robotId,
      data.insuranceId || null, data.remark || null
    )

    const queryDay = dayjs(startTime).format('YYYY-MM-DD')
    const scheduledTotal = getRobotDailyScheduledMinutes(db, robotId, queryDay)
    db.prepare(`
      UPDATE robots
      SET status = CASE WHEN status = 'idle' THEN 'busy' ELSE status END,
          dailyUsageMinutes = ?,
          updatedAt = datetime('now', 'localtime')
      WHERE id = ?
    `).run(scheduledTotal, robotId)

    return db.prepare(`
      SELECT s.*, r.name as robotName
      FROM training_schedules s
      LEFT JOIN robots r ON s.robotId = r.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid) as TrainingSchedule
  })

  return tx()
}

export function updateSchedule(
  db: Database.Database,
  id: number,
  data: Partial<ScheduleCreate>
): TrainingSchedule {
  const existing = db.prepare('SELECT * FROM training_schedules WHERE id = ?').get(id) as TrainingSchedule | undefined
  if (!existing) throw new Error('排期不存在')
  if (['completed', 'cancelled'].includes(existing.status)) {
    throw new Error('该排期已完成或已取消，无法修改')
  }

  let newStartTime = existing.startTime
  let newEndTime = existing.endTime
  let newDuration = existing.durationMinutes
  let newRobotId = existing.robotId

  if (data.startTime !== undefined || data.durationMinutes !== undefined) {
    newStartTime = data.startTime
      ? dayjs(data.startTime).format('YYYY-MM-DD HH:mm:ss')
      : existing.startTime
    newDuration = data.durationMinutes || existing.durationMinutes
    newEndTime = dayjs(newStartTime).add(newDuration, 'minute').format('YYYY-MM-DD HH:mm:ss')

    if (newDuration < 10) throw new Error('训练时长不能少于10分钟')
    if (newDuration > 240) throw new Error('单次训练不能超过240分钟')

    const allocation = allocateRobot(db, {
      startTime: newStartTime,
      durationMinutes: newDuration,
      excludeRobotIds: existing.robotId ? [] : [],
    })

    if (!allocation.success || !allocation.robot) {
      throw new Error(allocation.reason || '修改后的时间段无法分配机器人')
    }
    newRobotId = allocation.robot.id
  }

  const tx = db.transaction(() => {
    const fields: string[] = []
    const values: any[] = []

    if (data.patientName !== undefined) { fields.push('patientName = ?'); values.push(data.patientName) }
    if (data.patientIdCard !== undefined) { fields.push('patientIdCard = ?'); values.push(data.patientIdCard) }
    if (data.patientPhone !== undefined) { fields.push('patientPhone = ?'); values.push(data.patientPhone) }
    if (data.diagnosis !== undefined) { fields.push('diagnosis = ?'); values.push(data.diagnosis) }
    if (data.startTime !== undefined || data.durationMinutes !== undefined) {
      fields.push('startTime = ?, endTime = ?, durationMinutes = ?, robotId = ?')
      values.push(newStartTime, newEndTime, newDuration, newRobotId)
    }
    if (data.insuranceId !== undefined) { fields.push('insuranceId = ?'); values.push(data.insuranceId) }
    if (data.remark !== undefined) { fields.push('remark = ?'); values.push(data.remark) }

    fields.push("updatedAt = datetime('now', 'localtime')")
    values.push(id)

    db.prepare(`UPDATE training_schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return db.prepare(`
      SELECT s.*, r.name as robotName
      FROM training_schedules s
      LEFT JOIN robots r ON s.robotId = r.id
      WHERE s.id = ?
    `).get(id) as TrainingSchedule
  })

  return tx()
}

export function cancelSchedule(db: Database.Database, id: number): void {
  const existing = db.prepare('SELECT * FROM training_schedules WHERE id = ?').get(id) as TrainingSchedule | undefined
  if (!existing) throw new Error('排期不存在')
  if (existing.status === 'completed') throw new Error('已完成的排期无法取消')
  if (existing.status === 'in_progress') throw new Error('训练中的排期请先结束训练再取消')

  db.prepare(`
    UPDATE training_schedules
    SET status = 'cancelled', updatedAt = datetime('now', 'localtime')
    WHERE id = ?
  `).run(id)

  if (existing.robotId) {
    const queryDay = dayjs(existing.startTime).format('YYYY-MM-DD')
    const remaining = db.prepare(`
      SELECT COUNT(*) as cnt FROM training_schedules
      WHERE robotId = ? AND status IN ('allocated', 'in_progress', 'pending') AND id != ?
        AND DATE(startTime) = ?
    `).get(existing.robotId, id, queryDay) as { cnt: number }

    const scheduledTotal = getRobotDailyScheduledMinutes(db, existing.robotId, queryDay)
    if (remaining.cnt === 0) {
      db.prepare(`
        UPDATE robots SET status = 'idle', dailyUsageMinutes = ?, updatedAt = datetime('now', 'localtime')
        WHERE id = ?
      `).run(scheduledTotal, existing.robotId)
    } else {
      db.prepare(`
        UPDATE robots SET dailyUsageMinutes = ?, updatedAt = datetime('now', 'localtime')
        WHERE id = ?
      `).run(scheduledTotal, existing.robotId)
    }
  }
}

export function startSchedule(db: Database.Database, id: number): TrainingSchedule {
  const existing = db.prepare(`
    SELECT s.*, r.name as robotName
    FROM training_schedules s
    LEFT JOIN robots r ON s.robotId = r.id
    WHERE s.id = ?
  `).get(id) as (TrainingSchedule & { robotName?: string }) | undefined

  if (!existing) throw new Error('排期不存在')
  if (!existing.robotId) throw new Error('该排期未分配机器人')
  if (existing.status === 'completed') throw new Error('该排期已完成')
  if (existing.status === 'cancelled') throw new Error('该排期已取消')
  if (existing.status === 'in_progress') throw new Error('该排期已在训练中')

  const now = dayjs()
  const scheduledStart = dayjs(existing.startTime)
  const diffMinutes = now.diff(scheduledStart, 'minute')

  if (diffMinutes < -15) {
    throw new Error(`距训练开始还有 ${Math.abs(diffMinutes)} 分钟，暂不能提前开始`)
  }

  const actualStartTime = now.format('YYYY-MM-DD HH:mm:ss')

  db.prepare(`
    UPDATE training_schedules
    SET status = 'in_progress',
        actualStartTime = ?,
        updatedAt = datetime('now', 'localtime')
    WHERE id = ?
  `).run(actualStartTime, id)

  db.prepare(`
    UPDATE robots
    SET status = 'busy',
        updatedAt = datetime('now', 'localtime')
    WHERE id = ?
  `).run(existing.robotId)

  return db.prepare(`
    SELECT s.*, r.name as robotName
    FROM training_schedules s
    LEFT JOIN robots r ON s.robotId = r.id
    WHERE s.id = ?
  `).get(id) as TrainingSchedule
}

export function completeSchedule(db: Database.Database, id: number): Bill {
  const existing = db.prepare(`
    SELECT s.*, r.name as robotName
    FROM training_schedules s
    LEFT JOIN robots r ON s.robotId = r.id
    WHERE s.id = ?
  `).get(id) as (TrainingSchedule & { robotName?: string }) | undefined

  if (!existing) throw new Error('排期不存在')
  if (!existing.robotId) throw new Error('该排期未分配机器人')
  if (existing.status === 'completed') throw new Error('该排期已完成')
  if (existing.status === 'cancelled') throw new Error('该排期已取消')

  if (existing.status !== 'in_progress') {
    throw new Error('请先点击「开始训练」再点击结束')
  }

  if (!existing.actualStartTime) {
    throw new Error('训练开始时间丢失，请联系管理员')
  }

  const actualEndTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const rawDuration = dayjs(actualEndTime).diff(dayjs(existing.actualStartTime), 'minute')
  const actualDuration = Math.max(1, rawDuration)

  const rule = getBillingRule(db)
  let insurance: import('../../src/types').InsuranceItem | null = null
  if (existing.insuranceId) {
    const found = db.prepare('SELECT * FROM insurance_items WHERE id = ?').get(existing.insuranceId)
    insurance = (found as import('../../src/types').InsuranceItem) || null
  }

  const calc = calculateBilling({
    durationMinutes: actualDuration,
    rule,
    insurance,
  })

  if (!validateBillAmounts(calc, rule)) {
    throw new Error('计费校验失败，请联系管理员')
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE training_schedules
      SET status = 'completed',
          actualStartTime = ?,
          actualEndTime = ?,
          actualDurationMinutes = ?,
          updatedAt = datetime('now', 'localtime')
      WHERE id = ?
    `).run(existing.actualStartTime, actualEndTime, actualDuration, id)

    const billStmt = db.prepare(`
      INSERT INTO bills
      (scheduleId, patientName, patientIdCard, robotId, robotName,
       actualDurationMinutes, basePrice, extraPrice, rawAmount, finalAmount,
       isCapped, isBaseApplied, insuranceId, insuranceName,
       insuranceDiscountRate, insuranceDeductedAmount, patientPayableAmount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const billResult = billStmt.run(
      id, existing.patientName, existing.patientIdCard,
      existing.robotId, existing.robotName || '',
      actualDuration, calc.basePrice, calc.extraPrice, calc.rawAmount, calc.rawAmount,
      calc.isCapped ? 1 : 0, calc.isBaseApplied ? 1 : 0,
      existing.insuranceId || null, insurance?.name || null,
      calc.insuranceDiscountRate, calc.insuranceDeductedAmount,
      calc.patientPayableAmount
    )

    db.prepare('UPDATE training_schedules SET billId = ? WHERE id = ?').run(billResult.lastInsertRowid, id)

    db.prepare(`
      UPDATE robots
      SET totalUsageMinutes = totalUsageMinutes + ?,
          dailyUsageMinutes = dailyUsageMinutes + ?,
          updatedAt = datetime('now', 'localtime')
      WHERE id = ?
    `).run(actualDuration, actualDuration, existing.robotId)

    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.lastInsertRowid) as Bill

    if (existing.insuranceId) {
      db.prepare(`
        UPDATE bills SET verifiedAt = datetime('now', 'localtime') WHERE id = ?
      `).run(billResult.lastInsertRowid)
      bill.verifiedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    const remaining = db.prepare(`
      SELECT COUNT(*) as cnt FROM training_schedules
      WHERE robotId = ? AND status IN ('allocated', 'in_progress', 'pending') AND id != ?
    `).get(existing.robotId, id) as { cnt: number }
    if (remaining.cnt === 0) {
      db.prepare(`
        UPDATE robots SET status = 'idle', updatedAt = datetime('now', 'localtime') WHERE id = ?
      `).run(existing.robotId)
    }

    return bill
  })

  return tx()
}

export function getScheduleStats(db: Database.Database): any {
  const today = dayjs().format('YYYY-MM-DD')
  const total = db.prepare('SELECT COUNT(*) as cnt FROM training_schedules').get() as { cnt: number }
  const todaySchedules = db.prepare(`
    SELECT COUNT(*) as cnt FROM training_schedules WHERE DATE(startTime) = ?
  `).get(today) as { cnt: number }
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM training_schedules GROUP BY status
  `).all() as { status: ScheduleStatus; cnt: number }[]

  const statusMap: Record<string, number> = {}
  byStatus.forEach(r => { statusMap[r.status] = r.cnt })

  return {
    total: total.cnt,
    today: todaySchedules.cnt,
    byStatus: statusMap,
  }
}
