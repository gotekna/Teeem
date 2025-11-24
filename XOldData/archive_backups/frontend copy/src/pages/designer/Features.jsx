import { useState, useEffect } from 'react'
import { SparklesIcon, LightBulbIcon } from '@heroicons/react/24/outline'

export default function Features({ onOpenGrokChat }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Load saved plans from API
    setLoading(false)
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Features</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Plan and manage your product features with AI assistance
        </p>
      </div>

      {/* Grok Chat CTA */}
      <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-x-4">
          <div className="flex-shrink-0">
            <img src="/grok-logo.png" alt="Grok" className="h-12 w-12" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Plan Features with Grok AI
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Chat with Grok to brainstorm features, discuss architecture, and create detailed plans.
              Your conversations are saved here for future reference.
            </p>
            <button
              onClick={onOpenGrokChat}
              className="inline-flex items-center gap-x-2 rounded-md bg-black hover:bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              <SparklesIcon className="h-5 w-5" />
              Start Planning with Grok
            </button>
          </div>
        </div>
      </div>

      {/* Saved Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Saved Plans</h2>

        {plans.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-white/10">
            <LightBulbIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No plans yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Start chatting with Grok to create your first feature plan
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-white/10 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">{plan.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plan.description}</p>
                <div className="mt-2 flex items-center gap-x-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-1 rounded-full ${
                    plan.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    plan.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {plan.status}
                  </span>
                  <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
