import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "./button";
import "./overlays.css";

type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  label?: string;
  className?: string;
};

function SleeperOverlay({
  variant,
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  children,
  footer,
  label,
  className = "",
}: OverlayProps & { variant: "modal" | "drawer" | "sheet" }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sleeper-overlay-scrim" />
        <Dialog.Content
          className={`sleeper-overlay sleeper-overlay--${variant} ${className}`.trim()}
          aria-label={label}
        >
          {variant === "sheet" ? (
            <span className="sleeper-overlay__grabber" aria-hidden="true" />
          ) : null}
          <header className="sleeper-overlay__header">
            <span>
              {eyebrow ? <small>{eyebrow}</small> : null}
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description
                className={description ? undefined : "sr-only"}
              >
                {description ?? `${label ?? "Dialog"} details and actions.`}
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <IconButton label={`Close ${label ?? "dialog"}`}>
                <X />
              </IconButton>
            </Dialog.Close>
          </header>
          <div className="sleeper-overlay__body">{children}</div>
          {footer ? (
            <footer className="sleeper-overlay__footer">{footer}</footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SleeperModal(props: OverlayProps) {
  return <SleeperOverlay {...props} variant="modal" />;
}

export function SleeperDrawer(props: OverlayProps) {
  return <SleeperOverlay {...props} variant="drawer" />;
}

export function SleeperBottomSheet(props: OverlayProps) {
  return <SleeperOverlay {...props} variant="sheet" />;
}

export function SleeperTooltip({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="sleeper-tooltip" sideOffset={6}>
          {label}
          <Tooltip.Arrow className="sleeper-tooltip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export type SleeperMenuItem = {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function SleeperMenu({
  label,
  trigger,
  items,
}: {
  label: string;
  trigger: ReactNode;
  items: SleeperMenuItem[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="sleeper-menu"
          aria-label={label}
          sideOffset={6}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              className="sleeper-menu__item"
              disabled={item.disabled}
              key={item.id}
              onSelect={item.onSelect}
            >
              <span>
                <strong>{item.label}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </span>
              {item.selected ? <Check aria-hidden="true" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
