/* =====================================================
   SMARTSTICK AI — ULTRA-PREMIUM SCROLLYTELLING ENGINE
   High-performance Canvas Renderer, 300-Frame Image Sequence,
   Spatial Radar, AI Vision HUD, Dark Mode GPS Map, Web Audio
===================================================== */

// --- CONFIG & STATE ---
const TOTAL_FRAMES = 300;
const frameImages = new Array(TOTAL_FRAMES + 1);
let loadedFramesCount = 0;
let currentFrame = 1;
let targetFrame = 1;
let isPreloaded = false;
let isAutoTourRunning = false;
let autoTourInterval = null;

// Audio Synthesizer State
let audioCtx = null;
let isAudioMuted = true;
let ambientOsc = null;
let ambientGain = null;

// Map & Radar State
let leafletMap = null;
let userMarker = null;
let pathPolyline = null;
let radarCanvas = null;
let radarCtx = null;
let radarAngle = 0;

// DOM Elements
let canvas, ctx;
let particlesCanvas, particlesCtx;
let ambientLighting;
let preloader, preloaderBar, preloaderStatus;
let hudFrameNumber, hudSystemStatus;
let storySections = [];
let chapterNavItems = [];

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
    initDOMElements();
    setupCanvas();
    setupParticles();
    preloadFrames();
    setupScrollHandling();
    setupNavigation();
    setupRadarVisualizer();
    setupLeafletMap();
    setupAudioSynth();
    setupWindowResize();
    requestAnimationFrame(renderLoop);
});

function initDOMElements() {
    canvas = document.getElementById("productCanvas");
    ctx = canvas.getContext("2d", { alpha: false });

    particlesCanvas = document.getElementById("particlesCanvas");
    particlesCtx = particlesCanvas.getContext("2d");

    ambientLighting = document.getElementById("ambientLighting");
    preloader = document.getElementById("preloader");
    preloaderBar = document.getElementById("preloaderBar");
    preloaderStatus = document.getElementById("preloaderStatus");
    hudFrameNumber = document.getElementById("hudFrameNumber");
    hudSystemStatus = document.getElementById("hudSystemStatus");

    storySections = Array.from(document.querySelectorAll(".story-section"));
    chapterNavItems = Array.from(document.querySelectorAll(".chapter-nav-item"));
}

// =====================================================
// CANVAS SETUP & RESIZE
// =====================================================
function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);
}

function setupWindowResize() {
    window.addEventListener("resize", () => {
        setupCanvas();
        setupParticles();
        drawCurrentFrame();
        if (leafletMap) {
            leafletMap.invalidateSize();
        }
    });
}

// =====================================================
// ASSET STREAMING & PRELOADING
// =====================================================
function getFramePath(index) {
    const padded = String(index).padStart(3, "0");
    return `pics/ezgif-frame-${padded}.jpg`;
}

function preloadFrames() {
    // Load the first 15 frames immediately with highest priority
    const initialBatchSize = 15;
    let initialLoaded = 0;

    for (let i = 1; i <= initialBatchSize; i++) {
        loadSingleFrame(i, () => {
            initialLoaded++;
            if (initialLoaded === 1) {
                // Render initial frame immediately
                drawCurrentFrame();
            }
            if (initialLoaded >= initialBatchSize && !isPreloaded) {
                // Reveal the page quickly so user doesn't wait
                revealExperience();
            }
        });
    }

    // Stream remaining frames in background
    let nextIndex = initialBatchSize + 1;
    const streamConcurrency = 6;

    function streamNext() {
        if (nextIndex > TOTAL_FRAMES) return;
        const current = nextIndex++;
        loadSingleFrame(current, () => {
            streamNext();
        });
    }

    for (let c = 0; c < streamConcurrency; c++) {
        streamNext();
    }
}

function loadSingleFrame(index, callback) {
    const img = new Image();
    img.src = getFramePath(index);
    img.onload = () => {
        frameImages[index] = img;
        loadedFramesCount++;
        updatePreloaderProgress();
        if (callback) callback();
    };
    img.onerror = () => {
        loadedFramesCount++;
        updatePreloaderProgress();
        if (callback) callback();
    };
}

