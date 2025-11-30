import { useState, useEffect } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, RadioGroup } from '@headlessui/react'
import { XMarkIcon, UserIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function MergeContactsModal({ isOpen, onClose, selectedContacts, onMerge, onDelete }) {
  const [targetContact, setTargetContact] = useState(null)
  const [merging, setMerging] = useState(false)
  const [deleting, setDeleting] = useState(null) // Track which contact is being deleted
  const [error, setError] = useState(null)

  // Auto-select the best contact when modal opens
  // Priority: 1) Has Xero connection, 2) Has most data fields filled
  const getBestContact = (contacts) => {
    if (!contacts || contacts.length === 0) return null

    // Score each contact
    const scored = contacts.map(c => {
      let score = 0
      if (c.xero_id) score += 100 // Xero connection is most important
      if (c.email) score += 10
      if (c.mobile_phone) score += 5
      if (c.office_phone) score += 5
      return { contact: c, score }
    })

    // Sort by score descending and return the best
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.contact || contacts[0]
  }

  // Auto-select when contacts change or modal opens
  useEffect(() => {
    if (isOpen && selectedContacts?.length > 0) {
      setTargetContact(getBestContact(selectedContacts))
    }
  }, [isOpen, selectedContacts])

  // Check if we're about to lose a Xero connection
  const xeroContactBeingDeleted = targetContact && selectedContacts?.some(
    c => c.id !== targetContact.id && c.xero_id && !targetContact.xero_id
  )

  const handleMerge = async () => {
    if (!targetContact) {
      setError('Please select a contact to merge into')
      return
    }

    try {
      setMerging(true)
      setError(null)

      // Get IDs of contacts to merge (excluding the target)
      const sourceIds = selectedContacts
        .filter(c => c.id !== targetContact.id)
        .map(c => c.id)

      await onMerge(targetContact.id, sourceIds)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to merge contacts')
    } finally {
      setMerging(false)
    }
  }

  const handleDelete = async (contact) => {
    if (!onDelete) return

    try {
      setDeleting(contact.id)
      setError(null)
      await onDelete(contact.id)
      // If only one contact left after delete, close the modal
      if (selectedContacts.length <= 2) {
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete contact')
    } finally {
      setDeleting(null)
    }
  }

  const handleClose = () => {
    setTargetContact(null)
    setError(null)
    setDeleting(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-2xl transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Merge Contacts
              </DialogTitle>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-6">
              {/* Warning */}
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Important: This action cannot be undone
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <p>
                        All data from the other {selectedContacts.length - 1} contact(s) will be merged into the contact you select below.
                        The other contacts will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Merging {selectedContacts.length} contacts
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select which contact should be kept. All data will be merged into this contact:
                </p>
              </div>

              {/* Contact Selection */}
              <RadioGroup value={targetContact} onChange={setTargetContact}>
                <RadioGroup.Label className="sr-only">Select target contact</RadioGroup.Label>
                <div className="space-y-3">
                  {selectedContacts.map((contact) => (
                    <div key={contact.id} className="relative">
                      <RadioGroup.Option
                        value={contact}
                        className={({ checked }) =>
                          `relative flex cursor-pointer rounded-lg border ${
                            checked
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                          } px-5 py-4 shadow-sm focus:outline-none`
                        }
                      >
                        {({ checked }) => (
                          <>
                            <div className="flex flex-1 items-center">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex-shrink-0">
                                  <UserIcon className={`h-10 w-10 ${checked ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <RadioGroup.Label
                                    as="p"
                                    className={`font-medium flex items-center gap-2 ${
                                      checked ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    {contact.full_name}
                                    {contact.xero_id && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        XERO
                                      </span>
                                    )}
                                  </RadioGroup.Label>
                                  <RadioGroup.Description
                                    as="div"
                                    className={`text-sm ${
                                      checked ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    <div>{contact.email || 'No email'}</div>
                                    <div>{contact.mobile_phone || contact.office_phone || 'No phone'}</div>
                                  </RadioGroup.Description>
                                </div>
                                {checked && (
                                  <div className="flex-shrink-0 mr-2">
                                    <CheckCircleIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </RadioGroup.Option>
                      {/* Delete button - positioned on the right */}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(contact)
                          }}
                          disabled={deleting === contact.id || merging}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                          title="Delete this contact"
                        >
                          {deleting === contact.id ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            <TrashIcon className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {/* Xero Warning */}
              {xeroContactBeingDeleted && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Warning: Xero Connection Will Be Lost
                      </h3>
                      <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                        <p>
                          You are about to merge a Xero-connected contact into one that is not connected to Xero.
                          The Xero connection will be lost. Consider selecting the contact with the XERO badge as the target instead.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* What will be merged */}
              {targetContact && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                    What will be merged into {targetContact.full_name}:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• All purchase orders and relationships</li>
                    <li>• All supplier associations</li>
                    <li>• All communication history</li>
                    <li>• All notes and tags</li>
                    <li>• Contact information (if missing in target)</li>
                  </ul>
                  <p className="mt-3 text-sm text-blue-700 dark:text-blue-300 font-medium">
                    {selectedContacts.filter(c => c.id !== targetContact.id).length} contact(s) will be deleted after merge
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={handleClose}
                disabled={merging}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={!targetContact || merging}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Merging...
                  </div>
                ) : (
                  `Merge ${selectedContacts.length} Contacts`
                )}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
