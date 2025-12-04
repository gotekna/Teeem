# Workflow Engine Documentation

## Overview

The TEEEM workflow engine is a flexible, polymorphic approval system that can be attached to any entity in your system - Purchase Orders, Quotes, Contracts, Jobs, Estimates, Invoices, and more.

## Key Features

- **Polymorphic** - Works with any model (PurchaseOrder, Quote, Contract, etc.)
- **Role-based assignment** - Steps can be assigned to specific users or roles
- **Conditional steps** - Steps can be triggered based on thresholds (e.g., amount > $10,000)
- **State machine** - Workflows automatically advance through steps
- **Full audit trail** - All approvals, rejections, and comments are tracked
- **Multi-action support** - Approve, Reject, or Request Changes

## Pre-configured Workflows

The system comes with 8 pre-configured workflows:

1. **Purchase Order Approval** - Multi-tier approval based on PO amount
2. **Quote Approval** - Review and approve quotes before sending to clients
3. **Contract Approval** - Legal, financial review and signature authorization
4. **Job Approval** - Approve new construction jobs
5. **Estimate Review** - Verify estimates before converting to quotes
6. **Document Approval** - Generic document review process
7. **Change Order Approval** - Approve scope and budget changes
8. **Invoice Approval** - Verify work and authorize payment

## Database Schema

### WorkflowDefinition
Defines reusable workflow templates.

```ruby
WorkflowDefinition
  - name: string
  - description: text
  - workflow_type: string
  - config: jsonb (contains steps and settings)
  - active: boolean
```

### WorkflowInstance
Represents a running workflow attached to a subject.

```ruby
WorkflowInstance
  - workflow_definition_id: integer
  - subject_type: string (polymorphic)
  - subject_id: integer (polymorphic)
  - status: string (pending, in_progress, completed, rejected, cancelled)
  - current_step: string
  - started_at: datetime
  - completed_at: datetime
  - metadata: jsonb
```

### WorkflowStep
Individual steps in a workflow.

```ruby
WorkflowStep
  - workflow_instance_id: integer
  - step_name: string
  - status: string (pending, in_progress, completed, rejected, skipped)
  - assigned_to_type: string (polymorphic)
  - assigned_to_id: integer (polymorphic)
  - started_at: datetime
  - completed_at: datetime
  - data: jsonb
  - comment: text
```

## How to Start a Workflow

### For Purchase Orders

```ruby
# In your PurchaseOrder model or controller
po = PurchaseOrder.find(params[:id])

# Start the workflow
workflow_instance = WorkflowExecutionService.start_workflow(
  workflow_type: 'purchase_order_approval',
  subject: po,
  initiated_by: current_user
)
```

### For Quotes

```ruby
quote = Quote.find(params[:id])

workflow_instance = WorkflowExecutionService.start_workflow(
  workflow_type: 'quote_approval',
  subject: quote,
  initiated_by: current_user
)
```

### For Contracts

```ruby
contract = Contract.find(params[:id])

workflow_instance = WorkflowExecutionService.start_workflow(
  workflow_type: 'contract_approval',
  subject: contract,
  initiated_by: current_user
)
```

### For Any Custom Entity

```ruby
# First, add the workflow association to your model
class MyCustomDocument < ApplicationRecord
  has_many :workflow_instances, as: :subject, dependent: :destroy

  def active_workflow
    workflow_instances.find_by(status: ['pending', 'in_progress'])
  end

  def has_active_workflow?
    active_workflow.present?
  end
end

# Then start the workflow
document = MyCustomDocument.find(params[:id])

workflow_instance = WorkflowExecutionService.start_workflow(
  workflow_type: 'document_approval',
  subject: document,
  initiated_by: current_user
)
```

## API Endpoints

### Get Pending Approvals
```
GET /api/v1/workflow_steps
```
Returns all workflow steps pending for the current user.

### Approve a Step
```
POST /api/v1/workflow_steps/:id/approve
{
  "comment": "Approved - pricing looks good"
}
```

### Reject a Step
```
POST /api/v1/workflow_steps/:id/reject
{
  "comment": "Pricing is too high, please revise"
}
```

### Request Changes
```
POST /api/v1/workflow_steps/:id/request_changes
{
  "comment": "Please update the delivery date"
}
```

### Manage Workflow Definitions
```
GET /api/v1/workflow_definitions
POST /api/v1/workflow_definitions
PATCH /api/v1/workflow_definitions/:id
DELETE /api/v1/workflow_definitions/:id
```

## UI Components

### WorkflowApprovalPanel
Use this component to display workflow status and allow approvals inline.

