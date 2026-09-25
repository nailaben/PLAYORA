-- =============================================
-- PLAYORA Database Schema
-- PostgreSQL
-- =============================================

-- Create sellers table
CREATE TABLE IF NOT EXISTS sellers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'category',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    stock_quantity INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_address TEXT NOT NULL,
    notes TEXT,
    subtotal DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name_ar VARCHAR(255) NOT NULL,
    product_name_en VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO categories (name_ar, name_en, icon) VALUES
    ('بطاقات رقمية', 'Digital Cards', 'credit_card'),
    ('ألعاب', 'Gaming', 'sports_esports'),
    ('بث مباشر', 'Streaming', 'play_circle'),
    ('برامج', 'Software', 'computer'),
    ('هواتف وإلكترونيات', 'Electronics', 'phone_android')
ON CONFLICT DO NOTHING;

-- Insert default seller (password: admin123)
INSERT INTO sellers (name, email, password_hash) VALUES
    ('PLAYORA Admin', 'admin@playora.com', '$2a$10$LP4IPBr.AI/wi6YYfFFvne0ks8eS4iptKZll7oy5zn/31ChhxhI0S')
ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (seller_id, name_ar, name_en, description_ar, description_en, price, category_id, stock_quantity, image_url) VALUES
    (1, 'بطاقة Google Play 50$', 'Google Play Card $50', 'بطاقة هدايا Google Play بقيمة 50 دولار لشراء التطبيقات والألعاب والمزيد من متجر Google Play', 'Google Play Gift Card worth $50 for apps, games and more from Google Play Store', 50.00, 1, 100, '/images/google-play.png'),
    (1, 'بطاقة iTunes 25$', 'iTunes Card $25', 'بطاقة هدايا iTunes/App Store بقيمة 25 دولار للموسيقى والتطبيقات والأفلام', 'iTunes/App Store Gift Card worth $25 for music, apps and movies', 25.00, 1, 150, '/images/itunes.png'),
    (1, 'بطاقة PlayStation Store 100$', 'PlayStation Store Card $100', 'بطاقة PSN بقيمة 100 دولار لشراء الألعاب والمحتوى الإضافي من متجر PlayStation', 'PSN Card worth $100 for games and DLC from PlayStation Store', 100.00, 2, 80, '/images/playstation.png'),
    (1, 'بطاقة Steam 50$', 'Steam Card $50', 'بطاقة Steam بقيمة 50 دولار لشراء الألعاب من منصة Steam', 'Steam Wallet Card worth $50 for games on Steam platform', 50.00, 2, 120, '/images/steam.png'),
    (1, 'اشتراك Netflix شهر', 'Netflix 1 Month', 'اشتراك Netflix لمدة شهر كامل بجودة HD للمشاهدة على جميع الأجهزة', 'Netflix subscription for 1 month HD quality on all devices', 15.00, 3, 200, '/images/netflix.png'),
    (1, 'اشتراك Spotify 3 أشهر', 'Spotify 3 Months', 'اشتراك Spotify Premium لمدة 3 أشهر بدون إعلانات وبجودة صوت عالية', 'Spotify Premium subscription for 3 months without ads and high quality audio', 18.00, 3, 175, '/images/spotify.png')
ON CONFLICT DO NOTHING;
