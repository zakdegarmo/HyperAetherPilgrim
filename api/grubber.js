// File: /api/grubber.js
// A serverless function to fetch a URL and extract all hyperlink hrefs.

import { JSDOM } from 'jsdom';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Define your local proxy agent
const proxyUrl = 'http://localhost:3000';
const agent = new HttpsProxyAgent(proxyUrl);

export default async function handler(req, res) {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is missing.' });
    }

    const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://` + targetUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        // Tell fetch to use the proxy agent for its requests
        const response = await fetch(fullUrl, { 
            signal: controller.signal,
            agent: agent // This is the key change
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();

        const dom = new JSDOM(html, { url: fullUrl });
        const document = dom.window.document;

        const links = document.querySelectorAll('a[href]');
        const linksFound = new Set();

        links.forEach(link => {
            try {
                const absoluteUrl = new URL(link.href, fullUrl).href;
                if (absoluteUrl.startsWith('http')) {
                    linksFound.add(absoluteUrl);
                }
            } catch (e) {
                // Ignore invalid URLs
            }
        });

        res.status(200).json({ links: Array.from(linksFound) });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Grubber function timed out for ${fullUrl}`);
            res.status(504).json({ error: 'The request timed out while trying to crawl the URL.' });
        } else {
            console.error(`Grubber function error for ${fullUrl}:`, error.message);
            res.status(500).json({ error: `Failed to fetch or parse URL: ${error.message}` });
        }
    }
}
