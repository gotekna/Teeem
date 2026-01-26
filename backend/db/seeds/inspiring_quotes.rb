# Business-Focused Bible Quotes Seeds
puts "Clearing existing quotes..."
InspiringQuote.destroy_all

quotes = [
  # Leadership & Vision
  { quote: 'Where there is no vision, the people perish.', author: 'Proverbs 29:18', category: 'Leadership', display_order: 1, aussie_slang: "No plan, no game - get a vision for your business or watch it fade!" },
  { quote: 'For which of you, intending to build a tower, does not sit down first and count the cost?', author: 'Luke 14:28', category: 'Planning', display_order: 2, aussie_slang: "Before you start any project, crunch the numbers first - no surprises!" },
  { quote: 'The plans of the diligent lead surely to abundance, but everyone who is hasty comes only to poverty.', author: 'Proverbs 21:5', category: 'Planning', display_order: 3, aussie_slang: "Plan it out properly and you'll win - rush it and you'll lose your shirt!" },

  # Work Ethic
  { quote: 'Whatever you do, work at it with all your heart, as working for the Lord.', author: 'Colossians 3:23', category: 'Work', display_order: 4, aussie_slang: "Give it 110% every day - work like your reputation depends on it!" },
  { quote: 'Commit to the Lord whatever you do, and he will establish your plans.', author: 'Proverbs 16:3', category: 'Work', display_order: 5, aussie_slang: "Put in the hard yards with the right attitude and your plans will come together!" },
  { quote: 'The hand of the diligent will rule, while the slothful will be put to forced labor.', author: 'Proverbs 12:24', category: 'Work', display_order: 6, aussie_slang: "Work hard and you'll lead - slack off and you'll follow!" },
  { quote: 'Do you see a man skillful in his work? He will stand before kings.', author: 'Proverbs 22:29', category: 'Excellence', display_order: 7, aussie_slang: "Master your craft and the big opportunities will find you!" },

  # Integrity & Trust
  { quote: 'A good name is to be chosen rather than great riches.', author: 'Proverbs 22:1', category: 'Integrity', display_order: 8, aussie_slang: "Your reputation is worth more than any payday - protect it!" },
  { quote: 'Whoever can be trusted with very little can also be trusted with much.', author: 'Luke 16:10', category: 'Trust', display_order: 9, aussie_slang: "Nail the small jobs and the big ones will come your way!" },
  { quote: 'Let your yes be yes and your no be no.', author: 'Matthew 5:37', category: 'Integrity', display_order: 10, aussie_slang: "Say what you mean, do what you say - that's how you build trust!" },

  # Perseverance & Resilience
  { quote: 'I can do all things through Christ who strengthens me.', author: 'Philippians 4:13', category: 'Strength', display_order: 11, aussie_slang: "You've got what it takes - dig deep and get it done!" },
  { quote: 'Consider it pure joy when you face trials of many kinds, because the testing of your faith produces perseverance.', author: 'James 1:2-3', category: 'Resilience', display_order: 12, aussie_slang: "Tough times make tough teams - embrace the challenge!" },
  { quote: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.', author: 'Galatians 6:9', category: 'Perseverance', display_order: 13, aussie_slang: "Keep pushing - the payoff is coming if you don't quit!" },

  # Wisdom & Decision Making
  { quote: 'If any of you lacks wisdom, let him ask God, who gives generously to all without reproach.', author: 'James 1:5', category: 'Wisdom', display_order: 14, aussie_slang: "Not sure what to do? Take a breath and think it through properly!" },
  { quote: 'Plans fail for lack of counsel, but with many advisers they succeed.', author: 'Proverbs 15:22', category: 'Wisdom', display_order: 15, aussie_slang: "Don't go it alone - get good advice before big decisions!" },
  { quote: 'The way of a fool is right in his own eyes, but a wise man listens to advice.', author: 'Proverbs 12:15', category: 'Wisdom', display_order: 16, aussie_slang: "Smart people listen to feedback - don't be too proud to learn!" },

  # Teamwork & Service
  { quote: 'Two are better than one, because they have a good reward for their toil.', author: 'Ecclesiastes 4:9', category: 'Teamwork', display_order: 17, aussie_slang: "Teamwork makes the dream work - together we get more done!" },
  { quote: 'As iron sharpens iron, so one person sharpens another.', author: 'Proverbs 27:17', category: 'Teamwork', display_order: 18, aussie_slang: "Good teammates make each other better - that's how we level up!" },
  { quote: 'Whoever wants to become great among you must be your servant.', author: 'Matthew 20:26', category: 'Leadership', display_order: 19, aussie_slang: "Real leaders serve their team - look after your people!" },

  # Finances & Stewardship
  { quote: 'The borrower is servant to the lender.', author: 'Proverbs 22:7', category: 'Finance', display_order: 20, aussie_slang: "Stay on top of your debts or they'll be on top of you!" },
  { quote: 'Dishonest money dwindles away, but whoever gathers money little by little makes it grow.', author: 'Proverbs 13:11', category: 'Finance', display_order: 21, aussie_slang: "Build wealth steady and honest - no shortcuts that'll bite you later!" },

  # Peace & Stress
  { quote: 'Cast all your anxiety on him because he cares for you.', author: '1 Peter 5:7', category: 'Peace', display_order: 22, aussie_slang: "Don't carry the stress alone - let it go and focus on what you can control!" },
  { quote: 'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.', author: 'Philippians 4:6', category: 'Peace', display_order: 23, aussie_slang: "Stressed? Take a breath, think it through, then tackle it one step at a time!" },
  { quote: 'Be still, and know that I am God.', author: 'Psalm 46:10', category: 'Peace', display_order: 24, aussie_slang: "Sometimes you need to pause, reset, and see the bigger picture!" },

  # Success & Purpose
  { quote: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.', author: 'Jeremiah 29:11', category: 'Purpose', display_order: 25, aussie_slang: "There's a bigger plan at play - keep building toward something great!" },
  { quote: 'With God all things are possible.', author: 'Matthew 19:26', category: 'Faith', display_order: 26, aussie_slang: "What seems impossible today could be tomorrow's success story!" },
  { quote: 'But seek first the kingdom of God and his righteousness, and all these things will be added to you.', author: 'Matthew 6:33', category: 'Purpose', display_order: 27, aussie_slang: "Get your priorities right and everything else will fall into place!" }
]

puts "Seeding business-focused Bible quotes..."

quotes.each do |quote_data|
  InspiringQuote.create!(quote_data)
end

puts "Successfully seeded #{InspiringQuote.count} business-focused Bible quotes!"
