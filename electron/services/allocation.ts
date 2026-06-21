import Database from 'better-sqlite3'
import dayjs from 'dayjs'
import type { Robot, AllocationResult } from '../../src/types'

export interface TimeSlot {
  start: string
  end: string
}

export interface AllocationContext {
  startTime: string
  durationMinutes: number
  type?: Robot['type']
  excludeRobotIds?: number[]
}

export function isTimeOverlapping(slotA: TimeSlot, slotB: TimeSlot): boolean {
  const aStart = dayjs(slotA.start)
  const aEnd = dayjs(slotA.end)
  const bStart = dayjs(slotB.start)
  const bEnd = dayjs(slotB.end)
  return aStart.isBefore(bEnd) && bStart.isBefore(aEnd)
}

export function getRobotsOccupiedSlots(
  db: Database.Database,
  robotId: number,
  queryStartTime: string,
  queryEndTime: string
): TimeSlot[] {
  const rows = db.prepare(`
    SELECT startTime, endTime
    FROM training_schedules
    WHERE robotId = ?
      AND status IN ('pending', 'allocated', 'in_progress')
      AND startTime < ?
      AND endTime > ?
  `).all(robotId, queryEndTime, queryStartTime) as TimeSlot[]
  return rows
}

export function findFreeSlots(
  occupiedSlots: TimeSlot[],
  dayStart: string,
  dayEnd: string
): TimeSlot[] {
  const sorted = [...occupiedSlots].sort((a, b) =>
    dayjs(a.start).valueOf() - dayjs(b.start).valueOf()
  )
  const freeSlots: TimeSlot[] = []
  let currentStart = dayStart

  for (const slot of sorted) {
    if (dayjs(slot.start).isAfter(dayjs(currentStart))) {
      freeSlots.push({ start: currentStart, end: slot.start })
    }
    if (dayjs(slot.end).isAfter(dayjs(currentStart))) {
      currentStart = slot.end
    }
  }

  if (dayjs(dayEnd).isAfter(dayjs(currentStart))) {
    freeSlots.push({ start: currentStart, end: dayEnd })
  }

  return freeSlots
}

export function countSlotFragmentation(
  freeSlots: TimeSlot[],
  standardBlock: number = 30
): number {
  let fragmentation = 0
  for (const slot of freeSlots) {
    const duration = dayjs(slot.end).diff(dayjs(slot.start), 'minute')
    if (duration > 0 && duration < standardBlock) {
      fragmentation += (standardBlock - duration)
    }
  }
  return fragmentation
}

export function getRobotDailyScheduledMinutes(
  db: Database.Database,
  robotId: number,
  queryDate: string
): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(durationMinutes), 0) as total
    FROM training_schedules
    WHERE robotId = ?
      AND DATE(startTime) = ?
      AND status IN ('pending', 'allocated', 'in_progress')
  `).get(robotId, queryDate) as { total: number }
  return row.total || 0
}

export interface RobotDailyLoad {
  plannedMinutes: number
  completedMinutes: number
  totalLoadMinutes: number
  unfinishedCount: number
  completedCount: number
}

export function getRobotDailyLoad(
  db: Database.Database,
  robotId: number,
  queryDate: string
): RobotDailyLoad {
  const unfinishedRow = db.prepare(`
    SELECT COALESCE(SUM(durationMinutes), 0) as total, COUNT(*) as cnt
    FROM training_schedules
    WHERE robotId = ?
      AND DATE(startTime) = ?
      AND status IN ('pending', 'allocated', 'in_progress')
  `).get(robotId, queryDate) as { total: number; cnt: number }

  const completedRow = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(actualDurationMinutes, durationMinutes)), 0) as total, COUNT(*) as cnt
    FROM training_schedules
    WHERE robotId = ?
      AND DATE(startTime) = ?
      AND status = 'completed'
  `).get(robotId, queryDate) as { total: number; cnt: number }

  return {
    plannedMinutes: unfinishedRow.total || 0,
    completedMinutes: completedRow.total || 0,
    totalLoadMinutes: (unfinishedRow.total || 0) + (completedRow.total || 0),
    unfinishedCount: unfinishedRow.cnt || 0,
    completedCount: completedRow.cnt || 0,
  }
}

