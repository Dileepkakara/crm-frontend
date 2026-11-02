import { useRef, useState } from 'react'
import { Download, Eye, FileDown, History, Printer, Trash2, Upload } from 'lucide-react'
import { apiClient, isBackendMode } from '../../api/apiClient'
import { useApp } from '../../context/useApp'
import { formatCurrency } from '../../utils/formatters'
import { amountInWords } from '../../utils/amountInWords'
import { createDocumentPdf } from './documentPdf'
import './salesDocuments.css'

const referenceCompanyDetails = {
  gstin: '37AKOPY6766H1Z4',
  bankDetails: 'UNION BANK OF INDIA , MURALI NAGAR,VISAKHAPATNAM\nA/C NUMBER- 753601010050187 ; IFSC: UBIN0810746\nUPI ID: designblocks@ybl',
}

const providedCompanyDetails = {
  business: 'IT Services (Website & App Development)',
  address: '2nd Floor, 9-29-14/2, VIP Road, Balaji Nagar, Siripuram, Visakhapatnam, Andhra Pradesh – 530003',
  ward: '16',
  contactName: 'Yandra Ashok Kumar',
  phone: '8885557192',
  date: '07/11/2020',
}

const defaultQuotationTerms = 'Quotation prices are valid for 20 days from the date of issue.\n\nAny increase in project scope will result in an additional cost.'

function formatDocumentDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

function PartyDetails({ title, name, company, address, gstin, email, phone }) {
  return <section className="sales-doc-party">
    <h2>{title}</h2>
    <strong>{name || company || '—'}</strong>
    {company && company !== name && <span>{company}</span>}
    {address && <span>{address}</span>}
    {gstin && <span>GSTIN: {gstin}</span>}
    {email && <span>{email}</span>}
    {phone && <span>{phone}</span>}
  </section>
}

function CompanyBrand({ name }) {
  return <div className="sales-doc-company">
    <img className="sales-doc-logo" src="/design-blocks-logo.png" alt={`${name} logo`} />
  </div>
}

