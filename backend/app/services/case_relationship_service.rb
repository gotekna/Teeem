# Service to build relationship graph data for case visualization
class CaseRelationshipService
  def initialize(case_record)
    @case = case_record
  end

  # Build nodes and edges for XYFlow visualization
  def build_relationship_graph
    nodes = []
    edges = []

    # Add case node as center
    nodes << build_case_node

    # Add contact nodes - now grouped by company
    contact_nodes, contact_edges = build_contact_nodes_and_edges_grouped
    nodes.concat(contact_nodes)
    edges.concat(contact_edges)

    # Add company nodes (only those not already shown via contact grouping)
    company_nodes, company_edges = build_company_nodes_and_edges
    nodes.concat(company_nodes)
    edges.concat(company_edges)

    # Add job nodes if any
    job_nodes, job_edges = build_job_nodes_and_edges
    nodes.concat(job_nodes)
    edges.concat(job_edges)

    # Add parent case node if this is a child case
    if @case.parent_case.present?
      parent_node, parent_edge = build_parent_case_node_and_edge
      nodes << parent_node
      edges << parent_edge
    end

    # Add child case nodes
    child_nodes, child_edges = build_child_case_nodes_and_edges
    nodes.concat(child_nodes)
    edges.concat(child_edges)

    # Find inter-contact relationships (e.g., director of company)
    inter_edges = find_inter_relationships
    edges.concat(inter_edges)

    {
      nodes: nodes,
      edges: edges,
      case_info: {
        id: @case.id,
        case_number: @case.case_number,
        title: @case.title,
        case_type: @case.case_type,
        is_child_case: @case.child_case?,
        has_children: @case.has_children?,
        parent_case_id: @case.parent_case_id,
        parent_case_number: @case.parent_case&.case_number,
        child_cases_count: @case.child_cases.count
      },
      stats: {
        contacts_count: @case.case_contacts.count,
        companies_count: @case.case_companies.count,
        jobs_count: @case.case_jobs.count,
        child_cases_count: @case.child_cases.count,
        relationship_types: @case.case_contacts.pluck(:relationship_type).compact.uniq
      }
    }
  end

  # Update a node's position
  def update_node_position(node_type, node_id, x:, y:)
    case node_type
    when "contact"
      case_contact = @case.case_contacts.find_by(contact_id: node_id)
      case_contact&.update_chart_position!(x: x, y: y)
    when "company"
      case_company = @case.case_companies.find_by(company_id: node_id)
      case_company&.update!(display_position: { "x" => x, "y" => y }) if case_company
    when "job"
      case_job = @case.case_jobs.find_by(job_id: node_id)
      case_job&.update!(display_position: { "x" => x, "y" => y }) if case_job
    end
  end

  private

  def build_case_node
    {
      id: "case-#{@case.id}",
      type: "case",
      position: { x: 300, y: 300 }, # Center position for 4-quadrant layout
      data: {
        id: @case.id,
        case_number: @case.case_number,
        title: @case.title,
        case_type: @case.case_type,
        formatted_case_type: @case.formatted_case_type,
        status: @case.status,
        priority: @case.priority
      }
    }
  end

  # Group contacts by company - if 2+ contacts share the same company, show them in a company group node
  # Layout: 4 quadrants around the case node
  # - Top Left: CLIENT (the person/company we're working for)
  # - Top Right: ADVISORS (accountant, lawyer, previous_accountant, advisor)
  # - Bottom Left: NEUTRAL (witness, related_party, director, shareholder, bank_manager, insurer, broker)
  # - Bottom Right: OPPOSING (opposing_party, ato_officer, afsa_officer, inspector_general, creditor, debtor, trustee)
  def build_contact_nodes_and_edges_grouped
    nodes = []
    edges = []

    contacts = @case.case_contacts.includes(:contact)

    # Group contacts by company name
    contacts_by_company = contacts.group_by { |cc| cc.contact&.company_name_or_trust.presence }

    # Separate into groups (2+ contacts) and singles
    company_groups = contacts_by_company.select { |company, contacts| company.present? && contacts.size >= 2 }
    single_contacts = contacts_by_company.reject { |company, contacts| company.present? && contacts.size >= 2 }.values.flatten

    # Track companies that are shown as groups (to avoid duplicating in company nodes)
    @grouped_company_names = company_groups.keys

    # Define which relationship types go in which quadrant
    advisor_types = %w[accountant lawyer previous_accountant advisor]
    opposing_types = %w[opposing_party ato_officer afsa_officer inspector_general creditor debtor trustee]
    # client is its own quadrant
    # everything else is neutral

    # Categorize into 4 quadrants
    client_groups = []
    advisor_groups = []
    neutral_groups = []
    opposing_groups = []

    company_groups.each do |company_name, company_contacts|
      rel_types = company_contacts.map { |cc| cc.relationship_type }.compact
      alignments = company_contacts.map { |cc| cc.alignment }.compact
      roles = company_contacts.map { |cc| cc.role }.compact
      group_alignment = alignments.tally.max_by { |_, count| count }&.first || "neutral"

      quadrant = determine_quadrant(rel_types, alignments, roles)
      case quadrant
      when :client
        client_groups << [ company_name, company_contacts, group_alignment ]
      when :advisor
        advisor_groups << [ company_name, company_contacts, group_alignment ]
      when :opposing
        opposing_groups << [ company_name, company_contacts, group_alignment ]
      else
        neutral_groups << [ company_name, company_contacts, group_alignment ]
      end
    end

    client_singles = []
    advisor_singles = []
    neutral_singles = []
    opposing_singles = []

    single_contacts.each do |case_contact|
      rel_type = case_contact.relationship_type
      alignment = case_contact.alignment
      role = case_contact.role

      quadrant = determine_quadrant([ rel_type ].compact, [ alignment ].compact, [ role ].compact)
      case quadrant
      when :client
        client_singles << case_contact
      when :advisor
        advisor_singles << case_contact
      when :opposing
        opposing_singles << case_contact
      else
        neutral_singles << case_contact
      end
    end

    # Position nodes - case is at center (400, 350)
    # Quadrant positions:
    # Top Left (CLIENT):     x = 50-300,  y = 50-250
    # Top Right (ADVISORS):  x = 500-750, y = 50-250
    # Bottom Left (NEUTRAL): x = 50-300,  y = 450-650
    # Bottom Right (OPPOSING): x = 500-750, y = 450-650

    # CLIENT quadrant - Top Left
    client_count = client_groups.count + client_singles.count
    if client_count > 0
      client_y_step = client_count > 1 ? 200 / (client_count - 1) : 0
      client_index = 0

      client_groups.each do |company_name, company_contacts, group_alignment|
        position = { x: 50, y: 50 + (client_y_step * client_index) }
        nodes << build_company_group_node(company_name, company_contacts, position, group_alignment, :client)
        edges << build_company_group_edge(company_name, company_contacts)
        client_index += 1
      end

      client_singles.each do |case_contact|
        contact = case_contact.contact
        next unless contact

        position = { x: 50, y: 50 + (client_y_step * client_index) }
        nodes << build_contact_node(contact, case_contact, position)
        edges << build_contact_edge(contact, case_contact)
        client_index += 1
      end
    end

    # ADVISORS quadrant - Top Right
    advisor_count = advisor_groups.count + advisor_singles.count
    if advisor_count > 0
      advisor_y_step = advisor_count > 1 ? 200 / (advisor_count - 1) : 0
      advisor_index = 0

      advisor_groups.each do |company_name, company_contacts, group_alignment|
        position = { x: 550, y: 50 + (advisor_y_step * advisor_index) }
        nodes << build_company_group_node(company_name, company_contacts, position, group_alignment, :advisor)
        edges << build_company_group_edge(company_name, company_contacts)
        advisor_index += 1
      end

      advisor_singles.each do |case_contact|
        contact = case_contact.contact
        next unless contact

        position = { x: 550, y: 50 + (advisor_y_step * advisor_index) }
        nodes << build_contact_node(contact, case_contact, position)
        edges << build_contact_edge(contact, case_contact)
        advisor_index += 1
      end
    end

    # NEUTRAL quadrant - Bottom Left
    neutral_count = neutral_groups.count + neutral_singles.count
    if neutral_count > 0
      neutral_y_step = neutral_count > 1 ? 200 / (neutral_count - 1) : 0
      neutral_index = 0

      neutral_groups.each do |company_name, company_contacts, group_alignment|
        position = { x: 50, y: 450 + (neutral_y_step * neutral_index) }
        nodes << build_company_group_node(company_name, company_contacts, position, group_alignment, :neutral)
        edges << build_company_group_edge(company_name, company_contacts)
        neutral_index += 1
      end

      neutral_singles.each do |case_contact|
        contact = case_contact.contact
        next unless contact

        position = { x: 50, y: 450 + (neutral_y_step * neutral_index) }
        nodes << build_contact_node(contact, case_contact, position)
        edges << build_contact_edge(contact, case_contact)
        neutral_index += 1
      end
    end

    # OPPOSING quadrant - Bottom Right
    opposing_count = opposing_groups.count + opposing_singles.count
    if opposing_count > 0
      opposing_y_step = opposing_count > 1 ? 200 / (opposing_count - 1) : 0
      opposing_index = 0

      opposing_groups.each do |company_name, company_contacts, group_alignment|
        position = { x: 550, y: 450 + (opposing_y_step * opposing_index) }
        nodes << build_company_group_node(company_name, company_contacts, position, group_alignment, :opposing)
        edges << build_company_group_edge(company_name, company_contacts)
        opposing_index += 1
      end

      opposing_singles.each do |case_contact|
        contact = case_contact.contact
        next unless contact

        position = { x: 550, y: 450 + (opposing_y_step * opposing_index) }
        nodes << build_contact_node(contact, case_contact, position)
        edges << build_contact_edge(contact, case_contact)
        opposing_index += 1
      end
    end

    [ nodes, edges ]
  end

  # Determine which quadrant a contact belongs to based on relationship types, alignments, and roles
  def determine_quadrant(rel_types, alignments, roles = [])
    advisor_types = %w[accountant lawyer previous_accountant advisor]
    opposing_types = %w[opposing_party ato_officer afsa_officer inspector_general creditor debtor trustee]
    advisor_roles = %w[advisor accountant lawyer]

    # Check if it's a client
    return :client if rel_types.include?("client")

    # Check alignment first - if explicitly opposing, put in opposing quadrant
    return :opposing if alignments.include?("opposing")

    # Check alignment - if friendly, put in client quadrant
    return :client if alignments.include?("friendly")

    # Check relationship type
    return :advisor if (rel_types & advisor_types).any?
    return :opposing if (rel_types & opposing_types).any?

    # Check role as fallback
    return :advisor if (roles & advisor_roles).any?

    # Default to neutral
    :neutral
  end

  def build_company_group_node(company_name, company_contacts, position, group_alignment, quadrant = nil)
    employees = company_contacts.map do |case_contact|
      contact = case_contact.contact
      display_name = contact.display_name.presence || [ contact.first_name, contact.last_name ].compact.join(" ").presence || "Contact"
      {
        id: contact.id,
        name: display_name,
        # SSoT: Use helper methods from contact_emails/contact_phones tables
        email: contact.primary_email,
        phone: contact.primary_mobile || contact.primary_office_phone,
        relationship_type: case_contact.relationship_type,
        formatted_relationship_type: case_contact.formatted_relationship_type,
        alignment: case_contact.alignment,
        formatted_alignment: case_contact.formatted_alignment,
        alignment_color: case_contact.alignment_color,
        role: case_contact.role,
        is_primary: case_contact.is_primary
      }
    end

    {
      id: "company-group-#{company_name.parameterize}",
      type: "company_group",
      position: position,
      data: {
        company_name: company_name,
        employees: employees,
        employee_count: employees.count,
        alignment: group_alignment,
        quadrant: quadrant&.to_s,
        relationship_types: company_contacts.map { |cc| cc.formatted_relationship_type }.uniq
      }
    }
  end

  def build_company_group_edge(company_name, company_contacts)
    {
      id: "edge-case-company-group-#{company_name.parameterize}",
      source: "case-#{@case.id}",
      target: "company-group-#{company_name.parameterize}",
      type: "company_group",
      label: company_contacts.map { |cc| cc.formatted_relationship_type }.uniq.join(", "),
      data: {
        relationship_types: company_contacts.map { |cc| cc.relationship_type }.uniq,
        color: "indigo"
      }
    }
  end

  def build_contact_node(contact, case_contact, position)
    display_name = contact.display_name.presence || [ contact.first_name, contact.last_name ].compact.join(" ").presence || "Contact"
    {
      id: "contact-#{contact.id}",
      type: "contact",
      position: position,
      data: {
        id: contact.id,
        contact_id: contact.id,
        name: display_name,
        # SSoT: Use helper methods from contact_emails/contact_phones tables
        email: contact.primary_email,
        phone: contact.primary_mobile || contact.primary_office_phone,
        company: contact.company_name_or_trust,
        relationship_type: case_contact.relationship_type,
        formatted_relationship_type: case_contact.formatted_relationship_type,
        relationship_color: case_contact.relationship_color,
        relationship_icon: case_contact.relationship_icon,
        alignment: case_contact.alignment,
        formatted_alignment: case_contact.formatted_alignment,
        alignment_color: case_contact.alignment_color,
        alignment_icon: case_contact.alignment_icon,
        role: case_contact.role,
        formatted_role: case_contact.formatted_role,
        is_primary: case_contact.is_primary,
        notes: case_contact.notes
      }
    }
  end

  def build_contact_edge(contact, case_contact)
    {
      id: "edge-case-contact-#{contact.id}",
      source: "case-#{@case.id}",
      target: "contact-#{contact.id}",
      type: "relationship",
      animated: case_contact.is_primary,
      label: case_contact.formatted_relationship_type,
      data: {
        relationship_type: case_contact.relationship_type,
        color: case_contact.relationship_color
      }
    }
  end

  def build_contact_nodes_and_edges
    nodes = []
    edges = []

    # Calculate positions in a circle around the case
    contacts = @case.case_contacts.includes(:contact)
    radius = 250
    angle_step = contacts.any? ? (2 * Math::PI / contacts.count) : 0

    contacts.each_with_index do |case_contact, index|
      contact = case_contact.contact
      next unless contact

      # Use saved position or calculate
      position = if case_contact.display_position.present? && case_contact.display_position["x"].present?
        { x: case_contact.display_position["x"], y: case_contact.display_position["y"] }
      else
        angle = angle_step * index - (Math::PI / 2) # Start from top
        {
          x: 400 + (radius * Math.cos(angle)).round,
          y: 300 + (radius * Math.sin(angle)).round
        }
      end

      nodes << {
        id: "contact-#{contact.id}",
        type: "contact",
        position: position,
        data: {
          id: contact.id,
          name: contact.display_name,
          # SSoT: Use helper methods from contact_emails/contact_phones tables
          email: contact.primary_email,
          phone: contact.primary_mobile || contact.primary_office_phone,
          company: contact.company_name_or_trust,
          relationship_type: case_contact.relationship_type,
          formatted_relationship_type: case_contact.formatted_relationship_type,
          relationship_color: case_contact.relationship_color,
          relationship_icon: case_contact.relationship_icon,
          alignment: case_contact.alignment,
          formatted_alignment: case_contact.formatted_alignment,
          alignment_color: case_contact.alignment_color,
          alignment_icon: case_contact.alignment_icon,
          role: case_contact.role,
          formatted_role: case_contact.formatted_role,
          is_primary: case_contact.is_primary,
          notes: case_contact.notes
        }
      }

      # Edge from case to contact
      edges << {
        id: "edge-case-contact-#{contact.id}",
        source: "case-#{@case.id}",
        target: "contact-#{contact.id}",
        type: "relationship",
        animated: case_contact.is_primary,
        label: case_contact.formatted_relationship_type,
        data: {
          relationship_type: case_contact.relationship_type,
          color: case_contact.relationship_color
        }
      }
    end

    [ nodes, edges ]
  end

  def build_company_nodes_and_edges
    nodes = []
    edges = []

    companies = @case.case_companies.includes(:corporate)
    base_y = 50 # Position companies at top

    companies.each_with_index do |case_company, index|
      company = case_company.company
      next unless company

      position = if case_company.respond_to?(:display_position) && case_company.display_position.present?
        { x: case_company.display_position["x"], y: case_company.display_position["y"] }
      else
        { x: 200 + (index * 200), y: base_y }
      end

      nodes << {
        id: "company-#{company.id}",
        type: "company",
        position: position,
        data: {
          id: company.id,
          name: company.name,
          code: company.company_code,
          acn: company.acn,
          abn: company.abn,
          entity_type: company.entity_type,
          role: case_company.role,
          is_primary: case_company.is_primary,
          notes: case_company.notes
        }
      }

      # Edge from case to company
      edges << {
        id: "edge-case-company-#{company.id}",
        source: "case-#{@case.id}",
        target: "company-#{company.id}",
        type: "company",
        label: case_company.role&.titleize || "Related",
        data: {
          role: case_company.role,
          color: company_role_color(case_company.role)
        }
      }
    end

    [ nodes, edges ]
  end

  def build_job_nodes_and_edges
    nodes = []
    edges = []

    jobs = @case.case_jobs.includes(:job)
    base_y = 550 # Position jobs at bottom

    jobs.each_with_index do |case_job, index|
      job = case_job.job
      next unless job

      position = if case_job.respond_to?(:display_position) && case_job.display_position.present?
        { x: case_job.display_position["x"], y: case_job.display_position["y"] }
      else
        { x: 200 + (index * 200), y: base_y }
      end

      nodes << {
        id: "job-#{job.id}",
        type: "job",
        position: position,
        data: {
          id: job.id,
          title: job.title,
          job_number: job.id,
          status: job.job_status&.name,
          relevance: case_job.relevance,
          formatted_relevance: case_job.formatted_relevance,
          notes: case_job.notes
        }
      }

      # Edge from case to job
      edges << {
        id: "edge-case-job-#{job.id}",
        source: "case-#{@case.id}",
        target: "job-#{job.id}",
        type: "job",
        label: case_job.formatted_relevance,
        data: {
          relevance: case_job.relevance,
          color: job_relevance_color(case_job.relevance)
        }
      }
    end

    [ nodes, edges ]
  end

  def find_inter_relationships
    edges = []

    # Find relationships between contacts and companies
    @case.case_contacts.includes(:contact).each do |case_contact|
      contact = case_contact.contact
      next unless contact

      # Check if contact is director/shareholder of any case companies
      @case.case_companies.each do |case_company|
        company = case_company.company
        next unless company

        # Check company members
        member = company.company_members.find_by(contact_id: contact.id)
        if member
          member.roles&.each do |role|
            edges << {
              id: "edge-contact-company-#{contact.id}-#{company.id}-#{role}",
              source: "contact-#{contact.id}",
              target: "company-#{company.id}",
              type: "inter_relationship",
              label: role.titleize,
              style: { strokeDasharray: "5,5" }, # Dashed line
              data: {
                role: role,
                color: "gray"
              }
            }
          end
        end

        # Check shareholdings
        shareholding = company.corporate_shareholdings.find_by(shareholder_type: "Contact", shareholder_id: contact.id)
        if shareholding && shareholding.percentage_of_total.to_f > 0
          edges << {
            id: "edge-contact-company-shareholding-#{contact.id}-#{company.id}",
            source: "contact-#{contact.id}",
            target: "company-#{company.id}",
            type: "inter_relationship",
            label: "#{shareholding.percentage_of_total}% Owner",
            style: { strokeDasharray: "5,5" },
            data: {
              type: "shareholding",
              percentage: shareholding.percentage_of_total,
              color: "amber"
            }
          }
        end
      end

      # Check if contact is linked to any case jobs
      @case.case_jobs.each do |case_job|
        job = case_job.job
        next unless job

        job_contact = job.job_contacts.find_by(contact_id: contact.id)
        if job_contact
          edges << {
            id: "edge-contact-job-#{contact.id}-#{job.id}",
            source: "contact-#{contact.id}",
            target: "job-#{job.id}",
            type: "inter_relationship",
            label: job_contact.role.titleize,
            style: { strokeDasharray: "5,5" },
            data: {
              role: job_contact.role,
              color: "blue"
            }
          }
        end
      end
    end

    edges
  end

  def company_role_color(role)
    case role
    when "subject" then "red"
    when "related_entity" then "blue"
    when "counterparty" then "orange"
    else "gray"
    end
  end

  def job_relevance_color(relevance)
    case relevance
    when "direct" then "green"
    when "indirect" then "blue"
    when "reference" then "gray"
    else "gray"
    end
  end

  def build_parent_case_node_and_edge
    parent = @case.parent_case
    return [ nil, nil ] unless parent

    node = {
      id: "case-#{parent.id}",
      type: "parent_case",
      position: { x: 300, y: -100 }, # Above the main case (centered, with space)
      data: {
        id: parent.id,
        case_number: parent.case_number,
        title: parent.title,
        case_type: parent.case_type,
        formatted_case_type: parent.formatted_case_type,
        status: parent.status,
        formatted_status: parent.formatted_status,
        priority: parent.priority,
        child_cases_count: parent.child_cases.count,
        open_child_cases_count: parent.open_child_cases_count
      }
    }

    edge = {
      id: "edge-parent-case-#{parent.id}",
      source: "case-#{parent.id}",
      target: "case-#{@case.id}",
      type: "hierarchy",
      label: "Parent Case",
      animated: true,
      style: { strokeWidth: 3 },
      data: {
        type: "parent_child",
        color: "slate"
      }
    }

    [ node, edge ]
  end

  def build_child_case_nodes_and_edges
    nodes = []
    edges = []

    children = @case.child_cases.includes(:assigned_to)
    return [ nodes, edges ] if children.empty?

    # Position children below the main case (case center is at x=300)
    base_y = 550
    spacing = 200
    start_x = 300 - ((children.count - 1) * spacing / 2.0)

    children.each_with_index do |child, index|
      position = { x: (start_x + (index * spacing)).round, y: base_y }

      nodes << {
        id: "case-#{child.id}",
        type: "child_case",
        position: position,
        data: {
          id: child.id,
          case_number: child.case_number,
          title: child.title,
          case_type: child.case_type,
          formatted_case_type: child.formatted_case_type,
          status: child.status,
          formatted_status: child.formatted_status,
          priority: child.priority,
          formatted_priority: child.formatted_priority,
          overdue: child.overdue?,
          deadline: child.deadline,
          assigned_to: child.assigned_to&.name,
          has_children: child.has_children?,
          child_cases_count: child.child_cases.count
        }
      }

      edges << {
        id: "edge-child-case-#{child.id}",
        source: "case-#{@case.id}",
        target: "case-#{child.id}",
        type: "hierarchy",
        label: child.formatted_status,
        labelStyle: {
          fill: status_color(child.status),
          fontWeight: 500,
          fontSize: 10
        },
        data: {
          type: "parent_child",
          status: child.status,
          color: status_color(child.status)
        }
      }
    end

    [ nodes, edges ]
  end

  def status_color(status)
    case status
    when "open" then "#3b82f6" # blue
    when "in_progress" then "#f59e0b" # amber
    when "review" then "#a855f7" # purple
    when "closed" then "#22c55e" # green
    when "archived" then "#6b7280" # gray
    else "#6b7280"
    end
  end
end
