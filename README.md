# WordPress Ultra-Light Theme

## Overview

This theme provides a lightweight WordPress content viewer that uses the WordPress REST API to display posts, pages, and media in various view modes (feed, grid, carousel).

## File Structure

- **index.php**: Serves as both the main WordPress theme file and a bridge between WordPress and the HTML template. It dynamically replaces placeholders in the template with WordPress-specific values.
- **template.html**: A standalone HTML version of the theme that can be used independently of WordPress. Contains placeholders that are replaced by index.php when used with WordPress.
- **script.js**: Contains all JavaScript functionality for fetching and displaying content.
- **main.css**: Contains all CSS styles for the theme.
- **style.css**: WordPress theme metadata file (required by WordPress).

## Usage Options

### 1. As a WordPress Theme

The theme can be used as a standard WordPress theme by activating it in the WordPress admin panel.

### 2. As a Standalone HTML Application

The `template.html` file can be used as a standalone HTML application that connects to a WordPress site's REST API. Simply edit the `wpApiBase` setting in the `appSettings` JSON to point to your WordPress site's REST API endpoint.

### 3. Direct Access to index.php

The `index.php` file serves as a bridge that can be accessed directly but still leverages WordPress functionality when available. It checks if WordPress is loaded and adapts accordingly, making it useful for embedding the application in other contexts while maintaining WordPress integration.

## Features

- Display WordPress content (posts, pages, media) in different view modes (feed, grid, carousel)
- Lazy loading with infinite scroll
- Detailed content view with metadata
- Responsive design with size controls
- Sort content by date (ascending/descending)
- Configurable items per page

## Customization

The theme is designed to be easily customizable:

- Modify the HTML structure in `template.html` or `index.php`
- Update styles in `main.css`
- Extend functionality in `script.js`

## API Integration

The theme uses the WordPress REST API to fetch content. The API base path can be configured in the `appSettings` JSON object:

```json
{
    "wpApiBase": "path/to/wp-json/wp/v2"
}
```

In the WordPress theme version, this is automatically set to the correct path using `rest_url('wp/v2')`.