# Add document types for DocumentTask (compliance) and PayNowRequest (payments)
# These document models have storage_blob but were missing from File Warehouse UI
class AddComplianceAndPaymentDocumentTypes < ActiveRecord::Migration[7.1]
  def up
    # Get default tenant for single-tenant app
    tenant = Tenant.first
    return unless tenant

    # ════════════════════════════════════════════════════════════════════════════════
    # COMPLIANCE DOCUMENT TYPES (for DocumentTask - job compliance documents)
    # Building permits, DA approvals, certifications, etc.
    # ════════════════════════════════════════════════════════════════════════════════
    compliance_types = [
      {
        name: 'Building Permit',
        abbreviation: 'BP',
        folder: 'Compliance',
        description: 'Building permit/approval from council',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Development Approval',
        abbreviation: 'DA',
        folder: 'Compliance',
        description: 'Development application approval',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Certificate of Occupancy',
        abbreviation: 'COO',
        folder: 'Compliance',
        description: 'Certificate allowing building occupancy',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Engineering Certificate',
        abbreviation: 'ENG',
        folder: 'Compliance',
        description: 'Structural/civil engineering certification',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Site Survey',
        abbreviation: 'SURVEY',
        folder: 'Compliance',
        description: 'Site survey and boundary report',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Soil Test Report',
        abbreviation: 'SOIL',
        folder: 'Compliance',
        description: 'Geotechnical/soil classification report',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Energy Rating',
        abbreviation: 'NatHERS',
        folder: 'Compliance',
        description: 'NatHERS energy rating certificate',
        scope: 'compliance',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'BASIX Certificate',
        abbreviation: 'BASIX',
        folder: 'Compliance',
        description: 'NSW BASIX sustainability certificate',
        scope: 'compliance',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'Insurance Certificate',
        abbreviation: 'INS',
        folder: 'Compliance',
        description: 'Builder/contractor insurance certificate',
        scope: 'compliance',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'Inspection Report',
        abbreviation: 'INSP',
        folder: 'Compliance',
        description: 'Building inspection/stage inspection report',
        scope: 'compliance',
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Compliance Certificate',
        abbreviation: 'COMP',
        folder: 'Compliance',
        description: 'General compliance/certification document',
        scope: 'compliance',
        retention_years: 10,
        file_extensions: %w[pdf]
      }
    ]

    # ════════════════════════════════════════════════════════════════════════════════
    # PAYMENT DOCUMENT TYPES (for PayNowRequest - subcontractor payments)
    # Invoices, proof photos, remittances
    # ════════════════════════════════════════════════════════════════════════════════
    payment_types = [
      {
        name: 'Subcontractor Invoice',
        abbreviation: 'SUBINV',
        folder: 'Invoices',
        description: 'Invoice from subcontractor for payment',
        scope: 'payment',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'Work Proof Photo',
        abbreviation: 'PROOF',
        folder: 'Proof',
        description: 'Photo evidence of completed work',
        scope: 'payment',
        file_extensions: %w[jpg jpeg png heic]
      },
      {
        name: 'Payment Remittance',
        abbreviation: 'REMIT',
        folder: 'Remittances',
        description: 'Payment remittance advice',
        scope: 'payment',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'RCTI',
        abbreviation: 'RCTI',
        folder: 'RCTI',
        description: 'Recipient Created Tax Invoice',
        scope: 'payment',
        retention_years: 7,
        file_extensions: %w[pdf]
      }
    ]

    # Create all document types
    (compliance_types + payment_types).each do |attrs|
      DocumentType.find_or_create_by!(
        tenant: tenant,
        name: attrs[:name]
      ) do |dt|
        dt.abbreviation = attrs[:abbreviation]
        dt.folder = attrs[:folder]
        dt.description = attrs[:description]
        dt.scope = attrs[:scope]
        dt.retention_years = attrs[:retention_years]
        dt.file_extensions = attrs[:file_extensions] || []
        dt.active = true
      end
    end

    Rails.logger.info "[Migration] Created #{compliance_types.size} compliance document types"
    Rails.logger.info "[Migration] Created #{payment_types.size} payment document types"
  end

  def down
    # Remove the document types we created
    DocumentType.where(scope: %w[compliance payment]).destroy_all
  end
end
