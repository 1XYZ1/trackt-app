const VERSION = "0.1.0";

export function Footer() {
  return (
    <footer className="border-t bg-background px-4 py-3 text-muted-foreground text-xs md:px-6">
      <div className="flex flex-col items-center justify-between gap-1 sm:flex-row">
        <p>Trackt MVP · {new Date().getFullYear()}</p>
        <p>v{VERSION}</p>
      </div>
    </footer>
  );
}
