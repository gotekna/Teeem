import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import { api } from '../../api'
import SharePointPhotoGallery from './SharePointPhotoGallery'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Categories that should show SharePoint photos instead of tasks
const PHOTO_CATEGORIES = ['photo', 'client photo', 'photos', 'client photos']

function isPhotoCategory(categoryName) {
  return PHOTO_CATEGORIES.includes(categoryName?.toLowerCase())
}

// Map tab names to actual SharePoint folder names
// Tab names come from documentation_categories (Photo, Client Photo)
// SharePoint folders are: 07 Photos, 07 Supervisor Photos
function getFolderNamesForCategory(categoryName) {
  const name = categoryName?.toLowerCase()
  if (name === 'photo' || name === 'photos') {
    // Photo tab shows the main Photos folder and Supervisor Photos
    return ['07 Photos', '07 Supervisor Photos']
  }
  if (name === 'client photo' || name === 'client photos') {
    // Client Photo tab - use 07 Photos for now (client photos would be stored there)
    return ['07 Photos']
  }
  return [categoryName]
}

export default function DocumentCategoryTabs({ jobId, onCategoryChange, children }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [documentCategories, setDocumentCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocumentationTabs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const fetchDocumentationTabs = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${jobId}/documentation_tabs`)
      setDocumentCategories(response)
    } catch (error) {
      console.error('Failed to fetch documentation tabs:', error)
      // Fallback to empty array on error
      setDocumentCategories([])
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (index) => {
    setSelectedIndex(index)
    if (onCategoryChange) {
      onCategoryChange(documentCategories[index])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-x-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading documentation tabs...</span>
        </div>
      </div>
    )
  }

  if (documentCategories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No documentation categories found. Please create categories in Settings.
        </p>
      </div>
    )
  }

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={handleChange}>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <Tab.List className="flex space-x-8 px-4 overflow-x-auto">
          {documentCategories.map((category) => (
            <Tab
              key={category.id}
              className={({ selected }) =>
                classNames(
                  'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none transition-colors',
                  selected
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )
              }
            >
              <div className="flex items-center gap-2">
                {category.name} ({category.document_count || 0})
              </div>
            </Tab>
          ))}
        </Tab.List>
      </div>
      <Tab.Panels className="mt-6">
        {documentCategories.map((category) => (
          <Tab.Panel key={category.id} className="focus:outline-none">
            {isPhotoCategory(category.name) ? (
              <SharePointPhotoGallery
                jobId={jobId}
                folderNames={getFolderNamesForCategory(category.name)}
              />
            ) : (
              children(category)
            )}
          </Tab.Panel>
        ))}
      </Tab.Panels>
    </Tab.Group>
  )
}
