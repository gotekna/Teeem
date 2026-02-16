# frozen_string_literal: true

class AddProfitCentreToExistingTables < ActiveRecord::Migration[8.0]
  def change
    # Job default profit centre
    add_reference :jobs, :default_profit_centre,
                  foreign_key: { to_table: :profit_centres, on_delete: :nullify },
                  null: true

    # PO line items - per-line cost tracking
    add_reference :purchase_order_line_items, :profit_centre,
                  foreign_key: { on_delete: :nullify },
                  null: true

    # Progress claim lines - per-line revenue tracking
    add_reference :gl_progress_claim_lines, :profit_centre,
                  foreign_key: { on_delete: :nullify },
                  null: true

    # Job claims - header-level profit centre (no line items)
    add_reference :job_claims, :profit_centre,
                  foreign_key: { on_delete: :nullify },
                  null: true
  end
end
