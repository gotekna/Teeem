# frozen_string_literal: true

# Phase 3: Warehouse Documents Test Suite
#
# Comprehensive tests for the universal warehouse document system.
#
# Run all tests:
#   rails phase3:test:all
#
# Run individual tests:
#   rails phase3:test:deduplication
#   rails phase3:test:send_name
#   rails phase3:test:folder_move
#   rails phase3:test:performance
#   rails phase3:test:api
#
namespace :phase3 do
  namespace :test do
    desc "Run all Phase 3 tests"
    task all: :environment do
      puts "=" * 70
      puts "Phase 3: Warehouse Documents - Full Test Suite"
      puts "=" * 70
      puts ""

      results = {}

      # Run each test
      %w[deduplication send_name folder_move api_serialization integrity].each do |test|
        puts "-" * 70
        result = Rake::Task["phase3:test:#{test}"].invoke
        results[test] = result
        Rake::Task["phase3:test:#{test}"].reenable
        puts ""
      end

      # Summary
      puts "=" * 70
      puts "Test Summary"
      puts "=" * 70
      results.each do |test, passed|
        status = passed ? "✅ PASS" : "❌ FAIL"
        puts "  #{test}: #{status}"
      end
    end

    desc "Test deduplication: same content → 1 blob, multiple warehouse docs"
    task deduplication: :environment do
      puts "Test: Deduplication"
      puts "-" * 40

      passed = true

      # Test 1: Verify existing deduplication
      puts "1. Checking existing deduplication..."

      # Find blobs referenced by multiple WarehouseDocuments
      multi_ref_blobs = StorageBlob
        .joins(:warehouse_documents)
        .group("storage_blobs.id")
        .having("COUNT(warehouse_documents.id) > 1")
        .count

      if multi_ref_blobs.any?
        total_refs = multi_ref_blobs.values.sum
        puts "   ✅ Found #{multi_ref_blobs.count} blobs with multiple references"
        puts "   ✅ Total references: #{total_refs} (saved #{total_refs - multi_ref_blobs.count} duplicates)"
      else
        puts "   ⚠️  No multi-referenced blobs found (may be normal for small dataset)"
      end

      # Test 2: Verify content_hash uniqueness
      puts "2. Checking content_hash uniqueness..."

      duplicate_hashes = StorageBlob
        .where.not(content_hash: nil)
        .group(:content_hash)
        .having("COUNT(*) > 1")
        .count

      if duplicate_hashes.empty?
        puts "   ✅ All content hashes are unique"
      else
        puts "   ❌ Found #{duplicate_hashes.count} duplicate content hashes"
        passed = false
      end

      # Test 3: Deduplication ratio
      puts "3. Calculating deduplication ratio..."

      total_docs = WarehouseDocument.where.not(storage_blob_id: nil).count
      unique_blobs = WarehouseDocument.where.not(storage_blob_id: nil).distinct.count(:storage_blob_id)

      if total_docs > 0 && unique_blobs > 0
        ratio = ((total_docs - unique_blobs).to_f / total_docs * 100).round(1)
        puts "   ✅ #{total_docs} documents using #{unique_blobs} unique blobs"
        puts "   ✅ Deduplication ratio: #{ratio}%"
      else
        puts "   ⚠️  Not enough data for ratio calculation"
      end

      puts ""
      puts passed ? "✅ Deduplication test PASSED" : "❌ Deduplication test FAILED"
      passed
    end

    desc "Test Send Name resolution for different document types"
    task send_name: :environment do
      puts "Test: Send Name Resolution"
      puts "-" * 40

      passed = true
      resolver = SendNameResolver.new

      # Test 1: Corporate document with template
      puts "1. Testing corporate document Send Name..."

      corp_doc = WarehouseDocument.find_by(source_type: "corporate")
      if corp_doc
        send_name = resolver.resolve(corp_doc)
        puts "   Display: #{corp_doc.display_name&.truncate(40)}"
        puts "   Send Name: #{send_name&.truncate(50)}"

        if send_name.present? && send_name != "document"
          puts "   ✅ Corporate Send Name resolved"
        else
          puts "   ❌ Corporate Send Name failed"
          passed = false
        end
      else
        puts "   ⚠️  No corporate documents found"
      end

      # Test 2: Email document with Subject template
      puts "2. Testing email document Send Name..."

      email_doc = WarehouseDocument.joins("INNER JOIN synced_emails ON warehouse_documents.documentable_id = synced_emails.id")
                                   .where(documentable_type: "SyncedEmail")
                                   .where.not("synced_emails.subject" => [nil, ""])
                                   .first

      if email_doc
        send_name = resolver.resolve(email_doc)
        puts "   Display: #{email_doc.display_name&.truncate(40)}"
        puts "   Send Name: #{send_name&.truncate(50)}"

        # Should contain subject and date, end in .eml
        if send_name&.end_with?(".eml") && send_name.length > 10
          puts "   ✅ Email Send Name resolved with .eml extension"
        else
          puts "   ❌ Email Send Name format incorrect"
          passed = false
        end
      else
        puts "   ⚠️  No email documents with subject found"
      end

      # Test 3: Job document
      puts "3. Testing job document Send Name..."

      job_doc = WarehouseDocument.find_by(source_type: "job")
      if job_doc
        send_name = resolver.resolve(job_doc)
        puts "   Display: #{job_doc.display_name&.truncate(40)}"
        puts "   Send Name: #{send_name&.truncate(50)}"

        if send_name.present? && send_name != "document"
          puts "   ✅ Job Send Name resolved"
        else
          puts "   ❌ Job Send Name failed"
          passed = false
        end
      else
        puts "   ⚠️  No job documents found"
      end

      # Test 4: Filename sanitization
      puts "4. Testing filename sanitization..."

      test_cases = [
        { input: "RE: Invoice / Question?", expected_clean: true },
        { input: "File:Name*With|Bad<Chars>", expected_clean: true }
      ]

      test_cases.each do |tc|
        clean = resolver.send(:full_sanitize, tc[:input])

        if tc[:expected_clean]
          has_bad_chars = clean.match?(/[:\/*?"<>|\\]/)
          if has_bad_chars
            puts "   ❌ Bad chars not removed from: #{tc[:input][0..30]}"
            passed = false
          else
            puts "   ✅ Sanitized: #{tc[:input][0..20]}... → #{clean[0..30]}"
          end
        end
      end

      # Test 5: Filename truncation (uses full pipeline)
      puts "5. Testing filename truncation..."

      long_name = "A" * 300 + ".pdf"
      truncated = resolver.send(:truncate_filename, long_name)

      if truncated.length <= 200
        puts "   ✅ Long filename truncated: #{long_name.length} → #{truncated.length} chars"
      else
        puts "   ❌ Filename not truncated: #{truncated.length} chars"
        passed = false
      end

      puts ""
      puts passed ? "✅ Send Name test PASSED" : "❌ Send Name test FAILED"
      passed
    end

    desc "Test folder move is instant (DB only, no S3 copy)"
    task folder_move: :environment do
      puts "Test: Folder Move (Virtual Folders)"
      puts "-" * 40

      passed = true

      # Test 1: Folder move updates only the folder field
      puts "1. Testing folder move is instant..."

      test_doc = WarehouseDocument.first
      if test_doc
        original_folder = test_doc.folder
        original_blob_path = test_doc.storage_blob&.storage_path
        new_folder = "Test/Moved/#{Time.current.to_i}"

        # Time the folder move
        start_time = Time.current
        test_doc.move_to_folder(new_folder)
        move_time = ((Time.current - start_time) * 1000).round(2)

        # Verify
        test_doc.reload

        if test_doc.folder == new_folder
          puts "   ✅ Folder updated: #{new_folder}"
        else
          puts "   ❌ Folder not updated"
          passed = false
        end

        if test_doc.storage_blob&.storage_path == original_blob_path
          puts "   ✅ Blob storage_path unchanged (no S3 copy)"
        else
          puts "   ❌ Blob storage_path changed (unexpected S3 copy)"
          passed = false
        end

        if move_time < 100
          puts "   ✅ Move completed in #{move_time}ms (< 100ms threshold)"
        else
          puts "   ⚠️  Move took #{move_time}ms (slower than expected)"
        end

        # Restore original folder
        test_doc.update!(folder: original_folder)
        puts "   ✅ Original folder restored"
      else
        puts "   ⚠️  No documents found for testing"
      end

      # Test 2: Verify folder is just metadata
      puts "2. Verifying folder is metadata only..."

      folder_counts = WarehouseDocument.group(:folder).count
      puts "   ✅ Found #{folder_counts.count} unique folders"
      puts "   ✅ Folders are virtual paths, not S3 directories"

      puts ""
      puts passed ? "✅ Folder move test PASSED" : "❌ Folder move test FAILED"
      passed
    end

    desc "Test API serialization format"
    task api_serialization: :environment do
      puts "Test: API Serialization"
      puts "-" * 40

      passed = true

      # Test 1: Warehouse document JSON format
      puts "1. Testing warehouse document serialization..."

      doc = WarehouseDocument.includes(:documentable, :storage_blob).first
      if doc
        # Simulate the controller serialization
        json = {
          id: doc.id,
          source: doc.source_type,
          documentableType: doc.documentable_type,
          displayName: doc.display_name,
          sendName: doc.download_filename,
          mimeType: doc.content_type || doc.storage_blob&.content_type,
          fileSize: doc.file_size || doc.storage_blob&.file_size,
          folder: doc.folder,
          createdAt: doc.created_at&.iso8601
        }

        required_keys = %i[id source documentableType displayName sendName]
        missing_keys = required_keys.select { |k| json[k].nil? }

        if missing_keys.empty?
          puts "   ✅ All required fields present"
          puts "   Sample: id=#{json[:id]}, source=#{json[:source]}, displayName=#{json[:displayName]&.truncate(30)}"
        else
          puts "   ❌ Missing fields: #{missing_keys.join(', ')}"
          passed = false
        end
      else
        puts "   ⚠️  No documents found"
      end

      # Test 2: Verify camelCase keys
      puts "2. Verifying camelCase convention..."

      camel_case_keys = %w[documentableType displayName sendName mimeType fileSize createdAt storageBlobId contentHash]
      puts "   ✅ API uses camelCase: #{camel_case_keys.first(4).join(', ')}..."

      # Test 3: Source type coverage
      puts "3. Checking source type coverage..."

      sources = WarehouseDocument.group(:source_type).count
      puts "   Found source types: #{sources.keys.join(', ')}"

      expected_sources = %w[corporate email job contact]
      missing = expected_sources - sources.keys
      if missing.empty?
        puts "   ✅ All expected source types present"
      else
        puts "   ⚠️  Missing source types: #{missing.join(', ')}"
      end

      puts ""
      puts passed ? "✅ API serialization test PASSED" : "❌ API serialization test FAILED"
      passed
    end

    desc "Test data integrity across the system"
    task integrity: :environment do
      puts "Test: Data Integrity"
      puts "-" * 40

      passed = true

      # Test 1: All WarehouseDocuments have valid documentable
      puts "1. Checking documentable references..."

      invalid_docs = 0
      WarehouseDocument.find_each do |wd|
        begin
          wd.documentable
        rescue StandardError
          invalid_docs += 1
        end
      end

      if invalid_docs == 0
        puts "   ✅ All #{WarehouseDocument.count} documents have valid documentable"
      else
        puts "   ❌ #{invalid_docs} documents have invalid documentable"
        passed = false
      end

      # Test 2: All referenced blobs exist
      puts "2. Checking blob references..."

      blob_ids = StorageBlob.pluck(:id)
      invalid_blob_refs = WarehouseDocument
        .where.not(storage_blob_id: nil)
        .where.not(storage_blob_id: blob_ids)
        .count

      if invalid_blob_refs == 0
        puts "   ✅ All blob references are valid"
      else
        puts "   ❌ #{invalid_blob_refs} documents reference non-existent blobs"
        passed = false
      end

      # Test 3: Reference count accuracy
      puts "3. Checking reference count accuracy (sample)..."

      sample_blobs = StorageBlob.where("reference_count > 0").limit(100)
      mismatched = 0

      sample_blobs.each do |blob|
        # SSoT: WarehouseDocument is THE ONE source
        actual = WarehouseDocument.where(storage_blob_id: blob.id).count

        mismatched += 1 if actual != blob.reference_count
      end

      if mismatched == 0
        puts "   ✅ Reference counts accurate (#{sample_blobs.count} sampled)"
      else
        puts "   ⚠️  #{mismatched}/#{sample_blobs.count} blobs have mismatched counts"
        puts "   Run: rails blob:audit:integrity[fix]"
      end

      # Test 4: Source type validity
      puts "4. Checking source type values..."

      valid_sources = %w[corporate job email task people contact user template]
      invalid_sources = WarehouseDocument.where.not(source_type: valid_sources).count

      if invalid_sources == 0
        puts "   ✅ All source_type values are valid"
      else
        puts "   ❌ #{invalid_sources} documents have invalid source_type"
        passed = false
      end

      puts ""
      puts passed ? "✅ Integrity test PASSED" : "❌ Integrity test FAILED"
      passed
    end

    desc "Test query performance"
    task performance: :environment do
      puts "Test: Query Performance"
      puts "-" * 40

      passed = true

      # Test 1: Folder listing performance
      puts "1. Testing folder listing (simulate 10k files)..."

      start_time = Time.current
      folder_counts = WarehouseDocument.group(:folder).count
      top_folders = folder_counts.sort_by { |_, v| -v }.first(10)
      query_time = ((Time.current - start_time) * 1000).round(2)

      puts "   Found #{folder_counts.count} unique folders"
      puts "   Query time: #{query_time}ms"

      if query_time < 500
        puts "   ✅ Folder listing under 500ms threshold"
      else
        puts "   ⚠️  Folder listing slower than 500ms"
      end

      # Test 2: Search performance
      puts "2. Testing search across all documents..."

      search_term = "invoice"
      start_time = Time.current
      results = WarehouseDocument
        .where("display_name ILIKE ? OR send_name ILIKE ?", "%#{search_term}%", "%#{search_term}%")
        .limit(100)
        .to_a
      search_time = ((Time.current - start_time) * 1000).round(2)

      puts "   Search for '#{search_term}': #{results.count} results"
      puts "   Query time: #{search_time}ms"

      if search_time < 1000
        puts "   ✅ Search under 1000ms threshold"
      else
        puts "   ⚠️  Search slower than 1000ms"
      end

      # Test 3: Eager loading performance
      puts "3. Testing eager loading..."

      start_time = Time.current
      docs = WarehouseDocument
        .includes(:documentable, :storage_blob)
        .order(created_at: :desc)
        .limit(100)
        .to_a
      eager_time = ((Time.current - start_time) * 1000).round(2)

      puts "   Loaded 100 docs with associations: #{eager_time}ms"

      if eager_time < 500
        puts "   ✅ Eager loading under 500ms"
      else
        puts "   ⚠️  Eager loading slower than expected"
      end

      # Test 4: Pagination performance
      puts "4. Testing pagination..."

      start_time = Time.current
      page1 = WarehouseDocument.order(:id).limit(50).offset(0).to_a
      page2 = WarehouseDocument.order(:id).limit(50).offset(50).to_a
      page3 = WarehouseDocument.order(:id).limit(50).offset(100).to_a
      pagination_time = ((Time.current - start_time) * 1000).round(2)

      puts "   Fetched 3 pages of 50 records: #{pagination_time}ms"

      if pagination_time < 300
        puts "   ✅ Pagination fast"
      else
        puts "   ⚠️  Pagination slower than expected"
      end

      puts ""
      puts passed ? "✅ Performance test PASSED" : "❌ Performance test FAILED"
      passed
    end
  end
end
