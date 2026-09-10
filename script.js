/* =========================================================
   DRIFTLENS
   "See the drift before production sees it."
   ========================================================= */

let selectedFiles = [];
let projectRecords = [];
let scanResults = {
    findings: [],
    usedKeys: [],
    environments: {},
    errors: [],
    dependencies: [],
    stats: {}
};

let currentFilter = "all";
let currentSection = "dashboard";
let selectedFindingIndex = null;

const ENVIRONMENTS = ["development", "staging", "production"];

const ENV_LABELS = {
    development: "DEV",
    staging: "STAGING",
    production: "PROD"
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getExtension(path) {
    const clean = path.split("?")[0];
    const parts = clean.split(".");
    return parts.length > 1 ? "." + parts.pop().toLowerCase() : "";
}

function getFileName(path) {
    return path.split("/").pop();
}

function getLineNumber(content, index) {
    return content.slice(0, index).split("\n").length;
}

function isCodeFile(path) {
    return [
        ".js", ".jsx", ".ts", ".tsx",
        ".py",
        ".java",
        ".c", ".cpp", ".h", ".hpp"
    ].includes(getExtension(path));
}

function isConfigFile(path) {
    const name = getFileName(path).toLowerCase();

    return (
        name.startsWith(".env") ||
        [".json", ".yaml", ".yml", ".properties"].includes(getExtension(path))
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/* =========================================================
   SECTION NAVIGATION
   ========================================================= */

function showSection(sectionId, button) {

    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    const target = $(sectionId);

    if (target) {
        target.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }

    currentSection = sectionId;

    const titles = {
        dashboard: [
            "Project Dashboard",
            "Monitor configuration health across environments."
        ],

        scanner: [
            "Drift Scanner",
            "Detect missing, orphaned and type-mismatch configuration."
        ],

        predictor: [
            "Failure Predictor",
            "Understand what may happen if the current drift reaches production."
        ],

        detective: [
            "Drift Detective",
            "Trace a configuration problem back to its root cause."
        ],

        dependency: [
            "Dependency Map",
            "Visualize code, configuration keys and environments."
        ],

        history: [
            "Scan History",
            "Track previous scans and automatically identify resolved drift."
        ],

        security: [
            "Secret Safety",
            "Configuration analysis without exposing secret values."
        ]
    };

    if (titles[sectionId]) {
        $("pageTitle").textContent = titles[sectionId][0];
        $("pageSubtitle").textContent = titles[sectionId][1];
    }
}


/* =========================================================
   UPLOAD MODAL
   ========================================================= */

function openUpload() {
    $("uploadModal").classList.add("show");
}

function closeUpload() {
    $("uploadModal").classList.remove("show");
}

function handleFiles(files) {

    selectedFiles = Array.from(files);

    const container = $("selectedFiles");

    if (!container) return;

    if (selectedFiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No files selected
            </div>
        `;
        $("startScanModalBtn").disabled = true;
        return;
    }

    container.innerHTML = selectedFiles.map(file => `
        <div class="selected-file">
            <span>📄 ${escapeHTML(file.name)}</span>
            <small>${formatBytes(file.size)}</small>
        </div>
    `).join("");

    $("startScanModalBtn").disabled = false;
}

function formatBytes(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}


/* =========================================================
   START SCAN
   ========================================================= */

function startScan() {

    if (selectedFiles.length === 0) {
        openUpload();
        return;
    }

    startRealScan();
}

$("startScanModalBtn").addEventListener("click", startRealScan);

async function startRealScan() {

    if (selectedFiles.length === 0) {
        return;
    }

    closeUpload();

    $("scanModal").classList.add("show");

    updateScanProgress(
        5,
        "Preparing project...",
        "Reading uploaded files"
    );

    await sleep(400);

    try {

        projectRecords = [];

        updateScanProgress(
            15,
            "Reading project...",
            "Inspecting source and configuration files"
        );

        for (const file of selectedFiles) {

            if (file.name.toLowerCase().endsWith(".zip")) {

                await readZipFile(file);

            } else {

                const text = await file.text();

                projectRecords.push({
                    path: file.name,
                    content: text,
                    size: file.size
                });
            }
        }

        await sleep(400);

        updateScanProgress(
            35,
            "Detecting configuration...",
            "Finding environment sources and configuration keys"
        );

        await sleep(500);

        updateScanProgress(
            55,
            "Tracing dependencies...",
            "Connecting code references with configuration"
        );

        scanResults = analyzeProject(projectRecords);

        await sleep(500);

        updateScanProgress(
            72,
            "Detecting drift...",
            "Checking missing, orphaned and type-mismatch keys"
        );

        await sleep(500);

        updateScanProgress(
            88,
            "Predicting failures...",
            "Running deployment risk analysis"
        );

        calculatePredictions();

        await sleep(400);

        updateScanProgress(
            100,
            "Scan complete!",
            "DRIFTLENS analysis finished"
        );

        await sleep(700);

        $("scanModal").classList.remove("show");

        renderEverything();

        showSection("dashboard");

        createPreDeployButton();

    } catch (error) {

        console.error(error);

        updateScanProgress(
            100,
            "Scan failed",
            "The uploaded project could not be completely analyzed."
        );

        setTimeout(() => {
            $("scanModal").classList.remove("show");
        }, 1500);
    }
}


/* =========================================================
   SCAN MODAL PROGRESS
   ========================================================= */

function updateScanProgress(percent, title, message) {

    if ($("scanTitle")) {
        $("scanTitle").textContent = title;
    }

    if ($("scanMessage")) {
        $("scanMessage").textContent = message;
    }

    if ($("progressBar")) {
        $("progressBar").style.width = percent + "%";
    }

    if ($("progressText")) {
        $("progressText").textContent = percent + "%";
    }
}


/* =========================================================
   ZIP SUPPORT
   ========================================================= */

async function loadJSZip() {

    if (window.JSZip) {
        return;
    }

    await new Promise((resolve, reject) => {

        const script = document.createElement("script");

        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

        script.onload = resolve;
        script.onerror = reject;

        document.head.appendChild(script);
    });
}

async function readZipFile(file) {

    try {

        await loadJSZip();

        const zip = await JSZip.loadAsync(file);

        const entries = Object.values(zip.files);

        for (const entry of entries) {

            if (entry.dir) continue;

            const path = entry.name;

            if (
                path.includes("node_modules/") ||
                path.includes(".git/") ||
                path.includes("dist/") ||
                path.includes("build/")
            ) {
                continue;
            }

            const ext = getExtension(path);

            const supported = [
                ".js", ".jsx", ".ts", ".tsx",
                ".py",
                ".java",
                ".c", ".cpp", ".h", ".hpp",
                ".env",
                ".json",
                ".yaml", ".yml",
                ".properties",
                ".txt"
            ];

            if (!supported.includes(ext) && !getFileName(path).startsWith(".env")) {
                continue;
            }

            try {

                const content = await entry.async("text");

                projectRecords.push({
                    path,
                    content,
                    size: content.length
                });

            } catch (error) {
                console.warn("Could not read:", path);
            }
        }

    } catch (error) {

        console.warn("ZIP parser unavailable.", error);

        throw new Error(
            "ZIP could not be inspected. Try uploading the project files directly."
        );
    }
}


/* =========================================================
   MAIN ANALYZER
   ========================================================= */

function analyzeProject(records) {

    const usedKeys = [];
    const configDefinitions = [];
    const errors = [];
    const dependencies = [];

    for (const record of records) {

        const path = record.path;
        const content = record.content;

        /* CODE SCANNING */

        if (isCodeFile(path)) {

            const references = extractUsedKeys(content, path);

            references.forEach(ref => {

                usedKeys.push(ref);

                dependencies.push({
                    file: path,
                    key: ref.key,
                    line: ref.line
                });
            });

            errors.push(
                ...detectCodeErrors(content, path)
            );
        }

        /* CONFIG SCANNING */

        if (isConfigFile(path)) {

            const result = parseConfigFile(
                content,
                path
            );

            configDefinitions.push(
                ...result.definitions
            );

            errors.push(
                ...result.errors
            );
        }
    }

    const environments = buildEnvironmentMap(
        configDefinitions
    );

    const findings = detectDrift(
        usedKeys,
        configDefinitions,
        environments
    );

    /* CONFIG ERRORS BECOME FINDINGS */

    errors.forEach(error => {

        findings.push({
            id: "ERR-" + Math.random().toString(36).slice(2, 8),
            type: "error",
            severity: error.severity || "critical",
            title: error.title,
            key: error.key || "",
            file: error.file,
            line: error.line,
            message: error.message,
            environment: error.environment || "",
            suggestion: error.suggestion || "Review the configuration syntax."
        });
    });

    const stats = calculateStats(
        findings,
        records,
        usedKeys,
        environments
    );

    return {
        findings,
        usedKeys,
        environments,
        errors,
        dependencies,
        stats
    };
}


/* =========================================================
   EXTRACT CODE CONFIG REFERENCES
   ========================================================= */

function extractUsedKeys(content, path) {

    const references = [];

    const patterns = [

        /* JavaScript / TypeScript */

        {
            regex: /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
            type: "process.env"
        },

        {
            regex: /process\.env\[['"]([^'"]+)['"]\]/g,
            type: "process.env"
        },

        {
            regex: /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
            type: "import.meta.env"
        },

        /* Python */

        {
            regex: /os\.getenv\(\s*['"]([^'"]+)['"]/g,
            type: "os.getenv"
        },

        {
            regex: /os\.environ\[['"]([^'"]+)['"]\]/g,
            type: "os.environ"
        },

        {
            regex: /os\.environ\.get\(\s*['"]([^'"]+)['"]/g,
            type: "os.environ.get"
        },

        /* Java / C / C++ */

        {
            regex: /System\.getenv\(\s*["']([^"']+)["']\s*\)/g,
            type: "System.getenv"
        },

        {
            regex: /getenv\(\s*["']([^"']+)["']\s*\)/g,
            type: "getenv"
        },

        /* Generic config access */

        {
            regex: /config\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g,
            type: "config"
        },

        {
            regex: /config\.get\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
            type: "config.get"
        }
    ];

    patterns.forEach(pattern => {

        let match;

        while ((match = pattern.regex.exec(content)) !== null) {

            const key = match[1];

            references.push({
                key,
                file: path,
                line: getLineNumber(
                    content,
                    match.index
                ),
                source: pattern.type
            });
        }
    });

    return uniqueReferences(references);
}

function uniqueReferences(references) {

    const seen = new Set();
    const result = [];

    references.forEach(ref => {

        const signature =
            `${ref.file}|${ref.line}|${ref.key}`;

        if (!seen.has(signature)) {

            seen.add(signature);
            result.push(ref);
        }
    });

    return result;
}


/* =========================================================
   CONFIG PARSERS
   ========================================================= */

function parseConfigFile(content, path) {

    const definitions = [];
    const errors = [];

    const name = getFileName(path).toLowerCase();
    const ext = getExtension(path);

    if (name.startsWith(".env")) {

        parseEnvFile(
            content,
            path,
            definitions,
            errors
        );

    } else if (ext === ".json") {

        parseJSONFile(
            content,
            path,
            definitions,
            errors
        );

    } else if (
        ext === ".yaml" ||
        ext === ".yml"
    ) {

        parseYAMLFile(
            content,
            path,
            definitions,
            errors
        );

    } else if (ext === ".properties") {

        parsePropertiesFile(
            content,
            path,
            definitions,
            errors
        );
    }

    return {
        definitions,
        errors
    };
}


/* =========================================================
   ENV FILE
   ========================================================= */

function parseEnvFile(
    content,
    path,
    definitions,
    errors
) {

    const lines = content.split(/\r?\n/);

    lines.forEach((rawLine, index) => {

        const line = rawLine.trim();

        if (
            !line ||
            line.startsWith("#")
        ) {
            return;
        }

        const match =
            line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

        if (!match) {

            errors.push({
                severity: "critical",
                title: "Malformed environment entry",
                file: path,
                line: index + 1,
                message:
                    "Environment configuration contains an invalid KEY=VALUE structure.",
                suggestion:
                    "Use a valid KEY=VALUE format without exposing the actual value."
            });

            return;
        }

        const key = match[1];
        const rawValue = match[2].trim();

        definitions.push({
            key,
            file: path,
            line: index + 1,
            environment: detectEnvironment(path),
            type: inferValueType(rawValue)
        });
    });
}


/* =========================================================
   JSON
   ========================================================= */

function parseJSONFile(
    content,
    path,
    definitions,
    errors
) {

    let data;

    try {

        data = JSON.parse(content);

    } catch (error) {

        errors.push({
            severity: "critical",
            title: "Invalid JSON configuration",
            file: path,
            line: getJSONErrorLine(error, content),
            message:
                "JSON configuration cannot be parsed successfully.",
            suggestion:
                "Fix the JSON syntax before deployment."
        });

        return;
    }

    flattenObject(
        data,
        "",
        path,
        detectEnvironment(path),
        definitions
    );
}

function flattenObject(
    object,
    prefix,
    path,
    environment,
    definitions
) {

    if (
        object === null ||
        typeof object !== "object"
    ) {

        if (prefix) {

            definitions.push({
                key: prefix,
                file: path,
                line: 1,
                environment,
                type: inferValueTypeFromJS(object)
            });
        }

        return;
    }

    Object.keys(object).forEach(key => {

        const fullKey =
            prefix ? `${prefix}.${key}` : key;

        const value = object[key];

        if (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        ) {

            flattenObject(
                value,
                fullKey,
                path,
                environment,
                definitions
            );

        } else {

            definitions.push({
                key: fullKey,
                file: path,
                line: 1,
                environment,
                type: inferValueTypeFromJS(value)
            });
        }
    });
}

function getJSONErrorLine(error, content) {

    const match = String(error.message)
        .match(/position\s+(\d+)/i);

    if (!match) {
        return 1;
    }

    return getLineNumber(
        content,
        Number(match[1])
    );
}


/* =========================================================
   YAML
   ========================================================= */

function parseYAMLFile(
    content,
    path,
    definitions,
    errors
) {

    const lines = content.split(/\r?\n/);

    let foundConfig = false;

    lines.forEach((rawLine, index) => {

        const line = rawLine.trim();

        if (
            !line ||
            line.startsWith("#") ||
            line.startsWith("-")
        ) {
            return;
        }

        const match =
            line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/);

        if (!match) {
            return;
        }

        foundConfig = true;

        const key = match[1];
        const value = match[2].trim();

        if (!value) {
            return;
        }

        definitions.push({
            key,
            file: path,
            line: index + 1,
            environment: detectEnvironment(path),
            type: inferValueType(value)
        });
    });

    if (
        !foundConfig &&
        content.trim().length > 0
    ) {

        errors.push({
            severity: "warning",
            title: "Unable to identify YAML configuration",
            file: path,
            line: 1,
            message:
                "The YAML file does not contain recognizable key-value configuration.",
            suggestion:
                "Check YAML structure and indentation."
        });
    }
}


/* =========================================================
   PROPERTIES
   ========================================================= */

function parsePropertiesFile(
    content,
    path,
    definitions,
    errors
) {

    const lines = content.split(/\r?\n/);

    lines.forEach((rawLine, index) => {

        const line = rawLine.trim();

        if (
            !line ||
            line.startsWith("#") ||
            line.startsWith("!")
        ) {
            return;
        }

        const match =
            line.match(/^([^:=\s]+)\s*[:=]\s*(.*)$/);

        if (!match) {

            errors.push({
                severity: "warning",
                title: "Malformed properties entry",
                file: path,
                line: index + 1,
                message:
                    "Configuration property does not follow a recognized key/value format.",
                suggestion:
                    "Check the property separator and key syntax."
            });

            return;
        }

        definitions.push({
            key: match[1],
            file: path,
            line: index + 1,
            environment: detectEnvironment(path),
            type: inferValueType(match[2])
        });
    });
}


/* =========================================================
   ENVIRONMENT DETECTION
   ========================================================= */

function detectEnvironment(path) {

    const value = path.toLowerCase();

    if (
        value.includes("production") ||
        value.includes("prod")
    ) {
        return "production";
    }

    if (
        value.includes("staging") ||
        value.includes("stage")
    ) {
        return "staging";
    }

    if (
        value.includes("development") ||
        value.includes("develop") ||
        value.includes("dev")
    ) {
        return "development";
    }

    /*
       Generic .env is treated as development
       because the environment is not explicit.
    */

    return "development";
}


/* =========================================================
   TYPE INFERENCE
   ========================================================= */

function inferValueType(value) {

    const clean = String(value)
        .trim()
        .replace(/^['"]|['"]$/g, "");

    if (/^(true|false)$/i.test(clean)) {
        return "boolean";
    }

    if (
        /^-?\d+(\.\d+)?$/.test(clean)
    ) {
        return "number";
    }

    if (
        (
            clean.startsWith("{") &&
            clean.endsWith("}")
        ) ||
        (
            clean.startsWith("[") &&
            clean.endsWith("]")
        )
    ) {
        return "json/object";
    }

    if (!clean) {
        return "unknown";
    }

    return "string";
}

function inferValueTypeFromJS(value) {

    if (typeof value === "boolean") {
        return "boolean";
    }

    if (typeof value === "number") {
        return "number";
    }

    if (Array.isArray(value)) {
        return "json/object";
    }

    if (value !== null && typeof value === "object") {
        return "json/object";
    }

    if (typeof value === "string") {
        return "string";
    }

    return "unknown";
}


/* =========================================================
   ENVIRONMENT MAP
   ========================================================= */

function buildEnvironmentMap(definitions) {

    const result = {
        development: {},
        staging: {},
        production: {}
    };

    definitions.forEach(def => {

        if (!result[def.environment]) {
            result[def.environment] = {};
        }

        if (!result[def.environment][def.key]) {

            result[def.environment][def.key] = [];
        }

        result[def.environment][def.key].push(def);
    });

    return result;
}


/* =========================================================
   DRIFT DETECTION
   ========================================================= */

function detectDrift(
    usedKeys,
    definitions,
    environments
) {

    const findings = [];

    const uniqueKeys = [
        ...new Set(
            usedKeys.map(item => item.key)
        )
    ];

    const envsWithConfig =
        ENVIRONMENTS.filter(env =>
            Object.keys(environments[env]).length > 0
        );

    /* -----------------------------------------
       MISSING
       ----------------------------------------- */

    uniqueKeys.forEach(key => {

        const references =
            usedKeys.filter(item =>
                item.key === key
            );

        const missingEnvs =
            envsWithConfig.filter(env =>
                !environments[env][key]
            );

        if (
            missingEnvs.length > 0 &&
            envsWithConfig.length > 0
        ) {

            const firstRef = references[0];

            findings.push({
                id: createFindingId("MISS"),
                type: "missing",
                severity:
                    missingEnvs.length >= 2
                        ? "critical"
                        : "warning",
                title: `Missing configuration: ${key}`,
                key,
                file: firstRef.file,
                line: firstRef.line,
                message:
                    `Code references ${key}, but the key is missing from ${missingEnvs.map(e => ENV_LABELS[e]).join(", ")}.`,
                environment:
                    missingEnvs.join(", "),
                suggestion:
                    `Add ${key} to the required environment configuration sources without exposing its value.`
            });
        }
    });


    /* -----------------------------------------
       ORPHANED
       ----------------------------------------- */

    const usedKeySet =
        new Set(uniqueKeys);

    definitions.forEach(def => {

        if (!usedKeySet.has(def.key)) {

            findings.push({
                id: createFindingId("ORPH"),
                type: "orphaned",
                severity: "warning",
                title: `Orphaned configuration: ${def.key}`,
                key: def.key,
                file: def.file,
                line: def.line,
                message:
                    `${def.key} is defined in ${ENV_LABELS[def.environment]} but no matching code reference was detected.`,
                environment:
                    def.environment,
                suggestion:
                    "Verify whether this configuration is still required. Remove it only after confirming it is unused."
            });
        }
    });


    /* -----------------------------------------
       TYPE MISMATCH
       ----------------------------------------- */

    const grouped = {};

    definitions.forEach(def => {

        if (!grouped[def.key]) {
            grouped[def.key] = [];
        }

        grouped[def.key].push(def);
    });

    Object.keys(grouped).forEach(key => {

        const defs = grouped[key];

        const types = [
            ...new Set(
                defs.map(item => item.type)
            )
        ];

        if (types.length > 1) {

            const first = defs[0];

            findings.push({
                id: createFindingId("TYPE"),
                type: "type-mismatch",
                severity: "critical",
                title: `Type mismatch: ${key}`,
                key,
                file: first.file,
                line: first.line,
                message:
                    `${key} has different inferred types across environments: ${types.join(", ")}.`,
                environment:
                    defs.map(item =>
                        ENV_LABELS[item.environment]
                    ).join(", "),
                suggestion:
                    "Make the configuration type consistent across environments."
            });
        }
    });

    return removeDuplicateFindings(findings);
}

function removeDuplicateFindings(findings) {

    const seen = new Set();
    const result = [];

    findings.forEach(finding => {

        const signature =
            `${finding.type}|${finding.key}|${finding.file}|${finding.line}|${finding.environment}`;

        if (!seen.has(signature)) {

            seen.add(signature);
            result.push(finding);
        }
    });

    return result;
}

function createFindingId(prefix) {

    return (
        prefix +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()
    );
}


/* =========================================================
   CODE ERROR DETECTOR
   ========================================================= */

function detectCodeErrors(content, path) {

    const errors = [];

    const lines = content.split(/\r?\n/);

    /* -----------------------------------------
       Basic bracket balance
       ----------------------------------------- */

    const stack = [];

    const pairs = {
        ")": "(",
        "]": "[",
        "}": "{"
    };

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = 0; i < content.length; i++) {

        const char = content[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (
            char === "'" &&
            !inDoubleQuote &&
            !inTemplate
        ) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (
            char === '"' &&
            !inSingleQuote &&
            !inTemplate
        ) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (
            char === "`" &&
            !inSingleQuote &&
            !inDoubleQuote
        ) {
            inTemplate = !inTemplate;
            continue;
        }

        if (
            inSingleQuote ||
            inDoubleQuote ||
            inTemplate
        ) {
            continue;
        }

        if (
            char === "(" ||
            char === "[" ||
            char === "{"
        ) {
            stack.push({
                char,
                index: i
            });
        }

        if (
            char === ")" ||
            char === "]" ||
            char === "}"
        ) {

            if (
                !stack.length ||
                stack[stack.length - 1].char !== pairs[char]
            ) {

                errors.push({
                    severity: "critical",
                    title: "Possible syntax error",
                    file: path,
                    line: getLineNumber(content, i),
                    message:
                        `Unexpected closing symbol "${char}" detected.`,
                    suggestion:
                        "Check the surrounding brackets before deployment."
                });

                return errors;
            }

            stack.pop();
        }
    }

    if (
        !inSingleQuote &&
        !inDoubleQuote &&
        !inTemplate &&
        stack.length > 0
    ) {

        const item = stack[stack.length - 1];

        errors.push({
            severity: "critical",
            title: "Possible syntax error",
            file: path,
            line: getLineNumber(content, item.index),
            message:
                `An opening "${item.char}" does not appear to have a matching closing symbol.`,
            suggestion:
                "Check bracket balance in this file."
        });
    }


    /* -----------------------------------------
       Obvious JavaScript typo
       ----------------------------------------- */

    lines.forEach((line, index) => {

        if (
            /\bconst\s+[A-Za-z_$][\w$]*\s*$/.test(line.trim())
        ) {

            errors.push({
                severity: "warning",
                title: "Incomplete declaration",
                file: path,
                line: index + 1,
                message:
                    "A variable declaration appears to be incomplete.",
                suggestion:
                    "Check the declaration before deployment."
            });
        }
    });

    return errors;
}


/* =========================================================
   STATISTICS
   ========================================================= */

function calculateStats(
    findings,
    records,
    usedKeys,
    environments
) {

    const critical =
        findings.filter(
            f => f.severity === "critical"
        ).length;

    const warnings =
        findings.filter(
            f => f.severity === "warning"
        ).length;

    const keys =
        new Set(
            usedKeys.map(item => item.key)
        ).size;

    const languages =
        detectLanguages(records);

    return {
        critical,
        warnings,
        total: findings.length,
        files: records.length,
        keys,
        languages
    };
}

function detectLanguages(records) {

    const languages = new Set();

    records.forEach(record => {

        const ext = getExtension(record.path);

        if (
            [".js", ".jsx", ".ts", ".tsx"].includes(ext)
        ) {
            languages.add("JavaScript / TypeScript");
        }

        if (ext === ".py") {
            languages.add("Python");
        }

        if (ext === ".java") {
            languages.add("Java");
        }

        if (
            [".c", ".cpp", ".h", ".hpp"].includes(ext)
        ) {
            languages.add("C / C++");
        }
    });

    return [...languages];
}


/* =========================================================
   RISK SCORE
   ========================================================= */

function calculateRiskScore() {

    let score = 0;

    scanResults.findings.forEach(finding => {

        if (finding.type === "missing") {
            score += 25;
        }

        else if (finding.type === "type-mismatch") {
            score += 20;
        }

        else if (finding.type === "error") {
            score += 20;
        }

        else if (finding.type === "orphaned") {
            score += 5;
        }
    });

    return Math.min(100, score);
}

function getRiskLabel(score) {

    if (score >= 70) {
        return "HIGH RISK";
    }

    if (score >= 40) {
        return "MEDIUM RISK";
    }

    if (score > 0) {
        return "LOW RISK";
    }

    return "HEALTHY";
}


/* =========================================================
   PREDICTION ENGINE
   ========================================================= */

function calculatePredictions() {

    const findings =
        scanResults.findings;

    let prediction;

    const missing =
        findings.filter(
            f => f.type === "missing"
        );

    const mismatch =
        findings.filter(
            f => f.type === "type-mismatch"
        );

    const errors =
        findings.filter(
            f => f.type === "error"
        );

    if (errors.length > 0) {

        prediction = {
            title: "Deployment may fail",
            problem:
                `${errors.length} configuration or syntax issue(s) were detected.`,
            impact:
                "The application may fail during configuration loading, startup or deployment.",
            result: "BLOCKED",
            severity: "critical"
        };

    } else if (missing.length > 0) {

        prediction = {
            title: "Runtime failure is likely",
            problem:
                `${missing.length} configuration reference(s) are missing from one or more environments.`,
            impact:
                "The application may start with incomplete configuration or fail when the affected code path executes.",
            result: "HIGH RISK",
            severity: "critical"
        };

    } else if (mismatch.length > 0) {

        prediction = {
            title: "Environment behaviour may differ",
            problem:
                `${mismatch.length} configuration key(s) have inconsistent types.`,
            impact:
                "The same application logic may behave differently across environments.",
            result: "WARNING",
            severity: "warning"
        };

    } else {

        prediction = {
            title: "Deployment looks healthy",
            problem:
                "No high-impact configuration drift was detected.",
            impact:
                "The scanned project has no obvious drift that would block deployment.",
            result: "READY",
            severity: "safe"
        };
    }

    scanResults.prediction = prediction;
}


/* =========================================================
   PREDICTION UI
   ========================================================= */

function runPrediction() {

    calculatePredictions();

    const prediction =
        scanResults.prediction;

    $("predictionTitle").textContent =
        prediction.title;

    $("predictionText").textContent =
        "DRIFTLENS uses the detected configuration relationships to estimate deployment impact.";

    $("predictionProblem").textContent =
        prediction.problem;

    $("predictionImpact").textContent =
        prediction.impact;

    $("predictionResult").textContent =
        prediction.result;

    const score =
        calculateRiskScore();

    $("simulationResult").innerHTML = `
        <div class="simulation-box">
            <strong>What-If Deployment Simulation</strong>
            <p>
                If the current project is deployed with the detected drift,
                the estimated configuration risk is <b>${score}/100</b>.
            </p>
            <p>
                Predicted outcome:
                <b>${escapeHTML(prediction.result)}</b>
            </p>
        </div>
    `;
}


/* =========================================================
   FINDING FILTER
   ========================================================= */

function filterFindings(type, thisButton) {

    currentFilter = type;

    document
        .querySelectorAll(".filter-btn")
        .forEach(button => {
            button.classList.remove("active");
        });

    if (thisButton) {
        thisButton.classList.add("active");
    }

    renderFindings();
}


/* =========================================================
   FINDINGS UI
   ========================================================= */

function renderFindings() {

    const container = $("findings");

    if (!container) return;

    let findings =
        scanResults.findings;

    if (currentFilter !== "all") {

        findings =
            findings.filter(
                finding =>
                    finding.type === currentFilter
            );
    }

    if (findings.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <h3>No findings</h3>
                <p>DRIFTLENS did not find issues for this filter.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        findings.map((finding, index) => {

            const originalIndex =
                scanResults.findings.indexOf(finding);

            return `
                <div class="finding-card ${escapeHTML(finding.severity)}">

                    <div class="finding-top">

                        <span class="finding-type">
                            ${formatFindingType(finding.type)}
                        </span>

                        <span class="severity">
                            ${escapeHTML(finding.severity)}
                        </span>

                    </div>

                    <h3>
                        ${escapeHTML(finding.title)}
                    </h3>

                    <p>
                        ${escapeHTML(finding.message)}
                    </p>

                    <div class="finding-meta">

                        <span>
                            📄 ${escapeHTML(finding.file)}
                        </span>

                        <span>
                            Line ${escapeHTML(finding.line)}
                        </span>

                        ${
                            finding.environment
                                ? `<span>🌐 ${escapeHTML(finding.environment)}</span>`
                                : ""
                        }

                    </div>

                    <button
                        class="small-btn"
                        onclick="openFinding(${originalIndex})">
                        Investigate →
                    </button>

                </div>
            `;
        }).join("");
}

function formatFindingType(type) {

    const names = {
        missing: "MISSING",
        orphaned: "ORPHANED",
        "type-mismatch": "TYPE MISMATCH",
        error: "CONFIG / SYNTAX ERROR"
    };

    return names[type] || type.toUpperCase();
}


/* =========================================================
   RECENT FINDINGS
   ========================================================= */

function renderRecentFindings() {

    const container =
        $("recentFindings");

    if (!container) return;

    const recent =
        scanResults.findings.slice(0, 5);

    if (recent.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                ✓ No configuration drift detected
            </div>
        `;

        return;
    }

    container.innerHTML =
        recent.map(finding => `
            <div class="recent-item">

                <div>
                    <strong>
                        ${escapeHTML(finding.title)}
                    </strong>

                    <small>
                        ${escapeHTML(finding.file)}:${escapeHTML(finding.line)}
                    </small>
                </div>

                <span class="severity">
                    ${escapeHTML(finding.severity)}
                </span>

            </div>
        `).join("");
}


/* =========================================================
   DASHBOARD STATS
   ========================================================= */

function renderDashboardStats() {

    const stats =
        scanResults.stats;

    $("criticalCount").textContent =
        stats.critical;

    $("warningCount").textContent =
        stats.warnings;

    $("totalCount").textContent =
        stats.total;

    $("filesScanned").textContent =
        stats.files;

    $("configKeys").textContent =
        stats.keys;

    $("languagesDetected").textContent =
        stats.languages.length || 0;

    $("scanStatus").textContent =
        "Complete";
}


/* =========================================================
   RISK UI
   ========================================================= */

function renderRisk() {

    const score =
        calculateRiskScore();

    const label =
        getRiskLabel(score);

    $("riskScore").textContent =
        score;

    $("riskLabel").textContent =
        label;

    $("riskRingValue").textContent =
        score;

    if (score === 0) {

        $("riskMessage").textContent =
            "Configuration looks healthy.";

        $("riskDescription").textContent =
            "No major drift or configuration failure was detected.";

    } else if (score < 40) {

        $("riskMessage").textContent =
            "Minor configuration risk detected.";

        $("riskDescription").textContent =
            "Review warnings before the next deployment.";

    } else if (score < 70) {

        $("riskMessage").textContent =
            "Deployment requires attention.";

        $("riskDescription").textContent =
            "Configuration inconsistencies may affect application behaviour.";

    } else {

        $("riskMessage").textContent =
            "Deployment should be blocked.";

        $("riskDescription").textContent =
            "Critical configuration drift or errors were detected.";
    }

    const ring =
        document.querySelector(".risk-ring");

    if (ring) {

        ring.style.setProperty(
            "--risk",
            score + "%"
        );
    }
}


/* =========================================================
   ENVIRONMENT HEALTH
   ========================================================= */

function renderEnvironmentHealth() {

    ENVIRONMENTS.forEach(env => {

        const keys =
            scanResults.environments[env];

        const elementId =
            env === "development"
                ? "devHealth"
                : env === "staging"
                    ? "stagingHealth"
                    : "prodHealth";

        const element =
            $(elementId);

        if (!element) return;

        if (
            !keys ||
            Object.keys(keys).length === 0
        ) {

            element.textContent =
                "Not detected";

            return;
        }

        const envFindings =
            scanResults.findings.filter(
                finding =>
                    finding.environment &&
                    finding.environment.includes(env)
            );

        const critical =
            envFindings.some(
                finding =>
                    finding.severity === "critical"
            );

        const warning =
            envFindings.length > 0;

        if (critical) {

            element.textContent =
                "Critical";

        } else if (warning) {

            element.textContent =
                "Needs Review";

        } else {

            element.textContent =
                "Healthy";
        }
    });
}


/* =========================================================
   DETECTIVE MODE
   ========================================================= */

function openFinding(index) {

    selectedFindingIndex = index;

    const finding =
        scanResults.findings[index];

    if (!finding) return;

    renderDetective(finding);

    showSection("detective");
}

function renderDetective(finding) {

    const container =
        $("detectiveContent");

    if (!container) return;

    const relatedRefs =
        scanResults.usedKeys.filter(
            ref =>
                ref.key === finding.key
        );

    const relatedConfigs =
        [];

    ENVIRONMENTS.forEach(env => {

        const defs =
            scanResults.environments[env]?.[finding.key];

        if (defs) {
            relatedConfigs.push(...defs);
        }
    });

    container.innerHTML = `

        <div class="detective-header">

            <span class="finding-type">
                ${formatFindingType(finding.type)}
            </span>

            <h2>
                ${escapeHTML(finding.title)}
            </h2>

            <p>
                ${escapeHTML(finding.message)}
            </p>

        </div>


        <div class="detective-chain">

            <div class="chain-step">
                <span>01</span>
                <strong>Code Reference</strong>
                <p>
                    ${
                        relatedRefs.length
                            ? relatedRefs.map(ref =>
                                `${escapeHTML(ref.file)}:${escapeHTML(ref.line)}`
                              ).join("<br>")
                            : "No direct code reference detected."
                    }
                </p>
            </div>


            <div class="chain-arrow">↓</div>


            <div class="chain-step">
                <span>02</span>
                <strong>Configuration Key</strong>
                <p>
                    ${escapeHTML(finding.key || "Configuration error")}
                </p>
            </div>


            <div class="chain-arrow">↓</div>


            <div class="chain-step">
                <span>03</span>
                <strong>Environment State</strong>
                <p>
                    ${
                        relatedConfigs.length
                            ? relatedConfigs.map(def =>
                                `${escapeHTML(ENV_LABELS[def.environment])} → ${escapeHTML(def.type)}`
                              ).join("<br>")
                            : escapeHTML(finding.environment || "Not available")
                    }
                </p>
            </div>


            <div class="chain-arrow">↓</div>


            <div class="chain-step danger-step">
                <span>04</span>
                <strong>Potential Impact</strong>
                <p>
                    ${escapeHTML(getImpactText(finding))}
                </p>
            </div>

        </div>


        <div class="safe-fix">

            <h3>🛠 Safe Fix Suggestion</h3>

            <p>
                ${escapeHTML(finding.suggestion)}
            </p>

            <div class="secret-safe-note">
                🔒 DRIFTLENS does not display configuration values or secrets.
            </div>

        </div>
    `;
}

function getImpactText(finding) {

    if (finding.type === "missing") {
        return "Application may fail when the missing configuration is required.";
    }

    if (finding.type === "type-mismatch") {
        return "Different environments may execute the same code with different data types.";
    }

    if (finding.type === "orphaned") {
        return "Unused configuration can increase maintenance and configuration confusion.";
    }

    if (finding.type === "error") {
        return "Deployment or application startup may fail because the configuration cannot be parsed safely.";
    }

    return "Potential deployment risk detected.";
}


/* =========================================================
   DEPENDENCY MAP
   ========================================================= */

function renderDependencyMap() {

    const dependencies =
        scanResults.dependencies;

    $("mapFiles").textContent =
        new Set(
            dependencies.map(d => d.file)
        ).size;

    $("mapKeys").textContent =
        new Set(
            dependencies.map(d => d.key)
        ).size;

    $("mapDev").textContent =
        Object.keys(
            scanResults.environments.development
        ).length;

    $("mapStaging").textContent =
        Object.keys(
            scanResults.environments.staging
        ).length;

    $("mapProd").textContent =
        Object.keys(
            scanResults.environments.production
        ).length;

    const container =
        $("dependencyDetails");

    if (!container) return;

    if (dependencies.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No configuration dependencies were detected.
            </div>
        `;

        return;
    }

    const grouped = {};

    dependencies.forEach(dep => {

        if (!grouped[dep.file]) {
            grouped[dep.file] = [];
        }

        grouped[dep.file].push(dep);
    });

    container.innerHTML =
        Object.keys(grouped).map(file => `

            <div class="dependency-file">

                <h3>
                    📄 ${escapeHTML(file)}
                </h3>

                <div class="dependency-keys">

                    ${grouped[file].map(dep => `

                        <span class="dependency-key">

                            ${escapeHTML(dep.key)}

                            <small>
                                line ${escapeHTML(dep.line)}
                            </small>

                        </span>

                    `).join("")}

                </div>

            </div>

        `).join("");
}


/* =========================================================
   HISTORY + NO REPEAT
   ========================================================= */

function saveScanHistory() {

    const existing =
        JSON.parse(
            localStorage.getItem("driftlens_history") || "[]"
        );

    const currentSignatures =
        scanResults.findings.map(
            findingSignature
        );

    const previous =
        existing[0];

    let status = "New Scan";

    if (previous) {

        const previousSignatures =
            new Set(previous.findings);

        const currentSet =
            new Set(currentSignatures);

        const resolved =
            previous.findings.filter(
                sig => !currentSet.has(sig)
            ).length;

        const newIssues =
            currentSignatures.filter(
                sig => !previousSignatures.has(sig)
            ).length;

        if (resolved > 0 && newIssues === 0) {
            status = `${resolved} issue(s) auto-resolved`;
        }

        else if (
            resolved > 0 &&
            newIssues > 0
        ) {
            status =
                `${newIssues} new / ${resolved} resolved`;
        }

        else if (newIssues === 0) {
            status = "No-repeat: same findings";
        }

        else {
            status = `${newIssues} new issue(s)`;
        }
    }

    const entry = {

        time: new Date().toLocaleString(),

        files:
            scanResults.stats.files,

        findings:
            currentSignatures,

        total:
            scanResults.stats.total,

        critical:
            scanResults.stats.critical,

        warnings:
            scanResults.stats.warnings,

        risk:
            calculateRiskScore(),

        status
    };

    existing.unshift(entry);

    localStorage.setItem(
        "driftlens_history",
        JSON.stringify(
            existing.slice(0, 10)
        )
    );

    renderHistory();
}

function findingSignature(finding) {

    return [
        finding.type,
        finding.key,
        finding.file,
        finding.line,
        finding.environment
    ].join("|");
}

function renderHistory() {

    const container =
        $("historyList");

    if (!container) return;

    const history =
        JSON.parse(
            localStorage.getItem("driftlens_history") || "[]"
        );

    if (history.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No scan history yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        history.map((item, index) => `

            <div class="history-item">

                <div>

                    <strong>
                        Scan #${history.length - index}
                    </strong>

                    <small>
                        ${escapeHTML(item.time)}
                    </small>

                </div>

                <div class="history-stats">

                    <span>
                        ${item.files} files
                    </span>

                    <span>
                        ${item.total} findings
                    </span>

                    <span>
                        Risk ${item.risk}/100
                    </span>

                </div>

                <div class="history-status">
                    ${escapeHTML(item.status)}
                </div>

            </div>

        `).join("");
}


/* =========================================================
   SECRET SAFETY
   ========================================================= */

function renderSecurity() {

    const container =
        document.querySelector(
            "#security .security-content"
        );

    if (!container) return;

    /*
       Only create the panel if the HTML
       does not already provide detailed content.
    */

    if (!container.dataset.enriched) {

        container.innerHTML += `

            <div class="security-safe-panel">

                <div>
                    <strong>🔒 Secret values protected</strong>

                    <p>
                        DRIFTLENS analyzes configuration structure,
                        key names and inferred types without displaying
                        raw secret values.
                    </p>
                </div>

                <div class="security-rules">

                    <span>✓ No raw values in findings</span>
                    <span>✓ No secrets in history</span>
                    <span>✓ No secrets in predictions</span>
                    <span>✓ Safe remediation guidance</span>

                </div>

            </div>
        `;

        container.dataset.enriched = "true";
    }
}


/* =========================================================
   PRE-DEPLOYMENT HEALTH CHECK
   ========================================================= */

function createPreDeployButton() {

    if ($("preDeployBtn")) {
        return;
    }

    const topActions =
        document.querySelector(".top-actions");

    if (!topActions) return;

    const button =
        document.createElement("button");

    button.id = "preDeployBtn";
    button.className = "secondary-btn";
    button.textContent = "✓ Pre-Deploy Check";

    button.addEventListener(
        "click",
        runPreDeployCheck
    );

    topActions.appendChild(button);
}

function runPreDeployCheck() {

    calculatePredictions();

    const score =
        calculateRiskScore();

    const prediction =
        scanResults.prediction;

    const result =
        score >= 70
            ? "❌ DEPLOYMENT BLOCKED"
            : score >= 40
                ? "⚠️ DEPLOY WITH CAUTION"
                : "✅ DEPLOYMENT READY";

    showSection("predictor");

    $("predictionResult").textContent =
        result;

    $("simulationResult").innerHTML = `

        <div class="simulation-box">

            <h3>Pre-Deployment Health Check</h3>

            <p>
                Risk Score:
                <strong>${score}/100</strong>
            </p>

            <p>
                ${escapeHTML(prediction.impact)}
            </p>

            <strong>
                ${result}
            </strong>

        </div>
    `;
}


/* =========================================================
   WHAT-IF SIMULATOR
   ========================================================= */

function setupSimulation() {

    const simulator =
        document.querySelector(
            ".simulator"
        );

    if (!simulator) return;

    /*
       If the current HTML already contains
       simulator controls, this logic can
       connect to them dynamically.
    */

    simulator.addEventListener(
        "click",
        function(event) {

            const button =
                event.target.closest(
                    "[data-simulate]"
                );

            if (!button) return;

            runPrediction();
        }
    );
}


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function renderEverything() {

    renderDashboardStats();

    renderRisk();

    renderEnvironmentHealth();

    renderRecentFindings();

    renderFindings();

    renderDependencyMap();

    renderSecurity();

    renderHistory();

    runPrediction();

    saveScanHistory();

    renderHistory();

    $("scanStatus").textContent =
        "Complete";
}


/* =========================================================
   INITIAL PAGE LOAD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        /* Initial navigation */

        showSection("dashboard");

        /* Upload input */

        const input =
            $("projectInput");

        if (input) {

            input.addEventListener(
                "change",
                event => {
                    handleFiles(event.target.files);
                }
            );
        }

        /* Simulation */

        setupSimulation();

        /* Existing history */

        renderHistory();

        /* Initial empty state */

        $("scanStatus").textContent =
            "Waiting for project";

        $("criticalCount").textContent =
            "0";

        $("warningCount").textContent =
            "0";

        $("totalCount").textContent =
            "0";

        $("filesScanned").textContent =
            "0";

        $("configKeys").textContent =
            "0";

        $("languagesDetected").textContent =
            "0";
    }
);


/* =========================================================
   CLOSE MODALS WHEN CLICKING OUTSIDE
   ========================================================= */

window.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            $("uploadModal")
        ) {
            closeUpload();
        }

        if (
            event.target ===
            $("scanModal")
        ) {
            /*
               Do not close scan modal while
               analysis is running.
            */
        }
    }
);