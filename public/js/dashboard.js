/* =============================================
   PLAYORA - Dashboard JS
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
    checkAuth();
    initLang();
    applyDashboardTranslations();
    setupSidebar();
    setupLangToggle();
    loadSellerInfo();
    document.addEventListener('langChange', async () => {
        applyDashboardTranslations();
        await showTab(currentTab);
    });
    await loadStats();
    await showTab('products');
});

// ---- Auth ----
function checkAuth() {
    if (!getToken()) window.location.href = '/seller/login.html';
}

function loadSellerInfo() {
    const seller = getSeller();
    if (!seller) return;
    const initials = seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('seller-avatar').textContent = initials;
    document.getElementById('seller-name').textContent = seller.name;
    document.getElementById('seller-email').textContent = seller.email;
    document.getElementById('topbar-seller').textContent = seller.name;
}

document.getElementById('logout-btn')?.addEventListener('click', () => {
    removeToken();
    window.location.href = '/seller/login.html';
});

// ---- Sidebar ----
function setupSidebar() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    mobileBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
}

function setupLangToggle() {
    document.querySelectorAll('.lang-toggle').forEach(btn => {
        btn.addEventListener('click', nextLang);
    });
}

// ---- Stats ----
async function loadStats() {
    try {
        const res = await api.getStats();
        if (res.success) {
            const { totalProducts, totalOrders, totalRevenue, pendingOrders } = res.stats;
            animateCount('stat-products', totalProducts);
            animateCount('stat-orders', totalOrders);
            document.getElementById('stat-revenue').textContent = formatPrice(totalRevenue);
            animateCount('stat-pending', pendingOrders);
            const navBadge = document.getElementById('orders-badge');
            if (navBadge) navBadge.textContent = pendingOrders;
        }
    } catch (e) { console.error('Stats error:', e); }
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(timer);
    }, 40);
}

// ---- Tabs ----
let currentTab = 'products';

async function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    document.getElementById('topbar-title').textContent =
        tab === 'products' ? t('إدارة المنتجات', 'Products Management', 'Gestion des produits') :
        tab === 'orders'   ? t('الطلبات', 'Orders', 'Commandes') : 'PLAYORA';

    if (tab === 'products') await loadProductsTable();
    if (tab === 'orders') await loadOrdersTable();
}

window.showTab = showTab;

// ---- Products Tab ----
let products = [];
let editingProductId = null;

async function loadProductsTable(search = '') {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>`;

    const res = await api.getSellerProducts();
    if (!res.success) return;

    products = res.products;

    let filtered = products;
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
            p.name_ar.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📦</div><p>${t('لا توجد منتجات', 'No products found', 'Aucun produit trouvé')}</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.75rem">
                    ${p.image_url
                        ? `<img src="${p.image_url}" alt="${p.name_ar}" class="product-thumb" onerror="this.src='/images/placeholder.png'">`
                        : `<div class="product-thumb-placeholder"><span class="material-symbols-outlined">image</span></div>`}
                </div>
            </td>
            <td>
                <div style="font-weight:600;font-size:0.875rem">${p.name_ar}</div>
                <div style="color:var(--text-muted);font-size:0.78rem">${p.name_en}</div>
            </td>
            <td>${p.category_name_ar || '—'}</td>
            <td><span style="font-weight:700;color:var(--primary-light)">${formatPrice(p.price)}</span></td>
            <td>
                <span class="${p.stock_quantity > 0 ? 'badge badge-success' : 'badge badge-danger'}">
                    ${p.stock_quantity}
                </span>
            </td>
            <td>
                <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">
                    ${p.is_active
                        ? t('نشط', 'Active', 'Actif')
                        : t('مخفي', 'Hidden', 'Masqué')}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditProduct(${p.id})" title="${t('تعديل', 'Edit', 'Modifier')}">
                        <span class="material-symbols-outlined" style="font-size:1rem">edit</span>
                    </button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDeleteProduct(${p.id}, '${p.name_ar}')" title="${t('حذف', 'Delete', 'Supprimer')}">
                        <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Product search
document.getElementById('product-search')?.addEventListener('input', (e) => {
    clearTimeout(window._productSearchTimer);
    window._productSearchTimer = setTimeout(() => loadProductsTable(e.target.value), 300);
});

// ---- Product Modal ----
let productCategories = [];

async function openAddProduct() {
    editingProductId = null;
    await loadCategoriesForForm();
    clearProductForm();
    document.getElementById('product-modal-title').textContent = t('إضافة منتج جديد', 'Add New Product', 'Ajouter un produit');
    document.getElementById('product-modal').style.display = 'flex';
}

window.openAddProduct = openAddProduct;

async function openEditProduct(id) {
    editingProductId = id;
    await loadCategoriesForForm();
    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('product-modal-title').textContent = t('تعديل المنتج', 'Edit Product', 'Modifier le produit');
    document.getElementById('prod-name-ar').value = product.name_ar;
    document.getElementById('prod-name-en').value = product.name_en;
    document.getElementById('prod-desc-ar').value = product.description_ar || '';
    document.getElementById('prod-desc-en').value = product.description_en || '';
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-stock').value = product.stock_quantity;
    document.getElementById('prod-category').value = product.category_id || '';
    document.getElementById('prod-active').checked = product.is_active;

    if (product.image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = product.image_url;
        preview.style.display = 'block';
    }

    document.getElementById('product-modal').style.display = 'flex';
}

window.openEditProduct = openEditProduct;

async function loadCategoriesForForm() {
    if (productCategories.length === 0) {
        const res = await api.getCategories();
        if (res.success) productCategories = res.categories;
    }

    const select = document.getElementById('prod-category');
    select.innerHTML = `<option value="">${t('اختر الفئة', 'Select Category', 'Choisir une catégorie')}</option>` +
        productCategories.map(c => `<option value="${c.id}">${currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('');
}

function clearProductForm() {
    document.getElementById('product-form').reset();
    document.getElementById('image-preview').style.display = 'none';
}

document.getElementById('close-product-modal')?.addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
});

document.getElementById('product-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// Image preview
document.getElementById('prod-image')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('image-preview');
            preview.src = ev.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Submit product form
document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('save-product-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span>`;

    const formData = new FormData();
    formData.append('name_ar', document.getElementById('prod-name-ar').value.trim());
    formData.append('name_en', document.getElementById('prod-name-en').value.trim());
    formData.append('description_ar', document.getElementById('prod-desc-ar').value.trim());
    formData.append('description_en', document.getElementById('prod-desc-en').value.trim());
    formData.append('price', document.getElementById('prod-price').value);
    formData.append('stock_quantity', document.getElementById('prod-stock').value);
    formData.append('category_id', document.getElementById('prod-category').value);
    formData.append('is_active', document.getElementById('prod-active').checked);

    const imageFile = document.getElementById('prod-image').files[0];
    if (imageFile) formData.append('image', imageFile);

    const imageUrl = document.getElementById('prod-image-url').value.trim();
    if (imageUrl && !imageFile) formData.append('image_url', imageUrl);

    try {
        const res = editingProductId
            ? await api.updateProduct(editingProductId, formData)
            : await api.addProduct(formData);

        if (res.success) {
            showToast(
                editingProductId
                    ? t('✓ تم تحديث المنتج', '✓ Product updated', '✓ Produit modifié')
                    : t('✓ تمت إضافة المنتج', '✓ Product added', '✓ Produit ajouté'),
                'success'
            );
            document.getElementById('product-modal').style.display = 'none';
            await loadProductsTable();
            await loadStats();
        } else {
            showToast(res.message || 'حدث خطأ', 'error');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم', 'error');
    }

    btn.disabled = false;
    btn.textContent = t('حفظ', 'Save', 'Enregistrer');
});

// Delete product
window.confirmDeleteProduct = async function(id, name) {
    const confirm = window.confirm(
        t(`هل تريد حذف "${name}"؟`, `Delete "${name}"?`, `Supprimer « ${name} » ?`)
    );
    if (!confirm) return;

    const res = await api.deleteProduct(id);
    if (res.success) {
        showToast(t('✓ تم حذف المنتج', '✓ Product deleted', '✓ Produit supprimé'), 'success');
        await loadProductsTable();
        await loadStats();
    } else {
        showToast(res.message || 'حدث خطأ', 'error');
    }
};

// ---- Orders Tab ----
let currentOrderFilter = 'all';

async function loadOrdersTable() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>`;

    const res = await api.getOrders({ status: currentOrderFilter });
    if (!res.success) return;

    const orders = res.orders;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><p>${t('لا توجد طلبات', 'No orders found', 'Aucune commande trouvée')}</p></div></td></tr>`;
        return;
    }

    const statusLabels = {
        ar: { pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي' },
        en: { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', completed: 'Completed', cancelled: 'Cancelled' },
        fr: { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', completed: 'Terminée', cancelled: 'Annulée' }
    };

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><span style="font-weight:700;font-size:0.8rem;color:var(--primary-light)">${o.order_number}</span></td>
            <td>
                <div style="font-weight:600;font-size:0.875rem">${o.customer_name}</div>
                <div style="color:var(--text-muted);font-size:0.78rem">${o.customer_phone}</div>
            </td>
            <td style="font-size:0.8rem;color:var(--text-muted)">${o.customer_email}</td>
            <td>${o.items_count || '—'}</td>
            <td><span style="font-weight:700;color:var(--accent)">${formatPrice(o.total_amount)}</span></td>
            <td>
                <select class="status-select status-${o.status}" onchange="updateStatus(${o.id}, this.value, this)">
                    ${['pending','confirmed','shipped','completed','cancelled'].map(s => `
                        <option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabels[currentLang][s]}</option>
                    `).join('')}
                </select>
            </td>
            <td style="font-size:0.78rem;color:var(--text-muted)">${formatDate(o.created_at)}</td>
        </tr>
    `).join('');
}

window.updateStatus = async function(orderId, status, selectEl) {
    selectEl.className = `status-select status-${status}`;
    const res = await api.updateOrderStatus(orderId, status);
    if (res.success) {
        showToast(t('✓ تم تحديث الحالة', '✓ Status updated', '✓ Statut mis à jour'), 'success', 2000);
        await loadStats();
    } else {
        showToast('حدث خطأ', 'error');
    }
};

// Filter orders by status
document.querySelectorAll('[data-order-filter]').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('[data-order-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentOrderFilter = btn.getAttribute('data-order-filter');
        await loadOrdersTable();
    });
});

// ---- Translations ----
function applyDashboardTranslations() {
    document.querySelectorAll('[data-dash-i18n]').forEach(el => {
        const key = el.getAttribute('data-dash-i18n');
        const translations = {
            ar: {
                products_mgmt: 'إدارة المنتجات',
                orders_mgmt: 'الطلبات',
                add_product: 'إضافة منتج',
                product_name_ar: 'اسم المنتج (عربي)',
                product_name_en: 'اسم المنتج (إنجليزي)',
                desc_ar: 'الوصف (عربي)',
                desc_en: 'الوصف (إنجليزي)',
                price: 'السعر ($)',
                stock: 'الكمية المتوفرة',
                category: 'الفئة',
                image: 'صورة المنتج',
                active: 'المنتج نشط ومرئي للعملاء',
                save: 'حفظ',
                cancel: 'إلغاء',
                image_url: 'أو رابط الصورة',
                total_products: 'إجمالي المنتجات',
                total_orders: 'إجمالي الطلبات',
                total_revenue: 'إجمالي الإيرادات',
                pending_orders: 'طلبات معلقة',
                dashboard: 'الرئيسية',
                logout: 'تسجيل الخروج',
                seller_dashboard: 'لوحة تحكم البائع', main_menu: 'القائمة الرئيسية', tools: 'الأدوات', view_store: 'عرض المتجر',
            },
            en: {
                products_mgmt: 'Products Management',
                orders_mgmt: 'Orders',
                add_product: 'Add Product',
                product_name_ar: 'Product Name (Arabic)',
                product_name_en: 'Product Name (English)',
                desc_ar: 'Description (Arabic)',
                desc_en: 'Description (English)',
                price: 'Price ($)',
                stock: 'Stock Quantity',
                category: 'Category',
                image: 'Product Image',
                active: 'Product is active and visible to customers',
                save: 'Save',
                cancel: 'Cancel',
                image_url: 'Or image URL',
                total_products: 'Total Products',
                total_orders: 'Total Orders',
                total_revenue: 'Total Revenue',
                pending_orders: 'Pending Orders',
                dashboard: 'Dashboard',
                logout: 'Logout',
                seller_dashboard: 'Seller Dashboard', main_menu: 'Main Menu', tools: 'Tools', view_store: 'View Store',
            },
            fr: {
                products_mgmt: 'Gestion des produits', orders_mgmt: 'Commandes', add_product: 'Ajouter un produit',
                product_name_ar: 'Nom du produit (arabe)', product_name_en: 'Nom du produit (anglais)',
                desc_ar: 'Description (arabe)', desc_en: 'Description (anglais)', price: 'Prix ($)',
                stock: 'Quantité en stock', category: 'Catégorie', image: 'Image du produit',
                active: 'Produit actif et visible par les clients', save: 'Enregistrer', cancel: 'Annuler',
                image_url: 'Ou URL de l’image', total_products: 'Total des produits', total_orders: 'Total des commandes',
                total_revenue: 'Chiffre d’affaires total', pending_orders: 'Commandes en attente',
                dashboard: 'Tableau de bord', logout: 'Déconnexion', seller_dashboard: 'Espace vendeur',
                main_menu: 'Menu principal', tools: 'Outils', view_store: 'Voir la boutique',
            }
        };
        el.textContent = (translations[currentLang] || translations.ar)[key] || key;
    });
}