function updatePreloaderProgress() {
    const pct = Math.round((loadedFramesCount / TOTAL_FRAMES) * 100);
    if (preloaderBar) {
        preloaderBar.style.width = `${pct}%`;
    }
    if (preloaderStatus) {
        preloaderStatus.textContent = `Caching 300 Optical Frames... ${pct}%`;
    }
    if (pct >= 90 && !isPreloaded) {
        revealExperience();
    }
}

function revealExperience() {
    isPreloaded = true;
    if (preloader) {
        preloader.classList.add("loaded");
    }
}

// =====================================================
// SCROLL PROGRESSION & FRAME TIMELINE CHOREOGRAPHY
// =====================================================
function setupScrollHandling() {
    window.addEventListener("scroll", onScrollUpdate, { passive: true });
    onScrollUpdate();
}

function onScrollUpdate() {
    const scrollContainer = document.getElementById("scrollyContainer");
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.scrollHeight - window.innerHeight;
    const scrollY = window.scrollY - containerTop;

    const progress = Math.max(0, Math.min(1, scrollY / containerHeight));

    // Dynamic Frame Timeline Mapping
    // 0.00 - 0.15 : Hero Story (Hold frames 1 to 15)
    // 0.15 - 0.45 : Engineering Reveal / Exploded View (Frames 15 -> 299)
    // 0.45 - 0.95 : Feature Deep Dives (Hold in Exploded State with HUD overlays, frames 280-300)
    // 0.95 - 1.00 : Reassembly Finale (Frames reverse from 300 back to 1!)

    if (progress <= 0.15) {
        const t = progress / 0.15;
        targetFrame = Math.round(1 + t * 14);
    } else if (progress <= 0.45) {
        const t = (progress - 0.15) / 0.30;
        targetFrame = Math.round(15 + t * (TOTAL_FRAMES - 15));
    } else if (progress <= 0.95) {
        // Deep-dive inspection: hold in exploded glory (frame 285 to 300 with subtle organic breathing)
        const t = (progress - 0.45) / 0.50;
        targetFrame = Math.round(285 + Math.sin(t * Math.PI) * 14);
    } else {
        // 0.95 - 1.00: REASSEMBLY! Gracefully collapses back into assembled hero form
        const t = (progress - 0.95) / 0.05;
        targetFrame = Math.round(TOTAL_FRAMES - t * (TOTAL_FRAMES - 1));
    }

    targetFrame = Math.max(1, Math.min(TOTAL_FRAMES, targetFrame));

    // Update Story Section Visibility & Chapters
    updateActiveSections(progress);
    updateAmbientAura(progress);
    updateNavbarScrolled();
}

function updateActiveSections(progress) {
    storySections.forEach((section) => {
        const range = section.getAttribute("data-range").split(",").map(Number);
        const isActive = progress >= range[0] && progress < range[1];
        if (isActive && !section.classList.contains("active")) {
            storySections.forEach((s) => s.classList.remove("active"));
            section.classList.add("active");
            playMicroFeedback();
        }
    });

    // Update Floating Chapter Indicators
    const chapterRatios = [0.05, 0.25, 0.50, 0.66, 0.77, 0.86, 0.92, 0.955, 0.99];
    let currentChapter = 0;
    for (let i = 0; i < chapterRatios.length; i++) {
        if (progress >= (i === 0 ? 0 : (chapterRatios[i - 1] + chapterRatios[i]) / 2)) {
            currentChapter = i;
        }
    }

    chapterNavItems.forEach((btn, idx) => {
        btn.classList.toggle("active", idx === currentChapter);
    });
}

