const { JSDOM } = require('jsdom');

module.exports = async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is missing.' });
  }

  console.log(`[Grubber]: Attempting to process URL: ${targetUrl}`);
  const linksFound = new Set();

  try {
    const fetchRes = await fetch(targetUrl);
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch: ${fetchRes.statusText}`);
    }
    const html = await fetchRes.text();
    const dom = new JSDOM(html, { url: targetUrl });
    const links = dom.window.document.querySelectorAll('a[href]');

    links.forEach(link => {
      let absoluteUrl;
      try {
        absoluteUrl = new URL(link.href, targetUrl).href;
      } catch (e) {
        return;
      }
      if (absoluteUrl.startsWith('http')) {
        linksFound.add(absoluteUrl);
      }
    });
  } catch (error) {
    console.error(`[Grubber]: Error crawling ${targetUrl}: ${error.message}`);
    return res.status(500).json({ error: `Failed to fetch or parse URL: ${error.message}` });
  }

  console.log(`[Grubber]: Found ${linksFound.size} unique links.`);
  return res.status(200).json({ links: Array.from(linksFound) });
};