export function allocateRobot(
  db: Database.Database,
  ctx: AllocationContext
): AllocationResult {
  const { startTime, durationMinutes } = ctx
  const endTime = dayjs(startTime).add(durationMinutes, 'minute').format('YYYY-MM-DD HH:mm:ss')

  const queryDay = dayjs(startTime).format('YYYY-MM-DD')
  const dayStart = `${queryDay} 08:00:00`
  const dayEnd = `${queryDay} 20:00:00`

  if (dayjs(startTime).isBefore(dayjs(dayStart)) || dayjs(endTime).isAfter(dayjs(dayEnd))) {
    return { success: false, reason: '训练时间需在工作时段 08:00-20:00 内' }
  }

  const candidateRobots = db.prepare(`
    SELECT * FROM robots
    WHERE status IN ('idle', 'busy')
    ${ctx.type ? "AND type = ?" : ''}
    ORDER BY priorityScore DESC
  `).all(...(ctx.type ? [ctx.type] : [])) as Robot[]

  if (candidateRobots.length === 0) {
    return { success: false, reason: '当前时段没有可用的康复机器人' }
  }

  const excludeIds = ctx.excludeRobotIds || []
  const availableRobots: Robot[] = []
  const alternatives: Robot[] = []

  for (const robot of candidateRobots) {
    if (excludeIds.includes(robot.id)) continue

    const occupiedSlots = getRobotsOccupiedSlots(db, robot.id, startTime, endTime)
    const hasConflict = occupiedSlots.some(slot =>
      isTimeOverlapping(slot, { start: startTime, end: endTime })
    )

    if (!hasConflict) {
      const dayOccupied = getRobotsOccupiedSlots(db, robot.id, dayStart, dayEnd)
      const freeSlots = findFreeSlots(dayOccupied, dayStart, dayEnd)
      const fragBefore = countSlotFragmentation(freeSlots)

      const newOccupied = [...dayOccupied, { start: startTime, end: endTime }]
      const newSorted = newOccupied.sort((a, b) =>
        dayjs(a.start).valueOf() - dayjs(b.start).valueOf()
      )
      const merged: TimeSlot[] = []
      for (const s of newSorted) {
        if (merged.length === 0 || dayjs(s.start).isAfter(dayjs(merged[merged.length - 1].end))) {
          merged.push({ ...s })
        } else {
          const mergedEnd = dayjs(merged[merged.length - 1].end).isAfter(dayjs(s.end))
            ? merged[merged.length - 1].end
            : s.end
          merged[merged.length - 1].end = mergedEnd
        }
      }
      const afterFree = findFreeSlots(merged, dayStart, dayEnd)
      const fragAfter = countSlotFragmentation(afterFree)
      const fragIncrease = fragAfter - fragBefore

      const dailyLoad = getRobotDailyLoad(db, robot.id, queryDay)
      const balancePenalty = dailyLoad.totalLoadMinutes * 3

      const priorityWeight = robot.priorityScore * 100
      const totalScore = priorityWeight - fragIncrease * 2 - balancePenalty

      ;(robot as any)['_fragScore'] = fragIncrease
      ;(robot as any)['_loadScore'] = dailyLoad.totalLoadMinutes
      ;(robot as any)['_plannedMinutes'] = dailyLoad.plannedMinutes
      ;(robot as any)['_completedMinutes'] = dailyLoad.completedMinutes
      ;(robot as any)['_totalScore'] = totalScore

      availableRobots.push(robot)
    } else {
      alternatives.push(robot)
    }
  }

  if (availableRobots.length === 0) {
    return {
      success: false,
      reason: '所选时段所有机器人均已被占用，请调整时间',
      alternatives: alternatives.slice(0, 3),
    }
  }

  availableRobots.sort((a, b) => (b as any)['_totalScore'] - (a as any)['_totalScore'])
  const best = availableRobots[0]
  return {
    success: true,
    robot: best,
    detail: {
      plannedMinutes: (best as any)['_plannedMinutes'],
      completedMinutes: (best as any)['_completedMinutes'],
      totalLoadMinutes: (best as any)['_loadScore'],
      fragmentationScore: (best as any)['_fragScore'],
      totalScore: (best as any)['_totalScore'],
    },
  }
}
