<?php
/**
 * Plugin Name: HPTD Configurator
 * Description: Pool table configurator with WooCommerce integration
 * Version: 1.0.0
 * Author: Home Pool Tables Direct
 */

if (!defined('ABSPATH')) {
    exit;
}

class HPTD_Configurator {
    const HANDLE = 'hptd-configurator-app';

    public function __construct() {
        add_shortcode('hptd_configurator', [$this, 'shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        add_action('rest_api_init', [$this, 'register_routes']);
        
        // WooCommerce hooks
        add_filter('woocommerce_get_item_data', [$this, 'display_cart_meta'], 10, 2);
        add_action('woocommerce_checkout_create_order_line_item', [$this, 'save_order_meta'], 10, 4);
        add_action('woocommerce_before_calculate_totals', [$this, 'override_cart_price'], 20, 1);
    }

    public function register_assets() {
        $ver = '1.0.0';
        $script = plugins_url('dist/app.js', __FILE__);
        $style = plugins_url('dist/app.css', __FILE__);
        
        wp_register_script(self::HANDLE, $script, [], $ver, true);
        wp_register_style(self::HANDLE, $style, [], $ver);
    }

    public function register_routes() {
        // Add to cart: allow guests (no nonce required)
        register_rest_route('hptd/v1', '/add-to-cart', [
            'methods' => 'POST',
            'callback' => [$this, 'rest_add_to_cart'],
            'permission_callback' => '__return_true',
        ]);

        // Create quote: admins only
        register_rest_route('hptd/v1', '/create-quote', [
            'methods' => 'POST',
            'callback' => [$this, 'rest_create_quote'],
            'permission_callback' => function () {
                return current_user_can('manage_woocommerce') || current_user_can('administrator');
            },
        ]);
    }

    public function shortcode($atts = []) {
        $atts = shortcode_atts([
            'model' => 'supreme-winner',
        ], $atts);

        // Provide config to JavaScript
        wp_localize_script(self::HANDLE, 'HPTD_CFG', [
            'restUrl' => esc_url_raw(rest_url('hptd/v1/')),
            'storeApiUrl' => esc_url_raw(get_rest_url(null, 'wc/store/v1/')),
            'catalogBaseUrl' => esc_url_raw(wp_upload_dir()['baseurl'] . '/hptd-catalog/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'model' => sanitize_text_field($atts['model']),
            'isAdmin' => current_user_can('manage_woocommerce') || current_user_can('administrator'),
        ]);

        // Safety shim for React
        wp_add_inline_script(
            self::HANDLE,
            'window.process = window.process || { env: { NODE_ENV: "production" } };',
            'before'
        );

        // Enqueue assets
        wp_enqueue_style(self::HANDLE);
        wp_enqueue_script(self::HANDLE);

        // Return the mount point
        $is_admin = (current_user_can('manage_woocommerce') || current_user_can('administrator')) ? '1' : '0';
        
        return sprintf(
            '<div id="hptd-configurator" data-model="%s" data-is-admin="%s"></div>',
            esc_attr($atts['model']),
            esc_attr($is_admin)
        );
    }

    private function verify_nonce() {
        $nonce = $_SERVER['HTTP_X_WP_NONCE'] ?? '';
        if (!wp_verify_nonce($nonce, 'wp_rest')) {
            return new WP_Error('rest_forbidden', 'Invalid nonce', ['status' => 403]);
        }
        return true;
    }

    public function rest_add_to_cart(WP_REST_Request $req) {
        // Ensure WooCommerce is loaded
        if (!function_exists('WC') || !WC()) {
            return new WP_Error('no_wc', 'WooCommerce not loaded', ['status' => 500]);
        }

        // Initialize WooCommerce session for guests
        $this->ensure_wc_session();

        $product_id = intval($req->get_param('product_id'));
        $quantity = max(1, intval($req->get_param('quantity')));
        $meta = (array) $req->get_param('meta');

        if (!$product_id) {
            return new WP_Error('bad_request', 'Missing product_id', ['status' => 400]);
        }

        $added_key = WC()->cart->add_to_cart($product_id, $quantity, 0, [], ['hptd_meta' => $meta]);
        
        if (!$added_key) {
            return new WP_Error('add_failed', 'Could not add to cart', ['status' => 500]);
        }

        return ['success' => true, 'cart_key' => $added_key];
    }

    public function rest_create_quote(WP_REST_Request $req) {
        // Admin-only route with nonce verification
        $check = $this->verify_nonce();
        if ($check !== true) {
            return $check;
        }

        $product_id = intval($req->get_param('product_id'));
        $meta = (array) $req->get_param('meta');
        $quantity = max(1, intval($req->get_param('quantity')));

        if (!$product_id) {
            return new WP_Error('bad_request', 'Missing product_id', ['status' => 400]);
        }

        $order = wc_create_order();
        $product = wc_get_product($product_id);
        
        if (!$product) {
            return new WP_Error('bad_product', 'Invalid product', ['status' => 400]);
        }

        $item_id = $order->add_product($product, $quantity);
        
        if ($item_id) {
            // Add all meta data to the order item
            foreach ($meta as $k => $v) {
                wc_add_order_item_meta($item_id, $k, is_scalar($v) ? $v : wp_json_encode($v), true);
            }
            
            // Set custom price if provided
            if (isset($meta['hptd_computed_total'])) {
                $desired = floatval($meta['hptd_computed_total']);
                $item = $order->get_item($item_id);
                if ($item && $desired > 0) {
                    $item->set_subtotal($desired);
                    $item->set_total($desired);
                    $item->save();
                }
            }
        }

        $order->calculate_totals();
        $order->set_status('pending');
        $order->save();

        return [
            'success' => true,
            'order_id' => $order->get_id(),
            'order_edit_url' => admin_url('post.php?post=' . $order->get_id() . '&action=edit')
        ];
    }

    private function ensure_wc_session() {
        // Initialize WooCommerce session for REST API requests
        if (is_null(WC()->session) && method_exists(WC(), 'initialize_session')) {
            WC()->initialize_session();
        }

        if (is_null(WC()->customer)) {
            WC()->customer = new WC_Customer(get_current_user_id(), true);
            $base = wc_get_base_location();
            if (!empty($base['country'])) {
                WC()->customer->set_billing_country($base['country']);
                WC()->customer->set_shipping_country($base['country']);
                if (!empty($base['state'])) {
                    WC()->customer->set_billing_state($base['state']);
                    WC()->customer->set_shipping_state($base['state']);
                }
                WC()->customer->save();
            }
        }

        if (is_null(WC()->cart) && function_exists('wc_load_cart')) {
            wc_load_cart();
        }
    }

    // Show friendly fields in cart/checkout
    public function display_cart_meta($item_data, $cart_item) {
        if (empty($cart_item['hptd_meta']) || !is_array($cart_item['hptd_meta'])) {
            return $item_data;
        }

        $display_fields = [
            'hptd_model' => 'Model',
            'hptd_finish' => 'Finish',
            'hptd_size' => 'Size',
            'hptd_cloth_family' => 'Cloth',
            'hptd_cloth_colour' => 'Cloth Colour',
            'hptd_model_type' => 'Model Type',
            'hptd_delivery_install' => 'Delivery & Installation',
            'hptd_accessory_pack' => 'Accessory Pack',
            'hptd_eta' => 'ETA',
        ];

        foreach ($display_fields as $key => $label) {
            if (array_key_exists($key, $cart_item['hptd_meta'])) {
                $val = $cart_item['hptd_meta'][$key];
                $item_data[] = [
                    'key' => $label,
                    'value' => is_scalar($val) ? $val : wp_json_encode($val),
                    'display' => is_scalar($val) ? wc_clean($val) : wc_clean(wp_json_encode($val)),
                ];
            }
        }
        
        return $item_data;
    }

    // Persist meta into order line items
    public function save_order_meta($item, $cart_item_key, $values, $order) {
        if (!empty($values['hptd_meta'])) {
            foreach ($values['hptd_meta'] as $k => $v) {
                $item->add_meta_data($k, is_scalar($v) ? $v : wp_json_encode($v), true);
            }
        }
    }

    // Override cart line price with configurator's computed total
    public function override_cart_price($cart) {
        if (is_admin() && !defined('DOING_AJAX')) {
            return;
        }
        
        if (empty($cart) || is_wp_error($cart)) {
            return;
        }

        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            if (!empty($cart_item['hptd_meta']) && isset($cart_item['hptd_meta']['hptd_computed_total'])) {
                $desired = floatval($cart_item['hptd_meta']['hptd_computed_total']);
                $product = $cart_item['data'];
                if ($desired > 0 && $product instanceof WC_Product) {
                    $product->set_price($desired);
                }
            }
        }
    }
}

// Initialize the plugin
new HPTD_Configurator();