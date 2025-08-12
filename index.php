<?php
/**
 * Main template file
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 * 
 * This file acts as a bridge between WordPress and the standalone HTML template.
 * It only uses PHP when WordPress is loaded.
 */

// Check if WordPress is loaded
$is_wordpress = defined('ABSPATH');

// Set the WordPress API base URL if WordPress is loaded
$wp_api_base = $is_wordpress ? esc_url(rest_url('wp/v2')) : '/wp-json/wp/v2';

// Set the template directory URI for assets
$template_dir = $is_wordpress ? get_template_directory_uri() : '.';

// Set the parent site URL
$parent_site_url = $is_wordpress ? esc_url(home_url('/')) : '';

// Load the template HTML file
$template_path = __DIR__ . '/wordpress.html';
$template_content = file_get_contents($template_path);

// Replace script paths with full URLs
$template_content = str_replace('src="app/', 'src="' . $template_dir . '/app/', $template_content);

// Replace placeholders with dynamic values
$template_content = str_replace('{{WP_API_BASE}}', $wp_api_base, $template_content);
$template_content = str_replace('{{TEMPLATE_DIR}}', $template_dir, $template_content);
$template_content = str_replace('{{PARENT_SITE_URL}}', $parent_site_url, $template_content);

// Output the processed template
echo $template_content;