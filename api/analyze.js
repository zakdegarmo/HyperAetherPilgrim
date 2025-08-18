// File: /api/analyze.js
// This is the Vercel serverless function that acts as our secure backend.

// --- The NLD Template is now a string constant inside the function ---
const NLD_TEMPLATE = `
Directive_Type: NLD_ONTOLOGICAL_REPORT
Target_Context: "ENTER_WEB_ADDRESS_TARGET_HERE"
Purpose: "To generate a standardized, analytical summary of the page by interpreting it through the 10 core concepts of MyOntology."
Response_Format: "Return the following information as a single, valid JSON-LD object using the provided @context, and structure. Ensure the output is a single, clean JSON object with no surrounding text or markdown formatting."

Query_Parameters: {
  "@context": {
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "Self": "https://zakdegarmo.github.io/MyOntology/docs/Self.html",
    "Thought": "https://zakdegarmo.github.io/MyOntology/docs/Thought.html",
    "Logic": "https://zakdegarmo.github.io/MyOntology/docs/Logic.html",
    "Unity": "https://zakdegarmo.github.io/MyOntology/docs/Unity.html",
    "Existence": "https://zakdegarmo.github.io/MyOntology/docs/Existence.html",
    "Improvement": "https://zakdegarmo.github.io/MyOntology/docs/Improvement.html",
    "Mastery": "https://zakdegarmo.github.io/MyOntology/docs/Mastery.html",
    "Resonance": "https://zakdegarmo.github.io/MyOntology/docs/Resonance.html",
    "Transcendence": "https://zakdegarmo.github.io/MyOntology/docs/Transcendence.html",
    "Everything": "https://zakdegarmo.github.io/MyOntology/docs/Nothing%20and%20Everything.html",
    "W5H":"https://zakdegarmo.github.io/MyOntology/docs/Competency-Questions-for-the-MyOS-Ontology.html"
  },
  "@id":"ENTER_WEB_ADDRESS_TARGET_HERE",
  "skos:prefLabel": "Provide a concise, descriptive title for this conversation.",
  "skos:definition": "Provide a 1-2 sentence summary of the main topic and outcome.",
  "Self": "Define the role and identity of the page.",
  "Thought": "Describe the primary thought process or intellectual journey.",
  "Logic": "Explain the core logic or reasoning.",
  "Unity": "Describe the state of collaboration or synthesis achieved.",
  "Existence": "What new concept or reality was brought into existence on the page?",
  "Improvement": "How did this page improve understanding?",
  "Mastery": "What concept or skill was mastered or significantly advanced?",
  "Resonance": "Describe the page's connection to broader goals or external ideas.",
  "Transcendence": "Did this page lead to a higher level of understanding or a breakthrough insight?",
  "Everything": "Provide a holistic closing statement about the page's overall value."
}
`;

// This function is the entry point for the serverless request.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Get the target URL and API key from the request body
        const { targetUrl, apiKey } = req.body;
        
        // *** THIS IS THE FIX ***
        // We now use the apiKey from the request body.
        const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            // This error message is now more accurate.
            throw new Error("Gemini API Key was not provided in the request or found on the server.");
        }
        
        if (!targetUrl) {
            return res.status(400).json({ error: 'targetUrl is required' });
        }

        const finalNld = NLD_TEMPLATE.replace(/ENTER_WEB_ADDRESS_TARGET_HERE/g, targetUrl);

        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalNld }] }]
            })
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`Gemini API call failed with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("API returned no candidates in the response.");
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
        
        if (!jsonMatch) {
            throw new Error("Could not find valid JSON in the AI's response.");
        }
        
        const jsonString = jsonMatch[1] || jsonMatch[2];
        const structuredData = JSON.parse(jsonString);

        res.status(200).json(structuredData);

    } catch (error) {
        console.error("Serverless function error:", error.message);
        res.status(500).json({ error: error.message });
    }
}
