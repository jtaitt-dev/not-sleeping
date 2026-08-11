import { Search } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import "./form-controls.css";

export function SleeperField({
  label,
  detail,
  children,
  className = "",
}: {
  label: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`sleeper-field ${className}`.trim()}>
      <span className="sleeper-field__copy">
        <strong>{label}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {children}
    </label>
  );
}

export const SleeperInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function SleeperInput({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`sleeper-input ${className}`.trim()}
      {...props}
    />
  );
});

export const SleeperSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function SleeperSelect({ className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`sleeper-select ${className}`.trim()}
      {...props}
    />
  );
});

export const SleeperTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function SleeperTextarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`sleeper-textarea ${className}`.trim()}
      {...props}
    />
  );
});

export const SleeperSearch = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label: string;
  }
>(function SleeperSearch({ label, className = "", ...props }, ref) {
  return (
    <label className={`sleeper-search ${className}`.trim()}>
      <Search aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input ref={ref} type="search" {...props} />
    </label>
  );
});
