namespace :corporate do
  desc "Import company assets directly (hardcoded from local export)"
  task import_assets_direct: :environment do
    puts "Importing Company Assets (Direct)"
    puts "=" * 80

    # Asset data exported from local import
    assets_data = [
      {
        company_name: "Tekna",
        name: "Shares in Tekna Homes",
        asset_type: "other",
        status: "active",
        purchase_date: Date.parse("2022-11-10"),
        purchase_price: 100000.0,
        description: "Imported from Corporate File.xlsx"
      },
      {
        company_name: "Tekna Drafting",
        name: "Commercial Building Unit 5/8 Nevilles Street",
        asset_type: "property",
        status: "active",
        purchase_date: Date.parse("2023-12-20"),
        purchase_price: 661825.0,
        description: "Imported from Corporate File.xlsx"
      },
      {
        company_name: "Tekna Drafting",
        name: "Shared Equity Loan Khyiroya (Deed Of Novation)",
        asset_type: "other",
        status: "active",
        purchase_date: Date.parse("2023-11-23"),
        purchase_price: 245391.05,
        description: "Imported from Corporate File.xlsx"
      },
      {
        company_name: "Tekna Drafting",
        name: "Shared Equity Loan Mansfield (Deed Of Novation)",
        asset_type: "other",
        status: "active",
        purchase_date: Date.parse("2023-11-23"),
        purchase_price: 154608.95,
        description: "Imported from Corporate File.xlsx"
      }
    ]

    stats = { created: 0, updated: 0, errors: [] }

    assets_data.each do |data|
      begin
        # Find company
        company = Company.find_by("name ILIKE ?", "%#{data[:company_name]}%")
        unless company
          stats[:errors] << "Company not found: #{data[:company_name]}"
          next
        end

        # Check if asset already exists
        asset = Asset.find_by(company: company, name: data[:name])

        asset_data = data.except(:company_name).merge(
          current_book_value: data[:purchase_price]
        )

        if asset
          asset.update!(asset_data)
          stats[:updated] += 1
          puts "  ✅ Updated: #{data[:name]} (#{company.name})"
        else
          Asset.create!(asset_data.merge(company: company))
          stats[:created] += 1
          puts "  ➕ Created: #{data[:name]} (#{company.name})"
        end

      rescue => e
        stats[:errors] << "#{data[:name]}: #{e.message}"
        puts "  ❌ Error: #{e.message}"
      end
    end

    puts "\n" + "=" * 80
    puts "IMPORT COMPLETE - SUMMARY"
    puts "=" * 80
    puts "Assets created: #{stats[:created]}"
    puts "Assets updated: #{stats[:updated]}"
    puts "Total assets in system: #{Asset.count}"

    if stats[:errors].any?
      puts "\n=== Errors (#{stats[:errors].count}) ==="
      stats[:errors].each { |e| puts "  - #{e}" }
    end

    puts "\n✅ Done!"
  end
end
