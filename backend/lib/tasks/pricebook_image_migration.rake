# frozen_string_literal: true

namespace :pricebook do
  desc "Migrate pricebook images to blob storage (3 steps: link WD blobs, SharePoint download, URL download)"
  task migrate_images: :environment do
    dry_run = ENV["DRY_RUN"] != "false"

    puts "\n" + "=" * 80
    puts "PRICEBOOK IMAGE MIGRATION TO BLOB STORAGE"
    puts "=" * 80
    puts "Mode: #{dry_run ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (will update database)'}"
    puts "=" * 80 + "\n"

    tenant = Tenant.first
    unless tenant
      puts "No tenant found. Aborting."
      next
    end

    ActsAsTenant.with_tenant(tenant) do
      stats = {
        step1_matched: 0,
        step1_linked: 0,
        step1_skipped: 0,
        step2_downloaded: 0,
        step2_skipped: 0,
        step2_errors: 0,
        step3_downloaded: 0,
        step3_skipped: 0,
        step3_errors: 0
      }

      # ══════════════════════════════════════════════════════════════
      # STEP 1: Link existing WarehouseDocument blobs (~83 items)
      # These blobs already exist in Wasabi - just need to link them
      # ══════════════════════════════════════════════════════════════
      puts "\n" + "-" * 60
      puts "STEP 1: Link existing WarehouseDocument blobs"
      puts "-" * 60

      # Find WDs in Pricebook Photos folder that have storage blobs
      wd_with_blobs = WarehouseDocument.where("folder_path ILIKE ?", "%Pricebook Photos%")
                                        .where.not(storage_blob_id: nil)

      puts "Found #{wd_with_blobs.count} WarehouseDocuments in Pricebook Photos with blobs"

      # Build lookup: filename (sans extension, downcased) → storage_blob_id
      blob_lookup = {}
      wd_with_blobs.find_each do |wd|
        filename = wd.original_filename.presence || wd.ui_name
        next unless filename

        name_without_ext = File.basename(filename, File.extname(filename)).downcase.strip
        blob_lookup[name_without_ext] = wd.storage_blob_id
      end

      puts "Built lookup with #{blob_lookup.size} unique filenames"

      # Find items without blob that might match
      items_without_blob = PricebookItem.where(image_storage_blob_id: nil)
                                         .where.not(image_url: nil)

      items_without_blob.find_each do |item|
        # Try matching item_name (downcased) to WD filename
        item_key = item.item_name&.downcase&.strip
        next unless item_key

        blob_id = blob_lookup[item_key]

        # Also try item_code
        blob_id ||= blob_lookup[item.item_code&.downcase&.strip]

        if blob_id
          stats[:step1_matched] += 1

          if dry_run
            puts "  [DRY RUN] Would link #{item.item_code} → blob #{blob_id}"
          else
            item.update!(image_storage_blob_id: blob_id, image_source: "blob")
            stats[:step1_linked] += 1
          end
        else
          stats[:step1_skipped] += 1
        end
      end

      puts "\nStep 1 Results:"
      puts "  Matched: #{stats[:step1_matched]}"
      puts "  Linked: #{stats[:step1_linked]}" unless dry_run
      puts "  No match: #{stats[:step1_skipped]}"

      # ══════════════════════════════════════════════════════════════
      # STEP 2: Download SharePoint images → create blobs (~222 items)
      # Items with image_file_id but no blob yet
      # ══════════════════════════════════════════════════════════════
      puts "\n" + "-" * 60
      puts "STEP 2: Download SharePoint images and create blobs"
      puts "-" * 60

      items_with_sp = PricebookItem.where(image_storage_blob_id: nil)
                                    .where.not(image_file_id: [nil, ""])

      total_sp = items_with_sp.count
      puts "Found #{total_sp} items with SharePoint file_id but no blob"

      if total_sp > 0 && !dry_run
        # Use DocumentProviders::SharePoint for downloading (app-level auth)
        begin
          provider = DocumentProviders.for_tenant(tenant)
          sp_available = provider.is_a?(DocumentProviders::SharePoint)

          unless sp_available
            puts "  Current provider is #{provider.class}, not SharePoint. Trying SharePoint credential directly..."
            cred = MicrosoftCredential.sharepoint_credential
            if cred&.valid_credential?
              client = MicrosoftGraphClient.new(cred)
              sp_available = true
            else
              puts "  No valid SharePoint credential found. Skipping Step 2."
            end
          end

          if sp_available
            items_with_sp.find_each.with_index do |item, idx|
              begin
                # Download file content from SharePoint
                content = if provider.is_a?(DocumentProviders::SharePoint)
                  provider.download_file(item.image_file_id)
                else
                  client.get_file_content(item.image_file_id)
                end

                # Detect content type from URL extension
                ext = File.extname(item.image_url.to_s).downcase
                content_type = case ext
                when ".jpg", ".jpeg" then "image/jpeg"
                when ".png" then "image/png"
                when ".gif" then "image/gif"
                when ".webp" then "image/webp"
                else "image/jpeg"
                end

                filename = "#{item.item_code}#{ext.presence || '.jpg'}"

                # Create blob (deduplicates by content hash)
                blob = StorageBlob.find_or_create_for_content!(
                  content,
                  filename: filename,
                  content_type: content_type
                )

                item.update!(image_storage_blob_id: blob.id, image_source: "blob")
                stats[:step2_downloaded] += 1

                puts "  [#{idx + 1}/#{total_sp}] #{item.item_code} → blob #{blob.id}" if (idx + 1) % 25 == 0

                # Rate limiting for SharePoint
                sleep(0.5)

              rescue => e
                stats[:step2_errors] += 1
                puts "  Error #{item.item_code}: #{e.message}"
              end
            end
          end
        rescue => e
          puts "  SharePoint setup failed: #{e.message}"
          puts "  Skipping Step 2."
        end
      elsif dry_run
        puts "  [DRY RUN] Would download #{total_sp} images from SharePoint"
        stats[:step2_skipped] = total_sp
      end

      puts "\nStep 2 Results:"
      puts "  Downloaded & linked: #{stats[:step2_downloaded]}"
      puts "  Errors: #{stats[:step2_errors]}"
      puts "  Skipped (dry run): #{stats[:step2_skipped]}" if dry_run

      # ══════════════════════════════════════════════════════════════
      # STEP 3: Download URL-only images → create blobs
      # Items with image_url but no file_id and no blob
      # ══════════════════════════════════════════════════════════════
      puts "\n" + "-" * 60
      puts "STEP 3: Download URL-only images and create blobs"
      puts "-" * 60

      items_url_only = PricebookItem.where(image_storage_blob_id: nil)
                                     .where(image_file_id: [nil, ""])
                                     .where.not(image_url: [nil, ""])

      total_url = items_url_only.count
      puts "Found #{total_url} items with URL only (no file_id, no blob)"

      if total_url > 0 && !dry_run
        items_url_only.find_each.with_index do |item, idx|
          begin
            response = HTTParty.get(
              item.image_url,
              follow_redirects: true,
              timeout: 30,
              headers: { "User-Agent" => "TEEEM/1.0" }
            )

            unless response.success?
              stats[:step3_errors] += 1
              puts "  HTTP #{response.code} for #{item.item_code}"
              next
            end

            content = response.body.force_encoding(Encoding::ASCII_8BIT)

            # Detect content type from response or URL
            content_type = response.content_type&.split(";")&.first
            ext = File.extname(URI.parse(item.image_url).path).downcase rescue ".jpg"
            content_type ||= case ext
            when ".jpg", ".jpeg" then "image/jpeg"
            when ".png" then "image/png"
            when ".gif" then "image/gif"
            when ".webp" then "image/webp"
            else "image/jpeg"
            end

            filename = "#{item.item_code}#{ext.presence || '.jpg'}"

            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: filename,
              content_type: content_type
            )

            item.update!(image_storage_blob_id: blob.id, image_source: "blob")
            stats[:step3_downloaded] += 1

            puts "  [#{idx + 1}/#{total_url}] #{item.item_code} → blob #{blob.id}" if (idx + 1) % 10 == 0

            # Brief pause between HTTP requests
            sleep(0.3)

          rescue => e
            stats[:step3_errors] += 1
            puts "  Error #{item.item_code}: #{e.message}"
          end
        end
      elsif dry_run
        puts "  [DRY RUN] Would download #{total_url} images from URLs"
        stats[:step3_skipped] = total_url
      end

      puts "\nStep 3 Results:"
      puts "  Downloaded & linked: #{stats[:step3_downloaded]}"
      puts "  Errors: #{stats[:step3_errors]}"
      puts "  Skipped (dry run): #{stats[:step3_skipped]}" if dry_run

      # ══════════════════════════════════════════════════════════════
      # SUMMARY
      # ══════════════════════════════════════════════════════════════
      puts "\n" + "=" * 80
      puts "MIGRATION SUMMARY"
      puts "=" * 80

      total_before = PricebookItem.where.not(image_storage_blob_id: nil).count
      total_with_image = PricebookItem.where.not(image_url: nil).count
      total_items = PricebookItem.count

      puts "  Total items: #{total_items}"
      puts "  Items with any image: #{total_with_image}"
      puts "  Items on blob storage: #{total_before}"
      puts "  Items still on legacy: #{total_with_image - total_before}"
      puts ""
      puts "  Step 1 (WD link): #{stats[:step1_matched]} matched, #{stats[:step1_linked]} linked"
      puts "  Step 2 (SharePoint): #{stats[:step2_downloaded]} downloaded"
      puts "  Step 3 (URL): #{stats[:step3_downloaded]} downloaded"
      puts "  Total errors: #{stats[:step2_errors] + stats[:step3_errors]}"

      if dry_run
        puts "\n⚠️  DRY RUN COMPLETE - No changes were made"
        puts "Run with DRY_RUN=false to apply:"
        puts "  rails pricebook:migrate_images DRY_RUN=false"
      else
        puts "\n✅ Migration complete!"
      end

      puts "=" * 80 + "\n"
    end
  end
end
