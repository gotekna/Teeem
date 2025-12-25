FactoryBot.define do
  factory :schedule_template_row do
    association :schedule_template

    sequence(:name) { |n| "Test Task #{n}" }
    sequence_order { 0 }
    start_date { 0 }
    duration { 1 }
    predecessor_ids { [] }

    # Optional associations
    supplier { nil }
    linked_template { nil }

    # Boolean flags
    po_required { false }
    create_po_on_job_start { false }
    critical_po { false }
    require_photo { false }
    require_certificate { false }
    confirm { false }
    auto_complete_predecessors { false }
    has_subtasks { false }
    manual_task { false }
    allow_multiple_instances { false }
    order_required { false }
    call_up_required { false }
    plan_required { false }
    hold { false }

    # Lock hierarchy flags
    supplier_confirm { false }
    start { false }
    complete { false }

    # JSONB fields
    price_book_item_ids { [] }
    tags { [] }
    subtask_names { [] }
    auto_complete_task_ids { [] }
    subtask_template_ids { [] }

    # Integer fields
    cert_lag_days { 10 }
    subtask_count { nil }

    # Array fields
    documentation_category_ids { [] }
    supervisor_checklist_template_ids { [] }

    # Text fields
    linked_task_ids { "[]" }

    # String fields
    assigned_user_id { nil }
  end
end
