import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  CloudIcon,
  CpuChipIcon,
  SparklesIcon,
  CommandLineIcon,
  LightBulbIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'

export default function SetupGuideModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1)
  const totalSteps = 4

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleClose = () => {
    // Store in localStorage to not show again
    localStorage.setItem('trapid_setup_guide_shown', 'true')
    setStep(1)
    onClose()
  }

  const handleSkip = () => {
    localStorage.setItem('trapid_setup_guide_shown', 'true')
    setStep(1)
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleSkip}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8 text-white">
                  <button
                    onClick={handleSkip}
                    className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/10 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                      <RocketLaunchIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <Dialog.Title className="text-2xl font-bold">
                        {step === 1 && 'Welcome to Trapid'}
                        {step === 2 && 'Quick Start Guide'}
                        {step === 3 && 'Key Features'}
                        {step === 4 && 'Ready to Go!'}
                      </Dialog.Title>
                      <p className="mt-1 text-indigo-100">
                        {step === 1 && 'Your comprehensive construction management platform'}
                        {step === 2 && 'Learn the basic workflow in 3 easy steps'}
                        {step === 3 && 'Discover powerful features to streamline your projects'}
                        {step === 4 && 'You\'re all set to manage your construction projects'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-indigo-100">Step {step} of {totalSteps}</span>
                      <span className="text-indigo-100">{Math.round((step / totalSteps) * 100)}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-8">
                  <div className="relative" style={{ minHeight: '400px' }}>
                    {/* Step 1: Welcome */}
                    <div
                      className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                        step === 1
                          ? 'translate-x-0 opacity-100'
                          : step > 1
                          ? '-translate-x-full opacity-0 pointer-events-none'
                          : 'translate-x-full opacity-0 pointer-events-none'
                      }`}
                    >
                      {step === 1 && (
                        <div className="space-y-6">
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6">
                              <RocketLaunchIcon className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                              Welcome to Trapid
                            </h3>
                            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                              Your all-in-one construction project management platform designed to streamline
                              job creation, estimate management, and purchase order generation.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                  <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Job Management
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Create and track construction jobs with detailed financials, timelines, and team management.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                                  <DocumentTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Estimate Integration
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Import estimates from Unreal Engine and automatically match them to your jobs.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                  <ShoppingCartIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Smart PO Generation
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Automatically generate purchase orders with intelligent supplier matching and pricing.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-6 border border-cyan-200 dark:border-cyan-800">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                                  <CloudIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    OneDrive Integration
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Seamlessly sync documents and plans with OneDrive for easy access and collaboration.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Quick Start */}
                    <div
                      className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                        step === 2
                          ? 'translate-x-0 opacity-100'
                          : step > 2
                          ? '-translate-x-full opacity-0 pointer-events-none'
                          : 'translate-x-full opacity-0 pointer-events-none'
                      }`}
                    >
                      {step === 2 && (
                        <div className="space-y-8">
                          <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                              Get Started in 3 Steps
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                              Follow this simple workflow to manage your construction projects
                            </p>
                          </div>

                          <div className="space-y-6">
                            {/* Step 1 */}
                            <div className="flex items-start gap-6">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                1
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <BriefcaseIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Create a New Job
                                  </h4>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-3">
                                  Start by creating a new construction job from the Jobs page. Fill in basic details
                                  like job title, location, client information, and contract value.
                                </p>
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Pro Tip:</span> Enable automatic OneDrive folder creation
                                    to set up your document structure right from the start.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex items-start gap-6">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                2
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <DocumentTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Import an Estimate
                                  </h4>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-3">
                                  Import estimates from Unreal Engine or other sources. The system will automatically
                                  match them to your construction job and organize line items by category.
                                </p>
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Pro Tip:</span> Use AI Review to compare estimates
                                    against construction plans and identify discrepancies before generating POs.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex items-start gap-6">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                3
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <ShoppingCartIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Generate Purchase Orders
                                  </h4>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-3">
                                  Click "Generate POs" to automatically create purchase orders from your estimate.
                                  The system intelligently assigns suppliers and pricing based on historical data.
                                </p>
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Pro Tip:</span> Review and edit POs before approval,
                                    then send them directly to suppliers from within Trapid.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 3: Key Features */}
                    <div
                      className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                        step === 3
                          ? 'translate-x-0 opacity-100'
                          : step > 3
                          ? '-translate-x-full opacity-0 pointer-events-none'
                          : 'translate-x-full opacity-0 pointer-events-none'
                      }`}
                    >
                      {step === 3 && (
                        <div className="space-y-6">
                          <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                              Powerful Features
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                              Explore advanced capabilities to enhance your workflow
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                  <SparklesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">AI Plan Review</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Use Claude AI to analyze construction plans and compare them against estimates,
                                automatically flagging discrepancies and missing items.
                              </p>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                                  <FolderIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">OneDrive Integration</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Automatically create standardized folder structures in OneDrive and sync all job
                                documents for easy access and collaboration.
                              </p>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                  <CpuChipIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">Unreal Engine API</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Seamlessly receive estimates from Unreal Engine with automatic job matching and
                                intelligent categorization of line items.
                              </p>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                                  <LightBulbIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">Smart PO Lookup</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Intelligent supplier and pricing suggestions based on historical data, with fuzzy
                                matching for item descriptions across categories.
                              </p>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                                  <DocumentTextIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">Document Management</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Upload, organize, and manage all job-related documents with version control and
                                easy search capabilities.
                              </p>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-700 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                                  <CommandLineIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Speed up your workflow with keyboard shortcuts for common actions like creating
                                jobs, navigating tabs, and managing purchase orders.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 4: Ready to Go */}
                    <div
                      className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                        step === 4
                          ? 'translate-x-0 opacity-100'
                          : 'translate-x-full opacity-0 pointer-events-none'
                      }`}
                    >
                      {step === 4 && (
                        <div className="space-y-6">
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-teal-600 mb-6">
                              <CheckCircleIcon className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                              You're All Set!
                            </h3>
                            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                              You're ready to start managing your construction projects efficiently with Trapid.
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-8 border border-indigo-200 dark:border-indigo-800">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                              Quick Tips for Success
                            </h4>
                            <ul className="space-y-3">
                              <li className="flex items-start gap-3">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Start small:</strong> Create your first job and explore the interface
                                </span>
                              </li>
                              <li className="flex items-start gap-3">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Use AI features:</strong> Take advantage of AI Plan Review to catch errors early
                                </span>
                              </li>
                              <li className="flex items-start gap-3">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Enable OneDrive:</strong> Keep all your documents organized and accessible
                                </span>
                              </li>
                              <li className="flex items-start gap-3">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Check the Documentation tab:</strong> Access detailed guides and FAQs anytime
                                </span>
                              </li>
                              <li className="flex items-start gap-3">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Learn keyboard shortcuts:</strong> Speed up your workflow with quick commands
                                </span>
                              </li>
                            </ul>
                          </div>

                          <div className="bg-white dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start gap-4">
                              <LightBulbIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                  Need Help?
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                  Access this guide anytime by clicking the help icon (?) in the job detail page header,
                                  or visit the Documentation tab for detailed information about all features.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <ArrowLeftIcon className="h-4 w-4" />
                          Back
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSkip}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Skip Tour
                      </button>

                      {step < totalSteps ? (
                        <button
                          type="button"
                          onClick={handleNext}
                          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-lg shadow-indigo-500/30"
                        >
                          Next
                          <ArrowRightIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleClose}
                          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-lg transition-all shadow-lg shadow-green-500/30"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Get Started
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
