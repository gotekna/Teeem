namespace :trapid do
  desc "Auto-format all phone and mobile numbers in gold_standard_items table"
  task format_phone_numbers: :environment do
    puts "🔧 Starting phone number formatting..."

    # Format mobile numbers
    mobile_count = 0
    GoldStandardItem.where.not(mobile: [nil, '']).find_each do |item|
      original = item.mobile
      formatted = format_mobile(original)

      if formatted != original
        item.update_column(:mobile, formatted)
        puts "✅ Row #{item.id}: Mobile #{original} → #{formatted}"
        mobile_count += 1
      end
    end

    # Format phone numbers
    phone_count = 0
    GoldStandardItem.where.not(phone: [nil, '']).find_each do |item|
      original = item.phone
      formatted = format_phone(original)

      if formatted != original
        item.update_column(:phone, formatted)
        puts "✅ Row #{item.id}: Phone #{original} → #{formatted}"
        phone_count += 1
      end
    end

    puts "\n📊 Summary:"
    puts "   Mobile numbers formatted: #{mobile_count}"
    puts "   Phone numbers formatted: #{phone_count}"
    puts "   Total formatted: #{mobile_count + phone_count}"
  end

  # Helper method to format mobile numbers
  def format_mobile(value)
    return value if value.blank?

    # Remove all non-digit characters
    digits = value.gsub(/\D/, '')

    # Format Australian mobile: 0400 000 000
    if digits.length == 10 && digits.start_with?('04')
      return "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    end

    value # Return original if can't format
  end

  # Helper method to format phone numbers
  def format_phone(value)
    return value if value.blank?

    # Remove all non-digit characters
    digits = value.gsub(/\D/, '')

    # Format Australian landline: (02) 0000 0000
    if digits.length == 10 && digits.match?(/^0[2-9]/)
      return "(#{digits[0..1]}) #{digits[2..5]} #{digits[6..9]}"
    end

    # Format 1300/1800 numbers: 1300 000 000
    if digits.length == 10 && digits.match?(/^1[38]00/)
      return "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    end

    # Handle 8-digit numbers - try to detect area code based on first digit
    if digits.length == 8
      area_code = detect_area_code(digits)
      if area_code
        full_number = "#{area_code}#{digits}"
        return "(#{area_code}) #{digits[0..3]} #{digits[4..7]}"
      end
    end

    value # Return original if can't format
  end

  # Detect area code based on 8-digit landline pattern
  def detect_area_code(eight_digits)
    first_digit = eight_digits[0]

    # Brisbane/QLD: 07 - numbers starting with 3
    # Sydney/NSW: 02 - numbers starting with 8, 9
    # Melbourne/VIC: 03 - numbers starting with 8, 9
    # Adelaide/SA: 08 - numbers starting with 8
    # Perth/WA: 08 - numbers starting with 6, 9
    # Hobart/TAS: 03 - numbers starting with 6
    # Canberra/ACT: 02 - numbers starting with 6
    # Darwin/NT: 08 - numbers starting with 8, 9

    case first_digit
    when '3'
      # Most likely Brisbane (07)
      '07'
    when '6'
      # Could be Perth (08), Hobart (03), or Canberra (02)
      # Default to 08 (Perth) as it's most common
      '08'
    when '8'
      # Could be Sydney (02), Melbourne (03), Adelaide (08), or Darwin (08)
      # Check second digit for better accuracy
      second_digit = eight_digits[1]
      if second_digit == '8' || second_digit == '9'
        # 88xx or 89xx more likely Adelaide/Darwin (08)
        '08'
      else
        # Default to Melbourne (03) as it's most common
        '03'
      end
    when '9'
      # Could be Sydney (02) or Melbourne (03)
      # Default to Melbourne (03) as it's most common
      '03'
    else
      # Can't determine - return nil
      nil
    end
  end
end
