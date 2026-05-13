export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen w-full bg-zinc-950 text-white flex items-center justify-center px-4">
      {children}
    </main>
  );
}