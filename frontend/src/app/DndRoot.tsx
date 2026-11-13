import {
  type Announcements,
  closestCenter,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { type ReactNode, useState } from 'react'

import { type DndModule, dragTypeOf } from './dndModule'

function keyboardCoordinatesFor(modules: DndModule[]): KeyboardCoordinateGetter {
  return (event, args) => {
    const module = modules.find((candidate) => candidate.type === dragTypeOf(args.context.active?.data.current))
    if (module === undefined) {
      return sortableKeyboardCoordinates(event, args)
    }
    const containers = args.context.droppableContainers
    const accepted = {
      getEnabled: () => containers.getEnabled().filter((container) => module.accepts(container.data.current)),
      get: (id: Parameters<typeof containers.get>[0]) => containers.get(id),
    } as unknown as typeof containers
    return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: accepted } })
  }
}

export function DndRoot({ modules, children }: { modules: DndModule[]; children: ReactNode }) {
  const [activeType, setActiveType] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinatesFor(modules) }),
  )

  const moduleOf = (data: unknown): DndModule | undefined => modules.find((module) => module.type === dragTypeOf(data))

  const collisionDetection: CollisionDetection = (args) => {
    const module = moduleOf(args.active.data.current)
    return module === undefined ? closestCenter(args) : module.collision(args)
  }

  const announcements: Announcements = {
    onDragStart: (event) => moduleOf(event.active.data.current)?.announcements.onDragStart(event),
    onDragOver: (event) => moduleOf(event.active.data.current)?.announcements.onDragOver(event),
    onDragEnd: (event) => moduleOf(event.active.data.current)?.announcements.onDragEnd(event),
    onDragCancel: (event) => moduleOf(event.active.data.current)?.announcements.onDragCancel(event),
  }

  const active = modules.find((module) => module.type === activeType)
  const wrapped = modules.reduceRight<ReactNode>((inner, module) => module.wrap(inner), children)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: modules[0]?.instructions ?? '' } }}
      onDragStart={(event) => {
        setActiveType(dragTypeOf(event.active.data.current) ?? null)
        moduleOf(event.active.data.current)?.onDragStart(event)
      }}
      onDragOver={(event) => moduleOf(event.active.data.current)?.onDragOver(event)}
      onDragEnd={(event) => {
        moduleOf(event.active.data.current)?.onDragEnd(event)
        setActiveType(null)
      }}
      onDragCancel={(event) => {
        moduleOf(event.active.data.current)?.onDragCancel()
        setActiveType(null)
      }}
    >
      {wrapped}
      <DragOverlay>{active?.overlay ?? null}</DragOverlay>
    </DndContext>
  )
}
