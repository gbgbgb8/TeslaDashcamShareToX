const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

async function initializeFFmpeg() {
    try {
        await ffmpeg.load();
    } catch (error) {
        console.error('Error initializing FFmpeg:', error);
    }
}

async function exportVideo(resolution, exportType, customInteractions = null) {
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
            command = generateCustomExportCommand(orderedVideos, width, height, customInteractions);
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

        console.log('Running FFmpeg command:', command.join(' '));
        await ffmpeg.run(...command, '-report');  // Add -report flag to generate a log file
        console.log('FFmpeg command completed');

        if (isCancelled) throw new Error('Export cancelled by user');

        console.log('Checking for output file...');
        const files = await ffmpeg.FS('readdir', '/');
        console.log('Files in FFmpeg filesystem:', files);

        if (!files.includes('output.mp4')) {
            console.error('Output file not found. Checking FFmpeg log...');
            
            // Try to read the FFmpeg log file
            const logFiles = files.filter(file => file.startsWith('ffmpeg-') && file.endsWith('.log'));
            if (logFiles.length > 0) {
                const logContent = await ffmpeg.FS('readFile', logFiles[0]);
                console.error('FFmpeg log content:', new TextDecoder().decode(logContent));
            } else {
                console.error('No FFmpeg log file found');
            }

            throw new Error('Output file not found. FFmpeg command may have failed.');
        }

        const data = await ffmpeg.FS('readFile', 'output.mp4');
        console.log('Output file read successfully. Size:', data.length);

        updateProgressLog(progressWindow, 'Export completed successfully');
        showDownloadButton(progressWindow, data);

    } catch (error) {
        console.error('Error during export:', error);
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

function generateCustomExportCommand(orderedVideos, width, height, customInteractions) {
    let command = orderedVideos.map((_, i) => ['-i', `input${i}.mp4`]).flat();
    let filterComplex = [];
    let currentTime = 0;
    let activeVideo = 0;
    let visibleVideos = new Set([0, 1, 2, 3]); // Initially, all videos are visible

    if (customInteractions.length === 0) {
        console.warn('No custom interactions found. Falling back to standard export.');
        return generateStandardExportCommand(orderedVideos, width, height);
    }

    customInteractions.forEach((interaction, index) => {
        const nextInteraction = customInteractions[index + 1];
        const duration = nextInteraction ? nextInteraction.timestamp - interaction.timestamp : orderedVideos[0].video.duration - interaction.timestamp;

        switch (interaction.type) {
            case 'switchActive':
                activeVideo = interaction.videoIndex;
                break;
            case 'toggleVisibility':
                if (Array.isArray(interaction.visibleVideos)) {
                    visibleVideos = new Set(interaction.visibleVideos);
                } else if (interaction.videoIndex !== undefined) {
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
        console.warn('No output segments created. Falling back to standard export.');
        return generateStandardExportCommand(orderedVideos, width, height);
    }

    console.log('Generated FFmpeg command:', command.join(' '));
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

document.addEventListener('DOMContentLoaded', initializeFFmpeg);