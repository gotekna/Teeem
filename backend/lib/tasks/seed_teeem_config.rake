# frozen_string_literal: true

# Rake task to seed TEEEM (master tenant) with config from Tekna
#
# TEEEM is the platform/software company - it has no business data.
# This task copies config tables from Tekna (the primary customer) to TEEEM
# so that TEEEM can serve as the "master config" source for other tenants.
#
# Usage:
#   rails teeem:seed_config              # Preview (dry run)
#   rails teeem:seed_config[execute]     # Actually copy the data
#
namespace :teeem do
  desc "Seed TEEEM master tenant with config from Tekna"
  task :seed_config, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "preview"
    execute = mode == "execute"

    puts "=" * 60
    puts execute ? "EXECUTING: Seeding TEEEM config from Tekna" : "PREVIEW: Seeding TEEEM config from Tekna (pass 'execute' to run)"
    puts "=" * 60
    puts

    teeem_tenant = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    tekna_tenant = Tenant.find_by(slug: "tekna")

    unless teeem_tenant
      puts "ERROR: TEEEM tenant not found (is_master_tenant: true)"
      exit 1
    end

    unless tekna_tenant
      puts "ERROR: Tekna tenant not found (slug: tekna)"
      exit 1
    end

    puts "Source: #{tekna_tenant.name} (ID: #{tekna_tenant.id})"
    puts "Target: #{teeem_tenant.name} (ID: #{teeem_tenant.id})"
    puts

    # Phase 1: Copy standalone config tables (no FK dependencies)
    standalone_tables = {
      job_types: { model: JobType, match: :name, exclude: [:sm_schedule_master_template_id] },
      job_statuses: { model: JobStatus, match: :name },
      job_stages: { model: JobStage, match: :name },
      document_types: { model: DocumentType, match: [:name, :scope] },
      document_templates: { model: DocumentTemplate, match: :name },
      contact_types: { model: ContactType, match: :name },
      sm_schedule_master_templates: { model: SmScheduleMasterTemplate, match: :name },
      sm_trades: { model: SmTrade, match: :name },
      meeting_types: { model: MeetingType, match: :name },
      pricebook_categories: { model: PricebookCategory, match: :name, exclude: [:parent_id] },
      public_holidays: { model: PublicHoliday, match: [:name, :date] }
    }

    # Phase 2: Copy tables with FK dependencies (after phase 1)
    dependent_tables = {
      sm_schedule_masters: {
        model: SmScheduleMaster,
        match: :task_number,
        remap: {
          sm_schedule_master_template_id: { model: SmScheduleMasterTemplate, match: :name }
        }
      },
      job_type_statuses: {
        model: JobTypeStatus,
        match: [:job_type_id, :job_status_id],
        remap: {
          job_type_id: { model: JobType, match: :name },
          job_status_id: { model: JobStatus, match: :name }
        }
      },
      job_status_stages: {
        model: JobStatusStage,
        match: [:job_type_id, :job_status_id, :job_stage_id],
        remap: {
          job_type_id: { model: JobType, match: :name },
          job_status_id: { model: JobStatus, match: :name },
          job_stage_id: { model: JobStage, match: :name }
        }
      }
    }

    total_copied = 0
    total_skipped = 0
    total_errors = 0
    id_maps = {} # Store source_id → target_id mappings

    # Helper to copy records
    copy_records = lambda do |table_name, config|
      model = config[:model]
      exclude_cols = config[:exclude] || []
      remap_cols = config[:remap] || {}

      # Get source records from Tekna
      source_records = ActsAsTenant.with_tenant(tekna_tenant) { model.all.to_a }

      # Get existing TEEEM records for matching
      existing_records = ActsAsTenant.with_tenant(teeem_tenant) { model.all.to_a }

      # Build match index for existing records
      match_fields = Array(config[:match])
      existing_index = existing_records.index_by do |r|
        match_fields.map { |f| r.send(f) }.join("|")
      end

      copied = 0
      skipped = 0
      errors = 0
      id_maps[model.name] ||= {}

      source_records.each do |source|
        match_key = match_fields.map { |f| source.send(f) }.join("|")
        existing = existing_index[match_key]

        if existing
          # Store ID mapping for dependent tables
          id_maps[model.name][source.id] = existing.id
          skipped += 1
          next
        end

        if execute
          begin
            ActsAsTenant.with_tenant(teeem_tenant) do
              attrs = source.attributes.except(
                "id", "created_at", "updated_at", "tenant_id", "company_group_id",
                *exclude_cols.map(&:to_s)
              )

              # Remap foreign keys
              remap_cols.each do |fk_col, remap_config|
                old_id = attrs[fk_col.to_s]
                next unless old_id

                remap_model = remap_config[:model]
                remap_match = remap_config[:match]

                # Find source record to get match value
                source_fk = ActsAsTenant.with_tenant(tekna_tenant) { remap_model.find_by(id: old_id) }
                next unless source_fk

                match_val = source_fk.send(remap_match)

                # Find target record in TEEEM
                target_fk = remap_model.find_by(remap_match => match_val)
                attrs[fk_col.to_s] = target_fk&.id
              end

              new_record = model.new(attrs)
              new_record.save!

              # Store ID mapping
              id_maps[model.name][source.id] = new_record.id
            end
          rescue => e
            puts "  ERROR copying #{model.name} #{source.id}: #{e.message}"
            errors += 1
          end
        else
          # Preview mode - still track that we would copy
          id_maps[model.name][source.id] = "NEW"
        end

        copied += 1
      end

      status = errors > 0 ? "⚠️ " : "✓ "
      puts "#{status}#{table_name.to_s.ljust(28)} | Source: #{source_records.count.to_s.rjust(4)} | Copy: #{copied.to_s.rjust(4)} | Skip: #{skipped.to_s.rjust(4)} | Err: #{errors.to_s.rjust(2)}"

      [copied, skipped, errors]
    end

    puts "Phase 1: Standalone tables (no FK dependencies)"
    puts "-" * 60
    standalone_tables.each do |table_name, config|
      copied, skipped, errors = copy_records.call(table_name, config)
      total_copied += copied
      total_skipped += skipped
      total_errors += errors
    end

    puts
    puts "Phase 2: Dependent tables (with FK remapping)"
    puts "-" * 60
    dependent_tables.each do |table_name, config|
      copied, skipped, errors = copy_records.call(table_name, config)
      total_copied += copied
      total_skipped += skipped
      total_errors += errors
    end

    puts
    puts "=" * 60
    puts "Total: #{total_copied} to copy, #{total_skipped} already exist, #{total_errors} errors"
    puts

    if execute
      if total_errors > 0
        puts "⚠️  Config seeding complete with #{total_errors} errors"
      else
        puts "✅ Config seeding complete!"
      end
    else
      puts "👆 This was a PREVIEW. Run with 'execute' to actually copy:"
      puts "   rails teeem:seed_config[execute]"
    end
  end
end
