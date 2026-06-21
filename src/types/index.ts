export interface Robot {
  id: number
  name: string
  model: string
  type: 'upper_limb' | 'lower_limb' | 'hand' | 'balance' | 'other'
  status: 'idle' | 'busy' | 'maintenance' | 'offline'
  location: string
  purchaseDate: string
  totalUsageMinutes: number
  dailyUsageMinutes: number
  priorityScore: number
  createdAt: string
  updatedAt: string
}

export interface RobotCreate {
  name: string
  model: string
  type: Robot['type']
  location: string
  purchaseDate: string
}

export type ScheduleStatus = 'pending' | 'allocated' | 'in_progress' | 'completed' | 'cancelled'

export interface TrainingSchedule {
  id: number
  patientName: string
  patientIdCard: string
  patientPhone: string
  diagnosis: string
  startTime: string
  endTime: string
  durationMinutes: number
  robotId: number | null
  robotName: string | null
  status: ScheduleStatus
  actualStartTime: string | null
  actualEndTime: string | null
  actualDurationMinutes: number | null
  billId: number | null
  insuranceId: number | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduleCreate {
  patientName: string
  patientIdCard: string
  patientPhone: string
  diagnosis: string
  startTime: string
  durationMinutes: number
  insuranceId?: number
  remark?: string
}

export interface ScheduleQuery {
  date?: string
  status?: ScheduleStatus
  robotId?: number
  patientName?: string
}

export interface AllocationDetail {
  plannedMinutes: number
  completedMinutes: number
  totalLoadMinutes: number
  fragmentationScore: number
  totalScore: number
}

export interface AllocationResult {
  success: boolean
  robot?: Robot
  reason?: string
  alternatives?: Robot[]
  detail?: AllocationDetail
}

export interface BillingRule {
  id: number
  basePrice: number
  baseMinutes: number
  unitPricePerMinute: number
  maxPrice: number
  maxMinutes: number
  updatedAt: string
}

export interface RuleUpdate {
  basePrice: number
  baseMinutes: number
  unitPricePerMinute: number
  maxPrice: number
  maxMinutes: number
}

export interface Bill {
  id: number
  scheduleId: number
  patientName: string
  patientIdCard: string
  robotId: number
  robotName: string
  actualDurationMinutes: number
  basePrice: number
  extraPrice: number
  rawAmount: number
  finalAmount: number
  isCapped: boolean
  isBaseApplied: boolean
  insuranceId: number | null
  insuranceName: string | null
  insuranceDiscountRate: number
  insuranceDeductedAmount: number
  patientPayableAmount: number
  verifiedAt: string | null
  createdAt: string
}

export interface BillCreate {
  scheduleId: number
  actualDurationMinutes: number
}

export interface BillQuery {
  startDate?: string
  endDate?: string
  patientName?: string
  isVerified?: boolean
}

export interface InsuranceItem {
  id: number
  code: string
  name: string
  category: string
  discountRate: number
  maxReimbursement: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface InsuranceCreate {
  code: string
  name: string
  category: string
  discountRate: number
  maxReimbursement: number
}
