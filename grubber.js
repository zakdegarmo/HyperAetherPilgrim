// grubber.js

// Using 'module.exports' is a Node.js-specific syntax for CommonJS modules.
// Bun supports both CommonJS and ES Modules. For consistency, let's use the
// ES Module export default syntax.
// require('jsdom') is also for CommonJS. We'll use import for consistency.

import { JSDOM } from 'jsdom';

export default async function handler(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is missing.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: `Failed to fetch or parse URL: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[Grubber]: Found ${linksFound.size} unique links.`);
  return new Response(JSON.stringify({ links: Array.from(linksFound) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};