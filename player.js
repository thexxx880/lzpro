// Esperar a que el DOM esté completamente cargado
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
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    const params = new URLSearchParams(window.location.search);
    let VIDEO_URL = params.get('video') ? decodeURIComponent(params.get('video')) : '';
    let POSTER_URL = params.get('poster') ? decodeURIComponent(params.get('poster')) : '';
    let TITLE = params.get('title') ? decodeURIComponent(params.get('title')) : 'Reproduciendo';

    // ================= LOGICA DE LOCALSTORAGE =================
    // Usamos el TITLE para crear una clave única. 
    // Ej: "El juego del calamar - T1E1" se convierte en "eljuegodelcalamart1e1"
    // Esto asegura que cada película y cada episodio tenga su propio guardado.
    const baseKey = TITLE !== 'Reproduciendo' ? TITLE : (VIDEO_URL || 'unknown');
    const STORAGE_KEY = `lzplayer_resume_${baseKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

    let hlsInstance = null;
    let hasStarted = false;
    let isChangingQuality = false;
    let saveInterval = null;

    // ==================== FULLSCREEN + FORZAR HORIZONTAL ====================
    async function forceLandscapeAndFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            try {
                if (player.requestFullscreen) await player.requestFullscreen();
                else if (player.webkitRequestFullscreen) await player.webkitRequestFullscreen();
            } catch (e) {}
        }

        if (screen.orientation && typeof screen.orientation.lock === "function") {
            try {
                await screen.orientation.lock("landscape-primary");
            } catch (e) {
                try {
                    await screen.orientation.lock("landscape");
                } catch (err) {}
            }
        }
    }

    // ==================== FUNCIONES DE TIEMPO ====================
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "00:00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}:${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
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

    function loadSavedProgress() {
        if (!VIDEO_URL) return;
        const savedTime = parseFloat(localStorage.getItem(STORAGE_KEY));
        if (savedTime && savedTime > 10) {
            resumeText.innerHTML = `Te quedaste en <strong>${formatTime(savedTime)}</strong>.<br>¿Quieres continuar desde ahí?`;
            resumeModal.classList.add("show");
            
            btnContinue.onclick = () => {
                video.currentTime = savedTime;
                resumeModal.classList.remove("show");
                hideBackdropAndShowVideo();
                hasStarted = true;
                video.play();
            };
            btnRestart.onclick = () => {
                localStorage.removeItem(STORAGE_KEY);
                resumeModal.classList.remove("show");
                hideBackdropAndShowVideo();
                hasStarted = true;
                video.play();
            };
        }
    }

    function hideBackdropAndShowVideo() {
        backdropOverlay.style.opacity = "0";
        setTimeout(() => { backdropOverlay.style.display = "none"; }, 600);
        video.style.opacity = "1";
    }

    function togglePlay() {
        if (video.paused) {
            if (!hasStarted) {
                hideBackdropAndShowVideo();
                hasStarted = true;
            }
            video.play().catch(() => {});
            forceLandscapeAndFullscreen();
        } else {
            video.pause();
        }
    }

    function rewind() {
        video.currentTime = Math.max(0, video.currentTime - 10);
    }

    function forward() {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    }

    function loadVideo(url) {
        if (url.includes(".m3u8") && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(video);
        } else {
            video.src = url;
        }
    }

    function loadMetadata() {
        titleEl.textContent = TITLE;
        if (POSTER_URL) {
            backdropOverlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${POSTER_URL}')`;
        }
        if (VIDEO_URL) loadVideo(VIDEO_URL);
    }

    // ==================== INICIO ====================
    function initPlayer() {
        loadMetadata();

        video.addEventListener("loadedmetadata", () => {
            updateTotalTime();
            loadSavedProgress();
            setTimeout(forceLandscapeAndFullscreen, 800);
        });

        video.addEventListener("play", () => {
            playBtn.className = "fas fa-pause btn big";
        });

        video.addEventListener("pause", () => {
            playBtn.className = "fas fa-play btn big";
        });

        video.addEventListener("timeupdate", () => {
            const c = video.currentTime;
            const t = video.duration;
            if (!isNaN(t) && t > 0) {
                seek.value = (c / t) * 100;
                currentTimeEl.textContent = formatTime(c);
            }
            if (!saveInterval) {
                saveInterval = setInterval(saveProgress, 1000);
            }
        });

        seek.addEventListener("input", () => {
            if (video.duration) video.currentTime = (seek.value / 100) * video.duration;
        });

        fullscreenBtn.addEventListener("click", (e) => {
            e.stopImmediatePropagation();
            forceLandscapeAndFullscreen();
        });

        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyF") forceLandscapeAndFullscreen();
            if (e.code === "Space") { e.preventDefault(); togglePlay(); }
            if (e.code === "ArrowLeft") rewind();
            if (e.code === "ArrowRight") forward();
        });

        document.addEventListener("touchstart", () => {
            forceLandscapeAndFullscreen();
        }, { once: true });
    }

    initPlayer();
});
