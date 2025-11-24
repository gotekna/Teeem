#!/usr/bin/env ruby
# Test script for Xero Bank Account Details sync
# Run with: ruby backend/test/xero_bank_sync_test.rb

require_relative '../config/environment'

class XeroBankSyncTest
  def initialize
    @client = XeroApiClient.new
  end

  def run_all_tests
    puts "\n" + "="*80
    puts "Xero Bank Account Details Sync Test"
    puts "="*80

    test_1_check_auth
    test_2_create_trapid_contact
    test_3_format_bank_details_to_xero
    test_4_parse_bank_details_from_xero

    puts "\n" + "="*80
    puts "All tests completed!"
    puts "="*80
  end

  private

  def test_1_check_auth
    puts "\n[Test 1] Checking Xero Authentication..."
    cred = XeroCredential.first

    if cred
      puts "✓ Xero credentials found"
      puts "  - Expires at: #{cred.token_expires_at}"
      puts "  - Status: #{cred.token_expires_at > Time.current ? 'Valid' : 'Expired - needs refresh'}"
    else
      puts "✗ No Xero credentials found. Please authenticate first."
      exit 1
    end
  end

  def test_2_create_trapid_contact
    puts "\n[Test 2] Creating test contact in Trapid..."

    @test_contact = Contact.create!(
      full_name: "Test Bank Sync #{Time.current.to_i}",
      email: "test_bank_#{Time.current.to_i}@example.com",
      bank_bsb: "123456",
      bank_account_number: "98765432",
      bank_account_name: "Test Business Account",
      sync_with_xero: true
    )

    puts "✓ Created test contact ##{@test_contact.id}"
    puts "  - Name: #{@test_contact.full_name}"
    puts "  - BSB: #{@test_contact.bank_bsb}"
    puts "  - Account Number: #{@test_contact.bank_account_number}"
    puts "  - Account Name: #{@test_contact.bank_account_name}"
  end

  def test_3_format_bank_details_to_xero
    puts "\n[Test 3] Testing bank details format TO Xero..."

    # Simulate what the job does
    payload = {
      Name: @test_contact.full_name,
      EmailAddress: @test_contact.email
    }

    # Build bank details string (from XeroContactSyncJob#build_xero_contact_payload)
    if @test_contact.bank_bsb.present? || @test_contact.bank_account_number.present? || @test_contact.bank_account_name.present?
      bank_details = []
      bank_details << "BSB: #{@test_contact.bank_bsb}" if @test_contact.bank_bsb.present?
      bank_details << "Account Number: #{@test_contact.bank_account_number}" if @test_contact.bank_account_number.present?
      bank_details << "Account Name: #{@test_contact.bank_account_name}" if @test_contact.bank_account_name.present?
      payload[:BankAccountDetails] = bank_details.join(', ')
    end

    puts "✓ Formatted bank details string:"
    puts "  \"#{payload[:BankAccountDetails]}\""

    # Create in Xero
    puts "\n  Sending to Xero..."
    result = @client.post('Contacts', { Contacts: [payload] })

    if result[:success]
      xero_contact = result[:data]['Contacts']&.first
      @xero_contact_id = xero_contact['ContactID']
      puts "✓ Successfully created in Xero"
      puts "  - Xero ID: #{@xero_contact_id}"
      puts "  - Bank Details in Xero: #{xero_contact['BankAccountDetails']}"

      # Update Trapid contact with Xero ID
      @test_contact.update!(xero_id: @xero_contact_id)
    else
      puts "✗ Failed to create in Xero: #{result[:error]}"
    end
  end

  def test_4_parse_bank_details_from_xero
    puts "\n[Test 4] Testing bank details parsing FROM Xero..."

    # Fetch from Xero
    result = @client.get("Contacts/#{@xero_contact_id}")

    if result[:success]
      xero_contact = result[:data]['Contacts']&.first
      bank_details_string = xero_contact['BankAccountDetails']

      puts "✓ Fetched from Xero:"
      puts "  Raw string: \"#{bank_details_string}\""

      # Parse using the regex patterns from XeroContactSyncJob#update_trapid_from_xero
      parsed = {}

      if bank_details_string.present?
        if bank_details_string.match(/BSB[:\s]+(\d{6})/)
          parsed[:bank_bsb] = $1
        end

        if bank_details_string.match(/Account Number[:\s]+([\d\s]+)/)
          parsed[:bank_account_number] = $1.gsub(/\s/, '')
        end

        if bank_details_string.match(/Account Name[:\s]+([^,\n]+)/)
          parsed[:bank_account_name] = $1.strip
        end
      end

      puts "\n✓ Parsed values:"
      puts "  - BSB: #{parsed[:bank_bsb] || 'NOT PARSED'}"
      puts "  - Account Number: #{parsed[:bank_account_number] || 'NOT PARSED'}"
      puts "  - Account Name: #{parsed[:bank_account_name] || 'NOT PARSED'}"

      # Verify parsing matches original
      puts "\n[Verification]"
      matches = true
      if parsed[:bank_bsb] != @test_contact.bank_bsb
        puts "✗ BSB mismatch: expected #{@test_contact.bank_bsb}, got #{parsed[:bank_bsb]}"
        matches = false
      else
        puts "✓ BSB matches"
      end

      if parsed[:bank_account_number] != @test_contact.bank_account_number
        puts "✗ Account Number mismatch: expected #{@test_contact.bank_account_number}, got #{parsed[:bank_account_number]}"
        matches = false
      else
        puts "✓ Account Number matches"
      end

      if parsed[:bank_account_name] != @test_contact.bank_account_name
        puts "✗ Account Name mismatch: expected #{@test_contact.bank_account_name}, got #{parsed[:bank_account_name]}"
        matches = false
      else
        puts "✓ Account Name matches"
      end

      if matches
        puts "\n✓✓✓ ALL FIELDS MATCH - Bidirectional sync is working correctly!"
      else
        puts "\n✗✗✗ SOME FIELDS DON'T MATCH - Check regex patterns"
      end
    else
      puts "✗ Failed to fetch from Xero"
    end

    # Cleanup
    puts "\n[Cleanup]"
    print "Delete test contact from Trapid? (y/n): "
    if gets.chomp.downcase == 'y'
      @test_contact.destroy
      puts "✓ Deleted test contact from Trapid"
      puts "  Note: Contact still exists in Xero (ID: #{@xero_contact_id})"
      puts "  You can delete it manually from Xero if needed"
    else
      puts "Kept test contact (ID: #{@test_contact.id})"
    end
  end
end

# Run the tests
XeroBankSyncTest.new.run_all_tests
