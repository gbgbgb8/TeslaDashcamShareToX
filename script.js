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
                updateVideoSizes();
            });
            const visibilityLabel = document.createElement('label');
            visibilityLabel.className = 'form-check-label';
            visibilityLabel.appendChild(visibilityCheckbox);
            visibilityLabel.appendChild(document.createTextNode(' Visible'));
            controls.appendChild(visibilityLabel);

            const primaryRadio = document.createElement('input');
            primaryRadio.type = 'radio';
            primaryRadio.className = 'form-check-input';
            primaryRadio.name = 'primaryVideo';
            primaryRadio.addEventListener('change', () => {
                videos.forEach(v => v.closest('.video-item').classList.remove('primary'));
                if (primaryRadio.checked) {
                    videoItem.classList.add('primary');
                }
                updateVideoSizes();
            });
            const primaryLabel = document.createElement('label');
            primaryLabel.className = 'form-check-label';
            primaryLabel.appendChild(primaryRadio);
            primaryLabel.appendChild(document.createTextNode(' Primary'));
            controls.appendChild(primaryLabel);

            videoItem.appendChild(controls);
            videoContainer.appendChild(videoItem);
            videos.push(videoElement);

            videoItem.dataset.index = index;
        });

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Layout';
        resetButton.className = 'btn btn-secondary btn-sm mt-2';
        resetButton.addEventListener('click', resetLayout);
        videoContainer.appendChild(resetButton);

        const standardButton = document.createElement('button');
        standardButton.textContent = 'Standard Layout';
        standardButton.className = 'btn btn-info btn-sm mt-2 ms-2';
        standardButton.addEventListener('click', setStandardLayout);
        videoContainer.appendChild(standardButton);

        gridLayout = Array.from({ length: videoGroups[selectedDateTime].length }, (_, i) => i);
        updateGridLayout();
    }
}

function clearPrimarySelection() {
    const primaryRadios = document.querySelectorAll('input[name="primaryVideo"]');
    primaryRadios.forEach(radio => {
        radio.checked = false;
    });
    videos.forEach(video => {
        video.closest('.video-item').classList.remove('primary');
    });
    updateVideoSizes();
}

function updateGridLayout() {
    const videoContainer = document.getElementById('videoContainer');
    const videoItems = Array.from(videoContainer.querySelectorAll('.video-item'));
    const primaryVideo = videoContainer.querySelector('.video-item.primary');
    const visibleVideos = videoItems.filter(item => item.style.display !== 'none');

    if (primaryVideo) {
        // Handle primary video layout
        primaryVideo.style.width = '100%';
        primaryVideo.style.height = '100%';
        primaryVideo.style.top = '0';
        primaryVideo.style.left = '0';
        primaryVideo.style.zIndex = '1';

        const secondaryVideos = videoItems.filter(item => !item.classList.contains('primary'));
        const secondaryWidth = '50%';
        const secondaryHeight = '50%';

        secondaryVideos.forEach((video, index) => {
            video.classList.add('secondary');
            video.style.width = secondaryWidth;
            video.style.height = secondaryHeight;
            video.style.zIndex = '2';

            if (index === 0) {
                video.style.top = '0';
                video.style.left = '50%';
            } else if (index === 1) {
                video.style.top = '50%';
                video.style.left = '0';
            } else if (index === 2) {
                video.style.top = '50%';
                video.style.left = '50%';
            }
        });
    } else {
        // Handle grid layout without primary video
        const videoCount = visibleVideos.length;
        const columns = Math.ceil(Math.sqrt(videoCount));
        const rows = Math.ceil(videoCount / columns);

        let currentPosition = 0;
        gridLayout.forEach((originalIndex) => {
            const video = videoItems.find(item => parseInt(item.dataset.index) === originalIndex);
            if (video.style.display !== 'none') {
                const row = Math.floor(currentPosition / columns);
                const col = currentPosition % columns;

                video.style.width = `${100 / columns}%`;
                video.style.height = `${100 / rows}%`;
                video.style.top = `${(row * 100) / rows}%`;
                video.style.left = `${(col * 100) / columns}%`;
                video.style.zIndex = '1';
                video.classList.remove('secondary');

                currentPosition++;
            }
        });
    }
}

function updateVideoSizes() {
    updateGridLayout();
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

function handleDrop(event) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    const draggedElement = document.getElementById(draggedId);
    const targetElement = event.target.closest('.video-item') || event.target.closest('.video-container');

    if (draggedElement && targetElement) {
        const videoContainer = document.getElementById('videoContainer');
        const videoItems = Array.from(videoContainer.querySelectorAll('.video-item'));
        const visibleVideos = videoItems.filter(item => item.style.display !== 'none');

        let targetIndex;
        if (targetElement.classList.contains('video-item')) {
            targetIndex = visibleVideos.indexOf(targetElement);
        } else {
            // If dropped on an empty space, append to the end
            targetIndex = visibleVideos.length;
        }

        const draggedIndex = visibleVideos.indexOf(draggedElement);

        // Update the gridLayout array
        const draggedOriginalIndex = parseInt(draggedElement.dataset.index);
        gridLayout.splice(gridLayout.indexOf(draggedOriginalIndex), 1);
        gridLayout.splice(targetIndex, 0, draggedOriginalIndex);

        updateGridLayout();
    }
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
}

function handleTouchMove(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const videoItem = event.target.closest('.video-item');
    const deltaX = touch.clientX - videoItem.dataset.touchStartX;
    const deltaY = touch.clientY - videoItem.dataset.touchStartY;
    
    videoItem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    videoItem.classList.add('dragging');
}

function handleTouchEnd(event) {
    const videoItem = event.target.closest('.video-item');
    videoItem.style.transform = '';
    videoItem.classList.remove('dragging');
    
    const touch = event.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetVideoItem = target.closest('.video-item');
    
    if (targetVideoItem && targetVideoItem !== videoItem) {
        const draggedIndex = parseInt(videoItem.dataset.index);
        const targetIndex = parseInt(targetVideoItem.dataset.index);

        // Update the gridLayout array
        const draggedPosition = gridLayout.indexOf(draggedIndex);
        const targetPosition = gridLayout.indexOf(targetIndex);
        gridLayout.splice(draggedPosition, 1);
        gridLayout.splice(targetPosition, 0, draggedIndex);

        updateGridLayout();
    }
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