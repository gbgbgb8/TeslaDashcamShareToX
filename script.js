document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('dateTimeSelect').addEventListener('change', handleDateTimeChange);

let videoGroups = {};
let videos = [];
let videoIdCounter = 0;
let gridLayout = [];

function handleFileSelect(event) {
    const files = event.target.files;
    const dateTimeSelect = document.getElementById('dateTimeSelect');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    dateTimeSelect.innerHTML = '';
    videoGroups = {};
    videos = [];

    loadingOverlay.classList.remove('d-none');

    Promise.all(Array.from(files).map(file => {
        if (file.type === 'video/mp4') {
            const dateTime = extractDateTime(file.name);
            if (!videoGroups[dateTime]) {
                videoGroups[dateTime] = [];
            }
            return new Promise((resolve) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    videoGroups[dateTime].push({
                        file: file,
                        duration: video.duration
                    });
                    resolve();
                };
                video.src = URL.createObjectURL(file);
            });
        }
        return Promise.resolve();
    })).then(() => {
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

        loadingOverlay.classList.add('d-none');
        document.getElementById('exportButton').disabled = false;
        document.getElementById('clearPrimaryButton').disabled = false;
    });
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
        videoGroups[selectedDateTime].forEach((videoData, index) => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            videoItem.id = `video-item-${videoIdCounter++}`;
            videoItem.draggable = true;
            videoItem.addEventListener('dragstart', handleDragStart);
            videoItem.addEventListener('dragover', handleDragOver);
            videoItem.addEventListener('drop', handleDrop);
            videoItem.addEventListener('dragend', handleDragEnd);
            videoItem.addEventListener('touchstart', handleTouchStart);
            videoItem.addEventListener('touchmove', handleTouchMove);
            videoItem.addEventListener('touchend', handleTouchEnd);

            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = extractCameraType(videoData.file.name);
            videoItem.appendChild(label);

            const videoElement = document.createElement('video');
            videoElement.controls = true;
            videoElement.src = URL.createObjectURL(videoData.file);
            videoElement.addEventListener('play', handlePlay);
            videoElement.addEventListener('pause', handlePause);
            videoElement.addEventListener('timeupdate', handleTimeUpdate);
            videoItem.appendChild(videoElement);

            const controls = document.createElement('div');
            controls.className = 'video-controls';

            const visibilityCheckbox = document.createElement('input');
            visibilityCheckbox.type = 'checkbox';
            visibilityCheckbox.className = 'form-check-input';
            visibilityCheckbox.checked = true;
            visibilityCheckbox.addEventListener('change', () => {
                videoItem.style.display = visibilityCheckbox.checked ? 'flex' : 'none';
                updateGridLayout();
            });
            const visibilityLabel = document.createElement('label');
            visibilityLabel.className = 'form-check-label';
            visibilityLabel.appendChild(visibilityCheckbox);
            visibilityLabel.appendChild(document.createTextNode(' Visible'));
            controls.appendChild(visibilityLabel);

            // Add primary button
            const primaryButton = document.createElement('button');
            primaryButton.textContent = 'Set Primary';
            primaryButton.className = 'btn btn-sm btn-outline-primary ms-2';
            primaryButton.addEventListener('click', () => setPrimaryVideo(videoItem));
            controls.appendChild(primaryButton);

            videoItem.appendChild(controls);
            videoContainer.appendChild(videoItem);
            videos.push(videoElement);

            videoItem.dataset.index = index;
        });

        gridLayout = Array.from({ length: videoGroups[selectedDateTime].length }, (_, i) => i);
        updateGridLayout();
    }
}

function setPrimaryVideo(videoItem) {
    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    videoItems.forEach(item => item.classList.remove('primary'));
    videoItem.classList.add('primary');
    updateGridLayout();
}

function updateGridLayout() {
    const videoContainer = document.getElementById('videoContainer');
    const videoItems = Array.from(videoContainer.querySelectorAll('.video-item'));
    const primaryVideo = videoContainer.querySelector('.video-item.primary');
    const visibleVideos = videoItems.filter(item => item.style.display !== 'none');

    if (primaryVideo) {
        primaryVideo.style.width = '100%';
        primaryVideo.style.height = '100%';
        primaryVideo.style.top = '0';
        primaryVideo.style.left = '0';
        primaryVideo.style.zIndex = '1';

        const secondaryVideos = visibleVideos.filter(item => !item.classList.contains('primary'));
        const positions = [
            { top: '0', left: '50%' },
            { top: '50%', left: '0' },
            { top: '50%', left: '50%' }
        ];

        secondaryVideos.forEach((video, index) => {
            video.style.width = '50%';
            video.style.height = '50%';
            video.style.top = positions[index].top;
            video.style.left = positions[index].left;
            video.style.zIndex = '2';
        });
    } else {
        const gridSize = Math.ceil(Math.sqrt(visibleVideos.length));
        visibleVideos.forEach((video, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            video.style.width = `${100 / gridSize}%`;
            video.style.height = `${100 / gridSize}%`;
            video.style.top = `${(row * 100) / gridSize}%`;
            video.style.left = `${(col * 100) / gridSize}%`;
            video.style.zIndex = '1';
        });
    }

    // Ensure all videos are visible and clickable
    videoItems.forEach(video => {
        video.style.pointerEvents = 'auto';
    });
}

