// Compatibility layer for old React Router code
"use client";

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Emulate react-router-dom hooks
export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return {
    pathname,
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    state: null,
  };
}

export function useNavigate() {
  const router = useRouter();

  return (path: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      router.replace(path);
    } else {
      router.push(path);
    }
  };
}

export function useParams() {
  // This would need to be passed from the page component
  return {};
}
