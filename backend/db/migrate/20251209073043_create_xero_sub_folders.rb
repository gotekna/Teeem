class CreateXeroSubFolders < ActiveRecord::Migration[8.0]
  def up
    # Find or create the XERO main folder
    xero = DocumentFolder.find_or_create_by!(name: 'XERO') do |f|
      f.description = 'Xero integration documents'
      f.order_position = 2
      f.sharepoint_path = '/Corporate/{company_code}/Xero'
      f.entity_types = [ 'trading_company' ]
      f.active = true
      f.parent_id = nil  # Main tab
    end

    # Create XERO sub-folders
    sub_folders = [
      {
        name: 'Bank Statements',
        description: 'Bank statements imported from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/BankStatements',
        order_position: 1
      },
      {
        name: 'Invoices',
        description: 'Sales invoices from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/Invoices',
        order_position: 2
      },
      {
        name: 'Bills',
        description: 'Bills and purchase invoices from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/Bills',
        order_position: 3
      },
      {
        name: 'Quotes',
        description: 'Quotes and estimates from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/Quotes',
        order_position: 4
      },
      {
        name: 'Credit Notes',
        description: 'Credit notes from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/CreditNotes',
        order_position: 5
      },
      {
        name: 'Purchase Orders',
        description: 'Purchase orders from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/PurchaseOrders',
        order_position: 6
      },
      {
        name: 'Receipts',
        description: 'Receipts and expense claims from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/Receipts',
        order_position: 7
      },
      {
        name: 'Reports',
        description: 'Financial reports from Xero',
        sharepoint_path: '/Corporate/{company_code}/Xero/Reports',
        order_position: 8
      }
    ]

    sub_folders.each do |folder_data|
      DocumentFolder.find_or_create_by!(
        name: folder_data[:name],
        parent_id: xero.id
      ) do |f|
        f.description = folder_data[:description]
        f.sharepoint_path = folder_data[:sharepoint_path]
        f.order_position = folder_data[:order_position]
        f.entity_types = [ 'trading_company' ]
        f.active = true
      end
    end
  end

  def down
    # Find XERO folder
    xero = DocumentFolder.find_by(name: 'XERO')
    return unless xero

    # Delete all sub-folders
    DocumentFolder.where(parent_id: xero.id).destroy_all
  end
end