function updateAmbientAura(progress) {
    if (!ambientLighting) return;

    if (progress < 0.15) {
        // Hero: Soft Ice Cyan
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(0, 214, 255, 0.08) 0%, rgba(124, 92, 255, 0.03) 40%, transparent 75%)`;
    } else if (progress < 0.45) {
        // Hardware: Technical Indigo / Cyan
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(0, 214, 255, 0.12) 0%, rgba(124, 92, 255, 0.06) 50%, transparent 80%)`;
    } else if (progress < 0.60) {
        // Obstacle Radar: Sonar Cyan
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(0, 214, 255, 0.14) 0%, transparent 70%)`;
    } else if (progress < 0.72) {
        // AI Vision: Electric Violet
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(124, 92, 255, 0.16) 0%, rgba(0, 214, 255, 0.04) 50%, transparent 75%)`;
    } else if (progress < 0.82) {
        // GPS Tracking: Emerald Green
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(0, 229, 168, 0.14) 0%, transparent 75%)`;
    } else if (progress < 0.90) {
        // GSM & SOS: Warning Crimson / Orange
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(255, 77, 77, 0.18) 0%, rgba(255, 170, 0, 0.05) 50%, transparent 75%)`;
    } else if (progress < 0.95) {
        // Thermal: Amber
        ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(255, 170, 0, 0.15) 0%, transparent 75%)`;
    } else {
        // Reassembly Finale: Pure Studio Rim Glow
        ambientLighting.style.background = `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.1) 0%, rgba(0, 214, 255, 0.06) 50%, transparent 80%)`;
    }
}

function updateNavbarScrolled() {
    const navbar = document.getElementById("navbar");
    if (navbar) {
        navbar.classList.toggle("scrolled", window.scrollY > 40);
    }
}

// =====================================================
// CANVAS RENDERING LOOP (BUTTERY LERP INTERPOLATION)
// =====================================================
function renderLoop() {
    // Smooth LERP frame interpolation
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.01) {
        currentFrame += diff * 0.15;
    } else {
        currentFrame = targetFrame;
    }

    drawCurrentFrame();
    updateHUDTelemetry();
    requestAnimationFrame(renderLoop);
}

function drawCurrentFrame() {
    const frameIndex = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(currentFrame)));
    
    // Find closest loaded frame if specific frame is still loading
    let img = frameImages[frameIndex];
    if (!img) {
        for (let offset = 1; offset < 30; offset++) {
            if (frameImages[frameIndex - offset]) {
                img = frameImages[frameIndex - offset];
                break;
            }
            if (frameImages[frameIndex + offset]) {
                img = frameImages[frameIndex + offset];
                break;
            }
        }
    }

    if (!img || !ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Fill deep space black
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);

    // Compute aspect-fit dimensions (source images are 1280x720, 16:9)
    const srcAspect = 1280 / 720;
    const screenAspect = w / h;
    let renderW, renderH, offsetX, offsetY;

    if (screenAspect > srcAspect) {
        renderH = h * 0.88;
        renderW = renderH * srcAspect;
    } else {
        renderW = w * 0.92;
        renderH = renderW / srcAspect;
    }

    offsetX = (w - renderW) / 2;
    offsetY = (h - renderH) / 2;

    // Subtle horizontal shift towards left/center to make room for text on desktop
    if (w > 1024) {
        offsetX += w * 0.04;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

    // Subtle dark studio vignette at the edges to blend seamlessly
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, "rgba(5, 5, 5, 0)");
    vignette.addColorStop(1, "rgba(5, 5, 5, 0.85)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}

function updateHUDTelemetry() {
    if (hudFrameNumber) {
        const currentPadded = String(Math.round(currentFrame)).padStart(3, "0");
        hudFrameNumber.textContent = `${currentPadded} / ${TOTAL_FRAMES}`;
    }
}

// =====================================================
// ATMOSPHERIC PARTICLES
// =====================================================
let particles = [];

function setupParticles() {
    if (!particlesCanvas) return;
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;

    particles = [];
    const count = Math.min(60, Math.floor(window.innerWidth / 25));
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 1.8 + 0.6,
            speedY: -(Math.random() * 0.3 + 0.1),
            speedX: (Math.random() - 0.5) * 0.2,
            opacity: Math.random() * 0.5 + 0.2,
            isCyan: Math.random() > 0.4
        });
    }
    animateParticles();
}

function animateParticles() {
    if (!particlesCtx) return;
    particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

    particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < 0) p.y = particlesCanvas.height;
        if (p.x < 0) p.x = particlesCanvas.width;
        if (p.x > particlesCanvas.width) p.x = 0;

        particlesCtx.fillStyle = p.isCyan
            ? `rgba(0, 214, 255, ${p.opacity})`
            : `rgba(255, 255, 255, ${p.opacity * 0.8})`;

        particlesCtx.beginPath();
        particlesCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        particlesCtx.fill();
    });

    requestAnimationFrame(animateParticles);
}

// =====================================================
// SPATIAL RADAR VISUALIZER (TRIPLE-DIRECTION ULTRASONIC)
// =====================================================
function setupRadarVisualizer() {
    radarCanvas = document.getElementById("radarCanvas");
    if (!radarCanvas) return;
    radarCtx = radarCanvas.getContext("2d");

    function resizeRadar() {
        const rect = radarCanvas.parentElement.getBoundingClientRect();
        radarCanvas.width = rect.width;
        radarCanvas.height = rect.height;
    }
    resizeRadar();
    window.addEventListener("resize", resizeRadar);

    animateRadar();
}

function animateRadar() {
    if (!radarCtx || !radarCanvas) return;
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    const cx = w / 2;
    const cy = h - 10;
    const maxR = Math.min(w * 0.45, h * 0.85);

    radarCtx.clearRect(0, 0, w, h);

    // Concentric Range Rings
    for (let r = 1; r <= 3; r++) {
        const radius = (maxR / 3) * r;
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, radius, Math.PI, 0);
        radarCtx.strokeStyle = "rgba(0, 214, 255, 0.12)";
        radarCtx.lineWidth = 1;
        radarCtx.stroke();
    }

    // Directional Angle Lines (Left 45°, Front 90°, Right 135°)
    const angles = [-Math.PI * 0.75, -Math.PI * 0.5, -Math.PI * 0.25];
    angles.forEach((ang) => {
        radarCtx.beginPath();
        radarCtx.moveTo(cx, cy);
        radarCtx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
        radarCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        radarCtx.lineWidth = 1;
        radarCtx.stroke();
    });

    // Sweeping Sonar Beam
    radarAngle += 0.035;
    const sweepAngle = -Math.PI + (Math.sin(radarAngle) * 0.5 + 0.5) * Math.PI;

    radarCtx.save();
    radarCtx.beginPath();
    radarCtx.moveTo(cx, cy);
    radarCtx.arc(cx, cy, maxR, sweepAngle - 0.2, sweepAngle);
    radarCtx.closePath();
    const beamGrad = radarCtx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    beamGrad.addColorStop(0, "rgba(0, 214, 255, 0)");
    beamGrad.addColorStop(1, "rgba(0, 214, 255, 0.28)");
    radarCtx.fillStyle = beamGrad;
    radarCtx.fill();
    radarCtx.restore();

    // Sensor Blips
    // Left: 82cm (Clear)
    drawBlip(cx, cy, maxR, -Math.PI * 0.75, 0.55, "#00E5A8");
    // Front: 46cm (Warning pulse!)
    drawBlip(cx, cy, maxR, -Math.PI * 0.5, 0.32, "#FFAA00", true);
    // Right: 127cm (Clear)
    drawBlip(cx, cy, maxR, -Math.PI * 0.25, 0.85, "#00E5A8");

    requestAnimationFrame(animateRadar);
}

function drawBlip(cx, cy, maxR, angle, distFactor, color, isPulse = false) {
    const x = cx + Math.cos(angle) * (maxR * distFactor);
    const y = cy + Math.sin(angle) * (maxR * distFactor);

    radarCtx.beginPath();
    radarCtx.arc(x, y, isPulse ? 5 : 4, 0, Math.PI * 2);
    radarCtx.fillStyle = color;
    radarCtx.fill();

    if (isPulse) {
        radarCtx.beginPath();
        const pulseR = 6 + (Math.sin(Date.now() * 0.008) * 0.5 + 0.5) * 8;
        radarCtx.arc(x, y, pulseR, 0, Math.PI * 2);
        radarCtx.strokeStyle = "rgba(255, 170, 0, 0.5)";
        radarCtx.lineWidth = 1.5;
        radarCtx.stroke();
    }
}

// =====================================================
// LEAFLET DARK-MODE VECTOR MAP
// =====================================================
function setupLeafletMap() {
    const mapElement = document.getElementById("gpsLeafletMap");
    if (!mapElement || typeof L === "undefined") return;

    const initialCoords = [13.0827, 80.2707];

    leafletMap = L.map("gpsLeafletMap", {
        center: initialCoords,
        zoom: 16,
        zoomControl: false,
        attributionControl: false
    });

    // Ultra-clean Dark Matter Map Tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd"
    }).addTo(leafletMap);

    // Glowing User Beacon Marker
    const beaconIcon = L.divIcon({
        className: "custom-leaflet-beacon",
        html: `<div style="width:18px; height:18px; border-radius:50%; background:#00E5A8; box-shadow:0 0 16px #00E5A8; border:2px solid #fff;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    userMarker = L.marker(initialCoords, { icon: beaconIcon }).addTo(leafletMap);

    // Breadcrumb Movement Path
    const pathCoordinates = [
        [13.0815, 80.2690],
        [13.0818, 80.2696],
        [13.0822, 80.2702],
        [13.0827, 80.2707]
    ];

    pathPolyline = L.polyline(pathCoordinates, {
        color: "#00E5A8",
        weight: 3,
        opacity: 0.8,
        dashArray: "6, 8"
    }).addTo(leafletMap);

    // Geofence Safe Radius Circle
    L.circle(initialCoords, {
        radius: 120,
        color: "#00D6FF",
        fillColor: "#00D6FF",
        fillOpacity: 0.08,
        weight: 1.5
    }).addTo(leafletMap);
}

