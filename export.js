let canvas;

function initializeExport() {
    // No need to add event listeners here anymore
}

// Update showExportModal function to accept an exportType parameter
window.showExportModal = function(exportType) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'exportModal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header">
                    <h5 class="modal-title">Export ${exportType.charAt(0).toUpperCase() + exportType.slice(1)} Video</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="resolutionSelect" class="form-label">Select Resolution:</label>
                        <select id="resolutionSelect" class="form-select">
                            <option value="1280x960">1280x960 (Original)</option>
                            <option value="1280x720">1280x720 (Landscape)</option>
                            <option value="720x1280">720x1280 (Portrait)</option>
                            <option value="720x720">720x720 (Square)</option>
                        </select>
                    </div>
                    <div class="progress d-none">
                        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="startExportButton">Start Export</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const exportModal = new bootstrap.Modal(modal);
    exportModal.show();

    document.getElementById('startExportButton').addEventListener('click', () => {
        const resolution = document.getElementById('resolutionSelect').value;
        exportModal.hide();
        startExport(resolution, exportType);
    });
}

function startExport(resolution, exportType) {
    const [width, height] = resolution.split('x').map(Number);
    initializeVideoContext(width, height);
    prepareVideoSources();

    const progressBar = document.querySelector('.progress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    progressBar.classList.remove('d-none');

    let currentTime = 0;
    const duration = Math.max(...videos.map(v => v.duration));

    let isPlaying = false;

    interactionTimeline.forEach((interaction, index) => {
        const nextInteraction = interactionTimeline[index + 1];
        const endTime = nextInteraction ? nextInteraction.timestamp : duration;

        switch (interaction.type) {
            case 'switchActive':
                applyActiveVideoEffect(interaction.videoIndex, currentTime, endTime);
                break;
            case 'toggleVisibility':
                applyVisibilityEffect(interaction.videoIndex, currentTime, endTime);
                break;
            case 'playPause':
                isPlaying = !isPlaying;
                applyPlayPauseEffect(isPlaying, currentTime, endTime);
                break;
        }

        currentTime = interaction.timestamp;
    });

    // Modify this part to handle different export types
    if (exportType === 'standard') {
        // Apply standard layout before exporting
        setStandardLayout();
    }

    // Start the render
    videoContext.play();
    videoContext.startRendering();

    // Update progress bar
    let lastTime = 0;
    videoContext.registerTimeUpdateCallback((currentTime) => {
        const progress = (currentTime / duration) * 100;
        progressBarInner.style.width = `${progress}%`;
        
        // Capture frames at 30 fps
        if (currentTime - lastTime >= 1/30) {
            captureFrame();
            lastTime = currentTime;
        }
    });

    // When rendering is finished, encode and save the video
    videoContext.onComplete = function() {
        encodeAndSaveVideo(width, height);
        progressBar.classList.add('d-none');
    };
}

function initializeVideoContext(width, height) {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    videoContext = new VideoContext(canvas);
}

function prepareVideoSources() {
    videos.forEach((video, index) => {
        const source = videoContext.video(video.src);
        videoSources[index] = source;
    });
}

function applyActiveVideoEffect(videoIndex, startTime, endTime) {
    const source = videoSources[videoIndex];
    if (source && typeof source.startAt === 'function') {
        const node = source.startAt(startTime);
        node.connect(videoContext.destination);
        node.stop(endTime);
    } else {
        console.error('Invalid video source for index:', videoIndex);
    }
}

function applyVisibilityEffect(videoIndex, startTime, endTime) {
    const source = videoSources[videoIndex];
    if (source && typeof source.startAt === 'function') {
        const node = source.startAt(startTime);
        const effect = videoContext.effect(VideoContext.DEFINITIONS.OPACITY);
        node.connect(effect);
        effect.connect(videoContext.destination);
        effect.opacity = videoStates[videoIndex].isHidden ? 0 : 1;
        node.stop(endTime);
    } else {
        console.error('Invalid video source for index:', videoIndex);
    }
}

function applyPlayPauseEffect(isPlaying, startTime, endTime) {
    Object.values(videoSources).forEach(source => {
        if (isPlaying) {
            const node = source.startAt(startTime);
            if (node && typeof node.connect === 'function') {
                node.connect(videoContext.destination);
                node.stop(endTime);
            }
        } else {
            // If paused, we don't connect the source to the destination
            // This effectively "pauses" the video in the export
            const node = source.startAt(startTime);
            if (node && typeof node.stop === 'function') {
                node.stop(startTime);
            }
        }
    });
}

let frames = [];

function captureFrame() {
    frames.push(canvas.toDataURL('image/jpeg', 0.8));
}

function encodeAndSaveVideo(width, height) {
    const worker = new Worker('ffmpeg-worker-mp4.js');
    worker.onmessage = function(e) {
        const msg = e.data;
        switch (msg.type) {
            case "ready":
                const files = frames.map((frame, index) => {
                    return {
                        name: `frame${index.toString().padStart(6, '0')}.jpg`,
                        data: frame.split(',')[1]
                    };
                });

                worker.postMessage({
                    type: "run",
                    MEMFS: files,
                    arguments: [
                        "-framerate", "30",
                        "-i", "frame%06d.jpg",
                        "-c:v", "libx264",
                        "-preset", "slow",
                        "-crf", "22",
                        "-s", `${width}x${height}`,
                        "-pix_fmt", "yuv420p",
                        "output.mp4"
                    ]
                });
                break;
            case "done":
                const blob = new Blob([msg.data.MEMFS[0].data], { type: "video/mp4" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'exported_video.mp4';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                frames = []; // Clear frames array
                break;
        }
    };
}