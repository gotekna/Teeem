# frozen_string_literal: true

namespace :bpmn do
  desc "Seed the Director Change BPMN workflow process"
  task seed_director_change: :environment do
    puts "Seeding Director Change workflow..."

    # Create or find the process
    process = BpmnProcess.find_or_initialize_by(name: "Director Change")

    process.assign_attributes(
      description: "ASIC Form 484 Director Change workflow. Collects director change details, " \
                   "generates ASIC document package (Form 484, Consent to Act, Resignation, Minutes), " \
                   "sends for e-signature, and updates director records on completion.",
      version: 1,
      is_published: true,
      published_at: Time.current
    )
    process.save!

    # Clear existing nodes if re-seeding
    process.bpmn_nodes.destroy_all
    process.bpmn_edges.destroy_all

    # Create nodes
    nodes = {}

    # 1. Start Event
    nodes[:start] = process.bpmn_nodes.create!(
      node_type: "start_event",
      node_key: "StartEvent_1",
      name: "Start",
      position_x: 100,
      position_y: 200
    )

    # 2. User Task: Configure Director Changes
    nodes[:user_task] = process.bpmn_nodes.create!(
      node_type: "user_task",
      node_key: "UserTask_ConfigureChanges",
      name: "Configure Director Changes",
      position_x: 250,
      position_y: 200,
      config: {
        "form_schema" => {
          "form_type" => "director_change",
          "title" => "Director Changes",
          "description" => "Select ceasing directors, add new appointments, and configure dates."
        },
        "assignee_type" => "variable",
        "assignee_value" => "_triggered_by_user_id",
        "due_days" => 7
      }
    )

    # 3. Service Task: Generate ASIC Package
    nodes[:generate] = process.bpmn_nodes.create!(
      node_type: "service_task",
      node_key: "ServiceTask_GeneratePackage",
      name: "Generate ASIC Package",
      position_x: 450,
      position_y: 200,
      config: {
        "task_type" => "director_change"
      }
    )

    # 4. Service Task: Send for E-Signing (specialized for director changes)
    nodes[:esign] = process.bpmn_nodes.create!(
      node_type: "service_task",
      node_key: "ServiceTask_SendForSigning",
      name: "Send for E-Signing",
      position_x: 650,
      position_y: 200,
      config: {
        "task_type" => "create_director_change_esign",
        "store_as_variable" => "esign_result"
      }
    )

    # 5. Service Task: Wait for Signatures
    nodes[:wait] = process.bpmn_nodes.create!(
      node_type: "service_task",
      node_key: "ServiceTask_WaitForSignatures",
      name: "Wait for Signatures",
      position_x: 850,
      position_y: 200,
      config: {
        "task_type" => "wait_for_signatures",
        "request_variable" => "esign_result",
        "store_result_as" => "signing_result",
        "retry_interval_minutes" => 60
      }
    )

    # 6. Service Task: Complete Director Changes
    nodes[:complete] = process.bpmn_nodes.create!(
      node_type: "service_task",
      node_key: "ServiceTask_CompleteChanges",
      name: "Complete Director Changes",
      position_x: 1050,
      position_y: 200,
      config: {
        "task_type" => "complete_director_change"
      }
    )

    # 7. End Event
    nodes[:end] = process.bpmn_nodes.create!(
      node_type: "end_event",
      node_key: "EndEvent_1",
      name: "End",
      position_x: 1200,
      position_y: 200
    )

    # Create edges (sequential flow)
    edges = [
      [ :start, :user_task, "Flow_Start_UserTask" ],
      [ :user_task, :generate, "Flow_UserTask_Generate" ],
      [ :generate, :esign, "Flow_Generate_ESign" ],
      [ :esign, :wait, "Flow_ESign_Wait" ],
      [ :wait, :complete, "Flow_Wait_Complete" ],
      [ :complete, :end, "Flow_Complete_End" ]
    ]

    edges.each do |source_key, target_key, edge_key|
      process.bpmn_edges.create!(
        source_node: nodes[source_key],
        target_node: nodes[target_key],
        edge_key: edge_key
      )
    end

    # Create manual trigger for Corporate subject
    trigger = process.bpmn_triggers.find_or_initialize_by(
      trigger_type: "manual",
      name: "Start Director Change"
    )
    trigger.assign_attributes(
      is_active: true,
      config: {
        "entity_type" => "Corporate",
        "subject_type" => "Corporate",
        "description" => "Manually start a director change process for a corporate entity"
      }
    )
    trigger.save!

    puts "✅ Director Change workflow seeded:"
    puts "  - Process: #{process.name} (ID: #{process.id}, published: #{process.is_published})"
    puts "  - Nodes: #{process.bpmn_nodes.count}"
    puts "  - Edges: #{process.bpmn_edges.count}"
    puts "  - Trigger: #{trigger.name} (ID: #{trigger.id})"
  end
end