// =====================================================
// INTERACTIVE AI TARGET SIMULATOR
// =====================================================
window.simulateAiClass = function(target) {
    playMicroFeedback();
    const chips = document.querySelectorAll(".ai-target-chip");
    chips.forEach(c => c.classList.remove("active"));
    event.target.classList.add("active");

    const boxesContainer = document.querySelector(".ai-bounding-boxes");
    if (!boxesContainer) return;

    if (target === "PERSON") {
        boxesContainer.innerHTML = `
            <div class="ai-box" style="top: 20%; left: 18%; width: 28%; height: 55%;">
                <span class="ai-box-tag">PERSON — 96%</span>
            </div>
        `;
    } else if (target === "VEHICLE") {
        boxesContainer.innerHTML = `
            <div class="ai-box critical" style="top: 30%; right: 15%; width: 38%; height: 45%;">
                <span class="ai-box-tag">APPROACHING VEHICLE — 91%</span>
            </div>
        `;
    } else if (target === "CHAIR") {
        boxesContainer.innerHTML = `
            <div class="ai-box" style="top: 40%; left: 32%; width: 24%; height: 35%;">
                <span class="ai-box-tag">CHAIR — 88%</span>
            </div>
        `;
    } else if (target === "STAIRS") {
        boxesContainer.innerHTML = `
            <div class="ai-box critical" style="bottom: 12%; left: 35%; width: 30%; height: 38%;">
                <span class="ai-box-tag">DOWNWARD STAIRCASE — 94%</span>
            </div>
        `;
    } else {
        boxesContainer.innerHTML = `
            <div class="ai-box critical" style="top: 35%; left: 28%; width: 34%; height: 40%;">
                <span class="ai-box-tag">OBSTACLE DETECTED — 97%</span>
            </div>
        `;
    }
};

