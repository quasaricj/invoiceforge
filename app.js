/* ============================================
   InvoiceForge - Application Logic
   ============================================ */

(function () {
    'use strict';

    // ===== STATE =====
    const state = {
        theme: 'blue',
        currency: '$',
        businessName: '',
        businessAddress: '',
        businessEmail: '',
        businessPhone: '',
        logoData: null,
        clientName: '',
        clientAddress: '',
        clientEmail: '',
        invoiceNumber: '',
        invoiceDate: '',
        dueDate: '',
        taxRate: 0,
        items: [
            { description: '', quantity: 1, rate: 0 }
        ],
        notes: '',
        terms: ''
    };

    // ===== DOM REFS =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        navbar: $('#navbar'),
        mobileMenuBtn: $('#mobileMenuBtn'),
        navLinks: $('.nav-links'),
        businessName: $('#businessName'),
        businessAddress: $('#businessAddress'),
        businessEmail: $('#businessEmail'),
        businessPhone: $('#businessPhone'),
        logoUpload: $('#logoUpload'),
        logoInput: $('#logoInput'),
        logoPreviewImg: $('#logoPreviewImg'),
        logoRemoveBtn: $('#logoRemoveBtn'),
        logoUploadContent: $('#logoUploadContent'),
        clientName: $('#clientName'),
        clientAddress: $('#clientAddress'),
        clientEmail: $('#clientEmail'),
        invoiceNumber: $('#invoiceNumber'),
        invoiceDate: $('#invoiceDate'),
        dueDate: $('#dueDate'),
        taxRate: $('#taxRate'),
        currency: $('#currency'),
        lineItems: $('#lineItems'),
        addItemBtn: $('#addItemBtn'),
        notes: $('#notes'),
        terms: $('#terms'),
        downloadPdfBtn: $('#downloadPdfBtn'),
        printInvoiceBtn: $('#printInvoiceBtn'),
        saveDataBtn: $('#saveDataBtn'),
        loadDataBtn: $('#loadDataBtn'),
        clearDataBtn: $('#clearDataBtn'),
        invoicePreview: $('#invoicePreview'),
        toast: $('#toast'),
        loadingOverlay: $('#loadingOverlay')
    };

    // ===== INIT =====
    function init() {
        setDefaultDates();
        bindEvents();
        renderLineItems();
        updatePreview();
        autoLoadSaved();
    }

    function setDefaultDates() {
        const today = new Date();
        const due = new Date();
        due.setDate(today.getDate() + 30);
        dom.invoiceDate.value = formatDateInput(today);
        dom.dueDate.value = formatDateInput(due);
        state.invoiceDate = dom.invoiceDate.value;
        state.dueDate = dom.dueDate.value;
        state.invoiceNumber = 'INV-001';
        dom.invoiceNumber.value = 'INV-001';
    }

    function formatDateInput(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // ===== EVENT BINDING =====
    function bindEvents() {
        // Navbar scroll
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Mobile menu
        dom.mobileMenuBtn.addEventListener('click', () => {
            dom.mobileMenuBtn.classList.toggle('open');
            dom.navLinks.classList.toggle('open');
        });

        // Close mobile menu on link click
        $$('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                dom.mobileMenuBtn.classList.remove('open');
                dom.navLinks.classList.remove('open');
            });
        });

        // Theme selector
        $$('.theme-option').forEach(opt => {
            opt.addEventListener('click', () => {
                $$('.theme-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                state.theme = opt.dataset.theme;
                updatePreview();
            });
        });

        // Currency selector
        dom.currency.addEventListener('change', () => {
            state.currency = dom.currency.value;
            updatePreview();
        });

        // Form inputs -> state sync
        const inputMap = {
            businessName: 'businessName',
            businessAddress: 'businessAddress',
            businessEmail: 'businessEmail',
            businessPhone: 'businessPhone',
            clientName: 'clientName',
            clientAddress: 'clientAddress',
            clientEmail: 'clientEmail',
            invoiceNumber: 'invoiceNumber',
            invoiceDate: 'invoiceDate',
            dueDate: 'dueDate',
            notes: 'notes',
            terms: 'terms'
        };

        Object.entries(inputMap).forEach(([domKey, stateKey]) => {
            dom[domKey].addEventListener('input', () => {
                state[stateKey] = dom[domKey].value;
                updatePreview();
            });
        });

        dom.taxRate.addEventListener('input', () => {
            state.taxRate = parseFloat(dom.taxRate.value) || 0;
            updatePreview();
        });

        // Logo upload
        dom.logoUpload.addEventListener('click', (e) => {
            if (e.target !== dom.logoRemoveBtn && !dom.logoRemoveBtn.contains(e.target)) {
                dom.logoInput.click();
            }
        });

        dom.logoUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.logoUpload.style.borderColor = 'var(--accent-blue)';
        });

        dom.logoUpload.addEventListener('dragleave', () => {
            dom.logoUpload.style.borderColor = '';
        });

        dom.logoUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.logoUpload.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file) handleLogoFile(file);
        });

        dom.logoInput.addEventListener('change', () => {
            const file = dom.logoInput.files[0];
            if (file) handleLogoFile(file);
        });

        dom.logoRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.logoData = null;
            dom.logoUpload.classList.remove('has-logo');
            dom.logoPreviewImg.src = '';
            dom.logoInput.value = '';
            updatePreview();
            showToast('Logo removed', 'success');
        });

        // Line items
        dom.addItemBtn.addEventListener('click', addLineItem);

        // Action buttons
        dom.downloadPdfBtn.addEventListener('click', downloadPdf);
        dom.printInvoiceBtn.addEventListener('click', printInvoice);
        dom.saveDataBtn.addEventListener('click', saveData);
        dom.loadDataBtn.addEventListener('click', loadData);
        dom.clearDataBtn.addEventListener('click', clearData);
    }

    // ===== NAVBAR SCROLL =====
    function handleScroll() {
        if (window.scrollY > 50) {
            dom.navbar.classList.add('scrolled');
        } else {
            dom.navbar.classList.remove('scrolled');
        }
    }

    // ===== LOGO HANDLING =====
    function handleLogoFile(file) {
        if (file.size > 2 * 1024 * 1024) {
            showToast('Logo must be under 2MB', 'error');
            return;
        }

        if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
            showToast('Only PNG, JPG, SVG files allowed', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            state.logoData = e.target.result;
            dom.logoPreviewImg.src = state.logoData;
            dom.logoUpload.classList.add('has-logo');
            updatePreview();
            showToast('Logo uploaded successfully', 'success');
        };
        reader.readAsDataURL(file);
    }

    // ===== LINE ITEMS =====
    function addLineItem() {
        state.items.push({ description: '', quantity: 1, rate: 0 });
        renderLineItems();
        updatePreview();
    }

    function removeLineItem(index) {
        if (state.items.length <= 1) {
            showToast('At least one item is required', 'error');
            return;
        }
        state.items.splice(index, 1);
        renderLineItems();
        updatePreview();
    }

    function renderLineItems() {
        dom.lineItems.innerHTML = '';

        state.items.forEach((item, index) => {
            const amount = (item.quantity * item.rate);
            const row = document.createElement('div');
            row.className = 'line-item';
            row.innerHTML = `
                <input type="text" class="form-input item-desc-input" placeholder="Item description" value="${escapeHtml(item.description)}" data-index="${index}" data-field="description">
                <input type="number" class="form-input item-qty-input" placeholder="1" value="${item.quantity}" min="0" step="1" data-index="${index}" data-field="quantity">
                <input type="number" class="form-input item-rate-input" placeholder="0.00" value="${item.rate || ''}" min="0" step="0.01" data-index="${index}" data-field="rate">
                <div class="item-amount">${state.currency}${formatNumber(amount)}</div>
                <button type="button" class="btn-remove-item" data-index="${index}" title="Remove item">&times;</button>
            `;
            dom.lineItems.appendChild(row);
        });

        // Bind events on new inputs
        dom.lineItems.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;

                if (field === 'description') {
                    state.items[idx].description = e.target.value;
                } else if (field === 'quantity') {
                    state.items[idx].quantity = parseFloat(e.target.value) || 0;
                } else if (field === 'rate') {
                    state.items[idx].rate = parseFloat(e.target.value) || 0;
                }

                // Update amount display
                const row = e.target.closest('.line-item');
                const amountEl = row.querySelector('.item-amount');
                const amt = state.items[idx].quantity * state.items[idx].rate;
                amountEl.textContent = `${state.currency}${formatNumber(amt)}`;

                updatePreview();
            });
        });

        // Bind remove buttons
        dom.lineItems.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeLineItem(parseInt(e.target.dataset.index));
            });
        });
    }

    // ===== CALCULATIONS =====
    function calcSubtotal() {
        return state.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    }

    function calcTax(subtotal) {
        return subtotal * (state.taxRate / 100);
    }

    function calcTotal(subtotal, tax) {
        return subtotal + tax;
    }

    // ===== UPDATE PREVIEW =====
    function updatePreview() {
        const subtotal = calcSubtotal();
        const tax = calcTax(subtotal);
        const total = calcTotal(subtotal, tax);
        const themeClass = `theme-${state.theme}`;

        const logoHtml = state.logoData
            ? `<img src="${state.logoData}" alt="Logo" class="inv-logo">`
            : '';

        const businessNameHtml = state.businessName || 'Your Business Name';
        const businessDetailsLines = [];
        if (state.businessAddress) businessDetailsLines.push(escapeHtml(state.businessAddress));
        if (state.businessEmail) businessDetailsLines.push(escapeHtml(state.businessEmail));
        if (state.businessPhone) businessDetailsLines.push(escapeHtml(state.businessPhone));
        const businessDetailsHtml = businessDetailsLines.join('\n') || '123 Main Street\nyou@email.com';

        const clientNameHtml = state.clientName || 'Client Name';
        const clientDetailsLines = [];
        if (state.clientAddress) clientDetailsLines.push(escapeHtml(state.clientAddress));
        if (state.clientEmail) clientDetailsLines.push(escapeHtml(state.clientEmail));
        const clientDetailsHtml = clientDetailsLines.join('\n') || 'Client address';

        const invoiceNum = state.invoiceNumber || 'INV-001';
        const invoiceDateFormatted = state.invoiceDate ? formatDateDisplay(state.invoiceDate) : formatDateDisplay(formatDateInput(new Date()));
        const dueDateFormatted = state.dueDate ? formatDateDisplay(state.dueDate) : '—';

        let itemsHtml = '';
        state.items.forEach(item => {
            const amt = item.quantity * item.rate;
            itemsHtml += `
                <tr>
                    <td class="item-desc">${escapeHtml(item.description) || 'Item description'}</td>
                    <td>${item.quantity}</td>
                    <td>${state.currency}${formatNumber(item.rate)}</td>
                    <td><strong>${state.currency}${formatNumber(amt)}</strong></td>
                </tr>
            `;
        });

        let notesHtml = '';
        if (state.notes) {
            notesHtml += `
                <div class="inv-notes-section">
                    <div class="inv-notes-label">Notes</div>
                    <div class="inv-notes-text">${escapeHtml(state.notes)}</div>
                </div>
            `;
        }
        if (state.terms) {
            notesHtml += `
                <div class="inv-notes-section">
                    <div class="inv-notes-label">Terms &amp; Conditions</div>
                    <div class="inv-notes-text">${escapeHtml(state.terms)}</div>
                </div>
            `;
        }

        const footerHtml = notesHtml ? `<div class="inv-footer">${notesHtml}</div>` : '';

        dom.invoicePreview.className = `invoice-preview ${themeClass}`;
        dom.invoicePreview.innerHTML = `
            <div class="inv-header">
                <div class="inv-brand">
                    ${logoHtml}
                    <div class="inv-business-name">${escapeHtml(businessNameHtml)}</div>
                    <div class="inv-business-details">${businessDetailsHtml}</div>
                </div>
                <div class="inv-title-block">
                    <div class="inv-title">INVOICE</div>
                    <div class="inv-meta">
                        <strong>Invoice #:</strong> ${escapeHtml(invoiceNum)}<br>
                        <strong>Date:</strong> ${invoiceDateFormatted}<br>
                        <strong>Due Date:</strong> ${dueDateFormatted}
                    </div>
                </div>
            </div>

            <div class="inv-color-bar"></div>

            <div class="inv-parties">
                <div class="inv-party">
                    <div class="inv-party-label">From</div>
                    <div class="inv-party-name">${escapeHtml(businessNameHtml)}</div>
                    <div class="inv-party-details">${businessDetailsHtml}</div>
                </div>
                <div class="inv-party">
                    <div class="inv-party-label">Bill To</div>
                    <div class="inv-party-name">${escapeHtml(clientNameHtml)}</div>
                    <div class="inv-party-details">${clientDetailsHtml}</div>
                </div>
            </div>

            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>

            <div class="inv-totals">
                <div class="inv-totals-table">
                    <div class="inv-totals-row">
                        <span>Subtotal</span>
                        <span class="inv-total-amount">${state.currency}${formatNumber(subtotal)}</span>
                    </div>
                    ${state.taxRate > 0 ? `
                    <div class="inv-totals-row">
                        <span>Tax (${state.taxRate}%)</span>
                        <span class="inv-total-amount">${state.currency}${formatNumber(tax)}</span>
                    </div>
                    ` : ''}
                    <div class="inv-totals-row total">
                        <span>Total</span>
                        <span class="inv-total-amount">${state.currency}${formatNumber(total)}</span>
                    </div>
                </div>
            </div>

            ${footerHtml}

            <div class="inv-watermark">Created with InvoiceForge — Free Professional Invoice Generator</div>
        `;
    }

    // ===== BUILD INVOICE HTML WITH ALL STYLES =====
    function buildInvoiceStandaloneHTML() {
        const themeColors = {
            blue: { primary: '#2563eb', gradient: 'linear-gradient(90deg, #2563eb, #3b82f6)' },
            dark: { primary: '#1f2937', gradient: 'linear-gradient(90deg, #1f2937, #4b5563)' },
            green: { primary: '#059669', gradient: 'linear-gradient(90deg, #059669, #34d399)' }
        };
        const tc = themeColors[state.theme] || themeColors.blue;

        const subtotal = calcSubtotal();
        const tax = calcTax(subtotal);
        const total = calcTotal(subtotal, tax);

        const logoHtml = state.logoData
            ? `<img src="${state.logoData}" alt="Logo" style="max-width:120px;max-height:50px;object-fit:contain;margin-bottom:6px;">`
            : '';

        const businessNameHtml = escapeHtml(state.businessName || 'Your Business Name');
        const businessDetailsLines = [];
        if (state.businessAddress) businessDetailsLines.push(escapeHtml(state.businessAddress));
        if (state.businessEmail) businessDetailsLines.push(escapeHtml(state.businessEmail));
        if (state.businessPhone) businessDetailsLines.push(escapeHtml(state.businessPhone));
        const businessDetailsHtml = businessDetailsLines.join('\n') || '123 Main Street\nyou@email.com';

        const clientNameHtml = escapeHtml(state.clientName || 'Client Name');
        const clientDetailsLines = [];
        if (state.clientAddress) clientDetailsLines.push(escapeHtml(state.clientAddress));
        if (state.clientEmail) clientDetailsLines.push(escapeHtml(state.clientEmail));
        const clientDetailsHtml = clientDetailsLines.join('\n') || 'Client address';

        const invoiceNum = escapeHtml(state.invoiceNumber || 'INV-001');
        const invoiceDateFormatted = state.invoiceDate ? formatDateDisplay(state.invoiceDate) : formatDateDisplay(formatDateInput(new Date()));
        const dueDateFormatted = state.dueDate ? formatDateDisplay(state.dueDate) : '—';

        let itemsHtml = '';
        state.items.forEach(item => {
            const amt = item.quantity * item.rate;
            itemsHtml += `
                <tr>
                    <td style="padding:10px 12px;font-size:10.5px;border-bottom:1px solid #f0f0f5;font-weight:500;color:#1a1a2e;">${escapeHtml(item.description) || 'Item description'}</td>
                    <td style="padding:10px 12px;font-size:10.5px;border-bottom:1px solid #f0f0f5;text-align:right;color:#374151;">${item.quantity}</td>
                    <td style="padding:10px 12px;font-size:10.5px;border-bottom:1px solid #f0f0f5;text-align:right;color:#374151;">${state.currency}${formatNumber(item.rate)}</td>
                    <td style="padding:10px 12px;font-size:10.5px;border-bottom:1px solid #f0f0f5;text-align:right;color:#374151;"><strong>${state.currency}${formatNumber(amt)}</strong></td>
                </tr>
            `;
        });

        let notesHtml = '';
        if (state.notes) {
            notesHtml += `
                <div style="margin-bottom:12px;">
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.6;">Notes</div>
                    <div style="font-size:10px;color:#6b7280;line-height:1.6;white-space:pre-line;">${escapeHtml(state.notes)}</div>
                </div>
            `;
        }
        if (state.terms) {
            notesHtml += `
                <div style="margin-bottom:12px;">
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.6;">Terms &amp; Conditions</div>
                    <div style="font-size:10px;color:#6b7280;line-height:1.6;white-space:pre-line;">${escapeHtml(state.terms)}</div>
                </div>
            `;
        }

        const footerHtml = notesHtml ? `<div style="padding:20px 32px 12px;border-top:1px solid #f0f0f5;">${notesHtml}</div>` : '';

        const taxRowHtml = state.taxRate > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:10.5px;color:#6b7280;">
                <span>Tax (${state.taxRate}%)</span>
                <span style="font-weight:700;">${state.currency}${formatNumber(tax)}</span>
            </div>
        ` : '';

        return `
            <div style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5;width:800px;margin:0 auto;padding:40px;">
                <div style="padding:32px 32px 24px;display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${logoHtml}
                        <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${tc.primary};">${businessNameHtml}</div>
                        <div style="font-size:10px;color:#6b7280;line-height:1.6;white-space:pre-line;">${businessDetailsHtml}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;text-transform:uppercase;margin-bottom:10px;color:${tc.primary};">INVOICE</div>
                        <div style="font-size:10px;color:#6b7280;line-height:1.8;">
                            <strong style="color:#374151;font-weight:600;">Invoice #:</strong> ${invoiceNum}<br>
                            <strong style="color:#374151;font-weight:600;">Date:</strong> ${invoiceDateFormatted}<br>
                            <strong style="color:#374151;font-weight:600;">Due Date:</strong> ${dueDateFormatted}
                        </div>
                    </div>
                </div>

                <div style="height:3px;margin:0 32px;background:${tc.gradient};"></div>

                <div style="display:flex;justify-content:space-between;padding:24px 32px;gap:24px;">
                    <div style="flex:1;">
                        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;color:${tc.primary};opacity:0.8;">From</div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:4px;color:#1a1a2e;">${businessNameHtml}</div>
                        <div style="font-size:10px;color:#6b7280;line-height:1.6;white-space:pre-line;">${businessDetailsHtml}</div>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;color:${tc.primary};opacity:0.8;">Bill To</div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:4px;color:#1a1a2e;">${clientNameHtml}</div>
                        <div style="font-size:10px;color:#6b7280;line-height:1.6;white-space:pre-line;">${clientDetailsHtml}</div>
                    </div>
                </div>

                <div style="padding:0 32px 24px;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="padding:10px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;text-align:left;background:${tc.primary};">Description</th>
                                <th style="padding:10px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;text-align:right;background:${tc.primary};">Qty</th>
                                <th style="padding:10px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;text-align:right;background:${tc.primary};">Rate</th>
                                <th style="padding:10px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:white;text-align:right;background:${tc.primary};">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>

                <div style="display:flex;justify-content:flex-end;padding:0 32px 28px;">
                    <div style="width:220px;">
                        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:10.5px;color:#6b7280;">
                            <span>Subtotal</span>
                            <span style="font-weight:700;">${state.currency}${formatNumber(subtotal)}</span>
                        </div>
                        ${taxRowHtml}
                        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:800;color:#1a1a2e;border-top:2px solid #e5e7eb;margin-top:6px;padding-top:10px;">
                            <span>Total</span>
                            <span style="color:${tc.primary};">${state.currency}${formatNumber(total)}</span>
                        </div>
                    </div>
                </div>

                ${footerHtml}

                <div style="text-align:center;padding:10px 32px 14px;font-size:8.5px;color:#c0c0d0;letter-spacing:0.03em;">Created with InvoiceForge — Free Professional Invoice Generator</div>
            </div>
        `;
    }

    // ===== PDF GENERATION (pdfmake) =====
    async function downloadPdf() {
        if (!window.pdfMake) {
            showToast('PDF library is still loading. Please try again in a moment.', 'error');
            return;
        }

        dom.loadingOverlay.classList.add('active');

        try {
            const invoiceNum = state.invoiceNumber || 'INV-001';
            const filename = `${invoiceNum.replace(/[^a-zA-Z0-9-_]/g, '_')}_invoice.pdf`;

            const themeColors = {
                blue: '#2563eb',
                dark: '#1f2937',
                green: '#059669'
            };
            const tc = themeColors[state.theme] || themeColors.blue;

            const subtotal = calcSubtotal();
            const tax = calcTax(subtotal);
            const total = calcTotal(subtotal, tax);

            const itemsBody = [
                // Header row
                [
                    { text: 'DESCRIPTION', style: 'tableHeader', alignment: 'left' },
                    { text: 'QTY', style: 'tableHeader', alignment: 'right' },
                    { text: 'RATE', style: 'tableHeader', alignment: 'right' },
                    { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
                ]
            ];

            state.items.forEach(item => {
                const amt = item.quantity * item.rate;
                itemsBody.push([
                    { text: item.description || 'Item description', style: 'tableCell' },
                    { text: item.quantity.toString(), style: 'tableCell', alignment: 'right' },
                    { text: `${state.currency}${formatNumber(item.rate)}`, style: 'tableCell', alignment: 'right' },
                    { text: `${state.currency}${formatNumber(amt)}`, style: 'tableCell', alignment: 'right', bold: true }
                ]);
            });

            // If we have logo, it needs to be processed. pdfMake accepts DataURL format.
            const logoElement = state.logoData ? { image: state.logoData, width: 120, margin: [0, 0, 0, 10] } : null;

            const businessDetailsLines = [];
            if (state.businessAddress) businessDetailsLines.push(state.businessAddress);
            if (state.businessEmail) businessDetailsLines.push(state.businessEmail);
            if (state.businessPhone) businessDetailsLines.push(state.businessPhone);
            const businessDetailsText = businessDetailsLines.join('\n') || '123 Main Street\nyou@email.com';

            const clientDetailsLines = [];
            if (state.clientAddress) clientDetailsLines.push(state.clientAddress);
            if (state.clientEmail) clientDetailsLines.push(state.clientEmail);
            const clientDetailsText = clientDetailsLines.join('\n') || 'Client address';

            const invoiceDateFormatted = state.invoiceDate ? formatDateDisplay(state.invoiceDate) : formatDateDisplay(formatDateInput(new Date()));
            const dueDateFormatted = state.dueDate ? formatDateDisplay(state.dueDate) : '—';

            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [ 40, 40, 40, 40 ],
                content: [
                    // Top Header Section
                    {
                        columns: [
                            // Left side: Logo and Business details
                            {
                                width: '*',
                                stack: [
                                    ...(logoElement ? [logoElement] : []),
                                    { text: state.businessName || 'Your Business Name', style: 'businessName', color: tc },
                                    { text: businessDetailsText, style: 'meta' }
                                ]
                            },
                            // Right side: Invoice title and Meta
                            {
                                width: 200,
                                stack: [
                                    { text: 'INVOICE', style: 'title', color: tc, alignment: 'right' },
                                    {
                                        table: {
                                            widths: ['*', '*'],
                                            body: [
                                                [
                                                    { text: 'Invoice #:', style: 'metaBold', alignment: 'right', border: [false, false, false, false] },
                                                    { text: invoiceNum, style: 'meta', alignment: 'right', border: [false, false, false, false] }
                                                ],
                                                [
                                                    { text: 'Date:', style: 'metaBold', alignment: 'right', border: [false, false, false, false] },
                                                    { text: invoiceDateFormatted, style: 'meta', alignment: 'right', border: [false, false, false, false] }
                                                ],
                                                [
                                                    { text: 'Due Date:', style: 'metaBold', alignment: 'right', border: [false, false, false, false] },
                                                    { text: dueDateFormatted, style: 'meta', alignment: 'right', border: [false, false, false, false] }
                                                ]
                                            ]
                                        },
                                        layout: 'noBorders'
                                    }
                                ]
                            }
                        ]
                    },
                    
                    // Colored Line
                    {
                        canvas: [ { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: tc } ],
                        margin: [0, 20, 0, 20]
                    },

                    // Parties Section
                    {
                        columns: [
                            {
                                width: '*',
                                stack: [
                                    { text: 'FROM', style: 'sectionHeader', color: tc },
                                    { text: state.businessName || 'Your Business Name', style: 'partyName' },
                                    { text: businessDetailsText, style: 'meta' }
                                ]
                            },
                            {
                                width: '*',
                                stack: [
                                    { text: 'BILL TO', style: 'sectionHeader', color: tc },
                                    { text: state.clientName || 'Client Name', style: 'partyName' },
                                    { text: clientDetailsText, style: 'meta' }
                                ]
                            }
                        ],
                        margin: [0, 0, 0, 30]
                    },

                    // Items Table
                    {
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto', 'auto', 'auto'],
                            body: itemsBody
                        },
                        layout: {
                            hLineWidth: function (i, node) {
                                return (i === 0 || i === node.table.body.length) ? 0 : 1;
                            },
                            vLineWidth: function (i, node) {
                                return 0;
                            },
                            hLineColor: function (i, node) {
                                return '#f0f0f5';
                            },
                            fillColor: function (i, node) {
                                return (i === 0) ? tc : null;
                            }
                        },
                        margin: [0, 0, 0, 30]
                    },

                    // Totals
                    {
                        columns: [
                            { width: '*', text: '' },
                            {
                                width: 220,
                                table: {
                                    widths: ['*', '*'],
                                    body: [
                                        [
                                            { text: 'Subtotal', style: 'meta', border: [false, false, false, false] },
                                            { text: `${state.currency}${formatNumber(subtotal)}`, style: 'metaBold', alignment: 'right', border: [false, false, false, false] }
                                        ],
                                        ...(state.taxRate > 0 ? [[
                                            { text: `Tax (${state.taxRate}%)`, style: 'meta', border: [false, false, false, false] },
                                            { text: `${state.currency}${formatNumber(tax)}`, style: 'metaBold', alignment: 'right', border: [false, false, false, false] }
                                        ]] : []),
                                        [
                                            { text: 'Total', style: 'totalLabel', border: [false, true, false, false] },
                                            { text: `${state.currency}${formatNumber(total)}`, style: 'totalValue', color: tc, alignment: 'right', border: [false, true, false, false] }
                                        ]
                                    ]
                                },
                                layout: {
                                    hLineWidth: function (i, node) { return (i === node.table.body.length - 1) ? 2 : 0; },
                                    hLineColor: function (i, node) { return '#e5e7eb'; },
                                    vLineWidth: function (i, node) { return 0; }
                                }
                            }
                        ],
                        margin: [0, 0, 0, 40]
                    },

                    // Footer Notes
                    ...(state.notes ? [
                        { text: 'NOTES', style: 'sectionHeader', color: '#9ca3af' },
                        { text: state.notes, style: 'meta', margin: [0, 0, 0, 15] }
                    ] : []),
                    ...(state.terms ? [
                        { text: 'TERMS & CONDITIONS', style: 'sectionHeader', color: '#9ca3af' },
                        { text: state.terms, style: 'meta', margin: [0, 0, 0, 30] }
                    ] : []),

                    // Watermark
                    { text: 'Created with InvoiceForge — Free Professional Invoice Generator', style: 'watermark', alignment: 'center' }
                ],
                styles: {
                    title: { fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
                    businessName: { fontSize: 14, bold: true, margin: [0, 0, 0, 5] },
                    meta: { fontSize: 10, color: '#6b7280', lineHeight: 1.4 },
                    metaBold: { fontSize: 10, color: '#374151', bold: true, lineHeight: 1.4 },
                    sectionHeader: { fontSize: 9, bold: true, margin: [0, 0, 0, 5], characterSpacing: 1 },
                    partyName: { fontSize: 11, bold: true, color: '#1a1a2e', margin: [0, 0, 0, 3] },
                    tableHeader: { fontSize: 9, bold: true, color: '#ffffff', margin: [5, 8, 5, 8], characterSpacing: 1 },
                    tableCell: { fontSize: 10, margin: [5, 8, 5, 8], color: '#374151' },
                    totalLabel: { fontSize: 12, bold: true, margin: [0, 10, 0, 0], color: '#1a1a2e' },
                    totalValue: { fontSize: 14, bold: true, margin: [0, 10, 0, 0] },
                    watermark: { fontSize: 8, color: '#c0c0d0', margin: [0, 20, 0, 0] }
                },
                defaultStyle: {
                    font: 'Roboto'
                }
            };

            pdfMake.createPdf(docDefinition).download(filename);
            showToast('Invoice PDF downloaded successfully!', 'success');

        } catch (err) {
            console.error('PDF generation error:', err);
            showToast('Error generating PDF. Please try again.', 'error');
        } finally {
            dom.loadingOverlay.classList.remove('active');
        }
    }

    // ===== PRINT INVOICE =====
    function printInvoice() {
        const printArea = document.getElementById('invoicePrintArea');
        printArea.innerHTML = buildInvoiceStandaloneHTML();
        
        // Add printing class to body to hide everything else
        document.body.classList.add('is-printing');
        
        // Small delay to ensure DOM is ready and styles are applied
        setTimeout(() => {
            window.print();
            // Clean up after print dialog is closed
            document.body.classList.remove('is-printing');
            printArea.innerHTML = '';
        }, 300);
    }

    // ===== LOCAL STORAGE =====
    function saveData() {
        try {
            const data = { ...state };
            localStorage.setItem('invoiceforge_data', JSON.stringify(data));
            showToast('Invoice data saved successfully!', 'success');
        } catch (err) {
            showToast('Failed to save data', 'error');
        }
    }

    function loadData() {
        try {
            const raw = localStorage.getItem('invoiceforge_data');
            if (!raw) {
                showToast('No saved data found', 'error');
                return;
            }

            const data = JSON.parse(raw);
            Object.assign(state, data);
            populateFormFromState();
            renderLineItems();
            updatePreview();
            showToast('Saved data loaded successfully!', 'success');
        } catch (err) {
            showToast('Failed to load data', 'error');
        }
    }

    function autoLoadSaved() {
        try {
            const raw = localStorage.getItem('invoiceforge_data');
            if (raw) {
                const data = JSON.parse(raw);
                Object.assign(state, data);
                populateFormFromState();
                renderLineItems();
                updatePreview();
            }
        } catch (err) {
            // Silently fail on auto-load
        }
    }

    function clearData() {
        if (!confirm('Are you sure you want to clear all invoice data?')) return;

        localStorage.removeItem('invoiceforge_data');

        // Reset state
        state.theme = 'blue';
        state.currency = '$';
        state.businessName = '';
        state.businessAddress = '';
        state.businessEmail = '';
        state.businessPhone = '';
        state.logoData = null;
        state.clientName = '';
        state.clientAddress = '';
        state.clientEmail = '';
        state.invoiceNumber = '';
        state.invoiceDate = '';
        state.dueDate = '';
        state.taxRate = 0;
        state.items = [{ description: '', quantity: 1, rate: 0 }];
        state.notes = '';
        state.terms = '';

        // Reset form
        dom.logoUpload.classList.remove('has-logo');
        dom.logoPreviewImg.src = '';
        dom.logoInput.value = '';

        $$('.theme-option').forEach(o => o.classList.remove('active'));
        $$('.theme-option')[0].classList.add('active');

        setDefaultDates();
        populateFormFromState();
        renderLineItems();
        updatePreview();
        showToast('All data cleared', 'success');
    }

    function populateFormFromState() {
        dom.businessName.value = state.businessName;
        dom.businessAddress.value = state.businessAddress;
        dom.businessEmail.value = state.businessEmail;
        dom.businessPhone.value = state.businessPhone;
        dom.clientName.value = state.clientName;
        dom.clientAddress.value = state.clientAddress;
        dom.clientEmail.value = state.clientEmail;
        dom.invoiceNumber.value = state.invoiceNumber;
        dom.invoiceDate.value = state.invoiceDate;
        dom.dueDate.value = state.dueDate;
        dom.taxRate.value = state.taxRate || '';
        dom.currency.value = state.currency;
        dom.notes.value = state.notes;
        dom.terms.value = state.terms;

        // Theme
        $$('.theme-option').forEach(o => {
            o.classList.toggle('active', o.dataset.theme === state.theme);
        });

        // Logo
        if (state.logoData) {
            dom.logoPreviewImg.src = state.logoData;
            dom.logoUpload.classList.add('has-logo');
        } else {
            dom.logoUpload.classList.remove('has-logo');
            dom.logoPreviewImg.src = '';
        }
    }

    // ===== TOAST =====
    let toastTimer = null;
    function showToast(message, type = 'success') {
        clearTimeout(toastTimer);
        dom.toast.textContent = message;
        dom.toast.className = `toast ${type}`;

        // Force reflow
        void dom.toast.offsetHeight;
        dom.toast.classList.add('show');

        toastTimer = setTimeout(() => {
            dom.toast.classList.remove('show');
        }, 3000);
    }

    // ===== UTILITIES =====
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatNumber(num) {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '—';
        try {
            const parts = dateStr.split('-');
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    // ===== SMOOTH SCROLL for anchor links =====
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    // ===== INTERSECTION OBSERVER for animations =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Animate feature cards on scroll
    document.addEventListener('DOMContentLoaded', () => {
        $$('.feature-card').forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `all 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.1}s`;
            observer.observe(card);
        });

        $$('.form-card').forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s, border-color 0.25s ease`;
            observer.observe(card);
        });
    });

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
