// extract-pdf.ts — E5-07.
//
// Extraction du TEXTE d'un PDF côté Edge Function. Un PDF n'est pas une image :
// on ne l'envoie pas au modèle Vision, on en extrait le texte et on l'injecte
// dans le prompt (avec des délimiteurs) pour que le modèle texte le lise.
//
// Lib : `unpdf` — pensée pour les runtimes serverless (Deno / Workers),
// contrairement à `pdfjs-dist` qui traîne des dépendances navigateur.

// eslint-disable-next-line import/no-unresolved
import { extractText, getDocumentProxy } from 'npm:unpdf';

// Plafond de caractères injectés dans le prompt. Garde-fou de coût : un PDF de
// 100 pages exploserait le contexte (et la facture). ~30k caractères ≈ 8k
// tokens, largement assez pour un devoir / une fiche. Au-delà, on tronque.
const MAX_CHARS = 30_000;

/**
 * Extrait le texte d'un PDF depuis son URL signée. Renvoie le texte (tronqué à
 * MAX_CHARS) ou `null` si l'extraction échoue ou si le PDF ne contient pas de
 * texte exploitable (ex. PDF scanné = image). L'appelant gère le fallback.
 */
export async function extractPdfText(signedUrl: string): Promise<string | null> {
  try {
    const buffer = await fetch(signedUrl).then((r) => r.arrayBuffer());
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // mergePages: true → `text` est une seule chaîne (sinon un tableau par page).
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join('\n') : text).trim();
    if (merged.length === 0) return null;
    return merged.length > MAX_CHARS ? merged.slice(0, MAX_CHARS) : merged;
  } catch (err) {
    console.error('extract_pdf_failed', err instanceof Error ? err.message : String(err));
    return null;
  }
}
