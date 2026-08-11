import { useId, type ReactNode } from "react";

import "./section.css";

export function SleeperSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
  headerClassName = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  const headingId = useId();
  return (
    <section
      className={`sleeper-section ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <header className={`sleeper-section__header ${headerClassName}`.trim()}>
        <span>
          {eyebrow ? <small>{eyebrow}</small> : null}
          <h2 id={headingId}>{title}</h2>
        </span>
        {action ? (
          <span className="sleeper-section__action">{action}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
