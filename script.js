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

        const dateRangeSlider = document.getElementById('date-range');
        noUiSlider.create(dateRangeSlider, {
            start: [minDate.getTime(), maxDate.getTime()],
            connect: true,
            range: {
                'min': minDate.getTime(),
                'max': maxDate.getTime()
            },
            format: {
                to: value => new Date(value).toISOString().slice(0, 16).replace('T', ' '),
                from: value => new Date(value).getTime()
            }
        });

        dateRangeSlider.noUiSlider.on('update', function(values, handle) {
            const startDate = new Date(values[0]);
            const endDate = new Date(values[1]);
            console.log('Start Date:', startDate);
            console.log('End Date:', endDate);
        });
    }
});

document.getElementById('compose-button').addEventListener('click', function() {
    const sourceFolder = document.getElementById('source-folder').files;
    const dateRangeSlider = document.getElementById('date-range').noUiSlider;
    const [startDate, endDate] = dateRangeSlider.get().map(value => new Date(value));
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
    videoPreview.innerHTML = '';

    const angles = ['front', 'back', 'left_repeater', 'right_repeater'];
    angles.forEach(angle => {
        const file = Array.from(sourceFolder).find(file => file.name.includes(angle));
        if (file) {
            const videoUrl = URL.createObjectURL(file);
            videoPreview.innerHTML += `
                <video controls>
                    <source src="${videoUrl}" type="video/mp4">
                </video>
            `;
        }
    });
});