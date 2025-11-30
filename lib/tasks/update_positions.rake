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
end
