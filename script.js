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
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid-container';
        videoContainer.appendChild(gridContainer);

        videoGroups[selectedDateTime].forEach((videoData, index) => {
            const videoItem = createVideoItem(videoData, index);
            gridContainer.appendChild(videoItem);
            videos.push(videoItem.querySelector('video'));
        });

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
        gridContainer.classList.remove('has-primary');
    } else {
        if (currentPrimary) {
            currentPrimary.classList.remove('primary');
        }
        videoItem.classList.add('primary');
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

function updateGridLayout() {
    const gridContainer = document.querySelector('.grid-container');
    const videoItems = Array.from(gridContainer.children).filter(item => !item.classList.contains('hidden'));
    const hasPrimary = videoItems.some(item => item.classList.contains('primary'));

    videoItems.forEach((item, index) => {
        item.style.gridArea = '';
    });

    if (hasPrimary) {
        const primaryVideo = videoItems.find(item => item.classList.contains('primary'));
        const secondaryVideos = videoItems.filter(item => !item.classList.contains('primary'));

        primaryVideo.style.gridColumn = 'span 2';
        primaryVideo.style.gridRow = 'span 2';
        secondaryVideos.forEach((item, index) => {
            item.style.gridColumn = '';
            item.style.gridRow = '';
        });
    } else {
        videoItems.forEach((item, index) => {
            item.style.gridColumn = '';
            item.style.gridRow = '';
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
            case 'Back':
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