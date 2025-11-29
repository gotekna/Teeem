import { useState } from 'react'
import {
  SparklesIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function JobEstimatorTab({ jobId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAnalyze = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.post(`/api/v1/jobs/${jobId}/analyze`)

      if (response.success) {
        setAnalysis(response.analysis)
      } else {
        setError(response.error || 'Failed to analyze job')
      }
    } catch (err) {
      console.error('Job analysis error:', err)
      setError(err.message || 'An error occurred while analyzing the job')
    } finally {
      setLoading(false)
    }
  }

  const getComplexityColor = (complexity) => {
    switch (complexity?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-indigo-600" />
              AI Job Estimator
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get AI-powered insights and analysis of this job's scope, requirements, and key points
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Analyze Job
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysis && !loading && !error && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Analysis Yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Click "Analyze Job" to get AI-powered insights about this job
            </p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Job Summary */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
              Job Summary
            </h3>
            <p className="text-gray-700 dark:text-gray-300">{analysis.job_summary}</p>
          </div>

          {/* 10 Key Points */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5 text-indigo-600" />
              10 Key Points About This Job
            </h3>
            <ul className="space-y-3">
              {analysis.key_points?.map((point, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Estimated Scope */}
          {analysis.estimated_scope && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Complexity & Duration */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Scope Overview</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Complexity</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(analysis.estimated_scope.complexity)}`}>
                        {analysis.estimated_scope.complexity}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estimated Duration</span>
                    <div className="mt-1 flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">{analysis.estimated_scope.duration_estimate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Trades */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Key Trades Required</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.estimated_scope.key_trades?.map((trade, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    >
                      {trade}
                    </span>
                  ))}
                </div>
              </div>

              {/* Major Materials */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Major Materials</h4>
                <ul className="space-y-1">
                  {analysis.estimated_scope.major_materials?.map((material, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>{material}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Potential Challenges */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                  Potential Challenges
                </h4>
                <ul className="space-y-1">
                  {analysis.estimated_scope.potential_challenges?.map((challenge, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">⚠</span>
                      <span>{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-green-600" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
