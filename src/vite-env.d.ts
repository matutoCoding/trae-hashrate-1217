/// <reference types="vite/client" />

interface Window {
  api: {
    getRobots: () => Promise<import('./types').Robot[]>
    createRobot: (data: import('./types').RobotCreate) => Promise<import('./types').Robot>
    updateRobot: (id: number, data: Partial<import('./types').RobotCreate> & { status?: import('./types').Robot['status']; priorityScore?: number }) => Promise<import('./types').Robot>
    deleteRobot: (id: number) => Promise<void>
    getRobotStats: () => Promise<any>

    getSchedules: (query?: import('./types').ScheduleQuery) => Promise<import('./types').TrainingSchedule[]>
    createSchedule: (data: import('./types').ScheduleCreate) => Promise<import('./types').TrainingSchedule>
    updateSchedule: (id: number, data: Partial<import('./types').ScheduleCreate>) => Promise<import('./types').TrainingSchedule>
    cancelSchedule: (id: number) => Promise<void>
    startSchedule: (id: number) => Promise<import('./types').TrainingSchedule>
    completeSchedule: (id: number) => Promise<import('./types').Bill>
    checkAvailable: (startTime: string, durationMinutes: number) => Promise<import('./types').AllocationResult>
    getScheduleStats: () => Promise<any>

    getBills: (query?: import('./types').BillQuery) => Promise<import('./types').Bill[]>
    getBillById: (id: number) => Promise<import('./types').Bill | null>
    verifyInsurance: (billId: number, insuranceId: number) => Promise<import('./types').Bill>
    getBillStats: () => Promise<any>

    getInsuranceItems: () => Promise<import('./types').InsuranceItem[]>
    createInsuranceItem: (data: import('./types').InsuranceCreate) => Promise<import('./types').InsuranceItem>
    updateInsuranceItem: (id: number, data: Partial<import('./types').InsuranceCreate> & { isActive?: boolean }) => Promise<import('./types').InsuranceItem>
    deleteInsuranceItem: (id: number) => Promise<void>

    getBillingRule: () => Promise<import('./types').BillingRule>
    updateBillingRule: (data: import('./types').RuleUpdate) => Promise<import('./types').BillingRule>
  }
}
