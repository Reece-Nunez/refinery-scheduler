// API RP 755 Fatigue Risk Management System Implementation

export interface Shift {
  id?: string
  operatorId: string
  startTime: Date
  endTime: Date
  isOverridden: boolean
  isOvertime?: boolean
  isOutage?: boolean
  shiftType?: 'day' | 'night' | 'rotating'
  operator?: {
    id: string
    name: string
    employeeId: string
  }
}

export interface WorkSet {
  shifts: Shift[]
  totalHours: number
  nightShiftCount: number
  hasExtendedShifts: boolean
  isOutage: boolean
}

export interface FatigueViolation {
  rule: string
  severity: 'warning' | 'violation' | 'high-risk'
  message: string
  currentValue: number
  limit: number
  requiresException?: boolean
}

export interface ExceptionRequest {
  shiftId: string
  operatorId: string
  violationType: string
  justification: string
  supervisorApproval: string
  managementApproval?: string
  riskAssessment: string
  mitigationPlan: string
  isHighRisk: boolean
  createdAt: Date
}

export class RP755FatiguePolicy {
  
  /**
   * Validate a new shift against RP-755 fatigue policy
   */
  static validateShift(
    newShift: Shift,
    operatorShifts: Shift[],
    isOutage: boolean = false
  ): FatigueViolation[] {
    const violations: FatigueViolation[] = []
    
    // 1. Check shift length limits (14 hours max)
    const shiftHours = this.calculateShiftHours(newShift.startTime, newShift.endTime)
    if (shiftHours > 14) {
      violations.push({
        rule: 'Maximum Shift Length',
        severity: 'violation',
        message: 'Shift exceeds 14-hour maximum limit',
        currentValue: shiftHours,
        limit: 14,
        requiresException: true
      })
    }
    
    // Check for high-risk exceptions (>18 hours)
    if (shiftHours > 18) {
      violations.push({
        rule: 'High Risk - Excessive Shift Length',
        severity: 'high-risk',
        message: 'Shift exceeds 18 hours - requires senior management notification',
        currentValue: shiftHours,
        limit: 18,
        requiresException: true
      })
    }
    
    // 2. Check rest period requirements
    const restViolations = this.validateRestPeriods(newShift, operatorShifts)
    violations.push(...restViolations)
    
    // 3. Check consecutive shift limits
    const consecutiveViolations = this.validateConsecutiveShifts(newShift, operatorShifts, isOutage)
    violations.push(...consecutiveViolations)

    // 4. Check work-set limits
    const workSetViolations = this.validateWorkSetLimits(newShift, operatorShifts, isOutage)
    violations.push(...workSetViolations)

    // 5. Check for overlapping shifts
    const overlapViolations = this.checkShiftOverlaps(newShift, operatorShifts)
    violations.push(...overlapViolations)
    
    return violations
  }
  
  /**
   * Calculate hours between two dates
   */
  static calculateShiftHours(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  }
  
  /**
   * Validate rest period requirements
   */
  static validateRestPeriods(newShift: Shift, operatorShifts: Shift[]): FatigueViolation[] {
    const violations: FatigueViolation[] = []

    // Find the last shift before this new shift
    const sortedShifts = operatorShifts
      .filter(shift => new Date(shift.endTime) <= new Date(newShift.startTime))
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())

    if (sortedShifts.length === 0) return violations

    const lastShift = sortedShifts[0]
    const restHours = this.calculateShiftHours(
      new Date(lastShift.endTime),
      new Date(newShift.startTime)
    )

    // Check if we need work-set rest period (34 or 46 hours)
    // First, get all consecutive shifts before the new shift
    const consecutiveShifts = this.getConsecutiveShifts(newShift, operatorShifts)

    if (consecutiveShifts.length > 0) {
      // Count night shifts in the consecutive work-set
      const nightShiftCount = consecutiveShifts.filter(s => this.isNightShift(s)).length
      const requiredWorkSetRest = nightShiftCount >= 4 ? 46 : 34

      // Check if the last consecutive shift and the new shift are part of the same work-set
      // If they're close together (< 24 hours gap), they're part of the same work-set
      // Work-set rest is only required when ENDING a work-set to START a new one
      // If rest >= requiredWorkSetRest, it's definitely a new work-set (OK)
      // If rest >= 8 but < requiredWorkSetRest, only violation if there's a clear break
      // A "clear break" means the gap is large enough to suggest intent to end the work-set
      // but not large enough to meet the requirement
      if (restHours >= 24 && restHours < requiredWorkSetRest) {
        violations.push({
          rule: 'Minimum Rest Period (Work-set)',
          severity: 'violation',
          message: `Insufficient rest to end work-set. After ${consecutiveShifts.length} consecutive shift${consecutiveShifts.length > 1 ? 's' : ''} ${nightShiftCount >= 4 ? `(including ${nightShiftCount} night shifts)` : ''}, minimum ${requiredWorkSetRest} hours rest required to start new work-set`,
          currentValue: restHours,
          limit: requiredWorkSetRest,
          requiresException: true
        })
      }
    }

