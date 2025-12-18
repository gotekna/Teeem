# frozen_string_literal: true

# Job to analyze a job plan with AI and update its display name
# Downloads the PDF from SharePoint, runs AI vision, updates the plan
class PlanAiAnalysisJob < ApplicationJob
  queue_as :default

  def perform(job_plan_id)
    plan = JobPlan.find_by(id: job_plan_id)
    return unless plan

    revision = plan.current_revision
    return unless revision&.sharepoint_file_id.present?

    Rails.logger.info "[PlanAiAnalysisJob] Analyzing plan #{job_plan_id}: #{plan.display_name}"

    # Download the file from SharePoint
    credential = OrganizationSharePointCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)
    content = client.download_file(revision.sharepoint_file_id)
    return unless content

    # Extract sheet info using AI
    service = PlanSetService.new(plan.job, nil)
    sheet_info = service.send(:extract_sheet_info_with_ai, content, 1)

    Rails.logger.info "[PlanAiAnalysisJob] AI extracted: #{sheet_info.inspect}"

    # Update the plan with AI-extracted info
    if sheet_info[:sheet_name].present? || sheet_info[:sheet_number].present?
      # Try to match plan type
      plan_type = find_plan_type_for_sheet(sheet_info[:sheet_name])

      # Build new display name
      new_display_name = if sheet_info[:sheet_name].present?
        sheet_info[:sheet_name]
      elsif sheet_info[:sheet_number].present?
        sheet_info[:sheet_number]
      end

      # Check if plan type is already used by another plan on this job
      # If so, assign a variant suffix (a, b, c, ...)
      variant_suffix = nil
      if plan_type.present?
        variant_suffix = find_next_variant_suffix(plan.job, plan_type.id, plan.id)
      end

      # Find the matching job_plan_tab based on plan_type's categories
      job_plan_tab_id = nil
      if plan_type.present?
        job_plan_tab_id = find_job_plan_tab_for_plan_type(plan.job, plan_type)
      end

      plan.update!(
        plan_type_id: plan_type&.id,
        job_plan_tab_id: job_plan_tab_id || plan.job_plan_tab_id,
        variant_suffix: variant_suffix,
        display_name: new_display_name
      )

      tab_name = job_plan_tab_id ? plan.job.job_plan_tabs.find_by(id: job_plan_tab_id)&.name : 'none'
      Rails.logger.info "[PlanAiAnalysisJob] Updated plan #{job_plan_id}: #{new_display_name} (type: #{plan_type&.name || 'none'}, tab: #{tab_name}, variant: #{variant_suffix || 'none'})"
    end
  end

  private

  # Fuzzy match sheet name to plan type
  def find_plan_type_for_sheet(sheet_name)
    return nil if sheet_name.blank?

    normalized = sheet_name.to_s.downcase.strip

    # Try exact match first
    plan_type = PlanType.active.find_by("LOWER(name) = ?", normalized)
    return plan_type if plan_type

    # Try contains match
    plan_type = PlanType.active.find_by("LOWER(?) LIKE '%' || LOWER(name) || '%'", normalized)
    return plan_type if plan_type

    # Try partial match
    plan_type = PlanType.active.find_by("LOWER(name) LIKE ?", "%#{normalized}%")
    return plan_type if plan_type

    # Common mappings
    mappings = {
      'perspective' => 'PERSPECTIVE',
      'site' => 'SITE PLAN',
      'slab' => 'SLAB PLAN',
      'floor' => 'FLOOR PLAN',
      'elevation' => 'ELEVATION',
      'roof' => 'ROOF PLAN',
      'electrical' => 'ELECTRICAL',
      'plumbing' => 'PLUMBING',
      'cabinetry' => 'CABINETRY',
      'kitchen' => 'KIT CABINETRY',
      'section' => 'SECTION',
      'detail' => 'DETAILS'
    }

    mappings.each do |keyword, plan_type_name|
      if normalized.include?(keyword)
        plan_type = PlanType.active.find_by("LOWER(name) = ?", plan_type_name.downcase)
        return plan_type if plan_type
      end
    end

    nil
  end

  # Find the matching job_plan_tab for a plan_type based on its categories
  # Returns the tab ID or nil if no match found
  def find_job_plan_tab_for_plan_type(job, plan_type)
    return nil unless plan_type.present?

    # Get the plan type's category IDs
    category_ids = plan_type.plan_categories.pluck(:id)
    return nil if category_ids.empty?

    # Find a job_plan_tab that matches one of the plan type's categories
    # Prefer the first category (usually the primary one)
    tab = job.job_plan_tabs.find_by(plan_category_id: category_ids)
    tab&.id
  end

  # Find the next available variant suffix for a plan type on this job
  # Returns nil if no suffix needed (first use of this type)
  # Returns 'a', 'b', 'c', ... if type already exists
  def find_next_variant_suffix(job, plan_type_id, current_plan_id)
    # Check if any OTHER plan on this job already has this plan_type
    existing_suffixes = job.job_plans
      .where(plan_type_id: plan_type_id)
      .where.not(id: current_plan_id)
      .pluck(:variant_suffix)

    return nil if existing_suffixes.empty?

    # Find the next available suffix starting from 'a'
    # Note: nil is a valid suffix (the first plan), so we check for actual values
    ('a'..'z').each do |suffix|
      return suffix unless existing_suffixes.include?(suffix)
    end

    # Fallback if somehow we exhaust a-z
    "z#{existing_suffixes.count + 1}"
  end
end
