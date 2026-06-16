import React from 'react';
import { useEffect, useState } from 'react';

export default function PanelTitle({ title, icon, meta, titleMeta, action, collapsed = false, onToggle, toggleIcon, toggleTitle, editable = false, onTitleChange }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  function commitTitleChange() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    } else {
      setTitleDraft(title);
    }
    setEditingTitle(false);
  }

  function cancelTitleEdit() {
    setTitleDraft(title);
    setEditingTitle(false);
  }

  return (
    <div className="panelTitle">
      <div>
        {icon}
        {!collapsed && (editingTitle ? (
          <input
            className="panelTitleInput"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitleChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitleChange();
              if (event.key === 'Escape') cancelTitleEdit();
            }}
            autoFocus
          />
        ) : (
          <h2
            onClick={editable ? () => { setTitleDraft(title); setEditingTitle(true); } : undefined}
            style={editable ? { cursor: 'pointer' } : undefined}
            title={editable ? '点击修改标题' : undefined}
          >
            {title}
          </h2>
        ))}
        {titleMeta && <strong className="panelTitleMeta" title={titleMeta}>{titleMeta}</strong>}
      </div>
      {!collapsed && <span>{meta}</span>}
      {!collapsed && action}
      {onToggle && (
        <button className="collapseButton" onClick={onToggle} title={toggleTitle}>
          {toggleIcon}
        </button>
      )}
    </div>
  );
}
