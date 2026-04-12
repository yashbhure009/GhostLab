console.log("Ghost-Lab: content script loaded");
// Platform selector map
// Each entry: { name, test, getInput }
// test()     - returns true if we are on this platform
// getInput() - returns the input DOM element to attach to
const PLATFORMS = [
    {
        name: "ChatGPT",
        test: () => location.hostname.includes("chatgpt.com"),
        getInput: () => document.querySelector("#prompt-textarea")
                    || document.querySelector('[contenteditable="true"]')
    },
    {
        name: "Claude",
        test: () => location.hostname.includes("claude.ai"),
        getInput: () => document.querySelector(".ProseMirror")
                    || document.querySelector('[contenteditable="true"]')
    },
    {
        name: "Gemini",
        test: () => location.hostname.includes("gemini.google.com"),
        getInput: () => document.querySelector(".ql-editor")
                    || document.querySelector('[contenteditable="true"]')
    },
    {
        name: "Google Docs",
        test: () => location.hostname.includes("docs.google.com") && location.pathname.includes("/document"),
        getInput: () => {
            const iframe = document.querySelector(".docs-texteventtarget-iframe");
            return iframe?.contentDocument?.querySelector('[contenteditable="true"]')
                || document.querySelector('[contenteditable="true"]');
        }
    },
    {
        name: "Google Slides",
        test: () => location.hostname.includes("docs.google.com") && location.pathname.includes("/presentation"),
        getInput: () => {
            const iframe = document.querySelector(".punch-present-iframe");
            return iframe?.contentDocument?.querySelector('[contenteditable="true"]')
                || document.querySelector('[contenteditable="true"]');
        }
    },
    {
        name: "Perplexity",
        test: () => location.hostname.includes("perplexity.ai"),
        getInput: () => document.querySelector("textarea[placeholder]")
                    || document.querySelector("textarea")
    },
    {
        name: "Generic Fallback",
        test: () => true,
        getInput: () => document.querySelector('[contenteditable="true"]')
                    || document.querySelector("textarea")
    }
];

function detectPlatform() {
    for (const platform of PLATFORMS) {
        if (platform.test()) {
            console.log("Ghost-Lab: detected platform ->", platform.name);
            return platform;
        }
    }
}
// localStorage helpers
const STORAGE_KEY = "ghostlab_mapping";
function getMapping() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}
function getKnownFakes() {
    return Object.keys(getMapping());
}
// API call
async function sanitizeWithAPI(text) {
    try {
        const res = await fetch("http://127.0.0.1:8000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                known_fakes: getKnownFakes()
            })
        });
        const data = await res.json();
        return data.sanitized_sent_to_ai;

    } catch (e) {
        console.error("Ghost-Lab API error:", e);
        return text;
    }
}
// Read and write text - handles both textarea and contenteditable
function getText(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        return el.value;
    }
    return el.innerText;
}
function setText(el, text) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, "value"
        )?.set;
        if (nativeSetter) {
            nativeSetter.call(el, text);
            el.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            el.value = text;
        }
    } else {
        el.innerText = text;

        // Move cursor to end after replacement
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// Attach sanitization listener to the detected input element

let attached = false;

function attachToInput(inputEl, platformName) {
    if (attached) return;
    attached = true;

    console.log("Ghost-Lab: attached to", platformName, "input");

    let isUpdating = false;
    let timeout;
    let lastProcessed = "";

    inputEl.addEventListener("input", () => {
        if (isUpdating) return;

        clearTimeout(timeout);

        timeout = setTimeout(async () => {
            const original = getText(inputEl);

            if (!original || original === lastProcessed) return;

            const sanitized = await sanitizeWithAPI(original);

            if (original !== sanitized) {
                isUpdating = true;
                setText(inputEl, sanitized);
                lastProcessed = sanitized;
                setTimeout(() => { isUpdating = false; }, 200);
            } else {
                lastProcessed = original;
            }

        }, 800);
    });
}
// Poll until the input element appears, then attach and stop polling
const platform = detectPlatform();

const interval = setInterval(() => {
    if (attached) {
        clearInterval(interval);
        return;
    }

    const inputEl = platform.getInput();
    if (inputEl) {
        attachToInput(inputEl, platform.name);
        clearInterval(interval);
    }
}, 1000);