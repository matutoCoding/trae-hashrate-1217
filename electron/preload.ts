import { contextBridge, ipcRenderer } from 'electron'
import type {
  Robot, RobotCreate,
  TrainingSchedule, ScheduleCreate, ScheduleQuery,
  Bill, BillCreate, BillQuery,
  InsuranceItem, InsuranceCreate,
  BillingRule, RuleUpdate,
  AllocationResult,
} from '../src/types'

contextBridge.exposeInMainWorld('api', {
  getRobots: (): Promise<Robot[]> => ipcRenderer.invoke('robot:list'),
  createRobot: (data: RobotCreate): Promise<Robot> => ipcRenderer.invoke('robot:create', data),
  updateRobot: (id: number, data: Partial<RobotCreate>): Promise<Robot> => ipcRenderer.invoke('robot:update', id, data),
  deleteRobot: (id: number): Promise<void> => ipcRenderer.invoke('robot:delete', id),
  getRobotStats: (): Promise<any> => ipcRenderer.invoke('robot:stats'),

  getSchedules: (query?: ScheduleQuery): Promise<TrainingSchedule[]> => ipcRenderer.invoke('schedule:list', query),
  createSchedule: (data: ScheduleCreate): Promise<TrainingSchedule> => ipcRenderer.invoke('schedule:create', data),
  updateSchedule: (id: number, data: Partial<ScheduleCreate>): Promise<TrainingSchedule> => ipcRenderer.invoke('schedule:update', id, data),
  cancelSchedule: (id: number): Promise<void> => ipcRenderer.invoke('schedule:cancel', id),
  completeSchedule: (id: number): Promise<Bill> => ipcRenderer.invoke('schedule:complete', id),
  checkAvailable: (startTime: string, durationMinutes: number): Promise<AllocationResult> =>
    ipcRenderer.invoke('schedule:checkAvailable', startTime, durationMinutes),
  getScheduleStats: (): Promise<any> => ipcRenderer.invoke('schedule:stats'),

  getBills: (query?: BillQuery): Promise<Bill[]> => ipcRenderer.invoke('bill:list', query),
  getBillById: (id: number): Promise<Bill | null> => ipcRenderer.invoke('bill:get', id),
  verifyInsurance: (billId: number, insuranceId: number): Promise<Bill> =>
    ipcRenderer.invoke('bill:verifyInsurance', billId, insuranceId),
  getBillStats: (): Promise<any> => ipcRenderer.invoke('bill:stats'),

  getInsuranceItems: (): Promise<InsuranceItem[]> => ipcRenderer.invoke('insurance:list'),
  createInsuranceItem: (data: InsuranceCreate): Promise<InsuranceItem> =>
    ipcRenderer.invoke('insurance:create', data),
  updateInsuranceItem: (id: number, data: Partial<InsuranceCreate>): Promise<InsuranceItem> =>
    ipcRenderer.invoke('insurance:update', id, data),
  deleteInsuranceItem: (id: number): Promise<void> => ipcRenderer.invoke('insurance:delete', id),

  getBillingRule: (): Promise<BillingRule> => ipcRenderer.invoke('rule:get'),
  updateBillingRule: (data: RuleUpdate): Promise<BillingRule> => ipcRenderer.invoke('rule:update', data),
})
