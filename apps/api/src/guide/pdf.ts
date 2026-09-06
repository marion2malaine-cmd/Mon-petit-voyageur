import fs from "node:fs";

/**
 * Renders the guide HTML to a PDF with a headless Chromium.
 *
 * The browser binary comes from the Docker image (Debian's chromium) in
 * production and from a local Chrome on a developer machine; its path can be
 * forced with PUPPETEER_EXECUTABLE_PATH. The guide already carries its print
 * stylesheet, so this is the same document the traveler would get from
 * "Imprimer / PDF", produced server-side and downloadable in one click.
 */
const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
].filter((path): path is string => !!path);

export function chromiumPath(): string | null {
  return CANDIDATES.find((path) => fs.existsSync(path)) ?? null;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const executablePath = chromiumPath();
  if (!executablePath) {
    throw new Error("chromium_not_found");
  }
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  try {
    const page = await browser.newPage();
    // Photos are embedded as data URIs and the interactive map is replaced by
    // its still picture in print, so nothing waits on the network for long.
    await page.setContent(html, { waitUntil: "load", timeout: 90_000 });
    await page.evaluate(() => (document as any).fonts?.ready);
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
