/**
 * Add a captured canvas to a jsPDF document at full page width, continuing onto
 * additional pages when it is taller than one page (instead of shrinking it to fit).
 * @param {import('jspdf').jsPDF} pdf
 * @param {HTMLCanvasElement} canvas
 * @param {number} [margin=10] - page margin in the document's unit (mm)
 */
export function addCanvasAcrossPages(pdf, canvas, margin = 10) {
  const imgData = canvas.toDataURL('image/png');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableHeight = pageHeight - margin * 2;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let offset = 0;
  pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
  offset += printableHeight;
  while (offset < imgHeight - 0.5) {
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, margin - offset, imgWidth, imgHeight);
    offset += printableHeight;
  }
}
