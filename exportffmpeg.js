const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

async function initializeFFmpeg() {
    console.log('Initializing FFmpeg...');
    try {
        await ffmpeg.load();
        console.log('FFmpeg initialized');
    } catch (error) {
        console.error('Error initializing FFmpeg:', error);
    }
}

async function exportVideo(resolution, exportType) {
    console.log('Starting FFmpeg export...');
    const [width, height] = resolution.split('x').map(Number);
    console.log(`Resolution: ${width}x${height}, Export Type: ${exportType}`);

    const progressWindow = createProgressWindow();
    let isCancelled = false;

    try {
        const cameraOrder = ['front', 'back', 'left_repeater', 'right_repeater'];
        const orderedVideos = cameraOrder.map(cameraType => {
            const video = videos.find(v => {
                const label = v.parentElement.querySelector('.video-label').textContent.toLowerCase();
                return label === cameraType || 
                       (cameraType === 'back' && label === 'rear') ||
                       (cameraType === 'left_repeater' && label === 'left') ||
                       (cameraType === 'right_repeater' && label === 'right');
            });
            return video ? { video, type: cameraType } : null;
        }).filter(Boolean);

        updateProgressLog(progressWindow, 'Ordered videos: ' + orderedVideos.map(v => `${v.type}: ${v.video.src}`).join(', '));

        if (orderedVideos.length === 0) {
            throw new Error('No camera angles found');
        }

        // Write input videos to FFmpeg's virtual file system
        for (let i = 0; i < orderedVideos.length; i++) {
            if (isCancelled) throw new Error('Export cancelled');
            const videoName = `input${i}.mp4`;
            const { video, type } = orderedVideos[i];
            updateProgressLog(progressWindow, `Writing video ${i} (${type}) to FFmpeg FS: ${videoName}`);
            await ffmpeg.FS('writeFile', videoName, await fetchFile(video.src));
        }

        // Construct the FFmpeg command
        let command = orderedVideos.map((_, i) => ['-i', `input${i}.mp4`]).flat();

        if (exportType === 'standard') {
            let filterComplex = [];
            orderedVideos.forEach((_, i) => {
                filterComplex.push(`[${i}:v]scale=${i === 0 ? width : width/4}:${i === 0 ? height : height/4}[v${i}];`);
            });

            // Overlay videos in the correct positions
            filterComplex.push(`[v0][v1]overlay=main_w-overlay_w:0[temp1];`);
            filterComplex.push(`[temp1][v2]overlay=0:main_h-overlay_h[temp2];`);
            filterComplex.push(`[temp2][v3]overlay=main_w-overlay_w:main_h-overlay_h[v]`);

            command = command.concat([
                '-filter_complex', filterComplex.join(''),
                '-map', '[v]',
            ]);
        } else {
            updateProgressLog(progressWindow, 'Custom export not implemented yet');
            return;
        }

        command = command.concat([
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'medium',
            '-s', `${width}x${height}`,
            'output.mp4'
        ]);

        updateProgressLog(progressWindow, 'Running FFmpeg command: ' + command.join(' '));
        // Run the FFmpeg command
        ffmpeg.setProgress(({ ratio, time, fps, speed }) => {
            if (isCancelled) ffmpeg.exit();
            updateProgress(progressWindow, ratio * 100, fps, speed);
        });
        await ffmpeg.run(...command);

        updateProgressLog(progressWindow, 'Reading output file from FFmpeg FS');
        const data = ffmpeg.FS('readFile', 'output.mp4');

        updateProgressLog(progressWindow, 'Export completed successfully');
        showDownloadButton(progressWindow, data);

    } catch (error) {
        console.error('Error during FFmpeg export:', error);
        updateProgressLog(progressWindow, 'Error: ' + error.message);
    }
}

function createProgressWindow() {
    const progressWindow = document.createElement('div');
    progressWindow.className = 'progress-window';
    progressWindow.innerHTML = `
        <h3>Export Progress</h3>
        <div class="progress-stats">
            <span class="fps">0 FPS</span>
            <span class="speed">0x</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar"></div>
        </div>
        <div class="progress-log"></div>
        <button class="cancel-button">Cancel</button>
    `;
    document.body.appendChild(progressWindow);

    const cancelButton = progressWindow.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        isCancelled = true;
        updateProgressLog(progressWindow, 'Export cancelled by user');
    });

    return progressWindow;
}

function updateProgress(progressWindow, percent, fps, speed) {
    const progressBar = progressWindow.querySelector('.progress-bar');
    const fpsElement = progressWindow.querySelector('.fps');
    const speedElement = progressWindow.querySelector('.speed');
    
    if (percent !== undefined && percent !== null) {
        progressBar.style.width = `${percent.toFixed(2)}%`;
        progressBar.classList.remove('indeterminate');
    } else {
        progressBar.style.width = '100%';
        progressBar.classList.add('indeterminate');
    }
    
    fpsElement.textContent = `${fps ? fps.toFixed(2) : '0.00'} FPS`;
    speedElement.textContent = `${speed ? speed.toFixed(2) : '0.00'}x`;
    
    updateProgressLog(progressWindow, `Progress: ${percent ? percent.toFixed(2) : 'N/A'}%, FPS: ${fps ? fps.toFixed(2) : '0.00'}, Speed: ${speed ? speed.toFixed(2) : '0.00'}x`);
}

function updateProgressLog(progressWindow, message) {
    const log = progressWindow.querySelector('.progress-log');
    const logEntry = document.createElement('p');
    logEntry.textContent = message;
    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
}

function showDownloadButton(progressWindow, data) {
    const cancelButton = progressWindow.querySelector('.cancel-button');
    cancelButton.textContent = 'Download';
    cancelButton.onclick = () => {
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'exported_video.mp4';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };
}

window.showExportModal = function(exportType) {
    console.log('Showing export modal for type:', exportType);
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
        console.log('Starting export with resolution:', resolution);
        exportModal.hide();
        exportVideo(resolution, exportType);
    });
}

document.addEventListener('DOMContentLoaded', initializeFFmpeg);