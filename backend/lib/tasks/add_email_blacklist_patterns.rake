# frozen_string_literal: true

namespace :email do
  desc "Add missing email blacklist patterns from sync filter analysis"
  task add_blacklist_patterns: :environment do
    patterns_to_add = [
      # System emails (high priority)
      { pattern_type: "from_email", pattern: "donotreply@" },
      { pattern_type: "subject", pattern: "verification code" },
      { pattern_type: "subject", pattern: "verify your" },
      { pattern_type: "subject", pattern: "password reset" },
      { pattern_type: "subject", pattern: "security alert" },
      { pattern_type: "subject", pattern: "confirm a" },
      { pattern_type: "subject", pattern: "reset password" },

      # Marketing patterns
      { pattern_type: "from_email", pattern: "marketing@" },
      { pattern_type: "from_email", pattern: "promo@" },
      { pattern_type: "from_email", pattern: "newsletter@" }
    ]

    added = 0
    skipped = 0

    # Get next available ID
    next_id = (EmailBlacklistItem.maximum(:id) || 0) + 1

    patterns_to_add.each do |attrs|
      if EmailBlacklistItem.exists?(pattern_type: attrs[:pattern_type], pattern: attrs[:pattern])
        puts "  Skipping existing: #{attrs[:pattern_type]} = #{attrs[:pattern]}"
        skipped += 1
      else
        item = EmailBlacklistItem.new(attrs.merge(active: true, description: "Auto-added from sync filter analysis"))
        item.id = next_id
        item.save!
        puts "  Added: #{attrs[:pattern_type]} = #{attrs[:pattern]}"
        added += 1
        next_id += 1
      end
    end

    puts "\nSummary: Added #{added} new patterns, skipped #{skipped} existing"
  end
end
