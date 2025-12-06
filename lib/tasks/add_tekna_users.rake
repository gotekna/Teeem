namespace :users do
  desc "Add all Tekna team members to the system and send welcome emails"
  task add_tekna_team: :environment do
    tekna_users = [
      { name: "Robert Harder", email: "robert@tekna.com.au", role: "admin" },
      { name: "Jared Harder", email: "jared@tekna.com.au", role: "product_owner" },
      { name: "Sophie Harder", email: "sophie@tekna.com.au", role: "admin" },
      { name: "Rachel Harder", email: "rachel@tekna.com.au", role: "admin" },
      { name: "Sam Harder", email: "sam@tekna.com.au", role: "product_owner" },
      { name: "Andrew Clement", email: "andrew@tekna.com.au", role: "supervisor" }
    ]

    puts "Adding Tekna team members to the system...\n\n"

    tekna_users.each do |user_data|
      user = User.find_or_initialize_by(email: user_data[:email])

      if user.new_record?
        # Generate a temporary password for new users
        temp_password = SecureRandom.urlsafe_base64(12)
        user.name = user_data[:name]
        user.password = temp_password
        user.password_confirmation = temp_password
        user.role = user_data[:role]

        if user.save
          puts "✓ Created user: #{user.name} (#{user.email}) with role: #{user.role}"

          # Send welcome email with credentials
          begin
            UserMailer.welcome_email(user, temp_password).deliver_now
            puts "  ✉  Welcome email sent to #{user.email}"
          rescue => e
            puts "  ✗ Failed to send email to #{user.email}: #{e.message}"
            puts "  → Temporary password: #{temp_password}"
          end
        else
          puts "✗ Failed to create user #{user_data[:email]}: #{user.errors.full_messages.join(', ')}"
        end
      else
        # Update role if it changed
        if user.role != user_data[:role]
          user.update(role: user_data[:role])
          puts "✓ Updated role for #{user.name} (#{user.email}) to: #{user.role}"
        else
          puts "- User already exists: #{user.name} (#{user.email}) with role: #{user.role}"
        end
      end

      puts ""  # Blank line between users
    end

    puts "\n" + "="*60
    puts "Total users in system: #{User.count}"
    puts "="*60
  end
end
