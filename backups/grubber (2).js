import { JSDOM } from 'jsdom';

export default async function handler(request) {
  // Construct a base URL from the request headers
  const baseURL = `https://${request.headers.host}`;
  // The URL constructor can now handle the relative URL with the base
  const url = new URL(request.url, baseURL);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is missing.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    return new Response(JSON.stringify({ links: Array.from(linksFound) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error crawling ${targetUrl}: ${error.message}`);
    return new Response(JSON.stringify({ error: `Failed to fetch or parse URL: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}