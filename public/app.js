const form = document.getElementById("analysisForm");
const resumeInput = document.getElementById("resumeFile");
const dropzone = document.getElementById("dropzone");
const fileName = document.getElementById("fileName");
const fileLabel = document.getElementById("fileLabel");
const scoreValue = document.getElementById("scoreValue");
const statusText = document.getElementById("statusText");
const summaryText = document.getElementById("summaryText");
const atsReadinessText = document.getElementById("atsReadinessText");
const headlineText = document.getElementById("headlineText");
const keywordCoverageText = document.getElementById("keywordCoverageText");
const analysisSourceText = document.getElementById("analysisSourceText");
const analysisConfidenceText = document.getElementById("analysisConfidenceText");
const strengthList = document.getElementById("strengthList");
const gapList = document.getElementById("gapList");
const missingKeywordsList = document.getElementById("missingKeywordsList");
const matchedKeywordsList = document.getElementById("matchedKeywordsList");
const bulletList = document.getElementById("bulletList");
const actionVerbsList = document.getElementById("actionVerbsList");
const scoreBreakdown = document.getElementById("scoreBreakdown");
const nextStepsList = document.getElementById("nextStepsList");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function renderList(target, items, emptyLabel) {
    target.innerHTML = "";

    if (!items || !items.length) {
        const li = document.createElement("li");
        li.textContent = emptyLabel;
        target.appendChild(li);
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        target.appendChild(li);
    });
}

function renderChips(target, items, emptyLabel) {
    target.innerHTML = "";

    if (!items || !items.length) {
        const li = document.createElement("li");
        li.textContent = emptyLabel;
        target.appendChild(li);
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        target.appendChild(li);
    });
}

function renderScoreBars(target, breakdown) {
    target.innerHTML = "";

    const entries = breakdown || {};
    const labels = [
        ["keywordCoverage", "Keyword Coverage"],
        ["techFit", "Tech Fit"],
        ["impact", "Impact"],
        ["clarity", "Clarity"],
        ["roleFit", "Role Fit"],
        ["evidence", "Evidence"],
    ];

    labels.forEach(([key, label]) => {
        const value = Math.max(0, Math.min(100, Number(entries[key] || 0)));
        const row = document.createElement("div");
        row.className = "metric-row";
        row.innerHTML = `
            <div class="metric-row__head">
                <span>${label}</span>
                <strong>${value}%</strong>
            </div>
            <div class="metric-track"><div class="metric-fill" style="width:${value}%"></div></div>
        `;
        target.appendChild(row);
    });
}

function updateSelectedFile(file) {
    fileName.textContent = file ? file.name : "No file selected";
}

resumeInput.addEventListener("change", () => {
    updateSelectedFile(resumeInput.files[0]);
});

dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
});

dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
});

dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");

    const file = event.dataTransfer.files[0];
    if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        resumeInput.files = transfer.files;
        updateSelectedFile(file);
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = resumeInput.files[0];
    const jobDescription = document.getElementById("jobDescription").value.trim();

    if (!file) {
        showToast("Please upload a PDF resume.");
        return;
    }

    if (!jobDescription) {
        showToast("Please paste a job description.");
        return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescription", jobDescription);

    submitBtn.disabled = true;
    submitBtn.textContent = "Analyzing...";
    statusText.textContent = "Extracting the PDF and comparing it with the job description...";

    try {
        const response = await fetch("/api/analyze-resume", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Analysis failed.");
        }

        scoreValue.textContent = `${data.matchScore || 0}`;
        statusText.textContent = data.analysisConfidence?.note || "Analysis complete.";
        fileLabel.textContent = data.fileName || file.name;
        summaryText.textContent = data.summary || "No summary available.";
        atsReadinessText.textContent = data.atsReadiness || "--";
        headlineText.textContent = data.resumeHeadline || "No headline generated.";
        keywordCoverageText.textContent = `${data.scoreBreakdown?.keywordCoverage ?? 0}%`;
        analysisSourceText.textContent = data.analysisSource === "fallback" ? "Fallback" : "Gemini";
        analysisConfidenceText.textContent = data.analysisConfidence?.level || "--";
        renderScoreBars(scoreBreakdown, data.scoreBreakdown);
        renderList(strengthList, data.strengths, "No strengths returned.");
        renderList(gapList, data.gaps, "No gaps returned.");
        renderChips(missingKeywordsList, data.missingKeywords, "No missing keywords returned.");
        renderChips(matchedKeywordsList, data.matchedKeywords, "No matched keywords returned.");
        renderList(bulletList, data.resumeBulletPoints, "No bullet points returned.");
        renderChips(actionVerbsList, data.actionVerbs, "No action verbs returned.");
        renderList(nextStepsList, data.nextSteps, "No next steps returned.");
        showToast("Resume analyzed successfully.");
    } catch (error) {
        console.error(error);
        statusText.textContent = "Analysis failed.";
        showToast(error.message || "Unable to analyze resume.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Analyze Resume";
    }
});