function handleDrop(event) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    const draggedElement = document.getElementById(draggedId);
    const videoContainer = document.getElementById('videoContainer');
    const rect = videoContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (draggedElement) {
        // Calculate the drop position
        const dropX = Math.floor(x / (rect.width / 2)) * 50;
        const dropY = Math.floor(y / (rect.height / 2)) * 50;

        // Set the position of the dragged element
        draggedElement.style.left = `${dropX}%`;
        draggedElement.style.top = `${dropY}%`;

        // If dropped on another video, swap their positions
        const targetElement = event.target.closest('.video-item');
        if (targetElement && targetElement !== draggedElement) {
            const targetX = targetElement.style.left;
            const targetY = targetElement.style.top;
            targetElement.style.left = draggedElement.style.left;
            targetElement.style.top = draggedElement.style.top;
            draggedElement.style.left = targetX;
            draggedElement.style.top = targetY;
        }

        updateGridLayout();
    }
}

function clearPrimarySelection() {
    const primaryVideo = document.querySelector('.video-item.primary');
    if (primaryVideo) {
        primaryVideo.classList.remove('primary');
        updateGridLayout();
    }
}

function handleDragStart(event) {
    event.dataTransfer.setData('text/plain', event.target.id);
    setTimeout(() => {
        event.target.style.visibility = 'hidden';
    }, 50);
}

function handleDragOver(event) {
    event.preventDefault();
}

function handleDragEnd(event) {
    event.target.style.visibility = 'visible';
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

function handleTouchStart(event) {
    const touch = event.touches[0];
    const videoItem = event.target.closest('.video-item');
    videoItem.dataset.touchStartX = touch.clientX;
    videoItem.dataset.touchStartY = touch.clientY;
    videoItem.classList.add('dragging');
}

function handleTouchMove(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const videoItem = event.target.closest('.video-item');
    const deltaX = touch.clientX - videoItem.dataset.touchStartX;
    const deltaY = touch.clientY - videoItem.dataset.touchStartY;
    
    videoItem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
}

function handleTouchEnd(event) {
    const videoItem = event.target.closest('.video-item');
    videoItem.style.transform = '';
    videoItem.classList.remove('dragging');
    
    const touch = event.changedTouches[0];
    const videoContainer = document.getElementById('videoContainer');
    const rect = videoContainer.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Calculate the drop position
    const dropX = Math.floor(x / (rect.width / 2)) * 50;
    const dropY = Math.floor(y / (rect.height / 2)) * 50;

    // Set the position of the dragged element
    videoItem.style.left = `${dropX}%`;
    videoItem.style.top = `${dropY}%`;

    // If dropped on another video, swap their positions
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY).closest('.video-item');
    if (targetElement && targetElement !== videoItem) {
        const targetX = targetElement.style.left;
        const targetY = targetElement.style.top;
        targetElement.style.left = videoItem.style.left;
        targetElement.style.top = videoItem.style.top;
        videoItem.style.left = targetX;
        videoItem.style.top = targetY;
    }

    updateGridLayout();
}

function exportClips() {
    const selectedVideos = Array.from(document.querySelectorAll('video'));
    const exportData = selectedVideos.map(video => video.src);

    // For simplicity, we'll just log the export data
    console.log('Exporting clips:', exportData);

    // Implement actual export logic here (e.g., creating a zip file)
}

function resetLayout() {
    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    videoItems.forEach(item => {
        item.style.display = 'flex';
        item.classList.remove('primary');
    });
    gridLayout = Array.from({ length: videoItems.length }, (_, i) => i);
    updateGridLayout();
}

function setStandardLayout() {
    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    videoItems.forEach(item => {
        const cameraType = item.querySelector('.video-label').textContent;
        switch (cameraType) {
            case 'Front':
                item.style.display = 'flex';
                item.classList.add('primary');
                break;
            case 'Back':
                item.style.display = 'none';
                break;
            case 'Left':
                item.style.display = 'flex';
                item.classList.remove('primary');
                break;
            case 'Right':
                item.style.display = 'flex';
                item.classList.remove('primary');
                break;
        }
    });
    
    gridLayout = ['Front', 'Left', 'Right'].map(type => 
        videoItems.findIndex(item => item.querySelector('.video-label').textContent === type)
    );
    
    updateGridLayout();
}

// Add these event listeners at the end of the file
document.getElementById('exportButton').addEventListener('click', exportClips);
document.getElementById('clearPrimaryButton').addEventListener('click', clearPrimarySelection);
document.getElementById('resetLayoutButton').addEventListener('click', resetLayout);
document.getElementById('standardLayoutButton').addEventListener('click', setStandardLayout);