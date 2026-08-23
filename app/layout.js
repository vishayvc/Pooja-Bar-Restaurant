import "./globals.css";

export const metadata = {
  title: "Pooja Bar and Restaurant — Shop Manager",
  description: "Dealers, purchase, inventory, sales and expense tracking.",
  manifest: "/manifest.json",
appleWebApp: {
  capable: true,
 statusBarStyle: "black-translucent",
 title: "Pooja Bar",
},
};

export const viewport = {
  themeColor: "#1c2a2e",
   width: "device-width",
   initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
     <head>
    <link rel="apple-touch-icon" href="/icon-192.png" />
  </head>
  <body className="font-sans">
    {children}
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `,
      }}
    />
  </body>
    </html>
  );
}
