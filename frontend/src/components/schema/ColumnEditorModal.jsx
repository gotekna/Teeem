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
const ColumnEditorModal = ({ isOpen, column, table, foundationId, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [editedColumn, setEditedColumn] = useState({
    name: column?.name || '',
    column_name: column?.column_name || '',
    data_type: column?.column_type || column?.data_type || 'single_line_text',
    header_align: column?.header_align || 'left',
    data_align: column?.data_align || 'left',
    column_group: column?.column_group || ''
  });
  const [saving, setSaving] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);

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
        data_type: column.column_type || column.data_type || 'single_line_text',
        header_align: column.header_align || 'left',
        data_align: column.data_align || 'left',
        column_group: column.column_group || ''
      });
    }
  }, [column]);

  // Fetch available columns for reference
  useEffect(() => {
    if (!isOpen || !foundationId) return;

    const fetchColumns = async () => {
      try {
        const response = await api.get(`/api/v1/foundations/${foundationId}`);
        if (response.success && response.table?.columns) {
          setAvailableColumns(response.table.columns);
        }
      } catch (error) {
        console.error('Error fetching columns for column editor:', error);
      }
    };

    fetchColumns();
  }, [isOpen, foundationId]);

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
    console.log('🔴 handleSaveColumnInfo CALLED', {
      columnId: column.id,
      columnName: column.name,
      editedColumn,
      hasChanges: hasChanges()
    });

    try {
      setSaving(true);

      // Validate display name
      if (!editedColumn.name.trim()) {
        console.log('❌ Validation failed: Column name is empty');
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

      console.log('📤 About to send PATCH request:', {
        url: `/api/v1/foundations/${foundationId}/columns/${column.id}`,
        payload: {
          column: {
            name: editedColumn.name,
            column_type: editedColumn.data_type,
            column_group: editedColumn.column_group || null,
            header_align: editedColumn.header_align,
            data_align: editedColumn.data_align
          }
        }
      });

      const result = await api.patch(
        `/api/v1/foundations/${foundationId}/columns/${column.id}`,
        {
          column: {
            name: editedColumn.name,
            // column_name is NEVER sent - database column names cannot be changed after creation
            column_type: editedColumn.data_type,
            column_group: editedColumn.column_group || null,
            header_align: editedColumn.header_align,
            data_align: editedColumn.data_align
          }
        }
      );

      console.log('📥 PATCH response received:', result);

      // api.patch returns the data directly, not wrapped in response.data
      if (result.success) {
        console.log('✅ Save successful, showing alert');
        alert('✅ Column updated successfully!');
        handleUpdate();
        handleClose();
      } else {
        console.log('❌ Save failed:', result);
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
    return editedColumn.name !== column.name ||
           editedColumn.header_align !== (column.header_align || 'left') ||
           editedColumn.data_align !== (column.data_align || 'left') ||
           editedColumn.column_group !== (column.column_group || '');
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

        {/* Content with Columns Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
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

              {/* SECTION 2: Column Alignment */}
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-6 border-2 border-yellow-200 dark:border-yellow-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">⚡</div>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">Column Alignment</h3>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">Control text alignment for headers and data cells</p>
                  </div>
                </div>

                {/* Header Alignment */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Header Alignment
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, header_align: 'left' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.header_align === 'left'
                          ? 'bg-blue-500 text-white border-blue-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                    >
                      <span className="mr-2">⬅️</span> Left
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, header_align: 'center' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.header_align === 'center'
                          ? 'bg-blue-500 text-white border-blue-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                    >
                      <span className="mr-2">↔️</span> Center
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, header_align: 'right' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.header_align === 'right'
                          ? 'bg-blue-500 text-white border-blue-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                    >
                      <span className="mr-2">➡️</span> Right
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Controls how the column header text is aligned
                  </p>
                </div>

                {/* Data Alignment */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Data Alignment
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, data_align: 'left' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.data_align === 'left'
                          ? 'bg-green-500 text-white border-green-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400'
                        }`}
                    >
                      <span className="mr-2">⬅️</span> Left
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, data_align: 'center' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.data_align === 'center'
                          ? 'bg-green-500 text-white border-green-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400'
                        }`}
                    >
                      <span className="mr-2">↔️</span> Center
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditedColumn(prev => ({ ...prev, data_align: 'right' }))}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all
                        ${editedColumn.data_align === 'right'
                          ? 'bg-green-500 text-white border-green-600 shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400'
                        }`}
                    >
                      <span className="mr-2">➡️</span> Right
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Controls how the data cell content is aligned (currency columns default to right)
                  </p>
                </div>
              </div>

              {/* SECTION 3: Column Group */}
              <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-xl p-6 border-2 border-teal-200 dark:border-teal-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">📁</div>
                  <div>
                    <h3 className="text-lg font-bold text-teal-900 dark:text-teal-100">Column Group</h3>
                    <p className="text-xs text-teal-700 dark:text-teal-300">Group columns together in the visibility panel</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={editedColumn.column_group}
                    onChange={(e) => setEditedColumn(prev => ({ ...prev, column_group: e.target.value }))}
                    placeholder="e.g., Contact Info, Financial, System"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-300
                             dark:border-gray-600 text-base text-gray-900 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                             placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Columns with the same group name will be grouped together in the column visibility panel. Leave empty for "Other" group.
                  </p>
                </div>
              </div>

              {/* SECTION 4: Column Type - Read Only (renumbered from 3) */}
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

              {/* SECTION 5: SQL Type & Metadata (renumbered from 4) */}
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
              foundationId={foundationId}
              column={column}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === 'choices' && isChoiceColumn && (
            <ChoiceEditor
              foundationId={foundationId}
              column={column}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === 'formula' && isComputedColumn && (
            <FormulaEditor
              foundationId={foundationId}
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
              foundationId={foundationId}
              column={column}
              onUpdate={handleUpdate}
              onClose={onClose}
            />
          )}
          </div>

          {/* Columns Sidebar */}
          <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 overflow-y-auto p-4">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <span>📊</span> Available Columns
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {availableColumns.length} columns in this table
              </p>
            </div>

            {availableColumns.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                Loading columns...
              </div>
            ) : (
              <div className="space-y-2">
                {availableColumns.map((col) => (
                  <div
                    key={col.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `[${col.column_name}]`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={`p-3 rounded-lg border cursor-move transition-all hover:shadow-md
                              ${col.id === column.id
                                ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                              }`}
                    title={`Drag to use [${col.column_name}]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${
                          col.id === column.id
                            ? 'text-purple-900 dark:text-purple-100'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {col.name}
                          {col.id === column.id && (
                            <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">(current)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mt-0.5">
                          [{col.column_name}]
                        </div>
                      </div>
                      <div className="text-xs shrink-0">
                        {col.column_type === 'lookup' && '🔗'}
                        {col.column_type === 'computed' && '📐'}
                        {['choice', 'dropdown', 'select', 'single_select', 'multi_select'].includes(col.column_type) && '📋'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {col.column_type || 'text'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
