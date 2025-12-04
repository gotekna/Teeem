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

    # Add contact nodes
    contact_nodes, contact_edges = build_contact_nodes_and_edges
    nodes.concat(contact_nodes)
    edges.concat(contact_edges)

    # Add company nodes
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
    when 'contact'
      case_contact = @case.case_contacts.find_by(contact_id: node_id)
      case_contact&.update_chart_position!(x: x, y: y)
    when 'company'
      case_company = @case.case_companies.find_by(company_id: node_id)
      case_company&.update!(display_position: { 'x' => x, 'y' => y }) if case_company
    when 'job'
      case_job = @case.case_jobs.find_by(job_id: node_id)
      case_job&.update!(display_position: { 'x' => x, 'y' => y }) if case_job
    end
  end

  private

  def build_case_node
    {
      id: "case-#{@case.id}",
      type: 'case',
      position: { x: 400, y: 300 }, # Center position
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
      position = if case_contact.display_position.present? && case_contact.display_position['x'].present?
        { x: case_contact.display_position['x'], y: case_contact.display_position['y'] }
      else
        angle = angle_step * index - (Math::PI / 2) # Start from top
        {
          x: 400 + (radius * Math.cos(angle)).round,
          y: 300 + (radius * Math.sin(angle)).round
        }
      end

      nodes << {
        id: "contact-#{contact.id}",
        type: 'contact',
        position: position,
        data: {
          id: contact.id,
          name: contact.full_name,
          email: contact.email,
          phone: contact.mobile_phone || contact.work_phone,
          company: contact.company_name_or_trust,
          relationship_type: case_contact.relationship_type,
          formatted_relationship_type: case_contact.formatted_relationship_type,
          relationship_color: case_contact.relationship_color,
          relationship_icon: case_contact.relationship_icon,
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
        type: 'relationship',
        animated: case_contact.is_primary,
        label: case_contact.formatted_relationship_type,
        data: {
          relationship_type: case_contact.relationship_type,
          color: case_contact.relationship_color
        }
      }
    end

    [nodes, edges]
  end

  def build_company_nodes_and_edges
    nodes = []
    edges = []

    companies = @case.case_companies.includes(:company)
    base_y = 50 # Position companies at top

    companies.each_with_index do |case_company, index|
      company = case_company.company
      next unless company

      position = if case_company.respond_to?(:display_position) && case_company.display_position.present?
        { x: case_company.display_position['x'], y: case_company.display_position['y'] }
      else
        { x: 200 + (index * 200), y: base_y }
      end

      nodes << {
        id: "company-#{company.id}",
        type: 'company',
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
        type: 'company',
        label: case_company.role&.titleize || 'Related',
        data: {
          role: case_company.role,
          color: company_role_color(case_company.role)
        }
      }
    end

    [nodes, edges]
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
        { x: case_job.display_position['x'], y: case_job.display_position['y'] }
      else
        { x: 200 + (index * 200), y: base_y }
      end

      nodes << {
        id: "job-#{job.id}",
        type: 'job',
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
        type: 'job',
        label: case_job.formatted_relevance,
        data: {
          relevance: case_job.relevance,
          color: job_relevance_color(case_job.relevance)
        }
      }
    end

    [nodes, edges]
  end

  def find_inter_relationships
    edges = []

    # Find relationships between contacts and companies
    @case.case_contacts.includes(contact: :company_members).each do |case_contact|
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
              type: 'inter_relationship',
              label: role.titleize,
              style: { strokeDasharray: '5,5' }, # Dashed line
              data: {
                role: role,
                color: 'gray'
              }
            }
          end
        end

        # Check shareholdings
        shareholding = company.company_shareholdings.find_by(shareholder_type: 'Contact', shareholder_id: contact.id)
        if shareholding && shareholding.percentage_of_total.to_f > 0
          edges << {
            id: "edge-contact-company-shareholding-#{contact.id}-#{company.id}",
            source: "contact-#{contact.id}",
            target: "company-#{company.id}",
            type: 'inter_relationship',
            label: "#{shareholding.percentage_of_total}% Owner",
            style: { strokeDasharray: '5,5' },
            data: {
              type: 'shareholding',
              percentage: shareholding.percentage_of_total,
              color: 'amber'
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
            type: 'inter_relationship',
            label: job_contact.role.titleize,
            style: { strokeDasharray: '5,5' },
            data: {
              role: job_contact.role,
              color: 'blue'
            }
          }
        end
      end
    end

    edges
  end

  def company_role_color(role)
    case role
    when 'subject' then 'red'
    when 'related_entity' then 'blue'
    when 'counterparty' then 'orange'
    else 'gray'
    end
  end

  def job_relevance_color(relevance)
    case relevance
    when 'direct' then 'green'
    when 'indirect' then 'blue'
    when 'reference' then 'gray'
    else 'gray'
    end
  end

  def build_parent_case_node_and_edge
    parent = @case.parent_case
    return [nil, nil] unless parent

    node = {
      id: "case-#{parent.id}",
      type: 'parent_case',
      position: { x: 400, y: 50 }, # Above the main case
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
      type: 'hierarchy',
      label: 'Parent Case',
      animated: true,
      style: { strokeWidth: 3 },
      data: {
        type: 'parent_child',
        color: 'slate'
      }
    }

    [node, edge]
  end

  def build_child_case_nodes_and_edges
    nodes = []
    edges = []

    children = @case.child_cases.includes(:assigned_to)
    return [nodes, edges] if children.empty?

    # Position children below the main case
    base_y = 550
    spacing = 200
    start_x = 400 - ((children.count - 1) * spacing / 2.0)

    children.each_with_index do |child, index|
      position = { x: (start_x + (index * spacing)).round, y: base_y }

      nodes << {
        id: "case-#{child.id}",
        type: 'child_case',
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
        type: 'hierarchy',
        label: child.formatted_status,
        labelStyle: {
          fill: status_color(child.status),
          fontWeight: 500,
          fontSize: 10
        },
        data: {
          type: 'parent_child',
          status: child.status,
          color: status_color(child.status)
        }
      }
    end

    [nodes, edges]
  end

  def status_color(status)
    case status
    when 'open' then '#3b82f6' # blue
    when 'in_progress' then '#f59e0b' # amber
    when 'review' then '#a855f7' # purple
    when 'closed' then '#22c55e' # green
    when 'archived' then '#6b7280' # gray
    else '#6b7280'
    end
  end
end
