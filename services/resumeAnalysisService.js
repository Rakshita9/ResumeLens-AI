const pdfParseModule = require("pdf-parse");
const generateAIResponse = require("./geminiService");

const PDFParse = pdfParseModule.PDFParse;

const MAX_RESUME_CHARS = 12000;
const MAX_JOB_CHARS = 6000;
const STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "our",
    "the",
    "their",
    "this",
    "to",
    "was",
    "we",
    "with",
    "you",
    "your",
    "about",
    "able",
    "also",
    "any",
    "can",
    "candidate",
    "describe",
    "description",
    "experience",
    "job",
    "looking",
    "must",
    "need",
    "needed",
    "role",
    "team",
    "teams",
    "work",
    "working",
    "years",
]);

function truncateText(text, maxLength) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function stripCodeFences(text) {
    return String(text || "")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item) => String(item).trim());
    }

    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\n|,|\u2022/g)
            .map((item) => item.replace(/^[-*]\s*/, "").trim())
            .filter(Boolean);
    }

    return [];
}

function normalizeTextForMatch(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9+.#\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractKeywords(text) {
    const normalized = normalizeTextForMatch(text);
    if (!normalized) {
        return [];
    }

    const phrases = [];
    const seen = new Set();
    const words = normalized.split(" ").filter((word) => word && !STOPWORDS.has(word) && word.length > 1);

    for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        if (!seen.has(word)) {
            seen.add(word);
            phrases.push(word);
        }

        const next = words[i + 1];
        if (next) {
            const pair = `${word} ${next}`;
            if (!STOPWORDS.has(next) && !seen.has(pair)) {
                seen.add(pair);
                phrases.push(pair);
            }
        }
    }

    return phrases;
}

function pickKeywordMatches(resumeText, jobDescription) {
    const resumeNormalized = normalizeTextForMatch(resumeText);
    const resumeKeywords = new Set(extractKeywords(resumeText));
    const jobKeywords = extractKeywords(jobDescription);

    const matchedKeywords = [];
    const missingKeywords = [];

    jobKeywords.forEach((keyword) => {
        if (resumeNormalized.includes(keyword) || resumeKeywords.has(keyword)) {
            if (!matchedKeywords.includes(keyword)) {
                matchedKeywords.push(keyword);
            }
        } else if (!missingKeywords.includes(keyword)) {
            missingKeywords.push(keyword);
        }
    });

    return {
        matchedKeywords: matchedKeywords.slice(0, 12),
        missingKeywords: missingKeywords.slice(0, 12),
    };
}

function dedupeList(items) {
    const seen = new Set();
    const result = [];

    items.forEach((item) => {
        const cleaned = String(item || "").trim();
        const key = cleaned.toLowerCase();

        if (cleaned && !seen.has(key)) {
            seen.add(key);
            result.push(cleaned);
        }
    });

    return result;
}

function buildFallbackBulletPoints({ matchedKeywords, missingKeywords, gaps }) {
    const focusKeywords = dedupeList([...matchedKeywords.slice(0, 3), ...missingKeywords.slice(0, 3)]);
    const primaryKeyword = focusKeywords[0] || "the target role";
    const secondaryKeyword = focusKeywords[1] || "core product work";
    const gapKeyword = missingKeywords[0] || gaps[0] || "measurable outcomes";

    return [
        `Developed and maintained ${primaryKeyword} solutions using JavaScript, React, and Node.js to deliver reliable features and improve user experience.`,
        `Built or enhanced ${secondaryKeyword} with reusable components, clear API integration, and maintainable code structure.`,
        `Collaborated with cross-functional teams to plan, ship, and refine product work while keeping delivery aligned with business goals.`,
        `Improved application performance, debugging, or testing quality by identifying bottlenecks and applying practical engineering fixes.`,
        `Tailored resume content to include ${gapKeyword} and other role-specific keywords so the profile better matches the job description.`,
        `Converted project work into outcome-driven bullets that highlight scope, impact, and the technologies used.`,
    ];
}

