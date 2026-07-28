import PDFDocument from 'pdfkit';
import { uploadToS3 } from './s3';
import type { IPurchaseOrder } from './models/PurchaseOrder';

export type DummyDocType = 'QAQC' | 'DN' | 'INVOICE' | 'EWAY_BILL';

const DOC_TITLES: Record<DummyDocType, string> = {
  QAQC: 'QAQC Report',
  DN: 'Delivery Note',
  INVOICE: 'Invoice',
  EWAY_BILL: 'E-Way Bill',
};

function renderDummyPdf(order: Pick<IPurchaseOrder, 'poNumber' | 'client' | 'batch' | 'qty'>, docType: DummyDocType): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(DOC_TITLES[docType], { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`PO Number: ${order.poNumber}`);
    doc.text(`Client: ${order.client}`);
    if (order.batch) doc.text(`Batch: ${order.batch}`);
    if (order.qty !== undefined) doc.text(`Qty: ${order.qty}`);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    doc.moveDown(4);

    doc.save();
    doc.fontSize(48).fillColor('red').opacity(0.4);
    doc.rotate(-30, { origin: [300, 400] });
    doc.text('DUMMY — FORMAT PENDING', 40, 380, { align: 'center' });
    doc.restore();

    doc.end();
  });
}

export async function generateDummyDoc(
  order: Pick<IPurchaseOrder, 'poNumber' | 'client' | 'batch' | 'qty'>,
  docType: DummyDocType
): Promise<{ key: string; url: string }> {
  const buffer = await renderDummyPdf(order, docType);
  return uploadToS3(buffer, 'application/pdf', 'po-documents');
}
