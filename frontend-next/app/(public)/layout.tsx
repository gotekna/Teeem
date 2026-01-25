// Public layout - no authentication required
// Pages in this route group are accessible without login

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
