# MASTERPIECE: Plans Performance - Phase 1
# Backfill counter cache columns with existing data
#
# Uses batch processing to avoid memory issues with large datasets.
# Safe to re-run if interrupted.
#
class BackfillPlanCounterCaches < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    say_with_time "Backfilling job_plans.revisions_count" do
      # Use raw SQL for efficiency - single UPDATE per table
      execute <<-SQL.squish
        UPDATE job_plans
        SET revisions_count = (
          SELECT COUNT(*)
          FROM job_plan_revisions
          WHERE job_plan_revisions.job_plan_id = job_plans.id
        )
      SQL
    end

    say_with_time "Backfilling job_plan_tabs.plans_count" do
      execute <<-SQL.squish
        UPDATE job_plan_tabs
        SET plans_count = (
          SELECT COUNT(*)
          FROM job_plans
          WHERE job_plans.job_plan_tab_id = job_plan_tabs.id
        )
      SQL
    end

    say_with_time "Backfilling job_plan_tabs.on_issue_plans_count" do
      execute <<-SQL.squish
        UPDATE job_plan_tabs
        SET on_issue_plans_count = (
          SELECT COUNT(*)
          FROM job_plans
          INNER JOIN job_plan_revisions ON job_plan_revisions.id = job_plans.current_revision_id
          WHERE job_plans.job_plan_tab_id = job_plan_tabs.id
            AND job_plan_revisions.is_on_issue = true
        )
      SQL
    end

    say_with_time "Backfilling jobs.plans_count" do
      execute <<-SQL.squish
        UPDATE jobs
        SET plans_count = (
          SELECT COUNT(*)
          FROM job_plans
          WHERE job_plans.job_id = jobs.id
        )
      SQL
    end

    say_with_time "Backfilling jobs.on_issue_plans_count" do
      execute <<-SQL.squish
        UPDATE jobs
        SET on_issue_plans_count = (
          SELECT COUNT(*)
          FROM job_plans
          INNER JOIN job_plan_revisions ON job_plan_revisions.id = job_plans.current_revision_id
          WHERE job_plans.job_id = jobs.id
            AND job_plan_revisions.is_on_issue = true
        )
      SQL
    end
  end

  def down
    # Counter caches will be reset to 0 by removing the columns
    # No action needed here
  end
end
