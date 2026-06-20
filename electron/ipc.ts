import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  listRobots, createRobot, updateRobot, deleteRobot, getRobotStats
} from './services/robot'
import {
  listSchedules, createSchedule, updateSchedule, cancelSchedule,
  completeSchedule, getScheduleStats
} from './services/schedule'
import {
  listBills, getBillById, verifyInsurance, getBillStats
} from './services/bill'
import {
  listInsuranceItems, createInsuranceItem, updateInsuranceItem, deleteInsuranceItem
} from './services/insurance'
import { allocateRobot } from './services/allocation'
import { getBillingRule, updateBillingRule } from './services/billing'

function safeCall<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err: any) {
    throw new Error(err.message || '操作失败')
  }
}

export function registerIpcHandlers(db: Database.Database) {
  ipcMain.handle('robot:list', () => safeCall(() => listRobots(db)))
  ipcMain.handle('robot:create', (_e, data) => safeCall(() => createRobot(db, data)))
  ipcMain.handle('robot:update', (_e, id, data) => safeCall(() => updateRobot(db, id, data)))
  ipcMain.handle('robot:delete', (_e, id) => safeCall(() => deleteRobot(db, id)))
  ipcMain.handle('robot:stats', () => safeCall(() => getRobotStats(db)))

  ipcMain.handle('schedule:list', (_e, query) => safeCall(() => listSchedules(db, query)))
  ipcMain.handle('schedule:create', (_e, data) => safeCall(() => createSchedule(db, data)))
  ipcMain.handle('schedule:update', (_e, id, data) => safeCall(() => updateSchedule(db, id, data)))
  ipcMain.handle('schedule:cancel', (_e, id) => safeCall(() => cancelSchedule(db, id)))
  ipcMain.handle('schedule:complete', (_e, id) => safeCall(() => completeSchedule(db, id)))
  ipcMain.handle('schedule:checkAvailable', (_e, startTime, durationMinutes) =>
    safeCall(() => allocateRobot(db, { startTime, durationMinutes }))
  )
  ipcMain.handle('schedule:stats', () => safeCall(() => getScheduleStats(db)))

  ipcMain.handle('bill:list', (_e, query) => safeCall(() => listBills(db, query)))
  ipcMain.handle('bill:get', (_e, id) => safeCall(() => getBillById(db, id)))
  ipcMain.handle('bill:verifyInsurance', (_e, billId, insuranceId) =>
    safeCall(() => verifyInsurance(db, billId, insuranceId))
  )
  ipcMain.handle('bill:stats', () => safeCall(() => getBillStats(db)))

  ipcMain.handle('insurance:list', () => safeCall(() => listInsuranceItems(db)))
  ipcMain.handle('insurance:create', (_e, data) => safeCall(() => createInsuranceItem(db, data)))
  ipcMain.handle('insurance:update', (_e, id, data) => safeCall(() => updateInsuranceItem(db, id, data)))
  ipcMain.handle('insurance:delete', (_e, id) => safeCall(() => deleteInsuranceItem(db, id)))

  ipcMain.handle('rule:get', () => safeCall(() => getBillingRule(db)))
  ipcMain.handle('rule:update', (_e, data) => safeCall(() => updateBillingRule(db, data)))
}
