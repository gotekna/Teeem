class AddMoreBusinessLeadershipQuotes < ActiveRecord::Migration[7.1]
  def up
    quotes = [
      # Leadership Excellence
      {
        quote: 'The heart of the wise teaches his mouth, and adds learning to his lips.',
        author: 'Proverbs 16:23',
        category: 'Leadership',
        aussie_slang: "Smart leaders think before they speak - and they're always learning!"
      },
      {
        quote: 'A wise man is strong, and a man of knowledge increases strength.',
        author: 'Proverbs 24:5',
        category: 'Leadership',
        aussie_slang: "Knowledge is power, mate - keep learning and you'll keep winning!"
      },
      {
        quote: 'He who walks with wise men will be wise, but the companion of fools will suffer harm.',
        author: 'Proverbs 13:20',
        category: 'Leadership',
        aussie_slang: "Surround yourself with legends and you'll become one!"
      },
      {
        quote: 'The generous soul will be made rich, and he who waters will also be watered himself.',
        author: 'Proverbs 11:25',
        category: 'Leadership',
        aussie_slang: "Help others grow and watch your own success multiply!"
      },
      {
        quote: 'By wisdom a house is built, and by understanding it is established.',
        author: 'Proverbs 24:3',
        category: 'Leadership',
        aussie_slang: "Build your business on smarts and solid foundations - not shortcuts!"
      },

      # Business Strategy
      {
        quote: 'Prepare your work outside; get everything ready for yourself in the field, and after that build your house.',
        author: 'Proverbs 24:27',
        category: 'Planning',
        aussie_slang: "Get your ducks in a row before you start building - prep work pays off!"
      },
      {
        quote: 'In all toil there is profit, but mere talk tends only to poverty.',
        author: 'Proverbs 14:23',
        category: 'Work',
        aussie_slang: "Less talking, more doing - action beats yarning every time!"
      },
      {
        quote: 'A slack hand causes poverty, but the hand of the diligent makes rich.',
        author: 'Proverbs 10:4',
        category: 'Work',
        aussie_slang: "Put in the hard yakka and the rewards will follow!"
      },
      {
        quote: 'The soul of the sluggard craves and gets nothing, while the soul of the diligent is richly supplied.',
        author: 'Proverbs 13:4',
        category: 'Work',
        aussie_slang: "Wanting it isn't enough - you gotta work for it to get it!"
      },
      {
        quote: 'Wealth gained hastily will dwindle, but whoever gathers little by little will increase it.',
        author: 'Proverbs 13:11',
        category: 'Finance',
        aussie_slang: "Build it brick by brick - sustainable beats flashy every time!"
      },

      # Excellence & Quality
      {
        quote: 'Whatever your hand finds to do, do it with your might.',
        author: 'Ecclesiastes 9:10',
        category: 'Excellence',
        aussie_slang: "If you're gonna do something, give it everything you've got!"
      },
      {
        quote: 'The way of the lazy is like a hedge of thorns, but the path of the upright is a level highway.',
        author: 'Proverbs 15:19',
        category: 'Excellence',
        aussie_slang: "Take the hard road with hard work - it's actually easier in the long run!"
      },
      {
        quote: 'He who is faithful in a very little is also faithful in much.',
        author: 'Luke 16:10',
        category: 'Excellence',
        aussie_slang: "Crush the small stuff and you'll be trusted with the big stuff!"
      },
      {
        quote: 'The desire of the sluggard kills him, for his hands refuse to labor.',
        author: 'Proverbs 21:25',
        category: 'Work',
        aussie_slang: "Dreams without action are just wishes - get moving!"
      },

      # Team & People
      {
        quote: 'Where there is no guidance, a people falls, but in an abundance of counselors there is safety.',
        author: 'Proverbs 11:14',
        category: 'Teamwork',
        aussie_slang: "Build a solid team of advisors - no one succeeds alone!"
      },
      {
        quote: 'A brother offended is more unyielding than a strong city.',
        author: 'Proverbs 18:19',
        category: 'Teamwork',
        aussie_slang: "Look after your relationships - fixing broken trust is harder than keeping it!"
      },
      {
        quote: 'He who ignores discipline despises himself, but whoever heeds correction gains understanding.',
        author: 'Proverbs 15:32',
        category: 'Leadership',
        aussie_slang: "Take feedback like a champ - that's how winners improve!"
      },
      {
        quote: 'Faithful are the wounds of a friend; profuse are the kisses of an enemy.',
        author: 'Proverbs 27:6',
        category: 'Leadership',
        aussie_slang: "Honest mates tell you the truth even when it stings - value them!"
      },

      # Courage & Action
      {
        quote: 'Have I not commanded you? Be strong and courageous. Do not be frightened.',
        author: 'Joshua 1:9',
        category: 'Courage',
        aussie_slang: "Suck it up and have a crack - fear never built anything great!"
      },
      {
        quote: 'The wicked flee when no one pursues, but the righteous are bold as a lion.',
        author: 'Proverbs 28:1',
        category: 'Courage',
        aussie_slang: "Play it straight and you'll have nothing to fear - be bold!"
      },
      {
        quote: 'If you faint in the day of adversity, your strength is small.',
        author: 'Proverbs 24:10',
        category: 'Resilience',
        aussie_slang: "Tough times reveal your true strength - don't buckle when it counts!"
      },
      {
        quote: 'The horse is made ready for the day of battle, but the victory belongs to the Lord.',
        author: 'Proverbs 21:31',
        category: 'Planning',
        aussie_slang: "Prepare like it depends on you, trust like it depends on something bigger!"
      },

      # Wisdom & Decisions
      {
        quote: 'The beginning of wisdom is this: Get wisdom, and whatever you get, get insight.',
        author: 'Proverbs 4:7',
        category: 'Wisdom',
        aussie_slang: "Priority one: get smart about your business - everything else follows!"
      },
      {
        quote: 'A prudent man conceals knowledge, but the heart of fools proclaims folly.',
        author: 'Proverbs 12:23',
        category: 'Wisdom',
        aussie_slang: "Know when to speak and when to listen - loose lips sink ships!"
      },
      {
        quote: 'The simple believes everything, but the prudent gives thought to his steps.',
        author: 'Proverbs 14:15',
        category: 'Wisdom',
        aussie_slang: "Don't be gullible - check the facts before you commit!"
      },
      {
        quote: 'Without counsel plans fail, but with many advisers they succeed.',
        author: 'Proverbs 15:22',
        category: 'Wisdom',
        aussie_slang: "Get good advice before big decisions - wise heads win!"
      },

      # Patience & Timing
      {
        quote: 'Better is the end of a thing than its beginning, and the patient in spirit is better than the proud in spirit.',
        author: 'Ecclesiastes 7:8',
        category: 'Perseverance',
        aussie_slang: "Finish what you start and stay humble - that's the winning combo!"
      },
      {
        quote: 'To everything there is a season, and a time to every purpose under heaven.',
        author: 'Ecclesiastes 3:1',
        category: 'Wisdom',
        aussie_slang: "Timing matters - know when to push and when to wait!"
      },
      {
        quote: 'Hope deferred makes the heart sick, but a desire fulfilled is a tree of life.',
        author: 'Proverbs 13:12',
        category: 'Success',
        aussie_slang: "Don't just dream about it - make it happen and watch morale soar!"
      },
      {
        quote: 'The fruit of the righteous is a tree of life, and whoever captures souls is wise.',
        author: 'Proverbs 11:30',
        category: 'Leadership',
        aussie_slang: "Great leaders inspire others - build a team that believes in the mission!"
      }
    ]

    max_order = InspiringQuote.maximum(:display_order) || 0

    quotes.each_with_index do |quote_data, index|
      InspiringQuote.create!(
        quote: quote_data[:quote],
        author: quote_data[:author],
        category: quote_data[:category],
        aussie_slang: quote_data[:aussie_slang],
        display_order: max_order + index + 1,
        is_active: true
      )
    end

    puts "Added #{quotes.length} new business and leadership Bible quotes!"
  end

  def down
    # Remove quotes added by this migration (by author pattern)
    InspiringQuote.where(quote: [
      'The heart of the wise teaches his mouth, and adds learning to his lips.',
      'A wise man is strong, and a man of knowledge increases strength.',
      'He who walks with wise men will be wise, but the companion of fools will suffer harm.',
      'The generous soul will be made rich, and he who waters will also be watered himself.',
      'By wisdom a house is built, and by understanding it is established.',
      'Prepare your work outside; get everything ready for yourself in the field, and after that build your house.',
      'In all toil there is profit, but mere talk tends only to poverty.',
      'A slack hand causes poverty, but the hand of the diligent makes rich.',
      'The soul of the sluggard craves and gets nothing, while the soul of the diligent is richly supplied.',
      'Wealth gained hastily will dwindle, but whoever gathers little by little will increase it.',
      'Whatever your hand finds to do, do it with your might.',
      'The way of the lazy is like a hedge of thorns, but the path of the upright is a level highway.',
      'He who is faithful in a very little is also faithful in much.',
      'The desire of the sluggard kills him, for his hands refuse to labor.',
      'Where there is no guidance, a people falls, but in an abundance of counselors there is safety.',
      'A brother offended is more unyielding than a strong city.',
      'He who ignores discipline despises himself, but whoever heeds correction gains understanding.',
      'Faithful are the wounds of a friend; profuse are the kisses of an enemy.',
      'Have I not commanded you? Be strong and courageous. Do not be frightened.',
      'The wicked flee when no one pursues, but the righteous are bold as a lion.',
      'If you faint in the day of adversity, your strength is small.',
      'The horse is made ready for the day of battle, but the victory belongs to the Lord.',
      'The beginning of wisdom is this: Get wisdom, and whatever you get, get insight.',
      'A prudent man conceals knowledge, but the heart of fools proclaims folly.',
      'The simple believes everything, but the prudent gives thought to his steps.',
      'Without counsel plans fail, but with many advisers they succeed.',
      'Better is the end of a thing than its beginning, and the patient in spirit is better than the proud in spirit.',
      'To everything there is a season, and a time to every purpose under heaven.',
      'Hope deferred makes the heart sick, but a desire fulfilled is a tree of life.',
      'The fruit of the righteous is a tree of life, and whoever captures souls is wise.'
    ]).destroy_all
  end
end