// =====================================================
// INTERACTIVE SOS BEACON TRIGGER SIMULATION
// =====================================================
window.triggerSosSimulation = function() {
    playEmergencySiren();
    const btn = document.getElementById("sosSimulateBtn");
    const status = document.getElementById("sosAlertStatus");
    const desc = document.getElementById("sosAlertDesc");

    btn.style.background = "linear-gradient(135deg, #FF1A1A, #800000)";
    btn.innerHTML = "<span>🚨 SOS BROADCASTING...</span>";

    status.textContent = "SOS ALERT ACTIVATED";
    status.style.color = "#FF4D4D";
    desc.textContent = "Emergency SMS sent to Caregiver (Mom & Doc) with GPS coordinates 13.0827°N, 80.2707°E. Voice channel opened.";

    // Flash ambient lighting red
    ambientLighting.style.background = `radial-gradient(circle at 45% 50%, rgba(255, 77, 77, 0.4) 0%, transparent 75%)`;

    setTimeout(() => {
        btn.style.background = "linear-gradient(135deg, #FF4D4D, #B31D1D)";
        btn.innerHTML = "<span>🚨 PRESS SOS BUTTON</span>";
        status.textContent = "NOTIFICATION CONFIRMED";
        desc.textContent = "Caregiver acknowledged receipt at 14:10:04. Location tracking link active.";
    }, 4000);
};

