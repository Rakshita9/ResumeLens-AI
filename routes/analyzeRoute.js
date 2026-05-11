const express = require("express");
const multer = require("multer");
const analyzeResumeBuffer = require("../services/resumeAnalysisService");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files are allowed."));
        }

        cb(null, true);
    },
});

router.post("/analyze-resume", upload.single("resume"), async (req, res) => {
    try {
        const jobDescription = req.body.jobDescription;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a PDF resume.",
            });
        }

        if (!jobDescription || !jobDescription.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a job description.",
            });
        }

        const result = await analyzeResumeBuffer({
            fileBuffer: req.file.buffer,
            fileName: req.file.originalname,
            jobDescription,
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Resume analysis failed:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to analyze the resume.",
        });
    }
});

module.exports = router;
