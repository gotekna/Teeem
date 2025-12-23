import { XMarkIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'

/**
 * GanttRulesModal - Displays the Gantt Bible (GANTT_DRAG_FLICKER_FIXES.md)
 */
export default function GanttRulesModal({ isOpen, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchRules()
    }
  }, [isOpen])

  const fetchRules = async () => {
    try {
      setLoading(true)
      // Fetch the Gantt Bible (The Bible - Rules Only)
      const response = await fetch('/GANTT_BIBLE.md')
      const text = await response.text()
      setContent(text)
    } catch (err) {
      console.error('Failed to load Gantt Bible:', err)
      setContent('# Error\n\nFailed to load Gantt Bible.')
    } finally {
      setLoading(false)
    }
  }

  // Simple markdown-to-HTML converter for basic formatting
  const formatMarkdown = (text) => {
    return text
      // Headers
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 dark:text-white mt-6 mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-900 dark:text-white mt-4 mb-2">$1</h3>')

      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')

      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono text-pink-600 dark:text-pink-400">$1</code>')

      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')

      // Lists
      .replace(/^\- (.*$)/gim, '<li class="ml-6 list-disc">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-6 list-decimal">$1</li>')

      // Checkboxes
      .replace(/- \[ \] (.*$)/gim, '<li class="ml-6 list-none"><input type="checkbox" disabled class="mr-2">$1</li>')
      .replace(/- \[x\] (.*$)/gim, '<li class="ml-6 list-none"><input type="checkbox" checked disabled class="mr-2">$1</li>')

      // Tables (basic)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim())
        return '<tr>' + cells.map(c => `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2">${c.trim()}</td>`).join('') + '</tr>'
      })

      // Horizontal rules
      .replace(/^---$/gm, '<hr class="my-8 border-gray-300 dark:border-gray-600">')

      // Paragraphs
      .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 dark:text-gray-300">')

      // Emojis and checkmarks
      .replace(/✅/g, '<span class="text-green-600">✅</span>')
      .replace(/❌/g, '<span class="text-red-600">❌</span>')
      .replace(/⚠️/g, '<span class="text-yellow-600">⚠️</span>')
      .replace(/🎯/g, '<span>🎯</span>')
      .replace(/📋/g, '<span>📋</span>')
      .replace(/📚/g, '<span>📚</span>')
      .replace(/🚀/g, '<span>🚀</span>')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Gantt Bible - Complete Drag & Cascade Documentation
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading documentation...</span>
              </div>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    '<p class="mb-4 text-gray-700 dark:text-gray-300">' + formatMarkdown(content) + '</p>'
                  )
                }}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
