namespace :shareholdings do
  desc "Fix Tekna shareholdings on staging"
  task fix_tekna: :environment do
    def find_or_create_contact(name)
      contact = Contact.find_by("full_name ILIKE ?", "%#{name}%")
      return contact if contact

      parts = name.split(" ")
      Contact.create!(
        full_name: name,
        first_name: parts[0],
        last_name: parts[1..-1].join(" ")
      )
    end

    tekna = Company.find_by(name: "Tekna Pty Ltd")
    if tekna
      puts "Tekna before: #{CompanyShareholding.where(company_id: tekna.id).count} shareholdings"

      existing = CompanyShareholding.where(company_id: tekna.id).map(&:shareholder_name)

      # Jonathan Lance Ament
      unless existing.any? { |n| n.downcase.include?("jonathan") }
        contact = find_or_create_contact("Jonathan Lance Ament")
        CompanyShareholding.create!(company_id: tekna.id, shareholder_type: "Contact", shareholder_id: contact.id, number_of_shares: 10, share_class: "ordinary", beneficially_held: true)
        puts "Added: Jonathan Lance Ament - 10 shares"
      end

      # Samuel James Harder
      unless existing.any? { |n| n.downcase.include?("samuel") }
        contact = find_or_create_contact("Samuel James Harder")
        CompanyShareholding.create!(company_id: tekna.id, shareholder_type: "Contact", shareholder_id: contact.id, number_of_shares: 10, share_class: "ordinary", beneficially_held: false)
        puts "Added: Samuel James Harder - 10 shares"
      end

      # Plug Developments
      unless existing.any? { |n| n.downcase.include?("plug") }
        plug = Company.find_or_create_by!(name: "Plug Developments Pty Ltd") do |c|
          c.entity_type = "Company"
          c.company_group_id = tekna.company_group_id
        end
        CompanyShareholding.create!(company_id: tekna.id, shareholder_type: "Company", shareholder_id: plug.id, number_of_shares: 35, share_class: "ordinary", beneficially_held: false)
        puts "Added: Plug Developments Pty Ltd - 35 shares"
      end

      puts "Tekna after: #{CompanyShareholding.where(company_id: tekna.id).count} shareholdings"
      puts ""
      puts "Final shareholdings:"
      CompanyShareholding.where(company_id: tekna.id).each { |s| puts "  #{s.shareholder_name} - #{s.number_of_shares} shares" }
      total = CompanyShareholding.where(company_id: tekna.id).sum(:number_of_shares)
      puts "Total: #{total} (expected: 200)"
    else
      puts "Tekna Pty Ltd not found!"
    end
  end
end
