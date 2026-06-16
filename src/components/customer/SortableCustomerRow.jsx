import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CustomerRowCard from './CustomerRowCard.jsx';

export default function SortableCustomerRow({ customer, isSelected, onSelect, onDelete, batchMode, isBatchSelected, onToggleBatchSelect, onTogglePin }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ id: customer.id, disabled: batchMode });

  return (
    <div
      className="sortableCustomerRow"
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
        transition,
      }}
    >
      <CustomerRowCard
        customer={customer}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        className={isDragging ? 'dragging' : isSorting ? 'sorting' : ''}
        dragAttributes={attributes}
        dragListeners={listeners}
        batchMode={batchMode}
        isBatchSelected={isBatchSelected}
        onToggleBatchSelect={onToggleBatchSelect}
        onTogglePin={onTogglePin}
      />
    </div>
  );
}
