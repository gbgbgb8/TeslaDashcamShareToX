const { h, render } = preact;
const { useState, useEffect } = preactHooks;

function App() {
    const [files, setFiles] = useState([]);
    const [dates, setDates] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [layout, setLayout] = useState('cross');
    const [mainAngle, setMainAngle] = useState('front');
    const [videoPreviews, setVideoPreviews] = useState([]);

    useEffect(() => {
        if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));

            const dateRangeSlider = document.getElementById('date-range');
            if (dateRangeSlider.noUiSlider) {
                dateRangeSlider.noUiSlider.destroy();
            }
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
                setStartDate(new Date(values[0]));
                setEndDate(new Date(values[1]));
            });
        }
    }, [dates]);

    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        setFiles(selectedFiles);

        const extractedDates = selectedFiles.map(file => {
            const match = file.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
            if (match) {
                const dateString = match[1].replace(/_/g, 'T').replace(/-/g, ':');
                return new Date(dateString);
            }
            return null;
        }).filter(date => date !== null && !isNaN(date.getTime()));

        setDates(extractedDates);
    };

    const handleComposeClick = () => {
        console.log('Source Folder:', files);
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('Layout:', layout);
        console.log('Main Angle:', mainAngle);

        const angles = ['front', 'back', 'left_repeater', 'right_repeater'];
        const previews = angles.map(angle => {
            const file = files.find(file => file.name.includes(angle));
            if (file) {
                const videoUrl = URL.createObjectURL(file);
                return (
                    <video controls>
                        <source src={videoUrl} type="video/mp4" />
                    </video>
                );
            }
            return null;
        }).filter(preview => preview !== null);

        setVideoPreviews(previews);
    };

    return (
        <div class="container">
            <h1>Tesla Dashcam Video Composer</h1>
            <div class="form-group">
                <label for="source-folder">Select Source Folder:</label>
                <input type="file" id="source-folder" webkitdirectory directory multiple onChange={handleFileChange} />
            </div>
            <div class="form-group">
                <label for="date-range">Select Date and Time Range:</label>
                <div id="date-range" class="slider"></div>
            </div>
            <div class="form-group">
                <label for="layout">Select Layout:</label>
                <select id="layout" value={layout} onChange={(e) => setLayout(e.target.value)}>
                    <option value="cross">Cross</option>
                    <option value="corners">Corners</option>
                    <option value="diamond">Diamond</option>
                </select>
            </div>
            <div class="form-group">
                <label for="main-angle">Select Main Angle:</label>
                <select id="main-angle" value={mainAngle} onChange={(e) => setMainAngle(e.target.value)}>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                    <option value="left_repeater">Left Repeater</option>
                    <option value="right_repeater">Right Repeater</option>
                </select>
            </div>
            <button id="compose-button" onClick={handleComposeClick}>Compose Video</button>
            <div class="video-preview" id="video-preview">
                {videoPreviews}
            </div>
        </div>
    );
}

render(<App />, document.getElementById('app'));