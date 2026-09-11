import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";

export default function ProtectedLayout({ children }) {
  return (
    <AuthGate>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </AuthGate>
  );
}
