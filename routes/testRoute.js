const express = require("express");
const router = express.Router();

const generateAIResponse = require("../services/geminiService");

router.get("/test-ai", async (req, res) => {
    try {
        const response = await generateAIResponse(
            "Tell me what ATS means in 30 words."
        );

        res.json({
            success: true,
            response,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

module.exports = router;