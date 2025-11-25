import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function NewMeetingModal({ isOpen, onClose, onSubmit, constructionId }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_type_id: '',
    construction_id: constructionId || '',
    video_url: '',
    notes: ''
  })
  const [meetingTypes, setMeetingTypes] = useState([])
  const [selectedMeetingType, setSelectedMeetingType] = useState(null)
  const [constructions, setConstructions] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadMeetingTypes()
      if (!constructionId) {
        loadConstructions()
      }
    }
  }, [isOpen, constructionId])

  const loadMeetingTypes = async () => {
    try {
      const response = await api.get('/api/v1/meeting_types?active_only=true')
      if (response.success) {
        const types = response.data || []
        setMeetingTypes(types)

        // Auto-select first meeting type if available
        if (types.length > 0 && !formData.meeting_type_id) {
          handleMeetingTypeChange(types[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading meeting types:', err)
    }
  }

  const loadConstructions = async () => {
    try {
      const response = await api.get('/api/v1/jobs')
      if (response.success) {
        setConstructions(response.data || [])
      }
    } catch (err) {
      console.error('Error loading constructions:', err)
    }
  }

  const handleMeetingTypeChange = (meetingTypeId) => {
    const meetingType = meetingTypes.find(t => t.id === parseInt(meetingTypeId))
    setSelectedMeetingType(meetingType)

    setFormData(prev => ({
      ...prev,
      meeting_type_id: meetingTypeId
    }))

    // Auto-calculate end time based on default duration if start time is set
    if (formData.start_time && meetingType?.default_duration_minutes) {
      const startDate = new Date(formData.start_time)
      startDate.setMinutes(startDate.getMinutes() + meetingType.default_duration_minutes)
      setFormData(prev => ({
        ...prev,
        meeting_type_id: meetingTypeId,
        end_time: startDate.toISOString().slice(0, 16)
      }))
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const handleStartTimeChange = (value) => {
    handleChange('start_time', value)

    // Auto-populate end time based on meeting type duration
    if (value && selectedMeetingType?.default_duration_minutes) {
      const startDate = new Date(value)
      startDate.setMinutes(startDate.getMinutes() + selectedMeetingType.default_duration_minutes)
      handleChange('end_time', startDate.toISOString().slice(0, 16))
    } else if (value && !formData.end_time) {
      // Fallback to 1 hour if no meeting type selected
      const startDate = new Date(value)
      startDate.setHours(startDate.getHours() + 1)
      handleChange('end_time', startDate.toISOString().slice(0, 16))
    }
  }

  const isFieldRequired = (fieldName) => {
    if (!selectedMeetingType) return false
    return selectedMeetingType.required_fields?.includes(fieldName) || false
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.meeting_type_id) {
      newErrors.meeting_type_id = 'Meeting type is required'
    }

    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required'
    }

    if (!formData.end_time) {
      newErrors.end_time = 'End time is required'
    }

    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time)
      const end = new Date(formData.end_time)
      if (end <= start) {
        newErrors.end_time = 'End time must be after start time'
      }
    }

    // Check meeting type required fields
    if (selectedMeetingType?.required_fields) {
      selectedMeetingType.required_fields.forEach(field => {
        if (!formData[field] || formData[field] === '') {
          newErrors[field] = `${field.replace('_', ' ')} is required for this meeting type`
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        meeting_type_id: meetingTypes[0]?.id || '',
        construction_id: constructionId || '',
        video_url: '',
        notes: ''
      })
      setErrors({})
      setSelectedMeetingType(meetingTypes[0] || null)
    } catch (err) {
      console.error('Error submitting form:', err)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryColor = (category) => {
    const colors = {
      sales: 'text-blue-700 bg-blue-50 border-blue-200',
      construction: 'text-orange-700 bg-orange-50 border-orange-200',
      board: 'text-purple-700 bg-purple-50 border-purple-200',
      safety: 'text-red-700 bg-red-50 border-red-200',
      team: 'text-gray-700 bg-gray-50 border-gray-200'
    }
    return colors[category] || 'text-gray-700 bg-gray-50 border-gray-200'
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    New Meeting
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Meeting Type */}
                  <div>
                    <label htmlFor="meeting_type_id" className="block text-sm font-medium text-gray-700">
                      Meeting Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="meeting_type_id"
                      value={formData.meeting_type_id}
                      onChange={(e) => handleMeetingTypeChange(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.meeting_type_id
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select a meeting type...</option>
                      {meetingTypes.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.default_duration_minutes} min)
                        </option>
                      ))}
                    </select>
                    {errors.meeting_type_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.meeting_type_id}</p>
                    )}
                  </div>

                  {/* Meeting Type Info */}
                  {selectedMeetingType && (
                    <div className={`p-3 rounded-md border ${getCategoryColor(selectedMeetingType.category)}`}>
                      <div className="flex items-start gap-2">
                        <InformationCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{selectedMeetingType.description}</p>
                          {selectedMeetingType.required_participant_types?.length > 0 && (
                            <p className="text-xs mt-1">
                              Required participants: {selectedMeetingType.required_participant_types.join(', ')}
                            </p>
                          )}
                          {(selectedMeetingType.minimum_participants || selectedMeetingType.maximum_participants) && (
                            <p className="text-xs mt-1">
                              Participants: {selectedMeetingType.minimum_participants || 'Any'} - {selectedMeetingType.maximum_participants || 'Unlimited'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.title
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder={selectedMeetingType?.name || "Meeting title"}
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                    )}
                  </div>

                  {/* Construction (if not pre-selected) */}
                  {!constructionId && (
                    <div>
                      <label htmlFor="construction_id" className="block text-sm font-medium text-gray-700">
                        Job {isFieldRequired('construction_id') && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        id="construction_id"
                        value={formData.construction_id}
                        onChange={(e) => handleChange('construction_id', e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.construction_id
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                      >
                        <option value="">Select a job{!isFieldRequired('construction_id') && ' (optional)'}</option>
                        {constructions.map(construction => (
                          <option key={construction.id} value={construction.id}>
                            {construction.name}
                          </option>
                        ))}
                      </select>
                      {errors.construction_id && (
                        <p className="mt-1 text-sm text-red-600">{errors.construction_id}</p>
                      )}
                    </div>
                  )}

                  {/* Start Time & End Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        id="start_time"
                        value={formData.start_time}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.start_time
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                      />
                      {errors.start_time && (
                        <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                        End Time <span className="text-red-500">*</span>
                        {selectedMeetingType && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({selectedMeetingType.default_duration_minutes} min)
                          </span>
                        )}
                      </label>
                      <input
                        type="datetime-local"
                        id="end_time"
                        value={formData.end_time}
                        onChange={(e) => handleChange('end_time', e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.end_time
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                      />
                      {errors.end_time && (
                        <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                      Location {isFieldRequired('location') && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.location
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="Site address or office"
                    />
                    {errors.location && (
                      <p className="mt-1 text-sm text-red-600">{errors.location}</p>
                    )}
                  </div>

                  {/* Video URL */}
                  <div>
                    <label htmlFor="video_url" className="block text-sm font-medium text-gray-700">
                      Video Conference URL {isFieldRequired('video_url') && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="url"
                      id="video_url"
                      value={formData.video_url}
                      onChange={(e) => handleChange('video_url', e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.video_url
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="https://zoom.us/j/..."
                    />
                    {errors.video_url && (
                      <p className="mt-1 text-sm text-red-600">{errors.video_url}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Meeting agenda and objectives..."
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Additional notes..."
                    />
                  </div>

                  {/* Default Agenda Preview */}
                  {selectedMeetingType?.default_agenda_items?.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Default Agenda:</h4>
                      <ol className="text-sm text-gray-600 space-y-1">
                        {selectedMeetingType.default_agenda_items.map((item, idx) => (
                          <li key={idx}>
                            {idx + 1}. {item.title} <span className="text-gray-400">({item.duration_minutes} min)</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Creating...' : 'Create Meeting'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
