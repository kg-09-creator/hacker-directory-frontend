/**
 * Hacker Directory Core Application Logic
 * Refactored for execution optimization, frame rate stability, and state integrity.
 */

const CONFIG = {
    BASE_URL: "https://kgs-guestbook-api.onrender.com",
    REFRESH_INTERVAL: 30000,
    MATRIX_SPEED: 33
};

// Centralized Application State
const State = {
    isTyping: false,
    lastVibe: "",
    profiles: [],
    filterTerm: ""
};

// --- DOM ELEMENT REFERENCE MAP ---
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

// --- SECURITY UTILITIES ---
/**
 * Strict XSS contextual text encoder. Prevents execution of malicious payloads
 * injected into input nodes.
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

// --- UTILITY UTILITIES (HUMAN ENHANCEMENTS) ---
/**
 * Contextual fallback wrapper specifically dealing with Render.com free-tier
 * cold start spin-up delays.
 */
async function fetchWithRetry(endpoint, options = {}, retries = 3, delay = 2500) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`, options);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            return await response.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`[Network Warning] Target microservice is asleep. Retry loop ${i + 1}/${retries} active...`);
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

/**
 * Standard debounce wrapper to insulate layout reflows from aggressive keystrokes
 */
function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// --- ASYNC DATA PIPELINE ---
async function updateSystemData(animateVibe = false) {
    try {
        // Run concurrent network promises to prevent blocking operations
        const [profilesData, statsData, vibeData] = await Promise.all([
            fetchWithRetry('/profiles'),
            fetchWithRetry('/stats'),
            fetchWithRetry('/vibe')
        ]);

        State.profiles = [...profilesData].reverse();
        DOM.memberCount.textContent = sanitize(String(statsData.total_hackers));
        
        renderProfiles();

        if (DOM.skillNetwork.getAttribute('aria-expanded') === 'true') {
            renderSkillNetwork();
        }

        // Evaluate the text state strictly against previous cache to avoid resetting active CSS animations
        if (vibeData.vibe !== State.lastVibe) {
            State.lastVibe = vibeData.vibe;
            if (animateVibe) {
                // Hand off to the modern CSS class typewriter approach
                DOM.vibeText.classList.remove("terminal-title-animate");
                void DOM.vibeText.offsetWidth; // Force rendering pipeline layout reflow trick
                DOM.vibeText.textContent = vibeData.vibe;
                DOM.vibeText.classList.add("terminal-title-animate");
            } else {
                DOM.vibeText.classList.remove("terminal-title-animate");
                DOM.vibeText.textContent = vibeData.vibe;
            }
        }

        DOM.status.textContent = "ONLINE";
        DOM.status.classList.remove('terminal-title-animate');
    } catch (error) {
        console.error("System sync failed completely:", error);
        DOM.status.textContent = "OFFLINE";
        DOM.status.classList.remove('terminal-title-animate');
    }
}

// --- DOM LAYOUT ENGINE ---
function renderProfiles() {
    DOM.hackerList.innerHTML = "";
    
    // Abstract the filter directly from state engine cache
    const filtered = State.profiles.filter(profile => 
        profile.name.toLowerCase().includes(State.filterTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        DOM.hackerList.innerHTML = `<p class="system-msg">> NO_PROFILES_MATCHING_SEARCH</p>`;
        return;
    }

    // Performance Optimization: Batch inject using a layout fragment container
    const fragment = document.createDocumentFragment();

    filtered.forEach(hacker => {
        const card = document.createElement("div");
        card.className = "profile-card";
        
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

// --- INTERACTIVE TRANSACTION CONTROLLERS ---
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
            alert("ERROR: Server transaction rejected.");
        }
    } catch (err) {
        alert("CRITICAL LOGISTICAL TRANSIT FAILURE");
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
            alert("SUCCESS: Profile dropped from remote database.");
            await updateSystemData(false);
        } else {
            const result = await res.json();
            alert(`ACCESS DENIED: ${result.detail || "Invalid verification response."}`);
        }
    } catch (err) {
        alert("CRITICAL ARCHITECTURAL CONTEXT INTERRUPT");
    }
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

// --- PERFORMANCE-TUNED MATRIX RENDERING ENGINE ---
class MatrixTerminal {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.chars = "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1023456789".split("");
        this.fontSize = 14;
        this.columns = 0;
        this.drops = [];
        
        this.init();
        window.addEventListener('resize', () => this.init());
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        
        const currentLength = this.drops.length;
        if (this.columns > currentLength) {
            for (let i = currentLength; i < this.columns; i++) {
                this.drops.push(Math.random() * -100); 
            }
        } else if (this.columns < currentLength) {
            this.drops.length = this.columns;
        }
    }

    render() {
        this.ctx.fillStyle = "rgba(13, 2, 8, 0.06)"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = `${this.fontSize}px monospace`;

        for (let i = 0; i < this.drops.length; i++) {
            const text = this.chars[Math.floor(Math.random() * this.chars.length)];
            
            // Contrast highlights: inject sporadic phosphor flashes for variance
            this.ctx.fillStyle = Math.random() > 0.985 ? "#ffffff" : "rgba(0, 255, 65, 0.85)";
            
            this.ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);

            if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.985) {
                this.drops[i] = 0;
            }
            this.drops[i] += 0.45; 
        }
    }
}

// --- DESKTOP RUNTIME ROOT ---
function initApp() {
    // 1. Fire up OOP Canvas Matrix Engine
    if (DOM.canvas) {
        const engine = new MatrixTerminal(DOM.canvas);
        const ticker = () => {
            engine.render();
            requestAnimationFrame(ticker); 
        };
        ticker();
    }

    // 2. Apply humanized debounced event routing to input streaming
    const handleSearch = debounce((e) => {
        State.filterTerm = e.target.value;
        renderProfiles();
    }, 150);

    DOM.search.addEventListener('input', handleSearch);
    DOM.toggleSkillsBtn.addEventListener('click', toggleSkillNetwork);
    DOM.joinForm.addEventListener('submit', handleFormSubmit);

    // 3. Initial connection handshakes
    DOM.title.classList.add('terminal-title-animate');
    DOM.status.classList.add('terminal-title-animate');
    
    updateSystemData(true);
    setInterval(() => updateSystemData(true), CONFIG.REFRESH_INTERVAL);
}

document.addEventListener('DOMContentLoaded', initApp);
