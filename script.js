document.getElementById('compose-button').addEventListener('click', function() {
    const sourceFolder = document.getElementById('source-folder').files;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const layout = document.getElementById('layout').value;
    const mainAngle = document.getElementById('main-angle').value;

    // Placeholder for video processing logic
    console.log('Source Folder:', sourceFolder);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Layout:', layout);
    console.log('Main Angle:', mainAngle);

    // Display video previews (for demonstration purposes)
    const videoPreview = document.getElementById('video-preview');
    videoPreview.innerHTML = `
        <video controls>
            <source src="path/to/front.mp4" type="video/mp4">
        </video>
        <video controls>
            <source src="path/to/back.mp4" type="video/mp4">
        </video>
    `;
});