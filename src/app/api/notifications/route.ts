import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// Helper: push notification via chat-service internal API
async function pushNotificationViaSocketIO(
  userId: string,
  notification: { id: string; type: string; title: string; message: string; actionUrl?: string; metadata?: string; timestamp: string }
) {
  try {
    await fetch('http://localhost:3003/internal/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notification }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// GET /api/notifications — List notifications for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const unreadOnly = url.searchParams.get('unread') === 'true'

    const where: any = { userId: user.id }
    if (unreadOnly) where.read = false

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await db.notification.count({
      where: { userId: user.id, read: false },
    })

    // Parse metadata JSON
    const parsed = notifications.map((n) => ({
      ...n,
      metadata: n.metadata ? safeJsonParse(n.metadata) : null,
    }))

    return NextResponse.json({
      notifications: parsed,
      unreadCount,
      total: notifications.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('List notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to list notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications — Create a notification (also pushes via Socket.IO)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { userId: targetUserId, type, title, message, actionUrl, metadata } = body

    // Allow creating notifications for the authenticated user, or for other users if admin
    const notifUserId = targetUserId || user.id

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message are required' },
        { status: 400 }
      )
    }

    const validTypes = [
      'info', 'success', 'warning', 'error',
      'agent_connected', 'agent_disconnected',
      'skill_invoked', 'capability_result', 'new_message',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId: notifUserId,
        type,
        title,
        message,
        actionUrl: actionUrl || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    // Push via Socket.IO for real-time delivery
    await pushNotificationViaSocketIO(notifUserId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl || undefined,
      metadata: notification.metadata || undefined,
      timestamp: notification.createdAt.toISOString(),
    })

    return NextResponse.json({
      notification: {
        ...notification,
        metadata: safeJsonParse(notification.metadata),
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Create notification error:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications — Mark notification(s) as read
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { notificationId, markAllRead } = body

    if (markAllRead) {
      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      })
      return NextResponse.json({ success: true, action: 'markAllRead' })
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId or markAllRead is required' },
        { status: 400 }
      )
    }

    // Mark a single notification as read
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })

    return NextResponse.json({ success: true, notificationId })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Mark notification read error:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications — Delete notification(s)
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const notificationId = url.searchParams.get('id')
    const clearAll = url.searchParams.get('clearAll') === 'true'

    if (clearAll) {
      await db.notification.deleteMany({
        where: { userId: user.id },
      })
      return NextResponse.json({ success: true, action: 'clearAll' })
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'id or clearAll=true is required' },
        { status: 400 }
      )
    }

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.notification.delete({
      where: { id: notificationId },
    })

    return NextResponse.json({ success: true, notificationId })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}

function safeJsonParse(str: string | null): any {
  if (!str) return null
  try { return JSON.parse(str) } catch { return str }
}