function buildFallbackGaps({ missingKeywords, matchedKeywords }) {
    const missing = dedupeList(missingKeywords).slice(0, 3);
    const matched = dedupeList(matchedKeywords).slice(0, 2);
    const fallbackGaps = [
        "Lacks stronger evidence of measurable impact and quantifiable outcomes.",
        "Needs more role-specific detail that connects experience to the job description.",
        "Could better demonstrate clear, ATS-friendly bullet points and action verbs.",
    ];

    if (missing.length) {
        fallbackGaps.unshift(`Missing or weak coverage of ${missing[0]}.`);
    }

    if (matched.length) {
        fallbackGaps.push(`Could expand on how ${matched[0]} and related skills were used in real projects.`);
    }

    return dedupeList(fallbackGaps).slice(0, 6);
}

function buildFallbackNextSteps({ missingKeywords, gaps, resumeBulletPoints }) {
    const missing = dedupeList(missingKeywords).slice(0, 3);
    const nextSteps = [
        "Add 2 to 3 quantified achievements with numbers, percentages, or scale.",
        "Rewrite weak bullets into clear action-result statements.",
        "Tailor the resume summary and skills section to the job description.",
    ];

    if (missing.length) {
        nextSteps.unshift(`Add keywords such as ${missing.join(", ")} where they naturally fit your experience.`);
    }

    if (!resumeBulletPoints.length) {
        nextSteps.push("Use the suggested resume bullets below as replacements for generic experience lines.");
    }

    if (gaps.length) {
        nextSteps.push(`Work directly on the biggest gap: ${gaps[0]}`);
    }

    return dedupeList(nextSteps).slice(0, 6);
}

function getKeywordCoverage(matchedKeywords, missingKeywords) {
    const total = matchedKeywords.length + missingKeywords.length;
    if (!total) {
        return 0;
    }

    return Math.round((matchedKeywords.length / total) * 100);
}

function countPatternMatches(text, pattern) {
    const matches = String(text || "").match(pattern);
    return matches ? matches.length : 0;
}

function computeScoreBreakdown({ resumeText, matchedKeywords, missingKeywords, resumeBulletPoints }) {
    const keywordCoverage = getKeywordCoverage(matchedKeywords, missingKeywords);
    const quantSignal = Math.min(100, countPatternMatches(resumeText, /\b\d+(?:\.\d+)?%?\b/g) * 18);
    const bulletSignal = Math.min(100, resumeBulletPoints.length * 14);
    const focusSignal = Math.max(0, 100 - Math.min(100, missingKeywords.length * 12));

    return {
        keywordCoverage,
        impact: Math.round((quantSignal + bulletSignal) / 2),
        clarity: Math.round((bulletSignal + focusSignal) / 2),
        roleFit: Math.round((keywordCoverage * 0.6) + (focusSignal * 0.4)),
    };
}

function buildResumeHeadline({ matchedKeywords, missingKeywords, resumeText }) {
    const focus = dedupeList([...matchedKeywords.slice(0, 2), ...missingKeywords.slice(0, 1)]);
    const title = focus[0] || "Software Engineer";
    const skill = focus[1] || "web applications";
    const tone = countPatternMatches(resumeText, /\b(team|collaborat|built|developed|designed|optimized)\b/gi) > 3
        ? "results-driven"
        : "versatile";

    return `${tone} ${title} profile focused on ${skill}`;
}

function buildActionVerbs({ matchedKeywords, missingKeywords }) {
    const baseVerbs = ["Built", "Designed", "Improved", "Optimized", "Collaborated", "Delivered"];
    const keywordVerbMap = {
        react: "Developed",
        node: "Engineered",
        "node.js": "Engineered",
        api: "Integrated",
        apis: "Integrated",
        rest: "Connected",
        agile: "Adapted",
        data: "Analyzed",
        performance: "Optimized",
    };

    const keywordVerbs = dedupeList([...matchedKeywords, ...missingKeywords].map((keyword) => {
        const normalized = String(keyword || "").toLowerCase();
        return Object.entries(keywordVerbMap).find(([needle]) => normalized.includes(needle))?.[1];
    }).filter(Boolean));

    return dedupeList([...keywordVerbs, ...baseVerbs]).slice(0, 8);
}

function buildAtsReadiness({ matchScore, missingKeywords, resumeBulletPoints }) {
    if (matchScore >= 85 && missingKeywords.length <= 2 && resumeBulletPoints.length >= 5) {
        return "ATS-ready";
    }

    if (matchScore >= 65) {
        return "Good with targeted edits";
    }

    if (matchScore >= 45) {
        return "Needs stronger tailoring";
    }

    return "Needs major revision";
}

