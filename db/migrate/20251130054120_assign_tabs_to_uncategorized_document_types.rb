class AssignTabsToUncategorizedDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Assign tabs to Draft/Signed variants that were missing assignments

    # ASSETS tab - Purchase Contracts and Service Agreements
    %w[Purchase\ Contract\ -\ Draft Purchase\ Contract\ -\ Signed
       Service\ Agreement\ -\ Draft Service\ Agreement\ -\ Signed].each do |name|
      dt = DocumentType.find_by(name: name)
      if dt
        dt.update!(primary_tab: 'ASSETS', tabs: [ 'ASSETS' ], folder: 'ASSETS')
        puts "Updated: #{name} -> ASSETS"
      end
    end

    # LOANS tab - Loan Agreements and Security Deeds
    %w[Loan\ Agreement\ -\ Draft Loan\ Agreement\ -\ Signed
       Security\ Deed\ -\ Draft Security\ Deed\ -\ Signed].each do |name|
      dt = DocumentType.find_by(name: name)
      if dt
        dt.update!(primary_tab: 'LOANS', tabs: [ 'LOANS' ], folder: 'LOANS')
        puts "Updated: #{name} -> LOANS"
      end
    end

    # MINUTES tab - Minutes Draft/Signed
    %w[Minutes\ -\ Draft Minutes\ -\ Signed].each do |name|
      dt = DocumentType.find_by(name: name)
      if dt
        dt.update!(primary_tab: 'MINUTES', tabs: [ 'MINUTES' ], folder: 'MINUTES')
        puts "Updated: #{name} -> MINUTES"
      end
    end

    # DIVIDENDS tab - Distribution Draft/Signed
    %w[Distribution\ -\ Draft Distribution\ -\ Signed].each do |name|
      dt = DocumentType.find_by(name: name)
      if dt
        dt.update!(primary_tab: 'DIVIDENDS', tabs: [ 'DIVIDENDS' ], folder: 'DIVIDENDS')
        puts "Updated: #{name} -> DIVIDENDS"
      end
    end
  end

  def down
    # Reset tabs to empty
    names = [
      'Purchase Contract - Draft', 'Purchase Contract - Signed',
      'Service Agreement - Draft', 'Service Agreement - Signed',
      'Loan Agreement - Draft', 'Loan Agreement - Signed',
      'Security Deed - Draft', 'Security Deed - Signed',
      'Minutes - Draft', 'Minutes - Signed',
      'Distribution - Draft', 'Distribution - Signed'
    ]
    DocumentType.where(name: names).update_all(primary_tab: nil, tabs: [])
  end
end
