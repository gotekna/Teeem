namespace :corporate do
  desc "Import corporate credentials directly (hardcoded data from local export)"
  task import_data_direct: :environment do
    puts "Importing corporate credentials..."
    stats = { updated: 0, not_found: 0, errors: [] }

    # Data exported from local DB on 2025-11-29
    credentials = [
      { acn: "658463659", corporate_key: "8860820", asic_username: "rach@100xbestlife.com", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "658602478", corporate_key: "32350239", asic_username: "rach@100xbestlife.com", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "645359495", corporate_key: "16724280", asic_username: "rach@100xbestlife.com", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "658706597", corporate_key: "24400857", asic_username: "rach@100xbestlife.com", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "658462394", corporate_key: "94512428", asic_username: "andrew@tekna.com.au", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "673388424", corporate_key: "42468380", asic_username: "andrew@tekna.com.au", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "159565849", corporate_key: "10135027", asic_username: "rach@100xbestlife.com", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "658462732", corporate_key: "94668790", asic_username: "rachel@tekna.com.au", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "677065137", corporate_key: "01144006", asic_username: "rachel@tekna.com.au", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" },
      { acn: "092659688", corporate_key: "57291049", asic_username: "w2gasset", asic_password: "J4sper20!0", recovery_question: "What City was I Born In?", recovery_answer: "Glenelg" }
    ]

    credentials.each do |data|
      begin
        company = Company.find_by(acn: data[:acn])

        if company
          updates = {
            corporate_key: data[:corporate_key],
            asic_username: data[:asic_username],
            encrypted_asic_password: data[:asic_password],
            recovery_question: data[:recovery_question],
            encrypted_recovery_answer: data[:recovery_answer]
          }

          company.update!(updates)
          stats[:updated] += 1
          puts "✅ Updated: #{company.name}"
        else
          stats[:not_found] += 1
          puts "❌ Not found: ACN #{data[:acn]}"
        end
      rescue => e
        stats[:errors] << "ACN #{data[:acn]}: #{e.message}"
        puts "❌ Error for ACN #{data[:acn]}: #{e.message}"
      end
    end

    puts "\n" + "=" * 80
    puts "Import complete:"
    puts "  Updated: #{stats[:updated]}"
    puts "  Not found: #{stats[:not_found]}"
    puts "  Errors: #{stats[:errors].count}"

    if stats[:errors].any?
      puts "\nErrors:"
      stats[:errors].each { |e| puts "  - #{e}" }
    end
  end
end
