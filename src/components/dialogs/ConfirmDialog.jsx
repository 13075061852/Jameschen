import React from 'react';
import { Trash2 } from 'lucide-react';

export default function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="confirmOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirmIcon">
          <Trash2 size={20} />
        </div>
        <div className="confirmContent">
          <h3 id="confirmTitle">{title}</h3>
          <p>{message}</p>
        </div>
        <div className="confirmActions">
          <button className="confirmCancel" onClick={onCancel}>取消</button>
          <button className="confirmDanger" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}
