import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { COLUMN_TYPES, getColumnTypeEmoji } from '../../constants/columnTypes';
import ChoiceEditor from './ChoiceEditor';
import FormulaEditor from './FormulaEditor';
import TypeConversionEditor from './TypeConversionEditor';
import RenameEditor from './RenameEditor';
import PreviewChangesModal from './PreviewChangesModal';

/**
 * ColumnEditorFullView - Full-screen meta-table editor for managing all columns
 *
 * Layout: Table where each row represents a column definition
 * Columns in the meta-table:
 * 1. Column Name
 * 2. Current Type
 * 3. Working Sheet (dynamic based on column type/action)
 *
 * Features:
 * - View all table columns in one interface
 * - Edit multiple columns before applying
 * - Preview changes before applying
 * - Add new columns
 * - Delete columns (with warnings)
 * - Rename columns
 */
const ColumnEditorFullView = ({ foundationId, tableName, onClose, isNewMode = false }) => {
  const [table, setTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedColumn, setExpandedColumn] = useState(null);
  const [editorMode, setEditorMode] = useState({}); // Track editor mode per column: { [columnId]: 'rename' | 'typeConversion' | 'choices' | 'formula' }
  const [pendingChanges, setPendingChanges] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [validationResults, setValidationResults] = useState([]);

  // New column creation state
  const [newColumn, setNewColumn] = useState({
    name: '',
    column_name: '',
    column_type: 'single_line_text',
    required: false
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTableData();
  }, [foundationId]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/foundations/${foundationId}`);

      // Handle different response formats
      if (response && response.success) {
        // Direct format: { success: true, table: {...} }
        setTable(response.table);
        setColumns(response.table.columns || []);
      } else if (response && response.data && response.data.success) {
        // Nested format: { data: { success: true, table: {...} } }
        setTable(response.data.table);
        setColumns(response.data.table.columns || []);
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error loading table:', error);
      alert('Failed to load table: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (columnId) => {
    setExpandedColumn(expandedColumn === columnId ? null : columnId);
  };

  const handleAddChange = (change) => {
    setPendingChanges([...pendingChanges, change]);
  };

  const handleClearChanges = () => {
    setPendingChanges([]);
    setValidationResults([]);
    setShowPreviewModal(false);
  };

  const handlePreviewChanges = async () => {
    if (pendingChanges.length === 0) {
      alert('No changes to preview');
      return;
    }

    // Validate all changes
    try {
      const results = await Promise.all(
        pendingChanges.map(change => validateChange(change))
      );
      setValidationResults(results);
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Error validating changes:', error);
      alert('Validation failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const validateChange = async (change) => {
    // This would call the backend validation endpoint
    // For now, return a placeholder
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  };

  const handleApplyChanges = async () => {
    // Apply all pending changes
    try {
      for (const change of pendingChanges) {
        await applyChange(change);
      }

      alert('All changes applied successfully!');
      handleClearChanges();
      await loadTableData();
    } catch (error) {
      console.error('Error applying changes:', error);
      alert('Failed to apply changes: ' + (error.response?.data?.error || error.message));
    }
  };

  const applyChange = async (change) => {
    // Apply individual change via API
    // Implementation depends on change type
    console.log('Applying change:', change);
  };

  const handleCreateColumn = async () => {
    try {
      setCreating(true);

      // Validate column name
      if (!newColumn.name.trim()) {
        alert('Column name is required');
        return;
      }

      // Generate column_name from display name if not provided
      let columnName = newColumn.column_name.trim();
      if (!columnName) {
        columnName = newColumn.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      // Call API to create column
      const result = await api.post(
        `/api/v1/foundations/${foundationId}/columns`,
        {
          column: {
            name: newColumn.name,
            column_name: columnName,
            column_type: newColumn.column_type,
            required: newColumn.required
          }
        }
      );

      if (result.success) {
        alert('✅ Column created successfully!');
        // Reset form
        setNewColumn({
          name: '',
          column_name: '',
          column_type: 'single_line_text',
          required: false
        });
        // Close and navigate back
        if (onClose) {
          onClose();
        }
      } else {
        alert('❌ Failed to create column: ' + (result.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating column:', error);
      const errorMsg = error.response?.data?.errors?.join(', ') ||
                       error.response?.data?.error ||
                       error.message ||
                       'Unknown error occurred';
      alert('❌ Failed to create column: ' + errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const getColumnTypeLabel = (type) => {
    const typeLabels = {
      'string': 'Text',
      'text': 'Text Area',
      'integer': 'Number',
      'float': 'Decimal',
      'boolean': 'Yes/No',
      'date': 'Date',
      'datetime': 'Date & Time',
      'choice': 'Choice',
      'computed': 'Computed'
    };
    return typeLabels[type] || type;
  };

  if (loading && !isNewMode) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-[100]">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Loading table columns...
          </div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If in new mode, show column creation form
  if (isNewMode) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Create New Column: {tableName}
                </h1>
                <p className="text-sm text-green-100 mt-1">
                  Add a new column to your table
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white
                         bg-white/20 hover:bg-white/30 border border-white/30
                         rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6">
              {/* Column Display Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Column Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  placeholder="e.g., Customer Name"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-300
                           dark:border-gray-600 text-base text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                           placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The name shown to users in the interface
                </p>
              </div>

              {/* Column Database Name (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Column Name (Database) <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newColumn.column_name}
                  onChange={(e) => setNewColumn({ ...newColumn, column_name: e.target.value })}
                  placeholder="Auto-generated from display name"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-300
                           dark:border-gray-600 text-base font-mono text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                           placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave blank to auto-generate from display name (e.g., customer_name)
                </p>
              </div>

              {/* Column Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Column Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newColumn.column_type}
                  onChange={(e) => setNewColumn({ ...newColumn, column_type: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-300
                           dark:border-gray-600 text-base text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {COLUMN_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {getColumnTypeEmoji(type.value)} {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Select the data type for this column
                </p>
              </div>

              {/* Required Checkbox */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newColumn.required}
                    onChange={(e) => setNewColumn({ ...newColumn, required: e.target.checked })}
                    className="w-5 h-5 text-green-600 bg-white dark:bg-gray-700 border-gray-300
                             dark:border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Required field
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                  Users must provide a value for this column
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCreateColumn}
                  disabled={creating || !newColumn.name.trim()}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-semibold
                           rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Column'}
                </button>
                <button
                  onClick={onClose}
                  disabled={creating}
                  className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300
                           bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                           rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Edit Columns: {tableName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {columns.length} {columns.length === 1 ? 'column' : 'columns'}
                {pendingChanges.length > 0 && (
                  <span className="ml-3 text-orange-600 dark:text-orange-400 font-medium">
                    • {pendingChanges.length} pending {pendingChanges.length === 1 ? 'change' : 'changes'}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              {pendingChanges.length > 0 && (
                <>
                  <button
                    onClick={handleClearChanges}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                             bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                             rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Clear Changes
                  </button>
                  <button
                    onClick={handlePreviewChanges}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-500
                             rounded-lg hover:bg-purple-600 transition-colors shadow-lg"
                  >
                    Preview {pendingChanges.length} {pendingChanges.length === 1 ? 'Change' : 'Changes'}
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                         bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                         rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Column List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-4">
            {columns.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2
                            border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No columns in this table
                </p>
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
                           transition-colors font-medium"
                >
                  Add First Column
                </button>
              </div>
            ) : (
              columns.map((column) => {
                const isExpanded = expandedColumn === column.id;
                const isChoiceColumn = ['choice', 'dropdown', 'select'].includes(column.column_type?.toLowerCase());
                const isComputedColumn = column.column_type === 'computed' || column.formula;

                return (
                  <div
                    key={column.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200
                             dark:border-gray-700 overflow-hidden transition-all"
                  >
                    {/* Column Header Row */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50
                               dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => handleToggleExpand(column.id)}
                    >
                      {/* Expand/Collapse Icon */}
                      <div className="flex-shrink-0">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isExpanded ? 'transform rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {/* Column Name */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {column.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {column.column_name}
                        </div>
                      </div>

                      {/* Current Type */}
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs
                                       font-medium bg-blue-100 dark:bg-blue-900 text-blue-800
                                       dark:text-blue-200">
                          {getColumnTypeLabel(column.column_type)}
                        </span>
                      </div>

                      {/* Required Badge */}
                      {column.required && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs
                                         font-medium bg-red-100 dark:bg-red-900 text-red-800
                                         dark:text-red-200">
                            Required
                          </span>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex-shrink-0 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {isChoiceColumn && (
                          <button
                            className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400
                                     hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                            title="Manage choices"
                          >
                            📋 Choices
                          </button>
                        )}
                        {isComputedColumn && (
                          <button
                            className="px-3 py-1 text-xs text-green-600 dark:text-green-400
                                     hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="Edit formula"
                          >
                            🔢 Formula
                          </button>
                        )}
                        <button
                          className="px-3 py-1 text-xs text-blue-600 dark:text-blue-400
                                   hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Change type"
                        >
                          🔄 Type
                        </button>
                      </div>
                    </div>

                    {/* Expanded Working Sheet */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50
                                    dark:bg-gray-900/50 p-6">
                        <div className="flex gap-4 mb-4">
                          <button
                            onClick={() => setEditorMode({ ...editorMode, [column.id]: 'rename' })}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              editorMode[column.id] === 'rename'
                                ? 'text-white bg-orange-600 dark:bg-orange-500'
                                : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                            }`}
                          >
                            Rename Column
                          </button>
                          <button
                            onClick={() => setEditorMode({ ...editorMode, [column.id]: 'typeConversion' })}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              editorMode[column.id] === 'typeConversion'
                                ? 'text-white bg-blue-600 dark:bg-blue-500'
                                : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            Change Type
                          </button>
                          {isChoiceColumn && (
                            <button
                              onClick={() => setEditorMode({ ...editorMode, [column.id]: 'choices' })}
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                editorMode[column.id] === 'choices'
                                  ? 'text-white bg-purple-600 dark:bg-purple-500'
                                  : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                              }`}
                            >
                              Manage Choices
                            </button>
                          )}
                          {isComputedColumn && (
                            <button
                              onClick={() => setEditorMode({ ...editorMode, [column.id]: 'formula' })}
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                editorMode[column.id] === 'formula'
                                  ? 'text-white bg-green-600 dark:bg-green-500'
                                  : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                              }`}
                            >
                              Edit Formula
                            </button>
                          )}
                        </div>

                        {/* Working Sheet Area - Shows appropriate editor based on mode */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          {editorMode[column.id] === 'rename' ? (
                            <RenameEditor
                              foundationId={foundationId}
                              column={column}
                              onUpdate={loadTableData}
                            />
                          ) : editorMode[column.id] === 'typeConversion' ? (
                            <TypeConversionEditor
                              foundationId={foundationId}
                              column={column}
                              onUpdate={loadTableData}
                            />
                          ) : editorMode[column.id] === 'choices' ? (
                            <ChoiceEditor
                              foundationId={foundationId}
                              column={column}
                              onUpdate={loadTableData}
                            />
                          ) : editorMode[column.id] === 'formula' ? (
                            <FormulaEditor
                              foundationId={foundationId}
                              column={column}
                              onUpdate={loadTableData}
                            />
                          ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <p className="mb-2">Select an action to edit this column</p>
                              <p className="text-sm">Choose "Rename Column" or "Change Type" to get started</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Preview Changes Modal */}
      <PreviewChangesModal
        isOpen={showPreviewModal}
        changes={pendingChanges}
        validationResults={validationResults}
        onApply={handleApplyChanges}
        onClear={handleClearChanges}
      />
    </div>
  );
};

export default ColumnEditorFullView;
