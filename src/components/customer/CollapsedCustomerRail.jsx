import React from 'react';
import BrandLogo from './BrandLogo.jsx';

export default function CollapsedCustomerRail({ customers, selectedId, onSelect }) {
  return (
    <div className="collapsedCustomerRail">
      <div className="collapsedCustomerList">
        {customers.map((customer) => (
          <button
            key={customer.id}
            className={`collapsedCustomerButton ${customer.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(customer.id)}
            title={`${customer.company || '未命名客户'} · ${customer.country || '未知国家'}`}
          >
            <BrandLogo company={customer.company} />
          </button>
        ))}
      </div>
      <strong>{customers.length}</strong>
    </div>
  );
}