    // Minimum 8 hours rest required between any shifts
    if (restHours < 8) {
      violations.push({
        rule: 'High Risk - Insufficient Rest',
        severity: 'high-risk',
        message: `Insufficient rest period between shifts (minimum 8 hours required)`,
        currentValue: restHours,
        limit: 8,
        requiresException: true
      })
    }

    return violations
  }

  /**
   * Validate consecutive shift limits according to RP-755
   */
  static validateConsecutiveShifts(newShift: Shift, operatorShifts: Shift[], isOutage: boolean): FatigueViolation[] {
    const violations: FatigueViolation[] = []

    // Calculate shift length to determine max consecutive shifts
    const shiftHours = this.calculateShiftHours(newShift.startTime, newShift.endTime)

    // Determine max consecutive shifts based on shift length and operation type
    let maxConsecutiveShifts: number
    if (shiftHours <= 8) {
      maxConsecutiveShifts = isOutage ? 19 : 10
    } else if (shiftHours <= 10) {
      maxConsecutiveShifts = isOutage ? 14 : 9
    } else {
      // 12-hour shifts
      maxConsecutiveShifts = isOutage ? 14 : 7
    }

    // Count consecutive shifts including the new shift
    const consecutiveShifts = this.getConsecutiveShifts(newShift, operatorShifts)
    const consecutiveCount = consecutiveShifts.length + 1 // +1 for the new shift

    if (consecutiveCount > maxConsecutiveShifts) {
      violations.push({
        rule: 'Maximum Consecutive Shifts',
        severity: 'violation',
        message: `Would exceed maximum of ${maxConsecutiveShifts} consecutive ${shiftHours}-hour shifts for ${isOutage ? 'outage' : 'normal'} operations`,
        currentValue: consecutiveCount,
        limit: maxConsecutiveShifts,
        requiresException: true
      })
    }

    return violations
  }

  /**
   * Get consecutive shifts before the new shift
   */
  static getConsecutiveShifts(newShift: Shift, operatorShifts: Shift[]): Shift[] {
    const sortedShifts = operatorShifts
      .filter(shift => new Date(shift.endTime) <= new Date(newShift.startTime))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

    const consecutiveShifts: Shift[] = []
    let nextShiftStart: Date = new Date(newShift.startTime)

    for (const shift of sortedShifts) {
      const shiftEnd = new Date(shift.endTime)

      // Check if this shift ends close to the start of the next shift
      // Consecutive means the gap between end of this shift and start of next is reasonable (<= 24 hours)
      const gapHours = this.calculateShiftHours(shiftEnd, nextShiftStart)

      // If gap is more than 24 hours, the consecutive sequence is broken
      if (gapHours > 24) break

      consecutiveShifts.unshift(shift)
      nextShiftStart = new Date(shift.startTime)
    }

    return consecutiveShifts
  }

  /**
   * Validate work-set limits according to RP-755
   */
  static validateWorkSetLimits(newShift: Shift, operatorShifts: Shift[], isOutage: boolean): FatigueViolation[] {
    const violations: FatigueViolation[] = []
    
    // Find current work-set
    const currentWorkSet = this.getCurrentWorkSet(newShift, operatorShifts)
    const workSetHours = currentWorkSet.totalHours + this.calculateShiftHours(newShift.startTime, newShift.endTime)
    
    // Normal operations vs Outages have different limits
    const maxWorkSetHours = isOutage ? 182 : (this.isAllDayShifts(currentWorkSet) ? 105 : 92)
    
    if (workSetHours > maxWorkSetHours) {
      violations.push({
        rule: 'Work-set Hour Limit',
        severity: 'violation',
        message: `Work-set would exceed ${maxWorkSetHours}-hour limit for ${isOutage ? 'outage' : 'normal'} operations`,
        currentValue: workSetHours,
        limit: maxWorkSetHours,
        requiresException: true
      })
    }
    
    // Check for multiple extended shifts (>14 hours) in work-set
    const extendedShifts = currentWorkSet.shifts.filter(shift => 
      this.calculateShiftHours(new Date(shift.startTime), new Date(shift.endTime)) > 14
    ).length
    
    const newShiftHours = this.calculateShiftHours(newShift.startTime, newShift.endTime)
    if (extendedShifts > 0 && newShiftHours > 14) {
      violations.push({
        rule: 'High Risk - Multiple Extended Shifts',
        severity: 'high-risk',
        message: 'More than one extended shift (>14 hours) per work-set requires senior management notification',
        currentValue: extendedShifts + 1,
        limit: 1,
        requiresException: true
      })
    }
    
    return violations
  }
  
  /**
   * Check for shift overlaps
   */
  static checkShiftOverlaps(newShift: Shift, operatorShifts: Shift[]): FatigueViolation[] {
    const violations: FatigueViolation[] = []
    
    for (const existingShift of operatorShifts) {
      const newStart = new Date(newShift.startTime).getTime()
      const newEnd = new Date(newShift.endTime).getTime()
      const existingStart = new Date(existingShift.startTime).getTime()
      const existingEnd = new Date(existingShift.endTime).getTime()
      
      // Check for overlap
      if ((newStart < existingEnd && newEnd > existingStart)) {
        violations.push({
          rule: 'Shift Overlap',
          severity: 'violation',
          message: `Shift overlaps with existing shift from ${new Date(existingShift.startTime).toLocaleString()} to ${new Date(existingShift.endTime).toLocaleString()}`,
          currentValue: 0,
          limit: 0,
          requiresException: false
        })
      }
    }
    
    return violations
  }
  
  /**
   * Get current work-set for an operator
   */
  static getCurrentWorkSet(newShift: Shift, operatorShifts: Shift[]): WorkSet {
    const sortedShifts = operatorShifts
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    
    let workSetShifts: Shift[] = []
    let totalHours = 0
    let nightShiftCount = 0
    let hasExtendedShifts = false
    let isOutage = false
    
    // Find the current work-set by working backwards from the new shift
    for (let i = sortedShifts.length - 1; i >= 0; i--) {
      const shift = sortedShifts[i]
      const shiftHours = this.calculateShiftHours(new Date(shift.startTime), new Date(shift.endTime))
      
      // Check if this shift is part of the current work-set
      if (workSetShifts.length === 0) {
        // First shift in the work-set
        workSetShifts.unshift(shift)
        totalHours += shiftHours
        if (this.isNightShift(shift)) nightShiftCount++
        if (shiftHours > 14) hasExtendedShifts = true
        if (shift.isOutage) isOutage = true
      } else {
        // Check if there's been sufficient rest to end the work-set
        const restHours = this.calculateShiftHours(
          new Date(shift.endTime),
          new Date(workSetShifts[0].startTime)
        )
        
        // Work-set ends if there's been sufficient rest
        const requiredRest = nightShiftCount >= 4 ? 46 : 34
        if (restHours >= requiredRest) {
          break
        }
        
        workSetShifts.unshift(shift)
        totalHours += shiftHours
        if (this.isNightShift(shift)) nightShiftCount++
        if (shiftHours > 14) hasExtendedShifts = true
        if (shift.isOutage) isOutage = true
      }
    }
    
    return {
      shifts: workSetShifts,
      totalHours,
      nightShiftCount,
      hasExtendedShifts,
      isOutage
    }
  }
  
  /**
   * Check if a shift is a night shift (typically 6 PM to 6 AM)
   */
  static isNightShift(shift: Shift): boolean {
    const startHour = new Date(shift.startTime).getHours()
    const endHour = new Date(shift.endTime).getHours()
    
    // Night shift typically starts between 6 PM and 6 AM or crosses midnight
    return startHour >= 18 || startHour < 6 || endHour <= 6 || 
           shift.shiftType === 'night' ||
           (startHour < endHour && startHour >= 18) // crosses midnight
  }
  
  /**
   * Check if all shifts in work-set are day shifts (allows extended 105-hour limit)
   */
  static isAllDayShifts(workSet: WorkSet): boolean {
    return workSet.shifts.every(shift => !this.isNightShift(shift))
  }
  
  /**
   * Create an exception request
   */
  static createExceptionRequest(
    shift: Shift,
    violations: FatigueViolation[],
    justification: string,
    supervisorApproval: string,
    riskAssessment: string,
    mitigationPlan: string
  ): ExceptionRequest {
    const highRiskViolations = violations.filter(v => v.severity === 'high-risk')
    
    return {
      shiftId: shift.id || 'temp-' + Date.now(),
      operatorId: shift.operatorId,
      violationType: violations.map(v => v.rule).join(', '),
      justification,
      supervisorApproval,
      riskAssessment,
      mitigationPlan,
      isHighRisk: highRiskViolations.length > 0,
      createdAt: new Date()
    }
  }
  
  /**
   * Validate if exception request is properly filled out
   */
  static validateExceptionRequest(request: ExceptionRequest): string[] {
    const errors: string[] = []
    
    if (!request.justification?.trim()) {
      errors.push('Justification is required')
    }
    
    if (!request.supervisorApproval?.trim()) {
      errors.push('Immediate supervisor approval is required')
    }
    
    if (!request.riskAssessment?.trim()) {
      errors.push('Risk assessment is required')
    }
    
    if (!request.mitigationPlan?.trim()) {
      errors.push('Mitigation plan is required')
    }
    
    if (request.isHighRisk && !request.managementApproval?.trim()) {
      errors.push('Senior management approval is required for high-risk exceptions')
    }
    
    return errors
  }
}