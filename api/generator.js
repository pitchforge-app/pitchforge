export default async function handler(req, res) {

  // Allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Pull inputs from request body
  const { jobDescription, skill, experience } = req.body || {};

  // Make sure all three fields are present
  if (!jobDescription || !skill || !experience) {
    return res.status(400).json({ error: 'All three fields are required.' });
  }

  // Make sure our API key is configured in Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API not configured. Please contact support.' });
  }

  // The instructions we give the AI
  const systemPrompt = `You are an expert Upwork and Fiverr proposal writer with 10 years of experience. Your proposals achieve consistently high response rates.

Your rules for every single proposal:
- NEVER open with "Hello", "Hi", "Dear", "I am", or "My name is"
- Open with a hook sentence that directly addresses the client's specific problem or goal
- Keep the proposal between 150 and 180 words — concise always wins
- Sound human, conversational, and confident — never robotic or generic
- Include exactly one specific result, number, or achievement to build credibility
- End with one clear and easy call to action (e.g. "Want to hop on a quick 15-minute call?")
- Never use clichés like "I am the perfect fit", "I have extensive experience", or "I am highly skilled"
- Write in first person throughout`;

  // The actual proposal request
  const userPrompt = `Write a winning freelance proposal using the information below.

Job Description:
${jobDescription}

Freelancer's Main Skill: ${skill}

Freelancer's Relevant Experience: ${experience}

Output ONLY the proposal text. Do not include any subject line, label, intro sentence, or explanation. Just the proposal itself.`;

  try {
    // Call Google Gemini API (100% free — no credit card needed)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 450,
            temperature: 0.75
          }
        })
      }
    );

    const data = await response.json();

    // Handle API-level errors
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API returned an error.');
    }

    // Extract the proposal text from the response
    const proposal = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!proposal) {
      throw new Error('No proposal was generated. Please try again.');
    }

    // Send the proposal back to the browser
    return res.status(200).json({ proposal });

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Something went wrong. Please try again in a moment.'
    });
  }
}
