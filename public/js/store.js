/* =============================================
   PLAYORA - Store JS
   ============================================= */

let allProducts = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    initLang();
    applyTranslations();
    setupNavbar();
    setupLangToggle();
    setupCart();
    await loadCategories();
    await loadProducts();
    document.addEventListener('langChange', () => { applyTranslations(); renderProducts(); renderCart(); renderCategories(); });
});

// ---- Translations ----
const i18n = {
    ar: {
        hero_badge: '🌟 وجهتك الأسرع للبطاقات الرقمية',
        hero_title_1: 'اكتشف عالم',
        hero_title_2: 'البطاقات الرقمية',
        hero_desc: 'أسرع وأسهل طريقة للحصول على بطاقات Google Play وiTunes وPSN والمزيد',
        shop_now: 'تسوق الآن',
        explore_cats: 'استعرض الفئات',
        all_products: 'كل المنتجات',
        new_arrivals: 'المنتجات',
        out_of_stock: 'نفدت الكمية',
        add_to_cart: 'أضف للسلة',
        cart_title: 'سلة التسوق',
        cart_empty: 'سلتك فارغة',
        checkout: 'إتمام الطلب',
        subtotal: 'المجموع',
        total: 'الإجمالي',
        products_label: 'منتج',
        orders_label: 'طلب مكتمل',
        customers_label: 'عميل راضٍ',
        loading: 'جاري التحميل...',
        no_products: 'لا توجد منتجات',
        search_placeholder: 'ابحث عن منتج...',
        store_link: 'المتجر',
    },
    en: {
        hero_badge: '🌟 Your Fastest Digital Cards Destination',
        hero_title_1: 'Discover the World of',
        hero_title_2: 'Digital Cards',
        hero_desc: 'The fastest and easiest way to get Google Play, iTunes, PSN cards and more',
        shop_now: 'Shop Now',
        explore_cats: 'Explore Categories',
        all_products: 'All Products',
        new_arrivals: 'Products',
        out_of_stock: 'Out of Stock',
        add_to_cart: 'Add to Cart',
        cart_title: 'Shopping Cart',
        cart_empty: 'Your cart is empty',
        checkout: 'Checkout',
        subtotal: 'Subtotal',
        total: 'Total',
        products_label: 'Products',
        orders_label: 'Completed Orders',
        customers_label: 'Happy Customers',
        loading: 'Loading...',
        no_products: 'No products found',
        search_placeholder: 'Search products...',
        store_link: 'Store',
    }
};

function tr(key) { return (i18n[currentLang] || i18n.ar)[key] || key; }

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = tr(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = tr(el.getAttribute('data-i18n-placeholder'));
    });
}

// ---- Navbar ----
function setupNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Search
    const searchInput = document.getElementById('search-input');
    const mobileSearch = document.getElementById('mobile-search');

    [searchInput, mobileSearch].forEach(input => {
        if (!input) return;
        let debounce;
        input.addEventListener('input', (e) => {
            clearTimeout(debounce);
            searchQuery = e.target.value;
            debounce = setTimeout(() => renderProducts(), 300);
        });
    });
}

function setupLangToggle() {
    document.querySelectorAll('.lang-toggle').forEach(btn => {
        btn.addEventListener('click', () => setLang(currentLang === 'ar' ? 'en' : 'ar'));
    });
}

// ---- Cart ----
let cartOpen = false;

function setupCart() {
    document.getElementById('cart-btn')?.addEventListener('click', openCart);
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
    document.getElementById('close-cart-btn')?.addEventListener('click', closeCart);
    document.getElementById('checkout-btn')?.addEventListener('click', () => {
        if (getCartCount() === 0) { showToast(tr('cart_empty'), 'error'); return; }
        window.location.href = '/checkout.html';
    });
    updateCartBadge();
}

function openCart() {
    document.getElementById('cart-overlay').style.display = 'block';
    document.getElementById('cart-sidebar').style.display = 'flex';
    cartOpen = true;
    renderCart();
}

function closeCart() {
    document.getElementById('cart-overlay').style.display = 'none';
    document.getElementById('cart-sidebar').style.display = 'none';
    cartOpen = false;
}

