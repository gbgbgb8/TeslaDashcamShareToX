document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('dateTimeSelect').addEventListener('change', handleDateTimeChange);
    document.getElementById('standardLayoutButton').addEventListener('click', setStandardLayout);
    document.getElementById('exportButton').addEventListener('click', exportClips);
    document.getElementById('playPauseButton').addEventListener('click', togglePlayPause);

    // Initialize any other event listeners or setup code here
});

let videoGroups = {};
let videos = [];
let videoIdCounter = 0;
let gridLayout = [];

let isPlaying = false;

function togglePlayPause() {
    const playPauseButton = document.getElementById('playPauseButton');
    const icon = playPauseButton.querySelector('i');
    
    isPlaying = !isPlaying;
    
    if (isPlaying) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
        playAllVideos();
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
        pauseAllVideos();
    }
}

function playAllVideos() {
    videos.forEach(video => {
        video.play();
    });
}

function pauseAllVideos() {
    videos.forEach(video => {
        video.pause();
    });
}

function handlePlay(event) {
    if (!isPlaying) {
        isPlaying = true;
        updatePlayPauseButton();
    }
    videos.forEach(video => {
        if (video !== event.target) {
            video.currentTime = event.target.currentTime;
            video.play();
        }
    });
}

function handlePause(event) {
    if (isPlaying) {
        isPlaying = false;
        updatePlayPauseButton();
    }
    videos.forEach(video => {
        if (video !== event.target) {
            video.pause();
        }
    });
}

function updatePlayPauseButton() {
    const playPauseButton = document.getElementById('playPauseButton');
    const icon = playPauseButton.querySelector('i');
    
    if (isPlaying) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

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
            setStandardLayout(); // Apply Standard Layout immediately after loading
        }

        loadingOverlay.classList.add('d-none');
        document.getElementById('exportButton').disabled = false;
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
    
    videoContainer.innerHTML = '<div class="grid-container"></div><div class="active-view">Active View</div>';
    const gridContainer = videoContainer.querySelector('.grid-container');
    clipList.innerHTML = '';
    videos = [];

    if (videoGroups[selectedDateTime]) {
        videoGroups[selectedDateTime].forEach((videoData, index) => {
            const videoItem = createVideoItem(videoData, index);
            gridContainer.appendChild(videoItem);
            videos.push(videoItem.querySelector('video'));

            const clipItem = createClipItem(videoData, index);
            clipList.appendChild(clipItem);
        });

        updateGridLayout();
        checkToggleButtons();
    }
}

function createVideoItem(videoData, index) {
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item secondary';
    videoItem.dataset.index = index;

    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoData.file);
    video.controls = true;
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    videoItem.appendChild(video);

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = extractCameraType(videoData.file.name);
    videoItem.appendChild(label);

    const controls = createVideoControls(videoItem);
    videoItem.appendChild(controls);

    videoItem.addEventListener('click', (e) => {
        if (!e.target.closest('.video-controls')) {
            togglePrimaryVideo(e);
        }
    });

    return videoItem;
}

function createClipItem(videoData, index) {
    const clipItem = document.createElement('button');
    clipItem.className = 'list-group-item list-group-item-action clip-item';
    clipItem.textContent = videoData.file.name;
    clipItem.dataset.index = index;
    
    clipItem.addEventListener('click', () => {
        const videoItem = document.querySelector(`.video-item[data-index="${index}"]`);
        toggleVideoVisibility(videoItem);
        
        // Trigger the tap animation
        clipItem.classList.add('tapped');
        setTimeout(() => {
            clipItem.classList.remove('tapped');
        }, 300); // Match this to the animation duration
    });
    
    return clipItem;
}

function createVideoControls(videoItem) {
    const controls = document.createElement('div');
    controls.className = 'video-controls';

    const visibilityToggle = document.createElement('button');
    visibilityToggle.innerHTML = '<i class="fas fa-eye"></i>';
    visibilityToggle.title = 'Toggle Visibility';
    visibilityToggle.addEventListener('click', (e) => {
        console.log('Visibility toggle clicked');
        e.stopPropagation();
        toggleVideoVisibility(videoItem);
    });
    controls.appendChild(visibilityToggle);

    const primaryToggle = document.createElement('button');
    primaryToggle.innerHTML = '<i class="fas fa-expand"></i>';
    primaryToggle.title = 'Set as Primary';
    primaryToggle.addEventListener('click', (e) => {
        console.log('Primary toggle clicked');
        e.stopPropagation();
        togglePrimaryVideo(e);
    });
    controls.appendChild(primaryToggle);

    return controls;
}

