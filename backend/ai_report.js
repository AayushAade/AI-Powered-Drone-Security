/**
 * ChatGPT AI Situational Report Generator
 * 
 * Captures the latest drone video frame and sends it to OpenAI's ChatGPT Vision API
 * to generate a detailed situational report of the scene.
 */

const OpenAI = require('openai');

const REPORT_PROMPT = `You are an AI surveillance analyst for an urban safety drone system. 
A drone has been dispatched to an incident location and has arrived on scene.

Analyze this aerial/ground-level image and provide a BRIEF situational report:

1. **Scene Overview**: What do you see? (15 words max)
2. **People Count**: How many people are visible?
3. **Threat Assessment**: Any suspicious activity, fallen persons, crowd issues, or abandoned objects?
4. **Risk Level**: LOW / MODERATE / HIGH / CRITICAL
5. **Recommended Action**: What should the command center do next? (1-2 sentences)

Keep the report concise and professional. Use bullet points.`;

/**
 * Generate a situational report from a base64 image frame using ChatGPT Vision.
 * @param {string} base64Image - The frame as a base64-encoded JPEG string
 * @param {string} incidentType - The type of incident that triggered the dispatch
 * @returns {Promise<string>} The generated report text
 */
async function generateReport(base64Image, incidentType) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return `⚠️ **OpenAI API Key not configured.**\n\nSet OPENAI_API_KEY in your \`.env\` file to enable AI-powered situational reports.\n\n**Incident Type:** ${incidentType}\n**Status:** Drone is on scene and monitoring.\n**Recommendation:** Manual visual assessment required.`;
    }

    try {
        const openai = new OpenAI({ apiKey });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Incident reported: ${incidentType}.\n\n${REPORT_PROMPT}` },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('❌ OpenAI API error:', error.message);

        // If the user's API key hits the strict 0 limit quota or billing issues
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exceeded') || error.message.includes('insufficient_quota')) {
            console.log('⚠️ Generating simulated fallback report due to API quota limits.');

            let threat = "Potential risk observed in the specified area.";
            let risk = "MODERATE";
            let rec = "Dispatch ground security team for physical verification.";

            if (incidentType.includes("Fall") || incidentType.includes("SOS")) {
                threat = "Individual appears incapacitated or requires medical assistance.";
                risk = "CRITICAL";
                rec = "Alert emergency medical services immediately and send nearest ground unit.";
            } else if (incidentType.includes("Crowd") || incidentType.includes("Vehicle")) {
                threat = "Unusual concentration of entities detected in monitored zone.";
                risk = "HIGH";
                rec = "Monitor situation closely; dispatch crowd control unit to stand by.";
            } else if (incidentType.includes("Bag") || incidentType.includes("Intrusion")) {
                threat = "Unattended object / unauthorized presence detected in secured perimeter.";
                risk = "HIGH";
                rec = "Initiate perimeter lockdown protocols. Dispatch EOD/Security immediately.";
            }

            return `* [SIMULATED AI - QUOTA REACHED] *

*   **Scene Overview**: Drone arrived at target coordinates. Visual confirmation of ${incidentType.toLowerCase()}.
*   **People Count**: 1-5 individuals visible in immediate vicinity.
*   **Threat Assessment**: ${threat}
*   **Risk Level**: ${risk}
*   **Recommended Action**: ${rec}`;
        }

        return `⚠️ **AI Report Generation Failed**\n\nError: ${error.message}\n\n**Incident Type:** ${incidentType}\n**Status:** Drone is on scene. Manual assessment recommended.`;
    }
}

module.exports = { generateReport };
