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

async function checkHeaders() {
    try {
        const response = await fetch(window.location.href);
        console.log('Response Headers:');
        for (let [key, value] of response.headers.entries()) {
            console.log(`${key}: ${value}`);
        }
    } catch (error) {
        console.error('Error fetching headers:', error);
    }
}

async function exportVideo(resolution, exportType) {
    console.log('Starting FFmpeg export...');
    const [width, height] = resolution.split('x').map(Number);
    console.log(`Resolution: ${width}x${height}, Export Type: ${exportType}`);

    const progressBar = document.querySelector('.progress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    progressBar.classList.remove('d-none');

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

        console.log('Ordered videos:', orderedVideos.map(v => `${v.type}: ${v.video.src}`));

        if (orderedVideos.length === 0) {
            throw new Error('No camera angles found');
        }

        // Write input videos to FFmpeg's virtual file system
        for (let i = 0; i < orderedVideos.length; i++) {
            const videoName = `input${i}.mp4`;
            const { video, type } = orderedVideos[i];
            console.log(`Writing video ${i} (${type}) to FFmpeg FS: ${videoName}`);
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
            console.log('Custom export not implemented yet');
            return;
        }

        command = command.concat([
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'medium',
            '-s', `${width}x${height}`,
            'output.mp4'
        ]);

        console.log('Running FFmpeg command:', command.join(' '));
        // Run the FFmpeg command
        await ffmpeg.run(...command);

        // Read the result
        console.log('Reading output file from FFmpeg FS');
        const data = ffmpeg.FS('readFile', 'output.mp4');

        // Create a download link
        console.log('Creating download link for output file');
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
            URL.revokeObjectURL(url);
        }, 100);

    } catch (error) {
        console.error('Error during FFmpeg export:', error);
    } finally {
        progressBar.classList.add('d-none');
    }
}

// Update showExportModal function to use FFmpeg export
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
        console.log('Starting export with resolution:', resolution);
        exportModal.hide();
        exportVideo(resolution, exportType);
    });
}

// Initialize FFmpeg and check headers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing FFmpeg and checking headers');
    initializeFFmpeg();
    checkHeaders();
});