const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config();
console.log("KEY EXISTS:", !!process.env.GEMINI_API_KEY);

const testRoute = require("./routes/testRoute");
const analyzeRoute = require("./routes/analyzeRoute");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", testRoute);
app.use("/api", analyzeRoute);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});