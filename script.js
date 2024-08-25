document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('dateTimeSelect').addEventListener('change', handleDateTimeChange);
    document.getElementById('standardLayoutButton').addEventListener('click', setStandardLayout);
    document.getElementById('exportStandardButton').addEventListener('click', () => showExportModal('standard'));
    document.getElementById('exportCustomButton').addEventListener('click', () => showExportModal('custom'));
    document.getElementById('playPauseButton').addEventListener('click', togglePlayPause);

    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    });
});

let videoGroups = {};
let videos = [];
let videoIdCounter = 0;
let gridLayout = [];

let isPlaying = false;
let isTransitioning = false;

let videoStates = {};
let interactionTimeline = [];
let videoContext;
let videoSources = {};

function initializeVideoStates() {
    videos.forEach((video, index) => {
        videoStates[index] = {
            isActive: false,
            isHidden: false,
            lastActiveTime: 0
        };
    });
}

function recordInteraction(type, videoIndex, timestamp) {
    const interaction = {
        type: type,
        videoIndex: videoIndex,
        timestamp: timestamp
    };
    interactionTimeline.push(interaction);
    logInteraction(interaction);
}

function logInteraction(interaction) {
    const logElement = document.getElementById('interactionLog');
    const logEntry = document.createElement('p');
    const formattedTime = formatTimestamp(interaction.timestamp);
    let actionText = '';

    switch (interaction.type) {
        case 'switchActive':
            actionText = `Switched active video to ${getCameraType(interaction.videoIndex)}`;
            break;
        case 'toggleVisibility':
            const isHidden = videoStates[interaction.videoIndex].isHidden;
            actionText = `${isHidden ? 'Hidden' : 'Shown'} ${getCameraType(interaction.videoIndex)} video`;
            break;
        case 'playPause':
            actionText = isPlaying ? 'Played videos' : 'Paused videos';
            break;
        default:
            return; // Don't log other events
    }

    logEntry.textContent = `${formattedTime}: ${actionText}`;
    logElement.insertBefore(logEntry, logElement.firstChild);
}

function formatTimestamp(timestamp) {
    const date = new Date(null);
    date.setSeconds(timestamp);
    return date.toISOString().substr(11, 8);
}

function getCameraType(videoIndex) {
    const videoItem = document.querySelector(`.video-item[data-index="${videoIndex}"]`);
    return videoItem ? videoItem.querySelector('.video-label').textContent : 'Unknown';
}

function togglePlayPause() {
    if (isTransitioning) return;
    isTransitioning = true;
    
    isPlaying = !isPlaying;
    updatePlayPauseButton();
    const currentTime = videos[0].currentTime;
    recordInteraction('playPause', null, currentTime);
    
    if (isPlaying) {
        playAllVideos();
    } else {
        pauseAllVideos();
    }
    
    setTimeout(() => {
        isTransitioning = false;
    }, 300); // Debounce for 300ms
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

function playAllVideos() {
    videos.forEach(video => {
        video.play().catch(e => {
            // Silently handle errors
            console.log('Error playing video:', e);
        });
    });
}

function pauseAllVideos() {
    videos.forEach(video => {
        video.pause();
    });
}

function handlePlay(event) {
    if (isTransitioning) return;
    isTransitioning = true;
    
    if (!isPlaying) {
        isPlaying = true;
        updatePlayPauseButton();
        const currentTime = event.target.currentTime;
        recordInteraction('playPause', null, currentTime);
    }
    videos.forEach(video => {
        if (video !== event.target) {
            video.currentTime = event.target.currentTime;
            video.play().catch(e => {
                // Silently handle errors
                console.log('Error playing video:', e);
            });
        }
    });
    
    setTimeout(() => {
        isTransitioning = false;
    }, 300); // Debounce for 300ms
}

function handlePause(event) {
    if (isTransitioning) return;
    isTransitioning = true;
    
    if (isPlaying) {
        isPlaying = false;
        updatePlayPauseButton();
        const currentTime = event.target.currentTime;
        recordInteraction('playPause', null, currentTime);
    }
    videos.forEach(video => {
        if (video !== event.target) {
            video.pause();
        }
    });
    
    setTimeout(() => {
        isTransitioning = false;
    }, 300); // Debounce for 300ms
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
        // Enable the export buttons
        document.getElementById('exportStandardButton').disabled = false;
        document.getElementById('exportCustomButton').disabled = false;
        document.getElementById('playPauseButton').disabled = false;
        updatePlayPauseButton(); // Initialize button state
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
    
    videoContainer.innerHTML = '<div class="grid-container"></div>';
    const gridContainer = videoContainer.querySelector('.grid-container');
    clipList.innerHTML = '';
    videos = [];

    if (videoGroups[selectedDateTime]) {
        videoGroups[selectedDateTime].forEach((videoData, index) => {
            const videoItem = createVideoItem(videoData, index);
            gridContainer.appendChild(videoItem);
            videos.push(videoItem.querySelector('video')); // Store the video element

            const clipItem = createClipItem(videoData, index);
            clipList.appendChild(clipItem);
        });

        initializeVideoStates(); // Initialize video states
        updateGridLayout();
        
        console.log('Videos after handleDateTimeChange:', videos.map(v => v.src));
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
        e.stopPropagation();
        toggleVideoVisibility(videoItem);
    });
    controls.appendChild(visibilityToggle);

    const primaryToggle = document.createElement('button');
    primaryToggle.innerHTML = '<i class="fas fa-expand"></i>';
    primaryToggle.title = 'Set as Primary';
    primaryToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePrimaryVideo(e);
    });
    controls.appendChild(primaryToggle);

    return controls;
}

function toggleVideoVisibility(videoItem) {
    const index = parseInt(videoItem.dataset.index);
    const currentTime = videos[0].currentTime;

    if (!videoStates[index]) {
        videoStates[index] = {
            isActive: false,
            isHidden: false,
            lastActiveTime: 0
        };
    }

    videoStates[index].isHidden = !videoStates[index].isHidden;
    recordInteraction('toggleVisibility', index, currentTime);

    videoItem.classList.toggle('hidden');
    updateGridLayout();
}

function togglePrimaryVideo(event) {
    const clickedItem = event.currentTarget.closest('.video-item');
    const index = parseInt(clickedItem.dataset.index);
    const currentTime = videos[0].currentTime; // Assuming all videos are in sync

    recordInteraction('switchActive', index, currentTime);

    // Update video states
    Object.keys(videoStates).forEach(key => {
        videoStates[key].isActive = (key == index);
        if (key == index) {
            videoStates[key].lastActiveTime = currentTime;
        }
    });

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
    
    // Pause all videos when switching primary video
    pauseAllVideos();
    isPlaying = false;
    updatePlayPauseButton();
}

function updateGridLayout() {
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
            item.style.display = 'none';
        } else {
            item.style.display = 'block';
        }
    });

    if (primaryVideo && !primaryVideo.classList.contains('hidden')) {
        gridContainer.classList.add('has-primary');
    } else {
        gridContainer.classList.remove('has-primary');
    }
}

function setStandardLayout() {
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
    updateGridLayout();
}

function handleTimeUpdate(event) {
    videos.forEach(video => {
        if (video !== event.target && Math.abs(video.currentTime - event.target.currentTime) > 0.1) {
            video.currentTime = event.target.currentTime;
        }
    });
}