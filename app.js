/**
 * Hacker Directory Core Application Logic
 */

const CONFIG = {
    BASE_URL: "https://kgs-guestbook-api.onrender.com",
    REFRESH_INTERVAL: 30000,
    MATRIX_SPEED: 33
};

// Global State Object (Avoids messy tracking variables scattered everywhere)
const State = {
    isTyping: false,
    lastVibe: "",
    profiles: [],
    filterTerm: ""
};

// --- SECURITY UTILITIES ---
/**
 * Prevents Cross-Site Scripting (XSS) by encoding untrusted strings.
 */
function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return string.replace(reg, (match) => map[match]);
}

// --- DOM ELEMENT REFERENCES ---
const DOM = {
    title: document.getElementById('terminal-title'),
    status: document.getElementById('server-status'),
    memberCount: document.getElementById('member-count'),
    vibeText: document.getElementById('vibe-text'),
    search: document.getElementById('terminal-search'),
    skillNetwork: document.getElementById('skill-network'),
    toggleSkillsBtn: document.getElementById('toggle-skills-btn'),
    joinForm: document.getElementById('join-form'),
    hackerList: document.getElementById('hacker-list'),
    canvas: document.getElementById('matrix-rain')
};

// --- ASYNC DATA LAYER ---
async function apiFetch(endpoint, options = {}) {
    const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`, options);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return response.json();
}

async function updateSystemData(animateVibe = false) {
    try {
        // Concurrent fetching for optimized performance
        const [profilesData, statsData, vibeData] = await Promise.all([
            apiFetch('/profiles'),
            apiFetch('/stats'),
            apiFetch('/vibe')
        ]);

        // Process data safely
        State.profiles = [...profilesData].reverse();
        DOM.memberCount.textContent = sanitize(String(statsData.total_hackers));
        
        renderProfiles();

        if (DOM.skillNetwork.getAttribute('aria-expanded') === 'true') {
            renderSkillNetwork();
        }

        // Contextually handle the vibe text state change
        if (vibeData.vibe !== State.lastVibe) {
            State.lastVibe = vibeData.vibe;
            if (animateVibe) {
                runTypewriter(vibeData.vibe, DOM.vibeText, 80);
            } else {
                clearTypewriter(DOM.vibeText);
                DOM.vibeText.textContent = vibeData.vibe;
            }
        }

        if (!State.isTyping) {
            DOM.status.textContent = "ONLINE";
            DOM.status.classList.remove('typing');
        }
    } catch (error) {
        console.error("System sync failure:", error);
        if (!State.isTyping) {
            DOM.status.textContent = "OFFLINE";
            DOM.status.classList.remove('typing');
        }
    }
}

// --- RENDERING LAYER ---
function renderProfiles() {
    DOM.hackerList.innerHTML = "";
    
    // Filter profiles out from state cache before manipulating DOM
    const filtered = State.profiles.filter(profile => 
        profile.name.toLowerCase().includes(State.filterTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        DOM.hackerList.innerHTML = `<p class="system-msg">> NO_PROFILES_MATCHING_SEARCH</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(hacker => {
        const card = document.createElement("div");
        card.className = "profile-card";
        
        // Explicitly sanitized variables to guarantee total layout safety
        const safeName = sanitize(hacker.name);
        const safeSkill = sanitize(hacker.skill);
        const safeGithub = sanitize(hacker.github_username);

        card.innerHTML = `
            <h3>> USER: ${safeName}</h3>
            <p>SKILL: ${safeSkill}</p>
            <p>GITHUB_USER: ${safeGithub}</p>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "[DELETE]";
        deleteBtn.addEventListener('click', () => handleDeleteUser(hacker.name));

        card.appendChild(deleteBtn);
        fragment.appendChild(card);
    });

    DOM.hackerList.appendChild(fragment);
}

function renderSkillNetwork() {
    DOM.skillNetwork.innerHTML = "";
    const skillGroups = {};

    State.profiles.forEach(hacker => {
        const skill = hacker.skill.trim().toLowerCase();
        if (!skill || !hacker.name) return;
        
        if (!skillGroups[skill]) skillGroups[skill] = [];
        skillGroups[skill].push(hacker.name.trim());
    });

    const sortedSkills = Object.entries(skillGroups).sort((a, b) => b[1].length - a[1].length);

    if (sortedSkills.length === 0) {
        DOM.skillNetwork.textContent = "NO_SKILL_CONNECTIONS_FOUND";
        return;
    }

    const fragment = document.createDocumentFragment();
    sortedSkills.forEach(([skill, names]) => {
        const line = document.createElement("p");
        const countLabel = names.length === 1 ? "hacker" : "hackers";
        const cleanNames = names.map(n => sanitize(n)).join(", ");
        
        line.textContent = `> ${skill.toUpperCase()}: ${names.length} ${countLabel} - ${cleanNames}`;
        fragment.appendChild(line);
    });
    DOM.skillNetwork.appendChild(fragment);
}

// --- INTERACTIVE EVENT HANDLERS ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('name').value,
        skill: document.getElementById('skill').value,
        github_username: document.getElementById('github').value,
        passkey: document.getElementById('passkey').value
    };

    try {
        const response = await fetch(`${CONFIG.BASE_URL}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("SUCCESS: Added to mainframe.");
            e.target.reset();
            await updateSystemData(false);
        } else {
            alert("ERROR: System transaction rejected.");
        }
    } catch (err) {
        alert("CRITICAL CONNECTION FAILURE");
    }
}

