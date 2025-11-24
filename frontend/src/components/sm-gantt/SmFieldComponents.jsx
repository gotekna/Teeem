import { useState, useRef, useEffect, useCallback } from 'react'
import {
  CameraIcon,
  MapPinIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'

// ===========================================
// PHOTO CAPTURE COMPONENT
// ===========================================
export const PhotoCapture = ({
  onCapture,
  onUpload,
  maxPhotos = 10,
  photoType = 'general',
  taskId,
  className = ''
}) => {
  const [photos, setPhotos] = useState([])
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      videoRef.current.srcObject = stream
      streamRef.current = stream
      setCapturing(true)
    } catch (err) {
      console.error('Camera access denied:', err)
      alert('Unable to access camera. Please check permissions.')
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCapturing(false)
  }

  // Take photo
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg', 0.8)

    const newPhoto = {
      id: Date.now(),
      imageData,
      timestamp: new Date().toISOString(),
      photoType,
      taskId,
      uploaded: false
    }

    setPhotos(prev => [...prev, newPhoto])
    onCapture?.(newPhoto)
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const newPhoto = {
          id: Date.now() + Math.random(),
          imageData: event.target.result,
          timestamp: new Date().toISOString(),
          photoType,
          taskId,
          uploaded: false,
          fileName: file.name
        }
        setPhotos(prev => [...prev, newPhoto])
        onCapture?.(newPhoto)
      }
      reader.readAsDataURL(file)
    })
  }

  // Remove photo
  const removePhoto = (photoId) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  // Upload all photos
  const uploadPhotos = async () => {
    if (photos.length === 0) return

    setUploading(true)
    const results = []

    for (const photo of photos.filter(p => !p.uploaded)) {
      try {
        const result = await onUpload?.(photo)
        if (result?.success) {
          setPhotos(prev => prev.map(p =>
            p.id === photo.id ? { ...p, uploaded: true, serverUrl: result.photo_url } : p
          ))
          results.push({ success: true, id: photo.id })
        }
      } catch (err) {
        results.push({ success: false, id: photo.id, error: err.message })
      }
    }

    setUploading(false)
    return results
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  const pendingCount = photos.filter(p => !p.uploaded).length

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Camera view */}
      {capturing && (
        <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={takePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:bg-gray-100"
            >
              <CameraIcon className="w-8 h-8 text-gray-700" />
            </button>
            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="p-4">
        {!capturing && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={startCamera}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <CameraIcon className="w-5 h-5" />
              Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <PhotoIcon className="w-5 h-5" />
              Gallery
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Photos list */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={photo.imageData}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
                {photo.uploaded && (
                  <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                {!photo.uploaded && (
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <TrashIcon className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {pendingCount > 0 && (
          <button
            onClick={uploadPhotos}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-5 h-5" />
                Upload {pendingCount} Photo{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ===========================================
// GPS CHECK-IN COMPONENT
// ===========================================
export const GpsCheckin = ({
  constructionId,
  resourceId,
  constructionName,
  siteCoords,
  onCheckin,
  className = ''
}) => {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastCheckin, setLastCheckin] = useState(null)

  // Get current location
  const getCurrentLocation = useCallback(() => {
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [])

  // Calculate distance from site
  const getDistanceFromSite = () => {
    if (!location || !siteCoords) return null

    const R = 6371000 // Earth radius in meters
    const dLat = (siteCoords.latitude - location.latitude) * Math.PI / 180
    const dLon = (siteCoords.longitude - location.longitude) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(location.latitude * Math.PI / 180) * Math.cos(siteCoords.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  // Handle check-in
  const handleCheckin = async (type) => {
    if (!location) {
      getCurrentLocation()
      return
    }

    setLoading(true)
    try {
      const result = await onCheckin?.({
        construction_id: constructionId,
        resource_id: resourceId,
        latitude: location.latitude,
        longitude: location.longitude,
        checkin_type: type
      })

      if (result?.success) {
        setLastCheckin({
          type,
          time: new Date(),
          onSite: result.on_site,
          distance: result.distance_from_site
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Get location on mount
  useEffect(() => {
    getCurrentLocation()
  }, [getCurrentLocation])

  const distance = getDistanceFromSite()
  const isOnSite = distance !== null && distance <= 100

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MapPinIcon className="w-5 h-5 text-gray-400" />
        <h3 className="font-medium">Site Check-in</h3>
      </div>

      {/* Location status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50">
        <div className="text-sm text-gray-600 mb-1">{constructionName || 'Construction Site'}</div>
        {loading ? (
          <div className="text-sm text-gray-500">Getting location...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : location ? (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </div>
            {distance !== null && (
              <div className={`text-sm font-medium ${isOnSite ? 'text-green-600' : 'text-amber-600'}`}>
                {distance}m from site {isOnSite ? '✓ On site' : '⚠ Off site'}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={getCurrentLocation}
            className="text-sm text-blue-600 hover:underline"
          >
            Get Location
          </button>
        )}
      </div>

      {/* Check-in buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleCheckin('arrival')}
          disabled={loading || !location}
          className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircleIcon className="w-5 h-5" />
          Arrive
        </button>
        <button
          onClick={() => handleCheckin('departure')}
          disabled={loading || !location}
          className="flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <XCircleIcon className="w-5 h-5" />
          Leave
        </button>
      </div>

      {/* Last check-in */}
      {lastCheckin && (
        <div className="mt-3 text-sm text-center text-gray-500">
          Last {lastCheckin.type}: {lastCheckin.time.toLocaleTimeString()}
          {lastCheckin.onSite && ' (on site)'}
        </div>
      )}
    </div>
  )
}

// ===========================================
// VOICE NOTES COMPONENT
// ===========================================
export const VoiceNotes = ({
  taskId,
  existingNotes = [],
  onRecord,
  onPlay,
  className = ''
}) => {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setRecording(true)
      setDuration(0)

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone access denied:', err)
      alert('Unable to access microphone. Please check permissions.')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      clearInterval(timerRef.current)
    }
  }

  // Save recording
  const saveRecording = async () => {
    if (!audioBlob) return

    // Convert to base64
    const reader = new FileReader()
    reader.readAsDataURL(audioBlob)
    reader.onloadend = async () => {
      const base64Audio = reader.result

      try {
        await onRecord?.({
          task_id: taskId,
          audio_data: base64Audio,
          duration_seconds: duration
        })
        setAudioBlob(null)
        setDuration(0)
      } catch (err) {
        console.error('Failed to save recording:', err)
        alert('Failed to save recording')
      }
    }
  }

  // Discard recording
  const discardRecording = () => {
    setAudioBlob(null)
    setDuration(0)
  }

  // Play audio
  const playAudio = (url, noteId) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }

    if (playing === noteId) {
      setPlaying(null)
      return
    }

    const audio = new Audio(url)
    audioRef.current = audio
    audio.play()
    setPlaying(noteId)

    audio.onended = () => setPlaying(null)
  }

  // Format duration
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MicrophoneIcon className="w-5 h-5 text-gray-400" />
        <h3 className="font-medium">Voice Notes</h3>
      </div>

      {/* Recording UI */}
      {!audioBlob ? (
        <div className="mb-4">
          {recording ? (
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-700 font-medium">{formatDuration(duration)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700"
              >
                <StopIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <MicrophoneIcon className="w-6 h-6" />
              Start Recording
            </button>
          )}
        </div>
      ) : (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Recording: {formatDuration(duration)}</span>
            <button
              onClick={() => {
                const url = URL.createObjectURL(audioBlob)
                playAudio(url, 'preview')
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            >
              <PlayIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveRecording}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={discardRecording}
              className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Existing notes */}
      {existingNotes.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-500 mb-2">Previous Notes</div>
          {existingNotes.map(note => (
            <div
              key={note.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => playAudio(note.audio_url, note.id)}
                  className={`p-2 rounded-full ${
                    playing === note.id ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {playing === note.id ? (
                    <StopIcon className="w-4 h-4" />
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                </button>
                <div>
                  <div className="text-sm font-medium">{note.formatted_duration || formatDuration(note.duration_seconds)}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(note.recorded_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {note.transcription && (
                <div className="text-xs text-gray-500 max-w-[200px] truncate" title={note.transcription}>
                  "{note.transcription}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default { PhotoCapture, GpsCheckin, VoiceNotes }
