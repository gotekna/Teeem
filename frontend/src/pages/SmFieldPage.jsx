import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CameraIcon,
  MapPinIcon,
  MicrophoneIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import { PhotoCapture, GpsCheckin, VoiceNotes } from '../components/sm-gantt/SmFieldComponents'
import { api } from '../api'

// Offline storage helper
const offlineStorage = {
  save: (key, data) => {
    try {
      const existing = JSON.parse(localStorage.getItem('sm_offline_data') || '{}')
      existing[key] = [...(existing[key] || []), data]
      localStorage.setItem('sm_offline_data', JSON.stringify(existing))
    } catch (e) {
      console.error('Failed to save offline data:', e)
    }
  },
  get: (key) => {
    try {
      const data = JSON.parse(localStorage.getItem('sm_offline_data') || '{}')
      return data[key] || []
    } catch (e) {
      return []
    }
  },
  clear: (key) => {
    try {
      const existing = JSON.parse(localStorage.getItem('sm_offline_data') || '{}')
      delete existing[key]
      localStorage.setItem('sm_offline_data', JSON.stringify(existing))
    } catch (e) {
      console.error('Failed to clear offline data:', e)
    }
  },
  getPendingCount: () => {
    try {
      const data = JSON.parse(localStorage.getItem('sm_offline_data') || '{}')
      return Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
    } catch (e) {
      return 0
    }
  }
}

// Task card component
const TaskCard = ({ task, selected, onClick }) => (
  <div
    onClick={() => onClick(task)}
    className={`p-4 rounded-lg border cursor-pointer transition-all ${
      selected
        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
        : 'border-gray-200 hover:border-gray-300 bg-white'
    }`}
  >
    <div className="flex items-start justify-between">
      <div>
        <div className="font-medium text-gray-900">{task.name}</div>
        <div className="text-sm text-gray-500 mt-1">
          {task.trade && <span className="mr-2">{task.trade}</span>}
          <span>{new Date(task.start_date).toLocaleDateString()}</span>
        </div>
      </div>
      <div className={`px-2 py-1 text-xs rounded ${
        task.status === 'completed' ? 'bg-green-100 text-green-700' :
        task.status === 'started' ? 'bg-blue-100 text-blue-700' :
        'bg-gray-100 text-gray-700'
      }`}>
        {task.status}
      </div>
    </div>
    {task.photos_count > 0 && (
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <CameraIcon className="w-3 h-3" />
        {task.photos_count} photos
      </div>
    )}
  </div>
)

