import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui/use-toast'
import TeeemTableView from '@/components/table/TeeemTableView'
import PredecessorEditor from './PredecessorEditor'
import PriceBookItemsModal from './PriceBookItemsModal'
import SupervisorChecklistModal from './SupervisorChecklistModal'
import LinkedTasksModal from './LinkedTasksModal'
import AutoCompleteTasksModal from './AutoCompleteTasksModal'
import SubtasksModal from './SubtasksModal'
import {
  ArrowUpIcon, ArrowDownIcon, TrashIcon
} from '@heroicons/react/24/outline'
import { useAssignableRoles } from '@/hooks/useAssignableRoles'

// Define columns for Schedule Template table
export const SCHEDULE_TEMPLATE_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 40 },
  { key: 'sequence', label: '#', resizable: false, sortable: false, filterable: false, width: 40 },
  { key: 'name', label: 'Task Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'supplierGroup', label: 'Supplier / Group', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 },
  { key: 'predecessors', label: 'Predecessors', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'duration', label: 'Duration', resizable: true, sortable: true, filterable: false, width: 80, column_type: 'whole_number' },
  { key: 'start_date', label: 'Start Date', resizable: true, sortable: true, filterable: false, width: 110, column_type: 'whole_number' },
  { key: 'hold', label: 'Lock', resizable: true, sortable: false, filterable: false, width: 70, column_type: 'boolean' },
  { key: 'po_required', label: 'PO Req', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'create_po_on_job_start', label: 'Auto PO', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'priceItems', label: 'Price Items', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'critical_po', label: 'Critical', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'tags', label: 'Tags', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 100 },
  { key: 'require_photo', label: 'Photo', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'require_certificate', label: 'Cert', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'cert_lag_days', label: 'Cert Lag', resizable: true, sortable: true, filterable: false, width: 80, column_type: 'whole_number' },
  { key: 'supCheck', label: 'Sup Check', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'autoComplete', label: 'Auto Complete', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'subtasks', label: 'Subtasks', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'linkedTasks', label: 'Linked Tasks', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'manual_task', label: 'Manual', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'allow_multiple_instances', label: 'Multi', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'order_required', label: 'Order Time', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'call_up_required', label: 'Call Up', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'plan_required', label: 'Plan', resizable: true, sortable: false, filterable: true, filterType: 'boolean', width: 80, column_type: 'boolean' },
  { key: 'actions', label: 'Actions', resizable: false, sortable: false, filterable: false, width: 100 }
]

