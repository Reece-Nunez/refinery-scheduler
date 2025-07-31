import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params // ✅ Awaited context object
  try {
    await prisma.shift.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}


export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const body = await req.json()

  const { startTime, endTime, isOverridden } = body

  try {
    const updated = await prisma.shift.update({
      where: { id },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isOverridden,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[UPDATE SHIFT]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
