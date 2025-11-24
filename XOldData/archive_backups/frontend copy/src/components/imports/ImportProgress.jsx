import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function ImportProgress({ sessionKey, onComplete }) {
  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [processedRows, setProcessedRows] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await api.get(`/api/v1/imports/status/${sessionKey}`)

        if (response.success) {
          setStatus(response.status)
          setProgress(response.progress || 0)
          setProcessedRows(response.processed_rows || 0)
          setTotalRows(response.total_rows || 0)

          if (response.status === 'completed') {
            // Wait a moment to show 100% before completing
            setTimeout(() => {
              onComplete(response.table_id)
            }, 1000)
          } else if (response.status === 'failed') {
            setError(response.error || 'Import failed')
          }
        }
      } catch (err) {
        console.error('Failed to check import status:', err)
        setError('Failed to check import status')
      }
    }

    // Check status immediately
    checkStatus()

    // Then poll every second
    const interval = setInterval(checkStatus, 1000)

    return () => clearInterval(interval)
  }, [sessionKey, onComplete])

  const getStatusText = () => {
    switch (status) {
      case 'queued':
        return 'Preparing import...'
      case 'processing':
        return `Importing ${processedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows...`
      case 'completed':
        return 'Import complete!'
      case 'failed':
        return 'Import failed'
      default:
        return 'Starting...'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-red-900">Import Failed</h2>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-semibold ${getStatusColor()} mb-2`}>
            {getStatusText()}
          </h2>
          <p className="text-gray-600">
            {status === 'processing' && `${Math.round(progress)}% complete`}
          </p>
        </div>

        {/* Water Tank Animation */}
        <div className="relative w-full h-64 bg-gray-100 rounded-2xl overflow-hidden mb-6">
          {/* Water */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-500 ease-out"
            style={{ height: `${progress}%` }}
          >
            {/* Water waves */}
            <div className="absolute top-0 left-0 right-0 h-8">
              <svg
                className="absolute top-0 w-full h-full"
                viewBox="0 0 1200 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,50 Q150,20 300,50 T600,50 T900,50 T1200,50 L1200,100 L0,100 Z"
                  fill="rgba(96, 165, 250, 0.3)"
                  className="animate-wave"
                />
                <path
                  d="M0,60 Q150,30 300,60 T600,60 T900,60 T1200,60 L1200,100 L0,100 Z"
                  fill="rgba(96, 165, 250, 0.2)"
                  className="animate-wave-slow"
                />
              </svg>
            </div>

            {/* Droplets/bubbles effect */}
            {status === 'processing' && (
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white/30 rounded-full animate-bubble"
                    style={{
                      left: `${20 + i * 15}%`,
                      animationDelay: `${i * 0.3}s`,
                      animationDuration: `${2 + i * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Progress text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center z-10">
              <div className="text-6xl font-bold text-gray-700">
                {Math.round(progress)}%
              </div>
              {processedRows > 0 && (
                <div className="text-sm text-gray-600 mt-2">
                  {processedRows.toLocaleString()} / {totalRows.toLocaleString()} rows
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-center gap-2">
          {status === 'processing' ? (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              <span className="text-sm text-gray-600">Processing...</span>
            </>
          ) : status === 'completed' ? (
            <>
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-green-600">Completed successfully!</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Preparing...</span>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-25%) translateY(-10px); }
        }

        @keyframes wave-slow {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-15%) translateY(-5px); }
        }

        @keyframes bubble {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-200px) scale(1);
            opacity: 0;
          }
        }

        .animate-wave {
          animation: wave 3s ease-in-out infinite;
        }

        .animate-wave-slow {
          animation: wave-slow 4s ease-in-out infinite;
        }

        .animate-bubble {
          animation: bubble linear infinite;
        }
      `}</style>
    </div>
  )
}
