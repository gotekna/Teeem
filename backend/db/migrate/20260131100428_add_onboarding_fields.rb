# frozen_string_literal: true

# Client Onboarding System - Phase 1.1
# Adds project_type to jobs (construction vs internal) and onboarding tracking to tenants
class AddOnboardingFields < ActiveRecord::Migration[8.0]
  def change
    # Add project_type to jobs (construction = customer-facing, internal = system/onboarding)
    add_column :jobs, :project_type, :string, default: 'construction', null: false
    add_index :jobs, :project_type

    # Add onboarding tracking fields to tenants
    add_column :tenants, :onboarding_started_at, :datetime
    add_column :tenants, :onboarding_completed_at, :datetime
    add_column :tenants, :onboarding_job_id, :bigint
    add_index :tenants, :onboarding_job_id
    add_foreign_key :tenants, :jobs, column: :onboarding_job_id, on_delete: :nullify
  end
end