async function handleDeleteUser(name) {
    const key = prompt(`Enter passkey for ${sanitize(name)}:`);
    if (!key) return;

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/delete/${encodeURIComponent(name)}/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert("SUCCESS: Profile deleted.");
            await updateSystemData(false);
        } else {
            const result = await res.json();
            alert(`ACCESS DENIED: ${result.detail || "Invalid credential structure."}`);
        }
    } catch (err) {
        alert("CRITICAL ERROR DURING DELETION INTERFACE");
    }
}

function handleSearch(e) {
    State.filterTerm = e.target.value;
    renderProfiles(); // Re-render from local filtered state cache
}

function toggleSkillNetwork() {
    const isHidden = DOM.skillNetwork.classList.contains('hidden');
    if (isHidden) {
        renderSkillNetwork();
        DOM.skillNetwork.classList.remove('hidden');
        DOM.skillNetwork.setAttribute('aria-expanded', 'true');
    } else {
        DOM.skillNetwork.classList.add('hidden');
        DOM.skillNetwork.setAttribute('aria-expanded', 'false');
    }
}

// --- VISUAL INTERFACE ENHANCEMENTS ---
function runTypewriter(text, element, speed, callback) {
    clearTypewriter(element);
    State.isTyping = true;
    let i = 0;
    element.classList.add("typing");

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            element.typewriterTimer = setTimeout(type, speed);
        } else {
            State.isTyping = false;
            element.classList.remove("typing");
            element.typewriterTimer = null;
            if (callback) callback();
        }
    }
    type();
}

function clearTypewriter(element) {
    if (element.typewriterTimer) {
        clearTimeout(element.typewriterTimer);
        element.typewriterTimer = null;
    }
    element.classList.remove("typing");
    element.textContent = "";
}

// --- MATRIX ENGINE ---
function initMatrixEngine() {
    const ctx = DOM.canvas.getContext('2d');
    
    const resizeCanvas = () => {
        DOM.canvas.width = window.innerWidth;
        DOM.canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = "0123456789ABCDEF".split("");
    const dropSize = 16;
    const drops = Array(Math.floor(DOM.canvas.width / dropSize)).fill(1);

    function renderMatrix() {
        ctx.fillStyle = "rgba(13, 2, 8, 0.1)";
        ctx.fillRect(0, 0, DOM.canvas.width, DOM.canvas.height);

        ctx.fillStyle = "#00ff41";
        ctx.font = `${dropSize}px monospace`;

        drops.forEach((y, i) => {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * dropSize, y * dropSize);

            if (y * dropSize > DOM.canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        });
    }
    setInterval(renderMatrix, CONFIG.MATRIX_SPEED);
}

// --- SYSTEM INITIALIZATION ---
function initApp() {
    initMatrixEngine();

    // Wire up event listeners explicitly in JS execution context
    DOM.search.addEventListener('input', handleSearch);
    DOM.toggleSkillsBtn.addEventListener('click', toggleSkillNetwork);
    DOM.joinForm.addEventListener('submit', handleFormSubmit);

    // Orchestrated boot loading sequence
    runTypewriter("> HACKER_DIRECTORY_V2.EXE", DOM.title, 50, () => {
        runTypewriter("ESTABLISHING_SECURE_CONNECTION...", DOM.status, 40, () => {
            updateSystemData(true);
            setInterval(() => updateSystemData(true), CONFIG.REFRESH_INTERVAL);
        });
    });
}

document.addEventListener('DOMContentLoaded', initApp);
