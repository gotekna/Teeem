import { useState, useEffect, useMemo } from 'react'
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline'

/**
 * CascadeDependenciesModal - Modal for choosing which dependent tasks to cascade when moving a task
 */
export default function CascadeDependenciesModal({
  isOpen,
  onClose,
  movedTask,
  unlockedSuccessors = [],
  blockedSuccessors = [],
  onConfirm,
  onUpdateTask
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState([])
  // Map of parent task ID -> Set of locked successor IDs to keep (not break)
  const [lockedSuccessorsToKeep, setLockedSuccessorsToKeep] = useState({})
  // Track which directly locked successors should have dependencies broken (default: all broken)
  const [directlyLockedToBreak, setDirectlyLockedToBreak] = useState(new Set())
  // Track if we've initialized the state
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // By default, select all unlocked successors to cascade
    // KEEP locked successors by default (they will be ticked/checked) - representing current state
    if (!isOpen) {
      // Reset state when modal closes
      setSelectedTaskIds([])
      setLockedSuccessorsToKeep({})
      setDirectlyLockedToBreak(new Set())
      setIsInitialized(false)
      return
    }

    // Initialize with locked successor dependencies UNTICKED (break the link to avoid conflicts)
    // This allows unlocked parents to move while keeping locked children stationary
    const initialLockedSuccessors = {}
    blockedSuccessors.forEach(blockedInfo => {
      if (blockedInfo.lockedSuccessors && blockedInfo.lockedSuccessors.length > 0) {
        // Initialize with EMPTY set (all unticked) - breaks dependencies to locked children
        initialLockedSuccessors[blockedInfo.task.id] = new Set()
      }
    })

    // Initialize directly locked successors to have dependencies broken by default
    const directlyLocked = blockedSuccessors
      .filter(b => b.lockedSuccessors && b.lockedSuccessors.length === 0)
      .map(b => b.task.id)
    const initialDirectlyLockedToBreak = new Set(directlyLocked)

    // Select ALL unlocked successors for cascading (including those with locked dependencies)
    // The locked dependencies will be broken (unticked) to avoid conflicts
    const allUnlockedIds = unlockedSuccessors.map(s => s.task.id)

    console.log('🔓 Initialized with locked successor dependencies UNTICKED (breaks links to avoid conflicts):', Object.fromEntries(
      Object.entries(initialLockedSuccessors).map(([k, v]) => [k, Array.from(v)])
    ))
    console.log('✅ Auto-selected ALL unlocked tasks for cascading:', allUnlockedIds)
    console.log('🔒 Directly locked tasks to break dependencies:', Array.from(initialDirectlyLockedToBreak))

    // Batch state updates together
    setLockedSuccessorsToKeep(initialLockedSuccessors)
    setSelectedTaskIds(allUnlockedIds)
    setDirectlyLockedToBreak(initialDirectlyLockedToBreak)
    setIsInitialized(true)
  }, [isOpen, unlockedSuccessors, blockedSuccessors])

  if (!isOpen) return null

  // Don't render until state is initialized to avoid conflicts
  if (!isInitialized) return null

  // Detect conflicts: cascading a parent while keeping link to locked child
  // Use defensive checks to prevent errors
  const getConflicts = () => {
    const conflictList = []

    try {
      if (!Array.isArray(selectedTaskIds)) return []
      if (!Array.isArray(blockedSuccessors)) return []
      if (!lockedSuccessorsToKeep) return []

      selectedTaskIds.forEach(taskId => {
        const blockedInfo = blockedSuccessors.find(b => b && b.task && b.task.id === taskId)
        if (!blockedInfo || !Array.isArray(blockedInfo.lockedSuccessors)) return

        const keptLockedSuccessors = blockedInfo.lockedSuccessors.filter(ls => {
          if (!ls || !ls.id) return false
          const keptSet = lockedSuccessorsToKeep[taskId]
          // Only consider it a conflict if the checkbox is actually checked (kept in the Set)
          return keptSet && keptSet.has && keptSet.has(ls.id)
        })

        if (keptLockedSuccessors.length > 0) {
          conflictList.push({
            parentTask: blockedInfo.task,
            lockedSuccessors: keptLockedSuccessors
          })
        }
      })
    } catch (error) {
      console.error('Error computing conflicts:', error)
      return []
    }

    return conflictList
  }

  const conflicts = getConflicts()
  const hasConflicts = conflicts.length > 0

  const handleToggleTask = (taskId, isBlocked) => {
    if (isBlocked) return // Can't toggle blocked tasks

    // Check current state to determine if we're selecting or deselecting
    const willBeSelected = !selectedTaskIds.includes(taskId)

    // If we're selecting this task to cascade, auto-uncheck all its locked successors
    // (because you can't cascade a task while keeping locked dependencies)
    if (willBeSelected) {
      const blockedInfo = blockedSuccessors.find(b => b.task.id === taskId)
      if (blockedInfo && blockedInfo.lockedSuccessors && blockedInfo.lockedSuccessors.length > 0) {
        setLockedSuccessorsToKeep(prevLocked => {
          const newMap = { ...prevLocked }
          // Clear all locked successors for this task (untick them all)
          newMap[taskId] = new Set()
          console.log(`✅ Auto-unchecked all locked successors for task #${taskId} because cascade was selected`)
          return newMap
        })
      }
    }

    // Update selected tasks (separate state update, not nested)
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  const handleToggleLockedSuccessor = (parentTaskId, lockedSuccessorId) => {
    setLockedSuccessorsToKeep(prev => {
      const newMap = { ...prev }
      const currentSet = new Set(newMap[parentTaskId] || [])

      if (currentSet.has(lockedSuccessorId)) {
        // Currently keeping, so user wants to break it - remove from keep set
        currentSet.delete(lockedSuccessorId)
        console.log(`🔓 Unchecked: Will now BREAK dependency from #${parentTaskId} to #${lockedSuccessorId}`)
      } else {
        // Currently breaking, so user wants to keep it - add to keep set
        currentSet.add(lockedSuccessorId)
        console.log(`🔒 Checked: Will now KEEP dependency from #${parentTaskId} to #${lockedSuccessorId}`)

        // Auto-uncheck the parent cascade checkbox because you can't cascade while keeping locked dependencies
        setSelectedTaskIds(prevSelected => {
          if (prevSelected.includes(parentTaskId)) {
            console.log(`✅ Auto-unchecked cascade for task #${parentTaskId} because locked dependency was selected to keep`)
            return prevSelected.filter(id => id !== parentTaskId)
          }
          return prevSelected
        })
      }

      newMap[parentTaskId] = currentSet
      console.log('📊 Updated lockedSuccessorsToKeep:', Object.fromEntries(
        Object.entries(newMap).map(([k, v]) => [k, Array.from(v)])
      ))
      return newMap
    })
  }

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

    // Update the task
    await onUpdateTask(lockedTask.id, updateData)
  }

  const handleCascade = () => {
    // Return which tasks to cascade and which to break dependencies for
    const tasksToMove = unlockedSuccessors.filter(s => selectedTaskIds.includes(s.task.id))
    const tasksToUnlink = unlockedSuccessors.filter(s => !selectedTaskIds.includes(s.task.id))

    // Convert lockedSuccessorsToKeep Sets to arrays for easier consumption
    const lockedSuccessorsToKeepArray = {}
    Object.keys(lockedSuccessorsToKeep).forEach(parentId => {
      lockedSuccessorsToKeepArray[parentId] = Array.from(lockedSuccessorsToKeep[parentId])
    })

    onConfirm({
      cascade: tasksToMove,
      unlinkUnselected: tasksToUnlink,
      breakBlocked: blockedSuccessors,
      lockedSuccessorsToKeep: lockedSuccessorsToKeepArray,
      directlyLockedToBreak: Array.from(directlyLockedToBreak)
    })
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const totalAffected = unlockedSuccessors.length + blockedSuccessors.length
  const selectedCount = selectedTaskIds.length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: '2147483647' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Cascade Dependencies?
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Moving "{movedTask?.text || 'this task'}" to {(() => {
                  if (!movedTask?.start_date) return 'new date';
                  const moveDate = new Date(movedTask.start_date);
                  moveDate.setHours(0, 0, 0, 0);
                  return moveDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
                })()} affects {totalAffected} dependent task{totalAffected !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Task Lists */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* All Affected Dependencies */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              Affected Dependencies
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Moving "{movedTask?.text || 'this task'}" affects these dependencies:
            </p>
            <div className="space-y-3 text-sm">
              {/* Show moved task */}
              <div className="flex items-center gap-2 pl-4 relative">
                <div className="absolute left-0 top-1/2 w-3 h-0.5 bg-blue-400 dark:bg-blue-500" style={{ transform: 'translateY(-50%)' }}></div>
                <span className="font-mono text-xs text-gray-600 dark:text-gray-400">#{movedTask?.id}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{movedTask?.text}</span>
                <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                  MOVED
                </span>
              </div>

              {/* Show dependency lines to successors */}
              <div className="pl-8 space-y-2 relative">
                {/* Vertical connector line */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-400 dark:bg-blue-500"></div>

                {/* Show unlocked successors */}
                {unlockedSuccessors.map((successor, index) => {
                  const { task, depType, depLag } = successor

                  // Find locked successors for this task
                  const blockedInfo = blockedSuccessors.find(b => b.task.id === task.id)

                  return (
                    <div key={task.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 relative">
                        {/* Horizontal connector */}
                        <div className="absolute -left-5 top-1/2 w-4 h-0.5 bg-blue-400 dark:bg-blue-500" style={{ transform: 'translateY(-50%)' }}>
                          <div className="absolute right-0 top-1/2 w-0 h-0 border-l-4 border-t-2 border-b-2 border-blue-400 dark:border-blue-500 border-t-transparent border-b-transparent" style={{ transform: 'translateY(-50%)' }}></div>
                        </div>

                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">#{task.id}</span>
                        <span>{task.text}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {depType}{depLag > 0 ? '+' + depLag : depLag < 0 ? depLag : ''}
                        </span>
                      </div>

                      {/* Show nested locked successors */}
                      {blockedInfo && blockedInfo.lockedSuccessors && blockedInfo.lockedSuccessors.length > 0 && (
                        <div className="pl-8 space-y-1 relative">
                          {/* Nested vertical connector */}
                          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-purple-400 dark:bg-purple-500"></div>

                          {blockedInfo.lockedSuccessors.map((lockedTask) => {
                            const lockColor = lockedTask.supplier_confirm
                              ? 'text-purple-700 dark:text-purple-300'
                              : 'text-blue-700 dark:text-blue-300'

                            const badgeColor = lockedTask.supplier_confirm
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'

                            const lockReason = lockedTask.supplier_confirm
                              ? 'Supplier Confirmed'
                              : lockedTask.confirm
                              ? 'Confirmed'
                              : lockedTask.start
                              ? 'Started'
                              : 'Completed'

                            // Format the task's scheduled start date
                            const projectStartDate = getTodayInCompanyTimezone()
                            projectStartDate.setHours(0, 0, 0, 0)
                            const taskDate = new Date(projectStartDate)
                            taskDate.setDate(taskDate.getDate() + (lockedTask.start_date || 0))
                            const taskDateStr = taskDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

                            return (
                              <div key={lockedTask.id} className={`flex items-center gap-2 ${lockColor} relative`}>
                                {/* Horizontal connector */}
                                <div className="absolute -left-5 top-1/2 w-4 h-0.5 bg-purple-400 dark:bg-purple-500" style={{ transform: 'translateY(-50%)' }}>
                                  <div className="absolute right-0 top-1/2 w-0 h-0 border-l-4 border-t-2 border-b-2 border-purple-400 dark:border-purple-500 border-t-transparent border-b-transparent" style={{ transform: 'translateY(-50%)' }}></div>
                                </div>

                                <LockClosedIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="font-mono text-xs text-gray-600 dark:text-gray-400">#{lockedTask.id}</span>
                                <span className="text-sm">{lockedTask.text}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColor}`}>
                                  {lockReason}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-mono">
                                  Scheduled: {taskDateStr}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Show directly locked successors (tasks that depend on moved task but are locked) */}
                {blockedSuccessors.filter(b => b.lockedSuccessors && b.lockedSuccessors.length === 0).map((blockedInfo) => {
                  const { task } = blockedInfo

                  const lockColor = task.supplier_confirm
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-blue-700 dark:text-blue-300'

                  const badgeColor = task.supplier_confirm
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'

                  const lockReason = task.supplier_confirm
                    ? 'Supplier Confirmed'
                    : task.confirm
                    ? 'Confirmed'
                    : task.start
                    ? 'Started'
                    : task.complete
                    ? 'Completed'
                    : task.manually_positioned || task.$manuallyPositioned
                    ? 'Locked'
                    : 'Locked'

                  return (
                    <div key={task.id} className="space-y-2">
                      <div className={`flex items-center gap-2 ${lockColor} relative`}>
                        {/* Horizontal connector */}
                        <div className="absolute -left-5 top-1/2 w-4 h-0.5 bg-blue-400 dark:bg-blue-500" style={{ transform: 'translateY(-50%)' }}>
                          <div className="absolute right-0 top-1/2 w-0 h-0 border-l-4 border-t-2 border-b-2 border-blue-400 dark:border-blue-500 border-t-transparent border-b-transparent" style={{ transform: 'translateY(-50%)' }}></div>
                        </div>

                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">#{task.id}</span>
                        <span>{task.text}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColor}`}>
                          {lockReason}
                        </span>
                        <LockClosedIcon className="h-4 w-4" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Unlocked Successors - Can Cascade */}
          {unlockedSuccessors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Can Cascade ({unlockedSuccessors.length})
                </h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                These tasks can move automatically to maintain dependencies. Select which ones to cascade:
              </p>
              <div className="space-y-2">
                {unlockedSuccessors.map((successor) => {
                  const { task, depType, depLag } = successor
                  const isSelected = selectedTaskIds.includes(task.id)

                  // Find if this task is in blockedSuccessors (has locked children)
                  const blockedInfo = blockedSuccessors.find(b => b.task.id === task.id)

                  return (
                    <div key={task.id}>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleTask(task.id, false)}
                          className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              #{task.id}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {task.text}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              {depType}{depLag > 0 ? '+' + depLag : depLag < 0 ? depLag : ''}
                            </span>
                            {successor.requiredStart !== undefined && (
                              <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded font-mono">
                                Will move to: {(() => {
                                  // requiredStart is a Date object
                                  const moveDate = new Date(successor.requiredStart)
                                  moveDate.setHours(0, 0, 0, 0)
                                  console.log(`📅 Modal display - Task #${task.id}: requiredStart=${successor.requiredStart}, moveDate=${moveDate.toISOString().split('T')[0]}, formatted=${moveDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`)
                                  return moveDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                                })()}
                              </span>
                            )}
                            {task.dependencies_broken && (
                              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                                Currently Broken - Will Restore
                              </span>
                            )}
                          </div>
                          {task.supplier_name && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Supplier: {task.supplier_name}
                            </p>
                          )}
                        </div>
                      </label>

                      {/* Show nested locked successors if this task has them */}
                      {blockedInfo && blockedInfo.lockedSuccessors.length > 0 && (
                        <div className="ml-8 mt-2 space-y-2 relative">
                          {/* Dependency connector line */}
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-300 dark:bg-yellow-600" style={{ left: '-4px' }}></div>

                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>These locked dependencies conflict with cascading:</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 ml-4 italic">
                            Unchecked by default (breaks dependency). Check to keep the link and prevent cascading.
                          </p>
                          {blockedInfo.lockedSuccessors.map((lockedTask) => {
                            const isKept = lockedSuccessorsToKeep[task.id]?.has(lockedTask.id)

                            const lockReason = lockedTask.supplier_confirm
                              ? 'Supplier Confirmed'
                              : lockedTask.confirm
                              ? 'Confirmed'
                              : lockedTask.start
                              ? 'Started'
                              : 'Completed'

                            const lockColor = lockedTask.supplier_confirm
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'

                            // Format the locked date
                            const lockedDate = new Date(lockedTask.start_date)
                            lockedDate.setHours(0, 0, 0, 0)
                            const lockedDateStr = lockedDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

                            return (
                              <div
                                key={lockedTask.id}
                                className={`flex items-start gap-2 p-2 rounded-lg border-2 ${lockColor} hover:shadow-md transition-shadow relative`}
                              >
                                {/* Arrow connector */}
                                <div className="absolute -left-8 top-1/2 w-4 h-0.5 bg-yellow-300 dark:bg-yellow-600" style={{ transform: 'translateY(-50%)' }}>
                                  <div className="absolute right-0 top-1/2 w-0 h-0 border-l-4 border-t-2 border-b-2 border-yellow-300 dark:border-yellow-600 border-t-transparent border-b-transparent" style={{ transform: 'translateY(-50%)' }}></div>
                                </div>

                                <input
                                  type="checkbox"
                                  checked={isKept}
                                  onChange={() => handleToggleLockedSuccessor(task.id, lockedTask.id)}
                                  className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                  title={isKept ? "Checked (default) - Reflects current locked state. Uncheck to break dependency and allow cascading." : "Unchecked - Will break this dependency to allow cascading"}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <LockClosedIcon className="h-3 w-3 flex-shrink-0" />
                                    <span className="font-mono text-gray-600 dark:text-gray-400">
                                      #{lockedTask.id}
                                    </span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                      {lockedTask.text}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold">
                                      {lockReason}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                                      Scheduled: {lockedDateStr}
                                    </span>
                                    {isKept ? (
                                      <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-semibold">
                                        ⚠️ Locked (Default)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold">
                                        ✓ Will Break
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">
                                      Dependency: {task.text} → {lockedTask.text}
                                    </p>
                                    <label className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5">
                                      <input
                                        type="checkbox"
                                        checked={!isKept}
                                        onChange={() => handleUnlockTask(lockedTask)}
                                        className="h-3 w-3 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                        title={!isKept ? `Checked - Task IS ${lockReason} (locked and will stay stationary)` : `Unchecked - Will remove ${lockReason} status to allow cascading`}
                                      />
                                      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {lockReason}
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Blocked Successors - Cannot Cascade */}
          {blockedSuccessors.filter(b => b.lockedSuccessors && b.lockedSuccessors.length === 0).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LockClosedIcon className="h-5 w-5 text-red-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Blocked - Cannot Cascade ({blockedSuccessors.filter(b => b.lockedSuccessors && b.lockedSuccessors.length === 0).length})
                </h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                These tasks are locked and cannot move automatically. Their dependencies will be broken:
              </p>
              <div className="space-y-2">
                {blockedSuccessors.filter(b => b.lockedSuccessors && b.lockedSuccessors.length === 0).map((blockedInfo) => {
                  const { task } = blockedInfo

                  const lockReason = task.supplier_confirm
                    ? 'Supplier Confirmed'
                    : task.confirm
                    ? 'Confirmed'
                    : task.start
                    ? 'Started'
                    : task.complete
                    ? 'Completed'
                    : task.manually_positioned || task.$manuallyPositioned
                    ? 'Locked'
                    : 'Locked'

                  const lockColor = task.supplier_confirm
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'

                  return (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 ${lockColor}`}>
                      <LockClosedIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">#{task.id}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {task.text}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded font-semibold">
                            {lockReason}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                            Will Break Dependency
                          </span>
                        </div>
                        {task.supplier_name && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Supplier: {task.supplier_name}
                          </p>
                        )}
                        <div className="mt-2 flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1">
                            <input
                              type="checkbox"
                              checked={directlyLockedToBreak.has(task.id)}
                              onChange={() => {
                                setDirectlyLockedToBreak(prev => {
                                  const next = new Set(prev)
                                  if (next.has(task.id)) {
                                    next.delete(task.id)
                                  } else {
                                    next.add(task.id)
                                  }
                                  return next
                                })
                              }}
                              className="h-3 w-3 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              title="Check to break the dependency with this locked task"
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              Break dependency (task stays locked and stationary)
                            </span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1">
                            <input
                              type="checkbox"
                              checked={task.supplier_confirm || task.confirm || task.start || task.complete || task.manually_positioned || task.$manuallyPositioned}
                              onChange={() => handleUnlockTask(task)}
                              className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              title={`Currently ${lockReason} - untick to unlock this task and allow it to cascade`}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {lockReason} (untick to unlock and cascade)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Note: Blocked successors are now shown inline under their parent tasks above */}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          {/* Conflict Warning */}
          {hasConflicts && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                Conflict Detected
              </p>
              <ul className="mt-2 text-xs text-red-700 dark:text-red-400 space-y-1 ml-4 list-disc">
                {conflicts.map(conflict => (
                  <li key={conflict.parentTask.id}>
                    Cannot cascade <strong>{conflict.parentTask.text}</strong> while keeping link to locked task{conflict.lockedSuccessors.length > 1 ? 's' : ''}: {conflict.lockedSuccessors.map(ls => `#${ls.id} ${ls.text}`).join(', ')}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">
                → To resolve: Either (1) Uncheck the locked successor checkbox to break the dependency, OR (2) Uncheck the parent task to not cascade it
              </p>
            </div>
          )}

          {/* Summary */}
          <div className={`mb-4 p-3 rounded-lg ${hasConflicts ? 'bg-gray-50 dark:bg-gray-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>What will happen:</strong>
            </p>
            <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
              {selectedCount > 0 && (
                <li>{selectedCount} task{selectedCount !== 1 ? 's' : ''} will cascade to maintain dependencies</li>
              )}
              {unlockedSuccessors.length - selectedCount > 0 && (
                <li className="text-yellow-600 dark:text-yellow-400">
                  {unlockedSuccessors.length - selectedCount} unselected task{unlockedSuccessors.length - selectedCount !== 1 ? 's' : ''} will have dependencies broken
                </li>
              )}
              {blockedSuccessors.reduce((count, b) => count + (b.lockedSuccessors?.length || 0), 0) > 0 && (
                <li className={hasConflicts ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                  {(() => {
                    const totalLocked = blockedSuccessors.reduce((count, b) => count + (b.lockedSuccessors?.length || 0), 0)
                    const keptCount = blockedSuccessors.reduce((count, b) => {
                      const kept = b.lockedSuccessors?.filter(ls => lockedSuccessorsToKeep[b.task.id]?.has(ls.id)) || []
                      return count + kept.length
                    }, 0)
                    const breakCount = totalLocked - keptCount

                    if (keptCount > 0) {
                      return `⚠️ ${keptCount} locked ${keptCount !== 1 ? 'dependencies' : 'dependency'} checked (default - reflects current state) - causing conflict. Uncheck to break and allow cascading.`
                    } else {
                      return `✓ ${breakCount} locked ${breakCount !== 1 ? 'dependencies' : 'dependency'} will be broken`
                    }
                  })()}
                </li>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel Move
            </button>
            <button
              onClick={handleCascade}
              disabled={hasConflicts}
              className={`px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 ${
                hasConflicts
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={hasConflicts ? 'Resolve conflicts before applying' : ''}
            >
              <CheckCircleIcon className="h-4 w-4" />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
