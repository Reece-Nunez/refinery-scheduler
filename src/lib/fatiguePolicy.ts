// lib/fatiguePolicy.ts
import { PrismaClient, Shift } from '@prisma/client'
import { addDays, differenceInHours, subDays, isSameDay, addHours } from 'date-fns'

export async function validateShiftAgainstFatiguePolicy(
  operatorId: string,
  newStart: string | Date,
  newEnd: string | Date,
  tx: PrismaClient
): Promise<string[]> {
  const violations: string[] = []
  const startTime = truncateToMinute(new Date(newStart))
  const endTime = truncateToMinute(new Date(newEnd))

  const shiftDuration = differenceInHours(endTime, startTime)
  if (shiftDuration > 16) {
    violations.push('Shift exceeds 16-hour maximum')
  }

  const windowStart = subDays(startTime, 7)
  const windowEnd = addDays(endTime, 1)

  const surroundingShifts = await tx.shift.findMany({
    where: {
      operatorId,
      OR: [
        {
          startTime: { gte: windowStart, lte: windowEnd },
        },
        {
          endTime: { gte: windowStart, lte: windowEnd },
        },
      ],
    },
    orderBy: { startTime: 'desc' },
  })

  const extendedShifts = surroundingShifts.filter(
    (s) => differenceInHours(new Date(s.endTime), new Date(s.startTime)) >= 13
  )
  if (shiftDuration >= 13 && extendedShifts.length >= 1) {
    violations.push('Only one extended (13+ hr) shift allowed in 7 days')
  }

  const lastShift = surroundingShifts[0]
  if (lastShift) {
    const lastEnd = new Date(lastShift.endTime)
    const gapHours = (startTime.getTime() - lastEnd.getTime()) / (1000 * 60 * 60)

    if (startTime <= lastEnd) {
      violations.push('New shift starts before the previous shift ended (overlap)')
    } else if (gapHours < 8) {
      violations.push('Less than 8 hours of rest between shifts')
    } else if (shiftDuration >= 12 && gapHours < 10) {
      violations.push('Too little recovery time between long shifts')
    }
  }

  const sameDay = surroundingShifts.find((s) =>
    isSameDay(new Date(s.startTime), startTime)
  )
  if (sameDay) {
    violations.push('Operator already has a shift on this day')
  }

  const overlap24hr = surroundingShifts.some((s) => {
    const sStart = new Date(s.startTime)
    const sEnd = new Date(s.endTime)
    return (
      (startTime >= sStart && startTime <= addHours(sStart, 24)) ||
      (endTime >= sStart && endTime <= addHours(sStart, 24))
    )
  })
  if (overlap24hr) {
    violations.push('Only one shift allowed per 24-hour period')
  }

  const consecutiveDays = getConsecutiveShiftDays(surroundingShifts, startTime)
  if (consecutiveDays >= 7) {
    violations.push('Operator has already worked 7 consecutive days')
  }

  return violations
}

function getConsecutiveShiftDays(shifts: { startTime: Date }[], reference: Date): number {
  const days = new Set(shifts.map((s) => new Date(s.startTime).toDateString()))
  days.add(reference.toDateString())
  return days.size
}

function truncateToMinute(date: Date): Date {
  date.setSeconds(0, 0)
  return date
}
