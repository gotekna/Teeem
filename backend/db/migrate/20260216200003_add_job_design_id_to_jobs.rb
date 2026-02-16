class AddJobDesignIdToJobs < ActiveRecord::Migration[8.0]
  def change
    add_reference :jobs, :job_design, null: true, foreign_key: true

    # Backfill: match existing design_name strings to job_designs records
    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE jobs
          SET job_design_id = jd.id
          FROM job_designs jd
          WHERE LOWER(jobs.design_name) = LOWER(jd.name)
            AND jobs.design_name IS NOT NULL
            AND jobs.job_design_id IS NULL
        SQL
      end
    end
  end
end