function buildLocalStrengths({ matchedKeywords, resumeText }) {
    const strengths = [];
    const matched = dedupeList(matchedKeywords);

    if (matched.some((keyword) => /react|node|javascript|api|rest/.test(keyword.toLowerCase()))) {
        strengths.push("Core development stack aligns with the target role.");
    }

    if (countPatternMatches(resumeText, /\b(collaborat|team|cross-functional)\b/gi) > 0) {
        strengths.push("Shows collaboration and team-working experience.");
    }

    if (countPatternMatches(resumeText, /\b(built|developed|designed|optimized)\b/gi) > 0) {
        strengths.push("Includes hands-on delivery and product-building language.");
    }

    if (!strengths.length) {
        strengths.push("Resume contains enough signal to generate targeted improvements.");
    }

    return strengths.slice(0, 5);
}

function buildLocalSummary({ matchScore, resumeHeadline, atsReadiness, matchedKeywords, missingKeywords }) {
    const matchedText = matchedKeywords.slice(0, 4).join(", ") || "the job requirements";
    const missingText = missingKeywords.slice(0, 3).join(", ") || "a few role-specific details";

    return `${resumeHeadline} shows a ${matchScore}% match and is ${atsReadiness.toLowerCase()}. It aligns well with ${matchedText}, while still needing stronger coverage of ${missingText}.`;
}

function looksLikeStructuredNoise(value) {
    const text = String(value || "").trim();
    return text.startsWith("{") || text.startsWith("[") || text.includes('"matchScore"') || text.includes('"summary"');
}

function parseModelResponse(text) {
    const cleaned = stripCodeFences(text);

    const tryParseJson = (value) => {
        const parsed = JSON.parse(value);
        return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    };

    try {
        const parsed = tryParseJson(cleaned);
        return {
            matchScore: Number(parsed.matchScore) || 0,
            summary: parsed.summary || parsed.overallSummary || "",
            resumeHeadline: parsed.resumeHeadline || parsed.headline || "",
            atsReadiness: parsed.atsReadiness || parsed.atsLabel || "",
            strengths: toList(parsed.strengths),
            gaps: toList(parsed.gaps),
            missingKeywords: toList(parsed.missingKeywords),
            matchedKeywords: toList(parsed.matchedKeywords),
            resumeBulletPoints: toList(parsed.resumeBulletPoints || parsed.bulletPoints),
            nextSteps: toList(parsed.nextSteps),
            actionVerbs: toList(parsed.actionVerbs),
        };
    } catch (error) {
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            try {
                const parsed = tryParseJson(cleaned.slice(jsonStart, jsonEnd + 1));
                return {
                    matchScore: Number(parsed.matchScore) || 0,
                    summary: parsed.summary || parsed.overallSummary || "",
                    resumeHeadline: parsed.resumeHeadline || parsed.headline || "",
                    atsReadiness: parsed.atsReadiness || parsed.atsLabel || "",
                    strengths: toList(parsed.strengths),
                    gaps: toList(parsed.gaps),
                    missingKeywords: toList(parsed.missingKeywords),
                    matchedKeywords: toList(parsed.matchedKeywords),
                    resumeBulletPoints: toList(parsed.resumeBulletPoints || parsed.bulletPoints),
                    nextSteps: toList(parsed.nextSteps),
                    actionVerbs: toList(parsed.actionVerbs),
                };
            } catch (innerError) {
                // Fall through to plain-text handling below.
            }
        }

        return {
            matchScore: 0,
            summary: cleaned,
            resumeHeadline: "",
            atsReadiness: "",
            strengths: [],
            gaps: [],
            missingKeywords: [],
            matchedKeywords: [],
            resumeBulletPoints: [],
            nextSteps: [],
            actionVerbs: [],
        };
    }
}

