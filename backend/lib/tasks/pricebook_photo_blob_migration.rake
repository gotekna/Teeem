# Pricebook Photo Blob Migration
#
# Downloads pricebook photos from SharePoint, stores as deduplicated StorageBlobs
# in S3/Wasabi, creates WarehouseDocuments, and links to PricebookItems.
#
# Unmatched photos are classified as either colour swatches (stored under
# "Colour Swatches" folder) or unmatched product photos (stored under
# "Pricebook Photos" folder without a pricebook item link).
#
# Usage:
#   rails pricebook:photos:status                    # Show current state
#   rails pricebook:photos:import                    # Import all photos
#   rails pricebook:photos:import[50]                # Import first 50 photos
#   DRY_RUN=true rails pricebook:photos:import       # Preview without writing
#   rails pricebook:photos:verify                    # Verify blob integrity

namespace :pricebook do
  namespace :photos do
    # Find the tenant that owns pricebook data (has the most active items)
    def pricebook_tenant
      tenant = Tenant.find_by(name: "Tekna") || Tenant.joins("INNER JOIN pricebooks ON pricebooks.tenant_id = tenants.id")
                                                       .group("tenants.id")
                                                       .order("COUNT(*) DESC")
                                                       .first || Tenant.first
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      tenant
    end

    # Classify an unmatched photo as a colour swatch or product photo.
    # Returns { type: :colour_swatch|:product_photo, brand:, colour_name: }
    def classify_photo(filename)
      base = File.basename(filename, File.extname(filename)).strip

      # 512x512 pattern - Colorbond, Austral, roof profiles, designer ranges
      if base.match?(/512\s*x?\s*512/i)
        colour = base.gsub(/\s*-?\s*matt\s*fin[is]*h?\s*/i, "")
                     .gsub(/\s*512\s*x?\s*512\s*/i, "")
                     .gsub(/\s*-\s*\d+\s*/, "")       # hex codes like "- 000000"
                     .gsub(/\s*\(\d+\)\s*$/, "")       # duplicate markers like "(1)"
                     .strip

        if base.match?(/austral/i)
          brand = "Austral"
          colour = colour.gsub(/austral[_ ]*/i, "").gsub(/_/, " ").strip
        elsif base.match?(/exposed/i)
          brand = "Roof Profile"
          colour = colour.gsub(/-?exposed/i, "").strip
        elsif (m = base.match(/(hamptons|horizons|beachcomber|daytona)/i))
          brand = m[1].capitalize
          colour = colour.gsub(/#{brand}\s*-?\s*/i, "").strip
        else
          brand = "Colorbond"
        end

        { type: :colour_swatch, brand: brand, colour_name: colour }

      # Non-512x512 but known swatch patterns
      elsif base.match?(/profile$/i)
        colour = base.gsub(/\s*profile\s*$/i, "").strip
        { type: :colour_swatch, brand: "Roof Profile", colour_name: colour }
      elsif base.match?(/^austral/i)
        colour = base.gsub(/^austral[_ ]*/i, "").strip
        { type: :colour_swatch, brand: "Austral", colour_name: colour }
      elsif base.match?(/polytec/i)
        colour = base.gsub(/\s*-?\s*polytec\s*/i, "").strip
        { type: :colour_swatch, brand: "Polytec", colour_name: colour }
      elsif base.match?(/lithostonequartz/i)
        { type: :colour_swatch, brand: "Lithostone", colour_name: base.gsub(/lithostonequartz/i, "").strip }
      else
        { type: :product_photo, brand: nil, colour_name: nil }
      end
    end

    # Find or create the "Colour Swatches" WarehouseFolder
    def find_or_create_colour_swatch_folder(warehouse_type)
      folder = WarehouseFolder.for_warehouse_type("warehouse")
                              .find_by("LOWER(name) LIKE ?", "%colour%swatch%")
      unless folder
        folder = WarehouseFolder.create!(
          warehouse_type: warehouse_type,
          name: "Colour Swatches",
          folder_segment: "Colour Swatches",
          tab_type: "photo",
          tab_group: "documents",
          is_photo_category: true,
          enabled: true,
          description: "Material colour swatches (Colorbond, Austral, Roof Profiles, etc.)"
        )
        puts "Created WarehouseFolder: #{folder.name} (ID: #{folder.id})"
      end
      folder
    end

    desc "Show current pricebook photo migration status"
    task status: :environment do
      ActsAsTenant.with_tenant(pricebook_tenant) do
        total_items = PricebookItem.active.count
        with_image_url = PricebookItem.active.where.not(image_url: [nil, ""]).count
        with_image_blob = PricebookItem.active.where.not(image_storage_blob_id: nil).count
        with_file_id = PricebookItem.active.where.not(image_file_id: [nil, ""]).count

        # WarehouseDocument stats
        pricebook_docs = WarehouseDocument.where("metadata->>'category' = ?", "pricebook_photo").count
        colour_swatch_docs = WarehouseDocument.where("metadata->>'category' = ?", "colour_swatch").count
        unmatched_product_docs = WarehouseDocument.where("metadata->>'category' = ?", "unmatched_product").count

        puts "=" * 60
        puts "PRICEBOOK PHOTO MIGRATION STATUS"
        puts "=" * 60
        puts
        puts "PricebookItems (active):     #{total_items}"
        puts "  With image_url:            #{with_image_url}"
        puts "  With image_file_id:        #{with_file_id}"
        puts "  With image_storage_blob:   #{with_image_blob}"
        puts "  Without blob (to migrate): #{with_file_id - with_image_blob}"
        puts
        puts "WarehouseDocuments:"
        puts "  Pricebook photos:          #{pricebook_docs}"
        puts "  Colour swatches:           #{colour_swatch_docs}"
        puts "  Unmatched products:        #{unmatched_product_docs}"
        puts
        puts "=" * 60
      end
    end

    desc "Import pricebook photos from SharePoint to S3 blobs"
    task :import, [:limit] => :environment do |_t, args|
      limit = args[:limit]&.to_i
      dry_run = ENV["DRY_RUN"] == "true"

      ActsAsTenant.with_tenant(pricebook_tenant) do
        puts "=" * 60
        puts "PRICEBOOK PHOTO BLOB MIGRATION"
        puts "Mode: #{dry_run ? 'DRY RUN (no DB writes)' : 'LIVE'}"
        puts "Limit: #{limit || 'ALL'}"
        puts "=" * 60
        puts

        # 1. Look up or create WarehouseFolders (SSoT for folder_path)
        wt = WarehouseType.find_by_code("warehouse")
        unless wt
          puts "ERROR: 'warehouse' WarehouseType not found!"
          exit 1
        end

        pricebook_wf = WarehouseFolder.for_warehouse_type("warehouse")
                                      .find_by("LOWER(name) LIKE ?", "%pricebook%photo%")
        unless pricebook_wf
          pricebook_wf = WarehouseFolder.create!(
            warehouse_type: wt,
            name: "Pricebook Photos",
            folder_segment: "Pricebook Photos",
            tab_type: "photo",
            tab_group: "documents",
            is_photo_category: true,
            enabled: true,
            description: "Product photos for pricebook items"
          )
          puts "Created WarehouseFolder: #{pricebook_wf.name} (ID: #{pricebook_wf.id})"
        end
        puts "WarehouseFolder: #{pricebook_wf.name} (ID: #{pricebook_wf.id})"

        colour_swatch_wf = find_or_create_colour_swatch_folder(wt)
        puts "WarehouseFolder: #{colour_swatch_wf.name} (ID: #{colour_swatch_wf.id})"
        puts

        # 2. Connect to SharePoint
        client = MicrosoftAppGraphClient.new
        puts "Navigating SharePoint folder structure..."

        sites = client.get_all_sites
        teeem_site = sites.find { |s| s[:display_name]&.include?("TEEEM") || s[:name]&.include?("teeem") }
        raise "TEEEM site not found in SharePoint" unless teeem_site

        drives = client.get_site_drives(teeem_site[:id])
        main_drive = drives.first
        raise "No drive found in TEEEM site" unless main_drive
        drive_id = main_drive[:id]

        # Navigate to Warehousing/Pricebook Photos
        root_items = client.list_drive_items(drive_id)
        warehousing = root_items.find { |item| item[:is_folder] && item[:name]&.downcase&.include?("warehous") }
        raise "Warehousing folder not found in SharePoint" unless warehousing

        warehousing_contents = client.list_drive_items(drive_id, folder_id: warehousing[:id])
        pricebook_folder = warehousing_contents.find { |item| item[:is_folder] && item[:name]&.downcase&.include?("pricebook") }
        raise "Pricebook Photos folder not found in SharePoint" unless pricebook_folder

        # 3. List all photos
        all_files = client.list_drive_items(drive_id, folder_id: pricebook_folder[:id], top: 500)
        photos = all_files.reject { |f| f[:is_folder] }
        puts "Found #{photos.size} files in SharePoint Pricebook Photos folder"

        photos = photos.first(limit) if limit
        puts "Processing #{photos.size} files#{limit ? " (limited)" : ""}..."
        puts

        # 4. Load pricebook items for matching
        sync_service = PricebookPhotoSyncService.new
        pricebook_items = PricebookItem.active.index_by(&:item_code)
        puts "Loaded #{pricebook_items.size} active pricebook items for matching"
        puts

        # 5. Process each photo
        stats = {
          processed: 0,
          downloaded: 0,
          blobs_created: 0,
          blobs_reused: 0,
          docs_created: 0,
          docs_existed: 0,
          items_linked: 0,
          matched: 0,
          colour_swatches: 0,
          unmatched_products: 0,
          errors: 0,
          skipped_qr: 0
        }
        unmatched_files = []

        photos.each_with_index do |photo, idx|
          stats[:processed] += 1

          # Skip QR code files
          if photo[:name].match?(/^qrcode_/i) || photo[:name].match?(/\bqr\b/i)
            stats[:skipped_qr] += 1
            next
          end

          begin
            # Match to pricebook item
            match_result = sync_service.match_photo_to_item(photo, pricebook_items)

            if match_result[:matched]
              stats[:matched] += 1
              matched_item = match_result[:item]
              strategy = match_result[:match_strategy]
              confidence = match_result[:confidence]
              category = "pricebook_photo"
              target_folder = pricebook_wf
              doc_metadata = {
                "sharepoint_item_id" => photo[:id],
                "sharepoint_web_url" => photo[:web_url],
                "category" => category,
                "match_strategy" => strategy,
                "match_confidence" => confidence
              }
            else
              # Classify unmatched photos as colour swatches or product photos
              classification = classify_photo(photo[:name])
              matched_item = nil

              if classification[:type] == :colour_swatch
                stats[:colour_swatches] += 1
                category = "colour_swatch"
                target_folder = colour_swatch_wf
                strategy = "colour_swatch"
                confidence = "auto"
                doc_metadata = {
                  "sharepoint_item_id" => photo[:id],
                  "sharepoint_web_url" => photo[:web_url],
                  "category" => category,
                  "brand" => classification[:brand],
                  "colour_name" => classification[:colour_name],
                  "match_strategy" => strategy,
                  "match_confidence" => confidence
                }
              else
                stats[:unmatched_products] += 1
                unmatched_files << photo[:name]
                category = "unmatched_product"
                target_folder = pricebook_wf
                strategy = "none"
                confidence = "none"
                doc_metadata = {
                  "sharepoint_item_id" => photo[:id],
                  "sharepoint_web_url" => photo[:web_url],
                  "category" => category,
                  "match_strategy" => strategy,
                  "match_confidence" => confidence
                }
              end
            end

            if dry_run
              case category
              when "pricebook_photo"
                status = "MATCH (#{strategy}/#{confidence}) → #{matched_item.item_code}"
              when "colour_swatch"
                status = "SWATCH [#{classification[:brand]}] #{classification[:colour_name]}"
              else
                status = "UNMATCHED PRODUCT"
              end
              puts "  [DRY] #{photo[:name]} → #{status}"
              next
            end

            # Download from SharePoint (ALL photos get stored)
            content = client.get_drive_item_content(drive_id: drive_id, item_id: photo[:id])
            stats[:downloaded] += 1

            # Create StorageBlob with content-hash dedup + S3 upload
            content_type = determine_content_type(photo[:name])
            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: photo[:name],
              content_type: content_type
            )

            if blob.previously_new_record? || blob.created_at > 1.minute.ago
              stats[:blobs_created] += 1
            else
              stats[:blobs_reused] += 1
            end

            # Create WarehouseDocument (idempotent via sharepoint_item_id)
            doc = WarehouseDocumentCreator.find_or_create!(
              find_by: {
                source_type: "warehouse",
                metadata_match: { "sharepoint_item_id" => photo[:id] }
              },
              filename: photo[:name],
              source_type: "warehouse",
              storage_blob: blob,
              linkable: matched_item,
              warehouse_folder_id: target_folder.id,
              file_size: content.bytesize,
              content_type: content_type,
              metadata: doc_metadata
            )

            if doc.previously_new_record? || doc.created_at > 1.minute.ago
              stats[:docs_created] += 1
              blob.increment_reference!
            else
              stats[:docs_existed] += 1
            end

            # Link blob to PricebookItem (only for matched product photos)
            if matched_item && matched_item.image_storage_blob_id != blob.id
              matched_item.update!(
                image_storage_blob_id: blob.id,
                image_source: "blob",
                image_fetch_status: "success",
                photo_attached: true
              )
              stats[:items_linked] += 1
            end

            case category
            when "pricebook_photo"
              status = "→ #{matched_item.item_code} (#{strategy})"
            when "colour_swatch"
              status = "→ Colour Swatch [#{doc_metadata["brand"]}] #{doc_metadata["colour_name"]}"
            else
              status = "→ Unmatched product (stored)"
            end
            puts "  [#{idx + 1}/#{photos.size}] #{photo[:name]} #{status}"

          rescue => e
            stats[:errors] += 1
            puts "  [ERROR] #{photo[:name]}: #{e.message}"
            Rails.logger.error "[PricebookPhotoBlobMigration] Error processing #{photo[:name]}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
          end

          # Progress log every 10 items
          if (idx + 1) % 10 == 0
            puts "  --- Progress: #{idx + 1}/#{photos.size} (#{stats[:matched]} matched, #{stats[:colour_swatches]} swatches, #{stats[:errors]} errors) ---"
          end

          # Rate limit to avoid SharePoint throttling
          sleep 0.5 unless dry_run
        end

        # 6. Summary
        puts
        puts "=" * 60
        puts "MIGRATION SUMMARY (#{dry_run ? 'DRY RUN' : 'LIVE'})"
        puts "=" * 60
        puts "Files processed:       #{stats[:processed]}"
        puts "QR codes skipped:      #{stats[:skipped_qr]}"
        puts "Matched to items:      #{stats[:matched]}"
        puts "Colour swatches:       #{stats[:colour_swatches]}"
        puts "Unmatched products:    #{stats[:unmatched_products]}"
        unless dry_run
          puts "Downloaded:            #{stats[:downloaded]}"
          puts "Blobs created (new):   #{stats[:blobs_created]}"
          puts "Blobs reused (dedup):  #{stats[:blobs_reused]}"
          puts "Docs created:          #{stats[:docs_created]}"
          puts "Docs already existed:  #{stats[:docs_existed]}"
          puts "Items linked to blob:  #{stats[:items_linked]}"
        end
        puts "Errors:                #{stats[:errors]}"
        puts

        if unmatched_files.any?
          puts "UNMATCHED PRODUCT PHOTOS (#{unmatched_files.size}):"
          puts "(These are stored under Pricebook Photos without a pricebook item link)"
          unmatched_files.each { |f| puts "  - #{f}" }
          puts
        end

        puts "=" * 60
      end
    end

    desc "Verify all pricebook photo blobs exist in storage"
    task verify: :environment do
      ActsAsTenant.with_tenant(pricebook_tenant) do
        items = PricebookItem.active.where.not(image_storage_blob_id: nil).includes(:image_storage_blob)
        puts "Verifying #{items.count} pricebook items with image blobs..."
        puts

        missing = 0
        verified = 0
        errors = 0

        items.find_each do |item|
          blob = item.image_storage_blob
          unless blob
            puts "  [MISSING BLOB] Item #{item.item_code} (ID: #{item.id}) - blob record not found"
            missing += 1
            next
          end

          begin
            provider = StorageBlob.storage_provider
            if provider.file_exists?(blob.storage_path)
              verified += 1
              blob.mark_verified! if blob.verified_at.nil?
            else
              puts "  [MISSING FILE] Item #{item.item_code} - blob #{blob.id} path: #{blob.storage_path}"
              missing += 1
            end
          rescue => e
            puts "  [ERROR] Item #{item.item_code}: #{e.message}"
            errors += 1
          end
        end

        puts
        puts "=" * 60
        puts "VERIFICATION RESULTS"
        puts "=" * 60
        puts "Total checked:   #{items.count}"
        puts "Verified OK:     #{verified}"
        puts "Missing files:   #{missing}"
        puts "Errors:          #{errors}"
        puts "=" * 60
      end
    end
  end
end

def determine_content_type(filename)
  case File.extname(filename).downcase
  when ".jpg", ".jpeg" then "image/jpeg"
  when ".png" then "image/png"
  when ".gif" then "image/gif"
  when ".webp" then "image/webp"
  when ".svg" then "image/svg+xml"
  when ".bmp" then "image/bmp"
  when ".tiff", ".tif" then "image/tiff"
  else "application/octet-stream"
  end
end
