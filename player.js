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
    const resumeModal = document.getElementById("resume-modal");
    const resumeText = document.getElementById("resume-text");
    const btnContinue = document.getElementById("btn-continue");
    const btnRestart = document.getElementById("btn-restart");
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    const params = new URLSearchParams(window.location.search);
    let VIDEO_URL = params.get('video') ? decodeURIComponent(params.get('video')) : '';
    let POSTER_URL = params.get('poster') ? decodeURIComponent(params.get('poster')) : '';
    let TITLE = params.get('title') ? decodeURIComponent(params.get('title')) : 'Reproduciendo';
    let TMDB_ID = params.get('id') || null;

    // ================= LOGICA DE LOCALSTORAGE =================
    const baseKey = TITLE !== 'Reproduciendo' ? TITLE : (VIDEO_URL || 'unknown');
    const STORAGE_KEY = `lzplayer_resume_${baseKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

    let hlsInstance = null;
    let hasStarted = false;
    let saveInterval = null;
    let nextEpisodeData = null;

    // ==================== CREAR BOTÓN SIGUIENTE EPISODIO ====================
    const nextEpBtn = document.createElement("button");
    nextEpBtn.id = "btn-next-episode";
    nextEpBtn.innerHTML = 'Siguiente Episodio <i class="fas fa-step-forward"></i>';
    document.body.appendChild(nextEpBtn);

    // Estilos del botón
    const style = document.createElement('style');
    style.innerHTML = `
        #btn-next-episode {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(229, 9, 20, 0.9);
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-20px);
            transition: all 0.4s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #btn-next-episode.show {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #btn-next-episode:hover {
            background: rgba(255, 15, 25, 1);
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);

    nextEpBtn.addEventListener("click", () => {
        if (nextEpisodeData) {
            // Al hacer clic, redirige a la misma página del player pero con los nuevos parámetros
            window.location.href = nextEpisodeData;
        }
    });

    // ==================== BUSCAR SIGUIENTE EPISODIO ====================
    async function checkNextEpisode() {
        if (!TMDB_ID || TITLE === 'Reproduciendo') return;

        // Extraer nombre de la serie, temporada y episodio del título (Ej: "Brandy Y El Sr. Bigotes - T1E1")
        const match = TITLE.match(/(.*?)\s*-\s*T(\d+)E(\d+)/i);
        if (!match) return; 

        const seriesName = match[1].trim();
        const currentSeason = parseInt(match[2], 10);
        const currentEpisode = parseInt(match[3], 10);
        const nextEpisodeNum = currentEpisode + 1;

        // Construir URL del JSON en GitHub
        const jsonUrl = `https://raw.githubusercontent.com/thexxx880/apple/main/data%20base/data/serie/${TMDB_ID}/t${currentSeason}/${TMDB_ID}.json`;

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                console.error("LzPlay: No se pudo cargar el JSON de la serie desde", jsonUrl);
                return;
            }
            
            const data = await response.json();
            
            // Verificar si existe la llave "capitulos" y dentro de ella el número del siguiente episodio
            if (data.capitulos && data.capitulos[nextEpisodeNum.toString()]) {
                const nextVideoUrl = data.capitulos[nextEpisodeNum.toString()];
                const posterUrl = data.backdrop || POSTER_URL; 
                const nextTitle = `${seriesName} - T${currentSeason}E${nextEpisodeNum}`;
                
                // Generar los parámetros (relativos) para la recarga del reproductor
                nextEpisodeData = `?video=${encodeURIComponent(nextVideoUrl)}&poster=${encodeURIComponent(posterUrl)}&title=${encodeURIComponent(nextTitle)}&id=${TMDB_ID}`;
                
                console.log(`LzPlay: Siguiente episodio cargado en segundo plano -> T${currentSeason}E${nextEpisodeNum}`);
            } else {
                console.log(`LzPlay: No hay un episodio ${nextEpisodeNum} en la temporada ${currentSeason}.`);
            }
        } catch (error) {
            console.error("LzPlay: Error procesando el JSON del siguiente episodio:", error);
        }
    }

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
                try { await screen.orientation.lock("landscape"); } catch (err) {}
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

    function rewind() { video.currentTime = Math.max(0, video.currentTime - 10); }
    function forward() { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); }

    function loadVideo(url) {
        if (url.includes(".m3u8") && typeof Hls !== 'undefined' && Hls.isSupported()) {
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
        
        checkNextEpisode();
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
                
                // --- LÓGICA DE APARICIÓN DEL BOTÓN ---
                let triggerTime = 300; // Por defecto (5 minutos)
                
                if (t > 2400) { 
                    // Si dura MÁS de 40 minutos (40 * 60 = 2400s) -> Faltando 5 minutos
                    triggerTime = 300; 
                } else if (t < 900) { 
                    // Si dura MENOS de 15 minutos (15 * 60 = 900s) -> Faltando 3 minutos
                    triggerTime = 180; 
                } else {
                    // Si dura ENTRE 15 y 40 minutos -> Faltando 4 minutos
                    triggerTime = 240;
                }

                const timeLeft = t - c;
                
                // Mostrar el botón si falta el tiempo establecido Y se encontró siguiente episodio
                if (timeLeft <= triggerTime && nextEpisodeData) {
                    nextEpBtn.classList.add('show');
                } else {
                    nextEpBtn.classList.remove('show');
                }
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
