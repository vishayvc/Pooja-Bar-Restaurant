import "./globals.css";

export const metadata = {
  title: "Pooja Bar and Restaurant — Shop Manager",
  description: "Dealers, purchase, inventory, sales and expense tracking.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1c2a2e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
