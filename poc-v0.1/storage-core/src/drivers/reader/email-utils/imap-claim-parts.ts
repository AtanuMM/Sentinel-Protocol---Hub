import type { MessageStructureObject } from "imapflow";

export interface PdfPartRef {
  part: string;
  filename: string;
  mimeType: string;
}

interface CollectedLeaf {
  part: string;
  mime: string;
  filename?: string;
  disposition?: string;
}

function collectLeaves(node: MessageStructureObject | undefined, out: CollectedLeaf[]): void {
  if (!node) return;
  if (node.childNodes && node.childNodes.length > 0) {
    for (const c of node.childNodes) {
      collectLeaves(c, out);
    }
    return;
  }
  if (!node.part) return;
  const mime = node.type.toLowerCase();
  const filename =
    node.dispositionParameters?.filename || node.parameters?.name || node.parameters?.filename;
  out.push({
    part: node.part,
    mime,
    filename,
    disposition: node.disposition,
  });
}

function isPdfPart(mime: string, filename?: string): boolean {
  if (mime === "application/pdf" || mime.includes("pdf")) return true;
  const f = filename?.toLowerCase() ?? "";
  return f.endsWith(".pdf");
}

/**
 * Parts for claim poll: first text/plain, first text/html, and all PDF leaf parts.
 */
export function splitPollParts(struct: MessageStructureObject | undefined): {
  textPart?: string;
  htmlPart?: string;
  pdfParts: PdfPartRef[];
} {
  const leaves: CollectedLeaf[] = [];
  collectLeaves(struct, leaves);

  let textPart: string | undefined;
  let htmlPart: string | undefined;
  const pdfParts: PdfPartRef[] = [];

  for (const p of leaves) {
    if (p.mime === "text/plain" && !textPart) {
      textPart = p.part;
      continue;
    }
    if (p.mime === "text/html" && !htmlPart) {
      htmlPart = p.part;
      continue;
    }
    if (isPdfPart(p.mime, p.filename)) {
      pdfParts.push({
        part: p.part,
        filename: p.filename?.trim() || `attachment-${p.part}.pdf`,
        mimeType: p.mime,
      });
    }
  }

  return { textPart, htmlPart, pdfParts };
}
