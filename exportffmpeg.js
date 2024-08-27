const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

async function initializeFFmpeg() {
    try {
        await ffmpeg.load();
    } catch (error) {
        console.error('Error initializing FFmpeg:', error);
    }
}

async function exportVideo(resolution, exportType) {
    const [width, height] = resolution.split('x').map(Number);
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

        if (orderedVideos.length === 0) {
            throw new Error('No camera angles found');
        }

        for (let i = 0; i < orderedVideos.length; i++) {
            if (isCancelled) throw new Error('Export cancelled');
            const videoName = `input${i}.mp4`;
            const { video } = orderedVideos[i];
            await ffmpeg.FS('writeFile', videoName, await fetchFile(video.src));
        }

        let command;
        if (exportType === 'standard') {
            command = generateStandardExportCommand(orderedVideos, width, height);
        } else if (exportType === 'custom') {
            command = generateCustomExportCommand(orderedVideos, width, height);
        } else {
            throw new Error('Invalid export type');
        }

        ffmpeg.setProgress(({ ratio }) => {
            if (isCancelled) {
                ffmpeg.exit();
                throw new Error('Export cancelled by user');
            }
            updateProgress(progressWindow, ratio * 100);
        });

        ffmpeg.setLogger(({ type, message }) => {
            if (type === 'fferr') {
                const fpsMatch = message.match(/fps=\s*(\d+)/);
                const speedMatch = message.match(/speed=\s*([\d.]+)x/);
                if (fpsMatch && speedMatch) {
                    const fps = parseFloat(fpsMatch[1]);
                    const speed = parseFloat(speedMatch[1]);
                    updateProgressStats(progressWindow, fps, speed);
                }
            }
        });

        await ffmpeg.run(...command);

        if (isCancelled) throw new Error('Export cancelled by user');

        const data = ffmpeg.FS('readFile', 'output.mp4');
        updateProgressLog(progressWindow, 'Export completed successfully');
        showDownloadButton(progressWindow, data);

    } catch (error) {
        updateProgressLog(progressWindow, 'Error: ' + error.message);
        if (error.message !== 'Export cancelled by user') {
            showCloseButton(progressWindow);
        }
    }
}

function generateStandardExportCommand(orderedVideos, width, height) {
    let command = orderedVideos.map((_, i) => ['-i', `input${i}.mp4`]).flat();
    let filterComplex = [];
    
    orderedVideos.forEach((_, i) => {
        filterComplex.push(`[${i}:v]scale=${i === 0 ? width : width/4}:${i === 0 ? height : height/4}[v${i}];`);
    });

    filterComplex.push(`[v0][v1]overlay=main_w-overlay_w:0[temp1];`);
    filterComplex.push(`[temp1][v2]overlay=0:main_h-overlay_h[temp2];`);
    filterComplex.push(`[temp2][v3]overlay=main_w-overlay_w:main_h-overlay_h[v]`);

    command = command.concat([
        '-filter_complex', filterComplex.join(''),
        '-map', '[v]',
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-s', `${width}x${height}`,
        'output.mp4'
    ]);

    return command;
}

