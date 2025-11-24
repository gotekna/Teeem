#!/usr/bin/env ruby
# Quick workflow test script
# Run with: cd backend && rails runner test_workflow.rb

puts "\n" + "="*60
puts "WORKFLOW ENGINE TEST"
puts "="*60 + "\n"

# 1. Check workflow definitions exist
puts "1. Checking workflow definitions..."
workflow_count = WorkflowDefinition.count
puts "   ✓ Found #{workflow_count} workflow definitions"

WorkflowDefinition.all.each do |wf|
  puts "   - #{wf.name} (#{wf.workflow_type})"
end

# 2. Create a test Purchase Order if one doesn't exist
puts "\n2. Finding or creating test Purchase Order..."
po = PurchaseOrder.first

if po.nil?
  puts "   ✗ No purchase orders found. Creating a test PO..."

  construction = Construction.first
  if construction.nil?
    puts "   ✗ No constructions found. Please create a construction/job first."
    exit
  end

  po = PurchaseOrder.create!(
    construction: construction,
    purchase_order_number: "TEST-#{Time.now.to_i}",
    description: "Test PO for workflow engine",
    status: 'pending',
    total: 15000.00, # Above threshold to trigger multiple approval steps
    tax: 1500.00,
    subtotal: 13500.00
  )
  puts "   ✓ Created test PO: #{po.purchase_order_number}"
else
  puts "   ✓ Found PO: #{po.purchase_order_number} (Total: $#{po.total})"
end

# 3. Start a workflow
puts "\n3. Starting Purchase Order Approval workflow..."

if po.has_active_workflow?
  puts "   ⚠ PO already has an active workflow"
  workflow_instance = po.active_workflow
else
  user = User.first
  if user.nil?
    puts "   ✗ No users found. Please create a user first."
    exit
  end

  workflow_instance = WorkflowExecutionService.start_workflow(
    workflow_type: 'purchase_order_approval',
    subject: po,
    initiated_by: user
  )
  puts "   ✓ Workflow started!"
end

# 4. Show workflow status
puts "\n4. Workflow Status:"
puts "   Status: #{workflow_instance.status}"
puts "   Current Step: #{workflow_instance.current_step}"
puts "   Started: #{workflow_instance.started_at}"

# 5. Show all steps
puts "\n5. Workflow Steps:"
workflow_instance.workflow_steps.each do |step|
  status_icon = case step.status
                when 'completed' then '✓'
                when 'pending' then '○'
                when 'in_progress' then '⟳'
                when 'rejected' then '✗'
                else '?'
                end

  puts "   #{status_icon} #{step.step_name} - #{step.status}"
  if step.data && step.data['description']
    puts "      #{step.data['description']}"
  end
end

# 6. Show pending approvals
puts "\n6. Finding users who can approve..."
current_step = workflow_instance.workflow_steps.find_by(status: ['pending', 'in_progress'])

if current_step
  puts "   Current step: #{current_step.step_name}"
  puts "   Assigned to: #{current_step.data['assignee_type']} = #{current_step.data['assignee_value']}"

  # Find users with the required role
  required_role = current_step.data['assignee_value']
  eligible_users = User.where(role: required_role)

  puts "\n   Eligible approvers (#{required_role}):"
  eligible_users.each do |user|
    puts "   - #{user.name} (#{user.email})"
  end

  # Show how to approve
  puts "\n   To approve this step, run:"
  puts "   " + "-"*50
  puts "   User.where(role: '#{required_role}').first"
  puts "   current_step = WorkflowStep.find(#{current_step.id})"
  puts "   current_step.approve!(user: user, comment: 'Approved')"
  puts "   " + "-"*50
end

puts "\n" + "="*60
puts "TEST COMPLETE"
puts "="*60

puts "\n📝 Next Steps:"
puts "1. Add WorkflowsPage to your frontend routing"
puts "2. Test the approval UI at /workflows"
puts "3. Check API endpoints work with curl or Postman"
puts "\n💡 API Endpoints:"
puts "   GET  /api/v1/workflow_steps           - My pending approvals"
puts "   POST /api/v1/workflow_steps/:id/approve"
puts "   POST /api/v1/workflow_steps/:id/reject"
puts "   GET  /api/v1/workflow_definitions     - All workflow types"
puts "\n"
