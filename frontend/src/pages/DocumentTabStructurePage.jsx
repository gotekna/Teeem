import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderIcon,
  TagIcon,
  StarIcon,
  ChevronLeftIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import api from '../api'

export default function DocumentTabStructurePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [documentTypes, setDocumentTypes] = useState([])
  const [groupBy, setGroupBy] = useState('primary_tab') // 'primary_tab', 'folder', 'name'
  const [availableTabs, setAvailableTabs] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load document types
      const response = await api.get('/api/v1/document_types')
      const types = response.data || []
      setDocumentTypes(types.filter(dt => dt.active))

      // Get unique tabs from available_tabs
      if (response.available_tabs) {
        setAvailableTabs(response.available_tabs)
      }
    } catch (error) {
      console.error('Failed to load document types:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group document types by selected criteria
  const groupedData = () => {
    if (groupBy === 'primary_tab') {
      const grouped = {}
      documentTypes.forEach(dt => {
        const tab = dt.primary_tab || 'Uncategorized'
        if (!grouped[tab]) grouped[tab] = []
        grouped[tab].push(dt)
      })
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
    } else if (groupBy === 'folder') {
      const grouped = {}
      documentTypes.forEach(dt => {
        const folder = dt.folder || 'Uncategorized'
        if (!grouped[folder]) grouped[folder] = []
        grouped[folder].push(dt)
      })
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
    } else {
      return [['All Documents', documentTypes.sort((a, b) => a.name.localeCompare(b.name))]]
    }
  }

  const getTabBadgeColor = (tab) => {
    const colors = {
      'ATO': 'bg-blue-100 text-blue-700',
      'BANK': 'bg-green-100 text-green-700',
      'LOANS': 'bg-purple-100 text-purple-700',
      'ASSETS': 'bg-orange-100 text-orange-700',
      'DIVIDENDS': 'bg-pink-100 text-pink-700',
      'ASIC': 'bg-indigo-100 text-indigo-700',
      'MINUTES': 'bg-yellow-100 text-yellow-700',
      'TRUST': 'bg-teal-100 text-teal-700',
      'GENERAL': 'bg-gray-100 text-gray-700',
      'STRUCTURE': 'bg-red-100 text-red-700',
      'FINANCIALS': 'bg-emerald-100 text-emerald-700'
    }
    return colors[tab] || 'bg-gray-100 text-gray-700'
  }

  const getNamingFormat = (docTypeName) => {
    // Extract abbreviation (e.g., "CTR" from "CTR - Company Tax Return")
    const abbrev = docTypeName.split(' - ')[0] || docTypeName.split(' ')[0]

    const formats = {
      'CTR': '{Company} CTR FY{Year}',
      'TTR': '{Company} TTR FY{Year}',
      'BAS': '{Company} BAS Q{Quarter} FY{Year}',
      'ASIC Annual Review': '{Company} ASIC Annual Review FY{Year}',
      'ASIC Form 485 - Solvency Declaration': '{Company} Form 485 FY{Year}',
      'ASIC Form 484 - Director Changes': '{Company} Form 484 Directors {Date}',
      'ASIC Form 484 - Registered Office': '{Company} Form 484 Reg Office {Date}',
      'Bank Statement': '{Company} Bank Statement {Account} {Month} {Year}',
      'Directors\' Minutes': '{Company} Minutes {Topic} {Date}',
      'Directors\' Resolution - Distribution': '{Company} Resolution {Topic} {Date}',
      'Dividend Payment Record': '{Company} Dividend {Date}',
      'Distribution': '{Company} Distribution {Topic} {Date}',
      'Gift Deed Return': '{Company} Gift Deed Return FY{Year}',
      'Loan Agreement': '{Company} Loan {Lender} {Date}',
      'Security Deed': '{Company} Security Deed {Date}',
      'PPSR Registration': '{Company} PPSR {Asset} {Date}',
      'Trust': '{Company} Trust {Description} {Date}',
      'General': '{Company} General {Description} {Date}',
      'Structure': '{Company} Structure {Description} {Date}',
      'Draft Financials': '{Company} Draft Financials FY{Year}',
      'Final Financials': '{Company} Final Financials FY{Year}',
      'Constitution': '{Company} Constitution {Date}',
      'Trust Deed': '{Company} Trust Deed {Date}',
      'ASIC Documents': '{Company} ASIC Documents {Date}'
    }

    // Try to match by abbreviation first, then full name
    return formats[abbrev] || formats[docTypeName] || `{Company} ${abbrev} {Date}`
  }

  const getFormatExample = (format) => {
    return format
      .replace('{Company}', 'TEKNA')
      .replace('{Year}', '2025')
      .replace('{Quarter}', '1')
      .replace('{Month}', 'Jan')
      .replace('{Date}', '15 Jan 2025')
      .replace('{Topic}', 'Distribution')
      .replace('{Lender}', 'ANZ')
      .replace('{Asset}', 'Vehicle')
      .replace('{Description}', 'Document')
      .replace('{Account}', 'ANZ-12345')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/corporate/dashboard')}
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Tab Structure</h1>
              <p className="mt-2 text-sm text-gray-700">
                Standard naming conventions and tab assignments for all document types
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Group By Controls */}
      <div className="bg-white shadow rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Group By:</label>
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('primary_tab')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              groupBy === 'primary_tab'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <TagIcon className="h-4 w-4 inline mr-1" />
            Primary Tab
          </button>
          <button
            onClick={() => setGroupBy('folder')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              groupBy === 'folder'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FolderIcon className="h-4 w-4 inline mr-1" />
            Folder
          </button>
          <button
            onClick={() => setGroupBy('name')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              groupBy === 'name'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All (A-Z)
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {availableTabs.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Tab Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {availableTabs.map(tab => (
              <div key={tab.name} className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${getTabBadgeColor(tab.name)}`}>
                  <span className="text-2xl font-bold">{tab.count}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">{tab.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Types Grouped */}
      {groupedData().map(([groupName, types]) => (
        <div key={groupName} className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{groupName}</h3>
            <p className="mt-1 text-sm text-gray-500">{types.length} document type(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Naming Format
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Primary Tab
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    All Tabs
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {types.map((docType) => {
                  const format = getNamingFormat(docType.name)
                  const example = getFormatExample(format)

                  return (
                    <tr key={docType.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">{docType.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-mono text-gray-700 mb-1">{format}</div>
                          <div className="text-xs text-gray-500 italic">e.g., {example}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {docType.primary_tab ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTabBadgeColor(docType.primary_tab)}`}>
                            <StarIcon className="h-3 w-3 mr-1" />
                            {docType.primary_tab}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {docType.tabs && docType.tabs.length > 0 ? (
                            docType.tabs.map(tab => (
                              <span
                                key={tab}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTabBadgeColor(tab)} ${
                                  tab === docType.primary_tab ? 'ring-2 ring-offset-1 ring-current' : ''
                                }`}
                              >
                                {tab}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">No tabs</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <FolderIcon className="h-4 w-4 mr-1" />
                          {docType.folder || 'None'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Legend</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-center">
            <StarIcon className="h-4 w-4 mr-2" />
            <strong>Primary Tab:</strong>&nbsp;Main category for this document type
          </li>
          <li className="flex items-center">
            <TagIcon className="h-4 w-4 mr-2" />
            <strong>All Tabs:</strong>&nbsp;This document appears in all listed tabs (ring indicates primary)
          </li>
          <li className="flex items-center">
            <FolderIcon className="h-4 w-4 mr-2" />
            <strong>Folder:</strong>&nbsp;File organization location
          </li>
        </ul>
      </div>
    </div>
  )
}
