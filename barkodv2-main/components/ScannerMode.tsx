import React, { useState, useEffect } from 'react';
import { InventoryItem, CartItem, Transaction } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useRefresh } from '../src/context/RefreshContext';

const POSMode: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // New States
    const [transactionType, setTransactionType] = useState<'SALE' | 'RETURN'>('SALE');
    const [paymentMethod, setPaymentMethod] = useState<string>('Nakit');
    const [note, setNote] = useState<string>('');

    const { triggerRefresh, lastUpdated } = useRefresh();

    useEffect(() => {
        loadItems();
        loadTransactions();
    }, [lastUpdated]);

    useEffect(() => {
        // Clear cart when switching modes
        setCart([]);
    }, [transactionType]);

    const loadItems = async () => {
        const data = await inventoryService.getAllItems();
        setItems(data);
    };

    const loadTransactions = async () => {
        const data = await inventoryService.getTransactions();
        // Only show SALE transactions for returns (not already returned ones)
        const salesOnly = data.filter(t => t.transactionType === 'SALE');
        setTransactions(salesOnly);
    };

    const addToCart = (item: InventoryItem) => {
        if (transactionType === 'SALE' && item.quantity <= 0) return;

        setCart(prevCart => {
            const existing = prevCart.find(i => i.id === item.id);
            if (existing) {
                if (transactionType === 'SALE' && existing.cartQuantity >= item.quantity) {
                    return prevCart;
                }
                return prevCart.map(i =>
                    i.id === item.id
                        ? { ...i, cartQuantity: i.cartQuantity + 1 }
                        : i
                );
            }
            return [...prevCart, { ...item, cartId: Math.random().toString(36), cartQuantity: 1 }];
        });
    };

    const selectTransactionForReturn = (tx: Transaction) => {
        // Add all items from this transaction to cart for return
        const newCartItems: CartItem[] = tx.items.map(item => ({
            ...item,
            cartId: Math.random().toString(36),
            cartQuantity: item.cartQuantity || 1
        }));
        setCart(newCartItems);
        setNote(`İade - İşlem #${tx.id.slice(0, 8)}`);
    };

    const updateQuantity = (cartId: string, delta: number) => {
        setCart(prevCart => {
            return prevCart.map(cartItem => {
                if (cartItem.cartId === cartId) {
                    const newQty = cartItem.cartQuantity + delta;

                    if (transactionType === 'SALE' && delta > 0) {
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

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsCheckingOut(true);

        try {
            await inventoryService.processSale(cart, paymentMethod, transactionType, note);

            setCart([]);
            setNote('');
            setSuccessMsg(transactionType === 'SALE' ? 'SATIŞ TAMAMLANDI' : 'İADE ALINDI');
            loadItems();
            loadTransactions();
            console.log('[ScannerMode] Sale completed, triggering refresh...');
            triggerRefresh();

            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsCheckingOut(false);
        }
    };

    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.sku.includes(search)
    );

    const filteredTransactions = transactions.filter(t =>
        t.id.includes(search) ||
        (t.note && t.note.toLowerCase().includes(search.toLowerCase()))
    );

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);

    return (
        <div className="h-full flex flex-col md:flex-row bg-gray-50 dark:bg-black text-gray-900 dark:text-white">

            {/* LEFT: Product Catalog or Transactions List */}
            <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden order-2 md:order-1">

                {/* Search Bar */}
                <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 17h.01M9.01 9h.01M19.01 9h.01M3 21h18M3 3h18M3 3v18M21 3v18" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder={transactionType === 'SALE' ? "BARKOD TARA VEYA ÜRÜN ARA..." : "İŞLEM ID VEYA NOT ARA..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-hub-panel border border-gray-200 dark:border-hub-border rounded-2xl pl-14 p-5 text-xl font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none placeholder-gray-400 dark:placeholder-hub-muted uppercase shadow-sm transition-all"
                        autoFocus
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-black dark:hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>

                {/* Content Area - Products or Transactions */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {transactionType === 'SALE' ? (
                        /* Product Grid for SALE mode */
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    disabled={item.quantity === 0}
                                    className={`text-left rounded-2xl border overflow-hidden flex flex-col justify-between transition-all active:scale-95 touch-target min-h-[240px] shadow-sm hover:shadow-md
                                        ${item.quantity === 0
                                            ? 'bg-gray-100 dark:bg-black border-gray-200 dark:border-hub-border opacity-50 cursor-not-allowed'
                                            : 'bg-white dark:bg-hub-panel border-gray-200 dark:border-hub-border hover:border-blue-500 dark:hover:border-white group'
                                        }`}
                                >
                                    <div className="h-36 w-full bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase">Resim Yok</div>
                                        )}
                                        <div className={`absolute top-2 right-2 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md shadow-sm ${item.quantity < 5 ? 'bg-red-500' : 'bg-black/70'}`}>
                                            {item.quantity} ADET
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${item.quantity === 0 ? 'text-red-500' : 'text-gray-500 dark:text-hub-muted'}`}>
                                                {item.quantity === 0 ? 'STOK TÜKENDİ' : item.category}
                                            </div>
                                            <div className="font-bold text-base leading-snug text-gray-900 dark:text-white line-clamp-2">{item.name}</div>
                                            <div className="text-[10px] font-mono text-gray-400 mt-1">{item.sku}</div>
                                        </div>
                                        <div className="mt-3 text-xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                                            {item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₺'}{item.price.toFixed(2)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        /* Transaction List for RETURN mode */
                        <div className="space-y-3">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                                <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase mb-1">İade Modu</h3>
                                <p className="text-xs text-red-500">İade etmek istediğiniz satışı aşağıdan seçin. Seçilen satışın ürünleri sepete eklenecektir.</p>
                            </div>

                            {filteredTransactions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <p className="text-lg font-bold">İADE EDİLECEK İŞLEM BULUNAMADI</p>
                                    <p className="text-sm">Henüz satış yapılmamış veya tüm satışlar iade edilmiş.</p>
                                </div>
                            ) : (
                                filteredTransactions.slice(0, 20).map(tx => (
                                    <button
                                        key={tx.id}
                                        onClick={() => selectTransactionForReturn(tx)}
                                        className="w-full text-left bg-white dark:bg-hub-panel border border-gray-200 dark:border-hub-border rounded-xl p-4 hover:border-red-500 transition-all hover:shadow-md"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-mono text-xs text-gray-400">#{tx.id.slice(0, 8)}</div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {new Date(tx.createdAt).toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                            <div className="text-xl font-black text-gray-900 dark:text-white">
                                                ₺{tx.total.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {tx.items.slice(0, 3).map((item, idx) => (
                                                <span key={idx} className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded font-bold">
                                                    {item.name} x{item.cartQuantity}
                                                </span>
                                            ))}
                                            {tx.items.length > 3 && (
                                                <span className="text-[10px] text-gray-400">+{tx.items.length - 3} ürün</span>
                                            )}
                                        </div>
                                        {tx.note && (
                                            <div className="text-xs text-gray-400 italic mt-2">{tx.note}</div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {transactionType === 'SALE' && filteredItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <p className="text-lg font-bold">ÜRÜN BULUNAMADI</p>
                            <p className="text-sm">Barkod okutun veya arama yapın</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Cart / Receipt */}
            <div className={`w-full md:w-[350px] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white flex flex-col z-20 shadow-xl border-l border-gray-200 dark:border-hub-border order-1 md:order-2 h-[50vh] md:h-auto transition-colors duration-300 ${transactionType === 'RETURN' ? 'border-l-4 border-l-red-500' : ''}`}>

                {/* Cart Header & Mode Toggle */}
                <div className={`p-4 border-b border-gray-200 dark:border-hub-border shrink-0 ${transactionType === 'RETURN' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-gray-50 dark:bg-black/20'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                            <span className={`w-1.5 h-6 rounded-full ${transactionType === 'RETURN' ? 'bg-red-500' : 'bg-blue-600'}`}></span>
                            Sepet
                        </h2>
                        <div className="flex bg-gray-200 dark:bg-black rounded-lg p-1">
                            <button
                                onClick={() => setTransactionType('SALE')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${transactionType === 'SALE' ? 'bg-white dark:bg-zinc-800 shadow text-black dark:text-white' : 'text-gray-500'}`}
                            >SATIŞ</button>
                            <button
                                onClick={() => setTransactionType('RETURN')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${transactionType === 'RETURN' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}
                            >İADE</button>
                        </div>
                    </div>

                    {transactionType === 'RETURN' && (
                        <div className="text-xs font-bold text-red-500 uppercase tracking-wider text-center bg-red-100 dark:bg-red-900/20 py-2 rounded">
                            ⚠ İADE MODU AKTİF
                        </div>
                    )}
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-black/40">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-hub-muted opacity-50 space-y-2">
                            <svg className="w-16 h-16 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            <div className="text-center">
                                <p className="font-bold uppercase text-sm">Sepet Boş</p>
                                <p className="text-xs mt-1">{transactionType === 'SALE' ? 'Ürün ekleyin' : 'İade için işlem seçin'}</p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartId} className="bg-white dark:bg-hub-panel p-2 rounded-lg shadow-sm border border-gray-200 dark:border-hub-border flex gap-2 relative">
                                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden shrink-0">
                                    {item.image ? (
                                        <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">IMG</div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-xs leading-tight text-gray-900 dark:text-white line-clamp-1">{item.name}</h4>
                                        <div className="text-[10px] font-mono text-gray-400">{item.sku}</div>
                                    </div>

                                    <div className="flex justify-between items-center mt-1">
                                        <div className="flex items-center bg-gray-100 dark:bg-black rounded p-0.5">
                                            <button onClick={() => updateQuantity(item.cartId, -1)} className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-hub-panel text-xs font-bold">-</button>
                                            <span className="w-5 text-center font-mono font-bold text-xs">{item.cartQuantity}</span>
                                            <button onClick={() => updateQuantity(item.cartId, 1)} className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-hub-panel text-xs font-bold">+</button>
                                        </div>
                                        <div className={`font-mono font-bold text-xs ${transactionType === 'RETURN' ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                            {transactionType === 'RETURN' ? '-' : ''}{item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₺'}{(item.price * item.cartQuantity).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => removeFromCart(item.cartId)} className="absolute top-1 right-1 text-gray-300 hover:text-red-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Payment Methods & Totals */}
                <div className="p-4 bg-white dark:bg-hub-panel border-t border-gray-200 dark:border-hub-border shrink-0 space-y-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-wider">Ödeme Yöntemi</p>
                        <div className="grid grid-cols-3 gap-2">
                            {['Nakit', 'Kredi Kartı', 'Veresiye'].map(method => (
                                <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${paymentMethod === method
                                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                        : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                        }`}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-wider">İşlem Notu (Opsiyonel)</p>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="..."
                            className="w-full bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500">{cart.length} Ürün</div>
                        <div className={`text-2xl font-black ${transactionType === 'RETURN' ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {transactionType === 'RETURN' ? '-' : ''}₺{cartTotal.toFixed(2)}
                        </div>
                    </div>

                    {successMsg ? (
                        <div className="bg-green-600 text-white p-3 rounded-xl text-center font-bold text-sm uppercase flex items-center justify-center gap-2 animate-bounce">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {successMsg}
                        </div>
                    ) : (
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isCheckingOut}
                            className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95
                                ${cart.length === 0
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'
                                    : transactionType === 'RETURN'
                                        ? 'bg-red-600 text-white hover:bg-red-500'
                                        : 'bg-black dark:bg-white text-white dark:text-black'
                                }`}
                        >
                            {isCheckingOut ? (
                                <span className="animate-pulse">İşleniyor...</span>
                            ) : (
                                <>
                                    <span>{transactionType === 'RETURN' ? 'İADEYİ TAMAMLA' : 'SATIŞI TAMAMLA'}</span>
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default POSMode;