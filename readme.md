# Tesla Dashcam Viewer

## Overview

Tesla Dashcam Viewer is a web-based application designed to simplify the process of viewing and managing footage from Tesla's built-in dashcam and Sentry Mode. This tool allows users to easily browse, view, and export video clips recorded by their Tesla vehicles.

## Features

- **Multi-camera View**: Simultaneously display footage from all four Tesla cameras (Front, Back, Left Repeater, Right Repeater) in a grid layout.
- **Time-based Navigation**: Browse and select video clips based on their recording date and time.
- **Customizable Layout**: Adjust the grid layout, including options to set a primary (larger) view for any camera.
- **Synchronized Playback**: Play, pause, and seek through all camera feeds simultaneously for a comprehensive view of events.
- **Export Functionality**: Select and export specific video clips for sharing or further analysis.
- **Sentry Mode Support**: View and manage Sentry Mode event footage alongside regular dashcam recordings.
- **Responsive Design**: User-friendly interface that adapts to different screen sizes, including mobile devices.

## How It Works

1. **File Selection**: Users select a folder containing Tesla dashcam footage.
2. **Video Processing**: The application organizes video files by date and time, grouping synchronized camera views together.
3. **Clip Browsing**: Users can navigate through available clips using a dropdown menu.
4. **Video Playback**: Selected clips are displayed in a grid, with options to adjust the layout and focus on specific cameras.
5. **Export**: Users can select specific clips or time ranges for export.

## Technical Details

- Built with vanilla JavaScript, HTML, and CSS
- Utilizes the HTML5 Video API for playback
- Implements the Sortable.js library for drag-and-drop layout customization
- Responsive design using Bootstrap 5

## Future Enhancements

- Integration with Tesla's Sentry Mode event data (JSON files)
- Advanced filtering and search capabilities
- Support for longer recording sessions and seamless playback between clips
- Performance optimizations for handling large numbers of video files
