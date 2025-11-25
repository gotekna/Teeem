import { useState } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  CloudIcon,
  CpuChipIcon,
  SparklesIcon,
  CommandLineIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'

const documentationSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: RocketLaunchIcon,
    color: 'indigo',
    content: {
      description: 'Learn the basics of using Trapid for construction project management.',
      subsections: [
        {
          title: 'Creating Your First Job',
          content: [
            'Navigate to the Jobs page and click "New Job" button',
            'Fill in the essential details: Job title, Location, and Client',
            'Add optional information like contract value, start/end dates, and site supervisor',
            'Set the project stage and status to track progress',
            'Enable OneDrive integration to automatically create folder structures',
            'Click "Create Job" to set up your project',
          ]
        },
        {
          title: 'Understanding Job Stages',
          content: [
            'Planning: Initial project setup and planning phase',
            'Design: Design development and documentation',
            'Preconstruction: Pre-construction activities and approvals',
            'Construction: Active construction phase',
            'Closeout: Project completion and handover',
            'Complete: Fully completed and archived projects',
          ]
        },
        {
          title: 'Navigating the Job Detail Page',
          content: [
            'Overview: View and edit core job details and financials',
            'Purchase Orders: Manage all POs for the job',
            'Estimates: Review imported estimates and generate POs',
            'Documents: Upload and manage job-related files',
            'Team: Assign team members and roles',
            'Schedule Master: Track project timeline and milestones',
            'Budget: Monitor costs and profit margins',
            'Settings: Configure job-specific settings',
          ]
        },
      ]
    }
  },
  {
    id: 'job-workflow',
    title: 'Job Workflow Guide',
    icon: BriefcaseIcon,
    color: 'purple',
    content: {
      description: 'Complete workflow from job creation to purchase order management.',
      subsections: [
        {
          title: 'Step 1: Job Creation',
          content: [
            'Create a new construction job with basic details',
            'Link to an existing client or create a new contact',
            'Set contract value and project timeline',
            'Configure OneDrive folder creation for document management',
            'Set land status and track available documentation',
          ]
        },
        {
          title: 'Step 2: Estimate Import',
          content: [
            'Estimates are imported automatically from Unreal Engine via API',
            'The system uses fuzzy matching to link estimates to jobs',
            'Review imported line items organized by category',
            'Check estimate status: Pending, Matched, or Imported',
            'Use AI Review to validate estimates against plans',
          ]
        },
        {
          title: 'Step 3: Purchase Order Generation',
          content: [
            'Navigate to the Estimates tab in your job',
            'Click "Generate POs" on a matched estimate',
            'The system automatically groups items by category',
            'Smart PO Lookup assigns suppliers and pricing',
            'Review and edit generated POs before approval',
            'Approve and send POs directly to suppliers',
          ]
        },
        {
          title: 'Monitoring Live Profit',
          content: [
            'Live Profit = Contract Value - Total PO Costs',
            'Profit Percentage = (Live Profit / Contract Value) × 100',
            'Track these metrics on the Overview tab',
            'Monitor changes as POs are created and updated',
            'Use Budget tab for detailed cost breakdowns',
          ]
        },
      ]
    }
  },
  {
    id: 'estimates-pos',
    title: 'Estimates & Purchase Orders',
    icon: DocumentTextIcon,
    color: 'emerald',
    content: {
      description: 'Managing estimates and generating purchase orders efficiently.',
      subsections: [
        {
          title: 'Understanding Estimate Statuses',
          content: [
            'Pending: Newly imported, not yet matched to a job',
            'Matched: Successfully linked to a construction job',
            'Imported: Purchase orders have been generated',
          ]
        },
        {
          title: 'Viewing Estimate Details',
          content: [
            'Click "Show Items" to expand estimate line items',
            'View category, description, quantity, and unit for each item',
            'Check total item count and estimator information',
            'See import timestamp and source (Unreal Engine)',
          ]
        },
        {
          title: 'Generating Purchase Orders',
          content: [
            'Only "Matched" estimates can generate POs',
            'Click "Generate POs" button on the estimate card',
            'Confirm the generation in the dialog prompt',
            'System groups line items by category automatically',
            'Smart PO Lookup finds best suppliers and pricing',
            'Review warnings about missing suppliers or pricing',
          ]
        },
        {
          title: 'Managing Purchase Orders',
          content: [
            'View all POs in the Purchase Orders tab',
            'Edit PO details including supplier, items, and pricing',
            'Add or remove line items as needed',
            'Approve POs to lock them for sending',
            'Send POs directly to suppliers via email',
            'Track PO status: Draft, Approved, Sent',
          ]
        },
      ]
    }
  },
  {
    id: 'onedrive',
    title: 'OneDrive Integration',
    icon: CloudIcon,
    color: 'cyan',
    content: {
      description: 'Seamless document management with OneDrive integration.',
      subsections: [
        {
          title: 'Automatic Folder Creation',
          content: [
            'Enable "Create OneDrive folders" when creating a job',
            'System creates standardized folder structure',
            'Follows Tekna Standard naming conventions',
            'Folders are created in your connected OneDrive account',
            'Access folders directly from the Documents tab',
          ]
        },
        {
          title: 'Document Management',
          content: [
            'Navigate to the Documents tab in any job',
            'Upload files directly to OneDrive from Trapid',
            'View and download existing documents',
            'Organize files in the standard folder structure',
            'Share document links with team members',
          ]
        },
        {
          title: 'Syncing Construction Plans',
          content: [
            'Upload architectural plans to the Plans folder',
            'Plans are automatically available for AI Review',
            'Supports PDF format for plan documents',
            'Keep plans updated as revisions are made',
            'Access historical versions through OneDrive',
          ]
        },
      ]
    }
  },
  {
    id: 'unreal-engine',
    title: 'Unreal Engine API',
    icon: CpuChipIcon,
    color: 'amber',
    content: {
      description: 'Integration with Unreal Engine for estimate import.',
      subsections: [
        {
          title: 'How It Works',
          content: [
            'Unreal Engine sends estimates via webhook to Trapid',
            'Estimates include job name, estimator, and line items',
            'System uses fuzzy matching to link to existing jobs',
            'Match threshold is 70% similarity for job names',
            'Unmatched estimates remain in "Pending" status',
          ]
        },
        {
          title: 'API Endpoint',
          content: [
            'Endpoint: POST /api/v1/unreal_engine/estimates',
            'Accepts JSON payload with estimate data',
            'Returns created estimate ID and match status',
            'Authentication handled via API key',
            'Supports bulk import of multiple line items',
          ]
        },
        {
          title: 'Estimate Data Format',
          content: [
            'job_name: Name of the construction job',
            'estimator_name: Person who created the estimate',
            'line_items: Array of estimate line items',
            'Each item has: category, description, quantity, unit',
            'Categories are standardized for PO generation',
          ]
        },
      ]
    }
  },
  {
    id: 'ai-review',
    title: 'AI Plan Review',
    icon: SparklesIcon,
    color: 'rose',
    content: {
      description: 'Use AI to analyze construction plans and validate estimates.',
      subsections: [
        {
          title: 'Starting an AI Review',
          content: [
            'Navigate to an estimate with "Matched" status',
            'Click the "AI Review" button on the estimate card',
            'System downloads plans from OneDrive automatically',
            'Plans are sent to Claude AI for analysis',
            'Review results appear in a detailed modal',
          ]
        },
        {
          title: 'What AI Review Checks',
          content: [
            'Compares estimate line items against construction plans',
            'Identifies missing items not in the estimate',
            'Flags discrepancies in quantities or specifications',
            'Highlights potential cost-saving opportunities',
            'Provides recommendations for estimate improvements',
          ]
        },
        {
          title: 'Reviewing Results',
          content: [
            'See AI-generated analysis in the review modal',
            'Review flagged discrepancies and missing items',
            'Read detailed recommendations from Claude AI',
            'Use findings to update estimates before generating POs',
            'Results are saved for future reference',
          ]
        },
        {
          title: 'Best Practices',
          content: [
            'Upload complete and current plans to OneDrive first',
            'Run AI Review before generating purchase orders',
            'Review AI findings carefully - they are suggestions',
            'Update estimates based on valid discrepancies',
            'Re-run review after making significant changes',
          ]
        },
      ]
    }
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    icon: CommandLineIcon,
    color: 'teal',
    content: {
      description: 'Speed up your workflow with keyboard shortcuts.',
      subsections: [
        {
          title: 'Global Shortcuts',
          content: [
            'Ctrl/Cmd + K: Quick search (coming soon)',
            'Ctrl/Cmd + N: Create new job (from Jobs page)',
            '?: Open this help guide',
            'Esc: Close modals and dialogs',
          ]
        },
        {
          title: 'Job Detail Page',
          content: [
            'Tab navigation: Use Tab key to move between fields',
            'Ctrl/Cmd + S: Save changes (when editing)',
            'Ctrl/Cmd + E: Enter edit mode',
            'Arrow keys: Navigate between tabs',
          ]
        },
        {
          title: 'Purchase Orders',
          content: [
            'Ctrl/Cmd + P: Create new purchase order',
            'Ctrl/Cmd + Enter: Approve PO (when in edit mode)',
            'Ctrl/Cmd + Shift + S: Send PO to supplier',
          ]
        },
      ]
    }
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    icon: QuestionMarkCircleIcon,
    color: 'violet',
    content: {
      description: 'Common questions and answers about using Trapid.',
      subsections: [
        {
          title: 'General Questions',
          content: [
            'Q: How do I add a new supplier?\nA: Go to the Suppliers page (coming soon) or add suppliers when creating/editing purchase orders.',
            'Q: Can I edit an estimate after it\'s imported?\nA: Estimates are read-only. Generate POs and edit those instead.',
            'Q: How do I delete a job?\nA: Job deletion is coming soon. Contact support for now.',
            'Q: Can multiple users work on the same job?\nA: Yes! Use the Team tab to assign team members and roles.',
          ]
        },
        {
          title: 'Purchase Orders',
          content: [
            'Q: What happens when I approve a PO?\nA: Approved POs are locked and ready to send to suppliers.',
            'Q: Can I edit an approved PO?\nA: You must un-approve it first (feature coming soon).',
            'Q: How do I send a PO to a supplier?\nA: Click "Send to Supplier" after approving the PO.',
            'Q: What if a supplier isn\'t in the system?\nA: You can add suppliers directly when creating/editing a PO.',
          ]
        },
        {
          title: 'Estimates',
          content: [
            'Q: Why isn\'t my estimate matched to a job?\nA: The job name similarity must be at least 70%. Create the job first.',
            'Q: Can I manually match an estimate to a job?\nA: Manual matching feature is coming soon.',
            'Q: How do I delete an estimate?\nA: Click the trash icon on estimates with "Pending" or "Matched" status.',
            'Q: Can I import estimates from sources other than Unreal Engine?\nA: CSV import is planned for a future release.',
          ]
        },
        {
          title: 'Technical Issues',
          content: [
            'Q: OneDrive authentication failed. What now?\nA: Re-authenticate via Settings or contact your admin.',
            'Q: AI Review isn\'t working. Why?\nA: Ensure plans are uploaded to OneDrive and API keys are configured.',
            'Q: Documents aren\'t syncing with OneDrive.\nA: Check your OneDrive connection and permissions.',
            'Q: I\'m seeing an error. What should I do?\nA: Note the error message and contact support with details.',
          ]
        },
      ]
    }
  },
]

