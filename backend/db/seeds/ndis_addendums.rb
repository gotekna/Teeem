# frozen_string_literal: true

# Seed file for NDIS Addendums
# Run with: rails runner 'load Rails.root.join("db/seeds/ndis_addendums.rb")'

puts "Creating NDIS Addendums..."

# ============================================
# SPECIFICATION ADDENDUMS
# ============================================

NdisAddendum.find_or_create_by!(title: "SDA Design Standards Compliance") do |a|
  a.document_type = "specification"
  a.section_key = "general"
  a.position = 1
  a.content = <<~HTML
    <h4>Specialist Disability Accommodation (SDA) Compliance</h4>
    <p>This dwelling is designed and constructed to comply with the following SDA Design Standards:</p>
    <ul>
      <li>NDIS (Specialist Disability Accommodation) Rules 2020</li>
      <li>SDA Design Standard (current version)</li>
      <li>National Construction Code - Livable Housing Design Guidelines</li>
      <li>AS 1428.1 - Design for access and mobility</li>
    </ul>
    <p>All accessibility features are included as standard and must not be removed or modified without written approval from the NDIS and relevant certifying authority.</p>
  HTML
  a.is_active = true
end
puts "  Created: SDA Design Standards Compliance"

NdisAddendum.find_or_create_by!(title: "Accessibility Features - General") do |a|
  a.document_type = "specification"
  a.section_key = "accessibility"
  a.position = 2
  a.content = <<~HTML
    <h4>Standard Accessibility Features</h4>
    <p>The following accessibility features are included as standard:</p>
    <ul>
      <li><strong>Entry:</strong> Step-free entry with minimum 1000mm clear opening</li>
      <li><strong>Corridors:</strong> Minimum 1200mm wide with 1500mm turning circles at junctions</li>
      <li><strong>Doorways:</strong> Minimum 850mm clear opening with lever handles at 900-1100mm height</li>
      <li><strong>Light switches:</strong> Rocker type at 900-1100mm height</li>
      <li><strong>Power points:</strong> At 450-600mm height from floor</li>
      <li><strong>Floor surfaces:</strong> Slip-resistant with smooth transitions</li>
    </ul>
  HTML
  a.is_active = true
end
puts "  Created: Accessibility Features - General"

NdisAddendum.find_or_create_by!(title: "Accessibility Features - Bathroom") do |a|
  a.document_type = "specification"
  a.section_key = "bathroom"
  a.position = 3
  a.content = <<~HTML
    <h4>Accessible Bathroom Requirements</h4>
    <ul>
      <li><strong>Shower:</strong> Hobless shower with minimum 1160mm x 1100mm clear floor area</li>
      <li><strong>Grab rails:</strong> Stainless steel grab rails as per AS 1428.1 requirements</li>
      <li><strong>Shower seat:</strong> Fold-down shower seat at 460-480mm height</li>
      <li><strong>Basin:</strong> Wall-mounted at 800-850mm height with knee clearance below</li>
      <li><strong>Toilet:</strong> Wall-faced pan with seat height 460-480mm, with adjacent grab rails</li>
      <li><strong>Taps:</strong> Lever-style tapware or sensor-activated</li>
      <li><strong>Floor:</strong> Non-slip floor tiles with fall to waste grate</li>
      <li><strong>Mirror:</strong> Full-length tilting mirror</li>
    </ul>
  HTML
  a.is_active = true
end
puts "  Created: Accessibility Features - Bathroom"

NdisAddendum.find_or_create_by!(title: "Accessibility Features - Kitchen") do |a|
  a.document_type = "specification"
  a.section_key = "kitchen"
  a.position = 4
  a.content = <<~HTML
    <h4>Accessible Kitchen Requirements</h4>
    <ul>
      <li><strong>Benchtop:</strong> Section at 850mm height with knee clearance for seated use</li>
      <li><strong>Cooktop:</strong> Induction cooktop with front-mounted controls</li>
      <li><strong>Oven:</strong> Wall-mounted oven at accessible height with side-opening door</li>
      <li><strong>Sink:</strong> Shallow basin with lever tapware and insulated pipes</li>
      <li><strong>Storage:</strong> Pull-out drawers and adjustable shelving</li>
      <li><strong>Clearances:</strong> Minimum 1500mm clear floor space for turning</li>
    </ul>
  HTML
  a.is_active = true
end
puts "  Created: Accessibility Features - Kitchen"

