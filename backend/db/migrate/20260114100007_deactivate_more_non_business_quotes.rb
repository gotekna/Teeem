class DeactivateMoreNonBusinessQuotes < ActiveRecord::Migration[7.1]
  def up
    # Deactivate remaining faith/love/peace/hope quotes
    # User wants strictly business-focused quotes only
    non_business_quotes = [
      # Strength - too spiritual
      'I can do all things through Christ who strengthens me.',
      'But those who hope in the Lord will renew their strength. They will soar on wings like eagles.',
      # Hope - too spiritual
      'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil.',
      # Faith - too spiritual
      'Trust in the Lord with all your heart and lean not on your own understanding.',
      'And we know that in all things God works for the good of those who love him.',
      # Peace - too spiritual
      'The Lord is my shepherd, I lack nothing.',
      # Love - not business
      'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.'
    ]

    count = InspiringQuote.where(quote: non_business_quotes).update_all(is_active: false)
    puts "Deactivated #{count} more non-business focused quotes"

    # Also deactivate by category for any we might have missed
    category_count = InspiringQuote.where(category: ['Faith', 'Love', 'Peace', 'Hope'], is_active: true).update_all(is_active: false)
    puts "Deactivated #{category_count} quotes by category (Faith, Love, Peace, Hope)"
  end

  def down
    InspiringQuote.where(category: ['Faith', 'Love', 'Peace', 'Hope']).update_all(is_active: true)
  end
end
