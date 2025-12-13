class Api::V1::WHSController < ApplicationController
  # GET /api/v1/whs/stats
  # Dashboard statistics for WHS module
  def stats
    stats = {
      active_swms: WHSSWMS.where(status: "approved").count,
      pending_inductions: WHSInduction.expiring_soon(30).count,
      incidents_this_month: WHSIncident.this_month.count,
      compliance_score: calculate_compliance_score,
      expiring_licenses: count_expiring_licenses
    }

    render json: {
      success: true,
      data: stats
    }
  end

  # GET /api/v1/whs/incidents
  # Recent incidents for dashboard (wrapper for whs_incidents)
  def incidents
    incidents = WHSIncident.includes(:job, :reported_by_user, :investigated_by_user, :whs_action_items)
                           .recent
                           .limit(10)

    render json: {
      success: true,
      data: {
        incidents: incidents.as_json(
          include: {
            job: { only: [ :id, :job_title ] },
            reported_by_user: { only: [ :id, :name ] },
            investigated_by_user: { only: [ :id, :name ] }
          },
          methods: []
        )
      }
    }
  end

  # GET /api/v1/whs/swms
  # Active SWMS for dashboard (wrapper for whs_swms)
  def swms
    swms = WHSSWMS.where(status: "approved")
                  .includes(:job, :created_by, :approved_by)
                  .order(created_at: :desc)
                  .limit(10)

    render json: {
      success: true,
      data: {
        swms: swms.as_json(
          include: {
            job: { only: [ :id, :job_title ] },
            created_by: { only: [ :id, :name ] },
            approved_by: { only: [ :id, :name ] }
          },
          methods: []
        )
      }
    }
  end

  private

  def calculate_compliance_score
    # Calculate based on:
    # - Active SWMS coverage
    # - Completed inductions
    # - Resolved incidents
    # - Up-to-date licenses

    total_jobs = Job.active.count
    return 100 if total_jobs.zero?

    jobs_with_swms = WHSSWMS.where(status: "approved").distinct.count(:job_id)
    swms_coverage = (jobs_with_swms.to_f / total_jobs * 40).round

    # Induction completion rate (40%)
    total_workers = User.where(role: [ "worker", "subcontractor" ]).count
    return swms_coverage if total_workers.zero?

    inducted_workers = WHSInduction.where(status: "valid").distinct.count(:user_id)
    induction_rate = (inducted_workers.to_f / total_workers * 40).round

    # Incident resolution rate (20%)
    total_incidents = WHSIncident.where("created_at > ?", 3.months.ago).count
    if total_incidents.zero?
      incident_score = 20
    else
      resolved_incidents = WHSIncident.where(status: "closed", created_at: 3.months.ago..).count
      incident_score = (resolved_incidents.to_f / total_incidents * 20).round
    end

    [ swms_coverage + induction_rate + incident_score, 100 ].min
  end

  def count_expiring_licenses
    # Count licenses expiring in next 30 days
    # This would need to be implemented based on your license tracking system
    # For now, return 0 as placeholder
    0
  end
end
