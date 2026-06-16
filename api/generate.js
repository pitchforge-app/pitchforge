module.exports = async function handler(req, res) {

  // Allow requests from your website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  // Read the three inputs sent from the website
  const { jobDescription, skill, experience } = req.body || {};

  // All three fields must be filled in
  if (!jobDescription || !skill || !experience) {
    res.status(400).json({ error: 'Please fill in all three fields.' });
    return;
  }

  // Check the Gemini API key exists in Vercel environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Service not configured. Please contact support.' });
    return;
  }

  // Instructions given to the AI
  const systemPrompt = `You are an expert Upwork and Fiverr proposal writer with 10 years of experience. Your proposals consistently win jobs.

Rules you must follow for every proposal:
- NEVER start with Hello, Hi, Dear, I am, or My name is
- Open with a hook that directly addresses the client's specific problem
- Keep it between 150 and 180 words — concise wins
- Sound human and conversational — never robotic or generic
- Include one specific result, number, or achievement to build trust
- End with one simple, clear call to action
- Never say I am the perfect fit or I have extensive experience
- Always write in first person`;

  // The proposal request built from the user's inputs
  const userPrompt = `Write a winning freelance proposal using the details below.

Job Description:
${jobDescription}

My Main Skill: ${skill}

My Relevant Experience: ${experience}

Output ONLY the proposal text. No subject line, no label, no intro — just the proposal itself.`;

  try {

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents:          [{ parts: [{ text: userPrompt }] }],
          generationConfig:  { maxOutputTokens: 450, temperature: 0.75 }
        })
      }
    );

    // If Gemini itself returned an HTTP error
    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Gemini error ' + response.status + ': ' + errText.slice(0, 150));
    }

    const data = await response.json();

    // If Gemini returned an error object inside the JSON
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API error.');
    }

    // Pull out the generated text
    const proposal = data &&
                     data.candidates &&
                     data.candidates[0] &&
                     data.candidates[0].content &&
                     data.candidates[0].content.parts &&
                     data.candidates[0].content.parts[0] &&
                     data.candidates[0].content.parts[0].text
                     ? data.candidates[0].content.parts[0].text.trim()
                     : null;

    if (!proposal) {
      throw new Error('No proposal was generated. Please try again.');
    }

    res.status(200).json({ proposal: proposal });

  } catch (err) {
    res.status(500).json({
      error: err.message || 'Something went wrong. Please try again.'
    });
  }

};
