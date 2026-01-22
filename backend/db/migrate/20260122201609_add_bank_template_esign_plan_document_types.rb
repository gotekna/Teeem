# Add document types for models that bypass StorageBlob
# These store files directly in SharePoint/S3 and need warehouse visibility
class AddBankTemplateEsignPlanDocumentTypes < ActiveRecord::Migration[7.1]
  def up
    # Get default tenant for single-tenant app
    tenant = Tenant.first
    return unless tenant

    # ════════════════════════════════════════════════════════════════════════════════
    # BANK STATEMENT DOCUMENT TYPES
    # For: bank_statement_report (ATO compliance bank statement PDFs)
    # Path: Corporate/{CompanyGroup}/{CompanyCode}/XERO/Bank
    # ════════════════════════════════════════════════════════════════════════════════
    bank_types = [
      {
        name: 'Bank Statement Report',
        abbreviation: 'XBS',
        folder: 'Bank',
        description: 'Generated bank statement PDF for ATO compliance',
        scope: 'bank_statement',
        retention_years: 7,
        file_extensions: %w[pdf]
      }
    ]

    # ════════════════════════════════════════════════════════════════════════════════
    # DOCUMENT TEMPLATE TYPES
    # For: document_template (HTML templates, PDF overlays)
    # ════════════════════════════════════════════════════════════════════════════════
    template_types = [
      {
        name: 'HTML Template',
        abbreviation: 'TMPL',
        folder: 'Templates',
        description: 'HTML document template for generating PDFs',
        scope: 'template',
        file_extensions: %w[html]
      },
      {
        name: 'PDF Overlay Template',
        abbreviation: 'OVERLAY',
        folder: 'Templates',
        description: 'PDF template with form fields for overlay',
        scope: 'template',
        file_extensions: %w[pdf]
      },
      {
        name: 'Contract Template',
        abbreviation: 'CONTRACT',
        folder: 'Templates',
        description: 'QBCC/HIA contract template',
        scope: 'template',
        file_extensions: %w[pdf]
      }
    ]

    # ════════════════════════════════════════════════════════════════════════════════
    # E-SIGNATURE DOCUMENT TYPES
    # For: e_signature_request (DocuSign envelopes, signed documents)
    # ════════════════════════════════════════════════════════════════════════════════
    esign_types = [
      {
        name: 'Unsigned Document',
        abbreviation: 'UNSIGN',
        folder: 'Pending',
        description: 'Document awaiting e-signature',
        scope: 'esignature',
        file_extensions: %w[pdf]
      },
      {
        name: 'Signed Document',
        abbreviation: 'SIGNED',
        folder: 'Completed',
        description: 'Electronically signed document',
        scope: 'esignature',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Signature Certificate',
        abbreviation: 'CERT',
        folder: 'Certificates',
        description: 'Certificate of completion from e-signature provider',
        scope: 'esignature',
        retention_years: 10,
        file_extensions: %w[pdf]
      }
    ]

    # ════════════════════════════════════════════════════════════════════════════════
    # CONSTRUCTION PLAN DOCUMENT TYPES
    # For: job_plan_revision, plan_folder_scan (construction drawings)
    # Path: Jobs/{JobCode}/Plans
    # ════════════════════════════════════════════════════════════════════════════════
    plan_types = [
      {
        name: 'Construction Plan',
        abbreviation: 'PLAN',
        folder: 'Plans',
        description: 'Construction drawing/plan PDF',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf]
      },
      {
        name: 'Architectural Drawing',
        abbreviation: 'ARCH',
        folder: 'Plans',
        description: 'Architectural floor plan or elevation',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Structural Drawing',
        abbreviation: 'STRUCT',
        folder: 'Plans',
        description: 'Structural engineering drawing',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Electrical Plan',
        abbreviation: 'ELEC',
        folder: 'Plans',
        description: 'Electrical layout and wiring plan',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Plumbing Plan',
        abbreviation: 'PLUMB',
        folder: 'Plans',
        description: 'Plumbing and drainage plan',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Site Plan',
        abbreviation: 'SITE',
        folder: 'Plans',
        description: 'Site layout and setback plan',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf dwg]
      },
      {
        name: 'Combined Plans',
        abbreviation: 'ALL',
        folder: 'Plans',
        description: 'Combined multi-page plan set',
        scope: 'plan',
        retention_years: 10,
        file_extensions: %w[pdf]
      }
    ]

    # Create all document types
    (bank_types + template_types + esign_types + plan_types).each do |attrs|
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

    Rails.logger.info "[Migration] Created #{bank_types.size} bank statement document types"
    Rails.logger.info "[Migration] Created #{template_types.size} template document types"
    Rails.logger.info "[Migration] Created #{esign_types.size} e-signature document types"
    Rails.logger.info "[Migration] Created #{plan_types.size} plan document types"
  end

  def down
    # Remove the document types we created
    DocumentType.where(scope: %w[bank_statement template esignature plan]).destroy_all
  end
end
