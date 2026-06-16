import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function EditorFontPicker({ fonts, currentFont, onPick }) {
  const activeFont = fonts.find((f) => f.value === currentFont);
  return (
    <div className="toolbarFontPicker" title="设置字体">
      <button
        type="button"
        className="toolbarFontTrigger"
        onMouseDown={(event) => event.preventDefault()}
        aria-label="设置字体"
      >
        <span>{activeFont?.label || '字体'}</span>
        <ChevronDown size={10} />
      </button>
      <div className="toolbarFontPopover" role="menu" aria-label="设置字体">
        {fonts.map((font) => (
          <button
            key={font.label}
            type="button"
            className="toolbarFontOption"
            style={{ fontFamily: font.value }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(font.value)}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}