function toggleVideoVisibility(videoItem) {
    console.log('toggleVideoVisibility called for', videoItem);
    videoItem.classList.toggle('hidden');
    const isHidden = videoItem.classList.contains('hidden');
    console.log('Hidden class toggled. Is hidden:', isHidden);
    
    // Force update of the video item's style
    videoItem.style.display = isHidden ? 'none' : 'block';
    
    updateGridLayout();
}

function togglePrimaryVideo(event) {
    const clickedItem = event.currentTarget.closest('.video-item');
    const gridContainer = clickedItem.closest('.grid-container');
    const currentPrimary = gridContainer.querySelector('.video-item.primary');

    if (currentPrimary === clickedItem) {
        clickedItem.classList.remove('primary');
        clickedItem.classList.add('secondary');
        gridContainer.classList.remove('has-primary');
    } else {
        if (currentPrimary) {
            currentPrimary.classList.remove('primary');
            currentPrimary.classList.add('secondary');
        }
        clickedItem.classList.remove('secondary');
        clickedItem.classList.add('primary');
        gridContainer.classList.add('has-primary');
    }

    updateGridLayout();
}

function updateGridLayout() {
    console.log('updateGridLayout called');
    const gridContainer = document.querySelector('.grid-container');
    const videoItems = Array.from(gridContainer.querySelectorAll('.video-item'));
    const primaryVideo = gridContainer.querySelector('.video-item.primary');

    videoItems.forEach(item => {
        const cameraType = item.querySelector('.video-label').textContent.toLowerCase();
        
        // Preserve existing classes
        const isHidden = item.classList.contains('hidden');
        const isPrimary = item.classList.contains('primary');
        const isSecondary = item.classList.contains('secondary');
        
        item.className = `video-item ${cameraType}`;
        
        if (isHidden) item.classList.add('hidden');
        if (isPrimary) item.classList.add('primary');
        if (isSecondary) item.classList.add('secondary');
        
        if (item.classList.contains('hidden')) {
            console.log('Video item is hidden:', item);
            item.style.display = 'none';
        } else {
            console.log('Video item is visible:', item);
            item.style.display = 'block';
        }
    });

    if (primaryVideo && !primaryVideo.classList.contains('hidden')) {
        gridContainer.classList.add('has-primary');
    } else {
        gridContainer.classList.remove('has-primary');
    }
    console.log('Grid layout updated');
}

function setStandardLayout() {
    console.log('Setting standard layout');
    const gridContainer = document.querySelector('.grid-container');
    const videoItems = Array.from(gridContainer.querySelectorAll('.video-item'));
    
    videoItems.forEach(item => {
        const cameraType = item.querySelector('.video-label').textContent;
        item.classList.remove('primary', 'secondary', 'hidden');
        item.style.display = 'block';
        
        switch (cameraType) {
            case 'Front':
                item.classList.add('primary');
                break;
            case 'Rear':
            case 'Left':
            case 'Right':
                item.classList.add('secondary');
                break;
        }
    });

    gridContainer.classList.add('has-primary');
    console.log('Standard layout set');
    updateGridLayout();
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

// Add this function to check if the toggle buttons are working
function checkToggleButtons() {
    console.log('Checking toggle buttons');
    const videoItems = document.querySelectorAll('.video-item');
    videoItems.forEach((item, index) => {
        const visibilityToggle = item.querySelector('.video-controls button:first-child');
        const primaryToggle = item.querySelector('.video-controls button:last-child');
        
        console.log(`Video item ${index}:`);
        console.log('- Visibility toggle:', visibilityToggle);
        console.log('- Primary toggle:', primaryToggle);
        
        if (visibilityToggle) {
            visibilityToggle.addEventListener('click', () => {
                console.log(`Visibility toggle clicked for video item ${index}`);
            });
        }
        
        if (primaryToggle) {
            primaryToggle.addEventListener('click', () => {
                console.log(`Primary toggle clicked for video item ${index}`);
            });
        }
    });
}

// Add these event listeners at the end of the file
document.getElementById('exportButton').addEventListener('click', exportClips);
document.getElementById('standardLayoutButton').addEventListener('click', setStandardLayout);