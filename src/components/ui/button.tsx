import type { ButtonHTMLAttributes, ReactNode } from "react";

import "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "medium";
  icon?: ReactNode;
};

export function Button({
  children,
  className = "",
  variant = "secondary",
  size = "medium",
  icon,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button button--${variant} button--${size} ${className}`.trim()}
      {...props}
    >
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  active?: boolean;
};

export function IconButton({
  label,
  children,
  active = false,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-button ${active ? "icon-button--active" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
