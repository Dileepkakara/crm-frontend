import { apiClient } from '../../api/apiClient'

export async function createDocumentPdf(element, fileName) {
  const { default: html2pdf } = await import('html2pdf.js')
  const blob = await html2pdf().set({
    margin: [8, 8, 8, 8],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  }).from(element).outputPdf('blob')
  if (!(blob instanceof Blob) || !blob.size) throw new Error('PDF generation did not produce a valid file.')
  return blob
}

export async function deliverStoredDocument(resource, record, { download = false } = {}) {
  let previewWindow
  if (!download) {
    previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) throw new Error('Allow pop-ups to view the saved document.')
  }
  try {
    const blob = await apiClient.getResourceFile(resource, record.id, 'current', { download })
    const url = URL.createObjectURL(blob)
    if (download) {
      const link = document.createElement('a')
      link.href = url
      link.download = record.documentVersions?.find((item) => item.isCurrentVersion)?.originalFileName
        || `${record.number || record.id}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      previewWindow.location.replace(url)
      previewWindow.opener = null
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
  } catch (error) {
    previewWindow?.close()
    throw error
  }
}
