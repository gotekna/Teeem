import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusIcon, ArrowDownTrayIcon, TableCellsIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { api } from '../api'

// Layout Components
import ThreePanelLayout from '../components/documentation/ThreePanelLayout'
import DocumentList from '../components/documentation/DocumentList'
import FilterSection from '../components/documentation/FilterSection'
import ChapterList from '../components/documentation/ChapterList'
import EntryList from '../components/documentation/EntryList'
import EntryDetails from '../components/documentation/EntryDetails'
import MarkdownRenderer from '../components/MarkdownRenderer'
import KnowledgeEntryModal from '../components/KnowledgeEntryModal'
import LoadingSkeleton from '../components/documentation/LoadingSkeleton'
import Breadcrumb from '../components/documentation/Breadcrumb'
import UserManualTableView from '../components/documentation/UserManualTableView'
import TeeemTableView from '../components/documentation/TeeemTableView'

export default function TrinityPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Document state
  const [docs, setDocs] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  // For Lexicon (database mode)
  const [entries, setEntries] = useState([])
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({
    chapter: 'all',
    type: 'all',
    status: 'all',
    severity: 'all'
  })

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  // View mode for Lexicon (default to table view)
  const [lexiconViewMode, setLexiconViewMode] = useState('table') // '3-panel' or 'table'

  // View mode for Bible (default to table view)
  const [bibleViewMode, setBibleViewMode] = useState('table') // 'markdown' or 'table'

  // View mode for Teacher
  const [teacherViewMode, setTeacherViewMode] = useState('table') // 'markdown' or 'table'

  // View mode for User Manual
  const [manualViewMode, setManualViewMode] = useState('markdown') // 'markdown' or 'table'

  // View mode for Trinity (always table)
  const [trinityViewMode, setTrinityViewMode] = useState('table') // 'table' only

  // Load docs list on mount
  useEffect(() => {
    loadDocs()
  }, [])

  // Auto-select Bible if no tab selected
  useEffect(() => {
    if (docs.length > 0 && !searchParams.get('tab')) {
      setSearchParams({ tab: 'bible' })
    }
  }, [docs])

  // Load content when tab changes
  useEffect(() => {
    const docId = searchParams.get('tab')
    if (docId && docs.length > 0) {
      const doc = docs.find(d => d.id === docId)
      setSelectedDoc(doc)

      if (docId === 'lexicon') {
        loadLexiconData()
      } else if (docId === 'trinity') {
        loadTrinityData()
      } else if (docId === 'bible') {
        loadBibleData()
      } else if (docId === 'teacher') {
        loadTeacherData()
      } else {
        loadMarkdownContent(docId)
      }
    }
  }, [searchParams, docs])

  // Reload entries when filters change
  useEffect(() => {
    if (selectedDoc?.id === 'lexicon') {
      loadLexiconData()
    }
  }, [filters, searchQuery])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Escape to clear focus
        if (e.key === 'Escape') {
          e.target.blur()
          setSearchQuery('')
        }
        return
      }

      // / - Focus search
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('input[type="text"]')
        searchInput?.focus()
      }

      // Escape - Clear selection and search
      if (e.key === 'Escape') {
        setSelectedEntry(null)
        setSearchQuery('')
      }

      // For Lexicon entries
      if (selectedDoc?.id === 'lexicon' && entries?.length > 0) {
        const currentIndex = selectedEntry
          ? entries.findIndex(e => e.id === selectedEntry.id)
          : -1

        // j or ArrowDown - Next entry
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          const nextIndex = Math.min(currentIndex + 1, entries.length - 1)
          handleEntrySelect(entries[nextIndex])
        }

        // k or ArrowUp - Previous entry
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          const prevIndex = Math.max(currentIndex - 1, 0)
          handleEntrySelect(entries[prevIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedDoc, entries, selectedEntry, searchQuery])

  const loadDocs = async () => {
    try {
      const response = await api.get('/api/v1/documentation')
      if (response.success) {
        setDocs(response.data)
      }
    } catch (error) {
      console.error('Failed to load docs:', error)
    }
  }

  const loadMarkdownContent = async (docId) => {
    setLoading(true)
    try {
      const response = await api.get(`/api/v1/documentation/${docId}`)
      if (response.success) {
        setContent(response.data.content)
      }
    } catch (error) {
      console.error('Failed to load content:', error)
      setContent('# Error\n\nFailed to load documentation.')
    } finally {
      setLoading(false)
    }
  }

  const loadLexiconData = async () => {
    setLoading(true)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (filters.chapter !== 'all') params.append('chapter', filters.chapter)
      if (filters.type !== 'all') params.append('type', filters.type)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.severity !== 'all') params.append('severity', filters.severity)
      if (searchQuery) params.append('search', searchQuery)

      // Load entries (using new trinity endpoint with category filter)
      params.append('category', 'lexicon')
      const entriesResponse = await api.get(`/api/v1/trinity?${params}`)
      if (entriesResponse.success) {
        setEntries(entriesResponse.data)
      }

      // Load stats
      const statsResponse = await api.get('/api/v1/trinity/stats')
      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load lexicon:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBibleData = async () => {
    setLoading(true)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (filters.chapter !== 'all') params.append('chapter', filters.chapter)
      if (filters.type !== 'all') params.append('type', filters.type)
      if (searchQuery) params.append('search', searchQuery)

      // Load Bible entries from Trinity API
      params.append('category', 'bible')
      const entriesResponse = await api.get(`/api/v1/trinity?${params}`)
      if (entriesResponse.success) {
        setEntries(entriesResponse.data)
      }

      // Load stats
      const statsResponse = await api.get('/api/v1/trinity/stats')
      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load bible:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeacherData = async () => {
    setLoading(true)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (filters.chapter !== 'all') params.append('chapter', filters.chapter)
      if (filters.type !== 'all') params.append('type', filters.type)
      if (searchQuery) params.append('search', searchQuery)

      // Load Teacher entries from Trinity API
      params.append('category', 'teacher')
      const entriesResponse = await api.get(`/api/v1/trinity?${params}`)
      if (entriesResponse.success) {
        setEntries(entriesResponse.data)
      }

      // Load stats
      const statsResponse = await api.get('/api/v1/trinity/stats')
      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load teacher:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTrinityData = async () => {
    setLoading(true)
    try {
      // Build query params (no category filter - load ALL)
      const params = new URLSearchParams()
      if (filters.chapter !== 'all') params.append('chapter', filters.chapter)
      if (filters.type !== 'all') params.append('type', filters.type)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.severity !== 'all') params.append('severity', filters.severity)
      if (searchQuery) params.append('search', searchQuery)

      // Load ALL entries (no category filter)
      const entriesResponse = await api.get(`/api/v1/trinity?${params}`)
      if (entriesResponse.success) {
        setEntries(entriesResponse.data)
      }

      // Load stats
      const statsResponse = await api.get('/api/v1/trinity/stats')
      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load trinity:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDocSelect = (doc) => {
    setSearchParams({ tab: doc.id })
    setSearchQuery('')
    setSelectedEntry(null)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleEntrySelect = async (entry) => {
    // Fetch full entry details
    try {
      const response = await api.get(`/api/v1/trinity/${entry.id}`)
      if (response.success) {
        setSelectedEntry(response.data)
      }
    } catch (error) {
      console.error('Failed to load entry details:', error)
      // Fallback to list data if detail fetch fails
      setSelectedEntry(entry)
    }
  }

  const handleAddEntry = () => {
    setEditingEntry(null)
    setShowModal(true)
  }

  const handleEditEntry = (entry) => {
    setEditingEntry(entry)
    setShowModal(true)
  }

  const handleDeleteEntry = async (entry) => {
    if (!confirm(`Delete "${entry.title}"?`)) return

    try {
      await api.delete(`/api/v1/trinity/${entry.id}`)
      loadLexiconData()
      setSelectedEntry(null)
    } catch (error) {
      console.error('Failed to delete entry:', error)
      alert('Failed to delete entry')
    }
  }

  const handleSaveEntry = async (formData, entryId) => {
    try {
      if (entryId) {
        await api.put(`/api/v1/trinity/${entryId}`, {
          trinity: formData
        })
      } else {
        await api.post('/api/v1/trinity', {
          trinity: formData
        })
      }

      loadLexiconData()
      setShowModal(false)
      setEditingEntry(null)
    } catch (error) {
      console.error('Failed to save entry:', error)
      throw error
    }
  }

  const handleExportLexicon = async () => {
    try {
      const response = await api.post('/api/v1/trinity/export_lexicon')

      if (response.success) {
        alert(`✅ ${response.message}\n\nExported ${response.total_entries} entries to:\n${response.file_path}`)
      } else {
        alert('❌ Export failed. Please check the console for details.')
      }
    } catch (error) {
      console.error('Failed to export lexicon:', error)
      alert('❌ Export failed. Please check the console for details.')
    }
  }

  // Parse chapters from markdown content
  const parseChapters = () => {
    if (!content) return []

    const lines = content.split('\n')
    const chapters = []
    let currentChapter = null

    lines.forEach((line, index) => {
      // Match "# Chapter X:" pattern
      const match = line.match(/^#\s+Chapter\s+(\d+):?\s*(.*)/)
      if (match) {
        const number = parseInt(match[1])
        const title = match[2] || `Chapter ${number}`

        if (currentChapter) {
          chapters.push(currentChapter)
        }

        currentChapter = {
          number,
          title: `Chapter ${number}`,
          subtitle: title,
          line: index
        }
      }
    })

    if (currentChapter) {
      chapters.push(currentChapter)
    }

    return chapters
  }

  const handleChapterSelect = (chapter) => {
    // Jump to chapter heading in the rendered markdown
    const headingId = `chapter-${chapter.number}`
    const element = document.getElementById(headingId)
    if (element) {
      element.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }

  // Render based on selected document
  const renderLeftPanel = () => (
    <>
      <DocumentList
        documents={docs}
        selectedDoc={selectedDoc}
        onSelectDoc={handleDocSelect}
      />

      {selectedDoc?.id === 'lexicon' && (
        <FilterSection
          filters={filters}
          onFilterChange={handleFilterChange}
          stats={stats}
        />
      )}
    </>
  )

  const renderMiddlePanel = () => {
    if (selectedDoc?.id === 'lexicon') {
      return (
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Knowledge Base
            </h2>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setLexiconViewMode('3-panel')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    lexiconViewMode === '3-panel'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="3-Panel View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  3-Panel
                </button>
                <button
                  onClick={() => setLexiconViewMode('table')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    lexiconViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
              </div>

              <button
                onClick={handleExportLexicon}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                title="Export Lexicon to TEEEM_LEXICON.md"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleAddEntry}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <EntryList
              entries={entries}
              selectedEntry={selectedEntry}
              onSelectEntry={handleEntrySelect}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              groupByChapter={true}
            />
          </div>
        </div>
      )
    }

    // For Bible, Manual, etc. - show chapter list
    const chapters = parseChapters()
    return (
      <ChapterList
        chapters={chapters}
        selectedChapter={null}
        onSelectChapter={handleChapterSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        fullContent={content}
      />
    )
  }

  const renderRightPanel = () => {
    if (loading) {
      return <LoadingSkeleton type="content" />
    }

    // Build breadcrumb
    const breadcrumbItems = []
    if (selectedDoc) {
      breadcrumbItems.push({ icon: selectedDoc.icon, label: selectedDoc.name })

      if (selectedDoc.id === 'lexicon' && selectedEntry) {
        breadcrumbItems.push({
          label: `Chapter ${selectedEntry.chapter_number}`,
          icon: '📂'
        })
        breadcrumbItems.push({ label: selectedEntry.title })
      }
    }

    if (selectedDoc?.id === 'lexicon') {
      return (
        <div className="h-full flex flex-col">
          {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
          <div className="flex-1 overflow-hidden">
            <EntryDetails
              entry={selectedEntry}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
            />
          </div>
        </div>
      )
    }

    // For Bible, Manual, etc. - show markdown with view mode toggle
    return (
      <div className="h-full flex flex-col">
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        {/* View Mode Toggle for Teacher and User Manual */}
        {(selectedDoc?.id === 'teacher' || selectedDoc?.id === 'user-manual') && content && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end">
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => selectedDoc.id === 'teacher' ? setTeacherViewMode('markdown') : setManualViewMode('markdown')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  (selectedDoc.id === 'teacher' ? teacherViewMode : manualViewMode) === 'markdown'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Markdown View"
              >
                <Squares2X2Icon className="w-4 h-4" />
                Markdown
              </button>
              <button
                onClick={() => selectedDoc.id === 'teacher' ? setTeacherViewMode('table') : setManualViewMode('table')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                  (selectedDoc.id === 'teacher' ? teacherViewMode : manualViewMode) === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Table View"
              >
                <TableCellsIcon className="w-4 h-4" />
                Table
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {content ? (
            <div className="max-w-none">
              <MarkdownRenderer content={content} />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-4">📖</div>
              <div className="text-lg font-medium">Select a document to view</div>
              <div className="text-sm mt-2">Choose a document from the left panel</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // If Bible is selected and table view mode is active, render full-width table
  if (selectedDoc?.id === 'bible' && bibleViewMode === 'table') {
    return (
      <div className="fixed inset-0 top-16 flex flex-col overflow-hidden bg-white dark:bg-gray-900" style={{ left: '18rem', bottom: '40px' }}>
        {/* Document Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="flex space-x-1 px-4">
            {docs.map((doc) => {
              const isActive = selectedDoc?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{doc.icon}</span>
                  {doc.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              📖 TEEEM Bible - Table View
            </h1>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setBibleViewMode('markdown')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    bibleViewMode === 'markdown'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Markdown View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  Markdown
                </button>
                <button
                  onClick={() => setBibleViewMode('table')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    bibleViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 min-h-0">
            <TeeemTableView
              category="bible"
              entries={entries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              stats={stats}
            />
          </div>
        </div>
      </div>
    )
  }

  // If Lexicon is selected and table view mode is active, render full-width table
  if (selectedDoc?.id === 'lexicon' && lexiconViewMode === 'table') {
    return (
      <div className="fixed inset-0 top-16 flex flex-col overflow-hidden bg-white dark:bg-gray-900" style={{ left: '18rem', bottom: '40px' }}>
        {/* Document Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="flex space-x-1 px-4">
            {docs.map((doc) => {
              const isActive = selectedDoc?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{doc.icon}</span>
                  {doc.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              📕 TEEEM Lexicon - Table View
            </h1>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setLexiconViewMode('3-panel')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    lexiconViewMode === '3-panel'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="3-Panel View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  3-Panel
                </button>
                <button
                  onClick={() => setLexiconViewMode('table')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    lexiconViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
              </div>

              <button
                onClick={handleExportLexicon}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                title="Export Lexicon to TEEEM_LEXICON.md"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleAddEntry}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 min-h-0">
            <TeeemTableView
              category="lexicon"
              entries={entries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              stats={stats}
            />
          </div>
        </div>

        {/* Knowledge Entry Modal */}
        <KnowledgeEntryModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setEditingEntry(null)
          }}
          onSave={handleSaveEntry}
          chapterNumber={editingEntry?.chapter_number || 0}
          chapterName={editingEntry?.chapter_name || 'Overview'}
          entry={editingEntry}
        />
      </div>
    )
  }

  // If Teacher is selected and table view mode is active
  if (selectedDoc?.id === 'teacher' && teacherViewMode === 'table') {
    return (
      <>
        {/* Document Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex space-x-1 px-4">
            {docs.map((doc) => {
              const isActive = selectedDoc?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{doc.icon}</span>
                  {doc.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              🔧 TEEEM Teacher - Table View
            </h1>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setTeacherViewMode('markdown')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    teacherViewMode === 'markdown'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Markdown View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  Markdown
                </button>
                <button
                  onClick={() => setTeacherViewMode('table')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    teacherViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 overflow-hidden">
            <TeeemTableView
              category="teacher"
              entries={entries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              stats={stats}
            />
          </div>
        </div>
      </>
    )
  }

  // If User Manual is selected and table view mode is active
  if (selectedDoc?.id === 'user-manual' && manualViewMode === 'table') {
    return (
      <>
        {/* Document Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex space-x-1 px-4">
            {docs.map((doc) => {
              const isActive = selectedDoc?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{doc.icon}</span>
                  {doc.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              📘 User Manual - Table View
            </h1>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setManualViewMode('markdown')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    manualViewMode === 'markdown'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Markdown View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  Markdown
                </button>
                <button
                  onClick={() => setManualViewMode('table')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    manualViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-4 h-4" />
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 overflow-hidden">
            <UserManualTableView content={content} />
          </div>
        </div>
      </>
    )
  }

  // If Trinity is selected, render full-width table
  if (selectedDoc?.id === 'trinity' && trinityViewMode === 'table') {
    return (
      <div className="fixed inset-0 top-16 flex flex-col overflow-hidden bg-white dark:bg-gray-900" style={{ left: '18rem', bottom: '40px' }}>
        {/* Document Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="flex space-x-1 px-4">
            {docs.map((doc) => {
              const isActive = selectedDoc?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{doc.icon}</span>
                  {doc.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              ✨ Trinity - Complete Database Table (Bible + Teacher + Lexicon)
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddEntry}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 min-h-0">
            <TeeemTableView
              entries={entries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              stats={stats}
            />
          </div>
        </div>

        {/* Knowledge Entry Modal */}
        <KnowledgeEntryModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setEditingEntry(null)
          }}
          onSave={handleSaveEntry}
          chapterNumber={editingEntry?.chapter_number || 0}
          chapterName={editingEntry?.chapter_name || 'Overview'}
          entry={editingEntry}
        />
      </div>
    )
  }

  // Default 3-panel layout
  return (
    <>
      {/* Document Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex space-x-1 px-4">
          {docs.map((doc) => {
            const isActive = selectedDoc?.id === doc.id
            return (
              <button
                key={doc.id}
                onClick={() => handleDocSelect(doc)}
                className={`
                  px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <span className="mr-2">{doc.icon}</span>
                {doc.name}
              </button>
            )
          })}
        </div>
      </div>

      <ThreePanelLayout
        leftPanel={renderLeftPanel()}
        middlePanel={renderMiddlePanel()}
        rightPanel={renderRightPanel()}
        leftPanelWidth="240px"
        middlePanelWidth="320px"
      />

      {/* Knowledge Entry Modal */}
      <KnowledgeEntryModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingEntry(null)
        }}
        onSave={handleSaveEntry}
        chapterNumber={editingEntry?.chapter_number || 0}
        chapterName={editingEntry?.chapter_name || 'Overview'}
        entry={editingEntry}
      />
    </>
  )
}
