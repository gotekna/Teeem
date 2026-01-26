class DeactivateNonBusinessQuotes < ActiveRecord::Migration[7.1]
  def up
    # Deactivate quotes that are more faith/peace focused rather than business
    # User wants strictly business-focused quotes only
    non_business_quotes = [
      # Peace category - anxiety/stress focused
      'Cast all your anxiety on him because he cares for you.',
      'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.',
      'Be still, and know that I am God.',
      # Faith category
      'With God all things are possible.',
      # Purpose category - too spiritual
      'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.',
      'But seek first the kingdom of God and his righteousness, and all these things will be added to you.'
    ]

    count = InspiringQuote.where(quote: non_business_quotes).update_all(is_active: false)
    puts "Deactivated #{count} non-business focused quotes"
  end

  def down
    # Reactivate the quotes
    non_business_quotes = [
      'Cast all your anxiety on him because he cares for you.',
      'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.',
      'Be still, and know that I am God.',
      'With God all things are possible.',
      'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.',
      'But seek first the kingdom of God and his righteousness, and all these things will be added to you.'
    ]

    InspiringQuote.where(quote: non_business_quotes).update_all(is_active: true)
  end
end
