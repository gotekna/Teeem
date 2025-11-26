import { useState, useEffect } from 'react'
import { api } from '../../api'
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  CheckIcon
} from '@heroicons/react/24/outline'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableStatusItem({ status, isSelected, onSelect, onRemove, onPositionChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: status.job_type_status_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0
  }

  const [editingPosition, setEditingPosition] = useState(false)
  const [positionValue, setPositionValue] = useState(status.position)

  const handlePositionSubmit = () => {
    const newPosition = parseInt(positionValue, 10)
    if (!isNaN(newPosition) && newPosition !== status.position) {
      onPositionChange(status.job_type_status_id, newPosition)
    }
    setEditingPosition(false)
  }

  const handlePositionKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePositionSubmit()
    } else if (e.key === 'Escape') {
      setPositionValue(status.position)
      setEditingPosition(false)
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center gap-2 flex-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Bars3Icon className="h-4 w-4" />
        </button>
        {editingPosition ? (
          <input
            type="number"
            value={positionValue}
            onChange={(e) => setPositionValue(e.target.value)}
            onBlur={handlePositionSubmit}
            onKeyDown={handlePositionKeyDown}
            className="w-12 px-1 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingPosition(true)}
            className="w-8 h-6 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Click to edit sort order"
          >
            {status.position}
          </button>
        )}
        <button
          onClick={() => onSelect(status)}
          className="flex-1 text-left flex items-center gap-2"
        >
          <span className={`w-2 h-2 rounded-sm ${
            status.color === 'gray' ? 'bg-gray-400' :
            status.color === 'yellow' ? 'bg-yellow-400' :
            status.color === 'orange' ? 'bg-orange-400' :
            status.color === 'blue' ? 'bg-blue-400' :
            status.color === 'purple' ? 'bg-purple-400' :
            status.color === 'indigo' ? 'bg-indigo-400' :
            status.color === 'green' ? 'bg-green-400' :
            status.color === 'teal' ? 'bg-teal-400' :
            status.color === 'slate' ? 'bg-slate-400' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {status.name}
          </span>
        </button>
      </div>
      <button
        onClick={() => onRemove(status.job_type_status_id)}
        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </li>
  )
}

export default function DependencyConfigTab() {
  // All available types, statuses, and stages
  const [allTypes, setAllTypes] = useState([])
  const [allStatuses, setAllStatuses] = useState([])
  const [allStages, setAllStages] = useState([])

  // Selected items
  const [selectedType, setSelectedType] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)

  // Configured relationships
  const [typeStatuses, setTypeStatuses] = useState([]) // Statuses for selected type
  const [statusStages, setStatusStages] = useState([]) // Stages for selected type+status

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    if (selectedType) {
      loadTypeStatuses(selectedType.id)
    } else {
      setTypeStatuses([])
      setSelectedStatus(null)
    }
  }, [selectedType])

  useEffect(() => {
    if (selectedType && selectedStatus) {
      loadStatusStages(selectedType.id, selectedStatus.id)
    } else {
      setStatusStages([])
    }
  }, [selectedType, selectedStatus])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get('/api/v1/job_types'),
        api.get('/api/v1/job_status'),
        api.get('/api/v1/job_stages')
      ])
      setAllTypes(typesRes.job_types || [])
      setAllStatuses(statusesRes.job_statuses || [])
      setAllStages(stagesRes.job_stages || [])

      // Auto-select first type
      if (typesRes.job_types?.length > 0) {
        setSelectedType(typesRes.job_types[0])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTypeStatuses = async (typeId) => {
    try {
      const res = await api.get(`/api/v1/job_types/${typeId}/statuses`)
      setTypeStatuses(res.statuses || [])

      // Auto-select first status if available
      if (res.statuses?.length > 0) {
        setSelectedStatus(res.statuses[0])
      } else {
        setSelectedStatus(null)
      }
    } catch (err) {
      console.error('Failed to load type statuses:', err)
      setTypeStatuses([])
    }
  }

  const loadStatusStages = async (typeId, statusId) => {
    try {
      const res = await api.get(`/api/v1/job_types/${typeId}/statuses/${statusId}/stages`)
      setStatusStages(res.stages || [])
    } catch (err) {
      console.error('Failed to load status stages:', err)
      setStatusStages([])
    }
  }

  const handleAddStatus = async (statusId) => {
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses`, {
        job_status_id: statusId
      })
      await loadTypeStatuses(selectedType.id)
    } catch (err) {
      console.error('Failed to add status:', err)
      alert(err.message || 'Failed to add status')
    }
  }

  const handleRemoveStatus = async (jobTypeStatusId) => {
    if (!confirm('Remove this status from this type? Jobs using this combination may be affected.')) return
    try {
      await api.delete(`/api/v1/job_type_statuses/${jobTypeStatusId}`)
      await loadTypeStatuses(selectedType.id)
    } catch (err) {
      console.error('Failed to remove status:', err)
      alert(err.message || 'Failed to remove status')
    }
  }

  const handleAddStage = async (stageId) => {
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses/${selectedStatus.id}/stages`, {
        job_stage_id: stageId
      })
      await loadStatusStages(selectedType.id, selectedStatus.id)
    } catch (err) {
      console.error('Failed to add stage:', err)
      alert(err.message || 'Failed to add stage')
    }
  }

  const handleRemoveStage = async (jobStatusStageId) => {
    if (!confirm('Remove this stage from this status? Jobs using this combination may be affected.')) return
    try {
      await api.delete(`/api/v1/job_status_stages/${jobStatusStageId}`)
      await loadStatusStages(selectedType.id, selectedStatus.id)
    } catch (err) {
      console.error('Failed to remove stage:', err)
      alert(err.message || 'Failed to remove stage')
    }
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = typeStatuses.findIndex(s => s.job_type_status_id === active.id)
    const newIndex = typeStatuses.findIndex(s => s.job_type_status_id === over.id)

    const reordered = arrayMove(typeStatuses, oldIndex, newIndex)
    setTypeStatuses(reordered)

    // Save new order to backend
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses/reorder`, {
        job_type_status_ids: reordered.map(s => s.job_type_status_id)
      })
      // Reload to get updated positions
      await loadTypeStatuses(selectedType.id)
    } catch (err) {
      console.error('Failed to reorder statuses:', err)
      // Reload to restore original order
      await loadTypeStatuses(selectedType.id)
    }
  }

  const handlePositionChange = async (jobTypeStatusId, newPosition) => {
    // Find current status and calculate new order
    const currentIndex = typeStatuses.findIndex(s => s.job_type_status_id === jobTypeStatusId)
    if (currentIndex === -1) return

    // Sort by position and find target index
    const sorted = [...typeStatuses].sort((a, b) => a.position - b.position)
    let targetIndex = sorted.findIndex(s => s.position >= newPosition)
    if (targetIndex === -1) targetIndex = sorted.length

    // Don't move if already at position
    if (sorted[targetIndex]?.job_type_status_id === jobTypeStatusId) return

    // Create reordered list
    const currentStatus = typeStatuses[currentIndex]
    const withoutCurrent = sorted.filter(s => s.job_type_status_id !== jobTypeStatusId)
    const reordered = [
      ...withoutCurrent.slice(0, targetIndex > currentIndex ? targetIndex - 1 : targetIndex),
      currentStatus,
      ...withoutCurrent.slice(targetIndex > currentIndex ? targetIndex - 1 : targetIndex)
    ]

    setTypeStatuses(reordered)

    // Save new order to backend
    try {
      await api.post(`/api/v1/job_types/${selectedType.id}/statuses/reorder`, {
        job_type_status_ids: reordered.map(s => s.job_type_status_id)
      })
      // Reload to get updated positions
      await loadTypeStatuses(selectedType.id)
    } catch (err) {
      console.error('Failed to reorder statuses:', err)
      // Reload to restore original order
      await loadTypeStatuses(selectedType.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/10 p-4">
        <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
      </div>
    )
  }

  // Get available statuses (not yet added to this type)
  const availableStatuses = allStatuses.filter(
    s => !typeStatuses.find(ts => ts.id === s.id)
  )

  // Get available stages (not yet added to this type+status)
  const availableStages = allStages.filter(
    s => !statusStages.find(ss => ss.id === s.id)
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Job Workflow Configuration
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure which statuses are available for each job type, and which stages are available for each status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Job Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
            Job Types
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Select a type to configure its statuses
          </p>
          <ul className="space-y-2">
            {allTypes.map((type) => (
              <li key={type.id}>
                <button
                  onClick={() => setSelectedType(type)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedType?.id === type.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Middle Panel: Statuses for Selected Type */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
            Status {selectedType && `for ${selectedType.name}`}
          </h3>
          {!selectedType ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a job type to configure its statuses
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Select a status to configure its stages
              </p>

              {/* Configured Statuses */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={typeStatuses.map(s => s.job_type_status_id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2 mb-4">
                    {typeStatuses.map((status) => (
                      <SortableStatusItem
                        key={status.job_type_status_id}
                        status={status}
                        isSelected={selectedStatus?.id === status.id}
                        onSelect={setSelectedStatus}
                        onRemove={handleRemoveStatus}
                        onPositionChange={handlePositionChange}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {/* Add Status Dropdown */}
              {availableStatuses.length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Add Status
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddStatus(parseInt(e.target.value))
                        e.target.value = ''
                      }
                    }}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select a status...</option>
                    {availableStatuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel: Stages for Selected Type+Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
            Stages {selectedType && selectedStatus && `for ${selectedType.name} → ${selectedStatus.name}`}
          </h3>
          {!selectedType || !selectedStatus ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a job type and status to configure stages
            </p>
          ) : (
            <>
              {/* Configured Stages */}
              <ul className="space-y-2 mb-4">
                {statusStages.map((stage) => (
                  <li
                    key={stage.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-sm ${
                        stage.color === 'gray' ? 'bg-gray-400' :
                        stage.color === 'yellow' ? 'bg-yellow-400' :
                        stage.color === 'orange' ? 'bg-orange-400' :
                        stage.color === 'blue' ? 'bg-blue-400' :
                        stage.color === 'purple' ? 'bg-purple-400' :
                        stage.color === 'indigo' ? 'bg-indigo-400' :
                        stage.color === 'green' ? 'bg-green-400' :
                        stage.color === 'teal' ? 'bg-teal-400' :
                        stage.color === 'slate' ? 'bg-slate-400' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {stage.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveStage(stage.job_status_stage_id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add Stage Dropdown */}
              {availableStages.length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Add Stage
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddStage(parseInt(e.target.value))
                        e.target.value = ''
                      }
                    }}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select a stage...</option>
                    {availableStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
