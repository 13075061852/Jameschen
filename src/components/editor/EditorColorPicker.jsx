import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function EditorColorPicker({ label, trigger, colors, currentColor, swatchClassName, onPick }) {
  return (
    <div className="toolbarColorPicker" title={label}>
      <button
        type="button"
        className={`toolbarColorTrigger ${swatchClassName}`}
        style={{ '--active-color': currentColor }}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={label}
      >
        {trigger}
        <ChevronDown size={10} />
      </button>
      <div className="toolbarColorPopover" role="menu" aria-label={label}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`toolbarSwatch ${swatchClassName}`}
            style={{ '--swatch-color': color }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(color)}
            aria-label={`${label} ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
