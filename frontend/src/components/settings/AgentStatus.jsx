import { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  CheckCircleIcon,
  XCircleIcon,
  PlayCircleIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  Bars3Icon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
// Note: Agents are run via Claude Code CLI, not from this UI

export default function AgentStatus() {
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgentDescription, setSelectedAgentDescription] = useState(null);

  // Table state - RULE #19 compliance
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [columnWidths, setColumnWidths] = useState(() => {
    const defaultWidths = {
      agent: 180,
      category: 100,
      description: 200,
      status: 75,
      lastRun: 90,
      totalRuns: 50,
      tokens: 70,
      createdBy: 90,
      updatedBy: 90
    };
    const saved = localStorage.getItem('agentStatus_columnWidths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new columns have widths
        return { ...defaultWidths, ...parsed };
      } catch (e) {
        console.error('Error parsing saved column widths:', e);
      }
    }
    return defaultWidths;
  });
  const [resizingColumn, setResizingColumn] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaultVisible = {
      agent: true,
      category: true,
      description: true,
      status: true,
      lastRun: true,
      totalRuns: true,
      tokens: true,
      createdBy: true,
      updatedBy: true
    };
    const saved = localStorage.getItem('agentStatus_visibleColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new columns are visible
        return { ...defaultVisible, ...parsed };
      } catch (e) {
        console.error('Error parsing saved visible columns:', e);
      }
    }
    return defaultVisible;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [columnOrder, setColumnOrder] = useState(() => {
    const defaultOrder = ['agent', 'category', 'description', 'status', 'lastRun', 'totalRuns', 'tokens', 'createdBy', 'updatedBy'];
    const saved = localStorage.getItem('agentStatus_columnOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Add any new columns that aren't in the saved order
        const missingColumns = defaultOrder.filter(col => !parsed.includes(col));
        if (missingColumns.length > 0) {
          // Insert missing columns before the last two columns (createdBy, updatedBy)
          const insertIndex = Math.max(0, parsed.length - 2);
          return [...parsed.slice(0, insertIndex), ...missingColumns, ...parsed.slice(insertIndex)];
        }
        return parsed;
      } catch (e) {
        console.error('Error parsing saved column order:', e);
      }
    }
    return defaultOrder;
  });
  const [draggingColumn, setDraggingColumn] = useState(null);

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  // Persist table state to localStorage
  useEffect(() => {
    localStorage.setItem('agentStatus_columnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem('agentStatus_visibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('agentStatus_columnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Column resize handlers
  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(1, resizeStartWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const fetchAgentStatus = async () => {
    try {
      setLoading(true);
      // RULE #1.13 - Single Source of Truth: Fetch all agent data from API
      const data = await api.get('/api/v1/agents');
      setAgentData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // RULE #1.13 - Single Source of Truth: Data comes from API, not hardcoded
  // These functions now just pass through the data from the agent object
  const getAgentIcon = (agent) => {
    return agent.icon || '🤖';
  };

  const getAgentDisplayName = (agent) => {
    return agent.name || agent.agent_id;
  };

  const getAgentDescription = (agent) => {
    return agent.description || agent.focus || 'Specialized Claude Code agent';
  };

  const getStatusBadge = (status) => {
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircleIcon className="h-3 w-3" />
          Success
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
          <XCircleIcon className="h-3 w-3" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
        <PlayCircleIcon className="h-3 w-3" />
        No runs
      </span>
    );
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleColumnFilterChange = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  // Convert API response to array format
  const agentsArray = agentData
    ? agentData.map(agent => ({
        id: agent.agent_id,
        name: agent.name,
        displayName: getAgentDisplayName(agent),
        icon: getAgentIcon(agent),
        category: agent.category,
        description: getAgentDescription(agent),
        last_run: agent.last_run_at,
        last_run_by_name: agent.last_run_by_name,
        last_run_details: agent.last_run_details,
        last_run_tokens: agent.last_run_tokens,
        total_tokens: agent.total_tokens,
        status: agent.last_status,
        total_runs: agent.total_runs || 0,
        success_rate: agent.success_rate || 0,
        created_at: agent.created_at,
        created_by_name: agent.created_by_name,
        updated_at: agent.updated_at,
        updated_by_name: agent.updated_by_name
      }))
    : [];

  // Get unique categories for filter dropdown
  const categories = [...new Set(agentsArray.map(a => a.category).filter(Boolean))].sort();

  // Filter and sort
  const filteredAgents = agentsArray
    .filter(agent => {
      // Category filter
      if (categoryFilter !== 'all' && agent.category !== categoryFilter) {
        return false;
      }
      if (globalSearch) {
        const search = globalSearch.toLowerCase();
        if (
          !agent.displayName?.toLowerCase().includes(search) &&
          !agent.description?.toLowerCase().includes(search) &&
          !agent.category?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      for (const [key, value] of Object.entries(columnFilters)) {
        if (value) {
          const fieldValue = String(agent[key] || '').toLowerCase();
          if (!fieldValue.includes(value.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  // Get token usage from last_run_tokens column (primary) or last_run_details (fallback)
  const getTokenDisplay = (agent) => {
    // Check new column first (preferred)
    if (agent.last_run_tokens) {
      const tokens = agent.last_run_tokens;
      // Format as "8.5K" for thousands
      const formatted = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : String(tokens);
      return formatted;
    }
    // Fallback to legacy details field
    const details = agent.last_run_details;
    if (details?.tokens_used) {
      const tokens = details.tokens_used;
      const formatted = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : String(tokens);
      return formatted;
    }
    return null;
  };

  const columns = [
    { key: 'agent', label: 'Agent', sortable: true, searchable: true },
    { key: 'category', label: 'Category', sortable: true, searchable: true },
    { key: 'description', label: 'Description', sortable: true, searchable: true },
    { key: 'status', label: 'Status', sortable: true, searchable: false },
    { key: 'lastRun', label: 'Last Run', sortable: true, searchable: false },
    { key: 'totalRuns', label: 'Total Runs', sortable: true, searchable: false },
    { key: 'tokens', label: 'Tokens', sortable: true, searchable: false },
    { key: 'createdBy', label: 'Created By', sortable: true, searchable: true },
    { key: 'updatedBy', label: 'Updated', sortable: true, searchable: true }
  ];

  if (loading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex">
          <XCircleIcon className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading agent status</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 px-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Claude Code Agents
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Monitor and run specialized Claude Code agents for development tasks
        </p>
      </div>

      {/* Table Toolbar - RULE #19.11A */}
      <div className="mb-4 px-6 flex items-center justify-between gap-4" style={{ minHeight: '44px' }}>
        {/* LEFT SIDE: Global Search */}
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* RIGHT SIDE: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm whitespace-nowrap"
              >
                Clear Selection
              </button>
            </>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchAgentStatus}
            disabled={loading}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title="Toggle columns"
            >
              <EyeIcon className="h-5 w-5" />
            </button>

            {/* Column Picker Dropdown */}
            {showColumnPicker && (
              <div className="absolute right-0 z-20 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[200px]">
                {columns.map(column => (
                  <label key={column.key} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.key]}
                      onChange={() => {
                        setVisibleColumns(prev => ({
                          ...prev,
                          [column.key]: !prev[column.key]
                        }));
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{column.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table - RULE #19.2 Sticky Headers, #19.3 Inline Filters, #19.5B Resizable */}
      <div className={`bg-white dark:bg-gray-800 shadow overflow-hidden flex-1 flex flex-col ${resizingColumn ? 'select-none cursor-col-resize' : ''}`}>
        <div className="overflow-auto flex-1">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 sticky top-0 z-10">
              <tr>
                {/* Row Selection - RULE #19.9 */}
                <th className="px-2 py-3 w-8 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.size === filteredAgents.length && filteredAgents.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredAgents.map(a => a.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                {columnOrder
                  .map(key => columns.find(col => col.key === key))
                  .filter(column => column && visibleColumns[column.key])
                  .map(column => (
                  <th
                    key={column.key}
                    draggable={!resizingColumn}
                    onDragStart={(e) => {
                      if (resizingColumn) {
                        e.preventDefault();
                        return;
                      }
                      setDraggingColumn(column.key);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedCol = draggingColumn;
                      const targetCol = column.key;
                      if (draggedCol && draggedCol !== targetCol) {
                        const newOrder = [...columnOrder];
                        const dragIndex = newOrder.indexOf(draggedCol);
                        const targetIndex = newOrder.indexOf(targetCol);
                        newOrder.splice(dragIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedCol);
                        setColumnOrder(newOrder);
                      }
                      setDraggingColumn(null);
                    }}
                    onDragEnd={() => setDraggingColumn(null)}
                    style={{ width: columnWidths[column.key] }}
                    className={`relative px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${draggingColumn === column.key ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {/* Drag handle icon */}
                          <Bars3Icon
                            className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
                            title="Drag to reorder"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {/* Sortable area */}
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (column.sortable) handleSort(column.key);
                            }}
                          >
                            <div>{column.label}</div>
                            {column.sortable && sortConfig.key === column.key && (
                              sortConfig.direction === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                        </div>
                        {column.searchable && column.key !== 'category' && (
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={columnFilters[column.key] || ''}
                            onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                        )}
                        {column.key === 'category' && (
                          <select
                            value={categoryFilter}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCategoryFilter(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="all">All</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>
                                {cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors z-20"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setResizingColumn(column.key);
                        setResizeStartX(e.clientX);
                        setResizeStartWidth(columnWidths[column.key]);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAgents.map(agent => (
                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {/* Row Selection */}
                  <td className="px-2 py-3 w-8 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.has(agent.id)}
                      onChange={() => {
                        const newSelected = new Set(selectedIds);
                        if (newSelected.has(agent.id)) {
                          newSelected.delete(agent.id);
                        } else {
                          newSelected.add(agent.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  {/* Render cells in column order */}
                  {columnOrder
                    .filter(key => visibleColumns[key])
                    .map(key => {
                      if (key === 'agent') {
                        return (
                          <td key="agent" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.agent }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xl flex-shrink-0">{agent.icon}</span>
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {agent.displayName}
                              </div>
                            </div>
                          </td>
                        );
                      } else if (key === 'category') {
                        const categoryColors = {
                          'validation': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                          'deployment': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                          'planning': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                          'development': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        };
                        const colorClass = categoryColors[agent.category] || 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
                        return (
                          <td key="category" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.category }}>
                            {agent.category ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                                {agent.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        );
                      } else if (key === 'description') {
                        return (
                          <td
                            key="description"
                            className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 overflow-hidden"
                            style={{ width: columnWidths.description }}
                            onDoubleClick={() => setSelectedAgentDescription({
                              name: agent.name || agent.agent_id,
                              description: agent.description
                            })}
                            title="Double-click to view full description"
                          >
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {agent.description}
                            </div>
                          </td>
                        );
                      } else if (key === 'status') {
                        return (
                          <td key="status" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.status }}>
                            {getStatusBadge(agent.status)}
                          </td>
                        );
                      } else if (key === 'lastRun') {
                        return (
                          <td key="lastRun" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.lastRun }}>
                            {agent.last_run ? (
                              <>
                                <div className="text-xs text-gray-900 dark:text-white truncate">
                                  {agent.last_run_by_name || '-'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {formatDate(agent.last_run)}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        );
                      } else if (key === 'totalRuns') {
                        return (
                          <td key="totalRuns" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.totalRuns }}>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {agent.total_runs || 0}
                            </div>
                          </td>
                        );
                      } else if (key === 'tokens') {
                        const tokens = getTokenDisplay(agent);
                        return (
                          <td key="tokens" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.tokens }}>
                            {tokens ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                {tokens}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        );
                      } else if (key === 'createdBy') {
                        return (
                          <td key="createdBy" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.createdBy }}>
                            <div className="text-xs text-gray-900 dark:text-white truncate">
                              {agent.created_by_name || '-'}
                            </div>
                            {agent.created_at && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {formatDate(agent.created_at)}
                              </div>
                            )}
                          </td>
                        );
                      } else if (key === 'updatedBy') {
                        return (
                          <td key="updatedBy" className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.updatedBy }}>
                            <div className="text-xs text-gray-900 dark:text-white truncate">
                              {agent.updated_by_name || '-'}
                            </div>
                            {agent.updated_at && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {formatDate(agent.updated_at)}
                              </div>
                            )}
                          </td>
                        );
                      }
                      return null;
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 px-6 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAgents.length} of {agentsArray.length} agents
        {(globalSearch || Object.keys(columnFilters).length > 0) && ' (filtered)'}
      </div>

      {/* Description Modal */}
      {selectedAgentDescription && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedAgentDescription(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedAgentDescription.name}
              </h3>
              <button
                onClick={() => setSelectedAgentDescription(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
              {selectedAgentDescription.description}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedAgentDescription(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
