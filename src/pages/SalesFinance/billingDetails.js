function displayValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const text = String(value).trim()
  return ['null', 'undefined', '[object object]'].includes(text.toLowerCase()) ? '' : text
}

function firstDisplayValue(...values) {
  return values.map(displayValue).find(Boolean) || ''
}

export function getBillingDetails(record, client) {
  const linkedClient = record?.clientId && client?.id && String(record.clientId) !== String(client.id)
    ? null
    : client
  return {
    companyName: firstDisplayValue(linkedClient?.company, record?.client),
    phone: firstDisplayValue(record?.contactPhone, linkedClient?.phone),
    gstin: firstDisplayValue(record?.customerGstin, linkedClient?.gstin),
    address: firstDisplayValue(record?.billingAddress, linkedClient?.address),
  }
}
