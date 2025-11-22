# frozen_string_literal: true

# SmBaselineTask - Individual task snapshot within a baseline
#
class SmBaselineTask < ApplicationRecord
  belongs_to :baseline, class_name: 'SmBaseline', foreign_key: 'sm_baseline_id'
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id'

  validates :planned_start, presence: true
  validates :planned_end, presence: true
end
