export function PageTitle({ title, subtitle, right }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-black/60">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-black/10 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Button({ children, variant = "default", className = "", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm transition border";
  const styles =
    variant === "default"
      ? "bg-black text-white border-black hover:opacity-90"
      : "bg-white border-black/10 hover:bg-black/5";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
