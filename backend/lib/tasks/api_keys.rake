namespace :api_keys do
  desc "Generate API key for Unreal Engine integration"
  task create_unreal_key: :environment do
    # Generate a secure random API key
    api_key = SecureRandom.hex(32)

    # Create the integration record
    integration = ExternalIntegration.create_with_api_key!(
      name: "unreal_engine",
      api_key: api_key,
      description: "Unreal Engine estimates import integration"
    )

    puts "=" * 80
    puts "Unreal Engine API Key Created Successfully!"
    puts "=" * 80
    puts ""
    puts "API Key: #{api_key}"
    puts ""
    puts "Integration ID: #{integration.id}"
    puts "Name: #{integration.name}"
    puts "Active: #{integration.is_active}"
    puts ""
    puts "Save this API key securely - it cannot be retrieved again!"
    puts "Add this to your .env file:"
    puts "UNREAL_ENGINE_API_KEY=#{api_key}"
    puts ""
    puts "=" * 80
  end

  desc "List all external integrations"
  task list: :environment do
    integrations = ExternalIntegration.all

    puts "=" * 80
    puts "External Integrations"
    puts "=" * 80
    puts ""

    if integrations.any?
      integrations.each do |integration|
        puts "ID: #{integration.id}"
        puts "Name: #{integration.name}"
        puts "Active: #{integration.is_active}"
        puts "Last Used: #{integration.last_used_at || 'Never'}"
        puts "Created: #{integration.created_at}"
        puts "-" * 80
      end
    else
      puts "No external integrations found."
    end
  end
end
