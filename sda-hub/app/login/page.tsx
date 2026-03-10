import type { Metadata } from "next";
import { LogIn, Building2, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to the SDA Property Hub client or owner portal.",
};

const TEEEM_APP_URL = process.env.NEXT_PUBLIC_TEEEM_APP_URL || "https://app.teeem.com.au";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <LogIn className="mx-auto h-10 w-10 text-brand-500" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
          Login to Your Portal
        </h1>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
          Access your SDA property management dashboard through TEEEM.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Client Portal */}
        <a
          href={`${TEEEM_APP_URL}/login`}
          className="group flex flex-col items-center rounded-xl border-2 border-gray-200 bg-white p-8 text-center transition-all hover:border-brand-500 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-400"
        >
          <div className="rounded-full bg-brand-50 p-4 transition-colors group-hover:bg-brand-100 dark:bg-brand-900/30 dark:group-hover:bg-brand-900/50">
            <Users className="h-8 w-8 text-brand-500" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
            Client Portal
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            For SDA participants and support coordinators. View your accommodation details, submit maintenance requests, and manage your tenancy.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 group-hover:underline dark:text-brand-400">
            Login as Client
            <LogIn className="h-4 w-4" />
          </span>
        </a>

        {/* Owner Portal */}
        <a
          href={`${TEEEM_APP_URL}/login`}
          className="group flex flex-col items-center rounded-xl border-2 border-gray-200 bg-white p-8 text-center transition-all hover:border-accent-400 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-accent-400"
        >
          <div className="rounded-full bg-accent-50 p-4 transition-colors group-hover:bg-accent-100 dark:bg-accent-900/30 dark:group-hover:bg-accent-900/50">
            <Building2 className="h-8 w-8 text-accent-500" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
            Owner Portal
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            For SDA property owners and investors. View financial reports, tenant information, compliance status, and owner statements.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-500 group-hover:underline">
            Login as Owner
            <LogIn className="h-4 w-4" />
          </span>
        </a>
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account? Contact your SDA provider or{" "}
          <a href="/contact" className="font-medium text-brand-500 hover:underline dark:text-brand-400">
            get in touch with us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
