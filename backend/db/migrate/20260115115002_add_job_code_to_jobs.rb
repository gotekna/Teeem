# frozen_string_literal: true

class AddJobCodeToJobs < ActiveRecord::Migration[8.0]
  def up
    # Add job_code column (nullable initially for backfill)
    add_column :jobs, :job_code, :string

    # Backfill existing jobs with "J" + id
    Job.reset_column_information
    Job.find_each do |job|
      job.update_column(:job_code, "J#{job.id}")
    end

    # Now make it NOT NULL and add unique index
    change_column_null :jobs, :job_code, false
    add_index :jobs, :job_code, unique: true
  end

  def down
    remove_index :jobs, :job_code
    remove_column :jobs, :job_code
  end
end
