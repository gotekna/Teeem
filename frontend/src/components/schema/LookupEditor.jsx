import React, { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * LookupEditor - Manage lookup column configuration
 * Allows selecting which table and column this lookup field references
 */
const LookupEditor = ({ foundationId, column, onUpdate, onClose }) => {
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(column?.lookup_foundation_id || '');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedDisplayColumnId, setSelectedDisplayColumnId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch all available tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/v1/foundations');
        if (response.success) {
          setTables(response.tables || []);
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  // Fetch columns for selected table
  useEffect(() => {
    const fetchColumns = async () => {
      if (!selectedTableId) {
        setAvailableColumns([]);
        setSelectedDisplayColumnId('');
        return;
      }

      try {
        const response = await api.get(`/api/v1/foundations/${selectedTableId}`);
        if (response.success && response.table) {
          const columns = response.table.columns || [];
          setAvailableColumns(columns);

          // If we have a lookup_display_column name from the column prop, find its ID and set it
          if (column?.lookup_display_column && columns.length > 0) {
            const matchingColumn = columns.find(c => c.column_name === column.lookup_display_column);
            if (matchingColumn) {
              setSelectedDisplayColumnId(matchingColumn.id.toString());
            } else {
              // Column name doesn't match any available columns, reset
              setSelectedDisplayColumnId('');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching columns:', error);
        setAvailableColumns([]);
        setSelectedDisplayColumnId('');
      }
    };

    fetchColumns();
  }, [selectedTableId, column?.lookup_display_column]);

  const handleSave = async () => {
    console.log('🔵 handleSave called', {
      selectedTableId,
      selectedDisplayColumnId,
      foundationId,
      columnId: column.id
    });

    if (!selectedTableId || !selectedDisplayColumnId) {
      console.log('❌ Validation failed - missing table or display column');
      alert('Please select a table and a display column');
      return;
    }

    // Find the display column name from the selected column ID
    const displayColumn = availableColumns.find(c => c.id === parseInt(selectedDisplayColumnId));
    console.log('🔍 Looking for display column:', {
      selectedDisplayColumnId,
      availableColumns: availableColumns.map(c => ({ id: c.id, name: c.name })),
      foundColumn: displayColumn
    });

    if (!displayColumn) {
      console.log('❌ Display column not found');
      alert('Display column not found');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        column: {
          lookup_foundation_id: selectedTableId,
          lookup_display_column: displayColumn.column_name  // Send column_name, not ID
        }
      };
      console.log('📤 Sending PATCH request:', {
        url: `/api/v1/foundations/${foundationId}/columns/${column.id}`,
        payload
      });

      const response = await api.patch(
        `/api/v1/foundations/${foundationId}/columns/${column.id}`,
        payload
      );

      console.log('📥 Response received:', response);

      if (response.success) {
        console.log('✅ Save successful, calling onUpdate and onClose');
        // Call onUpdate to refresh the column data
        if (onUpdate) {
          await onUpdate();
        }
        // Close the modal after successful save
        if (onClose) {
          onClose();
        }
      } else {
        console.log('❌ Save failed:', response);
        alert('❌ Failed to save: ' + (response.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error saving lookup configuration:', error);
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tables...</p>
      </div>
    );
  }

  const selectedTable = tables.find(t => t.id === parseInt(selectedTableId));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">🔗</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manage Lookup Configuration
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select which table and column this lookup field references
          </p>
        </div>
      </div>

      {/* Table Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Table
        </label>
        <select
          value={selectedTableId}
          onChange={(e) => {
            setSelectedTableId(e.target.value);
            setSelectedDisplayColumnId(''); // Reset display column selection when table changes
          }}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Select a table --</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name} (ID: {table.id})
            </option>
          ))}
        </select>
        {selectedTableId && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Selected: {selectedTable?.name || 'Unknown table'}
          </p>
        )}
      </div>

      {/* Display Column Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Display Column
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(What to show to users)</span>
        </label>
        <select
          value={selectedDisplayColumnId}
          onChange={(e) => setSelectedDisplayColumnId(e.target.value)}
          disabled={!selectedTableId}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">-- Select a display column --</option>
          {availableColumns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.column_type})
            </option>
          ))}
        </select>
        {selectedDisplayColumnId && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Selected: {availableColumns.find(c => c.id === parseInt(selectedDisplayColumnId))?.name || 'Unknown column'} -
            Type: {availableColumns.find(c => c.id === parseInt(selectedDisplayColumnId))?.column_type || 'Unknown'}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Clear Lookup Button - only show if lookup is configured */}
        <div>
          {column?.lookup_foundation_id && (
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to remove the lookup configuration? This will clear the link to the other table.')) {
                  return;
                }
                try {
                  setSaving(true);
                  const response = await api.patch(
                    `/api/v1/foundations/${foundationId}/columns/${column.id}`,
                    {
                      column: {
                        lookup_foundation_id: null,
                        lookup_display_column: null
                      }
                    }
                  );
                  if (response.success) {
                    if (onUpdate) await onUpdate();
                    if (onClose) onClose();
                  } else {
                    alert('Failed to clear lookup: ' + (response.errors?.join(', ') || 'Unknown error'));
                  }
                } catch (error) {
                  console.error('Error clearing lookup:', error);
                  alert('Error: ' + (error.response?.data?.error || error.message));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear Lookup
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              console.log('🟢 Button clicked!', {
                disabled: saving || !selectedTableId || !selectedDisplayColumnId,
                saving,
                selectedTableId,
                selectedDisplayColumnId,
                event: e
              });
              handleSave();
            }}
            disabled={saving || !selectedTableId || !selectedDisplayColumnId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LookupEditor;