// =====================================================
// WEB AUDIO API SYNTHESIZER
// =====================================================
function setupAudioSynth() {
    const soundToggle = document.getElementById("soundToggle");
    const iconOn = document.getElementById("soundIconOn");
    const iconOff = document.getElementById("soundIconOff");

    soundToggle.addEventListener("click", () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }

        isAudioMuted = !isAudioMuted;
        soundToggle.classList.toggle("active", !isAudioMuted);
        iconOn.style.display = isAudioMuted ? "none" : "block";
        iconOff.style.display = isAudioMuted ? "block" : "none";

        if (!isAudioMuted) {
            startAmbientDrone();
            playMicroFeedback();
        } else {
            stopAmbientDrone();
        }
    });
}

function startAmbientDrone() {
    if (!audioCtx) return;
    try {
        ambientOsc = audioCtx.createOscillator();
        ambientGain = audioCtx.createGain();

        ambientOsc.type = "sine";
        ambientOsc.frequency.setValueAtTime(55, audioCtx.currentTime); // 55Hz low ambient hum

        ambientGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        ambientGain.gain.exponentialRampToValueAtTime(0.04, audioCtx.currentTime + 2);

        ambientOsc.connect(ambientGain);
        ambientGain.connect(audioCtx.destination);
        ambientOsc.start();
    } catch (e) {
        console.warn("Audio error:", e);
    }
}

function stopAmbientDrone() {
    if (ambientGain && audioCtx) {
        ambientGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
        setTimeout(() => {
            if (ambientOsc) ambientOsc.stop();
        }, 500);
    }
}

function playMicroFeedback() {
    if (isAudioMuted || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {}
}

function playEmergencySiren() {
    if (isAudioMuted || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.6);

        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {}
}

// =====================================================
// AUTO-TOUR CINEMATIC MODE
// =====================================================
function setupNavigation() {
    const autoTourBtn = document.getElementById("autoTourBtn");
    autoTourBtn.addEventListener("click", toggleAutoTour);
}

function toggleAutoTour() {
    const btn = document.getElementById("autoTourBtn");
    if (isAutoTourRunning) {
        clearInterval(autoTourInterval);
        isAutoTourRunning = false;
        btn.classList.remove("active");
    } else {
        isAutoTourRunning = true;
        btn.classList.add("active");
        playMicroFeedback();

        const scrollContainer = document.getElementById("scrollyContainer");
        const maxScroll = scrollContainer.scrollHeight - window.innerHeight;
        const scrollSpeed = 3.5;

        autoTourInterval = setInterval(() => {
            if (window.scrollY >= maxScroll - 10) {
                toggleAutoTour();
                return;
            }
            window.scrollBy({ top: scrollSpeed, behavior: "auto" });
        }, 16);
    }
}

// Global Nav Scroll Helpers
window.scrollToScrollRatio = function(ratio) {
    playMicroFeedback();
    const scrollContainer = document.getElementById("scrollyContainer");
    const maxScroll = scrollContainer.scrollHeight - window.innerHeight;
    window.scrollTo({
        top: scrollContainer.offsetTop + maxScroll * ratio,
        behavior: "smooth"
    });
};

window.scrollToSection = function(sectionId) {
    playMicroFeedback();
    const targetMap = {
        "hero": 0.02,
        "hardware": 0.25,
        "radar": 0.50,
        "ai-vision": 0.66,
        "gps": 0.77,
        "sos": 0.86,
        "reassembly": 0.99
    };
    if (targetMap[sectionId] !== undefined) {
        scrollToScrollRatio(targetMap[sectionId]);
    }
};

// =====================================================
// MODAL CONTROLLERS
// =====================================================
window.openSpecsModal = function() {
    playMicroFeedback();
    const modal = document.getElementById("specsModal");
    if (modal) modal.classList.add("open");
};

window.closeSpecsModal = function(e) {
    if (e.target.id === "specsModal") {
        document.getElementById("specsModal").classList.remove("open");
    }
};

window.closeSpecsModalDirect = function() {
    document.getElementById("specsModal").classList.remove("open");
};

window.openArchitectureModal = function() {
    playMicroFeedback();
    const modal = document.getElementById("architectureModal");
    if (modal) modal.classList.add("open");
};

window.closeArchitectureModal = function(e) {
    if (e.target.id === "architectureModal") {
        document.getElementById("architectureModal").classList.remove("open");
    }
};

window.closeArchitectureModalDirect = function() {
    document.getElementById("architectureModal").classList.remove("open");
};

window.openSpecDetail = function(part) {
    openSpecsModal();
};