function generateCustomExportCommand(orderedVideos, width, height) {
    let command = orderedVideos.map((_, i) => ['-i', `input${i}.mp4`]).flat();
    let filterComplex = [];
    let currentTime = 0;
    let activeVideo = 0;
    let visibleVideos = new Set([0, 1, 2, 3]); // Initially, all videos are visible

    // Sort interactions by timestamp in ascending order
    const sortedInteractions = interactionTimeline.sort((a, b) => a.timestamp - b.timestamp);

    sortedInteractions.forEach((interaction, index) => {
        const nextInteraction = sortedInteractions[index + 1];
        const duration = nextInteraction ? nextInteraction.timestamp - interaction.timestamp : videos[0].duration - interaction.timestamp;

        switch (interaction.type) {
            case 'switchActive':
                activeVideo = interaction.videoIndex;
                break;
            case 'toggleVisibility':
                if (interaction.additionalData && interaction.additionalData.isHidden !== undefined) {
                    if (interaction.additionalData.isHidden) {
                        visibleVideos.delete(interaction.videoIndex);
                    } else {
                        visibleVideos.add(interaction.videoIndex);
                    }
                } else {
                    // Toggle visibility if isHidden is not provided
                    if (visibleVideos.has(interaction.videoIndex)) {
                        visibleVideos.delete(interaction.videoIndex);
                    } else {
                        visibleVideos.add(interaction.videoIndex);
                    }
                }
                break;
            case 'seek':
                currentTime = interaction.timestamp;
                break;
        }

        if (duration > 0 && visibleVideos.size > 0) {
            let visibleVideoFilters = Array.from(visibleVideos).map(vIndex => {
                return `[${vIndex}:v]trim=${currentTime}:${currentTime + duration},setpts=PTS-STARTPTS[v${vIndex}_${index}];`;
            }).join('');

            filterComplex.push(visibleVideoFilters);

            if (visibleVideos.size > 1) {
                let overlayCommand = Array.from(visibleVideos).reduce((acc, vIndex, i) => {
                    if (i === 0) return `[v${vIndex}_${index}]`;
                    if (i === 1) return `${acc}[v${vIndex}_${index}]overlay=${vIndex % 2 === 1 ? 'W/2' : '0'}:${vIndex >= 2 ? 'H/2' : '0'}`;
                    return `${acc}[temp${i-1}];[temp${i-1}][v${vIndex}_${index}]overlay=${vIndex % 2 === 1 ? 'W/2' : '0'}:${vIndex >= 2 ? 'H/2' : '0'}`;
                }, '');

                if (visibleVideos.size > 2) overlayCommand += `[temp${visibleVideos.size-1}]`;
                filterComplex.push(`${overlayCommand}[out${index}];`);
            } else {
                filterComplex.push(`[v${Array.from(visibleVideos)[0]}_${index}]crop=iw:ih[out${index}];`);
            }

            currentTime += duration;
        }
    });

    // Concatenate all segments
    const outLabels = filterComplex.filter(f => f.includes('[out')).map((_, i) => `[out${i}]`).join('');
    if (outLabels) {
        filterComplex.push(`${outLabels}concat=n=${outLabels.split('][').length}:v=1[outv]`);

        command = command.concat([
            '-filter_complex', filterComplex.join(''),
            '-map', '[outv]',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'medium',
            '-s', `${width}x${height}`,
            'output.mp4'
        ]);
    } else {
        // If no segments were created, return an error
        throw new Error('No visible video segments were created. The export cannot be completed.');
    }

    return command;
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
        <div class="button-container">
            <button class="cancel-button">Cancel</button>
            <button class="download-button" style="display: none;">Download</button>
        </div>
    `;
    document.body.appendChild(progressWindow);

    const cancelButton = progressWindow.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        isCancelled = true;
        updateProgressLog(progressWindow, 'Export cancelled by user');
        showCloseButton(progressWindow);
    });

    return progressWindow;
}

function updateProgress(progressWindow, percent) {
    const progressBar = progressWindow.querySelector('.progress-bar');
    progressBar.style.width = `${percent.toFixed(2)}%`;
}

function updateProgressStats(progressWindow, fps, speed) {
    const fpsElement = progressWindow.querySelector('.fps');
    const speedElement = progressWindow.querySelector('.speed');
    
    fpsElement.textContent = `${fps.toFixed(2)} FPS`;
    speedElement.textContent = `${speed.toFixed(2)}x`;
}

function updateProgressLog(progressWindow, message) {
    const log = progressWindow.querySelector('.progress-log');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${timestamp}] ${message}`;
    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
    console.log(`[Export Progress] ${message}`);
}

function showDownloadButton(progressWindow, data) {
    const downloadButton = progressWindow.querySelector('.download-button');
    const cancelButton = progressWindow.querySelector('.cancel-button');
    
    downloadButton.style.display = 'inline-block';
    cancelButton.textContent = 'Close';
    
    downloadButton.onclick = () => {
        updateProgressLog(progressWindow, 'Download button clicked');

        // Create blob and URL
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        updateProgressLog(progressWindow, `Blob created: ${blob.size} bytes`);
        updateProgressLog(progressWindow, `URL created: ${url}`);

        // Create invisible download link
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported_video.mp4';
        document.body.appendChild(a);
        updateProgressLog(progressWindow, 'Download link created');

        // Trigger download
        try {
            a.click();
            updateProgressLog(progressWindow, 'Download link clicked');
        } catch (error) {
            updateProgressLog(progressWindow, `Error triggering download: ${error.message}`);
        }

        // Clean up
        document.body.removeChild(a);
        updateProgressLog(progressWindow, 'Download link removed from document');

        // Log download start
        updateProgressLog(progressWindow, 'Download process completed.');
    };

    cancelButton.onclick = () => {
        document.body.removeChild(progressWindow);
        URL.revokeObjectURL(url);
        updateProgressLog(progressWindow, 'Progress window closed');
    };
}

function showCloseButton(progressWindow) {
    const downloadButton = progressWindow.querySelector('.download-button');
    const cancelButton = progressWindow.querySelector('.cancel-button');
    
    downloadButton.style.display = 'none';
    cancelButton.textContent = 'Close';
    cancelButton.onclick = () => {
        document.body.removeChild(progressWindow);
    };
}

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
        exportVideo(resolution, exportType);
    });
}

document.addEventListener('DOMContentLoaded', initializeFFmpeg);