document.getElementById('fileInput').addEventListener('change', handleFileSelect);

function handleFileSelect(event) {
    const files = event.target.files;
    const fileList = document.getElementById('fileList');
    const videoContainer = document.getElementById('videoContainer');
    
    fileList.innerHTML = '';
    videoContainer.innerHTML = '';

    Array.from(files).forEach(file => {
        const listItem = document.createElement('li');
        listItem.textContent = file.name;
        fileList.appendChild(listItem);

        if (file.type === 'video/mp4') {
            const videoElement = document.createElement('video');
            videoElement.controls = true;
            videoElement.src = URL.createObjectURL(file);
            videoContainer.appendChild(videoElement);
        }
    });
}