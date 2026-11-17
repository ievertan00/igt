// The async clipboard API is unavailable in insecure contexts such as a plain
// http:// LAN address; execCommand remains the fallback there.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to selection copy */ }
  const holder = document.createElement("textarea");
  holder.value = text;
  holder.setAttribute("readonly", "");
  holder.style.position = "fixed";
  holder.style.opacity = "0";
  document.body.appendChild(holder);
  holder.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  holder.remove();
  return copied;
}