async function analyzeResumeBuffer({ fileBuffer, fileName, jobDescription }) {
    if (!fileBuffer) {
        throw new Error("Resume PDF file is required.");
    }

    if (!jobDescription || !jobDescription.trim()) {
        throw new Error("Job description is required.");
    }

    const parser = new PDFParse({ data: fileBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();

    const resumeText = truncateText(pdfData.text, MAX_RESUME_CHARS);
    const jobText = truncateText(jobDescription, MAX_JOB_CHARS);

    const prompt = `You are an ATS resume analyzer.

Return ONLY valid JSON with these keys:
- matchScore: number from 0 to 100
- summary: one concise paragraph about the resume fit
    - resumeHeadline: a short, compelling professional headline for the resume
    - atsReadiness: a short label such as ATS-ready, Needs Work, or Good with targeted edits
- strengths: array of 3 to 6 strengths from the resume for this job
- gaps: array of 3 to 6 missing areas or weak spots
- matchedKeywords: array of keywords found in both resume and job description
- missingKeywords: array of important keywords from the job description missing in the resume
- resumeBulletPoints: array of 5 to 8 improved bullet points that the candidate can use or adapt in the resume
- nextSteps: array of 3 to 5 actionable suggestions
    - actionVerbs: array of 5 to 8 strong resume action verbs tailored to the profile

Rules:
- Do not use markdown.
- Do not wrap the output in code fences.
- Keep bullets specific, practical, and tailored to the job description.

Resume text:
${resumeText}

Job description:
${jobText}`;

    let parsed;

    try {
        const aiResponse = await generateAIResponse(prompt);
        parsed = parseModelResponse(aiResponse);
    } catch (error) {
        console.log("Gemini unavailable, using local fallback analysis:", error.message || error);
        parsed = {
            matchScore: 0,
            summary: "",
            resumeHeadline: "",
            atsReadiness: "",
            strengths: [],
            gaps: [],
            missingKeywords: [],
            matchedKeywords: [],
            resumeBulletPoints: [],
            nextSteps: [],
            actionVerbs: [],
        };
    }
    const fallbackKeywords = pickKeywordMatches(resumeText, jobText);
    const fallbackBullets = buildFallbackBulletPoints({
        matchedKeywords: fallbackKeywords.matchedKeywords,
        missingKeywords: fallbackKeywords.missingKeywords,
        gaps: parsed.gaps,
    });

    const matchedKeywords = parsed.matchedKeywords.length ? parsed.matchedKeywords : fallbackKeywords.matchedKeywords;
    const missingKeywords = parsed.missingKeywords.length ? parsed.missingKeywords : fallbackKeywords.missingKeywords;
    const resumeBulletPoints =
        parsed.resumeBulletPoints.length >= 5 && parsed.matchScore > 60
            ? parsed.resumeBulletPoints
            : dedupeList([...parsed.resumeBulletPoints, ...fallbackBullets]).slice(0, 8);
    const scoreBreakdown = computeScoreBreakdown({
        resumeText,
        matchedKeywords,
        missingKeywords,
        resumeBulletPoints,
    });
    const normalizedMatchScore = parsed.matchScore > 0 ? parsed.matchScore : Math.round(
        (scoreBreakdown.keywordCoverage * 0.45) +
        (scoreBreakdown.impact * 0.25) +
        (scoreBreakdown.clarity * 0.15) +
        (scoreBreakdown.roleFit * 0.15)
    );
    const gaps = parsed.gaps.length ? parsed.gaps : buildFallbackGaps({
        missingKeywords,
        matchedKeywords,
    });
    const nextSteps = parsed.nextSteps.length
        ? parsed.nextSteps
        : buildFallbackNextSteps({
            missingKeywords,
            gaps,
            resumeBulletPoints,
        });
    const resumeHeadline = parsed.resumeHeadline || buildResumeHeadline({
        matchedKeywords,
        missingKeywords,
        resumeText,
    });
    const atsReadiness = parsed.atsReadiness || buildAtsReadiness({
        matchScore: normalizedMatchScore,
        missingKeywords,
        resumeBulletPoints,
    });
    const actionVerbs = parsed.actionVerbs.length ? parsed.actionVerbs : buildActionVerbs({
        matchedKeywords,
        missingKeywords,
    });

    return {
        fileName,
        matchScore: normalizedMatchScore,
        summary: parsed.summary && !looksLikeStructuredNoise(parsed.summary) ? parsed.summary : buildLocalSummary({
            matchScore: normalizedMatchScore,
            resumeHeadline,
            atsReadiness,
            matchedKeywords,
            missingKeywords,
        }),
        strengths: parsed.strengths.length ? parsed.strengths : buildLocalStrengths({
            matchedKeywords,
            resumeText,
        }),
        gaps,
        matchedKeywords,
        missingKeywords,
        resumeBulletPoints,
        nextSteps,
        resumeHeadline,
        atsReadiness,
        scoreBreakdown,
        actionVerbs,
    };
}

module.exports = analyzeResumeBuffer;
