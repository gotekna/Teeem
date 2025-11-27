import React, { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * RenameEditor - Component for renaming columns with side-by-side preview
 *
 * Features:
 * - Left side: Current column name and database column name
 * - Right side: New column name input and auto-generated database column name
 * - Preview showing all affected references
 * - Validation of new name
 */
const RenameEditor = ({ foundationId, column, onUpdate }) => {
  const [newName, setNewName] = useState(column.name);
  const [newColumnName, setNewColumnName] = useState(column.column_name);
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [autoGenerateColumnName, setAutoGenerateColumnName] = useState(true);

  useEffect(() => {
    setNewName(column.name);
    setNewColumnName(column.column_name);
  }, [column]);

  // Auto-generate database column name from display name
  useEffect(() => {
    if (autoGenerateColumnName && newName) {
      const generated = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setNewColumnName(generated);
    }
  }, [newName, autoGenerateColumnName]);

  const handleValidate = async () => {
    if (!newName.trim()) {
      alert('Column name cannot be empty');
      return;
    }

    if (newName === column.name && newColumnName === column.column_name) {
      alert('No changes to apply');
      return;
    }

    try {
      setValidating(true);
      setValidationResult(null);

      const response = await api.post(
        `/api/v1/foundations/${foundationId}/columns/${column.id}/validate_change`,
        {
          change_type: 'rename',
          new_name: newName,
          new_column_name: newColumnName
        }
      );

      setValidationResult(response.data);
    } catch (error) {
      console.error('Error validating rename:', error);
      alert('Validation failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setValidating(false);
    }
  };

  const handleApply = async () => {
    if (!validationResult || !validationResult.valid) {
      alert('Please validate the rename first');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to rename "${column.name}" to "${newName}"?\n\n` +
      (validationResult.warnings.length > 0
        ? 'Warnings:\n' + validationResult.warnings.join('\n')
        : 'This will update all references to this column.')
    );

    if (!confirmed) return;

    try {
      const response = await api.post(
        `/api/v1/foundations/${foundationId}/columns/${column.id}/apply_change`,
        {
          change_type: 'rename',
          new_name: newName,
          new_column_name: newColumnName
        }
      );

      if (response.data.success) {
        alert('Column renamed successfully!');
        if (onUpdate) {
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Error applying rename:', error);
      alert('Rename failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="rename-editor bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="grid grid-cols-2 gap-6">
        {/* Left Side - Current Name */}
        <div className="p-4">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Current Column Name
            </h4>
          </div>

          {/* Current Display Name */}
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Display Name
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {column.name}
            </div>
          </div>

          {/* Current Database Column Name */}
          <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Database Column Name
            </div>
            <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {column.column_name}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Renaming a column will update all formulas and references that use this column.
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - New Name */}
        <div className="p-4 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              New Column Name
            </h4>
          </div>

          {/* New Display Name */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 text-lg font-bold border-2 border-blue-300 dark:border-blue-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new display name"
            />
          </div>

          {/* New Database Column Name */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Database Column Name
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoGenerateColumnName}
                  onChange={(e) => setAutoGenerateColumnName(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">Auto-generate</span>
              </label>
            </div>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              disabled={autoGenerateColumnName}
              className="w-full px-4 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              placeholder="database_column_name"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must be lowercase, alphanumeric, and underscores only
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleValidate}
              disabled={validating || (!newName.trim())}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium
                       hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? 'Validating...' : 'Validate Rename'}
            </button>
            {validationResult?.valid && (
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium
                         hover:bg-green-600 transition-colors"
              >
                Apply Rename
              </button>
            )}
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className={`p-4 rounded-lg border ${
              validationResult.valid
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className={`text-sm font-semibold mb-2 ${
                validationResult.valid
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              }`}>
                {validationResult.valid ? '✓ Validation Passed' : '✗ Validation Failed'}
              </div>

              {/* Errors */}
              {validationResult.errors && validationResult.errors.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                    Errors:
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, idx) => (
                      <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                    Warnings:
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, idx) => (
                      <li key={idx} className="text-xs text-yellow-600 dark:text-yellow-400">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Affected References */}
              {validationResult.affected_references && validationResult.affected_references.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Affected References ({validationResult.affected_references.length}):
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.affected_references.slice(0, 5).map((ref, idx) => (
                      <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                        {ref}
                      </li>
                    ))}
                    {validationResult.affected_references.length > 5 && (
                      <li className="text-xs text-gray-500 dark:text-gray-500">
                        ... and {validationResult.affected_references.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Success message */}
              {validationResult.valid && validationResult.errors.length === 0 && (
                <div className="text-xs text-green-700 dark:text-green-400">
                  Rename is safe to apply. Click "Apply Rename" to proceed.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenameEditor;
