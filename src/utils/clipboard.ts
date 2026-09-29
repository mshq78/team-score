/**
 * Safe clipboard copying with graceful fallback for secure/insecure iframes.
 * Returns true if text was successfully copied, false otherwise.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Try modern navigator.clipboard API first
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Modern API rejected or blocked by permissions/iframe sandbox, proceed to fallback
    }
  }

  // Fallback: create temporary offscreen textarea and use execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export const copyToClipboard = copyTextToClipboard;
