import React, { useState, useEffect } from 'react';
import { InventoryItem, CartItem, Transaction } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useRefresh } from '../src/context/RefreshContext';
import { tauriInvoke } from '../services/tauriService';

interface POSModeProps {
    defaultTab?: 'NAKIT' | 'VERESIYE' | 'MAIL_ORDER' | 'IADE';
    hideTabs?: boolean;
    returnType?: 'CASH' | 'CREDIT'; // Specific type for IADE
}

const POSMode: React.FC<POSModeProps> = ({ defaultTab = 'NAKIT', hideTabs = false, returnType }) => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [stockWarning, setStockWarning] = useState<string | null>(null);

    // Tabs: 'NAKIT' | 'VERESIYE' | 'MAIL_ORDER' | 'IADE'
    const [activeTab, setActiveTab] = useState<'NAKIT' | 'VERESIYE' | 'MAIL_ORDER' | 'IADE'>(defaultTab);

    // Update active tab when prop changes
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    // Payment States
    const [paymentMethod, setPaymentMethod] = useState<string>('Nakit'); // Default sub-method for Nakit tab
    const [selectedCardType, setSelectedCardType] = useState('Bonus');
    const [selectedBank, setSelectedBank] = useState('Garanti');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [currentAccounts, setCurrentAccounts] = useState<any[]>([]); // Customers

    // Discount
    const [discountAmount, setDiscountAmount] = useState<number>(0);

    const [note, setNote] = useState<string>('');
    const [mailOrderAmount, setMailOrderAmount] = useState<string>(''); // For Mail Order tahsilat
    const { triggerRefresh, lastUpdated } = useRefresh();

    // Return reason state
    const [returnReason, setReturnReason] = useState<string>('');
    const [showReturnReasonModal, setShowReturnReasonModal] = useState(false);

    const RETURN_REASONS = [
        'Hasarlı ürün',
        'Yanlış ürün',
        'Müşteri vazgeçti',
        'Bozuk/Arızalı',
        'Son kullanma tarihi geçmiş',
        'Diğer'
    ];

    // Print Preview State (for "print first, confirm after" flow)
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [printData, setPrintData] = useState<{
        cart: CartItem[];
        customer: any;
        total: number;
        rawTotal: number;
        discount: number;
        date: string;
        docNo: string;
    } | null>(null);

    useEffect(() => {
        loadItems();
        loadTransactions();
        loadCustomers();
    }, [lastUpdated]);

    const loadItems = async () => {
        const data = await inventoryService.getAllItems();
        setItems(data);
    };

    const loadTransactions = async () => {
        const data = await inventoryService.getTransactions();
        const salesOnly = data.filter(t => t.transactionType === 'SALE');
        setTransactions(salesOnly);
    };

    const loadCustomers = async () => {
        try {
            const accounts = await tauriInvoke<any[]>('get_current_accounts');
            // Filter only customers or both
            setCurrentAccounts(accounts.filter(a => a.accountType === 'CUSTOMER' || a.accountType === 'BOTH'));
        } catch (e) {
            console.error('Failed to load customers', e);
        }
    };

    const addToCart = (item: InventoryItem) => {
        // İade modunda stok kontrolü yok
        if (activeTab === 'IADE') {
            setCart(prevCart => {
                const existing = prevCart.find(i => i.id === item.id);
                if (existing) {
                    return prevCart.map(i =>
                        i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
                    );
                }
                return [...prevCart, { ...item, cartId: Math.random().toString(36), cartQuantity: 1 }];
            });
            return;
        }

        // Stok kontrolü
        if (item.quantity <= 0) {
            setStockWarning(`${item.name} - Stokta ürün yok!`);
            setTimeout(() => setStockWarning(null), 3000);
            return;
        }

        setCart(prevCart => {
            const existing = prevCart.find(i => i.id === item.id);
            if (existing) {
                if (existing.cartQuantity >= item.quantity) {
                    setStockWarning(`${item.name} - Stok yetersiz! (Mevcut: ${item.quantity} adet)`);
                    setTimeout(() => setStockWarning(null), 3000);
                    return prevCart;
                }
                // Stok azaldığında sarı uyarı
                if (existing.cartQuantity + 1 >= item.quantity) {
                    setStockWarning(`${item.name} - Son ${item.quantity - existing.cartQuantity} adet!`);
                    setTimeout(() => setStockWarning(null), 3000);
                }
                return prevCart.map(i =>
                    i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
                );
            }
            // İlk ekleme
            if (item.quantity <= 3) {
                setStockWarning(`${item.name} - Düşük stok uyarısı! (Mevcut: ${item.quantity} adet)`);
                setTimeout(() => setStockWarning(null), 3000);
            }
            return [...prevCart, { ...item, cartId: Math.random().toString(36), cartQuantity: 1 }];
        });
    };

    const updateQuantity = (cartId: string, delta: number) => {
        setCart(prevCart => {
            return prevCart.map(cartItem => {
                if (cartItem.cartId === cartId) {
                    const newQty = cartItem.cartQuantity + delta;
                    if (activeTab !== 'IADE' && delta > 0) {
                        const originalItem = items.find(i => i.id === cartItem.id);
                        if (originalItem && newQty > originalItem.quantity) {
                            return cartItem;
                        }
                    }
                    return newQty > 0 ? { ...cartItem, cartQuantity: newQty } : null;
                }
                return cartItem;
            }).filter(Boolean) as CartItem[];
        });
    };

    const removeFromCart = (cartId: string) => {
        setCart(cart.filter(i => i.cartId !== cartId));
    };

    const selectTransactionForReturn = (tx: Transaction) => {
        const newCartItems: CartItem[] = tx.items.map(item => ({
            ...item,
            cartId: Math.random().toString(36),
            cartQuantity: item.cartQuantity || 1
        }));
        setCart(newCartItems);
        setNote(`İade - İşlem #${tx.id.slice(0, 8)}`);
    };

    // Calculate Totals & Discount Logic
    const rawTotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);

    // Discount Handler
    const handleDiscountChange = (val: string) => {
        const amount = parseFloat(val) || 0;
        const maxDiscount = rawTotal * 0.05; // Max 5%
        if (amount > maxDiscount) {
            setDiscountAmount(maxDiscount);
        } else {
            setDiscountAmount(amount);
        }
    };

    const finalTotal = Math.max(0, rawTotal - discountAmount);

    // Show print preview first for VERESIYE
    const handlePrintPreview = () => {
        if (cart.length === 0) return;

        if (activeTab === 'VERESIYE' && !selectedCustomer) {
            alert('Lütfen bir müşteri (Cari) seçin!');
            return;
        }

        const customer = currentAccounts.find(c => c.id === selectedCustomer);
        setPrintData({
            cart: [...cart],
            customer,
            total: finalTotal,
            rawTotal,
            discount: discountAmount,
            date: new Date().toLocaleString('tr-TR'),
            docNo: Date.now().toString(36).toUpperCase()
        });
        setShowPrintPreview(true);
    };

    // Actually process the sale after print confirmation
    const handleConfirmSale = async () => {
        setShowPrintPreview(false);
        await handleCheckout();
    };

    const handleCheckout = async () => {
        // MAIL_ORDER doesn't need cart - uses amount input
        if (activeTab !== 'MAIL_ORDER' && cart.length === 0) return;

        if ((activeTab === 'VERESIYE' || activeTab === 'MAIL_ORDER') && !selectedCustomer) {
            alert('Lütfen bir müşteri (Cari) seçin!');
            return;
        }

        // Require return reason for IADE
        if (activeTab === 'IADE' && !returnReason) {
            setShowReturnReasonModal(true);
            return;
        }

        setIsCheckingOut(true);

        // Prepare detailed payment string
        let methodStr = paymentMethod;
        if (activeTab === 'NAKIT') {
            if (paymentMethod === 'Kredi Kartı') {
                methodStr = `Kredi Kartı (${selectedBank})`;
            }
            if (paymentMethod === 'Havale') methodStr = `Havale (${selectedBank})`;
        } else if (activeTab === 'VERESIYE') {
            methodStr = 'VERESIYE';
        } else if (activeTab === 'MAIL_ORDER') {
            methodStr = 'MAIL_ORDER';
        }

        // Append Customer info to note if Veresiye or manually selected
        let finalNote = note;
        if (activeTab === 'VERESIYE' && selectedCustomer) {
            const cust = currentAccounts.find(c => c.id === selectedCustomer);
            if (cust) finalNote = `Cari: ${cust.name} - ${finalNote}`;
        }

        // Add return reason to note for IADE
        if (activeTab === 'IADE' && returnReason) {
            finalNote = `İade Nedeni: ${returnReason} - ${finalNote}`;
        }

        // Strategy: Add a dummy discount item to the cart sent to backend.
        let finalCart = [...cart];
        if (discountAmount > 0) {
            finalCart.push({
                id: 'discount',
                sku: 'IND',
                name: 'İndirim',
                category: 'Genel',
                price: -discountAmount, // Negative price
                quantity: 1,
                location: '',
                lastUpdated: '',
                // CartItem props
                cartId: 'discount-item',
                cartQuantity: 1
            } as any);
        }

        try {
            // Determine customerId (For Veresiye, Mail Order OR Credit Return)
            const isCreditTransaction = activeTab === 'VERESIYE' || activeTab === 'MAIL_ORDER' || (activeTab === 'IADE' && returnType === 'CREDIT');
            const customerId = (isCreditTransaction && selectedCustomer) ? selectedCustomer : undefined;

            // MAIL_ORDER: Process as collection (tahsilat) to reduce customer debt
            if (activeTab === 'MAIL_ORDER') {
                const amount = parseFloat(mailOrderAmount);
                if (!amount || amount <= 0) {
                    alert('Lütfen geçerli bir tahsilat tutarı girin!');
                    setIsCheckingOut(false);
                    return;
                }

                const cust = currentAccounts.find(c => c.id === selectedCustomer);
                const paymentItem = {
                    id: 'MAIL_ORDER_COLLECTION',
                    sku: 'TAHSILAT',
                    name: `Mail Order Tahsilat - ${cust?.name || ''}`,
                    category: 'FINANCE',
                    quantity: 1,
                    location: '',
                    price: -amount, // Negative to reduce balance
                    cartId: 'MAIL_ORDER',
                    cartQuantity: 1,
                    lastUpdated: new Date().toISOString()
                };

                await tauriInvoke('process_sale', {
                    cartItems: [paymentItem],
                    paymentMethod: 'MAIL_ORDER',
                    transactionType: 'COLLECTION',
                    note: `Mail Order Tahsilat: ₺${amount.toFixed(2)}`,
                    customerId: selectedCustomer
                });

                setMailOrderAmount('');
                setSelectedCustomer('');
                setSuccessMsg('TAHSİLAT BAŞARILI');
                loadCustomers(); // Refresh balances
                triggerRefresh();
                setTimeout(() => setSuccessMsg(''), 2500);
            } else {
                // Regular sale/return flow
                await inventoryService.processSale(finalCart, methodStr, activeTab === 'IADE' ? 'RETURN' : 'SALE', finalNote, customerId);

                // Reset print data if it exists
                setPrintData(null);

                setCart([]);
                setDiscountAmount(0);
                setNote('');
                setReturnReason(''); // Reset return reason
                setSuccessMsg(`${activeTab === 'IADE' ? 'İADE' : 'SATIŞ'} BAŞARILI`);
                loadItems();
                loadTransactions();
                triggerRefresh();
                setTimeout(() => setSuccessMsg(''), 2500);
            }
        } catch (e) {
            console.error(e);
            alert('İşlem sırasında hata oluştu.');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row bg-gray-50 dark:bg-black text-gray-900 dark:text-white font-sans">
            {/* Professional Delivery Receipt for VERESIYE */}
            <div id="printable-invoice" className="hidden print:block fixed inset-0 bg-white text-black z-[9999] overflow-auto">
                <div className="p-8 max-w-[210mm] mx-auto">
                    {/* Header */}
                    <div className="text-center border-b-4 border-black pb-4 mb-6">
                        <h1 className="text-3xl font-black tracking-tight">MAL TESLİM TUTANAĞI</h1>
                        <p className="text-sm font-bold text-gray-600 mt-1">
                            {activeTab === 'IADE' ? 'İADE BELGESİ' : 'VERESİYE SATIŞ BELGESİ'}
                        </p>
                    </div>

                    {/* Document Info Row */}
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-300">
                        <div className="space-y-1">
                            <p className="text-sm"><strong>Belge No:</strong> #{Date.now().toString(36).toUpperCase()}</p>
                            <p className="text-sm"><strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                            <p className="text-sm"><strong>Saat:</strong> {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-xl">NEXUS</p>
                            <p className="text-xs text-gray-500">Envanter Yönetim Sistemi</p>
                        </div>
                    </div>

                    {/* Customer Info Box */}
                    {((activeTab === 'VERESIYE' || (activeTab === 'IADE' && returnType === 'CREDIT')) && selectedCustomer) && (
                        <div className="border-2 border-black p-4 mb-6 bg-gray-50">
                            <h3 className="font-bold text-sm uppercase tracking-wider border-b border-gray-400 pb-2 mb-3">MÜŞTERİ BİLGİLERİ</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Ad Soyad</p>
                                    <p className="font-bold text-lg">{currentAccounts.find(c => c.id === selectedCustomer)?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Telefon</p>
                                    <p className="font-semibold">{currentAccounts.find(c => c.id === selectedCustomer)?.phone || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500 uppercase">Adres</p>
                                    <p className="font-semibold">{currentAccounts.find(c => c.id === selectedCustomer)?.address || '-'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Products Table */}
                    <table className="w-full border-collapse mb-6">
                        <thead>
                            <tr className="bg-black text-white">
                                <th className="text-left py-3 px-4 font-bold">Ürün Adı</th>
                                <th className="text-center py-3 px-2 font-bold w-20">Miktar</th>
                                <th className="text-right py-3 px-4 font-bold w-28">Birim Fiyat</th>
                                <th className="text-right py-3 px-4 font-bold w-28">Toplam</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.filter(item => item.id !== 'discount').map((item, i) => (
                                <tr key={i} className={`border-b border-gray-300 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    <td className="py-3 px-4 font-medium">{item.name}</td>
                                    <td className="py-3 px-2 text-center font-mono">{item.cartQuantity}</td>
                                    <td className="py-3 px-4 text-right font-mono">₺{item.price.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold">₺{(item.price * item.cartQuantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100">
                                <td colSpan={3} className="py-3 px-4 text-right font-semibold">Ara Toplam:</td>
                                <td className="py-3 px-4 text-right font-mono">₺{rawTotal.toFixed(2)}</td>
                            </tr>
                            {discountAmount > 0 && (
                                <tr className="bg-gray-100">
                                    <td colSpan={3} className="py-2 px-4 text-right font-semibold text-red-600">İndirim:</td>
                                    <td className="py-2 px-4 text-right font-mono text-red-600">-₺{discountAmount.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="bg-black text-white">
                                <td colSpan={3} className="py-4 px-4 text-right font-black text-lg uppercase">Genel Toplam:</td>
                                <td className="py-4 px-4 text-right font-mono font-black text-xl">₺{finalTotal.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Signature Section */}
                    <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t-2 border-black">
                        <div className="text-center">
                            <p className="font-bold text-sm uppercase tracking-wider mb-2">TESLİM ALAN</p>
                            <p className="text-lg font-semibold mb-8">{currentAccounts.find(c => c.id === selectedCustomer)?.name || '____________________'}</p>
                            <div className="border-b-2 border-black h-16 mx-8"></div>
                            <p className="text-xs text-gray-500 mt-2 uppercase">İmza</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-sm uppercase tracking-wider mb-2">TESLİM EDEN</p>
                            <p className="text-lg font-semibold mb-8">Yetkili Personel</p>
                            <div className="border-b-2 border-black h-16 mx-8"></div>
                            <p className="text-xs text-gray-500 mt-2 uppercase">İmza</p>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-12 pt-6 border-t border-gray-300 text-center">
                        <p className="text-xs text-gray-600 mb-1">
                            Bu belge, yukarıda belirtilen ürünlerin eksiksiz olarak teslim edildiğini belgeler.
                        </p>
                        {currentAccounts.find(c => c.id === selectedCustomer)?.paymentTerm > 0 && (
                            <p className="text-xs font-bold text-gray-800">
                                Ödeme Vadesi: {currentAccounts.find(c => c.id === selectedCustomer)?.paymentTerm} gün
                            </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-4">
                            Belge Oluşturma: {new Date().toLocaleString('tr-TR')} | NEXUS Envanter Sistemi
                        </p>
                    </div>
                </div>
            </div>

            {/* Left Side: Product Grid */}
            <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden order-2 md:order-1 print:hidden">
                {/* Search Bar matching original aesthetic */}
                <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="BARKOD TARA VEYA ÜRÜN ARA..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const query = search.trim();
                                if (!query) return;

                                // Find exact match first
                                const exactMatch = items.find(i => i.sku === query || i.id === query);

                                if (exactMatch) {
                                    addToCart(exactMatch);
                                    setSearch(''); // Clear after auto-add
                                    return;
                                }

                                // If no exact match, check if there is only one result
                                const results = items.filter(i =>
                                    i.name.toLowerCase().includes(query.toLowerCase()) ||
                                    i.sku.includes(query)
                                );

                                if (results.length === 1) {
                                    addToCart(results[0]);
                                    setSearch('');
                                }
                            }
                        }}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-14 p-5 text-xl font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase shadow-sm"
                        autoFocus
                    />
                </div>

                {/* Stock Warning Toast */}
                {stockWarning && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2 animate-pulse">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {stockWarning}
                    </div>
                )}

                {/* Product Grid - Same for all tabs including IADE */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.includes(search)).map(item => (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className="text-left rounded-2xl border overflow-hidden flex flex-col justify-between transition-all min-h-[220px] shadow-sm hover:shadow-md bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-blue-500"
                            >
                                <div className="h-32 bg-gray-200 dark:bg-zinc-800 relative">
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="p-4 text-xs text-gray-400 text-center flex items-center justify-center h-full">IMG</div>}
                                    <div className="absolute top-2 right-2 bg-black text-white text-[10px] px-2 py-1 rounded-full font-bold">{item.quantity} ADET</div>
                                </div>
                                <div className="p-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">{item.category}</div>
                                    <div className="font-bold text-sm line-clamp-2 leading-tight mb-2">{item.name}</div>
                                    <div className="text-lg font-black">₺{item.price.toFixed(2)}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side: Cart & Checkout Panel */}
            <div className={`w-full md:w-[400px] bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 flex flex-col z-20 shadow-xl order-1 md:order-2 h-[60vh] md:h-auto print:hidden`}>

                {/* TABS HEADER */}
                {/* TABS HEADER - Only show if not hidden */}
                {!hideTabs && (
                    <div className="flex p-2 gap-2 bg-gray-100 dark:bg-black/20 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto">
                        {[
                            { id: 'NAKIT', label: 'Satış', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                            { id: 'VERESIYE', label: 'Veresiye', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                            { id: 'MAIL_ORDER', label: 'Mail Order', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                            { id: 'IADE', label: 'İade', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap
                                     ${activeTab === tab.id
                                        ? (tab.id === 'IADE' ? 'bg-red-500 text-white shadow-md' : 'bg-black dark:bg-white text-white dark:text-black shadow-md')
                                        : 'bg-white dark:bg-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Cart List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-black/40">
                    {cart.map(item => {
                        const originalItem = items.find(i => i.id === item.id);
                        const availableStock = originalItem?.quantity || 0;
                        const isAtMaxStock = activeTab !== 'IADE' && item.cartQuantity >= availableStock;
                        const isLowStock = activeTab !== 'IADE' && item.cartQuantity >= availableStock - 2 && item.cartQuantity < availableStock;

                        return (
                            <div key={item.cartId} className={`bg-white dark:bg-zinc-800 p-3 rounded-xl border flex gap-3 shadow-sm group ${isAtMaxStock ? 'border-red-300 dark:border-red-800' : isLowStock ? 'border-yellow-300 dark:border-yellow-800' : 'border-gray-200 dark:border-zinc-700'}`}>
                                <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-700 rounded-lg shrink-0 overflow-hidden">
                                    {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-sm truncate">{item.name}</div>
                                        {activeTab !== 'IADE' && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isAtMaxStock ? 'bg-red-100 text-red-600 dark:bg-red-900/50' : isLowStock ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50' : 'bg-gray-100 text-gray-500 dark:bg-zinc-700'}`}>
                                                Stok: {availableStock}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-black rounded-lg p-1">
                                            <button onClick={() => updateQuantity(item.cartId, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-800 rounded font-bold hover:bg-red-50">-</button>
                                            <span className={`w-6 text-center font-mono font-bold text-sm ${isAtMaxStock ? 'text-red-500' : ''}`}>{item.cartQuantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.cartId, 1)}
                                                className={`w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-800 rounded font-bold ${isAtMaxStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50'}`}
                                                disabled={isAtMaxStock}
                                            >+</button>
                                        </div>
                                        <div className="font-bold font-mono">₺{(item.price * item.cartQuantity).toFixed(2)}</div>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.cartId)} className="text-gray-300 hover:text-red-500 self-start p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        );
                    })}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            <span className="text-sm font-bold uppercase">Sepet Boş</span>
                        </div>
                    )}
                </div>

                {/* PAYMENT SECTION */}
                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 space-y-4">

                    {/* Discount Input */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold uppercase text-gray-500">
                            <span>Ara Toplam</span>
                            <span>₺{rawTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase">İndirim (TL)</span>
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    min="0"
                                    max={rawTotal * 0.05}
                                    value={discountAmount || ''}
                                    onChange={(e) => handleDiscountChange(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-right font-mono font-bold text-sm focus:ring-2 ring-black dark:ring-white"
                                    placeholder="0.00"
                                />
                                {discountAmount > 0 && discountAmount === (rawTotal * 0.05) && (
                                    <span className="absolute left-0 top-full text-[10px] text-red-500 font-bold mt-0.5">Maks. %5 indirim uygulandı</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-[1px] bg-gray-200 dark:bg-zinc-800"></div>

                    {/* Dynamic Payment Options based on Active Tab */}
                    <div>
                        {activeTab === 'NAKIT' && (
                            <div className="space-y-3">
                                {/* Helper toggles for Nakit Tab: Cash / Card / Havale */}
                                <div className="grid grid-cols-3 gap-2">
                                    {['Nakit', 'Kredi Kartı', 'Havale'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => { setSelectedCardType(''); setSelectedBank(''); setPaymentMethod(opt); }}
                                            className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${paymentMethod === opt ? 'bg-black dark:bg-white text-white dark:text-black border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500'}`}
                                        >{opt}</button>
                                    ))}
                                </div>

                                {paymentMethod === 'Kredi Kartı' && (
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Banka</label>
                                        <select
                                            value={selectedBank}
                                            onChange={e => setSelectedBank(e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 text-sm font-bold outline-none"
                                        >
                                            {['Yapı Kredi', 'Vakıfbank', 'Halkbank', 'Ziraat', 'Garanti', 'İş Bankası', 'Akbank', 'QNB Finansbank', 'Denizbank', 'TEB'].map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                )}

                                {paymentMethod === 'Havale' && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Banka Hesabı</label>
                                        <select
                                            value={selectedBank}
                                            onChange={e => setSelectedBank(e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 text-sm font-bold outline-none"
                                        >
                                            {['Garanti', 'Yapı Kredi', 'İş Bankası', 'Akbank', 'QNB Finansbank', 'Ziraat'].map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'VERESIYE' && (
                            <div>
                                <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Müşteri Seçimi (Cari) <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedCustomer}
                                    onChange={e => setSelectedCustomer(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 text-sm font-bold outline-none border border-gray-200 dark:border-zinc-700 focus:ring-2 ring-blue-500"
                                >
                                    <option value="">-- Müşteri Seçin --</option>
                                    {currentAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                {currentAccounts.length === 0 && <p className="text-[10px] text-red-500 mt-1">Kayıtlı cari bulunamadı.</p>}
                            </div>
                        )}

                        {/* Return: Customer Selection Only */}
                        {activeTab === 'IADE' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">İade Yapılan Müşteri (Cari)</label>
                                    <select
                                        value={selectedCustomer}
                                        onChange={e => setSelectedCustomer(e.target.value)}
                                        className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 text-sm font-bold outline-none border border-gray-200 dark:border-zinc-700 focus:ring-2 ring-blue-500"
                                    >
                                        <option value="">-- Müşteri Seçin (Opsiyonel) --</option>
                                        {currentAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} {acc.balance ? `(₺${acc.balance.toFixed(2)})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Return Reason Display */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">İade Nedeni <span className="text-red-500">*</span></label>
                                    <button
                                        onClick={() => setShowReturnReasonModal(true)}
                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm font-bold ${returnReason
                                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                                : 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400'
                                            }`}
                                    >
                                        {returnReason || '-- Neden Seçin --'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'MAIL_ORDER' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                                    <p className="text-xs font-bold text-gray-900 dark:text-white">MAIL ORDER TAHSİLAT</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Seçilen cariden tahsilat yaparak borcunu düşürün.</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Müşteri (Cari) <span className="text-red-500">*</span></label>
                                    <select
                                        value={selectedCustomer}
                                        onChange={e => setSelectedCustomer(e.target.value)}
                                        className="w-full bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 text-sm font-bold outline-none border border-gray-200 dark:border-zinc-700 focus:ring-2 ring-blue-500"
                                    >
                                        <option value="">-- Müşteri Seçin --</option>
                                        {currentAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} {acc.balance ? `(₺${acc.balance.toFixed(2)})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedCustomer && (
                                    <>
                                        <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                                            <p className="text-xs text-gray-500">Mevcut Borç:</p>
                                            <p className="text-xl font-black font-mono">
                                                ₺{(currentAccounts.find(a => a.id === selectedCustomer)?.balance || 0).toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Tahsilat Tutarı <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={mailOrderAmount}
                                                onChange={e => setMailOrderAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full text-2xl font-mono font-bold p-3 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 ring-blue-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center bg-gray-100 dark:bg-black/40 p-3 rounded-xl">
                        <span className="font-bold text-gray-500">{activeTab === 'IADE' ? 'İADE TOPLAMI' : 'TOPLAM'}</span>
                        <span className={`text-2xl font-black ${activeTab === 'IADE' ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {activeTab === 'IADE' ? '-' : ''}₺{finalTotal.toFixed(2)}
                        </span>
                    </div>

                    {successMsg ? (
                        <div className="bg-green-600 text-white p-4 rounded-xl text-center font-bold animate-bounce shadow-lg">
                            {successMsg}
                        </div>
                    ) : (
                        <button
                            onClick={activeTab === 'VERESIYE' ? handlePrintPreview : handleCheckout}
                            disabled={
                                isCheckingOut ||
                                (activeTab === 'MAIL_ORDER' ? (!selectedCustomer || !mailOrderAmount || parseFloat(mailOrderAmount) <= 0) : cart.length === 0)
                            }
                            className={`w-full py-4 rounded-xl font-black uppercase text-lg tracking-wide shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all
                                ${activeTab === 'IADE'
                                    ? 'bg-red-600 text-white hover:bg-red-500'
                                    : activeTab === 'MAIL_ORDER'
                                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                                        : 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200'}`}
                        >
                            {isCheckingOut ? 'İŞLENİYOR...' :
                                activeTab === 'IADE' ? 'İADE AL' :
                                    activeTab === 'VERESIYE' ? 'ÖNİZLE VE YAZDIR' :
                                        activeTab === 'MAIL_ORDER' ? 'TAHSİLAT YAP' : 'ÖDEME AL'}
                        </button>
                    )}
                </div>
            </div>

            {/* Print Preview Modal */}
            {showPrintPreview && printData && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-black">Teslim Belgesi Önizleme</h2>
                            <button onClick={() => setShowPrintPreview(false)} className="text-gray-500 hover:text-black">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Receipt Preview Content */}
                        <div className="p-8 text-black" id="receipt-preview">
                            {/* Header */}
                            <div className="text-center border-b-4 border-black pb-4 mb-6">
                                <h1 className="text-3xl font-black tracking-tight">MAL TESLİM TUTANAĞI</h1>
                                <p className="text-sm font-bold text-gray-600 mt-1">VERESİYE SATIŞ BELGESİ</p>
                            </div>

                            {/* Document Info */}
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-300">
                                <div className="space-y-1">
                                    <p className="text-sm"><strong>Belge No:</strong> #{printData.docNo}</p>
                                    <p className="text-sm"><strong>Tarih:</strong> {printData.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-xl">NEXUS</p>
                                    <p className="text-xs text-gray-500">Envanter Yönetim Sistemi</p>
                                </div>
                            </div>

                            {/* Customer Info */}
                            {printData.customer && (
                                <div className="border-2 border-black p-4 mb-6 bg-gray-50">
                                    <h3 className="font-bold text-sm uppercase tracking-wider border-b border-gray-400 pb-2 mb-3">MÜŞTERİ BİLGİLERİ</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Ad Soyad</p>
                                            <p className="font-bold text-lg">{printData.customer.name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Telefon</p>
                                            <p className="font-semibold">{printData.customer.phone || '-'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500 uppercase">Adres</p>
                                            <p className="font-semibold">{printData.customer.address || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Products Table */}
                            <table className="w-full border-collapse mb-6">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="text-left py-3 px-4 font-bold">Ürün Adı</th>
                                        <th className="text-center py-3 px-2 font-bold w-20">Miktar</th>
                                        <th className="text-right py-3 px-4 font-bold w-28">Birim Fiyat</th>
                                        <th className="text-right py-3 px-4 font-bold w-28">Toplam</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printData.cart.filter(item => item.id !== 'discount').map((item, i) => (
                                        <tr key={i} className={`border-b border-gray-300 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                            <td className="py-3 px-4 font-medium">{item.name}</td>
                                            <td className="py-3 px-2 text-center font-mono">{item.cartQuantity}</td>
                                            <td className="py-3 px-4 text-right font-mono">₺{item.price.toFixed(2)}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold">₺{(item.price * item.cartQuantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100">
                                        <td colSpan={3} className="py-3 px-4 text-right font-semibold">Ara Toplam:</td>
                                        <td className="py-3 px-4 text-right font-mono">₺{printData.rawTotal.toFixed(2)}</td>
                                    </tr>
                                    {printData.discount > 0 && (
                                        <tr className="bg-gray-100">
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-red-600">İndirim:</td>
                                            <td className="py-2 px-4 text-right font-mono text-red-600">-₺{printData.discount.toFixed(2)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-black text-white">
                                        <td colSpan={3} className="py-4 px-4 text-right font-black text-lg uppercase">Genel Toplam:</td>
                                        <td className="py-4 px-4 text-right font-mono font-black text-xl">₺{printData.total.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Signature Section */}
                            <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t-2 border-black">
                                <div className="text-center">
                                    <p className="font-bold text-sm uppercase tracking-wider mb-2">TESLİM ALAN</p>
                                    <p className="text-lg font-semibold mb-8">{printData.customer?.name || '____________________'}</p>
                                    <div className="border-b-2 border-black h-16 mx-8"></div>
                                    <p className="text-xs text-gray-500 mt-2 uppercase">İmza</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm uppercase tracking-wider mb-2">TESLİM EDEN</p>
                                    <p className="text-lg font-semibold mb-8">Yetkili Personel</p>
                                    <div className="border-b-2 border-black h-16 mx-8"></div>
                                    <p className="text-xs text-gray-500 mt-2 uppercase">İmza</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-4 border-t border-gray-300 text-center">
                                <p className="text-xs text-gray-600">Bu belge, yukarıda belirtilen ürünlerin eksiksiz olarak teslim edildiğini belgeler.</p>
                                {printData.customer?.paymentTerm > 0 && (
                                    <p className="text-xs font-bold text-gray-800 mt-1">Ödeme Vadesi: {printData.customer.paymentTerm} gün</p>
                                )}
                            </div>
                        </div>

                        {/* Modal Actions - Only YAZDIR inside */}
                        <div className="sticky bottom-0 bg-gray-100 border-t p-4">
                            <button
                                onClick={() => window.print()}
                                className="w-full py-4 rounded-xl bg-black text-white font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-lg"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                YAZDIR
                            </button>
                        </div>
                    </div>

                    {/* ONAYLA button outside modal */}
                    <button
                        onClick={handleConfirmSale}
                        disabled={isCheckingOut}
                        className="mt-4 w-full max-w-3xl py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50 shadow-2xl"
                    >
                        {isCheckingOut ? 'İŞLENİYOR...' : (
                            <>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                ONAYLA VE KAYDET
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Return Reason Modal */}
            {showReturnReasonModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                İade Nedeni Seçin
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Lütfen iade işlemi için bir neden seçin</p>
                        </div>

                        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                            {RETURN_REASONS.map(reason => (
                                <button
                                    key={reason}
                                    onClick={() => {
                                        setReturnReason(reason);
                                        setShowReturnReasonModal(false);
                                    }}
                                    className={`w-full px-4 py-3 rounded-xl border text-left font-medium transition-all ${returnReason === reason
                                        ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600 dark:text-red-400'
                                        : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 flex gap-2">
                            <button
                                onClick={() => setShowReturnReasonModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                            >
                                İptal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default POSMode;