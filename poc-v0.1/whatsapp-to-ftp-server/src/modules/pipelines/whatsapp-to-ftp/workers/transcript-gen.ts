import PDFDocument from "pdfkit";

export interface BuildWhatsappTranscriptPdfParams {
  messageId: string;
  senderNumber: string;
  displayPhoneNumber: string;
  timestamp: string;
  originalFilename: string;
  messageText: string | null;
}

/**
 * WhatsApp message transcript as a PDF (pdfkit — no headless browser).
 * Always includes metadata; body is "(empty)" when messageText is null or blank.
 */
export async function buildWhatsappTranscriptPdfBuffer(
  params: BuildWhatsappTranscriptPdfParams,
): Promise<Buffer> {
  const bodyText =
    params.messageText !== null && params.messageText.length > 0 ? params.messageText : "(empty)";

  const chunks: Buffer[] = [];

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    doc.fontSize(14).font("Helvetica-Bold").text("WhatsApp Message Transcript");
    doc.font("Helvetica");
    doc.moveDown(0.25);
    doc.fontSize(10).text("===========================");
    doc.moveDown(0.5);

    doc.fontSize(10).text(`Message ID:   ${params.messageId}`, { width: 500 });
    doc.moveDown(0.35);
    doc.fontSize(10).text(`From:         ${params.senderNumber}`, { width: 500 });
    doc.moveDown(0.35);
    doc.fontSize(10).text(`To:           ${params.displayPhoneNumber}`, { width: 500 });
    doc.moveDown(0.35);
    doc.fontSize(10).text(`Timestamp:    ${params.timestamp}`, { width: 500 });
    doc.moveDown(0.35);
    doc.fontSize(10).text(`Filename:     ${params.originalFilename}`, { width: 500 });
    doc.moveDown(0.75);

    doc.fontSize(12).text("Message Body:");
    doc.moveDown(0.25);
    doc.fontSize(10).text(bodyText, { width: 500, align: "left" });

    doc.end();
  });
}
