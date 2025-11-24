import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  TableCellsIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowsPointingOutIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { api } from '../api'

// Custom node component for tables
function TableNode({ data }) {
  const headerColor = data.is_system
    ? 'bg-blue-600 dark:bg-blue-700'
    : 'bg-indigo-600 dark:bg-indigo-700'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-lg min-w-[250px]">
      {/* Table Header */}
      <div className={`${headerColor} text-white px-4 py-3 rounded-t-lg flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {data.icon && <span className="text-xl">{data.icon}</span>}
          <h3 className="font-bold text-sm">{data.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          {data.is_system ? (
            <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">System</span>
          ) : data.is_live ? (
            <span className="text-xs bg-green-500 px-2 py-0.5 rounded">Live</span>
          ) : (
            <span className="text-xs bg-gray-500 px-2 py-0.5 rounded">Draft</span>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="p-3">
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {data.columns.slice(0, 10).map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-gray-600 dark:text-gray-400">
                {col.is_title && '🔑 '}
                {col.required && '* '}
                {col.name}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                {col.column_type}
              </span>
            </div>
          ))}
          {data.columns.length > 10 && (
            <div className="text-xs text-gray-400 italic pt-1">
              +{data.columns.length - 10} more columns
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{data.record_count} records</span>
          <Link
            to={`/tables/${data.slug}`}
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <EyeIcon className="h-3 w-3" />
            View
          </Link>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = {
  tableNode: TableNode,
}

// Layout algorithm - flat grid layout
function calculateLayout(tables, relationships) {
  const nodes = []
  const edges = []

  // Separate system and user tables
  const systemTables = tables.filter(t => t.is_system)
  const userTables = tables.filter(t => !t.is_system)

  // Grid configuration
  const nodeWidth = 300
  const nodeHeight = 350
  const horizontalSpacing = 100
  const verticalSpacing = 100
  const tablesPerRow = 4

  let currentX = 50
  let currentY = 50

  // Layout system tables first
  systemTables.forEach((table, index) => {
    if (index > 0 && index % tablesPerRow === 0) {
      currentX = 50
      currentY += nodeHeight + verticalSpacing
    }

    nodes.push({
      id: `table-${table.id}`,
      type: 'tableNode',
      position: { x: currentX, y: currentY },
      width: nodeWidth,
      height: nodeHeight,
      data: {
        ...table,
        label: table.name,
      },
    })

    currentX += nodeWidth + horizontalSpacing
  })

  // Add spacing between system and user tables
  if (systemTables.length > 0) {
    currentX = 50
    currentY += nodeHeight + verticalSpacing + 50
  }

  // Layout user tables
  userTables.forEach((table, index) => {
    if (index > 0 && index % tablesPerRow === 0) {
      currentX = 50
      currentY += nodeHeight + verticalSpacing
    }

    nodes.push({
      id: `table-${table.id}`,
      type: 'tableNode',
      position: { x: currentX, y: currentY },
      width: nodeWidth,
      height: nodeHeight,
      data: {
        ...table,
        label: table.name,
      },
    })

    currentX += nodeWidth + horizontalSpacing
  })

  // Create edges for relationships
  relationships.forEach((rel) => {
    edges.push({
      id: `edge-${rel.id}`,
      source: `table-${rel.from_table_id}`,
      target: `table-${rel.to_table_id}`,
      type: 'smoothstep',
      animated: false,
      label: rel.from_column_name,
      labelStyle: {
        fontSize: 11,
        fill: '#374151',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'white',
        fillOpacity: 0.95,
        rx: 4,
        ry: 4,
      },
      labelBgPadding: [8, 4],
      style: {
        stroke: rel.required ? '#ef4444' : '#6366f1',
        strokeWidth: rel.required ? 3 : 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: rel.required ? '#ef4444' : '#6366f1',
        width: 20,
        height: 20,
      },
    })
  })

  return { nodes, edges }
}

function SchemaPageContent() {
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [layoutType, setLayoutType] = useState('circular')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView } = useReactFlow()

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
      // Fit view to show maximum data when entering fullscreen
      setTimeout(() => {
        fitView({ padding: 0.1, duration: 400 })
      }, 100)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadSchema()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (schema) {
      updateLayout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, searchQuery, filter, layoutType])

  const loadSchema = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/schema')
      setSchema(response)
    } catch (err) {
      setError(err.message || 'Failed to load schema')
    } finally {
      setLoading(false)
    }
  }

  const updateLayout = useCallback(() => {
    if (!schema) return

    // Filter tables
    let filteredTables = schema.tables.filter(table => {
      const matchesSearch = table.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filter === 'all' ||
                           (filter === 'system' && table.is_system) ||
                           (filter === 'user' && !table.is_system) ||
                           (filter === 'live' && table.is_live && !table.is_system) ||
                           (filter === 'draft' && !table.is_live && !table.is_system)
      return matchesSearch && matchesFilter
    })

    // Filter relationships to only include visible tables
    const visibleTableIds = new Set(filteredTables.map(t => t.id))
    const filteredRelationships = schema.relationships.filter(
      rel => visibleTableIds.has(rel.from_table_id) && visibleTableIds.has(rel.to_table_id)
    )

    // Calculate layout
    const { nodes: newNodes, edges: newEdges } = calculateLayout(filteredTables, filteredRelationships)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [schema, searchQuery, filter, layoutType, setNodes, setEdges])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading schema...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadSchema}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-gray-50 dark:bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
        <div className="max-w-full mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Database Schema</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Interactive visualization of all tables and relationships
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {schema?.stats.total_tables}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Tables</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {schema?.stats.system_tables}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">System</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {schema?.stats.user_tables}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">User</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {schema?.stats.total_relationships}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Relations</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filter === 'system'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                System
              </button>
              <button
                onClick={() => setFilter('user')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filter === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                }`}
              >
                User
              </button>
              <button
                onClick={() => setFilter('live')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filter === 'live'
                    ? 'bg-green-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setFilter('draft')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filter === 'draft'
                    ? 'bg-gray-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Draft
              </button>
              <button
                onClick={toggleFullscreen}
                className="px-2 py-1 text-xs rounded font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                <ArrowsPointingOutIcon className="h-3 w-3" />
                {isFullscreen ? 'Exit' : 'Full'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          className="bg-gray-50 dark:bg-gray-900"
        >
          <Background color="#6366f1" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.data.is_system) return '#3b82f6'
              if (node.data.is_live) return '#10b981'
              return '#6366f1'
            }}
            maskColor="rgb(0, 0, 0, 0.1)"
          />

          {/* Legend Panel */}
          <Panel position="top-right" className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Legend</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-indigo-600"></div>
                <span className="text-gray-600 dark:text-gray-400">Optional Link</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500" style={{ height: '2px' }}></div>
                <span className="text-gray-600 dark:text-gray-400">Required Link</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-base">🔑</span>
                <span className="text-gray-600 dark:text-gray-400">Title field</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">*</span>
                <span className="text-gray-600 dark:text-gray-400">Required field</span>
              </div>
            </div>
          </Panel>

          {/* Stats Panel */}
          <Panel position="bottom-right" className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <div>Visible: {nodes.length} tables</div>
              <div>Connections: {edges.length}</div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

export default function SchemaPage() {
  return (
    <ReactFlowProvider>
      <SchemaPageContent />
    </ReactFlowProvider>
  )
}
