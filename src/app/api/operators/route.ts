import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'

export async function GET() {
  const operators = await prisma.operator.findMany({
    include: { trainedJobs: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(operators)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { employeeId, name, role, team, email, trainedJobIds } = body
  const hashedPassword = await bcrypt.hash(employeeId, 10)

  if (!employeeId || !name || !role || !team || !email || !Array.isArray(trainedJobIds)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const operator = await prisma.operator.create({
    data: {
      employeeId,
      name,
      role,
      team,
      trainedJobs: {
        connect: trainedJobIds.map((id: string) => ({ id })),
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      email,
      employeeId,
      role: 'OPER',
      password: hashedPassword,
    },
  })

  await sendWelcomeEmail(email, employeeId)

  return NextResponse.json({ operator, user })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { id, name, role, team, trainedJobIds } = body

  const updated = await prisma.operator.update({
    where: { id },
    data: {
      name,
      role,
      team,
      trainedJobs: {
        set: trainedJobIds.map((id: string) => ({ id })),
      },
    },
    include: { trainedJobs: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const body = await req.json()
  const { id } = body

  // First find the operator to get the employeeId
  const operator = await prisma.operator.findUnique({
    where: { id },
    select: { employeeId: true },
  })

  if (!operator) {
    return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
  }

  // Delete the user linked by employeeId
  await prisma.user.delete({
    where: { employeeId: operator.employeeId },
  })

  // Then delete the operator
  await prisma.operator.delete({
    where: { id },
  })

  return NextResponse.json({ message: 'Deleted' })
}

