// atproto-server.js
// A simple Bun server that listens to the AT Protocol firehose and serves a homepage.

import { WebSocket } from "bun";

const FIREHOSE_URL = "wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos";
let firehoseMessages = [];

console.log("Attempting to connect to the AT Protocol firehose...");

const ws = new WebSocket(FIREHOSE_URL);

// Function to handle WebSocket opening
ws.onopen = () => {
    console.log("Connection successful. Listening for new events...");
};

// Function to handle incoming messages from the firehose
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    firehoseMessages.push(message);

    if (message.t === '#commit') {
        const did = message.repo;
        console.log(`Commit from DID: ${did}`);
        
        // This is the logic for handling the at: formatted data.
        const domainMatch = did.match(/did:[^\/]+\/([^\/]+)/);
        if (domainMatch) {
            const domain = domainMatch[1];
            console.log(`  Parsed Domain: ${domain}`);
        }
    }
};

ws.onclose = () => {
    console.log("Connection to firehose closed.");
};

ws.onerror = (error) => {
    console.error("Firehose WebSocket error:", error.message);
};

const server = Bun.serve({
  port: 8000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
        // Serve a simple HTML page that logs firehose data to the browser console
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>AT Protocol Firehose Console</title>
          </head>
          <body>
            <h1>AT Protocol Firehose Listener</h1>
            <p>Check the browser's console (F12) for a live feed of firehose data.</p>
            <script>
              async function fetchFirehoseData() {
                try {
                  const response = await fetch('/firehose-data');
                  const data = await response.json();
                  console.log('Received firehose data:', data);
                } catch (error) {
                  console.error('Error fetching firehose data:', error);
                }
              }

              // Fetch the data and log it every 5 seconds
              setInterval(fetchFirehoseData, 5000);
            </script>
          </body>
          </html>
        `, {
            headers: { "Content-Type": "text/html" },
        });
    }

    if (url.pathname === "/firehose-data") {
        return new Response(JSON.stringify(firehoseMessages), {
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Local Bun server is running on http://${server.hostname}:${server.port}`);
console.log(`To expose this server: Run 'ngrok http 8000'`);