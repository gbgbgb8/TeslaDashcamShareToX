document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('dateTimeSelect').addEventListener('change', handleDateTimeChange);
document.getElementById('closeButton').addEventListener('click', () => window.close());

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
                return 'Rear';
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
    const clipList = document.getElementById('clipList');
    
    videoContainer.innerHTML = '';
    clipList.innerHTML = '';
    videos = [];

    if (videoGroups[selectedDateTime]) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid-container';
        videoContainer.appendChild(gridContainer);

        videoGroups[selectedDateTime].forEach((videoData, index) => {
            const videoItem = createVideoItem(videoData, index);
            gridContainer.appendChild(videoItem);
            videos.push(videoItem.querySelector('video'));

            const clipItem = createClipItem(videoData, index);
            clipList.appendChild(clipItem);
        });

        addPlaceholders(gridContainer);
        initializeGridLayout();
    }
}

function createVideoItem(videoData, index) {
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item';
    videoItem.id = `video-item-${videoIdCounter++}`;
    videoItem.dataset.index = index;

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

    const controls = createVideoControls(videoItem);
    videoItem.appendChild(controls);

    return videoItem;
}

function createClipItem(videoData, index) {
    const clipItem = document.createElement('div');
    clipItem.className = 'list-group-item list-group-item-action bg-dark text-light';
    clipItem.dataset.index = index;

    const label = document.createElement('div');
    label.className = 'clip-label';
    label.textContent = extractDateTime(videoData.file.name);
    clipItem.appendChild(label);

    clipItem.addEventListener('click', () => {
        const videoItem = document.getElementById(`video-item-${index}`);
        videoItem.scrollIntoView({ behavior: 'smooth' });
    });

    return clipItem;
}

function createVideoControls(videoItem) {
    const controls = document.createElement('div');
    controls.className = 'video-controls';

    const visibilityToggle = document.createElement('button');
    visibilityToggle.className = 'btn btn-sm btn-outline-light me-2';
    visibilityToggle.innerHTML = '<i class="fas fa-eye"></i> Toggle';
    visibilityToggle.addEventListener('click', () => toggleVideoVisibility(videoItem));
    controls.appendChild(visibilityToggle);

    const primaryToggle = document.createElement('button');
    primaryToggle.className = 'btn btn-sm btn-outline-primary';
    primaryToggle.innerHTML = '<i class="fas fa-expand"></i> Primary';
    primaryToggle.addEventListener('click', () => togglePrimaryVideo(videoItem));
    controls.appendChild(primaryToggle);

    return controls;
}

function toggleVideoVisibility(videoItem) {
    videoItem.classList.toggle('hidden');
    updateGridLayout();
}

function togglePrimaryVideo(videoItem) {
    const gridContainer = videoItem.closest('.grid-container');
    const currentPrimary = gridContainer.querySelector('.video-item.primary');

    if (currentPrimary === videoItem) {
        videoItem.classList.remove('primary');
        videoItem.classList.add('secondary');
        gridContainer.classList.remove('has-primary');
    } else {
        if (currentPrimary) {
            currentPrimary.classList.remove('primary');
            currentPrimary.classList.add('secondary');
        }
        videoItem.classList.add('primary');
        videoItem.classList.remove('secondary');
        gridContainer.classList.add('has-primary');
    }

    updateGridLayout();
}

function initializeGridLayout() {
    const gridContainer = document.querySelector('.grid-container');
    new Sortable(gridContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: updateGridLayout
    });

    updateGridLayout();
}

function addPlaceholders(gridContainer) {
    const videoItems = Array.from(gridContainer.children).filter(item => !item.classList.contains('hidden'));
    const placeholdersNeeded = 4 - videoItems.length;

    for (let i = 0; i < placeholdersNeeded; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'grid-placeholder';
        gridContainer.appendChild(placeholder);
    }
}

function updateGridLayout() {
    const gridContainer = document.querySelector('.grid-container');
    const videoItems = Array.from(gridContainer.children).filter(item => !item.classList.contains('hidden') && !item.classList.contains('grid-placeholder'));
    const hasPrimary = videoItems.some(item => item.classList.contains('primary'));

    videoItems.forEach((item, index) => {
        item.style.gridArea = '';
    });

    if (hasPrimary) {
        const primaryVideo = videoItems.find(item => item.classList.contains('primary'));
        const secondaryVideos = videoItems.filter(item => !item.classList.contains('primary'));

        primaryVideo.style.width = '100%';
        primaryVideo.style.height = '100%';
        secondaryVideos.forEach((item, index) => {
            item.style.width = '20%';
            item.style.height = '20%';
            item.style.top = `${index * 25}%`;
            item.style.left = `${index * 25}%`;
        });
    } else {
        videoItems.forEach((item, index) => {
            item.style.width = '50%';
            item.style.height = '50%';
            const row = Math.floor(index / 2);
            const col = index % 2;
            item.style.top = `${row * 50}%`;
            item.style.left = `${col * 50}%`;
        });
    }
}

function clearPrimarySelection() {
    const gridContainer = document.querySelector('.grid-container');
    const primaryVideo = gridContainer.querySelector('.video-item.primary');
    if (primaryVideo) {
        primaryVideo.classList.remove('primary');
    }
    gridContainer.classList.remove('has-primary');
    updateGridLayout();
}

function resetLayout() {
    const gridContainer = document.querySelector('.grid-container');
    gridContainer.classList.remove('has-primary');
    Array.from(gridContainer.children).forEach(item => {
        item.classList.remove('primary', 'hidden');
    });
    updateGridLayout();
}

function setStandardLayout() {
    const gridContainer = document.querySelector('.grid-container');
    const videoItems = Array.from(gridContainer.children);
    
    videoItems.forEach(item => {
        const cameraType = item.querySelector('.video-label').textContent;
        switch (cameraType) {
            case 'Front':
                item.classList.add('primary');
                item.classList.remove('hidden');
                break;
            case 'Rear':
                item.classList.add('hidden');
                item.classList.remove('primary');
                break;
            case 'Left':
            case 'Right':
                item.classList.remove('hidden', 'primary');
                break;
        }
    });

    gridContainer.classList.add('has-primary');
    updateGridLayout();
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

// Add these event listeners at the end of the file
document.getElementById('exportButton').addEventListener('click', exportClips);
document.getElementById('clearPrimaryButton').addEventListener('click', clearPrimarySelection);
document.getElementById('resetLayoutButton').addEventListener('click', resetLayout);
document.getElementById('standardLayoutButton').addEventListener('click', setStandardLayout);