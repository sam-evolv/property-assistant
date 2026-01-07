export default function DevToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 min-h-screen">
      {children}
    </div>
  );
}