// Tab button component
const TabButton = ({ active, icon: Icon, label, badge, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-1 py-3 relative ${
      active ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
    }`}
  >
    <Icon className="w-6 h-6" />
    <span className="text-xs">{label}</span>
    {badge > 0 && (
      <span className="absolute top-1 right-1/4 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
)

export default function SmFieldPage() {
  const { constructionId } = useParams()
  const [searchParams] = useSearchParams()
  const resourceId = searchParams.get('resource')

  // State
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [activeTab, setActiveTab] = useState('tasks')
  const [construction, setConstruction] = useState(null)
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskPhotos, setTaskPhotos] = useState([])
  const [taskVoiceNotes, setTaskVoiceNotes] = useState([])
  const [pendingSync, setPendingSync] = useState(0)

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update pending count
  useEffect(() => {
    setPendingSync(offlineStorage.getPendingCount())
  }, [])

  // Fetch construction and tasks
  const fetchData = useCallback(async () => {
    if (!constructionId) return

    setLoading(true)
    try {
      // Fetch construction details
      const constructionRes = await api.get(`/api/v1/constructions/${constructionId}`)
      setConstruction(constructionRes.data.construction || constructionRes.data)

      // Fetch tasks
      const tasksRes = await api.get(`/api/v1/constructions/${constructionId}/sm_tasks`)
      const todaysTasks = (tasksRes.data.tasks || []).filter(t =>
        t.status !== 'completed' || new Date(t.completed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      )
      setTasks(todaysTasks)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      // Try to load from cache
    } finally {
      setLoading(false)
    }
  }, [constructionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch task photos and voice notes
  const fetchTaskMedia = useCallback(async (taskId) => {
    if (!taskId) return

    try {
      const [photosRes, notesRes] = await Promise.all([
        api.get(`/api/v1/sm_tasks/${taskId}/photos`),
        api.get(`/api/v1/sm_tasks/${taskId}/voice_notes`)
      ])
      setTaskPhotos(photosRes.data.photos || [])
      setTaskVoiceNotes(notesRes.data.voice_notes || [])
    } catch (err) {
      console.error('Failed to fetch task media:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedTask) {
      fetchTaskMedia(selectedTask.id)
    }
  }, [selectedTask, fetchTaskMedia])

  // Handle photo upload
  const handlePhotoUpload = async (photo) => {
    if (!isOnline) {
      offlineStorage.save('photos', { ...photo, constructionId })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }

    try {
      const res = await api.post('/api/v1/sm_field/upload_photo', {
        task_id: selectedTask.id,
        image_data: photo.imageData,
        photo_type: photo.photoType
      })
      return res.data
    } catch (err) {
      // Save offline on failure
      offlineStorage.save('photos', { ...photo, constructionId })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }
  }

  // Handle GPS check-in
  const handleCheckin = async (data) => {
    if (!isOnline) {
      offlineStorage.save('checkins', { ...data, timestamp: new Date().toISOString() })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }

    try {
      const res = await api.post('/api/v1/sm_field/checkin', data)
      return res.data
    } catch (err) {
      offlineStorage.save('checkins', { ...data, timestamp: new Date().toISOString() })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }
  }

  // Handle voice note recording
  const handleVoiceRecord = async (data) => {
    if (!isOnline) {
      offlineStorage.save('voice_notes', { ...data, constructionId })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }

    try {
      const res = await api.post('/api/v1/sm_field/record_voice_note', data)
      fetchTaskMedia(selectedTask.id)
      return res.data
    } catch (err) {
      offlineStorage.save('voice_notes', { ...data, constructionId })
      setPendingSync(offlineStorage.getPendingCount())
      return { success: true, offline: true }
    }
  }

  // Sync offline data
  const syncOfflineData = async () => {
    if (!isOnline) return

    const photos = offlineStorage.get('photos')
    const checkins = offlineStorage.get('checkins')
    const voiceNotes = offlineStorage.get('voice_notes')

    if (photos.length === 0 && checkins.length === 0 && voiceNotes.length === 0) return

    try {
      const res = await api.post('/api/v1/sm_field/sync', {
        photos,
        checkins,
        voice_notes: voiceNotes
      })

      if (res.data.success) {
        offlineStorage.clear('photos')
        offlineStorage.clear('checkins')
        offlineStorage.clear('voice_notes')
        setPendingSync(0)
        alert(`Synced: ${res.data.results.photos.synced} photos, ${res.data.results.checkins.synced} check-ins, ${res.data.results.voice_notes.synced} voice notes`)
      }
    } catch (err) {
      console.error('Sync failed:', err)
      alert('Sync failed. Will retry when connection is stable.')
    }
  }

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSync > 0) {
      syncOfflineData()
    }
  }, [isOnline])

  // Listen for service worker sync requests
  useEffect(() => {
    const handleSWSync = () => {
      if (isOnline && pendingSync > 0) {
        syncOfflineData()
      }
    }

    window.addEventListener('sw-sync-request', handleSWSync)
    return () => window.removeEventListener('sw-sync-request', handleSWSync)
  }, [isOnline, pendingSync])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedTask && (
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 -ml-1"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="font-semibold text-gray-900">
                {selectedTask ? selectedTask.name : (construction?.name || 'Field Work')}
              </h1>
              <div className="text-xs text-gray-500">
                {selectedTask ? selectedTask.trade : 'Select a task'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isOnline ? <WifiIcon className="w-4 h-4" /> : <ExclamationTriangleIcon className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>

            {/* Pending sync */}
            {pendingSync > 0 && (
              <button
                onClick={syncOfflineData}
                disabled={!isOnline}
                className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {pendingSync} pending
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedTask ? (
          /* Task list */
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-2">
              Today's Tasks ({tasks.length})
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No tasks scheduled for today
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={false}
                  onClick={setSelectedTask}
                />
              ))
            )}
          </div>
        ) : (
          /* Task detail with media capture */
          <div className="space-y-4">
            {activeTab === 'tasks' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium mb-2">{selectedTask.name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Trade: {selectedTask.trade || '-'}</div>
                  <div>Status: {selectedTask.status}</div>
                  <div>Start: {new Date(selectedTask.start_date).toLocaleDateString()}</div>
                  {selectedTask.supplier && <div>Supplier: {selectedTask.supplier.name}</div>}
                </div>

                {/* Quick actions */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('photos')}
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg"
                  >
                    <CameraIcon className="w-5 h-5" />
                    Add Photo
                  </button>
                  <button
                    onClick={() => setActiveTab('voice')}
                    className="flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg"
                  >
                    <MicrophoneIcon className="w-5 h-5" />
                    Voice Note
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <PhotoCapture
                taskId={selectedTask.id}
                photoType="progress"
                onCapture={(photo) => console.log('Captured:', photo)}
                onUpload={handlePhotoUpload}
              />
            )}

            {activeTab === 'checkin' && (
              <GpsCheckin
                constructionId={constructionId}
                resourceId={resourceId}
                constructionName={construction?.name}
                siteCoords={construction?.site_latitude ? {
                  latitude: construction.site_latitude,
                  longitude: construction.site_longitude
                } : null}
                onCheckin={handleCheckin}
              />
            )}

            {activeTab === 'voice' && (
              <VoiceNotes
                taskId={selectedTask.id}
                existingNotes={taskVoiceNotes}
                onRecord={handleVoiceRecord}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom tabs (when task selected) */}
      {selectedTask && (
        <div className="bg-white border-t border-gray-200 flex sticky bottom-0">
          <TabButton
            active={activeTab === 'tasks'}
            icon={ClipboardDocumentListIcon}
            label="Details"
            onClick={() => setActiveTab('tasks')}
          />
          <TabButton
            active={activeTab === 'photos'}
            icon={CameraIcon}
            label="Photos"
            badge={taskPhotos.length}
            onClick={() => setActiveTab('photos')}
          />
          <TabButton
            active={activeTab === 'checkin'}
            icon={MapPinIcon}
            label="Check-in"
            onClick={() => setActiveTab('checkin')}
          />
          <TabButton
            active={activeTab === 'voice'}
            icon={MicrophoneIcon}
            label="Voice"
            badge={taskVoiceNotes.length}
            onClick={() => setActiveTab('voice')}
          />
        </div>
      )}
    </div>
  )
}
