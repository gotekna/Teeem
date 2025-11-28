import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Accounting system badge configurations
const ACCOUNTING_SYSTEMS = {
  xero: {
    name: 'Xero',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500'
  },
  quickbooks: {
    name: 'QuickBooks',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500'
  },
  myob: {
    name: 'MYOB',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500'
  }
}

const getBadgeColorClass = (badgeColor) => {
  const colorMap = {
    blue: ACCOUNTING_SYSTEMS.xero.color,
    green: ACCOUNTING_SYSTEMS.quickbooks.color,
    purple: ACCOUNTING_SYSTEMS.myob.color
  }
  return colorMap[badgeColor] || ACCOUNTING_SYSTEMS.xero.color
}

export default function XeroSyncTab({ contact, onContactUpdate }) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [xeroInvoices, setXeroInvoices] = useState([])
  const [xeroCreditNotes, setXeroCreditNotes] = useState([])
  const [xeroPayments, setXeroPayments] = useState([])
  const [xeroQuotes, setXeroQuotes] = useState([])
  const [contactPersons, setContactPersons] = useState([])
  const [contactGroups, setContactGroups] = useState([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState(null)
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [deleteOriginal, setDeleteOriginal] = useState(false)

  // Multi-Xero support
  const [xeroLinks, setXeroLinks] = useState([])
  const [selectedLinkId, setSelectedLinkId] = useState(null)
  const [loadingLinks, setLoadingLinks] = useState(true)

  // Available Xero tenants (organizations) to link to
  const [availableTenants, setAvailableTenants] = useState([])
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [linkingToTenant, setLinkingToTenant] = useState(null)

  // Xero contact data (fetched from Xero API)
  const [xeroContactData, setXeroContactData] = useState(null)
  const [loadingXeroContact, setLoadingXeroContact] = useState(false)

  // Collapsible sections state - track which sections are expanded
  const [expandedSections, setExpandedSections] = useState({})

  // Xero-synced accounting fields that are READ-ONLY in TEEEM
  // These fields can only be updated via Xero sync, not manual edits
  const XERO_READ_ONLY_FIELDS = [
    'accounts_payable_outstanding',
    'accounts_payable_overdue',
    'accounts_receivable_outstanding',
    'accounts_receivable_overdue',
    'bank_bsb',
    'bank_account_number',
    'bank_account_name',
    'default_purchase_account',
    'default_sales_account',
    'bill_due_day',
    'bill_due_type',
    'sales_due_day',
    'sales_due_type',
    'default_discount',
    'xero_account_number',
    'xero_contact_number',
    'xero_contact_status',
    'company_number'
  ]

  // Helper to check if a field is read-only
  const isReadOnlyField = (fieldName) => XERO_READ_ONLY_FIELDS.includes(fieldName)

  // Helper to format an address object into a single string
  const formatAddress = (addr) => {
    if (!addr) return '-'
    const parts = [
      addr.line1,
      addr.line2,
      addr.line3,
      addr.line4,
      addr.city,
      addr.region,
      addr.postal_code,
      addr.country
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  // Helper to format Xero address from API response
  const formatXeroAddress = (addresses, type) => {
    if (!addresses || !Array.isArray(addresses)) return '-'
    const addr = addresses.find(a => a.AddressType === type)
    if (!addr) return '-'
    const parts = [
      addr.AddressLine1,
      addr.AddressLine2,
      addr.AddressLine3,
      addr.AddressLine4,
      addr.City,
      addr.Region,
      addr.PostalCode,
      addr.Country
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  // Toggle a single section's expanded state
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }))
  }

  // Check if a section is expanded (default to expanded)
  const isSectionExpanded = (sectionName) => {
    return expandedSections[sectionName] !== false // Default to true (expanded)
  }

  // Expand all sections
  const expandAllSections = () => {
    const allExpanded = {}
    fieldMappings.forEach(section => {
      allExpanded[section.section] = true
    })
    setExpandedSections(allExpanded)
  }

  // Collapse all sections
  const collapseAllSections = () => {
    const allCollapsed = {}
    fieldMappings.forEach(section => {
      allCollapsed[section.section] = false
    })
    setExpandedSections(allCollapsed)
  }

  // Helper to get Xero address by type
  const getXeroAddress = (type) => {
    if (!xeroContactData?.Addresses) return null
    return xeroContactData.Addresses.find(a => a.AddressType === type)
  }

  // Helper to check if Xero address has data
  const xeroAddressHasData = (type) => {
    const addr = getXeroAddress(type)
    if (!addr) return false
    return addr.AddressLine1 || addr.City
  }

  // Helper to determine sync status for address fields
  const getAddressSyncStatus = (type) => {
    const teeemAddr = contact?.contact_addresses?.find(a => a.address_type === type)
    const xeroHasData = xeroAddressHasData(type)

    if (teeemAddr && (teeemAddr.line1 || teeemAddr.city)) return 'synced'
    if (xeroHasData) return 'synced' // Will sync when user clicks sync
    return 'empty_in_xero'
  }

  // Sync direction types:
  // 'xero_to_teeem' = Xero is source of truth, pulls from Xero only
  // 'teeem_to_xero' = TEEEM is source of truth, pushes to Xero only (not yet implemented)
  // 'bidirectional' = Two-way sync, TEEEM wins conflicts
  // 'teeem_wins' = Two-way sync, but only pulls from Xero if TEEEM is empty
  // 'none' = Display only, not synced

  // Define the field mappings between Xero and TEEEM
  const fieldMappings = [
    {
      section: 'Basic Information',
      fields: [
        { xeroField: 'Name', teeemField: 'full_name', value: contact?.full_name, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'FirstName', teeemField: 'first_name', value: contact?.first_name, syncStatus: contact?.first_name ? 'synced' : 'empty_in_xero', syncDirection: 'xero_to_teeem' },
        { xeroField: 'LastName', teeemField: 'last_name', value: contact?.last_name, syncStatus: contact?.last_name ? 'synced' : 'empty_in_xero', syncDirection: 'xero_to_teeem' },
        { xeroField: 'EmailAddress', teeemField: 'email', value: contact?.email, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'IsSupplier/IsCustomer', teeemField: 'contact_types', value: contact?.contact_types?.length > 0 ? contact.contact_types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : '-', syncStatus: contact?.contact_types?.length > 0 ? 'synced' : 'empty_in_xero', syncDirection: 'xero_to_teeem' },
        { xeroField: 'ContactID', teeemField: 'xero_id', value: contact?.xero_id, syncStatus: contact?.xero_id ? 'synced' : 'not_linked', syncDirection: 'xero_to_teeem' }
      ]
    },
    {
      section: 'Contact Details',
      fields: [
        { xeroField: 'PhoneNumber (Mobile)', teeemField: 'mobile_phone', value: contact?.mobile_phone, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'PhoneNumber (Office)', teeemField: 'office_phone', value: contact?.office_phone, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'PhoneNumber (Fax)', teeemField: 'fax_phone', value: contact?.fax_phone, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Website', teeemField: 'website', value: contact?.website, syncStatus: 'synced', syncDirection: 'xero_to_teeem' }
      ]
    },
    {
      section: 'Addresses',
      fields: [
        { xeroField: 'Address (STREET)', teeemField: 'contact_addresses', value: contact?.contact_addresses?.find(a => a.address_type === 'STREET') ? formatAddress(contact.contact_addresses.find(a => a.address_type === 'STREET')) : '-', syncStatus: getAddressSyncStatus('STREET'), syncDirection: 'teeem_wins' },
        { xeroField: 'Address (POBOX)', teeemField: 'contact_addresses', value: contact?.contact_addresses?.find(a => a.address_type === 'POBOX') ? formatAddress(contact.contact_addresses.find(a => a.address_type === 'POBOX')) : '-', syncStatus: getAddressSyncStatus('POBOX'), syncDirection: 'teeem_wins' },
        { xeroField: 'Address (DELIVERY)', teeemField: 'contact_addresses', value: contact?.contact_addresses?.find(a => a.address_type === 'DELIVERY') ? formatAddress(contact.contact_addresses.find(a => a.address_type === 'DELIVERY')) : '-', syncStatus: getAddressSyncStatus('DELIVERY'), syncDirection: 'teeem_wins' }
      ]
    },
    {
      section: 'Tax & Registration',
      readOnly: true,
      readOnlyMessage: 'Synced from Xero - edit in Xero to update',
      fields: [
        { xeroField: 'TaxNumber', teeemField: 'tax_number', value: contact?.tax_number, syncStatus: 'synced', syncDirection: 'xero_to_teeem' },
        { xeroField: 'AccountNumber', teeemField: 'xero_account_number', value: contact?.xero_account_number, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'ContactNumber', teeemField: 'xero_contact_number', value: contact?.xero_contact_number, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'ContactStatus', teeemField: 'xero_contact_status', value: contact?.xero_contact_status, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'CompanyNumber', teeemField: 'company_number', value: contact?.company_number, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' }
      ]
    },
    {
      section: 'Purchase (Accounts Payable)',
      readOnly: true,
      readOnlyMessage: 'Synced from Xero - edit in Xero to update',
      fields: [
        { xeroField: 'DefaultPurchaseAccount', teeemField: 'default_purchase_account', value: contact?.default_purchase_account, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'PurchaseTerms (Days)', teeemField: 'bill_due_day', value: contact?.bill_due_day, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'PurchaseTerms (Type)', teeemField: 'bill_due_type', value: contact?.bill_due_type, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'AccountsPayable Outstanding', teeemField: 'accounts_payable_outstanding', value: contact?.accounts_payable_outstanding, syncStatus: 'read_only', syncDirection: 'xero_to_teeem', type: 'currency' },
        { xeroField: 'AccountsPayable Overdue', teeemField: 'accounts_payable_overdue', value: contact?.accounts_payable_overdue, syncStatus: 'read_only', syncDirection: 'xero_to_teeem', type: 'currency' }
      ]
    },
    {
      section: 'Sales (Accounts Receivable)',
      readOnly: true,
      readOnlyMessage: 'Synced from Xero - edit in Xero to update',
      fields: [
        { xeroField: 'DefaultSalesAccount', teeemField: 'default_sales_account', value: contact?.default_sales_account, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'DefaultDiscount', teeemField: 'default_discount', value: contact?.default_discount, syncStatus: 'read_only', syncDirection: 'xero_to_teeem', type: 'percentage' },
        { xeroField: 'SalesTerms (Days)', teeemField: 'sales_due_day', value: contact?.sales_due_day, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'SalesTerms (Type)', teeemField: 'sales_due_type', value: contact?.sales_due_type, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'AccountsReceivable Outstanding', teeemField: 'accounts_receivable_outstanding', value: contact?.accounts_receivable_outstanding, syncStatus: 'read_only', syncDirection: 'xero_to_teeem', type: 'currency' },
        { xeroField: 'AccountsReceivable Overdue', teeemField: 'accounts_receivable_overdue', value: contact?.accounts_receivable_overdue, syncStatus: 'read_only', syncDirection: 'xero_to_teeem', type: 'currency' }
      ]
    },
    {
      section: 'Bank Details',
      readOnly: true,
      readOnlyMessage: 'Synced from Xero - edit in Xero to update',
      fields: [
        { xeroField: 'BankAccountBSB', teeemField: 'bank_bsb', value: contact?.bank_bsb, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'BankAccountNumber', teeemField: 'bank_account_number', value: contact?.bank_account_number, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' },
        { xeroField: 'BankAccountName', teeemField: 'bank_account_name', value: contact?.bank_account_name, syncStatus: 'read_only', syncDirection: 'xero_to_teeem' }
      ]
    },
    {
      section: 'Sync Status',
      fields: [
        { xeroField: 'SyncEnabled', teeemField: 'sync_with_xero', value: contact?.sync_with_xero ? 'Yes' : 'No', syncStatus: contact?.sync_with_xero ? 'enabled' : 'disabled', syncDirection: 'none' },
        { xeroField: 'LastSyncedAt', teeemField: 'last_synced_at', value: contact?.last_synced_at ? new Date(contact.last_synced_at).toLocaleString() : 'Never', syncStatus: contact?.last_synced_at ? 'synced' : 'never', syncDirection: 'none' },
        { xeroField: 'SyncError', teeemField: 'xero_sync_error', value: contact?.xero_sync_error || 'None', syncStatus: contact?.xero_sync_error ? 'error' : 'ok', syncDirection: 'none' }
      ]
    }
  ]

  // Helper to get sync direction display
  const getSyncDirectionLabel = (direction) => {
    switch (direction) {
      case 'xero_to_teeem': return 'Xero → TEEEM'
      case 'teeem_to_xero': return 'TEEEM → Xero'
      case 'bidirectional': return 'Two-way'
      case 'teeem_wins': return 'TEEEM wins'
      case 'none': return '-'
      default: return '-'
    }
  }

  const getSyncDirectionTooltip = (direction) => {
    switch (direction) {
      case 'xero_to_teeem': return 'Data flows from Xero to TEEEM only'
      case 'teeem_to_xero': return 'Data flows from TEEEM to Xero only'
      case 'bidirectional': return 'Data syncs both ways'
      case 'teeem_wins': return 'Pulls from Xero only if TEEEM is empty'
      case 'none': return 'Not synced'
      default: return ''
    }
  }

  // Load xero links when component mounts
  useEffect(() => {
    if (contact?.id) {
      loadXeroLinks()
    }
  }, [contact?.id])

  // Load transactions when xero links change or a link is selected
  useEffect(() => {
    if (contact?.id && contact['is_supplier?']) {
      loadTransactions()
    }
  }, [contact?.id, selectedLinkId])

  // Load Xero contact data when links change
  useEffect(() => {
    if (contact?.id && xeroLinks.length > 0) {
      loadXeroContactData()
    }
  }, [contact?.id, selectedLinkId, xeroLinks.length])

  const loadXeroLinks = async () => {
    setLoadingLinks(true)
    try {
      const response = await api.get(`/api/v1/contacts/${contact.id}/xero_links`)
      if (response.success) {
        const links = response.xero_links || []
        setXeroLinks(links)
        // Auto-select the first link if none selected
        if (links.length > 0 && !selectedLinkId) {
          setSelectedLinkId(links[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load Xero links:', err)
    } finally {
      setLoadingLinks(false)
    }
  }

  // Get the currently selected Xero link
  const selectedLink = xeroLinks.find(l => l.id === selectedLinkId)

  // Load available Xero tenants (organizations)
  const loadAvailableTenants = async () => {
    setLoadingTenants(true)
    try {
      const response = await api.get('/api/v1/xero/tenants')
      if (response.success) {
        setAvailableTenants(response.tenants || [])
      }
    } catch (err) {
      console.error('Failed to load Xero tenants:', err)
    } finally {
      setLoadingTenants(false)
    }
  }

  // Link contact to a Xero organization
  const handleLinkToTenant = async (tenantId, tenantName) => {
    setLinkingToTenant(tenantId)
    try {
      const response = await api.post(`/api/v1/contacts/${contact.id}/xero_links`, {
        xero_link: {
          xero_tenant_id: tenantId,
          xero_tenant_name: tenantName,
          sync_enabled: true,
          sync_direction: 'bidirectional'
        }
      })
      if (response.success) {
        // Reload links
        await loadXeroLinks()
      } else {
        setSyncError(response.error || 'Failed to link to Xero')
      }
    } catch (err) {
      setSyncError(err.message || 'Failed to link to Xero')
    } finally {
      setLinkingToTenant(null)
    }
  }

  // Load available tenants on mount
  useEffect(() => {
    loadAvailableTenants()
  }, [])

  const loadTransactions = async () => {
    setLoadingTransactions(true)
    setTransactionsError(null)

    try {
      // Fetch Purchase Orders from TEEEM
      const poResponse = await api.get(`/api/v1/purchase_orders?supplier_id=${contact.id}`)
      if (poResponse.success) {
        setPurchaseOrders(poResponse.purchase_orders || [])
      }

      // Fetch Contact Persons from TEEEM
      const personsResponse = await api.get(`/api/v1/contacts/${contact.id}/contact_persons`)
      if (personsResponse.success) {
        setContactPersons(personsResponse.contact_persons || [])
      }

      // Fetch Contact Groups from TEEEM
      const groupsResponse = await api.get(`/api/v1/contacts/${contact.id}/contact_groups`)
      if (groupsResponse.success) {
        setContactGroups(groupsResponse.contact_groups || [])
      }

      // Fetch Xero data if a link is selected
      const xeroContactId = selectedLink?.xero_contact_id
      const xeroTenantId = selectedLink?.xero_tenant_id

      if (xeroContactId) {
        // Build tenant query param if available
        const tenantParam = xeroTenantId ? `&tenant_id=${xeroTenantId}` : ''

        // Invoices
        const invoicesResponse = await api.get(`/api/v1/xero/invoices?contact_id=${xeroContactId}${tenantParam}`)
        if (invoicesResponse.success) {
          setXeroInvoices(invoicesResponse.data?.invoices || [])
        }

        // Credit Notes
        try {
          const creditNotesResponse = await api.get(`/api/v1/xero/credit_notes?contact_id=${xeroContactId}${tenantParam}`)
          if (creditNotesResponse.success) {
            setXeroCreditNotes(creditNotesResponse.data?.credit_notes || [])
          }
        } catch (e) {
          console.log('Credit Notes endpoint not available yet')
        }

        // Payments
        try {
          const paymentsResponse = await api.get(`/api/v1/xero/payments?contact_id=${xeroContactId}${tenantParam}`)
          if (paymentsResponse.success) {
            setXeroPayments(paymentsResponse.data?.payments || [])
          }
        } catch (e) {
          console.log('Payments endpoint not available yet')
        }

        // Quotes
        try {
          const quotesResponse = await api.get(`/api/v1/xero/quotes?contact_id=${xeroContactId}${tenantParam}`)
          if (quotesResponse.success) {
            setXeroQuotes(quotesResponse.data?.quotes || [])
          }
        } catch (e) {
          console.log('Quotes endpoint not available yet')
        }
      } else {
        // No Xero link - clear Xero data
        setXeroInvoices([])
        setXeroCreditNotes([])
        setXeroPayments([])
        setXeroQuotes([])
      }
    } catch (error) {
      setTransactionsError(error.message || 'Failed to load transactions')
    } finally {
      setLoadingTransactions(false)
    }
  }

  // Fetch raw Xero contact data to show what Xero has
  const loadXeroContactData = async () => {
    const selectedLink = xeroLinks.find(l => l.id === selectedLinkId)
    const xeroContactId = selectedLink?.xero_contact_id
    const xeroTenantId = selectedLink?.xero_tenant_id

    if (!xeroContactId) {
      setXeroContactData(null)
      return
    }

    try {
      setLoadingXeroContact(true)
      const tenantParam = xeroTenantId ? `?tenant_id=${xeroTenantId}` : ''
      const response = await api.get(`/api/v1/xero/contacts/${xeroContactId}${tenantParam}`)
      if (response.success && response.data?.contact) {
        setXeroContactData(response.data.contact)
      }
    } catch (error) {
      console.log('Could not fetch Xero contact data:', error.message)
      setXeroContactData(null)
    } finally {
      setLoadingXeroContact(false)
    }
  }

  // Helper to get value from Xero contact data
  const getXeroValue = (xeroFieldName) => {
    if (!xeroContactData || loadingXeroContact) return loadingXeroContact ? '...' : '-'

    // Map our xeroField names to actual Xero API field names
    const fieldMap = {
      'Name': xeroContactData.Name,
      'FirstName': xeroContactData.FirstName,
      'LastName': xeroContactData.LastName,
      'EmailAddress': xeroContactData.EmailAddress,
      'IsSupplier/IsCustomer': xeroContactData.IsSupplier ? 'Supplier' : (xeroContactData.IsCustomer ? 'Customer' : '-'),
      'ContactID': xeroContactData.ContactID,
      'PhoneNumber (Mobile)': xeroContactData.Phones?.find(p => p.PhoneType === 'MOBILE')?.PhoneNumber,
      'PhoneNumber (Office)': xeroContactData.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
      'PhoneNumber (Fax)': xeroContactData.Phones?.find(p => p.PhoneType === 'FAX')?.PhoneNumber,
      'Website': xeroContactData.Website,
      'TaxNumber': xeroContactData.TaxNumber,
      'AccountNumber': xeroContactData.AccountNumber,
      'ContactNumber': xeroContactData.ContactNumber,
      'ContactStatus': xeroContactData.ContactStatus,
      'CompanyNumber': xeroContactData.CompanyNumber,
      'DefaultPurchaseAccount': xeroContactData.PurchasesDefaultAccountCode,
      'PurchaseTerms (Days)': xeroContactData.PaymentTerms?.Bills?.Day,
      'PurchaseTerms (Type)': xeroContactData.PaymentTerms?.Bills?.Type,
      'AccountsPayable Outstanding': xeroContactData.Balances?.AccountsPayable?.Outstanding,
      'AccountsPayable Overdue': xeroContactData.Balances?.AccountsPayable?.Overdue,
      'DefaultSalesAccount': xeroContactData.SalesDefaultAccountCode,
      'DefaultDiscount': xeroContactData.Discount,
      'SalesTerms (Days)': xeroContactData.PaymentTerms?.Sales?.Day,
      'SalesTerms (Type)': xeroContactData.PaymentTerms?.Sales?.Type,
      'AccountsReceivable Outstanding': xeroContactData.Balances?.AccountsReceivable?.Outstanding,
      'AccountsReceivable Overdue': xeroContactData.Balances?.AccountsReceivable?.Overdue,
      'BankAccountBSB': xeroContactData.BankAccountDetails?.split(' ')[0],
      'BankAccountNumber': xeroContactData.BankAccountDetails?.split(' ').slice(1).join(' '),
      'BankAccountName': null, // Xero doesn't store this separately
      // Address fields
      'Address (STREET)': formatXeroAddress(xeroContactData.Addresses, 'STREET'),
      'Address (POBOX)': formatXeroAddress(xeroContactData.Addresses, 'POBOX'),
      'Address (DELIVERY)': formatXeroAddress(xeroContactData.Addresses, 'DELIVERY'),
    }

    const value = fieldMap[xeroFieldName]
    if (value === undefined || value === null || value === '') return '-'
    return value
  }

  const formatValue = (field) => {
    if (!field.value && field.value !== 0) return '-'
    if (field.type === 'currency') {
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(field.value)
    }
    if (field.type === 'percentage') {
      return `${field.value}%`
    }
    return field.value
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-AU')
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'synced':
      case 'enabled':
      case 'ok':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'empty_in_xero':
        // Empty circle/dash icon for fields that exist but are empty in Xero
        return (
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M8 12h8" />
          </svg>
        )
      case 'not_linked':
      case 'disabled':
      case 'never':
        return <XCircleIcon className="h-5 w-5 text-gray-400" />
      case 'read_only':
        // Lock icon for read-only fields
        return (
          <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )
      case 'xero_only':
        // Eye icon for view-only from Xero (not synced to TEEEM)
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <XCircleIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'synced': return 'Synced'
      case 'not_linked': return 'Not Linked'
      case 'empty_in_xero': return 'No Data'
      case 'read_only': return 'Read Only'
      case 'xero_only': return 'View Only'
      case 'enabled': return 'Enabled'
      case 'disabled': return 'Disabled'
      case 'never': return 'Never Synced'
      case 'ok': return 'OK'
      case 'error': return 'Error'
      case 'failed': return 'Failed'
      default: return 'Unknown'
    }
  }

  const handleSync = async () => {
    // Check if we have a link to sync
    const xeroContactId = selectedLink?.xero_contact_id
    if (!xeroContactId) {
      setSyncError('Contact must be linked to Xero first')
      return
    }

    setSyncing(true)
    setSyncError(null)

    try {
      const response = await api.post(`/api/v1/contacts/${contact.id}/sync_from_xero`)
      if (response.success) {
        onContactUpdate(response.contact)
      } else {
        setSyncError(response.error || 'Sync failed')
      }
    } catch (error) {
      setSyncError(error.message || 'Failed to sync with Xero')
    } finally {
      setSyncing(false)
    }
  }

  const handleChangeToSoleTrader = async () => {
    if (!confirm('Change this contact from Person to Sole Trader (Company)?\n\nThis will:\n1. Update entity_type to "company"\n2. Create a ContactPerson record with the same details\n3. Mark as primary contact\n\nThis matches Xero\'s model where sole traders are companies with a primary contact person.')) {
      return
    }

    setConverting(true)
    setConvertError(null)

    try {
      // Step 1: Update entity_type to 'company'
      const response = await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: {
          entity_type: 'company'
        }
      })

      if (response.success) {
        // Step 2: Create ContactPerson with same details
        const contactPersonResponse = await api.post(`/api/v1/contacts/${contact.id}/contact_persons`, {
          contact_person: {
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            email: contact.email || '',
            phone: contact.mobile_phone || contact.office_phone || '',
            position: contact.position || 'Owner',
            primary_contact: true
          }
        })

        if (contactPersonResponse.success) {
          onContactUpdate(response.contact)
          alert('✅ Contact converted to Sole Trader successfully!\n\n• Entity type changed to Company\n• Primary contact person created\n• Ready to link with Xero')
        } else {
          setConvertError('Contact converted but failed to create primary contact person')
        }
      } else {
        setConvertError(response.error || 'Failed to convert contact')
      }
    } catch (error) {
      setConvertError(error.message || 'Failed to convert contact')
    } finally {
      setConverting(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const response = await api.get('/api/v1/contacts?entity_type=company&limit=100')
      if (response.success) {
        setCompanies(response.contacts || [])
      }
    } catch (error) {
      console.error('Failed to load companies:', error)
    }
  }

  const handleConvertToContactPerson = async () => {
    if (!selectedCompanyId) {
      setConvertError('Please select a company first')
      return
    }

    setConverting(true)
    setConvertError(null)

    try {
      // Create contact person under the selected company
      const response = await api.post(`/api/v1/contacts/${selectedCompanyId}/contact_persons`, {
        contact_person: {
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          email: contact.email || '',
          phone: contact.mobile_phone || contact.office_phone || '',
          position: contact.position || ''
        }
      })

      if (response.success) {
        // If user chose to delete original, delete it
        if (deleteOriginal) {
          await api.delete(`/api/v1/contacts/${contact.id}`)
          alert('✅ Contact converted to Contact Person and original contact deleted!')
          // Navigate back to contacts table
          window.location.href = '/tables/214/contacts'
        } else {
          alert('✅ Contact Person created successfully! The original contact still exists.')
          setShowConvertModal(false)
        }
      } else {
        setConvertError(response.error || 'Failed to create contact person')
      }
    } catch (error) {
      setConvertError(error.message || 'Failed to create contact person')
    } finally {
      setConverting(false)
    }
  }

  // Determine if we have any Xero connection (only use contact_xero_links, not legacy xero_id)
  const hasXeroConnection = xeroLinks.length > 0

  return (
    <div className="py-6">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Xero Sync</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Field mappings between Xero and TEEEM
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/contacts/sync-config"
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing || !hasXeroConnection}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              hasXeroConnection
                ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Xero'}
          </button>
        </div>
      </div>

      {/* Organization Selector (if multiple links) */}
      {xeroLinks.length > 1 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            View data from organization:
          </label>
          <div className="flex flex-wrap gap-2">
            {xeroLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => setSelectedLinkId(link.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full border transition ${
                  selectedLinkId === link.id
                    ? getBadgeColorClass(link.badge_color)
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  selectedLinkId === link.id
                    ? (link.badge_color === 'blue' ? 'bg-blue-500' : link.badge_color === 'green' ? 'bg-green-500' : 'bg-purple-500')
                    : 'bg-gray-400'
                }`}></span>
                {link.xero_tenant_name || 'Unknown Organization'}
                {link.sync_error && (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                )}
                {link.has_conflicts && (
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected organization info */}
      {selectedLink && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getBadgeColorClass(selectedLink.badge_color)}`}>
                <span className={`w-2 h-2 rounded-full ${selectedLink.badge_color === 'blue' ? 'bg-blue-500' : selectedLink.badge_color === 'green' ? 'bg-green-500' : 'bg-purple-500'}`}></span>
                {selectedLink.accounting_system === 'xero' ? 'Xero' :
                 selectedLink.accounting_system === 'quickbooks' ? 'QuickBooks' :
                 selectedLink.accounting_system === 'myob' ? 'MYOB' : 'Xero'}
              </span>
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {selectedLink.xero_tenant_name}
              </span>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {selectedLink.last_synced_at
                ? `Last synced: ${new Date(selectedLink.last_synced_at).toLocaleString()}`
                : 'Never synced'}
            </div>
          </div>
          {selectedLink.sync_error && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              Error: {selectedLink.sync_error}
            </div>
          )}
        </div>
      )}

      {/* Sync Error Message */}
      {syncError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-300">{syncError}</p>
          </div>
        </div>
      )}

      {/* Entity Type Warning */}
      {contact?.entity_type === 'person' && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                ⚠️ Persons Cannot Be Linked to Xero
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                Xero only supports <strong>Company</strong> or <strong>Sole Trader</strong> contacts.
                Choose an option below to enable Xero sync:
              </p>

              {convertError && (
                <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-300">
                  {convertError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleChangeToSoleTrader}
                  disabled={converting}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {converting ? 'Converting...' : 'Change to Sole Trader'}
                </button>
                <button
                  onClick={() => {
                    setShowConvertModal(true)
                    loadCompanies()
                  }}
                  disabled={converting}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Convert to Contact Person
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Status */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {xeroLinks.length > 0 ? (
                <>
                  <span className="font-semibold">Synced with Xero</span>
                  {selectedLink && (
                    <> • {selectedLink.xero_tenant_name || 'Unknown Organization'}</>
                  )}
                </>
              ) : (
                <span className="font-semibold">Not Linked to Xero</span>
              )}
            </p>
          </div>

          {/* Dropdown to link to available Xero organizations */}
          {availableTenants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {xeroLinks.length > 0 ? 'Add to:' : 'Link to:'}
              </span>
              <select
                className="text-sm border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                value=""
                onChange={(e) => {
                  const tenant = availableTenants.find(t => t.tenant_id === e.target.value)
                  if (tenant) {
                    handleLinkToTenant(tenant.tenant_id, tenant.tenant_name)
                  }
                }}
                disabled={linkingToTenant}
              >
                <option value="">Select organization...</option>
                {availableTenants
                  .filter(t => !xeroLinks.some(l => l.xero_tenant_id === t.tenant_id))
                  .map(tenant => (
                    <option key={tenant.tenant_id} value={tenant.tenant_id}>
                      {tenant.tenant_name}
                    </option>
                  ))
                }
              </select>
              {linkingToTenant && (
                <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connection Guide */}
      <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📋 How TEEEM Connects to Xero
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🔗 Contact Fields</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Name, email, phone, tax number, bank details sync bidirectionally via <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">xero_id</code>
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📝 Purchase Orders</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                TEEEM POs link to Xero Bills/Invoices via <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">xero_invoice_id</code>. Payment status syncs from Xero.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🧾 Invoices & Bills</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                All Xero invoices for this contact are fetched via Xero API using the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">ContactID</code> filter.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">💳 Credit Notes & Payments</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Refunds, adjustments, and payment history fetched from Xero API in real-time.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">💰 Financial Balances</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                AR/AP balances (outstanding/overdue) sync from Xero's contact summary data.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">👥 Contact Persons</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                People at a company (FirstName, LastName, Email) stored in <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">contact_persons</code> table.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🏷️ Contact Groups</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Xero categories/segments stored in <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">contact_groups</code> for reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History (Purchase Orders & Invoices) */}
      {contact['is_supplier?'] && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction History
          </h3>

          {loadingTransactions ? (
            <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transactions...</span>
            </div>
          ) : transactionsError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{transactionsError}</p>
            </div>
          ) : (
            <>
              {/* TEEEM Purchase Orders */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Purchase Orders in TEEEM ({purchaseOrders.length})
                </h4>
                {purchaseOrders.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PO Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount Paid (Xero)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Xero Link</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {purchaseOrders.slice(0, 10).map((po) => (
                          <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{po.purchase_order_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                po.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                po.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(po.total)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(po.xero_amount_paid)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {po.xero_invoice_id ? (
                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckCircleIcon className="h-4 w-4" />
                                  <span className="font-mono text-xs">{po.xero_invoice_id.substring(0, 8)}...</span>
                                </span>
                              ) : (
                                <span className="text-gray-400">Not Linked</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">xero_invoice_id</code> field stores Xero Bill/Invoice ID
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(po.ordered_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {purchaseOrders.length > 10 && (
                      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Showing 10 of {purchaseOrders.length} purchase orders
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">No purchase orders found for this supplier</p>
                  </div>
                )}
              </div>

              {/* Xero Invoices */}
              {selectedLink && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Invoices in Xero ({xeroInvoices.length})
                  </h4>
                  {xeroInvoices.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount Due</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {xeroInvoices.slice(0, 10).map((invoice, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{invoice.InvoiceNumber || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{invoice.Type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.Status === 'PAID' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  invoice.Status === 'DRAFT' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {invoice.Status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.Total)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.AmountDue)}</td>
                              <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                                Fetched from Xero API via <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact.xero_id</code> filter
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(invoice.Date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {xeroInvoices.length > 10 && (
                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Showing 10 of {xeroInvoices.length} Xero invoices
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">No Xero invoices found for this contact</p>
                    </div>
                  )}
                </div>
              )}

              {/* Xero Credit Notes */}
              {selectedLink && xeroCreditNotes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Credit Notes in Xero ({xeroCreditNotes.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Credit Note Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {xeroCreditNotes.slice(0, 10).map((cn, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{cn.CreditNoteNumber || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{cn.Type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                {cn.Status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(cn.Total)}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Fetched from Xero API (Refunds/Adjustments)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(cn.Date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Xero Payments */}
              {selectedLink && xeroPayments.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Payments in Xero ({xeroPayments.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {xeroPayments.slice(0, 10).map((payment, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(payment.Date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(payment.Amount)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.Reference || '-'}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Linked to invoices via <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">InvoiceID</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contact Persons */}
              {contactPersons.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Contact Persons in TEEEM ({contactPersons.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">First Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {contactPersons.map((person, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{person.first_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{person.last_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{person.email || '-'}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Stored in <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact_persons</code> table, synced from Xero
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contact Groups */}
              {contactGroups.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Contact Groups in TEEEM ({contactGroups.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex flex-wrap gap-2">
                      {contactGroups.map((group, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                        >
                          {group.name}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                      <strong>How It Links:</strong> Groups are stored in <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact_groups</code> table, synced from Xero for categorization/reporting
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Field Mappings Header with Expand/Collapse buttons */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Field Mappings
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAllSections}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
            Expand All
          </button>
          <button
            onClick={collapseAllSections}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
            Collapse All
          </button>
        </div>
      </div>

      {/* Field Mappings Table */}
      {fieldMappings.map((section, idx) => {
        const isExpanded = isSectionExpanded(section.section)
        return (
          <div key={idx} className="mb-4">
            {/* Collapsible Section Header */}
            <button
              onClick={() => toggleSection(section.section)}
              className={`w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {section.section}
                </h3>
                {section.readOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Read Only
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({section.fields.length} fields)
                </span>
              </div>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
              <div className={`bg-white dark:bg-gray-800 rounded-b-lg shadow-sm border border-t-0 overflow-hidden ${section.readOnly ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Xero Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TEEEM Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TEEEM Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20">
                        Xero Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sync
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {section.fields.map((field, fieldIdx) => {
                      const xeroValue = getXeroValue(field.xeroField)
                      const teeemValue = formatValue(field)
                      const valuesMatch = xeroValue === teeemValue || (xeroValue === '-' && teeemValue === '-')
                      const hasMismatch = xeroValue !== '-' && teeemValue !== '-' && xeroValue !== teeemValue

                      // Determine actual sync status based on Xero connection and data
                      let actualStatus = field.syncStatus
                      if (!hasXeroConnection) {
                        // No Xero link at all
                        actualStatus = 'not_linked'
                      } else if (xeroValue === '-' && !loadingXeroContact) {
                        // Has Xero link but no data from Xero for this field
                        actualStatus = 'empty_in_xero'
                      } else if (hasXeroConnection && xeroValue !== '-') {
                        // Has data from Xero - it's synced
                        actualStatus = 'synced'
                      }

                      // For display: show "No Data" instead of "-" when Xero has no value
                      const displayXeroValue = (xeroValue === '-' && hasXeroConnection && !loadingXeroContact) ? 'No Data' : xeroValue

                      return (
                        <tr key={fieldIdx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${hasMismatch ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {field.xeroField}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {field.teeemField}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {teeemValue}
                          </td>
                          <td className={`px-6 py-4 text-sm bg-blue-50 dark:bg-blue-900/20 ${hasMismatch ? 'text-yellow-700 dark:text-yellow-300 font-medium' : displayXeroValue === 'No Data' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-blue-700 dark:text-blue-300'}`}>
                            {displayXeroValue}
                            {hasMismatch && <span className="ml-2 text-yellow-500">⚠</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(actualStatus)}
                              <span className="text-gray-700 dark:text-gray-300">
                                {getStatusLabel(actualStatus)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {field.syncStatus === 'read_only' ? (
                              // Read-only fields are locked to Xero → TEEEM
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
                                title="Read-only field - can only sync from Xero to TEEEM"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Xero → TEEEM
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  field.syncDirection === 'xero_to_teeem' ? 'text-blue-600 dark:text-blue-400' :
                                  field.syncDirection === 'teeem_to_xero' ? 'text-green-600 dark:text-green-400' :
                                  field.syncDirection === 'bidirectional' ? 'text-purple-600 dark:text-purple-400' :
                                  field.syncDirection === 'teeem_wins' ? 'text-amber-600 dark:text-amber-400' :
                                  'text-gray-400 dark:text-gray-500'
                                }`}
                                title={getSyncDirectionTooltip(field.syncDirection)}
                              >
                                {getSyncDirectionLabel(field.syncDirection)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Status Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-gray-700 dark:text-gray-300">Synced</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M8 12h8" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Empty in Xero</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Not Linked</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Read Only</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">View Only (Xero)</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            <span className="text-gray-700 dark:text-gray-300">Error</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <strong>Empty in Xero</strong> = field is synced but has no data in Xero. <strong>View Only</strong> = shows Xero data but not synced to TEEEM. <strong>Read Only</strong> = synced from Xero - edit in Xero to update.
        </p>
      </div>

      {/* Sync Direction Legend */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Sync Direction Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Xero → TEEEM</span>
            <span className="text-gray-500 dark:text-gray-400">- Data flows from Xero to TEEEM only</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-green-600 dark:text-green-400">TEEEM → Xero</span>
            <span className="text-gray-500 dark:text-gray-400">- Data flows from TEEEM to Xero only</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Two-way</span>
            <span className="text-gray-500 dark:text-gray-400">- Data syncs both directions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">TEEEM wins</span>
            <span className="text-gray-500 dark:text-gray-400">- Pulls from Xero only if TEEEM is empty</span>
          </div>
        </div>
      </div>

      {/* Convert to Contact Person Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Convert to Contact Person
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will create a new Contact Person under a company contact. The contact person can then be synced with Xero.
              </p>

              {convertError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-300">
                  {convertError}
                </div>
              )}

              {/* Data Preview */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Data to be copied:</h4>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Name: {contact?.first_name || ''} {contact?.last_name || ''}</li>
                  <li>• Email: {contact?.email || '-'}</li>
                  <li>• Phone: {contact?.mobile_phone || contact?.office_phone || '-'}</li>
                  <li>• Position: {contact?.position || '-'}</li>
                </ul>
              </div>

              {/* Company Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Company *
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a company --</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.full_name || company.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete Original Option */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteOriginal}
                    onChange={(e) => setDeleteOriginal(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Delete original person contact after conversion
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                  (Recommended if this person will only exist under a company)
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConvertModal(false)
                    setConvertError(null)
                    setSelectedCompanyId('')
                    setDeleteOriginal(false)
                  }}
                  disabled={converting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToContactPerson}
                  disabled={converting || !selectedCompanyId}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {converting ? 'Converting...' : 'Convert'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
