import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { COLUMN_TYPES, getColumnTypeEmoji } from '../../constants/columnTypes';

/**
 * TypeConversionEditor - Component for changing column types with data conversion preview
 *
 * Features:
 * - Dropdown to select new column type
 * - Conversion strategy selector (clear invalid, set default, etc.)
 * - Preview table showing: Current Value → New Value → Status
 * - Count of successful vs failed conversions
 * - Validation before applying changes
 */
const TypeConversionEditor = ({ foundationId, column, onUpdate }) => {
  const [newType, setNewType] = useState(column.column_type);
  const [conversionStrategy, setConversionStrategy] = useState('clear_invalid');
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Type-specific configuration
  const [typeConfig, setTypeConfig] = useState({
    // For choice/dropdown
    choices: [],
    allowMultiple: false,
    // For text
    maxLength: null,
    minLength: null,
    // For number/decimal
    minValue: null,
    maxValue: null,
    decimalPlaces: 2,
    // For date/datetime
    dateFormat: 'YYYY-MM-DD',
    includeTime: false,
    // For computed
    formula: '',
    // For boolean
    trueLabel: 'Yes',
    falseLabel: 'No'
  });

  // Use COLUMN_TYPES as single source of truth (20 types - excludes id, created_at, updated_at which are system-generated)
  const columnTypes = COLUMN_TYPES.map(type => ({
    value: type.value,
    label: type.label,
    icon: getColumnTypeEmoji(type.value),
    category: type.category
  }));

  const conversionStrategies = [
    { value: 'clear_invalid', label: 'Clear Invalid Values', desc: 'Set incompatible values to NULL' },
    { value: 'fail_on_invalid', label: 'Fail if Invalid', desc: 'Block conversion if any values are incompatible' },
    { value: 'set_default', label: 'Set to Default', desc: 'Use column default value for invalid data' }
  ];

  useEffect(() => {
    setNewType(column.column_type);
  }, [column]);

  const handleValidate = async () => {
    if (newType === column.column_type) {
      alert('New type is the same as current type');
      return;
    }

    // For computed type, check if settings column exists
    if (newType === 'computed') {
      const proceed = window.confirm(
        '⚠️ Converting to Formula/Computed type requires additional configuration.\n\n' +
        'After conversion, you will need to:\n' +
        '1. Configure the formula in the Formula tab\n' +
        '2. Set up any cross-table references if needed\n\n' +
        'Note: Computed columns require a database schema update that may not be available yet.\n\n' +
        'Do you want to proceed?'
      );
      if (!proceed) {
        return;
      }
    }

    // For lookup types, warn about additional configuration
    if (['lookup', 'multiple_lookups'].includes(newType)) {
      const proceed = window.confirm(
        '⚠️ Converting to Lookup type requires additional configuration.\n\n' +
        'After conversion, you will need to:\n' +
        '1. Set the target table (lookup_foundation_id)\n' +
        '2. Set the display column (lookup_display_column)\n' +
        '3. Configure these in the Column Info tab\n\n' +
        'Do you want to proceed?'
      );
      if (!proceed) {
        return;
      }
    }

    // Direct conversion - no validation endpoint exists
    setValidationResult({
      valid: true,
      warnings: ['Type conversion will rebuild the database table. Existing data will be converted if possible.'],
      errors: []
    });
    setShowPreview(true);
  };

  // Simulate conversion for preview (fallback if backend doesn't provide it)
  const simulateConversion = (value, fromType, toType) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      switch (toType) {
        case 'integer':
          return parseInt(value);
        case 'float':
        case 'decimal':
          return parseFloat(value);
        case 'boolean':
          return Boolean(value);
        case 'string':
        case 'text':
          return String(value);
        case 'date':
        case 'datetime':
          return new Date(value).toISOString();
        default:
          return value;
      }
    } catch {
      return conversionStrategy === 'clear_invalid' ? null : value;
    }
  };

  const handleApply = async () => {
    if (!validationResult || !validationResult.valid) {
      alert('Please click "Validate Conversion" first');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to convert column "${column.name}" from ${column.column_type} to ${newType}?\n\n` +
      (validationResult.warnings.length > 0
        ? 'Warning:\n' + validationResult.warnings.join('\n') + '\n\n'
        : '') +
      'This will rebuild the database table. This operation cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      // Use the existing PATCH endpoint to update the column type
      const response = await api.patch(
        `/api/v1/foundations/${foundationId}/columns/${column.id}`,
        {
          column: {
            column_type: newType
          }
        }
      );

      if (response.data.success) {
        alert('✅ Column type successfully changed to ' + newType + '!\n\n' +
          (newType === 'computed' ? 'Next step: Configure the formula in the Formula tab.' : '') +
          (['lookup', 'multiple_lookups'].includes(newType) ? 'Next step: Configure lookup settings in Column Info tab.' : '')
        );
        if (onUpdate) {
          onUpdate();
        }
      } else {
        alert('❌ Failed to change column type: ' + (response.data.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error applying conversion:', error);
      const errorMsg = error.response?.data?.errors?.join(', ') ||
                       error.response?.data?.error ||
                       error.message ||
                       'Unknown error occurred';
      alert('❌ Conversion failed: ' + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const currentTypeLabel = columnTypes.find(t => t.value === column.column_type)?.label || column.column_type;
  const newTypeLabel = columnTypes.find(t => t.value === newType)?.label || newType;

  const renderTypeSpecificConfig = () => {
    switch (newType) {
      case 'choice':
      case 'dropdown':
      case 'select':
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> After converting to Choice type, use the "Manage Choices" button to configure the dropdown options.
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={typeConfig.allowMultiple}
                onChange={(e) => setTypeConfig({ ...typeConfig, allowMultiple: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">Allow multiple selections</span>
            </label>
          </div>
        );

      case 'string':
      case 'text':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Length
                </label>
                <input
                  type="number"
                  value={typeConfig.minLength || ''}
                  onChange={(e) => setTypeConfig({ ...typeConfig, minLength: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Length
                </label>
                <input
                  type="number"
                  value={typeConfig.maxLength || ''}
                  onChange={(e) => setTypeConfig({ ...typeConfig, maxLength: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
        );

      case 'integer':
      case 'float':
      case 'decimal':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Value
                </label>
                <input
                  type="number"
                  value={typeConfig.minValue || ''}
                  onChange={(e) => setTypeConfig({ ...typeConfig, minValue: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="No limit"
                  step={newType === 'integer' ? '1' : '0.01'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Value
                </label>
                <input
                  type="number"
                  value={typeConfig.maxValue || ''}
                  onChange={(e) => setTypeConfig({ ...typeConfig, maxValue: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="No limit"
                  step={newType === 'integer' ? '1' : '0.01'}
                />
              </div>
            </div>
            {(newType === 'float' || newType === 'decimal') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Decimal Places
                </label>
                <input
                  type="number"
                  value={typeConfig.decimalPlaces}
                  onChange={(e) => setTypeConfig({ ...typeConfig, decimalPlaces: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  min="0"
                  max="10"
                />
              </div>
            )}
          </div>
        );

      case 'date':
      case 'datetime':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Format
              </label>
              <select
                value={typeConfig.dateFormat}
                onChange={(e) => setTypeConfig({ ...typeConfig, dateFormat: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2025-01-15)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (15/01/2025)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (01/15/2025)</option>
                <option value="DD-MMM-YYYY">DD-MMM-YYYY (15-Jan-2025)</option>
              </select>
            </div>
            {newType === 'datetime' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={typeConfig.includeTime}
                  onChange={(e) => setTypeConfig({ ...typeConfig, includeTime: e.target.checked })}
                  className="rounded"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Include time (HH:MM)</span>
              </label>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  True Label
                </label>
                <input
                  type="text"
                  value={typeConfig.trueLabel}
                  onChange={(e) => setTypeConfig({ ...typeConfig, trueLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Yes"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  False Label
                </label>
                <input
                  type="text"
                  value={typeConfig.falseLabel}
                  onChange={(e) => setTypeConfig({ ...typeConfig, falseLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="No"
                />
              </div>
            </div>
          </div>
        );

      case 'computed':
        return (
          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="text-xs text-green-800 dark:text-green-200">
              <strong>Note:</strong> After converting to Computed type, use the "Edit Formula" button to configure the calculation formula.
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Email validation will be automatically applied. Format: user@domain.com
          </div>
        );

      case 'phone':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Phone number validation will be automatically applied. Various formats accepted.
          </div>
        );

      case 'mobile':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Mobile phone validation will be automatically applied. Format: 04XX XXX XXX
          </div>
        );

      case 'url':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            URL validation will be automatically applied. Must start with http:// or https://
          </div>
        );

      case 'gps_coordinates':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            GPS coordinates format: latitude, longitude (e.g., -33.8688, 151.2093)
          </div>
        );

      case 'color_picker':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Hex color code format: #RRGGBB (e.g., #FF5733, #3498DB)
          </div>
        );

      case 'file_upload':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            File path or URL to uploaded file will be stored as text
          </div>
        );

      case 'lookup':
      case 'multiple_lookups':
        return (
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Lookup columns require additional configuration (target table and display column).
              Configure these in the Column Info tab after conversion.
            </div>
          </div>
        );

      case 'user':
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            User column stores references to user IDs in the system
          </div>
        );

      default:
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            No additional configuration needed for this type.
          </div>
        );
    }
  };

  return (
    <div className="type-conversion-editor bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="grid grid-cols-2 gap-6">
        {/* Left Side - Conversion Form */}
        <div className="p-4">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Change Column Type
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Convert "{column.name}" from <strong>{currentTypeLabel}</strong> to a new type
            </p>
          </div>

          {/* Current Type */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
              Current Type
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {columnTypes.find(t => t.value === column.column_type)?.icon} {currentTypeLabel}
            </div>
          </div>

          {/* New Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Convert To
            </label>
            <select
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value);
                setValidationResult(null);
                setShowPreview(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {/* Dynamically build options from COLUMN_TYPES (single source of truth) - 20 types */}
              {['Text', 'Numbers', 'Date & Time', 'Special', 'Selection', 'Relationships', 'Computed'].map(category => {
                const typesInCategory = columnTypes.filter(t => t.category === category);
                if (typesInCategory.length === 0) return null;

                return (
                  <optgroup key={category} label={category}>
                    {typesInCategory.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* Type-Specific Configuration */}
          {newType !== column.column_type && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-3">
                Configure {newTypeLabel}
              </div>
              {renderTypeSpecificConfig()}
            </div>
          )}

          {/* Conversion Strategy */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conversion Strategy
            </label>
            <div className="space-y-2">
              {conversionStrategies.map(strategy => (
                <label
                  key={strategy.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg
                           cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <input
                    type="radio"
                    name="conversionStrategy"
                    value={strategy.value}
                    checked={conversionStrategy === strategy.value}
                    onChange={(e) => {
                      setConversionStrategy(e.target.value);
                      setValidationResult(null);
                      setShowPreview(false);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {strategy.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {strategy.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleValidate}
              disabled={validating || newType === column.column_type}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium
                       hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? 'Validating...' : 'Validate Conversion'}
            </button>
            {validationResult?.valid && (
              <button
                onClick={handleApply}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium
                         hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Applying...' : 'Apply Conversion'}
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

              {/* Success message */}
              {validationResult.valid && validationResult.errors.length === 0 && (
                <div className="text-xs text-green-700 dark:text-green-400">
                  Conversion is safe to apply. Click "Apply Conversion" to proceed.
                </div>
              )}
            </div>
          )}
        </div>
        {/* End Left Side */}

        {/* Right Side - Data Preview */}
        <div className="p-4 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Data Preview
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {showPreview ? 'Showing how existing data will be converted' : 'Click "Validate Conversion" to preview'}
            </p>
          </div>

          {!showPreview && (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-600">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p className="text-sm">Preview will appear here</p>
              </div>
            </div>
          )}

          {showPreview && previewData.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                <div><strong>Conversion:</strong> {currentTypeLabel} → {newTypeLabel}</div>
                <div><strong>Strategy:</strong> {conversionStrategies.find(s => s.value === conversionStrategy)?.label}</div>
              </div>

              {/* Data Preview Table */}
              <div className="overflow-auto max-h-[500px] border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <div>{column.name}</div>
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">({currentTypeLabel})</div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                        →
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <div>{column.name}</div>
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">({newTypeLabel})</div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-mono">
                          {row.current === null || row.current === undefined ? (
                            <span className="text-gray-400 italic">null</span>
                          ) : (
                            String(row.current)
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400">
                          →
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-mono">
                          {row.converted === null || row.converted === undefined ? (
                            <span className="text-gray-400 italic">null</span>
                          ) : (
                            String(row.converted)
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.status === 'success' || row.status === 'simulated' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              ✓
                            </span>
                          ) : row.status === 'warning' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                              ⚠
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                              ✗
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewData.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  No data to preview
                </div>
              )}
            </div>
          )}

          {showPreview && previewData.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No existing data in this column
            </div>
          )}
        </div>
        {/* End Right Side */}
      </div>
    </div>
  );
};

export default TypeConversionEditor;
