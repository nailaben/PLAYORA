/* =============================================
   PLAYORA - Checkout JS
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    initLang();
    applyCheckoutTranslations();
    setupLangToggle();
    renderOrderSummary();
    setupForm();
    document.addEventListener('langChange', () => { applyCheckoutTranslations(); renderOrderSummary(); });
});

const checkoutI18n = {
    ar: {
        checkout_title: 'إتمام الطلب',
        order_summary: 'ملخص الطلب',
        customer_info: 'بيانات المشتري',
        full_name: 'الاسم الكامل',
        phone: 'رقم الهاتف',
        email: 'البريد الإلكتروني',
        address: 'العنوان',
        notes: 'ملاحظات (اختياري)',
        place_order: 'تأكيد الطلب',
        subtotal: 'المجموع الفرعي',
        total: 'الإجمالي',
        required: 'هذا الحقل مطلوب',
        invalid_phone: 'رقم هاتف غير صالح',
        invalid_email: 'بريد إلكتروني غير صالح',
        empty_cart: 'سلتك فارغة',
        processing: 'جاري معالجة الطلب...',
        back_to_store: 'العودة للمتجر',
        name_placeholder: 'أدخل اسمك الكامل',
        phone_placeholder: 'مثال: 0555123456',
        email_placeholder: 'example@email.com',
        address_placeholder: 'المدينة، الحي، الشارع، رقم البناء',
        notes_placeholder: 'أي ملاحظات إضافية للطلب',
        qty_label: 'الكمية',
    },
    en: {
        checkout_title: 'Checkout',
        order_summary: 'Order Summary',
        customer_info: 'Customer Information',
        full_name: 'Full Name',
        phone: 'Phone Number',
        email: 'Email Address',
        address: 'Delivery Address',
        notes: 'Notes (Optional)',
        place_order: 'Place Order',
        subtotal: 'Subtotal',
        total: 'Total',
        required: 'This field is required',
        invalid_phone: 'Invalid phone number',
        invalid_email: 'Invalid email address',
        empty_cart: 'Your cart is empty',
        processing: 'Processing order...',
        back_to_store: 'Back to Store',
        name_placeholder: 'Enter your full name',
        phone_placeholder: 'e.g. 0555123456',
        email_placeholder: 'example@email.com',
        address_placeholder: 'City, District, Street, Building',
        notes_placeholder: 'Any additional notes for your order',
        qty_label: 'Qty',
    }
};

function ctr(key) { return (checkoutI18n[currentLang] || checkoutI18n.ar)[key] || key; }

function applyCheckoutTranslations() {
    document.querySelectorAll('[data-co-i18n]').forEach(el => {
        el.textContent = ctr(el.getAttribute('data-co-i18n'));
    });
    document.querySelectorAll('[data-co-placeholder]').forEach(el => {
        el.placeholder = ctr(el.getAttribute('data-co-placeholder'));
    });
}

function setupLangToggle() {
    document.querySelectorAll('.lang-toggle').forEach(btn => {
        btn.addEventListener('click', () => setLang(currentLang === 'ar' ? 'en' : 'ar'));
    });
}

function renderOrderSummary() {
    const cart = getCart();
    const container = document.getElementById('order-items');
    const totalEl = document.getElementById('order-total');
    const subtotalEl = document.getElementById('order-subtotal');

    if (cart.length === 0) {
        window.location.href = '/';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <img src="${item.image_url || '/images/placeholder.png'}" alt="${currentLang === 'ar' ? item.name_ar : item.name_en}" 
                 onerror="this.src='/images/placeholder.png'">
            <div class="checkout-item-info">
                <div class="checkout-item-name">${currentLang === 'ar' ? item.name_ar : item.name_en}</div>
                <div class="checkout-item-qty">${ctr('qty_label')}: ${item.quantity}</div>
            </div>
            <div class="checkout-item-price">${formatPrice(item.price * item.quantity)}</div>
        </div>
    `).join('');

    const total = getCartTotal();
    subtotalEl.textContent = formatPrice(total);
    totalEl.textContent = formatPrice(total);
}

function setupForm() {
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> ${ctr('processing')}`;

        const cart = getCart();
        const orderData = {
            customer_name: document.getElementById('customer-name').value.trim(),
            customer_phone: document.getElementById('customer-phone').value.trim(),
            customer_email: document.getElementById('customer-email').value.trim(),
            customer_address: document.getElementById('customer-address').value.trim(),
            notes: document.getElementById('customer-notes').value.trim(),
            items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
        };

        try {
            const res = await api.createOrder(orderData);
            if (res.success) {
                clearCart();
                sessionStorage.setItem('last_order', JSON.stringify(res.order));
                window.location.href = '/order-success.html';
            } else {
                showToast(res.message || 'حدث خطأ، حاول مجدداً', 'error');
                btn.disabled = false;
                btn.textContent = ctr('place_order');
            }
        } catch (err) {
            showToast('حدث خطأ في الاتصال بالخادم', 'error');
            btn.disabled = false;
            btn.textContent = ctr('place_order');
        }
    });
}

function validateForm() {
    let valid = true;

    const fields = [
        { id: 'customer-name', key: 'required', check: v => v.length >= 2 },
        { id: 'customer-phone', key: 'invalid_phone', check: v => /^[\d\+\-\s]{7,15}$/.test(v) },
        { id: 'customer-email', key: 'invalid_email', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
        { id: 'customer-address', key: 'required', check: v => v.length >= 5 },
    ];

    fields.forEach(({ id, key, check }) => {
        const input = document.getElementById(id);
        const error = document.getElementById(`${id}-error`);
        const val = input.value.trim();

        if (!check(val)) {
            input.style.borderColor = 'var(--danger)';
            error.textContent = ctr(key);
            valid = false;
        } else {
            input.style.borderColor = '';
            error.textContent = '';
        }
    });

    return valid;
}
