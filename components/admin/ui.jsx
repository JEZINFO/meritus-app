export function PageTitle({ title, subtitle, right }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--m-text)]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--m-muted)]">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-sm",
        "bg-[var(--m-surface)] border-[color:var(--m-border)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "default", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm transition border select-none";
  const styles =
    variant === "default"
      ? "bg-[var(--m-gold)] text-black border-transparent hover:bg-[var(--m-gold-2)]"
      : variant === "ghost"
      ? "bg-transparent text-[var(--m-text)] border-transparent hover:bg-white/5"
      : "bg-transparent text-[var(--m-gold)] border-[color:var(--m-gold)] hover:bg-[rgba(212,175,55,.10)]";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={[
        "w-full rounded-xl border px-3 py-2 text-sm outline-none",
        "bg-[var(--m-surface-2)] text-[var(--m-text)] border-[color:var(--m-border)]",
        "placeholder:text-white/40",
        "focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={[
        "w-full rounded-xl border px-3 py-2 text-sm outline-none",
        "bg-[var(--m-surface-2)] text-[var(--m-text)] border-[color:var(--m-border)]",
        "focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({ children, variant = "default" }) {
  const cls =
    variant === "warn"
      ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[rgba(245,215,110,.14)] text-[var(--m-gold-2)] border border-[rgba(245,215,110,.25)]"
      : "inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[rgba(212,175,55,.14)] text-[var(--m-gold)] border border-[rgba(212,175,55,.25)]";
  return <span className={cls}>{children}</span>;
}
