import type { Announcements, CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'

export type DndModule = {
  type: string
  accepts: (data: unknown) => boolean
  instructions: string
  collision: CollisionDetection
  announcements: Announcements
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
  overlay: ReactNode
  wrap: (children: ReactNode) => ReactNode
}

export function dragTypeOf(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  const type = (data as Record<string, unknown>).type
  return typeof type === 'string' ? type : undefined
}
