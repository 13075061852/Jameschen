import React from 'react';
import BrandLogo from './BrandLogo.jsx';
import GradeBadge from './GradeBadge.jsx';
import { Trash2 } from 'lucide-react';

export default function CustomerRowCard({
  customer,
  isSelected,
  onSelect,
  onDelete,
  className = '',
  dragAttributes,
  dragListeners,
  dragging = false,
  overlay = false,
  batchMode = false,
  isBatchSelected = false,
  onToggleBatchSelect,
  onTogglePin,
}) {
  const handleClick = (event) => {
    if (batchMode) {
      onToggleBatchSelect(customer.id);
      return;
    }
    onSelect(customer.id);
  };

  return (
    <div
      className={`customerRow ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${overlay ? 'overlay' : ''} ${customer.pinned ? 'pinned' : ''} ${isBatchSelected ? 'batchSelected' : ''} ${batchMode ? 'batchSelectable' : ''} ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          onDelete(customer);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          if (batchMode) {
            onToggleBatchSelect(customer.id);
          } else {
            onSelect(customer.id);
          }
        }
      }}
      role="button"
      tabIndex={0}
      {...(batchMode ? {} : dragAttributes)}
      {...(batchMode ? {} : dragListeners)}
    >
      {batchMode && (
        <div
          className={`batchCheckbox ${isBatchSelected ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleBatchSelect(customer.id); }}
        >
          {isBatchSelected && <span className="batchCheckmark" />}
        </div>
      )}
      <BrandLogo company={customer.company} />
      <div className="customerText">
        <strong>{customer.company || '未命名公司'}</strong>
        <span>{customer.country || '未知国家'}</span>
      </div>
      <div className="customerBadges">
        <button
          type="button"
          className={`pinButton ${customer.pinned ? 'isPinned' : ''}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(customer.id);
          }}
          title={customer.pinned ? '取消置顶' : '置顶'}
          aria-label={customer.pinned ? '取消置顶' : '置顶'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={customer.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
        <button
          type="button"
          className="customerDeleteButton"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(customer);
          }}
          title="删除用户"
          aria-label={`删除 ${customer.company || '未命名客户'}`}
        >
          <Trash2 size={13} />
        </button>
        <GradeBadge grade={customer.grade} />
      </div>
    </div>
  );
}
