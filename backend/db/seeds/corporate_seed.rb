# Corporate Data Seed - Generated from Corporate File.xlsx import

puts "=== Seeding Corporate Data ==="

# Company Groups
puts "Creating Company Groups..."
groups = [
  { name: 'Tekna', description: 'Tekna Group companies' },
  { name: 'Team Harder', description: 'Team Harder Group companies' },
  { name: 'Team Harder Super Fund', description: 'Team Harder Super Fund Group' },
  { name: 'Promise', description: 'Promise Group companies' },
  { name: 'Charity', description: 'Charity organisations' },
  { name: 'Personal', description: 'Personal entities' }
]
groups.each do |g|
  CompanyGroup.find_or_create_by!(name: g[:name]) do |cg|
    cg.description = g[:description]
    cg.active = true
  end
end
puts "  Created #{CompanyGroup.count} company groups"

# Directors as Contacts
puts "Creating Directors..."
directors = [
  { display_name: 'Aaron Thomas Glowka', first_name: 'Aaron', last_name: 'Glowka', director_id: '002095619' },
  { display_name: 'Andrew Mark Clement', first_name: 'Andrew', last_name: 'Clement', director_id: '002037498' },
  { display_name: 'Rachel Anne Harder', first_name: 'Rachel', last_name: 'Harder', director_id: '002036826' },
  { display_name: 'Robert John Harder', first_name: 'Robert', last_name: 'Harder', director_id: '002036822' },
  { display_name: 'Jared Sa-Bin Harder', first_name: 'Jared', last_name: 'Harder', director_id: '002036829' },
  { display_name: 'Samuel James Harder', first_name: 'Samuel', last_name: 'Harder', director_id: '002036831' },
  { display_name: 'Sophie Mee-jeong Harder', first_name: 'Sophie', last_name: 'Harder', director_id: '002036833' },
  { display_name: 'Christine Leanne Harder', first_name: 'Christine', last_name: 'Harder', director_id: '002036835' },
  { display_name: 'James Jonathan Harder', first_name: 'James', last_name: 'Harder', director_id: '002036837' },
  { display_name: 'Jake Baird', first_name: 'Jake', last_name: 'Baird', director_id: '002095604' }
]
directors.each do |d|
  Contact.find_or_create_by!(display_name: d[:display_name]) do |c|
    c.first_name = d[:first_name]
    c.last_name = d[:last_name]
    # director_id column was removed - ASIC director IDs are stored in CorporateCompanyDirector
    c.entity_type = 'person'
    c.is_active = true
  end
end
puts "  Created #{directors.count} directors"

# Companies
puts "Creating Companies..."
companies_data = [
  { name: 'Tekna', group: 'Tekna', acn: '658462394', abn: '43658462394' },
  { name: 'Tekna Drafting (formerly Rock Invest Qld)', group: 'Tekna', acn: '159565849', abn: '96159565849' },
  { name: 'Tekna Homes formerly Tekna Licence', group: 'Tekna', acn: '658462732', abn: '34658462732' },
  { name: 'Tekna Admin Pty LTd', group: 'Tekna', acn: '673388424', abn: '81673388424' },
  { name: 'Team Harder', group: 'Team Harder', acn: '645359495', abn: nil },
  { name: 'Team Harder ATF Team Harder Super Fund', group: 'Team Harder', acn: nil, abn: '17209120631' },
  { name: 'Gen2612', group: 'Team Harder', acn: '658463659', abn: '47658463659' },
  { name: 'Prov1322 Global', group: 'Team Harder', acn: '658602478', abn: '34658602478' },
  { name: 'Prov1322 Global ATF Team Harder Family Trust', group: 'Team Harder', acn: nil, abn: '94633472433' },
  { name: 'Team Harder Super Investments', group: 'Team Harder', acn: '658706597', abn: '32658706597' },
  { name: 'W2G Assets', group: 'Team Harder', acn: '092659688', abn: '59092659688' },
  { name: 'The Promise QLD Pty Ltd', group: 'Promise', acn: nil, abn: nil },
  { name: 'The Promise Family Trust', group: 'Promise', acn: nil, abn: nil },
  { name: 'Robert Harder', group: 'Personal', acn: nil, abn: '93373928858' },
  { name: 'Rachel Harder', group: 'Personal', acn: nil, abn: nil },
  { name: 'Jared Harder', group: 'Personal', acn: nil, abn: nil },
  { name: 'Grace Harder', group: 'Personal', acn: nil, abn: nil },
  { name: 'Sophie Mee-Jeong Harder', group: 'Personal', acn: nil, abn: nil },
  { name: 'Co Invest Capital Pty Ltd', group: 'Tekna', acn: '691268452', abn: nil },
  { name: 'Co Invest Homes Pty Ltd', group: 'Tekna', acn: '691269333', abn: nil }
]
companies_data.each do |c|
  group = CompanyGroup.find_by(name: c[:group])
  Company.find_or_create_by!(name: c[:name]) do |co|
    co.company_group = group
    co.acn = c[:acn]
    co.abn = c[:abn]
    co.status = 'active'
  end
end
puts "  Created #{Company.count} companies"

