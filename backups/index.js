// index.js
import { file } from "bun";
import handler from "./api/grubber.js";

Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/grubber') {
      // Handle the API request to the grubber script
      return await handler(request, new Response());
    }
    
    // Handle requests for the main page
    if (url.pathname === '/') {
      return new Response(file("./index.html"));
    }
    
    // Handle requests for other files (e.g., CSS, JS)
    try {
      const filePath = `.${url.pathname}`;
      const file = Bun.file(filePath);
      return new Response(file);
    } catch (e) {
      return new Response("404 Not Found", { status: 404 });
    }
  },
});

console.log("Server running at http://localhost:3000");