require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using the fetch API to call the REST endpoint directly to list models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const models = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent")).map(m => m.name);
        console.log("AVAILABLE MODELS FOR GENERATE CONTENT:");
        console.log(models.join('\n'));
    } catch (e) {
        console.error(e);
    }
}

listModels();
