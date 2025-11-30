namespace :corporate do
  desc "Update officer positions to include public officer role"
  task update_positions: :environment do
    puts "Updating officer positions to include public officer..."

    Company.find_each do |company|
      company.company_directors.where(is_current: true).each do |cd|
        new_position = case cd.position
        when "director", "secretary", "director_secretary"
          "director_secretary_public_officer"
        else
          cd.position
        end

        if cd.position != new_position
          cd.update!(position: new_position)
          puts "#{company.name}: Updated #{cd.contact.full_name} to #{new_position}"
        end
      end
    end

    puts "Done!"
  end

  desc "Import shareholdings for companies"
  task import_shareholdings: :environment do
    puts "Importing shareholdings..."

    shareholdings_data = {
      "Prov1322 Global Pty Ltd" => { shares: 100, holder: "Team Harder Super Fund", holder_type: "Company" },
      "Gen2612 Pty Ltd" => { shares: 100, holder: "Team Harder Super Fund", holder_type: "Company" },
      "Team Harder Pty Ltd" => { shares: 100, holder: "Rachel Anne Harder", holder_type: "Contact" },
      "Team Harder Super Investments Pty Ltd" => { shares: 100, holder: "Team Harder Super Fund", holder_type: "Company" },
      "W2G Assets Pty Ltd" => { shares: 1000, holder: "Team Harder Super Fund", holder_type: "Company" },
      "Tekna Pty Ltd" => { shares: 200, holder: "Andrew Mark Clement", holder_type: "Contact" },
      "Tekna Admin Pty Ltd" => { shares: 100, holder: "Tekna Pty Ltd", holder_type: "Company" },
      "Tekna Drafting Pty Ltd" => { shares: 100, holder: "Andrew Mark Clement", holder_type: "Contact" },
      "Tekna Homes Pty Ltd" => { shares: 400100, holder: "multiple", holder_type: "multiple" },
      "The Promise QLD Pty Ltd" => { shares: 100, holder: "Sophie Mee-jeong Harder", holder_type: "Contact" },
      "Co Invest Capital Pty Ltd" => { shares: 100, holder: "Rachel Anne Harder", holder_type: "Contact" },
      "Co Invest Homes Pty Ltd" => { shares: 100, holder: "multiple", holder_type: "multiple" }
    }

    shareholdings_data.each do |company_name, data|
      company = Company.where("LOWER(name) LIKE ?", "%#{company_name.downcase.gsub('pty ltd', '').strip}%").first
      unless company
        puts "Company not found: #{company_name}"
        next
      end

      # Skip if already has shareholdings
      if company.company_shareholdings.any?
        puts "#{company.name}: Already has #{company.company_shareholdings.count} shareholdings"
        next
      end

      next if data[:holder] == "multiple" # Handle these separately

      if data[:holder_type] == "Contact"
        holder = Contact.where("LOWER(full_name) LIKE ?", "%#{data[:holder].downcase}%").first
      else
        holder = Company.where("LOWER(name) LIKE ?", "%#{data[:holder].downcase.gsub('pty ltd', '').strip}%").first
      end

      unless holder
        puts "Holder not found: #{data[:holder]}"
        next
      end

      CompanyShareholding.create!(
        company: company,
        shareholder: holder,
        share_class: "Ordinary",
        number_of_shares: data[:shares]
      )
      puts "#{company.name}: Created shareholding - #{holder.respond_to?(:full_name) ? holder.full_name : holder.name} holds #{data[:shares]} shares"
    end

    # Tekna Homes - split ownership
    tekna_homes = Company.where("LOWER(name) LIKE ?", "%tekna homes%").first
    if tekna_homes && tekna_homes.company_shareholdings.empty?
      andrew = Contact.where("LOWER(full_name) LIKE ?", "%andrew mark clement%").first
      tekna = Company.where("LOWER(name) = ?", "tekna pty ltd").first

      CompanyShareholding.create!(company: tekna_homes, shareholder: andrew, share_class: "Ordinary", number_of_shares: 100) if andrew
      CompanyShareholding.create!(company: tekna_homes, shareholder: tekna, share_class: "Ordinary", number_of_shares: 400000) if tekna
      puts "Tekna Homes: Created split shareholdings"
    end

    # Co Invest Homes - split ownership
    co_invest_homes = Company.where("LOWER(name) LIKE ?", "%co invest homes%").where("name NOT LIKE ?", "%sign up%").first
    if co_invest_homes && co_invest_homes.company_shareholdings.empty?
      rachel = Contact.where("LOWER(full_name) LIKE ?", "%rachel anne harder%").first
      jake = Contact.where("LOWER(full_name) LIKE ?", "%jake%baird%").first

      CompanyShareholding.create!(company: co_invest_homes, shareholder: rachel, share_class: "Ordinary", number_of_shares: 50) if rachel
      CompanyShareholding.create!(company: co_invest_homes, shareholder: jake, share_class: "Ordinary", number_of_shares: 50) if jake
      puts "Co Invest Homes: Created split shareholdings"
    end

    puts "Done!"
  end
end
