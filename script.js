document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('dateTimeSelect').addEventListener('change', handleDateTimeChange);

let videoGroups = {};
let videos = [];

function handleFileSelect(event) {
    const files = event.target.files;
    const dateTimeSelect = document.getElementById('dateTimeSelect');
    
    dateTimeSelect.innerHTML = '';
    videoGroups = {};
    videos = [];

    Array.from(files).forEach(file => {
        if (file.type === 'video/mp4') {
            const dateTime = extractDateTime(file.name);
            if (!videoGroups[dateTime]) {
                videoGroups[dateTime] = [];
            }
            videoGroups[dateTime].push(file);
        }
    });

    // Populate the dateTimeSelect dropdown
    Object.keys(videoGroups).forEach(dateTime => {
        const option = document.createElement('option');
        option.value = dateTime;
        option.textContent = dateTime;
        dateTimeSelect.appendChild(option);
    });

    // Automatically select the first option
    if (dateTimeSelect.options.length > 0) {
        dateTimeSelect.selectedIndex = 0;
        handleDateTimeChange();
    }
}

function extractDateTime(fileName) {
    const match = fileName.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
    return match ? match[1] : 'Unknown';
}

function extractCameraType(fileName) {
    const match = fileName.match(/-(front|back|left_repeater|right_repeater)\.mp4$/);
    if (match) {
        switch (match[1]) {
            case 'front':
                return 'Front';
            case 'back':
                return 'Back';
            case 'left_repeater':
                return 'Left';
            case 'right_repeater':
                return 'Right';
        }
    }
    return 'Unknown';
}

function handleDateTimeChange() {
    const dateTimeSelect = document.getElementById('dateTimeSelect');
    const selectedDateTime = dateTimeSelect.value;
    const videoContainer = document.getElementById('videoContainer');
    
    videoContainer.innerHTML = '';
    videos = [];

    if (videoGroups[selectedDateTime]) {
        videoGroups[selectedDateTime].forEach(file => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item card';

            const label = document.createElement('label');
            label.className = 'video-label';
            label.textContent = extractCameraType(file.name);
            videoItem.appendChild(label);

            const videoElement = document.createElement('video');
            videoElement.controls = true;
            videoElement.src = URL.createObjectURL(file);
            videoElement.draggable = true;
            videoElement.addEventListener('dragstart', handleDragStart);
            videoElement.addEventListener('dragover', handleDragOver);
            videoElement.addEventListener('drop', handleDrop);
            videoElement.addEventListener('play', handlePlay);
            videoElement.addEventListener('pause', handlePause);
            videoElement.addEventListener('timeupdate', handleTimeUpdate);
            videoItem.appendChild(videoElement);

            const controls = document.createElement('div');
            controls.className = 'video-controls';

            const visibilityCheckbox = document.createElement('input');
            visibilityCheckbox.type = 'checkbox';
            visibilityCheckbox.checked = true;
            visibilityCheckbox.addEventListener('change', () => {
                videoElement.style.display = visibilityCheckbox.checked ? 'block' : 'none';
            });
            controls.appendChild(visibilityCheckbox);

            const primaryRadio = document.createElement('input');
            primaryRadio.type = 'radio';
            primaryRadio.name = 'primaryVideo';
            primaryRadio.addEventListener('change', () => {
                videos.forEach(v => v.classList.remove('primary'));
                if (primaryRadio.checked) {
                    videoElement.classList.add('primary');
                }
            });
            controls.appendChild(primaryRadio);

            videoItem.appendChild(controls);
            videoContainer.appendChild(videoItem);
            videos.push(videoElement);
        });

        // Add export button
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export Selected Clips';
        exportButton.className = 'btn btn-primary';
        exportButton.addEventListener('click', exportClips);
        videoContainer.appendChild(exportButton);
    }
}

function handleDragStart(event) {
    event.dataTransfer.setData('text/plain', event.target.src);
}

function handleDragOver(event) {
    event.preventDefault();
}

function handleDrop(event) {
    event.preventDefault();
    const draggedSrc = event.dataTransfer.getData('text/plain');
    const targetSrc = event.target.src;

    const draggedElement = Array.from(document.querySelectorAll('video')).find(video => video.src === draggedSrc);
    const targetElement = Array.from(document.querySelectorAll('video')).find(video => video.src === targetSrc);

    if (draggedElement && targetElement) {
        const draggedIndex = Array.from(draggedElement.parentNode.children).indexOf(draggedElement);
        const targetIndex = Array.from(targetElement.parentNode.children).indexOf(targetElement);

        if (draggedIndex < targetIndex) {
            targetElement.after(draggedElement);
        } else {
            targetElement.before(draggedElement);
        }
    }
}

function handlePlay(event) {
    videos.forEach(video => {
        if (video !== event.target) {
            video.currentTime = event.target.currentTime;
            video.play();
        }
    });
}

function handlePause(event) {
    videos.forEach(video => {
        if (video !== event.target) {
            video.pause();
        }
    });
}

function handleTimeUpdate(event) {
    videos.forEach(video => {
        if (video !== event.target && Math.abs(video.currentTime - event.target.currentTime) > 0.1) {
            video.currentTime = event.target.currentTime;
        }
    });
}

function exportClips() {
    const selectedVideos = Array.from(document.querySelectorAll('video'));
    const exportData = selectedVideos.map(video => video.src);

    // For simplicity, we'll just log the export data
    console.log('Exporting clips:', exportData);

    // Implement actual export logic here (e.g., creating a zip file)
}