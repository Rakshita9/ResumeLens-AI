const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const modelCandidates = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to server/.env before starting the app.");
}

const genAI = new GoogleGenerativeAI(apiKey);

async function generateAIResponse(prompt) {
    let lastError;

    for (const modelName of modelCandidates) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
            });

            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            lastError = error;
            const status = Number(error?.status || error?.response?.status);
            const retryable = status === 404 || status === 429 || status === 503;

            if (!retryable) {
                console.log("FULL GEMINI ERROR:");
                console.log(error);
                throw error;
            }
        }
    }

    console.log("FULL GEMINI ERROR:");
    console.log(lastError);
    throw lastError;
}

module.exports = generateAIResponse;