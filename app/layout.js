import "./globals.css";

export const metadata = {
  title: "Meritus",
  description: "Meritus — sistema de pontuação e ranking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#070a12", color: "#e5e7eb", fontFamily: "system-ui" }}>
        {children}
      </body>
    </html>
  );
}
