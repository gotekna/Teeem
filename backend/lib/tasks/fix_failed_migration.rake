# frozen_string_literal: true

# Fix the 5 tables that failed during shared config migration due to
# unique constraints, FK violations, or database views.
# Run: rails shared_config:fix_failed
namespace :shared_config do
  desc "Fix 5 tables that failed during initial shared config migration"
  task fix_failed: :environment do
    master = Tenant.find_by(is_master_tenant: true)
    customers = Tenant.where(is_master_tenant: false)
    results = {}

    Rails.application.eager_load!

    ActsAsTenant.without_tenant do
      # 1. job_types - unique constraint on job_type_statuses (job_type_id, job_status_id)
      ActiveRecord::Base.transaction do
        g = 0; d = 0
        JobType.unscoped.where(tenant_id: master.id).find_each do |rec|
          sk = rec.try(:sync_key)
          next unless sk.present?
          customers.each do |t|
            JobType.unscoped.where(tenant_id: t.id, sync_key: sk).each do |copy|
              master_combos = JobTypeStatus.unscoped.where(job_type_id: rec.id).pluck(:job_status_id).to_set
              JobTypeStatus.unscoped.where(job_type_id: copy.id, job_status_id: master_combos.to_a).delete_all if master_combos.any?
              JobTypeStatus.unscoped.where(job_type_id: copy.id).update_all(job_type_id: rec.id)
              Job.unscoped.where(job_type_id: copy.id).update_all(job_type_id: rec.id)
              copy.delete
              d += 1
            end
          end
          rec.update_columns(tenant_id: nil)
          g += 1
        end
        results[:job_types] = [g, d]
        puts "job_types: #{g} global, #{d} deleted"
      end

      # 2. sm_schedule_master_templates - job_types FK references it
      ActiveRecord::Base.transaction do
        g = 0; d = 0
        SmScheduleMasterTemplate.unscoped.where(tenant_id: master.id).find_each do |rec|
          sk = rec.try(:sync_key)
          next unless sk.present?
          customers.each do |t|
            SmScheduleMasterTemplate.unscoped.where(tenant_id: t.id, sync_key: sk).each do |copy|
              if JobType.column_names.include?("sm_schedule_master_template_id")
                JobType.unscoped.where(sm_schedule_master_template_id: copy.id).update_all(sm_schedule_master_template_id: rec.id)
              end
              copy.delete
              d += 1
            end
          end
          rec.update_columns(tenant_id: nil)
          g += 1
        end
        results[:sm_templates] = [g, d]
        puts "sm_schedule_master_templates: #{g} global, #{d} deleted"
      end

      # 3. bpmn_processes - unique constraint on bpmn_nodes (bpmn_process_id, node_key)
      ActiveRecord::Base.transaction do
        g = 0; d = 0
        BpmnProcess.unscoped.where(tenant_id: master.id).find_each do |rec|
          sk = rec.try(:sync_key)
          next unless sk.present?
          customers.each do |t|
            BpmnProcess.unscoped.where(tenant_id: t.id, sync_key: sk).each do |copy|
              master_keys = BpmnNode.unscoped.where(bpmn_process_id: rec.id).pluck(:node_key).to_set rescue Set.new
              BpmnNode.unscoped.where(bpmn_process_id: copy.id, node_key: master_keys.to_a).delete_all if master_keys.any?
              BpmnNode.unscoped.where(bpmn_process_id: copy.id).update_all(bpmn_process_id: rec.id)
              begin
                BpmnEdge.unscoped.where(bpmn_process_id: copy.id).update_all(bpmn_process_id: rec.id)
              rescue => e
                puts "  bpmn_edges warning: #{e.message[0..80]}"
              end
              copy.delete
              d += 1
            end
          end
          rec.update_columns(tenant_id: nil)
          g += 1
        end
        results[:bpmn_processes] = [g, d]
        puts "bpmn_processes: #{g} global, #{d} deleted"
      end

      # 4. claim_stage_templates - unique constraint on claim_stage_template_lines (template_id, name)
      ActiveRecord::Base.transaction do
        g = 0; d = 0
        ClaimStageTemplate.unscoped.where(tenant_id: master.id).find_each do |rec|
          sk = rec.try(:sync_key)
          next unless sk.present?
          customers.each do |t|
            ClaimStageTemplate.unscoped.where(tenant_id: t.id, sync_key: sk).each do |copy|
              master_names = ClaimStageTemplateLine.unscoped.where(claim_stage_template_id: rec.id).pluck(:name).to_set
              ClaimStageTemplateLine.unscoped.where(claim_stage_template_id: copy.id, name: master_names.to_a).delete_all if master_names.any?
              ClaimStageTemplateLine.unscoped.where(claim_stage_template_id: copy.id).update_all(claim_stage_template_id: rec.id)
              copy.delete
              d += 1
            end
          end
          rec.update_columns(tenant_id: nil)
          g += 1
        end
        results[:claim_templates] = [g, d]
        puts "claim_stage_templates: #{g} global, #{d} deleted"
      end

      # 5. contacts - skip database views (xero_sync_contacts_view can't be updated)
      ActiveRecord::Base.transaction do
        g = 0; d = 0
        Contact.unscoped.where(tenant_id: master.id).find_each do |rec|
          sk = rec.try(:sync_key)
          next unless sk.present?
          customers.each do |t|
            Contact.unscoped.where(tenant_id: t.id, sync_key: sk).each do |copy|
              ApplicationRecord.descendants.each do |ref|
                next if ref.abstract_class?
                begin
                  next unless ref.table_exists?
                rescue
                  next
                end
                next if ref.table_name.end_with?("_view")

                ref.reflect_on_all_associations(:belongs_to).each do |assoc|
                  begin
                    next unless assoc.klass == Contact
                    fk = assoc.foreign_key.to_s
                    next unless ref.column_names.include?(fk)
                    scope = ref.unscoped.where(fk => copy.id)
                    scope = scope.where(tenant_id: t.id) if ref.column_names.include?("tenant_id")
                    scope.update_all(fk => rec.id)
                  rescue => e
                    # Skip problematic associations silently
                  end
                end
              end
              copy.delete
              d += 1
            end
          end
          rec.update_columns(tenant_id: nil)
          g += 1
        end
        results[:contacts] = [g, d]
        puts "contacts: #{g} global, #{d} deleted"
      end
    end

    puts ""
    puts "=" * 60
    puts "FIX COMPLETE"
    results.each { |k, v| puts "  #{k}: #{v[0]} global, #{v[1]} deleted" }
    puts "=" * 60
  end
end
