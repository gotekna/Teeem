export default function Experiences() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Experiences</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create and manage user experiences and workflows
        </p>
      </div>

      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Coming Soon</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          This feature is under development.
        </p>
      </div>
    </div>
  )
}
