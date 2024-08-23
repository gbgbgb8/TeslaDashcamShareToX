document.getElementById('source-folder').addEventListener('change', function() {
    const files = Array.from(this.files);
    const dates = files.map(file => {
        const match = file.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
        if (match) {
            const dateString = match[1].replace(/_/g, 'T').replace(/-/g, ':');
            return new Date(dateString);
        }
        return null;
    }).filter(date => date !== null && !isNaN(date.getTime()));

    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        document.getElementById('start-date').min = minDate.toISOString().slice(0, 16);
        document.getElementById('start-date').max = maxDate.toISOString().slice(0, 16);
        document.getElementById('end-date').min = minDate.toISOString().slice(0, 16);
        document.getElementById('end-date').max = maxDate.toISOString().slice(0, 16);

        document.getElementById('start-date').value = minDate.toISOString().slice(0, 16);
        document.getElementById('end-date').value = maxDate.toISOString().slice(0, 16);
    }
});

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