export default function SalesDocument({
  kind, record, client, preferences = {}, onPrint, onBack, onEdit, canEdit = false,
  resource, canGenerateDocument = false,
  paid = 0, balance = 0, payments = [],
}) {
  const { notify } = useApp()
  const sheetRef = useRef(null)
  const [savedRecord, setSavedRecord] = useState(record)
  const [documentBusy, setDocumentBusy] = useState(false)
  const [documentStage, setDocumentStage] = useState('')
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [deletingVersion, setDeletingVersion] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const versions = savedRecord.documentVersions || []
  const currentDocument = versions.find((item) => item.isCurrentVersion)
    || [...versions].sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber))[0]
  const needsRegeneration = Boolean(savedRecord.documentNeedsRegeneration)
  const readyDocument = currentDocument && !needsRegeneration
  const canGenerate = canGenerateDocument && isBackendMode

  async function generateAndSaveDocument() {
    if (!canGenerate || !resource) {
      notify('Document storage is available only to authorized staff in backend mode.', 'error')
      return
    }
    if (!sheetRef.current) {
      notify('The document preview is not ready to generate.', 'error')
      return
    }
    setDocumentBusy(true)
    setDocumentStage('Generating')
    setDocumentError('')
    try {
      const fileName = `${record.number || record.id || kind}.pdf`
      const blob = await createDocumentPdf(sheetRef.current, fileName)
      const file = new File([blob], fileName, { type: 'application/pdf' })
      setDocumentStage('Uploading')
      const { data: uploaded } = await apiClient.uploadResourceFile(resource, record.id, file)
      const previousVersions = (savedRecord.documentVersions || []).map((version) => ({
        ...version,
        isCurrentVersion: false,
      }))
      const nextVersions = previousVersions.some((version) => version.versionNumber === uploaded.versionNumber)
        ? previousVersions.map((version) => version.versionNumber === uploaded.versionNumber ? uploaded : version)
        : [...previousVersions, uploaded]
      setSavedRecord({
        ...savedRecord,
        documentVersions: nextVersions.map((version) => ({
          ...version,
          isCurrentVersion: version.versionNumber === uploaded.versionNumber,
        })),
        documentNeedsRegeneration: false,
      })
      notify(`Version ${uploaded.versionNumber} was saved securely.`)
    } catch (error) {
      const message = error.message || `Could not generate and save the ${kind.toLowerCase()} PDF.`
      setDocumentError(message)
      notify(message, 'error')
    } finally {
      setDocumentBusy(false)
      setDocumentStage('')
    }
  }

  async function openSavedFile(version, { attachment = false, download = false } = {}) {
    if (!resource || !record.id) return
    let previewWindow
    if (!download) {
      previewWindow = window.open('about:blank', '_blank')
      if (!previewWindow) {
        notify('Allow pop-ups to view the saved document.', 'error')
        return
      }
    }
    setDocumentBusy(true)
    try {
      const blob = await apiClient.getResourceFile(resource, record.id, version, { attachment, download })
      const url = URL.createObjectURL(blob)
      if (download) {
        const link = document.createElement('a')
        link.href = url
        link.download = attachment
          ? savedRecord.attachments?.find((item) => String(item._id || item.id) === String(version))?.originalFileName || 'attachment'
          : currentDocument?.originalFileName || `${record.number || record.id}.pdf`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        previewWindow.location.replace(url)
        previewWindow.opener = null
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        if (kind === 'Invoice' || kind === 'Quotation' || kind === 'Work Order') {
          notify('The saved PDF opened in a new tab. Use the PDF viewer controls to print.')
        }
      }
    } catch (error) {
      previewWindow?.close()
      if (!attachment && error.code === 'STORED_FILE_MISSING') {
        setSavedRecord((current) => ({ ...current, documentNeedsRegeneration: true }))
      }
      notify(error.message || 'Could not retrieve the saved file.', 'error')
    } finally {
      setDocumentBusy(false)
    }
  }

  async function deleteSavedVersion(version) {
    if (!canGenerate || !resource || !record.id) return
    const versionNumber = Number(version.versionNumber)
    if (!Number.isInteger(versionNumber) || version === currentDocument) {
      notify('The current document version cannot be deleted.', 'error')
      return
    }
    if (!window.confirm(`Delete version ${versionNumber} (${version.originalFileName})? This cannot be undone.`)) return

    setDeletingVersion(String(versionNumber))
    try {
      await apiClient.deleteResourceDocument(resource, record.id, versionNumber)
      setSavedRecord((current) => ({
        ...current,
        documentVersions: (current.documentVersions || []).filter((item) =>
          Number(item.versionNumber) !== versionNumber),
      }))
      notify(`Version ${versionNumber} was deleted.`)
    } catch (error) {
      if (error.code === 'CLOUDINARY_DELETE_FAILED') {
        setSavedRecord((current) => ({
          ...current,
          documentVersions: (current.documentVersions || []).filter((item) =>
            Number(item.versionNumber) !== versionNumber),
        }))
        notify('The version was removed from history, but Cloudinary could not delete its stored file.', 'error')
      } else {
        notify(error.message || `Could not delete version ${versionNumber}.`, 'error')
      }
    } finally {
      setDeletingVersion('')
    }
  }

  async function uploadSupportingFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!canGenerate || !resource) {
      notify('Only authorized staff can upload supporting files.', 'error')
      return
    }
    setAttachmentBusy(true)
    try {
      const { data: attachment } = await apiClient.uploadResourceFile(resource, record.id, file, 'attachments')
      setSavedRecord((current) => ({ ...current, attachments: [...(current.attachments || []), attachment] }))
      notify('Supporting file uploaded securely.')
    } catch (error) {
      notify(error.message || 'Could not upload the supporting file.', 'error')
    } finally {
      setAttachmentBusy(false)
    }
  }

  const isWorkOrder = kind === 'Work Order'
  const isFinancialDocument = kind === 'Quotation' || kind === 'Invoice'
  const items = record.items?.length ? record.items
    : record.lineItems?.length ? record.lineItems
      : record.description && record.quantity !== undefined && record.rate !== undefined
        ? [{ description: record.description, quantity: record.quantity, rate: record.rate }]
        : []
  const subtotal = Number(record.subtotal ?? items.reduce((sum, item) =>
    sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.rate || 0)), 0))
  const discount = Number(record.discount) || 0
  const taxable = Number(record.taxableValue ?? Math.max(0, subtotal - discount))
  const sgst = Number(record.sgstAmount) || taxable * (Number(record.sgstRate) || 0) / 100
  const cgst = Number(record.cgstAmount) || taxable * (Number(record.cgstRate) || 0) / 100
  const tax = Number(record.tax ?? sgst + cgst)
  const total = Number(record.total ?? record.amount ?? Math.max(0, taxable + tax))
  const paymentStatus = balance <= 0 ? 'Paid'
    : paid > 0 ? 'Partially Paid'
      : record.status === 'Overdue' ? 'Overdue' : 'Unpaid'
  const clientDetails = {
    name: record.billingName || client?.name || record.client,
    company: client?.company || record.client,
    address: record.billingAddress || client?.address,
    gstin: record.customerGstin || client?.gstin,
    email: record.contactEmail || client?.email,
    phone: record.contactPhone || client?.phone,
  }
  const companyDetails = {
    name: preferences.companyName || 'Design Blocks',
    business: preferences.companyBusiness || providedCompanyDetails.business,
    address: record.companyAddress || preferences.companyAddress || providedCompanyDetails.address,
    gstin: record.companyGstin || preferences.companyGstin || preferences.gstin || referenceCompanyDetails.gstin,
    bankDetails: record.bankDetails || preferences.bankDetails || referenceCompanyDetails.bankDetails,
    ward: preferences.companyWard || providedCompanyDetails.ward,
    contactName: preferences.companyContactName || providedCompanyDetails.contactName,
    phone: preferences.companyPhone || providedCompanyDetails.phone,
    businessDate: preferences.companyDate || providedCompanyDetails.date,
  }
  const number = record.number || record.id
  const date = record.issueDate || record.createdAt
  const terms = record.terms || preferences.documentTerms || (kind === 'Quotation' ? defaultQuotationTerms : '')
  const hasNoItemDetails = !items.length && !isWorkOrder
  const metadata = <>
    <strong>{kind} No: {number || 'Draft'}</strong>
    <span>Date: {formatDocumentDate(date)}</span>
    {record.dueDate && <span>Due Date: {formatDocumentDate(record.dueDate)}</span>}
    {record.validUntil && <span>Valid Until: {formatDocumentDate(record.validUntil)}</span>}
    {record.quotationId && <span>Quotation: {record.quotationId}</span>}
  </>

  return <section className="sales-document-preview">
    <div className="sales-doc-actions no-print">
      {onBack && <button type="button" className="sales-doc-button secondary" onClick={onBack}>Back</button>}
      {canEdit && onEdit && <button type="button" className="sales-doc-button secondary" onClick={onEdit}>Edit</button>}
      {canGenerate && <button type="button" className="sales-doc-button primary" disabled={documentBusy} onClick={generateAndSaveDocument}>
        <FileDown size={17} />{documentBusy ? `${documentStage}…` : needsRegeneration ? 'Regenerate PDF' : currentDocument ? 'Generate New Version' : 'Save Final Document'}
      </button>}
      {documentBusy && <span className="sales-doc-status" role="status">{documentStage}…</span>}
      {readyDocument && <>
        <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile('current')}><Eye size={17} /> View Document</button>
        <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile('current', { download: true })}><Download size={17} /> Download PDF</button>
        <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile('current')}><Printer size={17} /> Print</button>
      </>}
      {onPrint && <button type="button" className="sales-doc-button secondary" onClick={onPrint}>Print Preview</button>}
      {!currentDocument && <span className="sales-doc-status">Not Generated</span>}
      {needsRegeneration && <span className="sales-doc-status needs-regeneration">Updated — regeneration required</span>}
      {readyDocument && <span className="sales-doc-status uploaded">
        Uploaded · v{currentDocument.versionNumber} · {currentDocument.originalFileName} · {formatDocumentDate(currentDocument.uploadedAt)}
      </span>}
      {documentError && <span className="sales-doc-status needs-regeneration" role="status">Failed · {documentError}</span>}
      {versions.length > 1 && <button type="button" className="sales-doc-button secondary" onClick={() => setShowHistory((visible) => !visible)}><History size={17} /> Version History</button>}
      {canGenerate && <label className="sales-doc-button secondary sales-doc-upload">
        <Upload size={17} />{attachmentBusy ? 'Uploading…' : 'Add Attachment'}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={attachmentBusy} onChange={uploadSupportingFile} />
      </label>}
      {showHistory && <div className="sales-doc-version-history">
        {versions.slice().sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber)).map((version) => <div key={version._id || version.versionNumber}>
          <span>Version {version.versionNumber} · {version.isCurrentVersion && !needsRegeneration ? 'Current' : 'Previous'} · {version.originalFileName}</span>
          <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile(version.versionNumber)}>View</button>
          <button type="button" className="sales-doc-button secondary" disabled={documentBusy || Boolean(deletingVersion)} onClick={() => openSavedFile(version.versionNumber, { download: true })}>Download</button>
          {canGenerate && version !== currentDocument && <button
            type="button"
            className="sales-doc-button secondary danger-action"
            title={`Delete version ${version.versionNumber}`}
            aria-label={`Delete document version ${version.versionNumber}`}
            disabled={documentBusy || Boolean(deletingVersion)}
            onClick={() => deleteSavedVersion(version)}
          >{deletingVersion === String(version.versionNumber) ? 'Deleting…' : <Trash2 size={17} />}</button>}
        </div>)}
      </div>}
      {(savedRecord.attachments || []).map((attachment) => <span className="sales-doc-attachment" key={attachment._id || attachment.id}>
        {attachment.originalFileName}
        <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile(attachment._id || attachment.id, { attachment: true })}>View</button>
        <button type="button" className="sales-doc-button secondary" disabled={documentBusy} onClick={() => openSavedFile(attachment._id || attachment.id, { attachment: true, download: true })}>Download</button>
      </span>)}
    </div>
    <article ref={sheetRef} className={`sales-document-sheet${isWorkOrder ? ' sales-work-order-sheet' : ''}${isFinancialDocument ? ' sales-doc-standard-sheet' : ''}`}>
      <div className={`sales-doc-heading-grid${isFinancialDocument ? ' sales-doc-standard-header' : ''}`}>
        <div className="sales-doc-heading-left">
          <h1>{kind}</h1>
          <PartyDetails title="Bill to:" {...clientDetails} />
        </div>
        <div className="sales-doc-heading-right">
          <div className="sales-doc-company-info">
            <div className="sales-doc-company-copy">
              {companyDetails.gstin && <p><strong>GSTIN:</strong> {companyDetails.gstin}</p>}
              <p className="sales-doc-company-name">{companyDetails.name.toUpperCase()}</p>
              <p>{companyDetails.business}</p>
              {companyDetails.address && <p className="sales-doc-company-address"><strong>Address:</strong><br />{companyDetails.address}</p>}
              <p className="sales-doc-company-contact">
                <span><strong>Ward No.:</strong> {companyDetails.ward}</span>
                <span><strong>Name:</strong> {companyDetails.contactName}</span>
                <span><strong>Phone:</strong> {companyDetails.phone}</span>
                <span><strong>Date:</strong> {companyDetails.businessDate}</span>
              </p>
            </div>
            <CompanyBrand name={companyDetails.name} />
          </div>
          <div className="sales-doc-meta">{metadata}</div>
        </div>
      </div>

      {isWorkOrder ? <div className="sales-doc-work-details">
        <div className="sales-doc-work-title">{record.project || 'Work order'}</div>
        {record.status && <p><strong>Status:</strong> {record.status}</p>}
        {(record.startDate || record.deadline || record.timeline) && <section>
          <h2>Project dates</h2>
          <p>{[record.startDate && `Start: ${formatDocumentDate(record.startDate)}`, record.deadline && `Target completion: ${formatDocumentDate(record.deadline)}`, record.timeline].filter(Boolean).join(' · ')}</p>
        </section>}
        <section><h2>Scope of work</h2><p>{record.scope || record.description || 'Scope details have not been entered.'}</p></section>
        {record.deliverables && <section><h2>Deliverables</h2><p>{record.deliverables}</p></section>}
        {record.paymentMilestones && <section><h2>Payment milestones</h2><p>{record.paymentMilestones}</p></section>}
        {(record.total !== undefined || record.amount !== undefined) && <section className="sales-doc-work-amount">
          <h2>Agreed amount</h2><p>{formatCurrency(record.total ?? record.amount)}</p>
        </section>}
      </div> : <>
        <table className="sales-doc-table">
          <thead><tr><th>Item</th><th>Description</th><th>Quantity</th><th>Unit Price (Rs.)</th><th>Total Price (Rs.)</th></tr></thead>
          <tbody>
            {items.length ? items.map((item, index) => <tr key={`${item.id || item.description}-${index}`}>
              <td>{index + 1}</td><td>{item.description || '—'}</td><td>{item.quantity ?? '—'}</td>
              <td>{item.rate === undefined ? '—' : formatCurrency(item.rate)}</td>
              <td>{formatCurrency(item.amount ?? Number(item.quantity || 0) * Number(item.rate || 0))}</td>
            </tr>) : <tr><td>1</td><td>{hasNoItemDetails ? 'Itemized details not recorded' : record.title || '—'}</td><td>—</td><td>—</td><td>{formatCurrency(total)}</td></tr>}
            <tr className="sales-doc-tax-row"><td colSpan="3"></td><th>Subtotal</th><td>{formatCurrency(subtotal || total)}</td></tr>
            <tr className="sales-doc-total-row"><td colSpan="3"></td><th>Taxable Value</th><td>{formatCurrency(taxable || total)}</td></tr>
            {record.gstEnabled && (record.sgstEnabled || record.cgstEnabled) && <tr className="sales-doc-spacer" aria-hidden="true"><td colSpan="5"></td></tr>}
            {record.gstEnabled && record.sgstEnabled && <tr className="sales-doc-gst-row"><td>i</td><td colSpan="3">SGST@{Number(record.sgstRate) || 0}%</td><td>{formatCurrency(sgst)}</td></tr>}
            {record.gstEnabled && record.cgstEnabled && <tr className="sales-doc-gst-row"><td>{record.sgstEnabled ? 'ii' : 'i'}</td><td colSpan="3">CGST@{Number(record.cgstRate) || 0}%</td><td>{formatCurrency(cgst)}</td></tr>}
            {discount > 0 && <tr className="sales-doc-tax-row"><td colSpan="3"></td><th>Discount</th><td>− {formatCurrency(discount)}</td></tr>}
            <tr className="sales-doc-total-row"><td colSpan="3"></td><th>{kind === 'Invoice' ? 'Invoice Value' : 'Quotation Value'}</th><td>{formatCurrency(total)}</td></tr>
            {kind === 'Invoice' && <><tr className="sales-doc-tax-row"><td colSpan="3"></td><th>Amount Paid</th><td>{formatCurrency(paid)}</td></tr>
                <tr className="sales-doc-total-row"><td colSpan="3"></td><th>Balance Due</th><td>{formatCurrency(balance)}</td></tr>
                <tr className="sales-doc-tax-row"><td colSpan="3"></td><th>Payment Status</th><td>{paymentStatus}</td></tr></>}
          </tbody>
        </table>
        <div className="sales-doc-words"><strong>In Words:</strong> {amountInWords(total)}</div>
        {kind === 'Invoice' && payments.length > 0 && <section className="sales-doc-payment-details">
          <h2>Payment details</h2>{payments.map((payment) => <p key={payment.id}>
            {formatDocumentDate(payment.date)} · {payment.method || 'Payment'} · {formatCurrency(payment.amount)}
            {payment.reference ? ` · ${payment.reference}` : ''}
          </p>)}
        </section>}
      </>}

      {companyDetails.bankDetails && <div className="sales-doc-bank-sign">
        <section className="sales-doc-bank"><strong>BANK DETAILS:</strong><p>{companyDetails.bankDetails}</p></section>
        <div className="sales-doc-sign-off"><strong className="sales-doc-for">For {companyDetails.name}</strong>
          {isWorkOrder && <span className="sales-doc-acceptance">Client acceptance / signature</span>}
        </div>
        {!isWorkOrder && <div className="sales-doc-thanks">Thank You</div>}
      </div>}
      {!companyDetails.bankDetails && <div className="sales-doc-signature">
        <strong>For {companyDetails.name}</strong>
        {isWorkOrder && <span className="sales-doc-acceptance">Client acceptance / signature</span>}
        {!isWorkOrder && <span>Thank You</span>}
      </div>}
      {terms && <section className="sales-doc-terms"><h2>Terms and Conditions.</h2><p>{terms}</p></section>}
      {!isFinancialDocument && <p className="sales-doc-note">Demo document only. Not a tax invoice, legal agreement, or proof of payment.</p>}
    </article>
  </section>
}
