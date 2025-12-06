# Production Data Fixes

Run these commands in production Rails console to apply the contact enrichment fixes.

## Access Production Rails Console

```bash
heroku run rails console --app teeemlive
```

## 1. Dan Ryan - Create Davidson Ryan Lawyers and Link

```ruby
# Find Dan Ryan
dan = Contact.find_by(email: 'dryan@davidsonryan.com.au')

if dan && !dan.primary_company_id
  # Create company contact
  company_contact = Contact.find_or_create_by!(full_name: 'Davidson Ryan Lawyers', entity_type: 'company') do |c|
    c.company_name_or_trust = 'Davidson Ryan Lawyers'
    c.is_active = true
    c.website = 'https://davidsonryan.com.au'
    c.office_phone = '+61 7 3172 7873'
    c.email = 'admin@davidsonryan.com.au'
    c.address = 'Level 27, Santos Place, 32 Turbot St, Brisbane QLD 4000'
    c.link_to_cg = false
  end

  # Create Company record
  Company.find_or_create_by!(contact_id: company_contact.id) do |comp|
    comp.name = 'Davidson Ryan Lawyers'
    comp.status = 'active'
    comp.registered_office_address = 'Level 27, Santos Place, 32 Turbot St, Brisbane QLD 4000'
  end

  # Link Dan Ryan
  dan.update!(
    primary_company_id: company_contact.id,
    primary_role: 'Co-founder and Legal Practitioner Director',
    employment_status: 'current',
    office_phone: '+61 7 3172 7873',
    website: 'https://davidsonryan.com.au'
  )

  puts "✅ Dan Ryan linked to Davidson Ryan Lawyers"
else
  puts "⏭️  Already done or Dan Ryan not found"
end
```

## 2. Cheryl - Add ssqld.net.au Email

```ruby
cheryl = Contact.find_by(email: 'cheryl@yourda.com.au')

if cheryl
  existing = ContactEmail.find_by(email: 'cheryl@ssqld.net.au')
  if existing
    puts "Email already exists"
  else
    cheryl.contact_emails.create!(
      email: 'cheryl@ssqld.net.au',
      is_primary: false,
      position: cheryl.contact_emails.count
    )
    puts "✅ Added cheryl@ssqld.net.au to Cheryl Stainsby"
  end
else
  puts "❌ Cheryl not found"
end
```

## 3. Sue - Add ssqld.net.au Email (If Needed)

```ruby
sue = Contact.find_by(email: 'sue@yourda.com.au')

if sue
  existing = ContactEmail.find_by(email: 'sue@ssqld.net.au')
  if existing
    puts "Email already exists"
  else
    sue.contact_emails.create!(
      email: 'sue@ssqld.net.au',
      is_primary: false,
      position: sue.contact_emails.count
    )
    puts "✅ Added sue@ssqld.net.au to Sue Hayward"
  end
else
  puts "❌ Sue not found"
end
```

## 4. Kris McAinsh - Create Contact

```ruby
kris = Contact.find_by(email: 'kris.mcainsh@svp.com.au')

if kris
  puts "Contact already exists (ID: #{kris.id})"
else
  # Find SV Partners company
  sv_partners = Contact.where('email LIKE ?', '%@svp.com.au')
    .where.not(primary_company_id: nil)
    .includes(:primary_company)
    .first

  company_id = sv_partners&.primary_company_id

  kris = Contact.create!(
    email: 'kris.mcainsh@svp.com.au',
    first_name: 'Kris',
    last_name: 'McAinsh',
    entity_type: 'person',
    primary_company_id: company_id,
    is_active: true
  )

  puts "✅ Created Kris McAinsh (ID: #{kris.id})"
  puts "Company: #{kris.primary_company&.full_name || 'None'}"
end
```

## 5. Tekna - Update All Companies

```ruby
tekna_companies = Contact.where(entity_type: 'company').where('full_name LIKE ?', '%Tekna%')

tekna_companies.each do |company|
  company.update!(
    website: 'https://tekna.com.au',
    office_phone: '0407 397 541',
    email: 'robert@tekna.com.au'
  )
  puts "✅ Updated #{company.full_name}"
end

puts "Updated #{tekna_companies.count} Tekna companies"
```

## Deploy Frontend Fix

The frontend error handling has been committed. Deploy it:

```bash
# Frontend will auto-deploy via Vercel on git push
git push origin Live
```

## Summary

After running all commands:
- ✅ Dan Ryan → Davidson Ryan Lawyers
- ✅ Cheryl → cheryl@ssqld.net.au added
- ✅ Sue → sue@ssqld.net.au added
- ✅ Kris McAinsh → Created with SV Partners
- ✅ Tekna companies → Updated with website
