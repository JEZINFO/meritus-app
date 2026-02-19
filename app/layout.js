import "./globals.css";

export const metadata = {
  title: "Meritus",
  description: "Meritus — sistema de pontuação e ranking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
