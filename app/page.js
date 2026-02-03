export default function Page() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Meritus</h1>
      <p style={{ fontSize: 16, opacity: 0.8, marginBottom: 20 }}>
        Sistema de Ranking, Mérito e Evolução Contínua.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/ranking" style={linkStyle}>Ver Ranking</a>
        <a href="/lancamentos" style={linkStyle}>Lançamentos</a>
        <a href="/admin" style={linkStyle}>Admin</a>
      </div>
    </main>
  );
}

const linkStyle = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
  textDecoration: "none",
};
