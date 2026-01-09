# frozen_string_literal: true

namespace :ssot do
  desc "Audit all models for missing method calls (NoMethodError prevention)"
  task audit: :environment do
    require_relative "../ssot_auditor"
    exit SsotAuditor.new.run
  end

  desc "Audit and generate suggested fixes"
  task fix: :environment do
    require_relative "../ssot_auditor"
    exit SsotAuditor.new(fix: true).run
  end

  desc "Quick audit of priority models only"
  task quick: :environment do
    require_relative "../ssot_auditor"
    # Could add a quick mode later
    exit SsotAuditor.new.run
  end
end
