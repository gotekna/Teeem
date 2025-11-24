import { useState, useEffect } from 'react'
import { ArrowPathIcon, BeakerIcon, PlayIcon, EyeIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

// Define available tests
const AVAILABLE_TESTS = [
  {
    id: 'cascade-basic',
    name: 'Basic Cascade Test',
    type: 'Cascade',
    rules: 'Moves a task and verifies dependent tasks update correctly',
    canRunVisual: true
  },
  {
    id: 'cascade-complex',
    name: 'Complex Cascade Test',
    type: 'Cascade',
    rules: 'Tests multiple dependency chains and cross-dependencies',
    canRunVisual: true
  },
  {
    id: 'dependency-fs',
    name: 'Finish-to-Start Dependencies',
    type: 'Dependencies',
    rules: 'Verifies FS relationships with various lag values',
    canRunVisual: false
  },
  {
    id: 'dependency-ss',
    name: 'Start-to-Start Dependencies',
    type: 'Dependencies',
    rules: 'Verifies SS relationships with various lag values',
    canRunVisual: false
  },
  {
    id: 'dependency-ff',
    name: 'Finish-to-Finish Dependencies',
    type: 'Dependencies',
    rules: 'Verifies FF relationships with various lag values',
    canRunVisual: false
  },
  {
    id: 'dependency-sf',
    name: 'Start-to-Finish Dependencies',
    type: 'Dependencies',
    rules: 'Verifies SF relationships with various lag values',
    canRunVisual: false
  },
  {
    id: 'lag-positive',
    name: 'Positive Lag Calculations',
    type: 'Lag',
    rules: 'Tests tasks with positive lag values (delays)',
    canRunVisual: false
  },
  {
    id: 'lag-negative',
    name: 'Negative Lag Calculations',
    type: 'Lag',
    rules: 'Tests tasks with negative lag values (overlaps)',
    canRunVisual: false
  },
  {
    id: 'flashing-prevention',
    name: 'No Screen Flashing',
    type: 'Performance',
    rules: 'Ensures Gantt reloads ≤1 time during updates',
    canRunVisual: true
  }
]

export default function BugHunterTests() {
  const [selectedTests, setSelectedTests] = useState([])
  const [runningTests, setRunningTests] = useState(new Set())
  const [visualTestResult, setVisualTestResult] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [testHistory, setTestHistory] = useState([])
  const [isResettingData, setIsResettingData] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [testSteps, setTestSteps] = useState([])
  const [currentStep, setCurrentStep] = useState('')

  // Load test history on mount
  useEffect(() => {
    loadTestHistory()
  }, [])

  const loadTestHistory = async () => {
    try {
      const response = await api.get('/api/v1/bug_hunter_tests/history')
      setTestHistory(response.data || [])
    } catch (error) {
      console.error('Failed to load test history:', error)
    }
  }

  const cleanupOldData = async () => {
    try {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      await api.delete('/api/v1/bug_hunter_tests/cleanup', {
        params: { before: weekAgo.toISOString() }
      })
    } catch (error) {
      console.error('Failed to cleanup old data:', error)
    }
  }

  const checkAndCleanup = async () => {
    const today = new Date().toDateString()
    const lastCleanup = localStorage.getItem('lastBugHunterCleanup')

    if (lastCleanup !== today) {
      await cleanupOldData()
      localStorage.setItem('lastBugHunterCleanup', today)
    }
  }

  const toggleTestSelection = (testId) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    )
  }

  const toggleAllTests = () => {
    if (selectedTests.length === AVAILABLE_TESTS.length) {
      setSelectedTests([])
    } else {
      setSelectedTests(AVAILABLE_TESTS.map(t => t.id))
    }
  }

  const runTest = async (testId, visual = false) => {
    await checkAndCleanup()

    setRunningTests(prev => new Set([...prev, testId]))
    setTestSteps(prev => ({ ...prev, [testId]: [] }))

    try {
      let result

      if (visual && window.runGanttAutomatedTest) {
        result = await window.runGanttAutomatedTest({ silent: false })
      } else {
        // Run regular test via API
        const response = await api.post(`/api/v1/bug_hunter_tests/${testId}/run`)
        result = response.data
      }

      setTestResults(prev => ({
        ...prev,
        [testId]: {
          status: result.passed ? 'pass' : 'fail',
          message: result.message,
          timestamp: new Date().toISOString(),
          duration: result.testDuration || result.duration
        }
      }))

      if (result.steps) {
        setTestSteps(prev => ({ ...prev, [testId]: result.steps }))
      }

      await loadTestHistory()

    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testId]: {
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev)
        newSet.delete(testId)
        return newSet
      })
    }
  }

  const runSelectedTests = async () => {
    for (const testId of selectedTests) {
      await runTest(testId, false)
    }
  }

  const getLastRun = (testId) => {
    const history = testHistory.filter(h => h.test_id === testId)
    if (history.length === 0) return null
    return history[0]
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const resetTaskData = async () => {
    setIsResettingData(true)
    setTestSteps([])

    try {
      const templatesResponse = await api.get('/api/v1/schedule_templates')
      const templates = templatesResponse.data || templatesResponse

      if (!templates || templates.length === 0) {
        setTestSteps(['❌ No schedule templates found'])
        setTimeout(() => {
          setTestSteps([])
          setIsResettingData(false)
        }, 3000)
        return
      }

      const template = templates[0]
      setTestSteps([`📋 Found template: ${template.name} (ID: ${template.id})`])

      const rowsResponse = await api.get(`/api/v1/schedule_templates/${template.id}/rows`)
      const rows = rowsResponse.data || rowsResponse

      setTestSteps(prev => [...prev, `📋 Found ${rows.length} tasks`])

      let resetCount = 0
      for (const row of rows) {
        try {
          await api.patch(`/api/v1/schedule_templates/${template.id}/rows/${row.id}`, {
            schedule_template_row: {
              manually_positioned: false
            }
          })
          resetCount++
          setTestSteps(prev => [...prev, `  ✅ Reset task ${row.id} - ${row.name}`])
        } catch (error) {
          setTestSteps(prev => [...prev, `  ❌ Failed to reset task ${row.id}: ${error.message}`])
        }
      }

      setTestSteps(prev => [...prev, `✅ Reset complete - ${resetCount}/${rows.length} tasks`])

      setTimeout(() => {
        setTestSteps([])
        setIsResettingData(false)
      }, 5000)

    } catch (error) {
      setTestSteps(prev => [...prev, `❌ Reset failed: ${error.message}`])
      setTimeout(() => {
        setTestSteps([])
        setIsResettingData(false)
      }, 5000)
    }
  }

  const runVisualTest = async () => {
    setIsRunning(true)
    setVisualTestResult(null)
    setTestSteps([])
    setCurrentStep('Initializing...')

    try {
      if (!window.runGanttAutomatedTest) {
        setTestSteps([
          '❌ Gantt test API not available',
          'ℹ️ Open Schedule Master → Gantt view first',
          'ℹ️ API is exposed when Gantt Test Status modal is open'
        ])
        setVisualTestResult({
          status: 'error',
          message: 'Test API not available - open Gantt view first'
        })
        setIsRunning(false)
        return
      }

      setTestSteps(['✅ Gantt test API found'])
      setCurrentStep('Running test...')

      const result = await window.runGanttAutomatedTest({ silent: false })

      if (result.steps) {
        setTestSteps(result.steps)
      }

      setVisualTestResult({
        status: result.status,
        passed: result.passed,
        message: result.passed
          ? `✅ PASSED - Completed in ${result.testDuration}s`
          : `❌ FAILED - Ran for ${result.testDuration}s`,
        metrics: result.metrics,
        taskName: result.taskName,
        taskId: result.taskId,
        testDuration: result.testDuration
      })

      setCurrentStep(result.passed ? '✅ Passed!' : '❌ Failed')

    } catch (error) {
      setTestSteps(prev => [...prev, `❌ ERROR: ${error.message}`])
      setVisualTestResult({
        status: 'error',
        message: `Error: ${error.message}`
      })
      setCurrentStep('❌ Error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-7xl">
        <div className="mb-8">
          <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">Bug Hunter Visual Tests</h2>
          <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
            Automated tests with step-by-step visualization.
          </p>
        </div>

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 p-6">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Test Suite</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Run automated cascade tests
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetTaskData}
                disabled={isResettingData || isRunning}
                className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResettingData ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-4 w-4" />
                    Reset Data
                  </>
                )}
              </button>
              <button
                onClick={runVisualTest}
                disabled={isRunning || isResettingData}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <BeakerIcon className="h-4 w-4" />
                    Run Test
                  </>
                )}
              </button>
            </div>
          </div>

          {isRunning && currentStep && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3">
                <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{currentStep}</span>
              </div>
            </div>
          )}

          {testSteps.length > 0 && (
            <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Test Steps</h4>
              <div className="space-y-1 text-sm font-mono max-h-96 overflow-y-auto">
                {testSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`py-1 ${
                      step.startsWith('✅') ? 'text-green-700 dark:text-green-300' :
                      step.startsWith('❌') ? 'text-red-700 dark:text-red-300' :
                      step.startsWith('⚠️') ? 'text-yellow-700 dark:text-yellow-300' :
                      step.startsWith('ℹ️') ? 'text-blue-700 dark:text-blue-300' :
                      step.startsWith('📍') || step.startsWith('📋') ? 'text-purple-700 dark:text-purple-300' :
                      'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {visualTestResult && !isRunning && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className={`rounded-md p-4 ${
                visualTestResult.status === 'pass' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                visualTestResult.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {visualTestResult.status === 'pass' ? (
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className={`text-sm font-medium ${
                      visualTestResult.status === 'pass' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {visualTestResult.message}
                    </h3>
                    {visualTestResult.taskName && (
                      <div className="mt-2 text-sm">
                        <p className={visualTestResult.status === 'pass' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                          Task: #{visualTestResult.taskId} - {visualTestResult.taskName}
                        </p>
                      </div>
                    )}
                    {visualTestResult.metrics && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div><span className="font-medium">API Calls:</span> {visualTestResult.metrics.apiCalls}</div>
                        <div><span className="font-medium">Reloads:</span> {visualTestResult.metrics.ganttReloads}</div>
                        <div><span className="font-medium">Warnings:</span> {visualTestResult.metrics.warnings}</div>
                        <div><span className="font-medium">Dependencies:</span> {visualTestResult.metrics.dependenciesWorked ? '✅' : '❌'}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!visualTestResult && !isRunning && testSteps.length === 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-blue-600 dark:text-blue-400 text-xl">ℹ️</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      How to Run Tests
                    </h3>
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                      <li>Click "Reset Data" to clear manually positioned flags</li>
                      <li>Go to Schedule Master Setup tab and open a template</li>
                      <li>Click Gantt icon to open the Gantt view</li>
                      <li>Return here and click "Run Test"</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Test Verifies</h4>
            <div className="space-y-3">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">✅ Cascade Behavior</h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Moves task 5 days and verifies all dependent tasks move correctly
                </p>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">✅ No Screen Flashing</h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Ensures Gantt doesn't reload unnecessarily (≤1 reload)
                </p>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">✅ Dependency Types</h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Tests FS, SS, FF, SF relationships with lag values
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}