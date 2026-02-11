# frozen_string_literal: true

# DeduplicatableJob - Prevents duplicate recurring jobs from piling up in the queue
#
# FRC (Feb 2026): When the worker falls behind (R14 memory, slow jobs, etc.),
# the SolidQueue scheduler keeps enqueuing new instances of recurring jobs even
# though identical ones haven't finished yet. This caused 6,179 queued jobs on
# teeem-staging-worker with hundreds of duplicates per job class.
#
# Include this concern in any recurring job that should only have ONE pending
# instance in the queue at a time. If a job of the same class is already queued
# and unfinished, the new enqueue is silently skipped.
#
# Usage:
#   class MyRecurringJob < ApplicationJob
#     include DeduplicatableJob
#
#     def perform
#       # ...
#     end
#   end
#
module DeduplicatableJob
  extend ActiveSupport::Concern

  included do
    before_enqueue do |job|
      if self.class.already_queued?
        Rails.logger.info "[DeduplicatableJob] Skipping #{job.class.name} - already queued"
        throw :abort
      end
    end
  end

  class_methods do
    def already_queued?
      SolidQueue::Job
        .where(finished_at: nil)
        .where(class_name: name)
        .exists?
    end
  end
end
