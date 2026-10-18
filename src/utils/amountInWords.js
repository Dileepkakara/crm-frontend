const smallNumbers = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowThousand(value) {
  const words = []
  if (value >= 100) {
    words.push(`${smallNumbers[Math.floor(value / 100)]} Hundred`)
    value %= 100
  }
  if (value >= 20) {
    words.push(tens[Math.floor(value / 10)])
    value %= 10
  }
  if (value > 0) words.push(smallNumbers[value])
  return words.join(' ')
}

export function amountInWords(value) {
  let amount = Math.max(0, Math.round(Number(value) || 0))
  if (amount === 0) return 'Zero Rupees Only'
  const groups = [
    [10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [1, ''],
  ]
  const words = []
  for (const [size, label] of groups) {
    const count = Math.floor(amount / size)
    if (count) {
      words.push(`${belowThousand(count)}${label ? ` ${label}` : ''}`)
      amount %= size
    }
  }
  return `${words.join(' ')} Rupees Only`
}
