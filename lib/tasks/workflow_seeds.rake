namespace :workflows do
  desc "Create initial workflow definitions for the system"
  task seed: :environment do
    puts "Creating workflow definitions..."

    # Purchase Order Approval Workflow
    po_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "purchase_order_approval") do |wf|
      wf.name = "Purchase Order Approval"
      wf.description = "Multi-step approval process for purchase orders based on amount thresholds"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "supervisor_review",
            label: "Supervisor Review",
            description: "Initial review by construction supervisor",
            assignee_type: "role",
            assignee_value: "supervisor",
            conditions: {
              amount_threshold: 0 # Always required
            }
          },
          {
            name: "estimator_review",
            label: "Estimator Review",
            description: "Cost verification by project estimator",
            assignee_type: "role",
            assignee_value: "estimator",
            conditions: {
              amount_threshold: 5000 # Required for POs > $5,000
            }
          },
          {
            name: "product_owner_approval",
            label: "Product Owner Approval",
            description: "Final approval by product owner",
            assignee_type: "role",
            assignee_value: "product_owner",
            conditions: {
              amount_threshold: 10000 # Required for POs > $10,000
            }
          },
          {
            name: "admin_approval",
            label: "Admin Final Approval",
            description: "Administrative approval for high-value purchases",
            assignee_type: "role",
            assignee_value: "admin",
            conditions: {
              amount_threshold: 25000 # Required for POs > $25,000
            }
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true
        }
      }
    end

    puts "✓ Created: #{po_approval.name}"

    # Job Approval Workflow
    job_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "job_approval") do |wf|
      wf.name = "Job Approval Workflow"
      wf.description = "Approval workflow for starting new construction jobs"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "estimator_review",
            label: "Estimator Review",
            description: "Review job estimate and pricing",
            assignee_type: "role",
            assignee_value: "estimator"
          },
          {
            name: "supervisor_assignment",
            label: "Supervisor Assignment",
            description: "Assign site supervisor to job",
            assignee_type: "role",
            assignee_value: "admin"
          },
          {
            name: "product_owner_approval",
            label: "Final Approval",
            description: "Final approval to proceed with job",
            assignee_type: "role",
            assignee_value: "product_owner"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true
        }
      }
    end

    puts "✓ Created: #{job_approval.name}"

    # Estimate Review Workflow
    estimate_review = WorkflowDefinition.find_or_create_by!(workflow_type: "estimate_review") do |wf|
      wf.name = "Estimate Review Workflow"
      wf.description = "Review and approve construction estimates"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "estimator_verification",
            label: "Estimator Verification",
            description: "Verify estimate calculations and pricing",
            assignee_type: "role",
            assignee_value: "estimator"
          },
          {
            name: "supervisor_review",
            label: "Supervisor Review",
            description: "Review for practical feasibility",
            assignee_type: "role",
            assignee_value: "supervisor"
          },
          {
            name: "product_owner_approval",
            label: "Client Approval",
            description: "Present estimate to client",
            assignee_type: "role",
            assignee_value: "product_owner"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true
        }
      }
    end

    puts "✓ Created: #{estimate_review.name}"

    # Quote Approval Workflow
    quote_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "quote_approval") do |wf|
      wf.name = "Quote Approval Workflow"
      wf.description = "Review and approve quotes before sending to clients"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "estimator_review",
            label: "Estimator Review",
            description: "Verify pricing and calculations",
            assignee_type: "role",
            assignee_value: "estimator"
          },
          {
            name: "supervisor_technical_review",
            label: "Technical Review",
            description: "Review scope and feasibility",
            assignee_type: "role",
            assignee_value: "supervisor"
          },
          {
            name: "product_owner_approval",
            label: "Final Approval",
            description: "Approve quote for client delivery",
            assignee_type: "role",
            assignee_value: "product_owner"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true,
          on_send: true
        }
      }
    end

    puts "✓ Created: #{quote_approval.name}"

    # Contract Approval Workflow
    contract_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "contract_approval") do |wf|
      wf.name = "Contract Approval Workflow"
      wf.description = "Review and approve contracts before signing"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "legal_review",
            label: "Legal Review",
            description: "Review contract terms and conditions",
            assignee_type: "role",
            assignee_value: "admin"
          },
          {
            name: "financial_review",
            label: "Financial Review",
            description: "Review payment terms and budget",
            assignee_type: "role",
            assignee_value: "estimator"
          },
          {
            name: "product_owner_signature",
            label: "Signature Approval",
            description: "Final approval and signature authorization",
            assignee_type: "role",
            assignee_value: "product_owner"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true,
          on_signature: true
        }
      }
    end

    puts "✓ Created: #{contract_approval.name}"

    # Document Approval Workflow (Generic)
    document_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "document_approval") do |wf|
      wf.name = "Document Approval Workflow"
      wf.description = "General document review and approval process"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "supervisor_review",
            label: "Supervisor Review",
            description: "Initial document review",
            assignee_type: "role",
            assignee_value: "supervisor"
          },
          {
            name: "admin_approval",
            label: "Admin Approval",
            description: "Administrative approval",
            assignee_type: "role",
            assignee_value: "admin"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true
        }
      }
    end

    puts "✓ Created: #{document_approval.name}"

    # Change Order Approval Workflow
    change_order_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "change_order_approval") do |wf|
      wf.name = "Change Order Approval"
      wf.description = "Approve changes to project scope and budget"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "supervisor_assessment",
            label: "Supervisor Assessment",
            description: "Assess impact of proposed changes",
            assignee_type: "role",
            assignee_value: "supervisor"
          },
          {
            name: "estimator_pricing",
            label: "Cost Estimation",
            description: "Calculate cost impact of changes",
            assignee_type: "role",
            assignee_value: "estimator"
          },
          {
            name: "client_approval",
            label: "Client Approval",
            description: "Present change order to client",
            assignee_type: "role",
            assignee_value: "product_owner"
          },
          {
            name: "admin_authorization",
            label: "Admin Authorization",
            description: "Authorize implementation of changes",
            assignee_type: "role",
            assignee_value: "admin",
            conditions: {
              amount_threshold: 5000 # Required for change orders > $5,000
            }
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true
        }
      }
    end

    puts "✓ Created: #{change_order_approval.name}"

    # Invoice Approval Workflow
    invoice_approval = WorkflowDefinition.find_or_create_by!(workflow_type: "invoice_approval") do |wf|
      wf.name = "Invoice Approval Workflow"
      wf.description = "Review and approve invoices before payment"
      wf.active = true
      wf.config = {
        steps: [
          {
            name: "supervisor_verification",
            label: "Supervisor Verification",
            description: "Verify work completion and quality",
            assignee_type: "role",
            assignee_value: "supervisor"
          },
          {
            name: "admin_payment_approval",
            label: "Payment Approval",
            description: "Authorize invoice payment",
            assignee_type: "role",
            assignee_value: "admin"
          }
        ],
        notifications: {
          on_approval: true,
          on_rejection: true,
          on_completion: true,
          on_payment: true
        }
      }
    end

    puts "✓ Created: #{invoice_approval.name}"

    puts "\n" + "="*60
    puts "Workflow definitions created successfully!"
    puts "Total workflows: #{WorkflowDefinition.count}"
    puts "="*60
  end
end
