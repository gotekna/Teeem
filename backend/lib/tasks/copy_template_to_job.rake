# frozen_string_literal: true

namespace :template do
  desc "Copy schedule template to a job"
  task :copy_to_job, [:job_id, :template_id] => :environment do |_t, args|
    job_id = args[:job_id].to_i
    template_id = args[:template_id].to_i

    job = Job.find(job_id)
    template = SmScheduleMasterTemplate.find(template_id)
    user = User.first
    start_date = Date.current

    puts "Copying template '#{template.name}' (ID: #{template_id}) to job '#{job.title}' (ID: #{job_id})"

    # Clear existing tasks
    existing_count = job.sm_tasks.count
    job.sm_tasks.destroy_all
    puts "Cleared #{existing_count} existing tasks"

    # Get template rows
    rows = SmScheduleMaster.where("sm_template_ids @> ?", [template.id].to_json)
                        .where(is_active: true)
                        .order(:sequence_order)
                        .to_a
    puts "Found #{rows.count} template rows"

    # Create tasks
    created = 0
    rows.each_with_index do |row, idx|
      SmTask.create!(
        construction_id: job.id,
        sm_template_row_id: row.id,
        name: row.name || "Task #{idx + 1}",
        task_number: idx + 1,
        sequence_order: idx + 1,
        duration_days: row.duration_days || 1,
        trade: row.trade,
        stage: row.stage,
        supplier_id: row.supplier_id,
        checklist_id: row.checklist_id,
        status: "not_started",
        has_subtasks: row.has_subtasks,
        subtask_count: row.subtask_count,
        subtask_names: row.subtask_names,
        require_photo: row.require_photo,
        po_required: row.po_required,
        start_date: start_date,
        end_date: start_date + ((row.duration_days || 1) - 1).days,
        created_by: user,
        updated_by: user
      )
      created += 1
      print "." if (created % 50).zero?
    end

    puts "\nCreated #{created} tasks for Job #{job_id}"
    puts "Job now has #{job.sm_tasks.reload.count} SmTasks"
  end
end