```jsx
import WorkflowApprovalPanel from '../components/workflows/WorkflowApprovalPanel'

<WorkflowApprovalPanel
  workflowInstance={purchaseOrder.active_workflow}
  currentStep={purchaseOrder.current_workflow_step}
  onActionComplete={() => refreshData()}
/>
```

### WorkflowTaskList
Display all pending approvals for the current user.

```jsx
import WorkflowTaskList from '../components/workflows/WorkflowTaskList'

<WorkflowTaskList />
```

### WorkflowsPage
Full page view for managing all workflows.

```jsx
// Add to your routing
import WorkflowsPage from './pages/WorkflowsPage'

<Route path="/workflows" element={<WorkflowsPage />} />
```

## Creating Custom Workflows

You can create new workflow types by adding them to the seed file or via API:

```ruby
WorkflowDefinition.create!(
  name: 'My Custom Approval',
  workflow_type: 'custom_approval',
  description: 'Custom approval workflow for special documents',
  active: true,
  config: {
    steps: [
      {
        name: 'initial_review',
        label: 'Initial Review',
        description: 'First pass review',
        assignee_type: 'role',
        assignee_value: 'supervisor'
      },
      {
        name: 'final_approval',
        label: 'Final Approval',
        description: 'Final sign-off',
        assignee_type: 'role',
        assignee_value: 'admin',
        conditions: {
          amount_threshold: 5000 # Only required if amount > $5000
        }
      }
    ],
    notifications: {
      on_approval: true,
      on_rejection: true,
      on_completion: true
    }
  }
)
```

## Role-Based Assignment

Steps can be assigned to:

1. **Specific roles** (recommended)
   ```ruby
   {
     assignee_type: 'role',
     assignee_value: 'supervisor'
   }
   ```

2. **Specific users**
   ```ruby
   {
     assignee_type: 'user',
     assignee_value: user_id
   }
   ```

3. **Dynamic assignment** (leave blank for manual assignment)
   ```ruby
   {
     assignee_type: nil,
     assignee_value: nil
   }
   ```

## Available Roles

- `user` - Basic user
- `admin` - Administrator
- `product_owner` - Product owner / manager
- `estimator` - Cost estimator
- `supervisor` - Site supervisor
- `builder` - Builder / contractor

## Conditional Steps

Steps can be conditionally required based on thresholds:

```ruby
{
  name: 'admin_approval',
  label: 'Admin Approval',
  assignee_type: 'role',
  assignee_value: 'admin',
  conditions: {
    amount_threshold: 25000 # Only required if total > $25,000
  }
}
```

The workflow engine will automatically skip steps that don't meet their conditions.

## Notifications

The workflow config supports notification settings:

```ruby
notifications: {
  on_approval: true,      # Notify when step is approved
  on_rejection: true,     # Notify when step is rejected
  on_completion: true,    # Notify when workflow completes
  on_send: true,          # Notify when document is sent
  on_signature: true,     # Notify when document is signed
  on_payment: true        # Notify when payment is made
}
```

## Best Practices

1. **Always check for active workflow** before starting a new one
   ```ruby
   unless subject.has_active_workflow?
     WorkflowExecutionService.start_workflow(...)
   end
   ```

2. **Use callbacks for automatic workflow initiation**
   ```ruby
   class PurchaseOrder < ApplicationRecord
     after_create :start_approval_workflow, if: :requires_approval?

     def requires_approval?
       status == 'pending' && total > 1000
     end

     def start_approval_workflow
       WorkflowExecutionService.start_workflow(
         workflow_type: 'purchase_order_approval',
         subject: self,
         initiated_by: created_by
       )
     end
   end
   ```

3. **Display workflow status in UI**
   ```jsx
   {purchaseOrder.has_active_workflow && (
     <span className="badge badge-yellow">
       Pending {purchaseOrder.current_workflow_step?.step_name}
     </span>
   )}
   ```

4. **Prevent edits during workflow**
   ```ruby
   def can_edit?
     !has_active_workflow? || status == 'draft'
   end
   ```

## Troubleshooting

### Workflow not advancing
- Check that the step has been properly approved
- Verify the next step exists in the workflow definition
- Check console/logs for errors in `WorkflowInstance#advance!`

### User cannot see their pending tasks
- Verify user role matches the step's `assignee_value`
- Check that the step status is 'pending' or 'in_progress'
- Ensure user is authenticated

### Workflow stuck in 'in_progress'
- Check if the current step has been approved/rejected
- Verify the workflow has remaining steps
- May need to manually complete or cancel

## Running the Workflow Seeds

To create/update all workflow definitions:

```bash
cd backend
bin/rake workflows:seed
```

This will create or update all 8 pre-configured workflows.
