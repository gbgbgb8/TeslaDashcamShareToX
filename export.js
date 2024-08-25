let canvas;
let videoContext;
let videoSources = {};

function initializeVideoContext(width, height) {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    videoContext = new VideoContext(canvas);
}

function prepareVideoSources() {
    videoSources = {};
    videos.forEach((video, index) => {
        const source = videoContext.video(video);
        videoSources[index] = source;
    });
}

function applyStandardLayout() {
    Object.keys(videoSources).forEach((index, i) => {
        const source = videoSources[index];
        if (source && typeof source.start === 'function') {
            const node = source.start(0);
            if (i === 0) { // Assuming index 0 is the front camera
                node.connect(videoContext.destination);
            } else {
                const effect = videoContext.effect(VideoContext.DEFINITIONS.OPACITY);
                node.connect(effect);
                effect.connect(videoContext.destination);
                effect.opacity = 0.5; // Make secondary videos semi-transparent
            }
            node.stop(videoContext.duration);
        } else {
            console.error('Invalid video source for index:', index);
        }
    });
}

function startExport(resolution, exportType) {
    if (typeof VideoContext === 'undefined') {
        console.error('VideoContext is not defined. Make sure the library is loaded.');
        return;
    }
    const [width, height] = resolution.split('x').map(Number);
    initializeVideoContext(width, height);
    prepareVideoSources();

    const progressBar = document.querySelector('.progress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    progressBar.classList.remove('d-none');

    if (exportType === 'standard') {
        applyStandardLayout();
    } else {
        // Implement custom layout logic here
        console.log('Custom export not implemented yet');
        return;
    }

    videoContext.play();
    videoContext.onUpdate(() => {
        const progress = (videoContext.currentTime / videoContext.duration) * 100;
        progressBarInner.style.width = `${progress}%`;
        captureFrame();
    });

    videoContext.onEnded(() => {
        encodeAndSaveVideo(width, height);
    });
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

async function encodeAndSaveVideo(width, height) {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    // Write frames to ffmpeg's virtual file system
    for (let i = 0; i < frames.length; i++) {
        const frameName = `frame${i.toString().padStart(6, '0')}.jpg`;
        const frameData = frames[i].split(',')[1];
        ffmpeg.FS('writeFile', frameName, await fetchFile(frameData));
    }

    // Run ffmpeg command
    await ffmpeg.run(
        '-framerate', '30',
        '-pattern_type', 'glob',
        '-i', 'frame*.jpg',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '23',
        '-preset', 'medium',
        '-s', `${width}x${height}`,
        'output.mp4'
    );

    // Read the result
    const data = ffmpeg.FS('readFile', 'output.mp4');

    // Create a download link
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'exported_video.mp4';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);

    frames = []; // Clear frames array
}