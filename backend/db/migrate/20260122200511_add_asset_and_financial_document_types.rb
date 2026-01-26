# Add document types for Assets and Financial Transactions
# These document models have storage_blob but were missing from File Warehouse UI
class AddAssetAndFinancialDocumentTypes < ActiveRecord::Migration[7.1]
  def up
    # Get default tenant for single-tenant app
    tenant = Tenant.first
    return unless tenant

    # ════════════════════════════════════════════════════════════════════════════════
    # ASSET DOCUMENT TYPES
    # For: asset_expense, asset_odometer_reading, asset_service_history
    # ════════════════════════════════════════════════════════════════════════════════
    asset_types = [
      {
        name: 'Fuel Receipt',
        abbreviation: 'FUEL',
        folder: 'Expenses',
        description: 'Fuel purchase receipts for vehicles/equipment',
        scope: 'asset',
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Repair Invoice',
        abbreviation: 'REPAIR',
        folder: 'Expenses',
        description: 'Repair and maintenance invoices',
        scope: 'asset',
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Service Record',
        abbreviation: 'SERVICE',
        folder: 'Service',
        description: 'Scheduled service and maintenance records',
        scope: 'asset',
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Registration',
        abbreviation: 'REGO',
        folder: 'Registration',
        description: 'Vehicle registration documents',
        scope: 'asset',
        retention_years: 7,
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Insurance Certificate',
        abbreviation: 'INS',
        folder: 'Insurance',
        description: 'Asset insurance certificates and policies',
        scope: 'asset',
        retention_years: 7,
        file_extensions: %w[pdf]
      },
      {
        name: 'Odometer Reading',
        abbreviation: 'ODO',
        folder: 'Readings',
        description: 'Odometer/hour meter photos for tracking',
        scope: 'asset',
        file_extensions: %w[jpg jpeg png]
      },
      {
        name: 'Asset Photo',
        abbreviation: 'PHOTO',
        folder: 'Photos',
        description: 'General asset photos (condition, damage, etc.)',
        scope: 'asset',
        file_extensions: %w[jpg jpeg png heic]
      },
      {
        name: 'Purchase Invoice',
        abbreviation: 'PURCHASE',
        folder: 'Purchase',
        description: 'Original asset purchase invoice/receipt',
        scope: 'asset',
        retention_years: 7,
        file_extensions: %w[pdf]
      }
    ]

    # ════════════════════════════════════════════════════════════════════════════════
    # FINANCIAL DOCUMENT TYPES
    # For: financial_transaction receipts
    # ════════════════════════════════════════════════════════════════════════════════
    financial_types = [
      {
        name: 'Bank Statement',
        abbreviation: 'BANK',
        folder: 'Statements',
        description: 'Monthly bank account statements',
        scope: 'financial',
        retention_years: 7,
        file_extensions: %w[pdf csv]
      },
      {
        name: 'Transaction Receipt',
        abbreviation: 'TXN',
        folder: 'Receipts',
        description: 'Individual transaction receipts',
        scope: 'financial',
        file_extensions: %w[pdf jpg jpeg png]
      },
      {
        name: 'Payment Confirmation',
        abbreviation: 'PAY',
        folder: 'Payments',
        description: 'Payment confirmations and remittances',
        scope: 'financial',
        file_extensions: %w[pdf]
      }
    ]

    # Create all document types
    (asset_types + financial_types).each do |attrs|
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

    Rails.logger.info "[Migration] Created #{asset_types.size} asset document types"
    Rails.logger.info "[Migration] Created #{financial_types.size} financial document types"
  end

  def down
    # Remove the document types we created
    DocumentType.where(scope: %w[asset financial]).destroy_all
  end
end
