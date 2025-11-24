import React, { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * FormulaEditor - Component for creating and editing Excel-like formulas for computed columns
 *
 * Features:
 * - Formula input with Excel-like syntax (=price * quantity)
 * - Insert field references from dropdown
 * - Formula syntax help and examples
 * - Live preview with sample data
 * - Supported functions: SUM, AVG, IF, CONCAT, ROUND, etc.
 */
const FormulaEditor = ({ tableId, table, formula, onChange }) => {
  const [formulaValue, setFormulaValue] = useState(formula || '=');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('formula'); // 'formula', 'template', or 'linked'
  const [templateText, setTemplateText] = useState('');
  const [linkedTableColumns, setLinkedTableColumns] = useState({}); // Store columns from linked tables

  useEffect(() => {
    setFormulaValue(formula || '=');
  }, [formula]);

  useEffect(() => {
    // Get available columns from table or fetch from API
    if (table?.columns) {
      setAvailableColumns(table.columns);
    } else if (tableId) {
      // Fetch columns from API if not in table prop
      const fetchColumns = async () => {
        try {
          const response = await api.get(`/api/v1/tables/${tableId}`);
          if (response.success && response.table?.columns) {
            setAvailableColumns(response.table.columns);
          }
        } catch (error) {
          console.error('Error fetching columns for formula editor:', error);
        }
      };
      fetchColumns();
    }
  }, [table, tableId]);

  // Fetch columns from linked tables when available columns change
  useEffect(() => {
    const fetchLinkedTableColumns = async () => {
      const lookupColumns = availableColumns.filter(
        col => col.column_type === 'lookup' || col.column_type === 'link_to_another_record'
      );

      if (lookupColumns.length === 0) {
        setLinkedTableColumns({});
        return;
      }

      const linkedColumns = {};

      for (const lookupCol of lookupColumns) {
        if (lookupCol.lookup_table_id) {
          try {
            const response = await api.get(`/api/v1/tables/${lookupCol.lookup_table_id}`);
            if (response.success && response.table?.columns) {
              linkedColumns[lookupCol.column_name] = response.table.columns;
            }
          } catch (error) {
            console.error(`Error fetching columns for linked table ${lookupCol.lookup_table_id}:`, error);
          }
        }
      }

      setLinkedTableColumns(linkedColumns);
    };

    if (activeTab === 'linked' && availableColumns.length > 0) {
      fetchLinkedTableColumns();
    }
  }, [availableColumns, activeTab]);

  const handleFormulaChange = (value) => {
    // Ensure formula starts with =
    if (!value.startsWith('=')) {
      value = '=' + value;
    }
    setFormulaValue(value);
    if (onChange) {
      onChange(value);
    }
  };

  const handleInsertField = (columnName) => {
    // Insert field at cursor position or at end
    const input = document.getElementById('formula-input');
    const cursorPos = input.selectionStart;
    const before = formulaValue.slice(0, cursorPos);
    const after = formulaValue.slice(cursorPos);

    const newFormula = before + `[${columnName}]` + after;
    setFormulaValue(newFormula);

    if (onChange) {
      onChange(newFormula);
    }

    // Focus back on input
    setTimeout(() => {
      input.focus();
      const newPos = cursorPos + columnName.length + 2;
      input.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleInsertFunction = (functionName) => {
    const input = document.getElementById('formula-input');
    const cursorPos = input.selectionStart;
    const before = formulaValue.slice(0, cursorPos);
    const after = formulaValue.slice(cursorPos);

    const newFormula = before + `${functionName}()` + after;
    setFormulaValue(newFormula);

    if (onChange) {
      onChange(newFormula);
    }

    // Focus and position cursor inside parentheses
    setTimeout(() => {
      input.focus();
      const newPos = cursorPos + functionName.length + 1;
      input.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleTestFormula = async () => {
    if (!formulaValue || formulaValue === '=') {
      setPreviewError('Formula is empty');
      return;
    }

    try {
      setTesting(true);
      setPreviewError(null);

      const response = await api.post(`/api/v1/tables/${tableId}/columns/test_formula`, {
        formula: formulaValue
      });

      if (response.data.success) {
        setPreviewResult(response.data);
        setPreviewError(null);
      } else {
        setPreviewError(response.data.error || 'Formula test failed');
        setPreviewResult(null);
      }
    } catch (error) {
      console.error('Error testing formula:', error);
      setPreviewError(error.response?.data?.error || error.message);
      setPreviewResult(null);
    } finally {
      setTesting(false);
    }
  };

  const excelFunctions = [
    { name: 'SUM', desc: 'Sum values', example: 'SUM(price, tax)' },
    { name: 'AVG', desc: 'Average values', example: 'AVG(score1, score2)' },
    { name: 'IF', desc: 'Conditional', example: 'IF(price > 100, "High", "Low")' },
    { name: 'CONCAT', desc: 'Join text', example: 'CONCAT(first_name, " ", last_name)' },
    { name: 'ROUND', desc: 'Round number', example: 'ROUND(price, 2)' },
    { name: 'ABS', desc: 'Absolute value', example: 'ABS(balance)' },
    { name: 'UPPER', desc: 'Uppercase text', example: 'UPPER(name)' },
    { name: 'LOWER', desc: 'Lowercase text', example: 'LOWER(email)' },
    { name: 'LEN', desc: 'Text length', example: 'LEN(description)' }
  ];

  const operators = [
    { symbol: '+', desc: 'Add' },
    { symbol: '-', desc: 'Subtract' },
    { symbol: '*', desc: 'Multiply' },
    { symbol: '/', desc: 'Divide' },
    { symbol: '(', desc: 'Open parenthesis' },
    { symbol: ')', desc: 'Close parenthesis' },
    { symbol: '=', desc: 'Equal to' },
    { symbol: '>', desc: 'Greater than' },
    { symbol: '<', desc: 'Less than' },
    { symbol: ',', desc: 'Comma separator' }
  ];

  const handleInsertOperator = (operator) => {
    const input = document.getElementById('formula-input');
    const cursorPos = input.selectionStart;
    const before = formulaValue.slice(0, cursorPos);
    const after = formulaValue.slice(cursorPos);

    const newFormula = before + operator + after;
    setFormulaValue(newFormula);

    if (onChange) {
      onChange(newFormula);
    }

    // Focus back on input
    setTimeout(() => {
      input.focus();
      const newPos = cursorPos + operator.length;
      input.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleDragStart = (e, columnName, type) => {
    e.dataTransfer.setData('text/plain', type === 'column' ? `[${columnName}]` : columnName);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    const input = document.getElementById('formula-input');
    const cursorPos = input.selectionStart || formulaValue.length;
    const before = formulaValue.slice(0, cursorPos);
    const after = formulaValue.slice(cursorPos);

    const newFormula = before + data + after;
    setFormulaValue(newFormula);

    if (onChange) {
      onChange(newFormula);
    }

    // Focus back on input
    setTimeout(() => {
      input.focus();
      const newPos = cursorPos + data.length;
      input.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Text Template Builder functions
  const handleInsertColumnToTemplate = (columnName) => {
    const input = document.getElementById('template-input');
    const cursorPos = input?.selectionStart || templateText.length;
    const before = templateText.slice(0, cursorPos);
    const after = templateText.slice(cursorPos);

    const newTemplate = before + `{${columnName}}` + after;
    setTemplateText(newTemplate);

    // Focus back on input
    setTimeout(() => {
      input?.focus();
      const newPos = cursorPos + columnName.length + 2;
      input?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const convertTemplateToFormula = () => {
    if (!templateText) return '=';

    // Split by column placeholders {column_name}
    const parts = [];
    let currentText = '';
    let i = 0;

    while (i < templateText.length) {
      if (templateText[i] === '{') {
        // Found a column placeholder
        if (currentText) {
          // Add the text before this placeholder
          parts.push(`"${currentText.replace(/"/g, '\\"')}"`);
          currentText = '';
        }

        // Find the closing }
        const closeIndex = templateText.indexOf('}', i);
        if (closeIndex !== -1) {
          const columnName = templateText.slice(i + 1, closeIndex);
          parts.push(`[${columnName}]`);
          i = closeIndex + 1;
        } else {
          currentText += templateText[i];
          i++;
        }
      } else {
        currentText += templateText[i];
        i++;
      }
    }

    // Add any remaining text
    if (currentText) {
      parts.push(`"${currentText.replace(/"/g, '\\"')}"`);
    }

    if (parts.length === 0) return '=';
    if (parts.length === 1) return `=${parts[0]}`;

    return `=CONCAT(${parts.join(', ')})`;
  };

  const handleApplyTemplate = () => {
    const formula = convertTemplateToFormula();
    setFormulaValue(formula);
    if (onChange) {
      onChange(formula);
    }
    setActiveTab('formula'); // Switch back to formula tab to see the result
  };

  // Linked Data functions
  const handleInsertLinkedData = (lookupColumnName, relatedColumnName) => {
    const input = document.getElementById('formula-input');
    const cursorPos = input?.selectionStart || formulaValue.length;
    const before = formulaValue.slice(0, cursorPos);
    const after = formulaValue.slice(cursorPos);

    // Generate LOOKUP formula syntax
    const lookupFormula = `LOOKUP([${lookupColumnName}], "${relatedColumnName}")`;
    const newFormula = before + lookupFormula + after;
    setFormulaValue(newFormula);

    if (onChange) {
      onChange(newFormula);
    }

    // Switch back to formula tab and focus
    setActiveTab('formula');
    setTimeout(() => {
      input?.focus();
      const newPos = cursorPos + lookupFormula.length;
      input?.setSelectionRange(newPos, newPos);
    }, 100);
  };

  return (
    <div className="formula-editor h-full flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('formula')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'formula'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          📐 Formula
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'template'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          📝 Text Template
        </button>
        <button
          onClick={() => setActiveTab('linked')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'linked'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          🔗 Linked Data
        </button>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Side - Formula Editor or Template Builder */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'formula' ? (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Formula Editor
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drag columns and functions into the formula, or click to insert
                </p>
              </div>

        {/* Formula Input */}
        <div className="mb-4 flex-1 flex flex-col">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Formula
          </label>
          <div className="relative flex-1">
            <textarea
              id="formula-input"
              value={formulaValue}
              onChange={(e) => handleFormulaChange(e.target.value)}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full h-full min-h-[200px] px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                       font-mono text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-none"
              placeholder="=price * quantity"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleTestFormula}
              disabled={testing}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600
                       transition-colors font-medium disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Formula'}
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600
                       transition-colors font-medium"
            >
              {showHelp ? 'Hide' : 'Show'} Help
            </button>
          </div>
        </div>

        {/* Preview Result */}
        {previewResult && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200
                        dark:border-green-800 rounded-lg">
            <div className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
              Preview Result
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Tested with record ID: {previewResult.tested_with_record_id}
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-green-200
                            dark:border-green-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Result:</div>
                <div className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                  {JSON.stringify(previewResult.result)}
                </div>
              </div>
              {previewResult.sample_data && Object.keys(previewResult.sample_data).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sample data:</div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded border border-green-200
                                dark:border-green-700 text-xs font-mono">
                    {JSON.stringify(previewResult.sample_data, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {previewError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200
                        dark:border-red-800 rounded-lg">
            <div className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
              Formula Error
            </div>
            <div className="text-sm text-red-700 dark:text-red-400">
              {previewError}
            </div>
          </div>
        )}

        {/* Help Section */}
        {showHelp && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200
                        dark:border-blue-800 rounded-lg">
            <div className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
              Formula Help
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Basic Syntax
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                  <li>Formulas must start with <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">=</code></li>
                  <li>Reference columns with <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">[column_name]</code></li>
                  <li>Use operators: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">+ - * /</code></li>
                  <li>Strings use double quotes: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">"text"</code></li>
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Examples
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      =[price] * [quantity]
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Multiply two columns
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      =IF([status] = "active", "Yes", "No")
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Conditional logic
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      =CONCAT([first_name], " ", [last_name])
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Combine text fields
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      =ROUND([price] * 1.1, 2)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Price with 10% markup, rounded to 2 decimals
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Available Functions
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {excelFunctions.map((func) => (
                    <div key={func.name} className="p-2 bg-white dark:bg-gray-800 rounded">
                      <div className="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                        {func.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {func.desc}
                      </div>
                      <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                        {func.example}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Cross-Table References
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Reference fields from related tables using the <strong>Linked Data</strong> tab or LOOKUP function:
                </p>
                <div className="space-y-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded border-l-2 border-green-500">
                    <div className="font-mono text-xs text-green-600 dark:text-green-400">
                      =LOOKUP([customer], "email")
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Get the email field from the linked customer record
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded border-l-2 border-green-500">
                    <div className="font-mono text-xs text-green-600 dark:text-green-400">
                      =[quantity] * LOOKUP([product], "unit_price")
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Calculate line total using price from product table
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  🎯 Rollup Aggregations (Calculate Totals from Related Tables)
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  To calculate totals across multiple related records (e.g., PO total from line items):
                </p>
                <div className="space-y-2">
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                    <div className="font-mono text-xs text-orange-600 dark:text-orange-400 mb-1">
                      =ROLLUP([line_items], "line_total")
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Sum the line_total field from all related line items
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold">
                      Use case: Purchase Order total
                    </div>
                  </div>
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                    <div className="font-mono text-xs text-orange-600 dark:text-orange-400 mb-1">
                      =ROLLUP([tasks], "hours_worked", AVG)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Average hours across all related tasks
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold">
                      Use case: Project statistics
                    </div>
                  </div>
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-2 border-orange-500">
                    <div className="font-mono text-xs text-orange-600 dark:text-orange-400 mb-1">
                      =ROLLUP([invoices], "amount", COUNT)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Count the number of related invoices
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold">
                      Use case: Customer invoice count
                    </div>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs">
                  <strong className="text-blue-800 dark:text-blue-300">💡 How it works:</strong>
                  <ul className="mt-1 space-y-1 text-blue-700 dark:text-blue-400 list-disc list-inside">
                    <li><strong>Reverse lookup:</strong> Finds all records in the child table that link back to this record</li>
                    <li><strong>Aggregate:</strong> Applies SUM (default), AVG, COUNT, MIN, or MAX to the specified field</li>
                    <li><strong>Auto-updates:</strong> Recalculates when related records change</li>
                  </ul>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Common Patterns
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      📦 Purchase Order Total
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400 mb-1">
                      PO Table: =ROLLUP([line_items_link], "line_total")
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      Line Item: =[quantity] * [unit_price]
                    </div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      📊 Project Budget vs Actual
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Actual: =ROLLUP([expenses], "amount")
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      Variance: =[budget] - [actual_spent]
                    </div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      👥 Team Performance
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Total Tasks: =ROLLUP([tasks], "id", COUNT)
                    </div>
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      Avg Time: =ROLLUP([tasks], "duration", AVG)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
            </>
          ) : activeTab === 'template' ? (
            <>
              {/* Text Template Builder */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Text Template Builder
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Build text by typing and clicking columns. Use {'{column_name}'} to insert fields.
                </p>
              </div>

              {/* Template Input */}
              <div className="mb-4 flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template
                </label>
                <div className="relative flex-1">
                  <textarea
                    id="template-input"
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="w-full h-full min-h-[200px] px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                             font-mono text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             resize-none"
                    placeholder="Type text and click columns to insert...&#10;Example:&#10;Hello {first_name} {last_name},&#10;Your email is: {email}"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleApplyTemplate}
                    disabled={!templateText}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600
                             transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Formula
                  </button>
                  <button
                    onClick={() => setTemplateText('')}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600
                             transition-colors font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Preview Formula */}
              {templateText && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200
                              dark:border-blue-800 rounded-lg">
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    Generated Formula Preview
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-blue-200
                                dark:border-blue-700 font-mono text-sm text-gray-900 dark:text-gray-100 overflow-x-auto">
                    {convertTemplateToFormula()}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Click "Generate Formula" to apply this to your column
                  </p>
                </div>
              )}
            </>
          ) : activeTab === 'linked' ? (
            <>
              {/* Linked Data Builder */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Linked Data Builder
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reference data from related tables via lookup columns. Click linked table columns to insert.
                </p>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  How it works:
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                  <li>First, your table needs <strong>lookup columns</strong> that link to other tables</li>
                  <li>Then you can reference fields from those linked tables</li>
                  <li>Example: If you have a "Customer" lookup, you can access <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">customer.email</code></li>
                  <li>This generates formulas like: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">LOOKUP([customer], "email")</code></li>
                </ul>
              </div>

              {/* Show lookup columns */}
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Available Lookup Columns:
                </div>
                {availableColumns.filter(col => col.column_type === 'lookup' || col.column_type === 'link_to_another_record').length === 0 ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="text-sm text-yellow-800 dark:text-yellow-300">
                      No lookup columns found in this table.
                    </div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Add lookup columns to your table first to reference data from other tables.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableColumns
                      .filter(col => col.column_type === 'lookup' || col.column_type === 'link_to_another_record')
                      .map(lookupCol => (
                        <div
                          key={lookupCol.id}
                          className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {lookupCol.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            Links to: {lookupCol.lookup_table_name || 'Unknown table'}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Click columns on the right to insert linked data →
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Right Sidebar - Columns, Operators, Functions */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto border-l border-gray-200 dark:border-gray-700 pl-4">
          {activeTab === 'linked' ? (
            <>
              {/* Linked Data Sidebar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  🔗 Lookup Relationships
                </label>
                <div className="space-y-3">
                  {availableColumns
                    .filter(col => col.column_type === 'lookup' || col.column_type === 'link_to_another_record')
                    .length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      No lookup columns in this table
                    </p>
                  ) : (
                    availableColumns
                      .filter(col => col.column_type === 'lookup' || col.column_type === 'link_to_another_record')
                      .map(lookupCol => (
                        <div
                          key={lookupCol.id}
                          className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                        >
                          <div className="font-semibold text-sm text-green-800 dark:text-green-300 mb-1">
                            {lookupCol.name}
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-400 mb-2">
                            → {lookupCol.lookup_table_name || 'Related table'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Click a field to insert:
                          </div>
                          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                            {linkedTableColumns[lookupCol.column_name] ? (
                              linkedTableColumns[lookupCol.column_name].map(relatedCol => (
                                <button
                                  key={relatedCol.id}
                                  onClick={() => handleInsertLinkedData(lookupCol.column_name, relatedCol.column_name)}
                                  className="w-full text-left px-2 py-1.5 text-xs bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30 rounded border border-green-200 dark:border-green-700 transition-colors"
                                >
                                  <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {relatedCol.name}
                                  </div>
                                  <div className="font-mono text-green-600 dark:text-green-400 text-[10px] mt-0.5">
                                    LOOKUP([{lookupCol.column_name}], "{relatedCol.column_name}")
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500 dark:text-gray-400 italic p-2">
                                Loading columns...
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Regular Columns sidebar for Formula and Template tabs */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📊 Columns (Click to Insert)
                </label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableColumns.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No columns available</p>
              ) : (
                availableColumns.map((col) => (
                  <div
                    key={col.id}
                    draggable={activeTab === 'formula'}
                    onDragStart={activeTab === 'formula' ? (e) => handleDragStart(e, col.column_name, 'column') : undefined}
                    onClick={() => activeTab === 'formula' ? handleInsertField(col.column_name) : handleInsertColumnToTemplate(col.column_name)}
                    className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200
                             rounded-lg text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
                             cursor-pointer border border-blue-200 dark:border-blue-800"
                    title={activeTab === 'formula' ? `Drag or click to insert [${col.column_name}]` : `Click to insert {${col.column_name}}`}
                  >
                    <div className="font-medium">{col.name}</div>
                    <div className="text-xs opacity-75 font-mono">
                      {activeTab === 'formula' ? `[${col.column_name}]` : `{${col.column_name}}`}
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>

            {/* Operators and Functions - Only show in Formula tab */}
            {activeTab === 'formula' && (
              <>

        {/* Operators */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            ➕ Operators
          </label>
          <div className="grid grid-cols-5 gap-2">
            {operators.map((op) => (
              <button
                key={op.symbol}
                onClick={() => handleInsertOperator(op.symbol)}
                className="px-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200
                         rounded text-base font-mono hover:bg-gray-200 dark:hover:bg-gray-600
                         transition-colors border border-gray-300 dark:border-gray-600 font-bold"
                title={op.desc}
              >
                {op.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Functions */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            🔧 Functions (Drag or Click)
          </label>
          <div className="space-y-1">
            {excelFunctions.map((func) => (
              <div
                key={func.name}
                draggable
                onDragStart={(e) => handleDragStart(e, `${func.name}()`, 'function')}
                onClick={() => handleInsertFunction(func.name)}
                className="px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200
                         rounded-lg text-sm hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors
                         cursor-move border border-purple-200 dark:border-purple-800"
                title={func.desc}
              >
                <div className="font-mono font-bold">{func.name}()</div>
                <div className="text-xs opacity-75">{func.desc}</div>
              </div>
            ))}
          </div>
              </div>
              </>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormulaEditor;
