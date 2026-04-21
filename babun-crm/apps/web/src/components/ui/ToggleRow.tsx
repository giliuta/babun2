"use client";

import ListRow from "./ListRow";
import IOSSwitch from "./IOSSwitch";

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

// Sugar over ListRow — shows the iOS switch on the right and
// forwards taps to it. The whole row stays tappable (HIG) but we
// don't add the row's own onClick because it would double-fire
// with the switch. Wrap `children` inside a `<ListGroup>` to get
// dividers and corner radii.
export default function ToggleRow({
  label,
  subtitle,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <ListRow
      label={label}
      subtitle={subtitle}
      accessory={
        <IOSSwitch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={label}
        />
      }
    />
  );
}
