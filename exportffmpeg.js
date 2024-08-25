const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

async function initializeFFmpeg() {
    await ffmpeg.load();
    console.log('FFmpeg initialized');
}

async function exportVideo(resolution, exportType) {
    console.log('Starting FFmpeg export...');
    const [width, height] = resolution.split('x').map(Number);

    const progressBar = document.querySelector('.progress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    progressBar.classList.remove('d-none');

    try {
        // Write input videos to FFmpeg's virtual file system
        for (let i = 0; i < videos.length; i++) {
            const videoName = `input${i}.mp4`;
            ffmpeg.FS('writeFile', videoName, await fetchFile(videos[i].src));
        }

        // Construct the FFmpeg command
        let command = [
            '-i', 'input0.mp4',
            '-i', 'input1.mp4',
            '-i', 'input2.mp4',
            '-i', 'input3.mp4',
        ];

        if (exportType === 'standard') {
            command = command.concat([
                '-filter_complex',
                '[0:v]scale=640:480[v0];[1:v]scale=320:240[v1];[2:v]scale=320:240[v2];[3:v]scale=320:240[v3];[v0][v1]overlay=W-w:0[top];[top][v2]overlay=0:H-h[almost];[almost][v3]overlay=W-w:H-h[v]',
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

        // Run the FFmpeg command
        await ffmpeg.run(...command);

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
        exportVideo(resolution, exportType);
    });
}

// Initialize FFmpeg when the page loads
document.addEventListener('DOMContentLoaded', initializeFFmpeg);