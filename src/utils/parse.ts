/**
 * Persian & Iranian mobile parsing utilities.
 * Pure functions for parsing participant names and phone numbers.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts Persian and Arabic digits to Latin digits (0-9).
 */
export function toLatinDigits(str: string): string {
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), String(i));
    result = result.replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
  }
  return result;
}

/**
 * Normalizes an Iranian mobile number to 09xxxxxxxxx (11 Latin digits).
 * If invalid, returns null.
 */
export function normalizeIranianMobile(phone: string): string | null {
  const latin = toLatinDigits(phone);
  // Strip all non-digit characters except leading plus
  const digitsOnly = latin.replace(/[^\d+]/g, '');

  let clean = digitsOnly;
  if (clean.startsWith('+98')) {
    clean = '0' + clean.slice(3);
  } else if (clean.startsWith('0098')) {
    clean = '0' + clean.slice(4);
  } else if (clean.startsWith('98') && clean.length === 12) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('9') && clean.length === 10) {
    clean = '0' + clean;
  }

  // Final check: must be 11 digits starting with 09
  if (/^09\d{9}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Trims leading and trailing separators (- | ، , tab : ; / \) and whitespace from a name.
 * Internal hyphens and separators in the name are preserved.
 */
function cleanNameString(name: string): string {
  // Regex to remove leading/trailing separators and whitespace
  // Separators: - | ، , \t : ; / \
  return name
    .replace(/^[\s\-\|،,\t:;/\\]+/, '')
    .replace(/[\s\-\|،,\t:;/\\]+$/, '')
    .trim();
}

export interface ParsedParticipant {
  name: string;
  phone?: string;
}

/**
 * Parses raw text where each participant is on a separate line.
 * Split lines ONLY on newlines (\r?\n), never on commas or hyphens.
 *
 * Each line is inspected for an Iranian mobile number:
 * 09xxxxxxxxx or +989xxxxxxxxx, with optional spaces or hyphens between digits.
 * Persian or Latin digits are accepted.
 *
 * The rest of the line, trimmed of leading/trailing separators (- | ، , tab), is the name.
 * Names that contain internal hyphens (e.g. کریمی-اصل) are preserved.
 */
export function parseParticipantLines(text: string): ParsedParticipant[] {
  if (!text || !text.trim()) return [];

  // Split lines ONLY on newlines (\r\n or \n)
  const lines = text.split(/\r?\n/);
  const results: ParsedParticipant[] = [];

  // Iranian phone pattern across Persian, Arabic, or Latin digits with optional spaces or dashes
  // Matches +98, 0098, 98, 09, or 9 followed by 9 digits with optional spaces/dashes
  const iranianPhoneRegex = /(?:(?:\+98|0098|98)\s*[-]?\s*|0)?9[\s\u200C-]*(?:[0-9۰-۹٠-٩][\s\u200C-]*){9}/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Convert line to Latin digits for uniform regex matching
    const latinLine = toLatinDigits(line);

    // Look for Iranian mobile in the line
    const match = iranianPhoneRegex.exec(latinLine);
    // Reset regex index for next iteration
    iranianPhoneRegex.lastIndex = 0;

    let phone: string | undefined;
    let name = line;

    if (match) {
      const matchedString = match[0];
      const matchIndex = match.index;
      const matchLength = matchedString.length;

      const normalized = normalizeIranianMobile(matchedString);
      if (normalized) {
        phone = normalized;
        // Remove the phone slice from the original line using the match indices
        name = line.slice(0, matchIndex) + ' ' + line.slice(matchIndex + matchLength);
      }
    }

    const cleanedName = cleanNameString(name);
    if (cleanedName) {
      results.push({
        name: cleanedName,
        phone,
      });
    }
  }

  return results;
}