export default function ScheduleTemplateTable({
  rows,
  suppliers,
  selectedTemplate,
  onUpdateRow,
  onDeleteRow,
  onMoveRow,
  selectedRows,
  onSelectRow,
  onSelectAll,
  documentationCategories = []
}) {
  const { toast } = useToast()
  // SSoT: Fetch roles from backend
  const { roles: assignableRoles } = useAssignableRoles()

  // Modal states - managed at table level to allow portals
  const [activeModal, setActiveModal] = useState(null) // { type: string, rowId: number }

  // Get row by ID
  const getRowById = useCallback((id) => {
    return rows.find(r => r.id === id)
  }, [rows])

  // Calculate start date based on predecessors
  const calculateStartDate = useCallback((row) => {
    if (!row.predecessor_ids || row.predecessor_ids.length === 0) {
      return 0
    }

    let latestEnd = 0
    row.predecessor_ids.forEach(pred => {
      const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
      const predTask = rows[predData.id - 1]

      if (predTask) {
        const predStart = predTask.start_date || 0
        const predDuration = predTask.duration || 0
        const predEnd = predStart + predDuration

        if (predData.type === 'FS' || !predData.type) {
          const taskStart = predEnd + (predData.lag || 0)
          if (taskStart > latestEnd) {
            latestEnd = taskStart
          }
        }
      }
    })

    return latestEnd
  }, [rows])

  // Custom cell renderer for schedule-specific fields
  const customCellRenderer = useCallback((entry, columnKey, { onRowUpdate, selectedRows: selRows, onSelectRow: selectRow }) => {
    const rowIndex = rows.findIndex(r => r.id === entry.id)

    switch (columnKey) {
      case 'select':
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={selectedRows?.has(entry.id) || false}
              onChange={() => onSelectRow(entry.id)}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </div>
        )

      case 'sequence':
        return (
          <span className="text-gray-500 dark:text-gray-400">
            {rowIndex + 1}
          </span>
        )

      case 'name':
        return (
          <input
            type="text"
            value={entry.name || ''}
            onChange={(e) => onUpdateRow(entry.id, { name: e.target.value })}
            onFocus={(e) => e.target.select()}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
          />
        )

      case 'supplierGroup':
        return entry.po_required ? (
          <select
            value={entry.supplier_id || ''}
            onChange={(e) => onUpdateRow(entry.id, { supplier_id: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
          >
            <option value="">Select supplier...</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <select
            value={entry.assigned_role || ''}
            onChange={(e) => onUpdateRow(entry.id, { assigned_role: e.target.value || null })}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
          >
            <option value="">Assign to group...</option>
            {assignableRoles.map(role => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        )

      case 'predecessors':
        return (
          <button
            onClick={() => setActiveModal({ type: 'predecessor', rowId: entry.id })}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left cursor-pointer"
            title="Click to edit predecessors"
          >
            {entry.predecessor_display || 'None'}
          </button>
        )

      case 'duration':
        return (
          <input
            type="number"
            value={entry.duration || 0}
            onChange={(e) => onUpdateRow(entry.id, { duration: parseInt(e.target.value) || 0 })}
            onFocus={(e) => e.target.select()}
            min="0"
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
          />
        )

      case 'start_date':
        const calculatedStart = calculateStartDate(entry)
        return (
          <div className="w-full px-2 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            {calculatedStart}
          </div>
        )

      case 'hold':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.hold || false}
              onChange={(e) => onUpdateRow(entry.id, { hold: e.target.checked })}
              className="h-4 w-4"
              title={entry.hold ? 'Locked - prevents cascade updates' : 'Unlocked - allows cascade updates'}
            />
          </div>
        )

      case 'po_required':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.po_required || false}
              onChange={(e) => {
                if (!e.target.checked) {
                  onUpdateRow(entry.id, { po_required: false, create_po_on_job_start: false, supplier_id: null })
                } else {
                  onUpdateRow(entry.id, { po_required: true, assigned_role: null })
                }
              }}
              className="h-4 w-4"
            />
          </div>
        )

      case 'create_po_on_job_start':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.create_po_on_job_start || false}
              onChange={(e) => {
                if (e.target.checked && !entry.supplier_id) {
                  toast({ title: "Validation Error", description: "Please select a supplier first before enabling Auto PO", variant: "destructive" })
                  return
                }
                onUpdateRow(entry.id, { create_po_on_job_start: e.target.checked })
              }}
              disabled={!entry.po_required || !entry.supplier_id}
              className="h-4 w-4 disabled:opacity-30"
              title={!entry.po_required ? "Enable 'PO Required' first" : !entry.supplier_id ? "Select a supplier first" : "Automatically create PO when job starts"}
            />
          </div>
        )

      case 'priceItems':
        const canSelectItems = entry.create_po_on_job_start && entry.po_required && entry.supplier_id
        return (
          <button
            onClick={() => canSelectItems && setActiveModal({ type: 'priceItems', rowId: entry.id })}
            disabled={!canSelectItems}
            className={`text-xs font-medium ${canSelectItems ? 'text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
            title={
              !entry.po_required ? "Enable 'PO Required' first" :
              !entry.supplier_id ? "Select a supplier first" :
              !entry.create_po_on_job_start ? "Enable 'Auto PO' first" :
              "Click to select price book items"
            }
          >
            {entry.price_book_item_ids?.length || 0} items
          </button>
        )

      case 'critical_po':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.critical_po || false}
              onChange={(e) => onUpdateRow(entry.id, { critical_po: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'tags':
        return (
          <input
            type="text"
            value={entry.tags?.join(', ') || ''}
            onChange={(e) => onUpdateRow(entry.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            placeholder="tag1, tag2"
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
          />
        )

      case 'require_photo':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.require_photo || false}
              onChange={(e) => onUpdateRow(entry.id, { require_photo: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'require_certificate':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.require_certificate || false}
              onChange={(e) => onUpdateRow(entry.id, { require_certificate: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'cert_lag_days':
        return (
          <input
            type="number"
            value={entry.cert_lag_days || 0}
            onChange={(e) => onUpdateRow(entry.id, { cert_lag_days: parseInt(e.target.value) || 0 })}
            disabled={!entry.require_certificate}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm disabled:opacity-50"
          />
        )

      case 'supCheck':
        return (
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={entry.confirm || false}
              onChange={(e) => onUpdateRow(entry.id, { confirm: e.target.checked })}
              className="h-4 w-4"
            />
            {entry.confirm && (
              <button
                onClick={() => setActiveModal({ type: 'checklist', rowId: entry.id })}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
                title="Click to assign checklist items"
              >
                {entry.supervisor_checklist_template_ids?.length || 0} items
              </button>
            )}
          </div>
        )

      case 'autoComplete':
        return (
          <button
            onClick={() => setActiveModal({ type: 'autoComplete', rowId: entry.id })}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            title="Click to select tasks to auto-complete"
          >
            {entry.auto_complete_task_ids?.length || 0} tasks
          </button>
        )

      case 'subtasks':
        return (
          <button
            onClick={() => setActiveModal({ type: 'subtasks', rowId: entry.id })}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            title="Click to select subtasks"
          >
            {entry.subtask_template_ids?.length || 0} subtasks
          </button>
        )

      case 'linkedTasks':
        return (
          <button
            onClick={() => setActiveModal({ type: 'linkedTasks', rowId: entry.id })}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            title="Click to select linked tasks"
          >
            {entry.linked_task_ids?.length || 0} tasks
          </button>
        )

      case 'manual_task':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.manual_task || false}
              onChange={(e) => onUpdateRow(entry.id, { manual_task: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'allow_multiple_instances':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.allow_multiple_instances || false}
              onChange={(e) => onUpdateRow(entry.id, { allow_multiple_instances: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'order_required':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.order_required || false}
              onChange={(e) => onUpdateRow(entry.id, { order_required: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'call_up_required':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.call_up_required || false}
              onChange={(e) => onUpdateRow(entry.id, { call_up_required: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'plan_required':
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={entry.plan_required || false}
              onChange={(e) => onUpdateRow(entry.id, { plan_required: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        )

      case 'actions':
        const canMoveUp = rowIndex > 0
        const canMoveDown = rowIndex < rows.length - 1
        return (
          <div className="flex items-center gap-1">
            {canMoveUp && (
              <button onClick={() => onMoveRow(entry.id, 'up')} className="p-1 hover:text-indigo-600" title="Move up">
                <ArrowUpIcon className="h-4 w-4" />
              </button>
            )}
            {canMoveDown && (
              <button onClick={() => onMoveRow(entry.id, 'down')} className="p-1 hover:text-indigo-600" title="Move down">
                <ArrowDownIcon className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => onDeleteRow(entry.id)} className="p-1 hover:text-red-600" title="Delete">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )

      default:
        // Return null for unhandled columns to use default rendering
        return null
    }
  }, [rows, suppliers, selectedRows, onSelectRow, onUpdateRow, onDeleteRow, onMoveRow, calculateStartDate])

  // Handle modal saves
  const handleSavePredecessors = useCallback((predecessors) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { predecessor_ids: predecessors })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  const handleSavePriceItems = useCallback((itemIds) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { price_book_item_ids: itemIds })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  const handleSaveChecklistTemplates = useCallback((templateIds) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { supervisor_checklist_template_ids: templateIds })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  const handleSaveLinkedTasks = useCallback((taskIds) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { linked_task_ids: taskIds })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  const handleSaveAutoCompleteTasks = useCallback((taskIds) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { auto_complete_task_ids: taskIds })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  const handleSaveSubtasks = useCallback((taskIds) => {
    if (activeModal?.rowId) {
      onUpdateRow(activeModal.rowId, { subtask_template_ids: taskIds })
      setActiveModal(null)
    }
  }, [activeModal, onUpdateRow])

  // Get current row for modal
  const currentModalRow = activeModal?.rowId ? getRowById(activeModal.rowId) : null

  return (
    <>
      <TeeemTableView
        entries={rows}
        columns={SCHEDULE_TEMPLATE_COLUMNS}
        foundationId={`schedule_template_${selectedTemplate?.id || 'default'}`}
        tableName="Schedule Template Tasks"
        viewOnly={true}
        customCellRenderer={customCellRenderer}
        onRowUpdate={(rowId, field, value) => onUpdateRow(rowId, { [field]: value })}
        extraRowProps={{ suppliers, allRows: rows }}
      />

      {/* Modals - rendered using portals */}
      {activeModal?.type === 'predecessor' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <PredecessorEditor
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          allRows={rows}
          onSave={handleSavePredecessors}
        />,
        document.body
      )}

      {activeModal?.type === 'priceItems' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <PriceBookItemsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          onSave={handleSavePriceItems}
        />,
        document.body
      )}

      {activeModal?.type === 'checklist' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <SupervisorChecklistModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          onSave={handleSaveChecklistTemplates}
        />,
        document.body
      )}

      {activeModal?.type === 'linkedTasks' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <LinkedTasksModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          allRows={rows}
          onSave={handleSaveLinkedTasks}
        />,
        document.body
      )}

      {activeModal?.type === 'autoComplete' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <AutoCompleteTasksModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          allRows={rows}
          onSave={handleSaveAutoCompleteTasks}
        />,
        document.body
      )}

      {activeModal?.type === 'subtasks' && currentModalRow && typeof document !== 'undefined' && createPortal(
        <SubtasksModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          currentRow={currentModalRow}
          allRows={rows}
          onSave={handleSaveSubtasks}
        />,
        document.body
      )}
    </>
  )
}
