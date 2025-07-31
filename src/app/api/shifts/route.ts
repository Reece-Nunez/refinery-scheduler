import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateShiftAgainstFatiguePolicy } from '@/lib/fatiguePolicy'

export async function GET() {
    try {
        const shifts = await prisma.shift.findMany({
            include: { operator: true },
            orderBy: { startTime: 'asc' },
        })
        return NextResponse.json(shifts)
    } catch (error) {
        console.error('GET /api/shifts error:', error)
        return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { operatorId, startTime, endTime, isOverridden } = body

        if (!operatorId || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const violations = await validateShiftAgainstFatiguePolicy(operatorId, startTime, endTime, prisma)

        if (violations.length > 0 && !isOverridden) {
            return NextResponse.json(
                { error: 'Fatigue rule violation', violations },
                { status: 400 }
            )
        }

        const created = await prisma.shift.create({
            data: {
                operatorId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                isOverridden: isOverridden || false,
            },
        })


        return NextResponse.json(created)
    } catch (error) {
        console.error('POST /api/shifts error:', error)
        return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
    }
}