# Company Directors linkage
puts "Linking Directors to Companies..."
director_links = [
  { company: 'Tekna', director: 'Andrew Mark Clement', position: 'director' },
  { company: 'Tekna Drafting (formerly Rock Invest Qld)', director: 'Andrew Mark Clement', position: 'director' },
  { company: 'Tekna Homes formerly Tekna Licence', director: 'Andrew Mark Clement', position: 'director' },
  { company: 'Tekna Admin Pty LTd', director: 'Andrew Mark Clement', position: 'director' },
  { company: 'Team Harder', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Gen2612', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Prov1322 Global', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Prov1322 Global ATF Team Harder Family Trust', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Team Harder Super Investments', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'W2G Assets', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Co Invest Capital Pty Ltd', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'Co Invest Homes Pty Ltd', director: 'Rachel Anne Harder', position: 'director' },
  { company: 'The Promise Family Trust', director: 'Sophie Mee-jeong Harder', position: 'director' }
]
director_links.each do |dl|
  company = Company.find_by(name: dl[:company])
  director = Contact.find_by("display_name ILIKE ?", "%#{dl[:director]}%")
  next unless company && director

  CompanyDirector.find_or_create_by!(company: company, contact: director) do |cd|
    cd.position = dl[:position]
    cd.is_current = true
  end
end
puts "  Created #{CompanyDirector.count} director links"

# Shareholdings
puts "Creating Shareholdings..."
shareholdings_data = [
  { company: 'Tekna Homes formerly Tekna Licence', shareholder: 'Prov1322 Global Pty Ltd', shares: 30, share_class: 'ordinary' },
  { company: 'Tekna Homes formerly Tekna Licence', shareholder: 'The Promise QLD Pty Ltd', shares: 115, share_class: 'ordinary' },
  { company: 'Tekna Homes formerly Tekna Licence', shareholder: 'Samuel James Harder', shares: 10, share_class: 'ordinary' }
]
shareholdings_data.each do |sh|
  company = Company.find_by(name: sh[:company])
  next unless company

  # Find or create shareholder contact
  shareholder = Contact.find_or_create_by!(display_name: sh[:shareholder]) do |c|
    c.first_name = sh[:shareholder].split.first
    c.last_name = sh[:shareholder].split[1..-1]&.join(' ')
    c.entity_type = sh[:shareholder].include?('Pty') || sh[:shareholder].include?('Trust') ? 'company' : 'person'
    c.is_active = true
  end

  CompanyShareholding.find_or_create_by!(
    company: company,
    shareholder: shareholder,
    share_class: sh[:share_class]
  ) do |s|
    s.number_of_shares = sh[:shares]
  end
end
puts "  Created #{CompanyShareholding.count} shareholdings"

# Bank Accounts
puts "Creating Bank Accounts..."
bank_accounts_data = [
  { company: 'Gen2612', institution: 'NAB', bsb: '083172', account_number: '817831254' },
  { company: 'Gen2612', institution: 'Westpac', bsb: '034076', account_number: '699650' },
  { company: 'Prov1322 Global ATF Team Harder Family Trust', institution: 'NAB', bsb: '084435', account_number: '959276787' },
  { company: 'Prov1322 Global ATF Team Harder Family Trust', institution: 'NAB', bsb: '083052', account_number: '305383521' },
  { company: 'Prov1322 Global ATF Team Harder Family Trust', institution: 'Westpac', bsb: '034076', account_number: '699669' },
  { company: 'Team Harder ATF Team Harder Super Fund', institution: 'NAB', bsb: '083052', account_number: '304656703' },
  { company: 'Team Harder Super Investments', institution: 'NAB', bsb: '083052', account_number: '305422840' },
  { company: 'Team Harder Super Investments', institution: 'NAB', bsb: '084435', account_number: '259449309' },
  { company: 'W2G Assets', institution: 'NAB', bsb: '084435', account_number: '513642009' },
  { company: 'W2G Assets', institution: 'NAB', bsb: '083052', account_number: '304658188' },
  { company: 'W2G Assets', institution: 'Suncorp', bsb: '124034', account_number: '21446327' },
  { company: 'Tekna', institution: 'NAB', bsb: '084435', account_number: '199211357' },
  { company: 'Tekna', institution: 'Westpac', bsb: '034076', account_number: '699618' },
  { company: 'Tekna Drafting (formerly Rock Invest Qld)', institution: 'NAB', bsb: '084435', account_number: '922875532' },
  { company: 'Tekna Drafting (formerly Rock Invest Qld)', institution: 'Westpac', bsb: '034076', account_number: '699626' },
  { company: 'Tekna Homes formerly Tekna Licence', institution: 'NAB', bsb: '084435', account_number: '302971208' },
  { company: 'Tekna Homes formerly Tekna Licence', institution: 'Westpac', bsb: '034076', account_number: '702733' },
  { company: 'Tekna Admin Pty LTd', institution: 'NAB', bsb: '083004', account_number: '268693995' },
  { company: 'Tekna Admin Pty LTd', institution: 'Westpac', bsb: '034076', account_number: '699642' }
]
bank_accounts_data.each do |ba|
  company = Company.find_by(name: ba[:company])
  next unless company

  BankAccount.find_or_create_by!(
    company: company,
    bsb: ba[:bsb],
    account_number: ba[:account_number]
  ) do |b|
    b.institution_name = ba[:institution]
    b.account_name = company.name
    b.status = 'active'
  end
end
puts "  Created #{BankAccount.count} bank accounts"

puts ""
puts "=== Corporate Seed Complete ==="
puts "Company Groups: #{CompanyGroup.count}"
puts "Companies: #{Company.count}"
puts "Directors: #{Contact.where.not(director_id: nil).count}"
puts "Company Directors: #{CompanyDirector.count}"
puts "Shareholdings: #{CompanyShareholding.count}"
puts "Bank Accounts: #{BankAccount.count}"
