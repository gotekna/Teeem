import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, TableCellsIcon, DocumentArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export default function CreateTableModal({ isOpen, onClose }) {
  const navigate = useNavigate()

  const options = [
    {
      name: 'Import Data',
      description: 'Upload a CSV or Excel file to create a table',
      icon: DocumentArrowUpIcon,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      action: () => {
        onClose()
        navigate('/import')
      }
    },
    {
      name: 'Blank Sheet',
      description: 'Start with an empty table and build from scratch',
      icon: TableCellsIcon,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
      action: () => {
        onClose()
        navigate('/designer/tables/new')
      }
    },
    {
      name: 'Create Form',
      description: 'Build a form-first table for data collection',
      icon: DocumentTextIcon,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      action: () => {
        onClose()
        // TODO: Implement form builder
        alert('Form builder coming soon!')
      }
    }
  ]

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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-8 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white">
                      Create a new table
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Choose how you'd like to get started
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {options.map((option) => (
                    <button
                      key={option.name}
                      onClick={option.action}
                      className="relative flex items-start gap-4 rounded-xl border-2 border-gray-200 bg-white p-6 text-left hover:border-indigo-500 hover:bg-gray-50 transition-all dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-400 dark:hover:bg-white/10"
                    >
                      <div className={`flex-shrink-0 rounded-lg p-3 ${option.iconBg} dark:bg-opacity-20`}>
                        <option.icon className={`h-8 w-8 ${option.iconColor} dark:opacity-90`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {option.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {option.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 self-center">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
