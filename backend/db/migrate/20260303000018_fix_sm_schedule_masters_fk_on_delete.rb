# frozen_string_literal: true

# FRC (Mar 2026): Sentry CD/CC - FK violations when deleting sm_schedule_masters
#
# Root cause: SmScheduleMaster has `dependent: :nullify` on sm_tasks and
# custom_quote_template_lines, but the DB FK constraints default to RESTRICT.
# Rails runs nullify BEFORE delete, but if any callback raises or a concurrent
# insert sneaks in, the DB constraint blocks the DELETE.
#
# Fix: Add ON DELETE SET NULL to the FK constraints so the DB handles it too.
# Also add missing has_many :custom_quote_lines dependent handling.
#
class FixSmScheduleMastersFkOnDelete < ActiveRecord::Migration[7.2]
  def up
    # sm_tasks → sm_schedule_masters: Replace FK with ON DELETE SET NULL
    if foreign_key_exists?(:sm_tasks, :sm_schedule_masters)
      remove_foreign_key :sm_tasks, :sm_schedule_masters
    end
    unless foreign_key_exists?(:sm_tasks, :sm_schedule_masters)
      add_foreign_key :sm_tasks, :sm_schedule_masters, on_delete: :nullify
    end

    # custom_quote_template_lines → sm_schedule_masters: Replace FK with ON DELETE SET NULL
    if foreign_key_exists?(:custom_quote_template_lines, :sm_schedule_masters)
      remove_foreign_key :custom_quote_template_lines, :sm_schedule_masters
    end
    unless foreign_key_exists?(:custom_quote_template_lines, :sm_schedule_masters)
      add_foreign_key :custom_quote_template_lines, :sm_schedule_masters, on_delete: :nullify
    end

    # custom_quote_lines → sm_schedule_masters: Replace FK with ON DELETE SET NULL
    if foreign_key_exists?(:custom_quote_lines, :sm_schedule_masters)
      remove_foreign_key :custom_quote_lines, :sm_schedule_masters
    end
    unless foreign_key_exists?(:custom_quote_lines, :sm_schedule_masters)
      add_foreign_key :custom_quote_lines, :sm_schedule_masters, on_delete: :nullify
    end
  end

  def down
    # Revert to default (RESTRICT) FK constraints
    if foreign_key_exists?(:sm_tasks, :sm_schedule_masters)
      remove_foreign_key :sm_tasks, :sm_schedule_masters
      add_foreign_key :sm_tasks, :sm_schedule_masters
    end

    if foreign_key_exists?(:custom_quote_template_lines, :sm_schedule_masters)
      remove_foreign_key :custom_quote_template_lines, :sm_schedule_masters
      add_foreign_key :custom_quote_template_lines, :sm_schedule_masters
    end

    if foreign_key_exists?(:custom_quote_lines, :sm_schedule_masters)
      remove_foreign_key :custom_quote_lines, :sm_schedule_masters
      add_foreign_key :custom_quote_lines, :sm_schedule_masters
    end
  end
end
