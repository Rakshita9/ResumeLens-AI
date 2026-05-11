# AI Resume Analyzer

An AI-powered resume analyzer that compares a PDF resume with a job description and returns ATS-style insights, keyword matching, resume bullets, score breakdowns, and improvement suggestions.

## Features

- Upload a resume as PDF
- Paste a job description
- Extract resume text from PDF
- Compare resume content with the job description
- Generate:
  - match score
  - ATS readiness
  - resume headline
  - score breakdown
  - matched and missing keywords
  - strengths and gaps
  - resume bullet suggestions
  - next steps
  - action verbs
- Beautiful single-page UI served from the backend
- Gemini AI integration with graceful fallback logic when the model is rate-limited or returns incomplete output

## Tech Stack

- Node.js
- Express
- Google Gemini API
- pdf-parse
- multer
- dotenv
- HTML, CSS, and JavaScript for the frontend

## Project Structure

```text
server/
  app.js
  package.json
  public/
    frontendApp.js
    index.html
    styles.css
  routes/
    analyzeRoute.js
    testRoute.js
  services/
    geminiService.js
    resumeAnalysisService.js
  uploads/
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add environment variables

Create a `.env` file in the `server` folder and add:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=5000
```

If `GEMINI_MODEL` is not set, the app will use a supported default model automatically.

### 3. Start the app

```bash
npm start
```

The app will run on `http://localhost:5000`.

## Available Scripts

- `npm start` - start the server with nodemon

## API Endpoints

### GET `/api/test-ai`

Simple Gemini test endpoint.

### POST `/api/analyze-resume`

Analyzes a PDF resume against a job description.

#### Form fields

- `resume` - PDF file
- `jobDescription` - plain text job description

#### Example response

```json
{
  "success": true,
  "fileName": "resume.pdf",
  "matchScore": 85,
  "summary": "...",
  "strengths": [],
  "gaps": [],
  "matchedKeywords": [],
  "missingKeywords": [],
  "resumeBulletPoints": [],
  "nextSteps": [],
  "resumeHeadline": "...",
  "atsReadiness": "Good with targeted edits",
  "scoreBreakdown": {
    "keywordCoverage": 0,
    "impact": 0,
    "clarity": 0,
    "roleFit": 0
  },
  "actionVerbs": []
}
```

## How It Works

1. The user uploads a PDF resume and pastes a job description.
2. The backend extracts text from the PDF.
3. The resume and job description are sent to Gemini for analysis.
4. If Gemini is rate-limited or returns incomplete data, the backend builds local fallback results.
5. The frontend renders the analysis in a styled dashboard.



### Deployment steps

1. Push the project to GitHub.
2. Connect the repo to your deployment platform.
3. Set the app root to the `server` folder.
4. Set the build/install command to `npm install`.
5. Set the start command to `npm start`.
6. Add environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` if needed
   - `PORT` if your platform requires it

## Notes

- The app has fallback logic so it still returns useful analysis when Gemini is rate-limited.
- The summary card and result cards are designed to scroll inside fixed-size panels.
- The UI is fully served from the backend, so no separate frontend deployment is needed.
