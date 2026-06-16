import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function EditorSizePicker({ sizes, currentSize, onPick }) {
  return (
    <div className="toolbarSizePicker" title="设置字号">
      <button
        type="button"
        className="toolbarSizeTrigger"
        onMouseDown={(event) => event.preventDefault()}
        aria-label="设置字号"
      >
        <span>{currentSize || '字号'}</span>
        <ChevronDown size={10} />
      </button>
      <div className="toolbarSizePopover" role="menu" aria-label="设置字号">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className="toolbarSizeOption"
            style={{ fontSize: size }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(size)}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
