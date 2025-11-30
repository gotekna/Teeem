import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  PaperClipIcon,
  UserIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  HandRaisedIcon,
  PlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'
import ApprovalModal from '../components/proposals/ApprovalModal'
import ProposalAreaMapCard from '../components/proposals/ProposalAreaMapCard'

export default function EmailJobProposalsPage() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    loadProposals()
  }, [])

  const loadProposals = async () => {
    try {
      setLoading(true)
      // Get ALL proposals (not just pending - backend defaults to pending)
      const response = await api.get('/api/v1/email_job_proposals?status=')
      setProposals(response.proposals || [])
    } catch (error) {
      console.error('Failed to load proposals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId)
    setSelectedProposal(proposal)
    setShowApprovalModal(true)
  }

  const handleApproveWithEdits = async (proposalId, userEdits) => {
    try {
      setProcessing(proposalId)
      const response = await api.post(`/api/v1/email_job_proposals/${proposalId}/approve`, {
        user_edits: userEdits
      })

      if (response.success) {
        alert(`Job #${response.job.id} created successfully!`)
        setShowApprovalModal(false)
        setSelectedProposal(null)
        loadProposals()

        // Navigate to the new job
        if (response.job.id) {
          navigate(`/jobs/${response.job.id}`)
        }
      }
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      alert('Failed to approve proposal: ' + (error.response?.data?.error || error.message))
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (proposalId) => {
    const reason = prompt('Reason for rejection (optional):')
    if (reason === null) return // Cancelled

    try {
      setProcessing(proposalId)
      const response = await api.post(`/api/v1/email_job_proposals/${proposalId}/reject`, {
        rejection_reason: reason
      })

      if (response.success) {
        alert('Proposal rejected')
        loadProposals()
      }
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      alert('Failed to reject proposal: ' + (error.response?.data?.error || error.message))
    } finally {
      setProcessing(null)
    }
  }

  const handleReExtract = async (proposalId) => {
    if (!confirm('Re-extract data from email and PDFs with latest extraction logic?')) {
      return
    }

    try {
      setProcessing(proposalId)
      const response = await api.post(`/api/v1/email_job_proposals/${proposalId}/re_extract`)

      if (response.success) {
        alert(response.message || 'Proposal re-extracted successfully')
        loadProposals()
      }
    } catch (error) {
      console.error('Failed to re-extract proposal:', error)
      alert('Failed to re-extract proposal: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon, label: 'Pending Review' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, label: 'Rejected' },
      error: { color: 'bg-gray-100 text-gray-800', icon: ExclamationTriangleIcon, label: 'Error' },
    }

    const badge = badges[status] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {badge.label}
      </span>
    )
  }

  const getConfidenceBadge = (score) => {
    const percentage = Math.round(score * 100)
    let color = 'bg-gray-100 text-gray-800'

    if (percentage >= 80) color = 'bg-green-100 text-green-800'
    else if (percentage >= 60) color = 'bg-yellow-100 text-yellow-800'
    else if (percentage >= 30) color = 'bg-orange-100 text-orange-800'
    else color = 'bg-red-100 text-red-800'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        <SparklesIcon className="w-3 h-3 mr-1" />
        {percentage}% confidence
      </span>
    )
  }

  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const otherProposals = proposals.filter(p => p.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading proposals...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Email Job Proposals</h1>
          <p className="mt-2 text-sm text-gray-700">
            AI-generated job proposals from emails sent to <code className="text-xs bg-gray-100 px-2 py-1 rounded">newjob@tekna.com.au</code>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={loadProposals}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Proposals</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{proposals.length}</dd>
          </div>
        </div>
        <div className="bg-yellow-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-yellow-700 truncate">Pending Review</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-900">{pendingProposals.length}</dd>
          </div>
        </div>
        <div className="bg-green-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-green-700 truncate">Approved</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-900">
              {proposals.filter(p => p.status === 'approved').length}
            </dd>
          </div>
        </div>
        <div className="bg-red-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-red-700 truncate">Rejected/Error</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-900">
              {proposals.filter(p => p.status === 'rejected' || p.status === 'error').length}
            </dd>
          </div>
        </div>
      </div>

      {/* Pending Proposals - Show only the latest */}
      {pendingProposals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Pending Review
            {pendingProposals.length > 1 && (
              <span className="ml-2 text-sm text-gray-500">
                (showing latest of {pendingProposals.length})
              </span>
            )}
          </h2>
          <div className="space-y-4">
            <ProposalCard
              proposal={pendingProposals[0]}
              onApprove={handleApprove}
              onReject={handleReject}
              onReExtract={handleReExtract}
              processing={processing}
              getStatusBadge={getStatusBadge}
              getConfidenceBadge={getConfidenceBadge}
            />
          </div>
        </div>
      )}

      {/* Other Proposals */}
      {otherProposals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Previous Proposals</h2>
          <div className="space-y-4">
            {otherProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onReExtract={handleReExtract}
                processing={processing}
                getStatusBadge={getStatusBadge}
                getConfidenceBadge={getConfidenceBadge}
                readonly={true}
              />
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && (
        <div className="text-center mt-12">
          <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No proposals yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Forward emails to newjob@tekna.com.au to create proposals
          </p>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedProposal && (
        <ApprovalModal
          proposal={selectedProposal}
          onApprove={handleApproveWithEdits}
          onCancel={() => {
            setShowApprovalModal(false)
            setSelectedProposal(null)
          }}
          processing={processing === selectedProposal.id}
        />
      )}
    </div>
  )
}

function ProposalCard({ proposal, onApprove, onReject, onReExtract, processing, getStatusBadge, getConfidenceBadge, readonly = false }) {
  const email = proposal.email || {}
  const data = proposal.extracted_data || {}
  const customer = data.customer || {}

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900">
                {data.job_title || email.subject || 'Untitled'}
              </h3>
              {getStatusBadge(proposal.status)}
              {getConfidenceBadge(data.confidence_score || 0)}
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500 gap-4">
              <div className="flex items-center">
                <EnvelopeIcon className="w-4 h-4 mr-1" />
                From: {email.from_email}
              </div>
              <div>
                {new Date(proposal.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!readonly && proposal.status === 'pending' && (
            <div className="ml-4 flex gap-2">
              <button
                onClick={() => onReExtract(proposal.id)}
                disabled={processing === proposal.id}
                className="inline-flex items-center px-3 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Re-extract data from email and PDFs with latest extraction logic"
              >
                <ArrowPathIcon className={`w-4 h-4 mr-1 ${processing === proposal.id ? 'animate-spin' : ''}`} />
                {processing === proposal.id ? 'Re-extracting...' : 'Re-extract'}
              </button>
              <button
                onClick={() => onApprove(proposal.id)}
                disabled={processing === proposal.id}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                Approve
              </button>
              <button
                onClick={() => onReject(proposal.id)}
                disabled={processing === proposal.id}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircleIcon className={`w-4 h-4 mr-1 ${processing === proposal.id ? 'animate-spin' : ''}`} />
                {processing === proposal.id ? 'Processing...' : 'Reject'}
              </button>
            </div>
          )}
        </div>

        {/* Client Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">Client</h4>
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {customer.name ? '1' : '0'}
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Add client"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {customer.name ? (
            <div className="pl-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                    {customer.contact_exists ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Existing
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        Create New
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1 ml-6">
                    {customer.email && (
                      <div className="text-sm text-gray-600">{customer.email}</div>
                    )}
                    {customer.phone && (
                      <div className="text-sm text-gray-600">{customer.phone}</div>
                    )}
                    {customer.company && (
                      <div className="text-sm text-gray-600">{customer.company}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pl-6 text-sm text-gray-500 italic">No client detected</div>
          )}
        </div>

        {/* Job Details Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Job Details</h4>
          <div className="pl-6 space-y-1 text-sm">
            {data.property_address && (
              <div><span className="font-medium">Address:</span> {data.property_address}</div>
            )}
            {data.job_type && (
              <div><span className="font-medium">Type:</span> {data.job_type}</div>
            )}
            {data.urgency && (
              <div><span className="font-medium">Urgency:</span> {data.urgency}</div>
            )}
            {data.contract_value && (
              <div><span className="font-medium">Value:</span> ${data.contract_value.toLocaleString()}</div>
            )}
            {email.has_attachments && (
              <div className="flex items-center text-blue-600">
                <PaperClipIcon className="w-4 h-4 mr-1" />
                {email.pdf_count > 0 && email.attachment_count > email.pdf_count ? (
                  <span>{email.pdf_count} PDF{email.pdf_count !== 1 ? 's' : ''} / {email.attachment_count} total</span>
                ) : (
                  <span>{email.attachment_count || 1} attachment{email.attachment_count !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}
            {data.missing_info && data.missing_info.length > 0 && (
              <div className="text-xs text-orange-600 mt-2">
                ⚠️ Missing: {data.missing_info.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Referral Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">Referral</h4>
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {data.referral_contact ? '1' : '0'}
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Add referral"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {data.referral_contact ? (
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{data.referral_contact.name}</span>
                {data.referral_contact.contact_exists ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Existing
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    Create New
                  </span>
                )}
              </div>
              {data.referral_contact.email && (
                <div className="ml-6 text-sm text-gray-600">{data.referral_contact.email}</div>
              )}
            </div>
          ) : (
            <div className="pl-6 text-sm text-gray-500 italic">No referral assigned</div>
          )}
        </div>

        {/* External Sales Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">External Sales</h4>
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {data.external_sales?.length || 0}
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Add external sales"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {data.external_sales?.length > 0 ? (
            <div className="pl-6 space-y-3">
              {data.external_sales.map((sales, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{sales.name}</span>
                    {sales.contact_exists ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Existing
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        Create New
                      </span>
                    )}
                  </div>
                  <div className="ml-6 text-sm text-gray-600">{sales.email}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pl-6 text-sm text-gray-500 italic">No external sales assigned</div>
          )}
        </div>

        {/* Internal Sales Section */}
        {data.internal_sales && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-900">Internal Sales</h4>
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                  1
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                title="Add internal sales"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{data.internal_sales.user_name}</span>
              </div>
              <div className="ml-6 text-sm text-gray-600">{data.internal_sales.user_email}</div>
            </div>
          </div>
        )}

        {/* Area Map */}
        {(data.property_address || data.job_title) && (
          <div className="mt-4">
            <ProposalAreaMapCard
              proposalAddress={data.property_address || data.job_title}
              proposalId={proposal.id}
            />
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</h4>
            <p className="text-sm text-gray-700">{data.description}</p>
          </div>
        )}

        {/* Scope of Work */}
        {data.scope_of_work && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Scope of Work</h4>
            <p className="text-sm text-gray-700">{data.scope_of_work}</p>
          </div>
        )}

        {/* Missing Info */}
        {data.missing_info && data.missing_info.length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 className="text-xs font-medium text-yellow-800 uppercase tracking-wide mb-1">Missing Information</h4>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {data.missing_info.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            {email.has_attachments && (
              <p className="text-xs text-yellow-600 mt-2 italic">
                💡 Tip: Check attachments - address and other details may be in plans/documents
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {proposal.error_message && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
            <h4 className="text-xs font-medium text-red-800 uppercase tracking-wide mb-1">Error</h4>
            <p className="text-sm text-red-700">{proposal.error_message}</p>
          </div>
        )}

        {/* Rejection Reason */}
        {proposal.rejection_reason && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3">
            <h4 className="text-xs font-medium text-gray-800 uppercase tracking-wide mb-1">Rejection Reason</h4>
            <p className="text-sm text-gray-700">{proposal.rejection_reason}</p>
          </div>
        )}

        {/* Job Link */}
        {proposal.job_id && (
          <div className="mt-4">
            <a
              href={`/jobs/${proposal.job_id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              → View Job #{proposal.job_id}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
