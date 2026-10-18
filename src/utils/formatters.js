export const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0)

export const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date)
}

export const getInvoicePaid = (invoiceId, payments) =>
  Math.round(payments.filter((payment) => payment.invoiceId === invoiceId)
    .filter((payment) => payment.status !== 'Refunded')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0))
