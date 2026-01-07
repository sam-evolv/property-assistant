export default function DevToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
