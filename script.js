const folderInput = document.getElementById('folderInput');
const videoContainer = document.getElementById('videoContainer');
const mainVideo = document.getElementById('mainVideo');
const secondaryVideos = document.getElementById('secondaryVideos');
const navigationButtons = document.getElementById('navigationButtons');
const exportButton = document.getElementById('exportButton');
const timeline = document.getElementById('timeline');

let videoEvents = [];
let currentEventIndex = 0;
let clipType = 'RecentClips';

folderInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
});

function processFiles(files) {
    // Group files by clip type
    const groupedFiles = {
        RecentClips: [],
        SentryClips: [],
        SavedClips: []
    };

    files.forEach(file => {
        const path = file.webkitRelativePath;
        if (path.includes('RecentClips')) {
            groupedFiles.RecentClips.push(file);
        } else if (path.includes('SentryClips')) {
            groupedFiles.SentryClips.push(file);
        } else if (path.includes('SavedClips')) {
            groupedFiles.SavedClips.push(file);
        }
    });

    // Process the selected clip type
    videoEvents = groupFilesByEvent(groupedFiles[clipType]);
    if (videoEvents.length > 0) {
        displayEvent(0);
        updateNavigationButtons();
        createTimeline();
    }
}

function groupFilesByEvent(files) {
    const events = {};
    files.forEach(file => {
        if (file.name.endsWith('.mp4')) {
            const [dateTime, camera] = file.name.split('-');
            const eventKey = dateTime;
            if (!events[eventKey]) {
                events[eventKey] = {};
            }
            events[eventKey][camera.split('.')[0]] = file;
        }
    });
    return Object.entries(events).sort((a, b) => b[0].localeCompare(a[0]));
}

function displayEvent(index) {
    const [timestamp, event] = videoEvents[index];
    const cameras = Object.keys(event);

    mainVideo.src = URL.createObjectURL(event[cameras[0]]);
    mainVideo.play();

    secondaryVideos.innerHTML = '';
    for (let i = 1; i < cameras.length; i++) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(event[cameras[i]]);
        video.controls = true;
        secondaryVideos.appendChild(video);
    }

    // Update event info
    const eventInfo = document.createElement('div');
    eventInfo.textContent = `Event: ${formatTimestamp(timestamp)}`;
    videoContainer.insertBefore(eventInfo, secondaryVideos);

    // Synchronize video playback
    const videos = [mainVideo, ...secondaryVideos.querySelectorAll('video')];
    videos.forEach(video => {
        video.addEventListener('play', () => syncPlayback(videos));
        video.addEventListener('pause', () => syncPlayback(videos));
        video.addEventListener('seeked', () => syncPlayback(videos));
    });
}

function formatTimestamp(timestamp) {
    return new Date(timestamp.replace(/_/g, 'T').slice(0, -3) + 'Z').toLocaleString();
}

function updateNavigationButtons() {
    navigationButtons.innerHTML = '';
    if (videoEvents.length > 1) {
        const prevButton = createButton('Previous Event', () => navigateEvents(-1));
        const nextButton = createButton('Next Event', () => navigateEvents(1));
        navigationButtons.appendChild(prevButton);
        navigationButtons.appendChild(nextButton);
    }
}

function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    return button;
}

function navigateEvents(direction) {
    currentEventIndex += direction;
    if (currentEventIndex < 0) currentEventIndex = videoEvents.length - 1;
    if (currentEventIndex >= videoEvents.length) currentEventIndex = 0;
    displayEvent(currentEventIndex);
}

function syncPlayback(videos) {
    const mainVideoTime = mainVideo.currentTime;
    videos.forEach(video => {
        if (Math.abs(video.currentTime - mainVideoTime) > 0.1) {
            video.currentTime = mainVideoTime;
        }
        mainVideo.paused ? video.pause() : video.play();
    });
}

function createTimeline() {
    timeline.innerHTML = '';
    videoEvents.forEach((event, index) => {
        const [timestamp, _] = event;
        const marker = document.createElement('div');
        marker.classList.add('timeline-marker');
        marker.style.left = `${(index / (videoEvents.length - 1)) * 100}%`;
        marker.title = formatTimestamp(timestamp);
        marker.addEventListener('click', () => {
            currentEventIndex = index;
            displayEvent(currentEventIndex);
        });
        timeline.appendChild(marker);
    });
}

exportButton.addEventListener('click', () => safeAsyncFunction(combineVideos));

async function combineVideos() {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    const [timestamp, event] = videoEvents[currentEventIndex];
    const cameras = Object.keys(event);

    for (let i = 0; i < cameras.length; i++) {
        ffmpeg.FS('writeFile', `input${i}.mp4`, await fetchFile(event[cameras[i]]));
    }

    const filterComplex = cameras.length === 4 
        ? '[0:v]pad=iw*2:ih*2[a];[a][1:v]overlay=w[b];[b][2:v]overlay=0:h[c];[c][3:v]overlay=w:h'
        : '[0:v]pad=iw*2:ih[a];[a][1:v]overlay=w[b];[b][2:v]overlay=0:h';

    await ffmpeg.run('-i', 'input0.mp4', '-i', 'input1.mp4', '-i', 'input2.mp4', '-i', 'input3.mp4',
        '-filter_complex', filterComplex, 'output.mp4');

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `combined_dashcam_${formatTimestamp(timestamp)}.mp4`;
    a.click();
}

// Add error handling
function handleError(error) {
    console.error('An error occurred:', error);
    alert('An error occurred. Please check the console for more information.');
}

// Wrap async functions with try-catch
async function safeAsyncFunction(asyncFunc) {
    try {
        await asyncFunc();
    } catch (error) {
        handleError(error);
    }
}