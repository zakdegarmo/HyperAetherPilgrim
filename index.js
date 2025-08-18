// index.js

import { file } from "bun";
import grubberHandler from "./grubber.js";

const PORT = 3900;

Bun.serve({
port:PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/grubber') {
      return await grubberHandler(request);
    }

    if (url.pathname === '/') {
      return new Response(file("./index.html"));
    }
    
    // Serve the new combined main.js file
    if (url.pathname === '/main.js') {
        return new Response(file("./main.js"));
    }

    // Handle requests for other static files
    try {
      const filePath = `.${url.pathname}`;
      const requestedFile = file(filePath);
      if (await requestedFile.exists()) {
        return new Response(requestedFile);
      } else {
        return new Response("404 Not Found", { status: 404 });
      }
    } catch (e) {
      return new Response("404 Not Found", { status: 404 });
    }
  },
});

console.log("Server running at http://localhost:3900");