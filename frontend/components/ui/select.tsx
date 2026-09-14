"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

/**
 * Select, on Radix, dressed as part of this site.
 *
 * shadcn's version is the starting point, with two departures.
 *
 * It is styled through this project's semantic tokens (--fg, --hairline,
 * --link, --panel) rather than shadcn's own theme variables, which do not
 * exist here — dropping the component in unchanged would have rendered a
 * control from a different design system.
 *
 * And it carries its own two SVGs instead of pulling in an icon library for a
 * chevron and a tick. /about tells clients that every dependency has to earn
 * the bytes it costs, so a package of a thousand glyphs for two of them is not
 * a thing this site gets to install.
 *
 * The trigger is a ruled line, not a bordered box, because the form around it
 * is a ruled sheet. The rule itself stays outside this component, owned by the
 * field wrapper that draws it in.
 */

const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5 L6 8 L9.5 4.5" />
    </svg>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    >
      <path d="M2 6.4 L4.8 9 L10 3.4" />
    </svg>
  );
}

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "peer flex w-full items-center justify-between gap-2 bg-transparent px-[0.15rem] py-2 text-left text-base text-[var(--fg)] outline-none transition-colors",
        // The placeholder has to read as unfilled, the way an empty ruled line
        // does next to it.
        "data-[placeholder]:text-[var(--fg-faint)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "focus:not(:focus-visible):outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Chevron className="h-3 w-3 shrink-0 text-[var(--fg-faint)] transition-transform duration-200 [[data-state=open]_&]:-rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)",
          "overflow-y-auto border border-[var(--hairline)] bg-[var(--panel)] p-1 shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="w-full">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between gap-3 px-3 py-2 text-sm text-[var(--fg-dim)] outline-none",
        "data-[highlighted]:bg-[color-mix(in_oklab,var(--link)_10%,transparent)] data-[highlighted]:text-[var(--fg)]",
        "data-[state=checked]:text-[var(--fg)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Tick className="h-3 w-3 text-[var(--link)]" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
};