NdisAddendum.find_or_create_by!(title: "Smart Home & Assistive Technology") do |a|
  a.document_type = "specification"
  a.section_key = "electrical"
  a.position = 5
  a.content = <<~HTML
    <h4>Assistive Technology Provisions</h4>
    <p>Pre-wiring and infrastructure for assistive technology:</p>
    <ul>
      <li><strong>Smart home hub:</strong> Central location with data and power</li>
      <li><strong>Automated lighting:</strong> Smart switches in all rooms</li>
      <li><strong>Automated blinds:</strong> Power supply and control wiring to windows</li>
      <li><strong>Video intercom:</strong> At entry with indoor stations</li>
      <li><strong>Emergency call:</strong> Pull cords in bathroom and bedroom areas</li>
      <li><strong>Ceiling hoist:</strong> Structural provision and power in bedroom and bathroom</li>
      <li><strong>Electronic door openers:</strong> Power and control wiring at external doors</li>
    </ul>
  HTML
  a.is_active = true
end
puts "  Created: Smart Home & Assistive Technology"

# ============================================
# CONTRACT ADDENDUMS
# ============================================

NdisAddendum.find_or_create_by!(title: "NDIS Participant Rights") do |a|
  a.document_type = "contract"
  a.section_key = "participant_rights"
  a.position = 1
  a.content = <<~HTML
    <h4>NDIS Participant Rights</h4>
    <p>As an NDIS participant, you have the following rights in relation to this building contract:</p>
    <ol>
      <li>The right to be consulted on all design decisions affecting accessibility features</li>
      <li>The right to have your Support Coordinator or nominee present at all meetings</li>
      <li>The right to request modifications to standard accessibility features (subject to compliance requirements)</li>
      <li>The right to inspect accessibility features before practical completion</li>
      <li>The right to request remediation of any accessibility features not meeting SDA Design Standards</li>
    </ol>
    <p>The Builder acknowledges these rights and agrees to work collaboratively with the Participant and their support network throughout the construction process.</p>
  HTML
  a.is_active = true
end
puts "  Created: NDIS Participant Rights"

NdisAddendum.find_or_create_by!(title: "SDA Certification Requirements") do |a|
  a.document_type = "contract"
  a.section_key = "certification"
  a.position = 2
  a.content = <<~HTML
    <h4>SDA Certification Requirements</h4>
    <p>The Builder agrees to:</p>
    <ol>
      <li>Ensure all works comply with the SDA Design Standard and relevant building codes</li>
      <li>Engage an accredited SDA Assessor for design review prior to construction</li>
      <li>Obtain interim inspections of accessibility features during construction</li>
      <li>Provide all documentation required for SDA enrollment application</li>
      <li>Rectify any non-compliant features identified during SDA assessment at no additional cost</li>
      <li>Provide as-built drawings showing final accessibility feature locations and specifications</li>
    </ol>
    <p><strong>Note:</strong> Final SDA enrollment is subject to NDIA approval and is not guaranteed by this contract.</p>
  HTML
  a.is_active = true
end
puts "  Created: SDA Certification Requirements"

NdisAddendum.find_or_create_by!(title: "Defects Liability - Accessibility") do |a|
  a.document_type = "contract"
  a.section_key = "defects"
  a.position = 3
  a.content = <<~HTML
    <h4>Extended Defects Liability for Accessibility Features</h4>
    <p>In addition to the standard defects liability period, the following extended warranties apply to accessibility features:</p>
    <table border="1" cellpadding="5">
      <tr>
        <th>Feature</th>
        <th>Warranty Period</th>
      </tr>
      <tr>
        <td>Grab rails and supports</td>
        <td>10 years</td>
      </tr>
      <tr>
        <td>Ceiling hoist tracks</td>
        <td>10 years</td>
      </tr>
      <tr>
        <td>Electronic door openers</td>
        <td>5 years</td>
      </tr>
      <tr>
        <td>Smart home systems</td>
        <td>3 years</td>
      </tr>
      <tr>
        <td>Non-slip floor finishes</td>
        <td>5 years</td>
      </tr>
    </table>
    <p>The Builder will respond to defects affecting participant safety within 24 hours of notification.</p>
  HTML
  a.is_active = true
end
puts "  Created: Defects Liability - Accessibility"

NdisAddendum.find_or_create_by!(title: "Variations - Accessibility Features") do |a|
  a.document_type = "contract"
  a.section_key = "variations"
  a.position = 4
  a.content = <<~HTML
    <h4>Variations to Accessibility Features</h4>
    <p>Any variations to specified accessibility features must:</p>
    <ol>
      <li>Be requested in writing by the Participant or their authorised representative</li>
      <li>Be assessed by an accredited SDA Assessor for compliance impact</li>
      <li>Receive written approval from the NDIS (if affecting SDA classification)</li>
      <li>Be documented with revised drawings and specifications</li>
    </ol>
    <p><strong>Important:</strong> Variations that reduce the dwelling's SDA compliance level may affect NDIS funding eligibility. The Builder will advise the Participant of any compliance risks before proceeding with variations.</p>
  HTML
  a.is_active = true
end
puts "  Created: Variations - Accessibility Features"

puts "NDIS Addendums seeding complete!"
