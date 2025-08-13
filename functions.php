<?php
/**
 * Theme functions and definitions
 *
 * @package WP_SV_Ultralight
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Sets up theme defaults and registers support for various WordPress features.
 */
function wp_sv_ultralight_setup() {
    /*
     * Enable support for Post Thumbnails on posts and pages.
     * This feature enables the use of featured images in posts and pages.
     * @link https://developer.wordpress.org/themes/functionality/featured-images-post-thumbnails/
     */
    add_theme_support('post-thumbnails');
    
    // Define custom thumbnail sizes if needed
    // set_post_thumbnail_size(1200, 9999);
    // add_image_size('wp-sv-ultralight-thumbnail', 300, 300, true);
    
    /*
     * Let WordPress manage the document title.
     */
    add_theme_support('title-tag');
    
    /*
     * Enable support for HTML5 markup.
     */
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ));
}
add_action('after_setup_theme', 'wp_sv_ultralight_setup');

/**
 * Modify REST API responses to include featured media and other data
 */
function wp_sv_ultralight_rest_prepare_post($response, $post, $request) {
    // Add featured media URL if not using _embed
    if (!isset($request['_embed'])) {
        $featured_media_id = get_post_thumbnail_id($post->ID);
        if ($featured_media_id) {
            $featured_media = wp_get_attachment_image_src($featured_media_id, 'full');
            if ($featured_media) {
                $response->data['featured_media_url'] = $featured_media[0];
            }
        }
    }
    
    // Add categories
    $categories = get_the_terms($post->ID, 'category');
    if (!empty($categories) && !is_wp_error($categories)) {
        $response->data['categories'] = array_map(function($category) {
            return [
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'link' => get_category_link($category->term_id)
            ];
        }, $categories);
    } else {
        $response->data['categories'] = [];
    }
    
    // Add tags
    $tags = get_the_terms($post->ID, 'post_tag');
    if (!empty($tags) && !is_wp_error($tags)) {
        $response->data['tags'] = array_map(function($tag) {
            return [
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'link' => get_tag_link($tag->term_id)
            ];
        }, $tags);
    } else {
        $response->data['tags'] = [];
    }
    
    return $response;
}
add_filter('rest_prepare_post', 'wp_sv_ultralight_rest_prepare_post', 10, 3);
add_filter('rest_prepare_page', 'wp_sv_ultralight_rest_prepare_post', 10, 3);

// Add custom post types to the filter if needed
// add_filter('rest_prepare_custom_post_type', 'wp_sv_ultralight_rest_prepare_post', 10, 3);

/**
 * Enqueue scripts and styles.
 */
function wp_sv_ultralight_scripts() {
    // Theme styles
    wp_enqueue_style('wp-sv-ultralight-style', get_stylesheet_uri(), array(), wp_get_theme()->get('Version'));
    
    // Main script (depends on jQuery)
    wp_enqueue_script(
        'wp-sv-ultralight-script',
        get_template_directory_uri() . '/app/script.js',
        array('jquery'),
        wp_get_theme()->get('Version'),
        true
    );
    
    // Localize script with site settings
    wp_localize_script('wp-sv-ultralight-script', 'wpApiSettings', array(
        'root' => esc_url_raw(rest_url()),
        'nonce' => wp_create_nonce('wp_rest')
    ));
}
add_action('wp_enqueue_scripts', 'wp_sv_ultralight_scripts');

// Add module type to script tag
function wp_sv_ultralight_add_module_type($tag, $handle) {
    if ('wp-sv-ultralight-script' === $handle) {
        $tag = str_replace(' src', ' type="module" src', $tag);
    }
    return $tag;
}
add_filter('script_loader_tag', 'wp_sv_ultralight_add_module_type', 10, 2);