function updateCartBadge() {
    const count = getCartCount();
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function renderCart() {
    const cart = getCart();
    const body = document.getElementById('cart-body');
    const emptyMsg = document.getElementById('cart-empty');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total');
    if (!body) return;

    if (cart.length === 0) {
        body.innerHTML = '';
        emptyMsg.style.display = 'block';
        footer.style.display = 'none';
        return;
    }

    emptyMsg.style.display = 'none';
    footer.style.display = 'block';

    body.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img class="cart-item-img" src="${item.image_url || '/images/placeholder.png'}" 
                 alt="${currentLang === 'ar' ? item.name_ar : item.name_en}" onerror="this.src='/images/placeholder.png'">
            <div class="cart-item-info">
                <div class="cart-item-name">${currentLang === 'ar' ? item.name_ar : item.name_en}</div>
                <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="changeQty(${item.product_id}, -1)">−</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn" onclick="changeQty(${item.product_id}, 1)">+</button>
                </div>
            </div>
            <span class="cart-item-remove material-symbols-outlined" onclick="removeItem(${item.product_id})">close</span>
        </div>
    `).join('');

    totalEl.textContent = formatPrice(getCartTotal());
}

window.changeQty = function(productId, delta) {
    const cart = getCart();
    const item = cart.find(i => i.product_id === productId);
    if (item) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) { removeFromCart(productId); }
        else { updateCartQty(productId, newQty); }
    }
    updateCartBadge();
    renderCart();
};

window.removeItem = function(productId) {
    removeFromCart(productId);
    updateCartBadge();
    renderCart();
};

// ---- Categories ----
async function loadCategories() {
    const res = await api.getCategories();
    if (res.success) {
        allCategories = res.categories;
        renderCategories();
    }
}

function renderCategories() {
    const container = document.getElementById('categories-filter');
    if (!container) return;

    const allBtn = `
        <button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">
            <span class="material-symbols-outlined">apps</span>
            ${tr('all_products')}
        </button>`;

    const catBtns = allCategories.map(cat => `
        <button class="cat-btn ${activeCategory === String(cat.id) ? 'active' : ''}" onclick="filterByCategory('${cat.id}')">
            <span class="material-symbols-outlined">${cat.icon}</span>
            ${currentLang === 'ar' ? cat.name_ar : cat.name_en}
        </button>
    `).join('');

    container.innerHTML = allBtn + catBtns;
}

window.filterByCategory = function(cat) {
    activeCategory = String(cat);
    renderCategories();
    renderProducts();
};

// ---- Products ----
async function loadProducts() {
    showSkeletons();
    try {
        const res = await api.getProducts();
        if (res.success) {
            allProducts = res.products;
            renderProducts();
        }
    } catch (e) {
        document.getElementById('products-grid').innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">⚠️</div>
                <p>تعذر الاتصال بالخادم</p>
            </div>`;
    }
}

function showSkeletons() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = Array(8).fill(`
        <div class="skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-line" style="width:80%"></div>
                <div class="skeleton skeleton-line skeleton-line-short"></div>
                <div class="skeleton skeleton-line" style="width:40%;margin-top:1rem"></div>
            </div>
        </div>
    `).join('');
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let filtered = allProducts;

    if (activeCategory !== 'all') {
        filtered = filtered.filter(p => String(p.category_id) === activeCategory);
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
            p.name_ar.toLowerCase().includes(q) ||
            p.name_en.toLowerCase().includes(q) ||
            (p.description_ar && p.description_ar.toLowerCase().includes(q)) ||
            (p.description_en && p.description_en.toLowerCase().includes(q))
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state-icon">🔍</div>
                <p>${tr('no_products')}</p>
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const outOfStock = product.stock_quantity <= 0;
        const name = currentLang === 'ar' ? product.name_ar : product.name_en;
        const desc = currentLang === 'ar' ? product.description_ar : product.description_en;
        const catName = currentLang === 'ar' ? product.category_name_ar : product.category_name_en;

        return `
        <div class="product-card" onclick="goToProduct(${product.id})">
            <div class="product-card-img">
                <img src="${product.image_url || '/images/placeholder.png'}" alt="${name}" 
                     onerror="this.src='/images/placeholder.png'" loading="lazy">
                ${catName ? `<span class="product-card-badge">${catName}</span>` : ''}
                ${outOfStock ? `<div class="product-card-out">${tr('out_of_stock')}</div>` : ''}
            </div>
            <div class="product-card-body">
                <div class="product-card-name">${name}</div>
                <div class="product-card-desc">${desc || ''}</div>
                <div class="product-card-footer">
                    <span class="product-price">${formatPrice(product.price)}</span>
                    <button class="add-to-cart-btn" 
                            onclick="event.stopPropagation(); handleAddToCart(${product.id})"
                            ${outOfStock ? 'disabled' : ''}
                            title="${tr('add_to_cart')}">
                        <span class="material-symbols-outlined">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.goToProduct = function(id) {
    window.location.href = `/product.html?id=${id}`;
};

window.handleAddToCart = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product || product.stock_quantity <= 0) return;
    addToCart(product);
    updateCartBadge();
    showToast(
        currentLang === 'ar' ? `✓ أُضيف إلى السلة` : `✓ Added to cart`,
        'success', 2000
    );
    if (cartOpen) renderCart();
};

// ---- Scroll to products ----
window.scrollToProducts = function() {
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
};
