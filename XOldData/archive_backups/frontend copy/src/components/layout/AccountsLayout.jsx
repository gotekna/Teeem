import { Link, useLocation } from 'react-router-dom'

const secondaryNavigation = [
  { name: 'Profile', href: '/profile' },
  { name: 'Settings', href: '/settings' },
]

export default function AccountsLayout({ children }) {
  const location = useLocation()

  return (
    <main>
      <h1 className="sr-only">Account Settings</h1>

      <header className="border-b border-gray-200 dark:border-white/5">
        {/* Secondary navigation */}
        <nav className="flex overflow-x-auto py-4">
          <ul
            role="list"
            className="flex min-w-full flex-none gap-x-6 px-4 text-sm/6 font-semibold text-gray-500 sm:px-6 lg:px-8 dark:text-gray-400"
          >
            {secondaryNavigation.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={
                    location.pathname === item.href
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'hover:text-gray-700 dark:hover:text-gray-300'
                  }
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Settings forms */}
      <div className="divide-y divide-gray-200 dark:divide-white/10">{children}</div>
    </main>
  )
}
