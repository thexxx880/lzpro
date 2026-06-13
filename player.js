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

    // ==================== BOTÓN SIGUIENTE INTEGRADO EN CONTROLES ====================
    // Buscamos '.center' o usamos 'controls' como respaldo
    const centerControls = document.querySelector('.center') || controls; 
    const nextEpBtn = document.createElement("i");
    nextEpBtn.className = "fas fa-step-forward btn";
    nextEpBtn.id = "nextEpCenterBtn";
    nextEpBtn.title = "Siguiente Episodio";
    
    // Lo dejamos visible siempre, pero semi-transparente hasta confirmar que hay otro episodio
    nextEpBtn.style.opacity = "0.4"; 
    nextEpBtn.style.cursor = "not-allowed";
    centerControls.appendChild(nextEpBtn);

    nextEpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (nextEpisodeData) {
            console.log("➡️ Redirigiendo al siguiente episodio...");
            window.location.href = nextEpisodeData;
        } else {
            console.log("⚠️ Clic ignorado: No hay datos del siguiente episodio cargados.");
        }
    });

    // ==================== BUSCAR SIGUIENTE EPISODIO CON CONSOLE LOGS ====================
    async function checkNextEpisode() {
        console.log("=== INICIANDO BÚSQUEDA DE SIGUIENTE EPISODIO ===");
        
        if (!TMDB_ID || TITLE === 'Reproduciendo') {
            console.warn("⚠️ Abortado: Faltan datos (TMDB_ID o Título no válido).", { TMDB_ID, TITLE });
            return;
        }

        const match = TITLE.match(/(.*?)\s*-\s*T(\d+)E(\d+)/i);
        if (!match) {
            console.warn("⚠️ Abortado: El formato del título no coincide con 'Serie - T#E#'. Título actual:", TITLE);
            return;
        } 

        const seriesName = match[1].trim();
        const currentSeason = parseInt(match[2], 10);
        const currentEpisode = parseInt(match[3], 10);
        const nextEpisodeNum = currentEpisode + 1;

        console.log(`✅ Metadatos detectados -> Serie: "${seriesName}" | Temp: ${currentSeason} | Cap actual: ${currentEpisode} | Buscando cap: ${nextEpisodeNum}`);

        const jsonUrl = `https://raw.githubusercontent.com/thexxx880/apple/main/data%20base/data/serie/${TMDB_ID}/t${currentSeason}/${TMDB_ID}.json`;
        console.log("🔍 Consultando base de datos JSON en:", jsonUrl);

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                console.error(`❌ Error al obtener el JSON. Estado HTTP: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            console.log("✅ JSON cargado correctamente:", data);
            
            if (data.capitulos && data.capitulos[nextEpisodeNum.toString()]) {
                const nextVideoUrl = data.capitulos[nextEpisodeNum.toString()];
                const posterUrl = data.backdrop || POSTER_URL; 
                const nextTitle = `${seriesName} - T${currentSeason}E${nextEpisodeNum}`;
                
                nextEpisodeData = `?video=${encodeURIComponent(nextVideoUrl)}&poster=${encodeURIComponent(posterUrl)}&title=${encodeURIComponent(nextTitle)}&id=${TMDB_ID}`;
                
                // Activar visualmente el botón porque SÍ hay episodio
                nextEpBtn.style.opacity = "1";
                nextEpBtn.style.cursor = "pointer";
                console.log(`🎉 ¡ÉXITO! Siguiente episodio encontrado preparado: ${nextTitle}`);
            } else {
                console.warn(`🛑 Fin de temporada o datos faltantes: No se encontró el capítulo ${nextEpisodeNum} en el JSON.`);
            }
        } catch (error) {
            console.error("❌ Error crítico durante la petición fetch:", error);
        }
    }

    // ==================== FULLSCREEN ROBUSTO ====================
    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (player.requestFullscreen) player.requestFullscreen();
            else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
            else if (player.msRequestFullscreen) player.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
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
            e.target.tagName === "INPUT") {
            return;
        }
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

    function loadMetadata() {
        titleEl.textContent = TITLE || "Reproduciendo";
        if (POSTER_URL) {
            backdropOverlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${POSTER_URL}')`;
        } else {
            backdropOverlay.style.background = '#111';
        }
        if (VIDEO_URL) loadVideo(VIDEO_URL);
        
        checkNextEpisode(); 
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

    video.addEventListener("waiting", () => { if (isChangingQuality) qualityLoader.classList.add("show"); });
    video.addEventListener("playing", () => { 
        if (isChangingQuality) {
            qualityLoader.classList.remove("show");
            isChangingQuality = false;
        }
    });

    // ==================== ACTUALIZAR TIEMPO Y PROGRESO ====================
    video.addEventListener("timeupdate", () => {
        const c = video.currentTime;
        const t = video.duration;
        
        if (!isNaN(t) && t > 0) {
            seek.value = (c / t) * 100;
            currentTimeEl.textContent = formatTime(c);
        }
        
        if (!saveInterval && video.duration) {
            saveInterval = setInterval(saveProgress, 1000);
        }
    });

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

    settingsBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        settingsMenu.classList.toggle("show");
        settingsBtn.classList.toggle("settings-btn-active");
        if (settingsMenu.classList.contains("show") && hlsInstance) loadQualityOptions();
    });

    document.addEventListener("click", (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
            settingsMenu.classList.remove("show");
            settingsBtn.classList.remove("settings-btn-active");
        }
    });

    function loadQualityOptions() { 
        qualityContainer.innerHTML = "";
        if (!hlsInstance || !hlsInstance.levels.length) {
            qualityContainer.innerHTML = `<div class="quality-option">No hay calidades disponibles</div>`;
            return;
        }
        let bestLevelIndex = 0;
        let maxHeight = 0;
        hlsInstance.levels.forEach((level, i) => {
            if (level.height > maxHeight) { maxHeight = level.height; bestLevelIndex = i; }
        });
        const autoOption = createQualityOption("Auto (Recomendado)", -1, hlsInstance.currentLevel === -1);
        qualityContainer.appendChild(autoOption);
        const sortedLevels = [...hlsInstance.levels].map((level, index) => ({...level, originalIndex: index})).sort((a, b) => b.height - a.height);
        sortedLevels.forEach((level) => {
            const label = `${level.height}p`;
            const isActive = hlsInstance.currentLevel === level.originalIndex;
            const isRecommended = level.originalIndex === bestLevelIndex;
            const option = createQualityOption(label, level.originalIndex, isActive, isRecommended);
            qualityContainer.appendChild(option);
        });
    }

    function createQualityOption(label, levelIndex, isActive, isRecommended = false) {
        const div = document.createElement("div");
        div.className = `quality-option ${isActive ? "active" : ""}`;
        let html = label;
        if (isRecommended) html += `<span class="recommended">Recomendada</span>`;
        if (isActive) html += `<i class="fas fa-check check"></i>`;
        div.innerHTML = html;
        div.addEventListener("click", () => {
            if (!hlsInstance) return;
            isChangingQuality = true;
            qualityLoader.classList.add("show");
            settingsMenu.classList.remove("show");
            settingsBtn.classList.remove("settings-btn-active");
            hlsInstance.currentLevel = levelIndex;
            setTimeout(() => {
                if (isChangingQuality) {
                    qualityLoader.classList.remove("show");
                    isChangingQuality = false;
                }
            }, 12000);
        });
        return div;
    }

    video.addEventListener("play", () => { playBtn.className = "fas fa-pause btn big"; });
    video.addEventListener("pause", () => { playBtn.className = "fas fa-play btn big"; });

    seek.addEventListener("input", () => {
        if (video.duration) video.currentTime = (seek.value / 100) * video.duration;
    });

    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT") return;
        if (e.code === "Space") { e.preventDefault(); togglePlay(); }
        if (e.code === "ArrowLeft") rewind();
        if (e.code === "ArrowRight") forward();
    });

    // ==================== LÓGICA MOSTRAR/OCULTAR CONTROLES ====================
    let hideTimeout;
    function showControls(fast = false) {
        controls.classList.remove("hide");

        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (!video.paused) {
                controls.classList.add("hide");
            }
        }, fast ? 900 : 3500);
    }
    
    document.addEventListener("mousemove", () => showControls(false));
    document.addEventListener("touchstart", () => showControls(false));
    video.addEventListener("click", togglePlay);

    let lastTapTime = 0;
    video.addEventListener("touchend", (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 350 && tapLength > 0) {
            e.preventDefault();
            toggleFullscreen();
        }
        lastTapTime = currentTime;
    });

    function initPlayer() {
        loadMetadata();
        video.addEventListener("loadedmetadata", () => {
            updateTotalTime();
            loadSavedProgress();
        });
        video.addEventListener("durationchange", updateTotalTime);
    }
    initPlayer();
});
