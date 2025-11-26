# ===================================================================
# TEEEM PERMISSIONS SEED DATA
# ===================================================================
# This file defines all available permissions in the system
# Permissions are organized by category for easy management
#
# To load: rails db:seed or rails runner db/seeds/permissions.rb
# ===================================================================

puts "🔐 Seeding Permissions..."

permissions_data = [
  # ===================================================================
  # PROJECT MANAGEMENT
  # ===================================================================
  { name: 'view_projects', description: 'View project list and details', category: 'projects' },
  { name: 'create_projects', description: 'Create new projects', category: 'projects' },
  { name: 'edit_projects', description: 'Edit existing projects', category: 'projects' },
  { name: 'delete_projects', description: 'Delete projects', category: 'projects' },
  { name: 'archive_projects', description: 'Archive/unarchive projects', category: 'projects' },

  # ===================================================================
  # GANTT CHART & SCHEDULING
  # ===================================================================
  { name: 'view_gantt', description: 'View Gantt chart and schedules', category: 'gantt' },
  { name: 'edit_gantt', description: 'Edit Gantt chart and task schedules', category: 'gantt' },
  { name: 'create_templates', description: 'Create schedule templates', category: 'gantt' },
  { name: 'edit_templates', description: 'Edit schedule templates', category: 'gantt' },
  { name: 'delete_templates', description: 'Delete schedule templates', category: 'gantt' },
  { name: 'manage_dependencies', description: 'Manage task dependencies', category: 'gantt' },

  # ===================================================================
  # USER MANAGEMENT
  # ===================================================================
  { name: 'view_users', description: 'View user list', category: 'users' },
  { name: 'create_users', description: 'Add new users', category: 'users' },
  { name: 'edit_users', description: 'Edit user details', category: 'users' },
  { name: 'delete_users', description: 'Remove users', category: 'users' },
  { name: 'manage_roles', description: 'Assign and change user roles', category: 'users' },
  { name: 'manage_permissions', description: 'Manage user permissions', category: 'users' },

  # ===================================================================
  # REPORTS & ANALYTICS
  # ===================================================================
  { name: 'view_reports', description: 'View reports and analytics', category: 'reports' },
  { name: 'export_reports', description: 'Export reports to PDF/Excel', category: 'reports' },
  { name: 'view_project_analytics', description: 'View project performance analytics', category: 'reports' },
  { name: 'view_team_analytics', description: 'View team performance analytics', category: 'reports' },

  # ===================================================================
  # FINANCIAL MANAGEMENT
  # ===================================================================
  { name: 'view_financials', description: 'View financial data and budgets', category: 'financials' },
  { name: 'edit_budgets', description: 'Edit project budgets', category: 'financials' },
  { name: 'view_invoices', description: 'View invoices', category: 'financials' },
  { name: 'create_invoices', description: 'Create new invoices', category: 'financials' },
  { name: 'approve_invoices', description: 'Approve invoices for payment', category: 'financials' },
  { name: 'view_payments', description: 'View payment history', category: 'financials' },
  { name: 'process_payments', description: 'Process payments', category: 'financials' },

  # ===================================================================
  # INVENTORY & SUPPLIES
  # ===================================================================
  { name: 'view_inventory', description: 'View inventory and supplies', category: 'inventory' },
  { name: 'edit_inventory', description: 'Edit inventory items', category: 'inventory' },
  { name: 'create_purchase_orders', description: 'Create purchase orders', category: 'inventory' },
  { name: 'approve_purchase_orders', description: 'Approve purchase orders', category: 'inventory' },
  { name: 'manage_suppliers', description: 'Manage supplier information', category: 'inventory' },

  # ===================================================================
  # DOCUMENT MANAGEMENT
  # ===================================================================
  { name: 'view_documents', description: 'View project documents', category: 'documents' },
  { name: 'upload_documents', description: 'Upload new documents', category: 'documents' },
  { name: 'edit_documents', description: 'Edit document details', category: 'documents' },
  { name: 'delete_documents', description: 'Delete documents', category: 'documents' },
  { name: 'manage_document_folders', description: 'Manage document folder structure', category: 'documents' },

  # ===================================================================
  # SYSTEM SETTINGS
  # ===================================================================
  { name: 'view_settings', description: 'View system settings', category: 'settings' },
  { name: 'edit_settings', description: 'Edit system settings', category: 'settings' },
  { name: 'manage_integrations', description: 'Manage third-party integrations', category: 'settings' },
  { name: 'view_audit_logs', description: 'View system audit logs', category: 'settings' },
  { name: 'manage_system', description: 'Full system administration access', category: 'settings' }
]

# Create permissions
permissions_data.each do |perm_data|
  permission = Permission.find_or_initialize_by(name: perm_data[:name])
  permission.update!(
    description: perm_data[:description],
    category: perm_data[:category],
    enabled: true
  )
  puts "  ✓ #{perm_data[:name]}"
end

puts "\n🎭 Setting up default role permissions..."

# ===================================================================
# DEFAULT ROLE PERMISSIONS
# ===================================================================

role_permissions = {
  # ADMIN - Full access to everything
  'admin' => Permission.pluck(:name),

  # PRODUCT OWNER - Project planning and management
  'product_owner' => [
    'view_projects', 'create_projects', 'edit_projects', 'archive_projects',
    'view_gantt', 'edit_gantt', 'create_templates', 'edit_templates', 'manage_dependencies',
    'view_users',
    'view_reports', 'export_reports', 'view_project_analytics',
    'view_financials', 'edit_budgets', 'view_invoices',
    'view_inventory', 'edit_inventory', 'create_purchase_orders',
    'view_documents', 'upload_documents', 'edit_documents', 'manage_document_folders',
    'view_settings'
  ],

  # ESTIMATOR - Scheduling and budgeting
  'estimator' => [
    'view_projects', 'edit_projects',
    'view_gantt', 'edit_gantt', 'create_templates', 'edit_templates',
    'view_reports', 'view_project_analytics',
    'view_financials', 'edit_budgets',
    'view_inventory', 'create_purchase_orders',
    'view_documents', 'upload_documents'
  ],

  # SUPERVISOR - Field management
  'supervisor' => [
    'view_projects',
    'view_gantt',
    'view_reports',
    'view_inventory', 'create_purchase_orders',
    'view_documents', 'upload_documents'
  ],

  # BUILDER - Task execution
  'builder' => [
    'view_projects',
    'view_gantt',
    'view_documents'
  ],

  # USER - Basic read access
  'user' => [
    'view_projects',
    'view_gantt',
    'view_documents'
  ]
}

# Create role permissions
role_permissions.each do |role, permission_names|
  puts "\n  #{role.upcase}:"
  permission_names.each do |perm_name|
    permission = Permission.find_by(name: perm_name)
    next unless permission

    RolePermission.find_or_create_by!(
      role: role,
      permission: permission
    )
    puts "    ✓ #{perm_name}"
  end
end

puts "\n✅ Permissions seeded successfully!"
puts "   Total permissions: #{Permission.count}"
puts "   Total role permissions: #{RolePermission.count}"