export default function DocumentationTab() {
  const [expandedSection, setExpandedSection] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleToggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  // Filter sections based on search query
  const filteredSections = documentationSections.filter(section => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const titleMatch = section.title.toLowerCase().includes(query)
    const descriptionMatch = section.content.description.toLowerCase().includes(query)
    const contentMatch = section.content.subsections.some(subsection =>
      subsection.title.toLowerCase().includes(query) ||
      subsection.content.some(item => item.toLowerCase().includes(query))
    )

    return titleMatch || descriptionMatch || contentMatch
  })

  const getColorClasses = (color) => {
    const colors = {
      indigo: {
        bg: 'bg-indigo-100 dark:bg-indigo-900/20',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-200 dark:border-indigo-800',
        hover: 'hover:border-indigo-300 dark:hover:border-indigo-700',
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-900/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
        hover: 'hover:border-purple-300 dark:hover:border-purple-700',
      },
      emerald: {
        bg: 'bg-green-100 dark:bg-green-900/20',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
        hover: 'hover:border-green-300 dark:hover:border-green-700',
      },
      cyan: {
        bg: 'bg-cyan-100 dark:bg-cyan-900/20',
        text: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-200 dark:border-cyan-800',
        hover: 'hover:border-cyan-300 dark:hover:border-cyan-700',
      },
      amber: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
        hover: 'hover:border-yellow-300 dark:hover:border-yellow-700',
      },
      rose: {
        bg: 'bg-rose-100 dark:bg-rose-900/20',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800',
        hover: 'hover:border-rose-300 dark:hover:border-rose-700',
      },
      teal: {
        bg: 'bg-teal-100 dark:bg-teal-900/20',
        text: 'text-teal-600 dark:text-teal-400',
        border: 'border-teal-200 dark:border-teal-800',
        hover: 'hover:border-teal-300 dark:hover:border-teal-700',
      },
      violet: {
        bg: 'bg-violet-100 dark:bg-violet-900/20',
        text: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-200 dark:border-violet-800',
        hover: 'hover:border-violet-300 dark:hover:border-violet-700',
      },
    }
    return colors[color] || colors.indigo
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Documentation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Everything you need to know about using Trapid
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documentation..."
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Documentation Sections */}
      {filteredSections.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Results Found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try different keywords or browse all sections
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSections.map((section) => {
            const isExpanded = expandedSection === section.id
            const colorClasses = getColorClasses(section.color)
            const IconComponent = section.icon

            return (
              <div
                key={section.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${colorClasses.border} ${colorClasses.hover} overflow-hidden transition-all`}
              >
                {/* Section Header */}
                <button
                  onClick={() => handleToggleSection(section.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colorClasses.bg} flex items-center justify-center`}>
                      <IconComponent className={`h-6 w-6 ${colorClasses.text}`} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {section.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {section.content.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-6 bg-gray-50 dark:bg-gray-900/50">
                    <div className="space-y-6">
                      {section.content.subsections.map((subsection, idx) => (
                        <div key={idx}>
                          <h5 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                            {subsection.title}
                          </h5>
                          <ul className="space-y-2">
                            {subsection.content.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${colorClasses.bg} mt-2`}></div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                  {item}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Help Footer */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${getColorClasses('indigo').bg} flex items-center justify-center`}>
            <QuestionMarkCircleIcon className={`h-6 w-6 ${getColorClasses('indigo').text}`} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Still Need Help?
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              If you can't find what you're looking for in the documentation, we're here to help.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="mailto:support@trapid.com"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                Contact Support
              </a>
              <span className="text-gray-400">•</span>
              <button
                onClick={() => {
                  const event = new CustomEvent('openSetupGuide')
                  window.dispatchEvent(event)
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                View Setup Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
