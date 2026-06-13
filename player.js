document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("video");
    const player = document.getElementById("player");
    const playBtn = document.getElementById("playBtn");
    const controls = document.getElementById("controls");
    const seek = document.getElementById("seek");
    const titleEl = document.getElementById("title-text");
    const currentTimeEl = document.getElementById("current");
    const totalTimeEl = document.getElementById("total");
    const backdropOverlay = document.getElementById("backdrop-overlay");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsMenu = document.getElementById("settings-menu");
    const qualityContainer = document.getElementById("quality-options");
    const qualityLoader = document.getElementById("quality-loader");
    const resumeModal = document.getElementById("resume-modal");
    const resumeText = document.getElementById("resume-text");
    const btnContinue = document.getElementById("btn-continue");
    const btnRestart = document.getElementById("btn-restart");
    const rewindBtn = document.getElementById("rewindBtn");
    const forwardBtn = document.getElementById("forwardBtn");
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    const params = new URLSearchParams(window.location.search);
    let VIDEO_URL = params.get('video') ? decodeURIComponent(params.get('video')) : '';
    let POSTER_URL = params.get('poster') ? decodeURIComponent(params.get('poster')) : '';
    let TITLE = params.get('title') ? decodeURIComponent(params.get('title')) : 'Reproduciendo';
    let TMDB_ID = params.get('id') || null;

    const baseKey = TITLE !== 'Reproduciendo' ? TITLE : (VIDEO_URL || 'unknown');
    const STORAGE_KEY = `lzplayer_resume_${baseKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

    let hlsInstance = null;
    let hasStarted = false;
    let isChangingQuality = false;
    let saveInterval = null;
    let nextEpisodeData = null;

    // ==================== CREAR BOTÓN SIGUIENTE EN LOS CONTROLES CENTRALES ====================
    const centerControls = document.querySelector('.center');
    let nextEpCenterBtn = null;

    if (centerControls) {
        nextEpCenterBtn = document.createElement("i");
        nextEpCenterBtn.className = "fas fa-step-forward btn";
        nextEpCenterBtn.id = "nextEpCenterBtn";
        nextEpCenterBtn.style.display = "none";
        nextEpCenterBtn.title = "Siguiente Episodio";
        centerControls.appendChild(nextEpCenterBtn);

        nextEpCenterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (nextEpisodeData) window.location.href = nextEpisodeData;
        });
    }

    // ==================== CREAR BOTÓN FLOTANTE (TIPO NETFLIX) ====================
    const nextEpBtn = document.createElement("button");
    nextEpBtn.id = "btn-next-episode-float";
    nextEpBtn.innerHTML = 'Siguiente <i class="fas fa-step-forward"></i>';

    player.appendChild(nextEpBtn);

    // Estilos del botón flotante
    const style = document.createElement('style');
    style.innerHTML = `
        #btn-next-episode-float {
            position: absolute;
            bottom: 90px;
            right: 30px;
            background: rgba(229, 9, 20, 0.95);
            color: white;
            border: none;
            padding: 12px 26px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            z-index: 100;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px);
            transition: all 0.4s ease;
            box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #btn-next-episode-float.show {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #btn-next-episode-float:hover {
            background: rgba(255, 15, 25, 1);
            transform: scale(1.08);
        }
    `;
    document.head.appendChild(style);

    nextEpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (nextEpisodeData) window.location.href = nextEpisodeData;
    });

    // ==================== BUSCAR SIGUIENTE EPISODIO ====================
    async function checkNextEpisode() {
        if (!TMDB_ID || TITLE === 'Reproduciendo') return;

        const match = TITLE.match(/(.*?)\s*-\s*T(\d+)E(\d+)/i);
        if (!match) return;

        const seriesName = match[1].trim();
        const currentSeason = parseInt(match[2], 10);
        const currentEpisode = parseInt(match[3], 10);
        const nextEpisodeNum = currentEpisode + 1;

        const jsonUrl = `https://raw.githubusercontent.com/thexxx880/apple/main/data%20base/data/serie/${TMDB_ID}/t${currentSeason}/${TMDB_ID}.json`;

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) return;

            const data = await response.json();

            if (data.capitulos && data.capitulos[nextEpisodeNum.toString()]) {
                const nextVideoUrl = data.capitulos[nextEpisodeNum.toString()];
                const posterUrl = data.backdrop || POSTER_URL;
                const nextTitle = `${seriesName} - T${currentSeason}E${nextEpisodeNum}`;

                nextEpisodeData = `?video=${encodeURIComponent(nextVideoUrl)}&poster=${encodeURIComponent(posterUrl)}&title=${encodeURIComponent(nextTitle)}&id=${TMDB_ID}`;

                // Mostrar botón central
                if (nextEpCenterBtn) {
                    nextEpCenterBtn.style.display = "block";
                }
            }
        } catch (error) {
            console.error("LzPlay Error al buscar siguiente episodio:", error);
        }
    }

    // ==================== FULLSCREEN ====================
    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            player.requestFullscreen?.() || player.webkitRequestFullscreen?.() || player.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
        }
    }

    fullscreenBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        toggleFullscreen();
    });

    player.addEventListener("dblclick", (e) => {
        if (e.target.closest('.controls') || 
            e.target.closest('.settings-menu') || 
            e.target.closest('.resume-modal') || 
            e.target.closest('#btn-next-episode-float') ||
            e.target.tagName === "INPUT") return;
        toggleFullscreen();
    });

    function updateFullscreenIcon() {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        fullscreenBtn.className = isFullscreen ? "fas fa-compress btn" : "fas fa-expand btn";
    }

    document.addEventListener("fullscreenchange", updateFullscreenIcon);
    document.addEventListener("webkitfullscreenchange", updateFullscreenIcon);
    document.addEventListener("msfullscreenchange", updateFullscreenIcon);

    // ==================== FORMATO TIEMPO ====================
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}` : `${m}:${s < 10 ? "0" + s : s}`;
    }

    function updateTotalTime() {
        if (video.duration && !isNaN(video.duration)) {
            totalTimeEl.textContent = formatTime(video.duration);
        }
    }

    function saveProgress() {
        if (video.currentTime > 5 && VIDEO_URL) {
            localStorage.setItem(STORAGE_KEY, video.currentTime);
        }
    }

    // ==================== LÓGICA DEL BOTÓN FLOTANTE =================
    function updateNextEpisodeButton() {
        if (!nextEpisodeData) return;

        const c = video.currentTime;
        const t = video.duration;
        if (!t || isNaN(t)) return;

        let triggerTime = 180;
        if (t > 2400) triggerTime = 300;
        else if (t < 900) triggerTime = 60;

        const timeLeft = t - c;

        if (timeLeft <= triggerTime) {
            nextEpBtn.classList.add('show');
        } else {
            nextEpBtn.classList.remove('show');
        }
    }

    // ==================== EVENTOS ====================
    video.addEventListener("timeupdate", () => {
        const c = video.currentTime;
        const t = video.duration;

        if (!isNaN(t) && t > 0) {
            seek.value = (c / t) * 100;
            currentTimeEl.textContent = formatTime(c);
            updateNextEpisodeButton();
        }

        if (!saveInterval && video.duration) {
            saveInterval = setInterval(saveProgress, 1000);
        }
    });

    function showControls(fast = false) {
        controls.classList.remove("hide");
        updateNextEpisodeButton();

        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (!video.paused) {
                controls.classList.add("hide");
                nextEpBtn.classList.remove('show');
            }
        }, fast ? 900 : 3500);
    }

    let hideTimeout;
    document.addEventListener("mousemove", () => showControls(false));
    document.addEventListener("touchstart", () => showControls(false));

    // ==================== OTRAS FUNCIONES ====================
    function hideBackdropAndShowVideo() {
        backdropOverlay.style.transition = "opacity 0.6s ease";
        backdropOverlay.style.opacity = "0";
        setTimeout(() => { backdropOverlay.style.display = "none"; }, 600);
        video.style.transition = "opacity 0.6s ease";
        video.style.opacity = "1";
    }

    function togglePlay() {
        if (video.paused) {
            if (!hasStarted) {
                hideBackdropAndShowVideo();
                hasStarted = true;
            }
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }

    function rewind() {
        rewindBtn.classList.add("btn-rewind");
        setTimeout(() => rewindBtn.classList.remove("btn-rewind"), 450);
        video.currentTime = Math.max(0, video.currentTime - 10);
    }

    function forward() {
        forwardBtn.classList.add("btn-forward");
        setTimeout(() => forwardBtn.classList.remove("btn-forward"), 450);
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    }

    // Cargar metadata y siguiente episodio
    function loadMetadata() {
        titleEl.textContent = TITLE || "Reproduciendo";
        if (POSTER_URL) {
            backdropOverlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${POSTER_URL}')`;
        }

        if (VIDEO_URL) loadVideo(VIDEO_URL);
        checkNextEpisode(); // ← Muy importante
    }

    function loadVideo(url) {
        if (url.includes(".m3u8") && typeof Hls !== "undefined" && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(video);
        } else {
            video.src = url;
        }
    }

    // Inicialización
    function initPlayer() {
        loadMetadata();
        video.addEventListener("loadedmetadata", () => {
            updateTotalTime();
        });
        video.addEventListener("durationchange", updateTotalTime);
    }

    initPlayer();
});
