namespace :xero do
  desc "Quick test of Xero API connectivity"
  task test: :environment do
    cred = XeroCredential.current
    puts "Credential ID: #{cred.id}"
    puts "Tenant ID: #{cred.tenant_id}"
    puts "Token expires: #{cred.expires_at}"
    puts "Expired: #{cred.expired?}"

    api = XeroApiClient.new
    result = api.get("Organisation", { tenant_id: cred.tenant_id })

    if result[:success]
      org_name = result[:data].dig("Organisations", 0, "Name")
      puts "API TEST: SUCCESS - #{org_name}"
    else
      puts "API TEST: FAILED - #{result[:error]}"
    end
  end
end
