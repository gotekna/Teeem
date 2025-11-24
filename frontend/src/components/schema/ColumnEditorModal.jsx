import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { COLUMN_TYPES, getColumnTypeEmoji } from '../../constants/columnTypes';
import ChoiceEditor from './ChoiceEditor';
import FormulaEditor from './FormulaEditor';
import TypeConversionEditor from './TypeConversionEditor';
import LookupEditor from './LookupEditor';

/**
 * ColumnEditorModal - Modal for editing a single column's schema
 *
 * Opens when user clicks the cog icon (⚙️) on a column header in "Edit Individual" mode
 * Shows the appropriate editor based on column type and selected action
 */
const ColumnEditorModal = ({ isOpen, column, table, tableId, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [editedColumn, setEditedColumn] = useState({
    name: column?.name || '',
    column_name: column?.column_name || '',
    data_type: column?.column_type || column?.data_type || 'single_line_text'
  });
  const [saving, setSaving] = useState(false);

  // REMOVED: Hardcoded COLUMN_TYPE_METADATA - now using COLUMN_TYPES from constants/columnTypes.js as single source of truth

  // Map database types to display types for metadata lookup
  const DB_TYPE_TO_COLUMN_TYPE = {
    'string': 'single_line_text',
    'text': 'multiple_lines_text',
    'integer': 'whole_number',
    'decimal': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'date_and_time'
  };

  // Get metadata for a column type from COLUMN_TYPES constant (single source of truth)
  const getColumnMetadata = (columnType) => {
    // If it's a database type (string, text, etc), convert to display type first
    const displayType = DB_TYPE_TO_COLUMN_TYPE[columnType] || columnType;

    // Find the column type in COLUMN_TYPES array
    const columnTypeDef = COLUMN_TYPES.find(type => type.value === displayType);

    if (columnTypeDef) {
      return {
        sqlType: columnTypeDef.sqlType || 'Unknown',
        validation: columnTypeDef.validationRules || 'No validation rules defined',
        usedFor: columnTypeDef.usedFor || 'No description available',
        example: columnTypeDef.example || 'No example available',
        label: columnTypeDef.label || displayType,
        icon: getColumnTypeEmoji(displayType)
      };
    }

    // Fallback if not found
    return {
      sqlType: 'Unknown',
      validation: 'No validation rules defined',
      usedFor: 'No description available',
      example: 'No example available',
      label: columnType,
      icon: getColumnTypeEmoji(columnType)
    };
  };

  // Sync state when column prop changes
  useEffect(() => {
    if (column) {
      setEditedColumn({
        name: column.name || '',
        column_name: column.column_name || '',
        data_type: column.column_type || column.data_type || 'single_line_text'
      });
    }
  }, [column]);

  if (!isOpen || !column) return null;

  const isChoiceColumn = ['choice', 'dropdown', 'select', 'single_select', 'multi_select'].includes(column.column_type?.toLowerCase());
  const isComputedColumn = column.column_type === 'computed' || column.formula;
  const isLookupColumn = column.column_type === 'lookup' || column.column_type === 'link_to_another_record' || column.column_type === 'multiple_lookups';

  const tabs = [
    { id: 'info', label: 'Column Info', icon: 'ℹ️' },
    { id: 'type', label: 'Change Type', icon: '🔄' },
  ];

  if (isChoiceColumn) {
    tabs.push({ id: 'choices', label: 'Manage Choices', icon: '📋' });
  }

  if (isComputedColumn) {
    tabs.push({ id: 'formula', label: 'Edit Formula', icon: '🔢' });
  }

  if (isLookupColumn) {
    tabs.push({ id: 'lookup', label: 'Manage Lookup', icon: '🔗' });
  }

  const handleClose = () => {
    // Let individual editors (ChoiceEditor, LookupEditor) handle their own onUpdate calls
    // Don't call onUpdate here to avoid duplicate refetches
    if (onClose) {
      onClose();
    }
  };

  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  const handleSaveColumnInfo = async () => {
    try {
      setSaving(true);

      // Validate display name
      if (!editedColumn.name.trim()) {
        alert('Column name cannot be empty');
        setSaving(false);
        return;
      }

      // Warn if changing column type (database column name changes are not allowed)
      const typeChanged = editedColumn.data_type !== (column.data_type || column.column_type);

      if (typeChanged) {
        const confirmed = window.confirm(
          `⚠️ Warning: You are changing the type from "${column.column_type}" to "${editedColumn.data_type}".\n\n` +
          'This will rebuild the database table and may result in data loss if the types are incompatible.\n\n' +
          'Are you sure you want to continue?'
        );

        if (!confirmed) {
          setSaving(false);
          return;
        }
      }

      const result = await api.patch(
        `/api/v1/tables/${tableId}/columns/${column.id}`,
        {
          column: {
            name: editedColumn.name,
            // column_name is NEVER sent - database column names cannot be changed after creation
            column_type: editedColumn.data_type
          }
        }
      );

      // api.patch returns the data directly, not wrapped in response.data
      if (result.success) {
        alert('✅ Column updated successfully!');
        handleUpdate();
        handleClose();
      } else {
        alert('❌ Failed to update column: ' + (result.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating column:', error);
      console.error('Full error response:', error.response);

      const errorMsg = error.response?.data?.errors?.join(', ') ||
                       error.response?.data?.error ||
                       error.message ||
                       'Unknown error occurred';

      alert(
        '❌ Failed to update column: ' + errorMsg + '\n\n' +
        'Note: Column updates require rebuilding the database table. ' +
        'If this error persists, you may need to:\n' +
        '1. Check backend logs for details\n' +
        '2. Ensure no data conflicts exist\n' +
        '3. Consider using the schema migration tools instead'
      );
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    return editedColumn.name !== column.name;
  };

  // Check if this is a system-generated column
  const isSystemGenerated = ['id', 'created_at', 'updated_at'].includes(column.column_name);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto"
         onClick={(e) => {
           if (e.target === e.currentTarget) {
             handleClose();
           }
         }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh]
                    flex flex-col overflow-hidden mx-auto"
           onClick={(e) => e.stopPropagation()}>
        {/* Header - Red for system-generated, Purple for user columns */}
        <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r
                      ${isSystemGenerated
                        ? 'from-red-600 to-red-700'
                        : 'from-purple-500 to-pink-600'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">
                  Edit Column: {column.name}
                </h2>
                {isSystemGenerated && (
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold text-white uppercase tracking-wide border border-white/30">
                    🔒 System Generated
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${isSystemGenerated ? 'text-red-100' : 'text-purple-100'}`}>
                {getColumnMetadata(column.column_type).icon} {getColumnMetadata(column.column_type).label} • {column.required ? 'Required' : 'Optional'}
                {isSystemGenerated && ' • Auto-managed by database'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50
                      px-6 overflow-x-auto shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors
                       border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* System Generated Warning Banner */}
              {isSystemGenerated && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔒</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-red-900 dark:text-red-100 mb-1">
                        System-Generated Column
                      </h3>
                      <p className="text-sm text-red-800 dark:text-red-200">
                        This column is automatically managed by the database system. While you can view its configuration,
                        modifying system columns is not recommended as they are essential for tracking records.
                      </p>
                      <ul className="mt-2 text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                        <li><strong>id</strong>: Auto-incrementing primary key for record identification</li>
                        <li><strong>created_at</strong>: Timestamp automatically set when record is created</li>
                        <li><strong>updated_at</strong>: Timestamp automatically updated on any modification</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 1: Column Name */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">✏️</div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Column Name</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Display name and database identifier</p>
                  </div>
                </div>

                {/* Display Name */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editedColumn.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      // Only update display name - database column_name is NEVER changed after creation
                      // Use functional form to avoid stale closure issues
                      setEditedColumn(prev => ({ ...prev, name: newName }));
                    }}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-300
                             dark:border-gray-600 text-base text-gray-900 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Column display name"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The name shown to users in the interface
                  </p>
                </div>

                {/* Database Column Name - Read Only - Use column prop directly to prevent any accidental modification */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Column Name (Database)
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-lg border-2 border-gray-300
                               dark:border-gray-500 text-base font-mono text-gray-700 dark:text-gray-300">
                    {column.column_name}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Database column name cannot be changed after creation
                  </p>
                </div>
              </div>

              {/* SECTION 2: Column Type - Read Only */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🎯</div>
                  <div>
                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">Column Type</h3>
                    <p className="text-xs text-purple-700 dark:text-purple-300">Data type and validation rules</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Current Type
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-lg border-2 border-gray-300
                               dark:border-gray-500 text-base font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span>{getColumnTypeEmoji(editedColumn.data_type)}</span>
                    <span>{getColumnMetadata(editedColumn.data_type).label}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use the "Change Type" tab to convert column type (requires data migration)
                  </p>
                </div>
              </div>

              {/* SECTION 3: SQL Type & Metadata */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🗄️</div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900 dark:text-green-100">SQL Type & Metadata</h3>
                    <p className="text-xs text-green-700 dark:text-green-300">Database implementation details</p>
                  </div>
                </div>

                {/* Current Type Display */}
                <div className={`p-4 rounded-lg border-2 mb-4 ${
                  isSystemGenerated
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                    : 'bg-white dark:bg-gray-700 border-green-300 dark:border-green-600'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getColumnTypeEmoji(editedColumn.data_type)}</span>
                    <span className={`text-base font-bold ${
                      isSystemGenerated
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-green-900 dark:text-green-100'
                    }`}>
                      {getColumnMetadata(editedColumn.data_type).label}
                    </span>
                  </div>
                  <p className={`text-sm font-mono ${
                    isSystemGenerated
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}>
                    SQL Type: {getColumnMetadata(editedColumn.data_type).sqlType}
                  </p>
                </div>
              </div>

              {/* Validation Rules - ALWAYS from COLUMN_TYPES (single source of truth) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Validation Rules
                </label>
                <div className="w-full px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-200
                             dark:border-orange-700 text-sm text-orange-900 dark:text-orange-100 min-h-[2.5rem]">
                  {getColumnMetadata(editedColumn.data_type).validation}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Validation rules from COLUMN_TYPES (single source of truth)
                </p>
              </div>

              {/* Example - ALWAYS from COLUMN_TYPES (single source of truth) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Example
                </label>
                <div className="w-full px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200
                             dark:border-purple-700 text-sm font-mono text-purple-900 dark:text-purple-100 min-h-[2.5rem]">
                  {getColumnMetadata(editedColumn.data_type).example}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Example values from COLUMN_TYPES (single source of truth)
                </p>
              </div>

              {/* Used For - ALWAYS from COLUMN_TYPES (single source of truth) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Used For
                </label>
                <div className="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200
                             dark:border-blue-700 text-sm text-blue-900 dark:text-blue-100 min-h-[2.5rem]">
                  {getColumnMetadata(editedColumn.data_type).usedFor}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Usage description from COLUMN_TYPES (single source of truth)
                </p>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {hasChanges() ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          You have unsaved changes
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          No changes
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use other tabs to rename, change type details, manage choices, or edit formulas
                    </p>
                  </div>
                  {hasChanges() && (
                    <button
                      onClick={handleSaveColumnInfo}
                      disabled={saving}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-semibold
                               rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'type' && (
            <TypeConversionEditor
              tableId={tableId}
              column={column}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === 'choices' && isChoiceColumn && (
            <ChoiceEditor
              tableId={tableId}
              column={column}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === 'formula' && isComputedColumn && (
            <FormulaEditor
              tableId={tableId}
              table={table}
              formula={column.formula}
              onChange={(newFormula) => {
                // Handle formula change
                console.log('Formula updated:', newFormula);
              }}
            />
          )}

          {activeTab === 'lookup' && isLookupColumn && (
            <LookupEditor
              tableId={tableId}
              column={column}
              onUpdate={handleUpdate}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {/* Hide status message on choices and lookup tabs since they handle their own saving */}
              {activeTab !== 'choices' && activeTab !== 'lookup' && hasChanges() ? (
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  Unsaved changes
                </span>
              ) : null}
              {activeTab === 'choices' && (
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  All changes are saved automatically
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {/* Hide Close button on lookup tab since LookupEditor has its own save button that closes */}
              {activeTab !== 'lookup' && (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                           bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                           rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              )}
              {/* Hide Save button on choices and lookup tabs since they have their own save buttons */}
              {activeTab !== 'choices' && activeTab !== 'lookup' && (
                <button
                  onClick={handleSaveColumnInfo}
                  disabled={saving || !hasChanges()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                           ${hasChanges()
                             ? 'bg-green-600 hover:bg-green-700'
                             : 'bg-gray-400 cursor-not-allowed'}`}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnEditorModal;
