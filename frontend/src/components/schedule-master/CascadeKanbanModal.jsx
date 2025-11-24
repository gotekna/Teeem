import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow'
import 'reactflow/dist/style.css'
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import TaskCardNode from './TaskCardNode'

// Register custom node types
const nodeTypes = {
  taskCard: TaskCardNode
}

/**
 * CascadeKanbanModal - Modern drag-and-drop interface for cascade dependencies
 * Uses vertical swim lanes (kanban-style) instead of checkbox lists
 */
export default function CascadeKanbanModal({
  isOpen,
  onClose,
  movedTask,
  unlockedSuccessors = [],
  blockedSuccessors = [],
  onConfirm,
  onUpdateTask
}) {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Track which zone each task is in
  const [taskZones, setTaskZones] = useState({})
  // Track directly locked tasks to break
  const [directlyLockedToBreak, setDirectlyLockedToBreak] = useState(new Set())

  // Initialize nodes and edges when modal opens
  useEffect(() => {
    if (!isOpen) {
      setNodes([])
      setEdges([])
      setTaskZones({})
      setDirectlyLockedToBreak(new Set())
      setIsInitialized(false)
      return
    }

    const newNodes = []
    const newEdges = []
    const initialZones = {}

    // Column configuration
    const COLUMN_WIDTH = 320
    const COLUMN_SPACING = 60
    const CARD_HEIGHT = 180
    const CARD_SPACING = 20
    const HEADER_HEIGHT = 100

    // Create swim lane headers (fixed position, not draggable)
    const swimLanes = [
      {
        id: 'header-cascade',
        zone: 'cascade',
        label: 'WILL CASCADE',
        subtitle: 'Move with parent',
        color: 'from-green-500 to-green-600',
        x: 0
      },
      {
        id: 'header-break',
        zone: 'break',
        label: 'WILL BREAK',
        subtitle: 'Stay in place',
        color: 'from-yellow-500 to-yellow-600',
        x: COLUMN_WIDTH + COLUMN_SPACING
      },
      {
        id: 'header-locked',
        zone: 'locked',
        label: 'LOCKED',
        subtitle: 'Cannot move',
        color: 'from-gray-500 to-gray-600',
        x: (COLUMN_WIDTH + COLUMN_SPACING) * 2
      }
    ]

    swimLanes.forEach((lane) => {
      newNodes.push({
        id: lane.id,
        type: 'default',
        position: { x: lane.x, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          label: (
            <div className={`bg-gradient-to-b ${lane.color} text-white rounded-t-lg px-6 py-4 text-center min-w-[280px]`}>
              <div className="font-bold text-base">{lane.label}</div>
              <div className="text-xs opacity-90 mt-1">{lane.subtitle}</div>
            </div>
          )
        },
        style: {
          background: 'transparent',
          border: 'none',
          width: COLUMN_WIDTH,
          padding: 0
        }
      })
    })

    // Process unlocked successors - initially in CASCADE zone
    let cascadeYOffset = HEADER_HEIGHT
    unlockedSuccessors.forEach((successor, index) => {
      const { task, depType, depLag } = successor
      const nodeId = `task-${task.id}`

      initialZones[task.id] = 'cascade'

      newNodes.push({
        id: nodeId,
        type: 'taskCard',
        position: { x: 0, y: cascadeYOffset },
        draggable: true,
        data: {
          task,
          zone: 'cascade',
          depType,
          depLag,
          requiredStart: successor.requiredStart,
          onUnlock: null
        }
      })

      cascadeYOffset += CARD_HEIGHT + CARD_SPACING
    })

    // Process directly locked successors - in LOCKED zone
    let lockedYOffset = HEADER_HEIGHT
    const directlyLocked = blockedSuccessors.filter(b => !b.lockedSuccessors || b.lockedSuccessors.length === 0)
    const initialDirectlyLockedToBreak = new Set(directlyLocked.map(b => b.task.id))

    directlyLocked.forEach((blockedInfo) => {
      const { task } = blockedInfo
      const nodeId = `task-${task.id}`

      initialZones[task.id] = 'locked'

      const lockReason = task.supplier_confirm
        ? 'Supplier Confirmed'
        : task.confirm
        ? 'Confirmed'
        : task.start
        ? 'Started'
        : task.complete
        ? 'Completed'
        : 'Locked'

      newNodes.push({
        id: nodeId,
        type: 'taskCard',
        position: { x: (COLUMN_WIDTH + COLUMN_SPACING) * 2, y: lockedYOffset },
        draggable: false, // Locked cards can't be dragged
        data: {
          task,
          zone: 'locked',
          lockReason,
          onUnlock: handleUnlockTask
        }
      })

      lockedYOffset += CARD_HEIGHT + CARD_SPACING
    })

    // Process tasks with locked successors - check for conflicts
    blockedSuccessors.forEach((blockedInfo) => {
      if (blockedInfo.lockedSuccessors && blockedInfo.lockedSuccessors.length > 0) {
        // Create edges to show locked successor relationships
        blockedInfo.lockedSuccessors.forEach((lockedTask) => {
          newEdges.push({
            id: `edge-${blockedInfo.task.id}-${lockedTask.id}`,
            source: `task-${blockedInfo.task.id}`,
            target: `task-${lockedTask.id}`,
            type: 'straight',
            animated: true,
            style: { stroke: '#f59e0b', strokeWidth: 2 },
            label: '⚠️ Conflict',
            labelStyle: { fill: '#f59e0b', fontWeight: 600, fontSize: 10 }
          })
        })
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)
    setTaskZones(initialZones)
    setDirectlyLockedToBreak(initialDirectlyLockedToBreak)
    setIsInitialized(true)
  }, [isOpen, unlockedSuccessors, blockedSuccessors])

  // Handle node drag end - determine which zone it's in
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds)

      // Check for position changes (drag end)
      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging === false && change.position) {
          const node = updatedNodes.find(n => n.id === change.id)
          if (!node || !node.id.startsWith('task-')) return

          const taskId = parseInt(node.id.replace('task-', ''))
          const x = change.position.x

          // Determine zone based on X position
          const COLUMN_WIDTH = 320
          const COLUMN_SPACING = 60

          let newZone
          if (x < COLUMN_WIDTH / 2) {
            newZone = 'cascade'
          } else if (x < COLUMN_WIDTH + COLUMN_SPACING + COLUMN_WIDTH / 2) {
            newZone = 'break'
          } else {
            newZone = 'locked' // Should not happen as locked cards aren't draggable
          }

          // Update zone
          setTaskZones(prev => ({
            ...prev,
            [taskId]: newZone
          }))

          // Update node data
          const nodeIndex = updatedNodes.findIndex(n => n.id === change.id)
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex].data = {
              ...updatedNodes[nodeIndex].data,
              zone: newZone
            }
          }

          // Snap to column
          const targetX = newZone === 'cascade' ? 0 :
                         newZone === 'break' ? COLUMN_WIDTH + COLUMN_SPACING :
                         (COLUMN_WIDTH + COLUMN_SPACING) * 2

          updatedNodes[nodeIndex].position.x = targetX
        }
      })

      return updatedNodes
    })
  }, [])

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const handleUnlockTask = async (lockedTask) => {
    if (!onUpdateTask) return

    // Determine which lock field to clear
    const updateData = {}
    if (lockedTask.supplier_confirm) {
      updateData.supplier_confirm = false
    } else if (lockedTask.confirm) {
      updateData.confirm = false
    } else if (lockedTask.start) {
      updateData.start = false
    } else if (lockedTask.complete) {
      updateData.complete = false
    }

    await onUpdateTask(lockedTask.id, updateData)
  }

  const handleApply = () => {
    // Build result based on task zones
    const tasksToMove = unlockedSuccessors.filter(s => taskZones[s.task.id] === 'cascade')
    const tasksToUnlink = unlockedSuccessors.filter(s => taskZones[s.task.id] === 'break')

    onConfirm({
      cascade: tasksToMove,
      unlinkUnselected: tasksToUnlink,
      breakBlocked: blockedSuccessors,
      lockedSuccessorsToKeep: {}, // No nested locked successors in kanban mode
      directlyLockedToBreak: Array.from(directlyLockedToBreak)
    })
    onClose()
  }

  // Detect conflicts
  const conflicts = useMemo(() => {
    const conflictList = []

    blockedSuccessors.forEach((blockedInfo) => {
      if (blockedInfo.lockedSuccessors && blockedInfo.lockedSuccessors.length > 0) {
        const parentZone = taskZones[blockedInfo.task.id]
        if (parentZone === 'cascade') {
          // Conflict: trying to cascade a task that has locked successors
          conflictList.push({
            parentTask: blockedInfo.task,
            lockedSuccessors: blockedInfo.lockedSuccessors
          })
        }
      }
    })

    return conflictList
  }, [taskZones, blockedSuccessors])

  const hasConflicts = conflicts.length > 0

  // Calculate summary stats
  const cascadeCount = Object.values(taskZones).filter(z => z === 'cascade').length
  const breakCount = Object.values(taskZones).filter(z => z === 'break').length
  const lockedCount = Object.values(taskZones).filter(z => z === 'locked').length

  if (!isOpen) return null
  if (!isInitialized) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: '2147483647' }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-6 text-white rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          <h3 className="text-2xl font-bold">Cascade Dependencies</h3>
          <p className="mt-2 text-white/90 text-sm">
            Moving "{movedTask?.text || 'this task'}" affects {unlockedSuccessors.length + blockedSuccessors.length} dependent tasks
          </p>
          <p className="mt-3 text-white/80 text-xs font-medium">
            💡 Drag cards between columns to choose behavior
          </p>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 p-6">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
              includeHiddenNodes: false
            }}
            minZoom={0.5}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#94a3b8" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Footer with summary and actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          {/* Conflict Warning */}
          {hasConflicts && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                ⚠️ Conflict Detected
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                Move {conflicts.length} task{conflicts.length > 1 ? 's' : ''} to "Will Break" column to resolve conflicts
              </p>
            </div>
          )}

          {/* Summary Stats */}
          <div className="mb-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{cascadeCount}</span> will cascade
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{breakCount}</span> will break
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{lockedCount}</span> locked
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={hasConflicts}
              className={`px-6 py-2.5 text-sm text-white rounded-lg flex items-center gap-2 transition-all ${
                hasConflicts
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl'
              }`}
              title={hasConflicts ? 'Resolve conflicts before applying' : 'Apply cascade changes'}
            >
              <CheckCircleIcon className="h-5 w-5" />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper to get today in company timezone (matching existing implementation)
function getTodayInCompanyTimezone() {
  // This should match the existing implementation in CascadeDependenciesModal
  // For now, using simple Date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}
