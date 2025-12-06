namespace :db do
  namespace :seed do
    desc "Seed meeting types data"
    task meeting_types: :environment do
      puts "Seeding meeting types..."

      meeting_types_data = [
        {
          name: "Sales Meeting - Client",
          description: "Sales meeting with potential or existing clients to discuss projects, quotes, and contracts",
          category: "sales",
          icon: "UserGroupIcon",
          color: "blue",
          default_duration_minutes: 90,
          required_participant_types: [ "client", "sales_manager" ],
          optional_participant_types: [ "estimator", "project_manager" ],
          minimum_participants: 2,
          required_fields: [ "location", "construction_id" ],
          optional_fields: [ "video_url", "notes" ],
          default_agenda_items: [
            { title: "Introduction & Welcome", duration_minutes: 10 },
            { title: "Project Overview", duration_minutes: 20 },
            { title: "Quote/Proposal Discussion", duration_minutes: 30 },
            { title: "Timeline & Next Steps", duration_minutes: 20 },
            { title: "Q&A", duration_minutes: 10 }
          ],
          required_documents: [ "proposal", "quote" ],
          notification_settings: { send_reminder: true, reminder_hours: 24 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Sales Meeting - Internal",
          description: "Internal sales team meeting to discuss pipeline, strategies, and targets",
          category: "sales",
          icon: "ChartBarIcon",
          color: "green",
          default_duration_minutes: 60,
          required_participant_types: [ "sales_manager", "sales_team" ],
          optional_participant_types: [ "estimator" ],
          minimum_participants: 2,
          required_fields: [],
          optional_fields: [ "video_url", "notes" ],
          default_agenda_items: [
            { title: "Pipeline Review", duration_minutes: 20 },
            { title: "Weekly Targets", duration_minutes: 15 },
            { title: "Strategy Discussion", duration_minutes: 20 },
            { title: "Action Items", duration_minutes: 5 }
          ],
          notification_settings: { send_reminder: true, reminder_hours: 2 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Construction Site Meeting",
          description: "On-site meeting to discuss progress, issues, and coordination",
          category: "construction",
          icon: "WrenchScrewdriverIcon",
          color: "orange",
          default_duration_minutes: 45,
          required_participant_types: [ "project_manager", "site_supervisor" ],
          optional_participant_types: [ "subcontractor", "client", "architect" ],
          minimum_participants: 2,
          required_fields: [ "location", "construction_id" ],
          optional_fields: [ "notes" ],
          default_agenda_items: [
            { title: "Site Walkthrough", duration_minutes: 15 },
            { title: "Progress Update", duration_minutes: 10 },
            { title: "Issues & Resolutions", duration_minutes: 15 },
            { title: "Next Steps", duration_minutes: 5 }
          ],
          custom_fields: [
            { name: "weather_conditions", type: "text", label: "Weather Conditions" },
            { name: "site_photos", type: "file", label: "Site Photos" }
          ],
          notification_settings: { send_reminder: true, reminder_hours: 4 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Board Meeting",
          description: "Formal board meeting for strategic decisions and governance",
          category: "board",
          icon: "BuildingOfficeIcon",
          color: "purple",
          default_duration_minutes: 120,
          required_participant_types: [ "board_member", "secretary" ],
          optional_participant_types: [ "ceo", "cfo", "advisor" ],
          minimum_participants: 3,
          maximum_participants: 15,
          required_fields: [ "location" ],
          optional_fields: [ "video_url", "notes" ],
          default_agenda_items: [
            { title: "Call to Order", duration_minutes: 5 },
            { title: "Approval of Previous Minutes", duration_minutes: 10 },
            { title: "Financial Report", duration_minutes: 30 },
            { title: "Strategic Initiatives", duration_minutes: 40 },
            { title: "Governance Matters", duration_minutes: 20 },
            { title: "Next Meeting Date", duration_minutes: 5 },
            { title: "Adjournment", duration_minutes: 10 }
          ],
          required_documents: [ "agenda", "previous_minutes", "financial_report" ],
          custom_fields: [
            { name: "quorum_met", type: "checkbox", label: "Quorum Met" },
            { name: "motions", type: "textarea", label: "Motions & Resolutions" }
          ],
          notification_settings: { send_reminder: true, reminder_hours: 48 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Safety Meeting",
          description: "Safety briefing and toolbox talk for construction teams",
          category: "safety",
          icon: "ShieldCheckIcon",
          color: "red",
          default_duration_minutes: 30,
          required_participant_types: [ "safety_officer", "site_supervisor" ],
          optional_participant_types: [ "all_workers" ],
          minimum_participants: 2,
          required_fields: [ "location", "construction_id" ],
          optional_fields: [ "notes" ],
          default_agenda_items: [
            { title: "Safety Incident Review", duration_minutes: 10 },
            { title: "Hazard Identification", duration_minutes: 10 },
            { title: "PPE Inspection", duration_minutes: 5 },
            { title: "Action Items", duration_minutes: 5 }
          ],
          custom_fields: [
            { name: "safety_checklist", type: "checkbox", label: "Safety Checklist Complete" },
            { name: "incidents_reported", type: "number", label: "Number of Incidents" },
            { name: "hazards_identified", type: "textarea", label: "Hazards Identified" }
          ],
          required_documents: [ "attendance_sheet", "safety_checklist" ],
          notification_settings: { send_reminder: true, reminder_hours: 12 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Project Kickoff Meeting",
          description: "Initial meeting to launch a new construction project",
          category: "construction",
          icon: "RocketLaunchIcon",
          color: "indigo",
          default_duration_minutes: 120,
          required_participant_types: [ "project_manager", "client", "site_supervisor" ],
          optional_participant_types: [ "architect", "engineer", "subcontractor" ],
          minimum_participants: 3,
          required_fields: [ "location", "construction_id" ],
          optional_fields: [ "video_url", "notes" ],
          default_agenda_items: [
            { title: "Introductions", duration_minutes: 15 },
            { title: "Project Overview & Scope", duration_minutes: 30 },
            { title: "Roles & Responsibilities", duration_minutes: 20 },
            { title: "Timeline & Milestones", duration_minutes: 25 },
            { title: "Communication Plan", duration_minutes: 15 },
            { title: "Q&A", duration_minutes: 15 }
          ],
          required_documents: [ "project_plan", "contract", "timeline" ],
          notification_settings: { send_reminder: true, reminder_hours: 48 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Team Standup",
          description: "Quick daily team sync to discuss progress and blockers",
          category: "team",
          icon: "UsersIcon",
          color: "gray",
          default_duration_minutes: 15,
          required_participant_types: [ "team_member" ],
          minimum_participants: 2,
          maximum_participants: 10,
          required_fields: [],
          optional_fields: [ "video_url", "notes" ],
          default_agenda_items: [
            { title: "Yesterday's Accomplishments", duration_minutes: 5 },
            { title: "Today's Plans", duration_minutes: 5 },
            { title: "Blockers & Issues", duration_minutes: 5 }
          ],
          notification_settings: { send_reminder: true, reminder_hours: 0.5 },
          is_active: true,
          is_system_default: true
        },
        {
          name: "Client Progress Review",
          description: "Periodic meeting with client to review project progress and address concerns",
          category: "construction",
          icon: "PresentationChartLineIcon",
          color: "teal",
          default_duration_minutes: 60,
          required_participant_types: [ "client", "project_manager" ],
          optional_participant_types: [ "site_supervisor", "architect" ],
          minimum_participants: 2,
          required_fields: [ "construction_id" ],
          optional_fields: [ "location", "video_url", "notes" ],
          default_agenda_items: [
            { title: "Progress Summary", duration_minutes: 20 },
            { title: "Budget Update", duration_minutes: 15 },
            { title: "Upcoming Milestones", duration_minutes: 10 },
            { title: "Client Questions & Concerns", duration_minutes: 10 },
            { title: "Next Steps", duration_minutes: 5 }
          ],
          required_documents: [ "progress_report" ],
          notification_settings: { send_reminder: true, reminder_hours: 24 },
          is_active: true,
          is_system_default: true
        }
      ]

      meeting_types_data.each do |data|
        meeting_type = MeetingType.find_or_initialize_by(name: data[:name])
        meeting_type.assign_attributes(data)

        if meeting_type.save
          puts "  ✓ Created: #{meeting_type.name}"
        else
          puts "  ✗ Failed to create #{data[:name]}: #{meeting_type.errors.full_messages.join(', ')}"
        end
      end

      puts "Finished creating #{MeetingType.count} meeting types"
    end
  end
end
