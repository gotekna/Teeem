class AddLoanAgreementLenderCopyDocumentType < ActiveRecord::Migration[8.0]
  def up
    # Add Loan Agreement - Lender Copy (for when we are the lender, "Loan to" format)
    DocumentType.find_or_create_by!(name: 'Loan Agreement - Lender Copy') do |dt|
      dt.folder = 'LOANS'
      dt.description = 'Loan agreement where this entity is the lender (Loan to format)'
      dt.category = 'corporate'
      dt.primary_tab = 'LOANS'
      dt.tabs = [ 'LOANS' ]
      dt.active = true
    end
  end

  def down
    DocumentType.find_by(name: 'Loan Agreement - Lender Copy')&.destroy
  end
end
