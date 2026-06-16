// Customer identity, dedup, import-stats utilities.
// No dependency on component state.

export function getCustomerIdentityKey(customer) {
  const parts = [customer.company, customer.contact, customer.email]
    .map((value) => String(value ?? '').trim().toLowerCase());
  return parts.some(Boolean) ? parts.join('|') : '';
}

export function makeCustomerDuplicateKeys(customers) {
  return customers.reduce((keys, customer) => {
    if (customer.id) keys.ids.add(customer.id);
    const identityKey = getCustomerIdentityKey(customer);
    if (identityKey) keys.identities.add(identityKey);
    return keys;
  }, { ids: new Set(), identities: new Set() });
}

export function isDuplicateCustomer(customer, duplicateKeys) {
  const identityKey = getCustomerIdentityKey(customer);
  return duplicateKeys.ids.has(customer.id) || (identityKey && duplicateKeys.identities.has(identityKey));
}

export function getImportStats(importedCustomers, currentCustomers) {
  const duplicateKeys = makeCustomerDuplicateKeys(currentCustomers);
  const duplicateCount = importedCustomers.filter((customer) => isDuplicateCustomer(customer, duplicateKeys)).length;
  return {
    totalCount: importedCustomers.length,
    duplicateCount,
    newCount: importedCustomers.length - duplicateCount,
  };
}
