import DataTable from './DataTable'

/**
 * DataTableExample - Demonstrates the standard DataTable component
 *
 * This file shows how to use the DataTable component with various configurations.
 * Use these examples as reference when implementing tables throughout TEEEM.
 */

// Example 1: Basic User Table (from the reference template)
const people = [
  {
    id: 1,
    name: 'Lindsay Walton',
    title: 'Front-end Developer',
    department: 'Optimization',
    email: 'lindsay.walton@example.com',
    role: 'Member',
    status: 'Active',
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  {
    id: 2,
    name: 'Courtney Henry',
    title: 'Designer',
    department: 'Intranet',
    email: 'courtney.henry@example.com',
    role: 'Admin',
    status: 'Active',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  {
    id: 3,
    name: 'Tom Cook',
    title: 'Director of Product',
    department: 'Directives',
    email: 'tom.cook@example.com',
    role: 'Member',
    status: 'Active',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  {
    id: 4,
    name: 'Whitney Francis',
    title: 'Copywriter',
    department: 'Program',
    email: 'whitney.francis@example.com',
    role: 'Admin',
    status: 'Inactive',
    image:
      'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  {
    id: 5,
    name: 'Leonard Krasner',
    title: 'Senior Designer',
    department: 'Mobility',
    email: 'leonard.krasner@example.com',
    role: 'Owner',
    status: 'Active',
    image:
      'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
  {
    id: 6,
    name: 'Floyd Miles',
    title: 'Principal Designer',
    department: 'Security',
    email: 'floyd.miles@example.com',
    role: 'Member',
    status: 'Active',
    image:
      'https://images.unsplash.com/photo-1463453091185-61582044d556?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  },
]

// Example 1: User Table with all features
export function UserTableExample() {
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (person) => (
        <div className="flex items-center">
          <div className="size-11 shrink-0">
            <img
              alt=""
              src={person.image}
              className="size-11 rounded-full dark:outline dark:outline-1 dark:outline-white/10"
            />
          </div>
          <div className="ml-4">
            <div className="font-medium text-gray-900 dark:text-white">{person.name}</div>
            <div className="mt-1 text-gray-500 dark:text-gray-400">{person.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (person) => (
        <div>
          <div className="text-gray-900 dark:text-white">{person.title}</div>
          <div className="mt-1 text-gray-500 dark:text-gray-400">{person.department}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (person) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
            person.status === 'Active'
              ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50'
              : 'bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20'
          }`}
        >
          {person.status}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (person) => (
        <span className="text-gray-500 dark:text-gray-400">{person.role}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      align: 'right',
      render: (person) => (
        <a
          href="#"
          onClick={(e) => {
            e.stopPropagation()
            console.log('Edit', person.name)
          }}
          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
        >
          Edit<span className="sr-only">, {person.name}</span>
        </a>
      ),
    },
  ]

  return (
    <DataTable
      title="Users"
      description="A list of all the users in your account including their name, title, email and role."
      data={people}
      columns={columns}
      actionButton={{
        label: 'Add user',
        onClick: () => console.log('Add user clicked'),
      }}
      onRowClick={(person) => console.log('Row clicked:', person.name)}
      defaultSortKey="name"
      defaultSortDirection="asc"
    />
  )
}

// Example 2: Simple table with text data
const projects = [
  { id: 1, name: 'Website Redesign', status: 'In Progress', priority: 'High', dueDate: '2025-12-15' },
  { id: 2, name: 'Mobile App', status: 'Planning', priority: 'Medium', dueDate: '2026-01-20' },
  { id: 3, name: 'API Integration', status: 'Completed', priority: 'Low', dueDate: '2025-11-30' },
]

export function ProjectTableExample() {
  const columns = [
    {
      key: 'name',
      label: 'Project Name',
      sortable: true,
      render: (project) => (
        <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (project) => {
        const statusColors = {
          'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400',
          'Planning': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500',
          'Completed': 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
        }
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusColors[project.status]}`}>
            {project.status}
          </span>
        )
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      // Custom sort function for priority
      sortFn: (a, b, direction) => {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 }
        const aValue = priorityOrder[a.priority] || 0
        const bValue = priorityOrder[b.priority] || 0
        return direction === 'asc' ? aValue - bValue : bValue - aValue
      },
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (project) => new Date(project.dueDate).toLocaleDateString(),
    },
  ]

  return (
    <DataTable
      title="Projects"
      description="Track all your active projects"
      data={projects}
      columns={columns}
      actionButton={{
        label: 'New Project',
        onClick: () => console.log('New project'),
      }}
      defaultSortKey="dueDate"
    />
  )
}

// Example 3: Table with custom empty state
export function EmptyTableExample() {
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
  ]

  return (
    <DataTable
      title="Team Members"
      description="Manage your team"
      data={[]} // Empty data
      columns={columns}
      actionButton={{
        label: 'Invite Member',
        onClick: () => console.log('Invite member'),
      }}
      emptyStateTitle="No team members"
      emptyStateDescription="Get started by inviting your first team member."
      emptyStateAction={{
        label: 'Invite Member',
        onClick: () => console.log('Invite from empty state'),
      }}
    />
  )
}

// Example 4: Loading state
export function LoadingTableExample() {
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ]

  return (
    <DataTable
      title="Loading Data"
      description="Please wait while we load your data"
      data={[]}
      columns={columns}
      loading={true}
    />
  )
}

// Example 5: Table with row className function
export function ConditionalStylingTableExample() {
  const items = [
    { id: 1, name: 'Item 1', isActive: true },
    { id: 2, name: 'Item 2', isActive: false },
    { id: 3, name: 'Item 3', isActive: true },
  ]

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'isActive',
      label: 'Active',
      sortable: true,
      render: (item) => (item.isActive ? 'Yes' : 'No'),
    },
  ]

  return (
    <DataTable
      title="Items"
      data={items}
      columns={columns}
      rowClassName={(item) =>
        item.isActive
          ? ''
          : 'opacity-50 bg-gray-50 dark:bg-gray-800/30'
      }
    />
  )
}

// Default export shows all examples
export default function DataTableExample() {
  return (
    <div className="space-y-16 py-8">
      <UserTableExample />
      <ProjectTableExample />
      <EmptyTableExample />
    </div>
  )
}
