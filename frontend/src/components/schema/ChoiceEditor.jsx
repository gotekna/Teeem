import React, { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * ChoiceEditor - Component for managing dropdown/choice column values
 *
 * Features:
 * - View current choices with usage counts
 * - Add new choices
 * - Rename choices (updates all data)
 * - Delete choices (with replacement or clear option)
 * - Merge multiple choices into one
 * - Drag-and-drop reorder with persistence (saves to database)
 */
const ChoiceEditor = ({ tableId, column, onUpdate }) => {
  const [choices, setChoices] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingChoice, setEditingChoice] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newChoice, setNewChoice] = useState('');
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [replacementValue, setReplacementValue] = useState('');
  const [deleteAction, setDeleteAction] = useState('clear'); // 'clear' or 'replace'
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    loadChoices();
  }, [tableId, column.id]);

  const loadChoices = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/tables/${tableId}/columns/${column.id}/choices`);

      // api.get returns parsed JSON directly (not wrapped in .data like axios)
      if (response?.success) {
        setChoices(response.choices || []);
        setTotalRecords(response.total_records || 0);
        setOrderChanged(false); // Reset order changed flag when loading fresh data
      } else if (response?.error) {
        alert('Failed to load choices: ' + response.error);
      } else {
        // Handle unexpected response format
        console.error('Unexpected response:', response);
        setChoices([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('Error loading choices:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert('Failed to load choices: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChoice = async () => {
    if (!newChoice.trim()) return;
    if (adding) return; // Prevent double-submission

    // Check if choice already exists
    if (choices.some(c => c.value === newChoice.trim())) {
      alert('This choice already exists!');
      return;
    }

    try {
      setAdding(true);

      // Call backend API to persist the choice
      const response = await api.post(`/api/v1/tables/${tableId}/columns/${column.id}/add_choice`, {
        value: newChoice.trim()
      });

      if (response.success) {
        // Reload choices from backend to get the updated list
        await loadChoices();
        setNewChoice('');
        // Don't call onUpdate() here - adding a choice doesn't modify existing data
      } else {
        alert('Failed to add choice: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding choice:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert('Failed to add choice: ' + errorMsg);
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (choice) => {
    setEditingChoice(choice.value);
    setEditValue(choice.value);
  };

  const handleCancelEdit = () => {
    setEditingChoice(null);
    setEditValue('');
  };

  const handleSaveEdit = async (oldValue) => {
    if (!editValue.trim() || editValue === oldValue) {
      handleCancelEdit();
      return;
    }

    // Check if new value already exists
    if (choices.some(c => c.value === editValue.trim() && c.value !== oldValue)) {
      alert('A choice with this value already exists!');
      return;
    }

    try {
      const response = await api.post(`/api/v1/tables/${tableId}/columns/${column.id}/rename_choice`, {
        old_value: oldValue,
        new_value: editValue.trim()
      });

      if (response.success) {
        // Update local state
        setChoices(choices.map(c =>
          c.value === oldValue
            ? { ...c, value: editValue.trim() }
            : c
        ));
        handleCancelEdit();

        // Don't call onUpdate() here - renaming saves automatically, no need to close modal

        alert(`Successfully renamed choice. ${response.affected_rows} row(s) updated.`);
      }
    } catch (error) {
      console.error('Error renaming choice:', error);
      alert('Failed to rename choice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteChoice = (choice) => {
    if (choice.count === 0) {
      // No data to worry about, just remove from list
      setChoices(choices.filter(c => c.value !== choice.value));
      // Don't call onUpdate() here - deleting saves automatically, no need to close modal
      return;
    }

    // Show modal for choices with data
    setShowDeleteModal(choice);
    setReplacementValue('');
    setDeleteAction('clear');
  };

  const handleConfirmDelete = async () => {
    const choice = showDeleteModal;

    try {
      const params = {
        value: choice.value
      };

      if (deleteAction === 'replace' && replacementValue) {
        params.replacement_value = replacementValue;
      }

      const response = await api.delete(`/api/v1/tables/${tableId}/columns/${column.id}/delete_choice`, {
        params
      });

      if (response.success) {
        // Update local state
        setChoices(choices.filter(c => c.value !== choice.value));
        setShowDeleteModal(null);

        // Don't call onUpdate() here - deleting saves automatically, no need to close modal

        const action = deleteAction === 'replace'
          ? `replaced with "${replacementValue}"`
          : 'cleared';
        alert(`Successfully deleted choice. ${response.affected_rows} row(s) ${action}.`);
      }
    } catch (error) {
      console.error('Error deleting choice:', error);
      alert('Failed to delete choice: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleSelect = (value) => {
    if (selectedChoices.includes(value)) {
      setSelectedChoices(selectedChoices.filter(v => v !== value));
    } else {
      setSelectedChoices([...selectedChoices, value]);
    }
  };

  const handleMergeChoices = () => {
    if (selectedChoices.length < 2) {
      alert('Please select at least 2 choices to merge');
      return;
    }

    setShowMergeModal(true);
    setMergeTarget(selectedChoices[0]);
  };

  const handleConfirmMerge = async () => {
    if (!mergeTarget) {
      alert('Please select a target choice');
      return;
    }

    try {
      const response = await api.post(`/api/v1/tables/${tableId}/columns/${column.id}/merge_choices`, {
        source_values: selectedChoices.filter(v => v !== mergeTarget),
        target_value: mergeTarget
      });

      if (response.success) {
        // Reload choices to get updated counts
        await loadChoices();
        setSelectedChoices([]);
        setShowMergeModal(false);

        // Don't call onUpdate() here - merging saves automatically, no need to close modal

        alert(`Successfully merged choices. ${response.affected_rows} row(s) updated.`);
      }
    } catch (error) {
      console.error('Error merging choices:', error);
      alert('Failed to merge choices: ' + (error.response?.data?.error || error.message));
    }
  };

  // Drag and drop handlers (visual reordering only - doesn't affect data)
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder choices array
    const newChoices = [...choices];
    const draggedItem = newChoices[draggedIndex];
    newChoices.splice(draggedIndex, 1);
    newChoices.splice(dropIndex, 0, draggedItem);

    setChoices(newChoices);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setOrderChanged(true); // Mark that order has changed
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true);

      // Get the current order of choice values
      const order = choices.map(c => c.value);

      const response = await api.post(`/api/v1/tables/${tableId}/columns/${column.id}/reorder_choices`, {
        order
      });

      if (response.success) {
        setOrderChanged(false);
        alert('Choice order saved successfully!');
      } else {
        alert('Failed to save order: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving choice order:', error);
      alert('Failed to save order: ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-500">Loading choices...</div>;
  }

  return (
    <div className="choice-editor p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Manage Choices for "{column.name}"
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total records: {totalRecords} | Unique values: {choices.length}
        </p>
        {orderChanged ? (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-orange-600 dark:text-orange-400">
              ⚠️ Choice order changed - click Save Order to persist
            </p>
            <button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600
                       transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingOrder ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            💡 Drag choices to reorder the dropdown list
          </p>
        )}
      </div>

      {/* Add New Choice */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newChoice}
          onChange={(e) => setNewChoice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddChoice();
            }
          }}
          placeholder="Add new choice..."
          disabled={adding}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleAddChoice}
          disabled={adding || !newChoice.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600
                   transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Merge Button */}
      {selectedChoices.length >= 2 && (
        <div className="mb-4">
          <button
            onClick={handleMergeChoices}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600
                     transition-colors font-medium"
          >
            Merge {selectedChoices.length} Selected Choices
          </button>
        </div>
      )}

      {/* Choices List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {choices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No choices found. Add some choices or they will be auto-discovered from existing data.
          </div>
        ) : (
          choices.map((choice, index) => (
            <div
              key={choice.value}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg
                       border-2 transition-all cursor-move
                       ${draggedIndex === index
                         ? 'opacity-50 border-blue-400 dark:border-blue-500'
                         : dragOverIndex === index
                         ? 'border-green-400 dark:border-green-500 border-dashed'
                         : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                       }`}
            >
              {/* Drag handle */}
              <div className="text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing"
                   title="Drag to reorder (visual only)">
                ⋮⋮
              </div>

              {/* Checkbox for merge selection */}
              <input
                type="checkbox"
                checked={selectedChoices.includes(choice.value)}
                onChange={() => handleToggleSelect(choice.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
              />

              {/* Value (editable) */}
              <div className="flex-1">
                {editingChoice === choice.value ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(choice.value);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm
                               bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={() => handleSaveEdit(choice.value)}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {choice.value}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {choice.count} {choice.count === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {editingChoice !== choice.value && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(choice)}
                    className="px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50
                             dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="Rename choice"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteChoice(choice)}
                    className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50
                             dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Delete choice"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Delete Choice "{showDeleteModal.value}"
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This choice is used in <strong>{showDeleteModal.count}</strong> record(s).
                What should happen to those values?
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteAction"
                    value="clear"
                    checked={deleteAction === 'clear'}
                    onChange={(e) => setDeleteAction(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Clear values (set to empty)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      All {showDeleteModal.count} records will have this field cleared
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteAction"
                    value="replace"
                    checked={deleteAction === 'replace'}
                    onChange={(e) => setDeleteAction(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Replace with another choice
                    </div>
                    <select
                      value={replacementValue}
                      onChange={(e) => {
                        setReplacementValue(e.target.value);
                        setDeleteAction('replace');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      disabled={deleteAction !== 'replace'}
                    >
                      <option value="">Select replacement...</option>
                      {choices
                        .filter(c => c.value !== showDeleteModal.value)
                        .map(c => (
                          <option key={c.value} value={c.value}>
                            {c.value}
                          </option>
                        ))}
                    </select>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100
                         dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteAction === 'replace' && !replacementValue}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Choice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Confirmation Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Merge Choices
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Merging {selectedChoices.length} choices into one. Select the target value:
              </p>

              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Choices to merge:
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedChoices.map(choice => (
                    <span
                      key={choice}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200
                               rounded text-xs"
                    >
                      {choice}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target choice (keep this one):
                </label>
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {selectedChoices.map(choice => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100
                         dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMerge}
                className="px-4 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600
                         transition-colors"
              >
                Merge Choices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChoiceEditor;
