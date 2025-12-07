// Vacation calculation utilities for the refinery scheduler
// Based on mechanical schedule: vacation is allocated in weeks (40 hours per week)
//
// Tiers based on years of service:
// 0-3 years: 2 weeks = 80 hours
// 4-8 years: 3 weeks = 120 hours
// 9-19 years: 4 weeks = 160 hours
// 20-24 years: 5 weeks = 200 hours
// 25+ years: 6 weeks = 240 hours

export function calculateVacationHours(hireDate: string | null | undefined): number | null {
  if (!hireDate) return null

  const hire = new Date(hireDate)
  const now = new Date()
  const yearsOfService = Math.floor((now.getTime() - hire.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  if (yearsOfService < 0) return 80 // Not yet hired
  if (yearsOfService < 4) return 80   // 2 weeks (0-3 years)
  if (yearsOfService < 9) return 120  // 3 weeks (4-8 years)
  if (yearsOfService < 20) return 160 // 4 weeks (9-19 years)
  if (yearsOfService < 25) return 200 // 5 weeks (20-24 years)
  return 240 // 6 weeks (25+ years)
}

export function getYearsOfService(hireDate: string | null | undefined): number | null {
  if (!hireDate) return null
  const hire = new Date(hireDate)
  const now = new Date()
  return Math.floor((now.getTime() - hire.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

export function getVacationWeeks(hours: number): number {
  return hours / 40
}

// Get the effective vacation hours for an operator
// If hire date is set, calculate from tenure; otherwise use manual vacationHours
export function getEffectiveVacationHours(operator: {
  hireDate?: string | null
  vacationHours?: number
}): number {
  const calculatedHours = calculateVacationHours(operator.hireDate)
  if (calculatedHours !== null) {
    return calculatedHours
  }
  return operator.vacationHours ?? 80 // Default to 2 weeks if nothing set
}

export const VACATION_TIERS = [
  { minYears: 0, maxYears: 3, weeks: 2, hours: 80 },
  { minYears: 4, maxYears: 8, weeks: 3, hours: 120 },
  { minYears: 9, maxYears: 19, weeks: 4, hours: 160 },
  { minYears: 20, maxYears: 24, weeks: 5, hours: 200 },
  { minYears: 25, maxYears: Infinity, weeks: 6, hours: 240 },
]
