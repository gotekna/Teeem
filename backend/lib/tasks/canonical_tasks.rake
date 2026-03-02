# frozen_string_literal: true

# Canonical Tasks - Seed, link, and manage canonical SM records
#
# Usage:
#   rails canonical:seed         # Create canonical records from TEEEM master
#   rails canonical:link         # Link existing tenant records to canonical
#   rails canonical:setup_group  # Add TEEEM, Tekna, Pilgrim to sync group
#   rails canonical:status       # Show canonical sync status
#   rails canonical:full_setup   # Run all steps in order

namespace :canonical do
  desc "Create canonical records from TEEEM master's canonical templates"
  task seed: :environment do
    master = find_master_tenant!
    puts "Seeding canonical records from master tenant: #{master.name} (id: #{master.id})"

    ActsAsTenant.with_tenant(master) do
      # Seed lookup tables first (trades, stages, etc.) — these are shared regardless of template
      seed_lookup_tables(master)

      # Seed templates and their tasks
      seed_templates_and_tasks(master)
    end

    puts "\nCanonical seed complete!"
    print_status
  end

  desc "Link existing tenant records to canonical by sync_key"
  task link: :environment do
    master = find_master_tenant!

    # Find all tenants that are sync group members
    members = CanonicalSyncGroupMember.active.includes(:tenant)
    if members.empty?
      puts "No sync group members found. Run canonical:setup_group first."
      next
    end

    members.each do |member|
      next if member.tenant_id == master.id # Master was linked during seed

      tenant = member.tenant
      puts "\nLinking tenant: #{tenant.name} (id: #{tenant.id})"

      ActsAsTenant.with_tenant(tenant) do
        link_tenant_records(tenant)
      end
    end

    puts "\nLinking complete!"
    print_status
  end

  desc "Add TEEEM, Tekna, Pilgrim to canonical sync group as bidirectional"
  task setup_group: :environment do
    # Find tenants by slug
    %w[teeem tekna pilgrim].each do |slug|
      tenant = Tenant.find_by(slug: slug)
      if tenant.nil?
        # Try by name (case-insensitive)
        tenant = Tenant.where("LOWER(name) LIKE ?", "%#{slug}%").first
      end

      if tenant.nil?
        puts "WARNING: Could not find tenant with slug '#{slug}'. Skipping."
        next
      end

      member = CanonicalSyncGroupMember.find_or_initialize_by(tenant_id: tenant.id)
      member.sync_direction = "bidirectional"
      member.is_active = true
      member.save!

      puts "Added #{tenant.name} (id: #{tenant.id}) as bidirectional sync member"
    end

    puts "\nSync group setup complete!"
    puts "Members: #{CanonicalSyncGroupMember.active.count}"
  end

  desc "Show canonical sync status"
  task status: :environment do
    print_status
  end

  desc "Run full canonical setup (seed → setup_group → link)"
  task full_setup: :environment do
    Rake::Task["canonical:seed"].invoke
    Rake::Task["canonical:setup_group"].invoke
    Rake::Task["canonical:link"].invoke
  end

  desc "Push local-only tasks from bidirectional tenants to canonical (and enqueue propagation to other tenants)"
  task push_local_only: :environment do
    members = CanonicalSyncGroupMember.bidirectional.includes(:tenant)

    if members.empty?
      puts "No bidirectional sync group members found. Run canonical:setup_group first."
      next
    end

    total_pushed = 0
    total_linked = 0

    members.each do |member|
      tenant = member.tenant
      puts "\nProcessing tenant: #{tenant.name} (id: #{tenant.id})"

      ActsAsTenant.with_tenant(tenant) do
        local_only = SmScheduleMaster.where(canonical_record_id: nil).where(is_active: true)
        puts "  Found #{local_only.count} local-only tasks"
        next if local_only.empty?

        # Build map of available canonical templates for composite key generation
        canonical_templates = SmScheduleMasterTemplate
          .where.not(canonical_record_id: nil)
          .joins("INNER JOIN sm_canonical_records ON sm_canonical_records.id = sm_schedule_master_templates.canonical_record_id")
          .select("sm_schedule_master_templates.id, sm_canonical_records.sync_key AS canonical_sync_key")

        canonical_template_sk_by_id = canonical_templates.each_with_object({}) do |t, h|
          h[t.id] = t.canonical_sync_key
        end

        local_only.find_each do |task|
          task_sk = task.sync_key || ConfigSyncable.build_sync_key(task.name)

          # Pick composite key if task belongs to a canonical template
          tpl_sk = (task.sm_template_ids || []).filter_map { |tid| canonical_template_sk_by_id[tid] }.first
          composite_sk = tpl_sk ? "#{tpl_sk}--#{task_sk}" : task_sk

          # Find or create canonical
          existing = SmCanonicalRecord.find_by(record_type: "SmScheduleMaster", sync_key: composite_sk)

          if existing
            task.update_columns(canonical_record_id: existing.id, canonical_version: existing.version)
            puts "    Linked (already exists): #{task.name} → #{composite_sk}"
            total_linked += 1
          else
            ActsAsTenant.with_tenant(tenant) do
              canonical = SmCanonicalRecord.create_from_local!(task, sync_key: composite_sk)
              task.update_columns(canonical_record_id: canonical.id, canonical_version: canonical.version)

              all_fields = (SmCanonicalRecord::INHERITABLE_FIELDS["SmScheduleMaster"] || []) +
                           (SmCanonicalRecord::FK_FIELDS["SmScheduleMaster"] || [])
              CanonicalRecordPropagationJob.perform_later(canonical.id, all_fields, tenant.id)
            end
            puts "    Pushed: #{task.name} → #{composite_sk}"
            total_pushed += 1
          end
        rescue => e
          puts "    ERROR pushing #{task.name}: #{e.message}"
        end
      end
    end

    puts "\n=== push_local_only complete ==="
    puts "  Pushed (new canonical): #{total_pushed}"
    puts "  Linked (existing canonical): #{total_linked}"
  end

  # ---------------------------------------------------------------------------
  # Helper methods
  # ---------------------------------------------------------------------------

  def find_master_tenant!
    tenant = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    raise "Master tenant not found! Expected is_master_tenant=true or slug='teeem'" unless tenant
    tenant
  end

  def seed_lookup_tables(master)
    lookup_types = {
      "SmTrade" => SmTrade,
      "SmStage" => SmStage,
      "SmTaskGroup" => SmTaskGroup,
      "SmHoldReason" => SmHoldReason,
      "SmResource" => SmResource,
      "BpmnProcess" => BpmnProcess
    }

    lookup_types.each do |type_name, model|
      records = model.all
      created = 0
      skipped = 0

      records.find_each do |record|
        sk = record.sync_key || ConfigSyncable.build_sync_key(record.name)

        existing = SmCanonicalRecord.find_by(record_type: type_name, sync_key: sk)
        if existing
          skipped += 1
          # Link master's record to canonical
          record.update_columns(canonical_record_id: existing.id, canonical_version: existing.version) unless record.canonical_record_id
          next
        end

        canonical = SmCanonicalRecord.create_from_local!(record, sync_key: sk)
        record.update_columns(canonical_record_id: canonical.id, canonical_version: canonical.version)
        created += 1
      end

      puts "  #{type_name}: #{created} created, #{skipped} skipped (already exist)"
    end
  end

  def seed_templates_and_tasks(master)
    # Find templates marked as canonical (or the default/Databuild template)
    templates = SmScheduleMasterTemplate.where(is_canonical: true)

    if templates.empty?
      # Auto-detect: use default template or one named "Databuild"
      templates = SmScheduleMasterTemplate.where(is_default: true)
      if templates.empty?
        templates = SmScheduleMasterTemplate.where("LOWER(name) LIKE ?", "%databuild%")
      end

      if templates.empty?
        puts "  No canonical templates found. Mark templates with is_canonical=true first."
        return
      end

      puts "  Auto-detected templates: #{templates.map(&:name).join(', ')}"
      puts "  Marking them as canonical..."
      templates.update_all(is_canonical: true)
    end

    templates.each do |template|
      puts "\n  Template: #{template.name}"

      # Create canonical for the template itself
      tpl_sk = template.sync_key || ConfigSyncable.build_sync_key(template.name)
      canonical_tpl = SmCanonicalRecord.find_or_initialize_by(
        record_type: "SmScheduleMasterTemplate",
        sync_key: tpl_sk
      )
      if canonical_tpl.new_record?
        canonical_tpl = SmCanonicalRecord.create_from_local!(template, sync_key: tpl_sk)
        puts "    Created canonical template: #{tpl_sk}"
      end
      template.update_columns(canonical_record_id: canonical_tpl.id, canonical_version: canonical_tpl.version) unless template.canonical_record_id

      # Create canonical for each task in the template
      tasks = SmScheduleMaster.for_template(template.id).where(is_active: true)
      task_created = 0
      task_skipped = 0

      tasks.find_each do |task|
        task_sk = task.sync_key || ConfigSyncable.build_sync_key(task.name)

        # For tasks, use composite key: template_sync_key--task_sync_key
        # This handles duplicate task names across templates
        composite_sk = "#{tpl_sk}--#{task_sk}"

        existing = SmCanonicalRecord.find_by(record_type: "SmScheduleMaster", sync_key: composite_sk)
        if existing
          task.update_columns(canonical_record_id: existing.id, canonical_version: existing.version) unless task.canonical_record_id
          task_skipped += 1
          next
        end

        canonical_task = SmCanonicalRecord.create_from_local!(task, sync_key: composite_sk)
        task.update_columns(canonical_record_id: canonical_task.id, canonical_version: canonical_task.version)
        task_created += 1
      end

      # Also seed SmScheduleMasterDocumentType join records for tasks in this template
      doc_type_created = 0
      SmScheduleMasterDocumentType.joins(:sm_schedule_master)
        .where(sm_schedule_masters: { id: tasks.pluck(:id) })
        .find_each do |sdt|
          sdt_sk = "#{sdt.sm_schedule_master&.sync_key || sdt.sm_schedule_master_id}--doctype--#{sdt.document_type_id}"
          existing = SmCanonicalRecord.find_by(record_type: "SmScheduleMasterDocumentType", sync_key: sdt_sk)
          unless existing
            canonical_sdt = SmCanonicalRecord.create_from_local!(sdt, sync_key: sdt_sk)
            sdt.update_columns(canonical_record_id: canonical_sdt.id, canonical_version: canonical_sdt.version)
            doc_type_created += 1
          end
        end

      puts "    Tasks: #{task_created} created, #{task_skipped} skipped"
      puts "    Document types: #{doc_type_created} created" if doc_type_created > 0
    end
  end

  def link_tenant_records(tenant)
    # Link lookup tables by sync_key
    link_model("SmTrade", SmTrade)
    link_model("SmStage", SmStage)
    link_model("SmTaskGroup", SmTaskGroup)
    link_model("SmHoldReason", SmHoldReason)
    link_model("SmResource", SmResource)
    link_model("BpmnProcess", BpmnProcess)

    # Link templates
    link_model("SmScheduleMasterTemplate", SmScheduleMasterTemplate)

    # Link tasks (need template context for composite keys)
    link_tasks(tenant)
  end

  def link_model(type_name, model)
    canonicals = SmCanonicalRecord.where(record_type: type_name).index_by(&:sync_key)
    linked = 0
    differing = 0

    model.where(canonical_record_id: nil).find_each do |record|
      sk = record.sync_key
      next if sk.blank?

      canonical = canonicals[sk]
      next unless canonical

      # Detect field overrides: fields that differ from canonical
      overrides = detect_overrides(record, canonical)
      differing += 1 if overrides.any?

      record.update_columns(
        canonical_record_id: canonical.id,
        canonical_version: canonical.version,
        field_overrides: overrides
      )
      linked += 1
    end

    puts "    #{type_name}: #{linked} linked, #{differing} with overrides" if linked > 0
  end

  def link_tasks(tenant)
    # Build map of canonical tasks by composite key
    canonical_tasks = SmCanonicalRecord.tasks.index_by(&:sync_key)

    linked = 0
    differing = 0

    SmScheduleMaster.where(canonical_record_id: nil).find_each do |task|
      task_sk = task.sync_key
      next if task_sk.blank?

      # Try each canonical template's composite key
      canonical_templates = SmCanonicalRecord.templates
      canonical_templates.each do |ct|
        composite_sk = "#{ct.sync_key}--#{task_sk}"
        canonical = canonical_tasks[composite_sk]
        next unless canonical

        overrides = detect_overrides(task, canonical)
        differing += 1 if overrides.any?

        task.update_columns(
          canonical_record_id: canonical.id,
          canonical_version: canonical.version,
          field_overrides: overrides
        )
        linked += 1
        break # Found a match, stop looking
      end
    end

    puts "    SmScheduleMaster: #{linked} linked, #{differing} with overrides" if linked > 0
  end

  def detect_overrides(record, canonical)
    inheritable = SmCanonicalRecord::INHERITABLE_FIELDS[canonical.record_type] || []
    overrides = []

    inheritable.each do |field|
      next unless record.respond_to?(field) && canonical.fields.key?(field)

      local_val = record.send(field)
      canonical_val = canonical.fields[field]

      # Normalize for comparison (nil vs empty, numeric types, etc.)
      next if normalize_value(local_val) == normalize_value(canonical_val)

      overrides << field
    end

    overrides
  end

  def normalize_value(val)
    case val
    when nil then nil
    when "", [] then nil
    when BigDecimal then val.to_f
    else val
    end
  end

  def print_status
    puts "\n=== Canonical Sync Status ==="
    puts "Canonical records: #{SmCanonicalRecord.count}"

    SmCanonicalRecord::RECORD_TYPES.each do |type|
      count = SmCanonicalRecord.where(record_type: type).count
      puts "  #{type}: #{count}" if count > 0
    end

    puts "\nSync group members: #{CanonicalSyncGroupMember.active.count}"
    CanonicalSyncGroupMember.active.includes(:tenant).each do |m|
      puts "  #{m.tenant.name} (#{m.sync_direction})"
    end

    puts "\nLinked records per tenant:"
    CanonicalSyncGroupMember.active.includes(:tenant).each do |m|
      ActsAsTenant.with_tenant(m.tenant) do
        total_linked = 0
        total_overrides = 0

        SmCanonicalRecord::RECORD_TYPES.each do |type|
          model = type.constantize rescue next
          next unless model.column_names.include?("canonical_record_id")

          linked = model.where.not(canonical_record_id: nil).count
          with_overrides = model.where.not(canonical_record_id: nil)
                               .where("array_length(field_overrides, 1) > 0").count rescue 0
          total_linked += linked
          total_overrides += with_overrides
        end

        puts "  #{m.tenant.name}: #{total_linked} linked, #{total_overrides} with overrides"
      end
    end
    puts "============================="
  end
end
