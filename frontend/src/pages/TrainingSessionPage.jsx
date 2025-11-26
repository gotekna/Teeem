import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { JitsiMeeting } from '@jitsi/react-sdk'
import { useAuth } from '../contexts/AuthContext'

export default function TrainingSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const displayName = searchParams.get('displayName') || user?.name || 'TEEEM User'
  const [meetingEnded, setMeetingEnded] = useState(false)
  const [showInviteCard, setShowInviteCard] = useState(false)
  const [copied, setCopied] = useState(false)

  const inviteLink = `${window.location.origin}/training/${sessionId}`

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReadyToClose = () => {
    setMeetingEnded(true)
    navigate('/training')
  }

  const handleJitsiApi = (api) => {
    // You can add custom event listeners here
    api.addListener('videoConferenceJoined', () => {
      console.log('User joined the conference')
    })

    api.addListener('videoConferenceLeft', () => {
      console.log('User left the conference')
      handleReadyToClose()
    })
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            No Session ID
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please provide a valid training session ID
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  if (meetingEnded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Training Session Ended
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Thank you for participating in the training session
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen relative">
      {/* Floating Invite Button */}
      <button
        onClick={() => setShowInviteCard(!showInviteCard)}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Invite
      </button>

      {/* Invite Card */}
      {showInviteCard && (
        <div className="absolute top-20 right-4 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Invite Participants
            </h3>
            <button
              onClick={() => setShowInviteCard(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Session ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sessionId}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={copySessionId}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Copy Session ID"
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Full Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm overflow-hidden text-ellipsis"
                />
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  title="Copy Invite Link"
                >
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Share the Session ID or link with participants to invite them to this training session.
              </p>
            </div>
          </div>
        </div>
      )}

      <JitsiMeeting
        roomName={`teeem-training-${sessionId}`}
        configOverwrite={{
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          disableModeratorIndicator: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          hideConferenceSubject: false,
          subject: `Training Session: ${sessionId}`,
          // Enable screen sharing
          disableScreensharingVirtualBackground: false,
          screenshotCapture: {
            enabled: true,
            mode: 'recording'
          }
        }}
        interfaceConfigOverwrite={{
          TOOLBAR_BUTTONS: [
            'camera',
            'chat',
            'desktop', // Screen sharing button
            'download',
            'embedmeeting',
            'etherpad',
            'feedback',
            'filmstrip',
            'fullscreen',
            'hangup',
            'help',
            'highlight',
            'invite',
            'livestreaming',
            'microphone',
            'noisesuppression',
            'participants-pane',
            'profile',
            'raisehand',
            'recording',
            'security',
            'select-background',
            'settings',
            'shareaudio',
            'sharedvideo',
            'shortcuts',
            'stats',
            'tileview',
            'toggle-camera',
            'videoquality',
            'whiteboard'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#1F2937',
          DISABLE_VIDEO_BACKGROUND: false,
          FILM_STRIP_MAX_HEIGHT: 120,
          MOBILE_APP_PROMO: false
        }}
        userInfo={{
          displayName: displayName,
          email: ''
        }}
        onApiReady={handleJitsiApi}
        onReadyToClose={handleReadyToClose}
        getIFrameRef={(node) => {
          if (node) {
            node.style.height = '100vh'
            node.style.width = '100vw'
          }
        }}
      />
    </div>
  )
}
