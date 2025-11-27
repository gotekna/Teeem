import { useState, useEffect } from 'react'
import {
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Image file extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif']

function isImageFile(filename) {
  if (!filename) return false
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(ext)
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export default function SharePointPhotoGallery({ jobId, folderNames = ['Photo', 'Client Photo'] }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [files, setFiles] = useState([])
  const [foundFolders, setFoundFolders] = useState([])
  const [jobFolderUrl, setJobFolderUrl] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  useEffect(() => {
    fetchFolderContents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, folderNames.join(',')])

  const fetchFolderContents = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await api.get(
        `/api/v1/organization_onedrive/folder_contents?job_id=${jobId}&folder_names=${folderNames.join(',')}`
      )

      setFiles(response.files || [])
      setFoundFolders(response.found_folders || [])
      setJobFolderUrl(response.job_folder_web_url)
    } catch (err) {
      console.error('Failed to fetch folder contents:', err)
      if (err.response?.status === 404) {
        setError('Job folder not found in SharePoint. Please create the folder structure first.')
      } else if (err.response?.status === 401) {
        setError('OneDrive not connected. Please connect in Settings.')
      } else {
        setError(err.message || 'Failed to load photos from SharePoint')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (file) => {
    try {
      window.open(
        `${api.defaults?.baseURL || ''}/api/v1/organization_onedrive/download?file_id=${file.id}`,
        '_blank'
      )
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }

  const handleOpenInSharePoint = (webUrl) => {
    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }

  // Separate images from other files
  const imageFiles = files.filter(f => isImageFile(f.name))
  const otherFiles = files.filter(f => !isImageFile(f.name))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-x-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading photos from SharePoint...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4">
        <div className="flex">
          <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Unable to load photos
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {imageFiles.length} {imageFiles.length === 1 ? 'photo' : 'photos'}
            {otherFiles.length > 0 && `, ${otherFiles.length} other files`}
          </div>
          {foundFolders.length > 0 && (
            <div className="flex items-center gap-2">
              {foundFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleOpenInSharePoint(folder.web_url)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <FolderIcon className="h-3 w-3" />
                  {folder.name}
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
              title="Grid view"
            >
              <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
              title="List view"
            >
              <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <button
            onClick={fetchFolderContents}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No photos yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload photos to the {folderNames.join(' or ')} folder in SharePoint
          </p>
          {jobFolderUrl && (
            <button
              onClick={() => handleOpenInSharePoint(jobFolderUrl)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              Open job folder in SharePoint
            </button>
          )}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && imageFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {imageFiles.map((file) => (
            <div
              key={file.id}
              className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
              onClick={() => setSelectedImage(file)}
            >
              {/* Thumbnail - using OneDrive thumbnail URL */}
              {file.thumbnails?.[0]?.large?.url ? (
                <img
                  src={file.thumbnails[0].large.url}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className="h-12 w-12 text-gray-400" />
                </div>
              )}

              {/* Overlay with file info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs text-white truncate">{file.name}</p>
                  {file.source_folder && (
                    <p className="text-xs text-gray-300">{file.source_folder}</p>
                  )}
                </div>
              </div>

              {/* Source folder badge */}
              {file.source_folder && (
                <div className="absolute top-2 left-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    file.source_folder.toLowerCase().includes('client')
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  }`}>
                    {file.source_folder}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && files.length > 0 && (
        <div className="bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Folder</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Modified</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {file.thumbnails?.[0]?.small?.url ? (
                        <img
                          src={file.thumbnails[0].small.url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <PhotoIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <span className="text-sm text-gray-900 dark:text-white truncate max-w-xs">
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      file.source_folder?.toLowerCase().includes('client')
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    }`}>
                      {file.source_folder || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {file.lastModifiedDateTime
                      ? new Date(file.lastModifiedDateTime).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Download"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenInSharePoint(file.webUrl)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Open in SharePoint"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Image lightbox/modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={selectedImage.thumbnails?.[0]?.large?.url || selectedImage['@microsoft.graph.downloadUrl']}
              alt={selectedImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
              <p className="text-white font-medium">{selectedImage.name}</p>
              <div className="flex items-center gap-4 mt-2">
                {selectedImage.source_folder && (
                  <span className="text-gray-300 text-sm">{selectedImage.source_folder}</span>
                )}
                <span className="text-gray-400 text-sm">{formatFileSize(selectedImage.size)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(selectedImage)
                  }}
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenInSharePoint(selectedImage.webUrl)
                  }}
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  Open in SharePoint
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/30 rounded-full"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}