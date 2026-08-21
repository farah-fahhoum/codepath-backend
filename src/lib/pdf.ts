import puppeteer from "puppeteer";
import { SolutionSnippet } from "../types/reference.type";

const HIGHLIGHT_JS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
const HIGHLIGHT_CSS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css";

const LANGUAGE_ALIASES: Record<string, string> = {
  cpp: "cpp",
  "c++": "cpp",
  cc: "cpp",
  c: "cpp",
  java: "java",
  py: "python",
  python: "python",
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rust: "rust",
  kt: "kotlin",
  rb: "ruby",
  php: "php",
  sql: "sql",
  txt: "plaintext",
  text: "plaintext",
};

export function highlightLanguage(language: string | null | undefined): string {
  const key = (language || "cpp").trim().toLowerCase();
  return LANGUAGE_ALIASES[key] || "plaintext";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSnippetsHtml(
  snippets: SolutionSnippet[],
  options?: { title?: string },
): string {
  const blocks = snippets
    .map((snippet) => {
      const lang = highlightLanguage(snippet.language);
      const topic = snippet.topic?.title
        ? `<p class="meta">Topic: ${escapeHtml(snippet.topic.title)}</p>`
        : "";
      const notes = snippet.notes
        ? `<p class="notes">${escapeHtml(snippet.notes).replace(/\n/g, "<br/>")}</p>`
        : "";
      return `
      <section>
        <h2>${escapeHtml(snippet.title)}</h2>
        <p class="meta">Language: ${escapeHtml(snippet.language)}</p>
        ${topic}
        ${notes}
        <pre><code class="language-${lang}">${escapeHtml(snippet.code)}</code></pre>
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(options?.title || "Reference Sheet")}</title>
<link rel="stylesheet" href="${HIGHLIGHT_CSS_URL}"/>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 32px; color: #1f2933; }
  h1 { color: #0b3d91; border-bottom: 2px solid #0b3d91; padding-bottom: 8px; }
  h2 { color: #0b3d91; margin-top: 28px; }
  p.meta { color: #52606d; font-size: 13px; margin: 4px 0; }
  p.notes { background: #f0f4f8; padding: 8px 12px; border-left: 4px solid #9fb3c8; }
  pre { border-radius: 6px; overflow: hidden; }
  pre code { border-radius: 6px; padding: 14px; font-size: 12px; }
  section { page-break-inside: avoid; }
</style>
</head>
<body>
  <h1>${escapeHtml(options?.title || "Reference Sheet")}</h1>
  ${blocks}
  <script src="${HIGHLIGHT_JS_URL}"></script>
  <script>document.addEventListener("DOMContentLoaded", function () { if (window.hljs) { hljs.highlightAll(); } });</script>
</body>
</html>`;
}

/**
 * Render a set of snippets to a single A4 PDF using puppeteer.
 * Highlighting is applied by CDN-hosted highlight.js; if the CDN is
 * unreachable the PDF still renders with plain, readable code blocks.
 */
export async function generateSnippetsPdf(
  snippets: SolutionSnippet[],
  options?: { title?: string },
): Promise<Buffer> {
  const html = buildSnippetsHtml(snippets, options);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Best-effort: give the CDN script a moment to load and highlight.
    await page.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        if ((window as any).hljs) {
          (window as any).hljs.highlightAll();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
