# Seed common minute templates
templates = [
  {
    name: 'Directors Meeting - General',
    template_type: 'company',
    body: <<~BODY,
      MINUTES OF MEETING OF DIRECTORS
      of
      {{company_name}}
      ACN {{acn}}

      HELD: {{meeting_date}}
      PRESENT: {{director_names}}
      IN THE CHAIR: {{director_name}}

      QUORUM
      It was noted that a quorum was present.

      NOTICE OF MEETING
      The Chair confirmed that proper notice of the meeting had been given to all Directors.

      BUSINESS
      {{business_items}}

      CLOSE OF MEETING
      There being no further business, the meeting was declared closed.

      CONFIRMED as a correct record.

      _________________________
      {{director_name}}
      Chair
      Date: ___________________
    BODY
    active: true
  },
  {
    name: 'Directors Resolution - Dividend Declaration',
    template_type: 'company',
    body: <<~BODY,
      WRITTEN RESOLUTION OF DIRECTORS
      of
      {{company_name}}
      ACN {{acn}}

      In accordance with Section 248A of the Corporations Act 2001, the undersigned, being all Directors of the Company entitled to receive notice of a meeting of Directors, hereby consent to the following resolution:

      RESOLUTION: DECLARATION OF DIVIDEND

      IT IS RESOLVED THAT:
      1. A {{dividend_type}} dividend of {{distribution_amount}} be declared payable to shareholders on record as at {{record_date}}.
      2. The dividend will be {{franking_status}} franked at {{franking_percentage}}%.
      3. The dividend will be paid on or before {{payment_date}}.
      4. The Company Secretary is authorised to take all necessary steps to give effect to this resolution.

      DATED: {{resolution_date}}

      _________________________
      {{director_name}}
      Director
    BODY
    active: true
  },
  {
    name: 'Directors Resolution - Trust Distribution',
    template_type: 'trust',
    body: <<~BODY,
      WRITTEN RESOLUTION OF DIRECTORS
      of
      {{company_name}} as Trustee for {{trust_name}}
      ACN {{acn}}

      In accordance with Section 248A of the Corporations Act 2001, the undersigned, being all Directors of the Company entitled to receive notice of a meeting of Directors, hereby consent to the following resolution:

      RESOLUTION: DISTRIBUTION TO BENEFICIARIES

      IT IS RESOLVED THAT:
      1. The net income of the trust for the financial year ended {{financial_year_end}} be distributed to the beneficiaries as follows:
         {{distribution_details}}
      2. This resolution is made in accordance with the Trust Deed dated {{trust_deed_date}}.
      3. The Directors are satisfied that the Trust has sufficient funds to make these distributions.

      DATED: {{resolution_date}}

      _________________________
      {{director_name}}
      Director
    BODY
    active: true
  },
  {
    name: 'Directors Resolution - Appointment of Director',
    template_type: 'company',
    body: <<~BODY,
      WRITTEN RESOLUTION OF DIRECTORS
      of
      {{company_name}}
      ACN {{acn}}

      In accordance with Section 248A of the Corporations Act 2001, the undersigned, being all Directors of the Company entitled to receive notice of a meeting of Directors, hereby consent to the following resolution:

      RESOLUTION: APPOINTMENT OF DIRECTOR

      IT IS RESOLVED THAT:
      1. {{new_director_name}} of {{new_director_address}} be appointed as a Director of the Company with effect from {{appointment_date}}.
      2. The new Director has provided signed consent to act as a Director.
      3. ASIC Form 484 be lodged to notify the appointment.

      DATED: {{resolution_date}}

      _________________________
      {{director_name}}
      Director
    BODY
    active: true
  },
  {
    name: 'Directors Resolution - Change of Registered Office',
    template_type: 'company',
    body: <<~BODY,
      WRITTEN RESOLUTION OF DIRECTORS
      of
      {{company_name}}
      ACN {{acn}}

      In accordance with Section 248A of the Corporations Act 2001, the undersigned, being all Directors of the Company entitled to receive notice of a meeting of Directors, hereby consent to the following resolution:

      RESOLUTION: CHANGE OF REGISTERED OFFICE

      IT IS RESOLVED THAT:
      1. The registered office of the Company be changed from {{old_address}} to {{new_address}} with effect from {{effective_date}}.
      2. ASIC Form 484 be lodged to notify the change.
      3. All company stationery and records be updated accordingly.

      DATED: {{resolution_date}}

      _________________________
      {{director_name}}
      Director
    BODY
    active: true
  },
  {
    name: 'Annual General Meeting Minutes',
    template_type: 'company',
    body: <<~BODY,
      MINUTES OF ANNUAL GENERAL MEETING
      of
      {{company_name}}
      ACN {{acn}}

      HELD: {{meeting_date}} at {{meeting_time}}
      VENUE: {{meeting_venue}}

      PRESENT:
      Directors: {{director_names}}
      Shareholders: {{shareholder_names}}

      IN THE CHAIR: {{director_name}}

      QUORUM
      The Chair noted that a quorum of shareholders was present and declared the meeting open.

      NOTICE OF MEETING
      The notice convening the meeting was taken as read.

      MINUTES OF PREVIOUS AGM
      IT WAS RESOLVED that the minutes of the previous Annual General Meeting held on {{previous_agm_date}} be confirmed as a correct record.

      FINANCIAL STATEMENTS
      The financial statements for the year ended {{financial_year_end}} were presented.
      IT WAS RESOLVED that the financial statements be received and adopted.

      APPOINTMENT OF AUDITOR
      IT WAS RESOLVED that {{auditor_name}} continue as auditor of the Company.

      GENERAL BUSINESS
      {{general_business}}

      CLOSE OF MEETING
      There being no further business, the Chair declared the meeting closed at {{close_time}}.

      CONFIRMED as a correct record.

      _________________________
      {{director_name}}
      Chair
      Date: ___________________
    BODY
    active: true
  }
]

templates.each do |template|
  MinuteTemplate.find_or_create_by!(name: template[:name]) do |t|
    t.template_type = template[:template_type]
    t.body = template[:body]
    t.active = template[:active]
  end
end

puts "Created/Updated #{templates.length} minute templates"
