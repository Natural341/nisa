import React, { useState, useEffect, useMemo } from 'react';
import { useRefresh } from '../src/context/RefreshContext';
import { tauriInvoke } from '../services/tauriService';
import { Transaction, CartItem } from '../types';

interface CurrentAccount {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    accountType: string;
    balance?: number;
}

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, description: string, method: 'CASH' | 'CREDIT_CARD' | 'MAIL_ORDER' | 'HAVALE', installment?: number) => void;
    title: string;
    type: 'PAYMENT' | 'MAIL_ORDER';
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmit, title, type }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState<'CASH' | 'CREDIT_CARD' | 'MAIL_ORDER' | 'HAVALE'>(type === 'MAIL_ORDER' ? 'MAIL_ORDER' : 'CASH');
    const [installment, setInstallment] = useState(1);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(parseFloat(amount), description, method, installment);
        setAmount('');
        setDescription('');
        setInstallment(1);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-96 border border-gray-200 dark:border-zinc-800 shadow-2xl">
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">Tutar</label>
                        <input
                            type="number"
                            autoFocus
                            required
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full text-2xl font-mono font-bold p-3 border rounded-xl outline-none focus:ring-2 ring-black dark:ring-white bg-gray-50 dark:bg-zinc-800"
                            placeholder="0.00"
                        />
                    </div>
                    {type !== 'MAIL_ORDER' && (
                        <div>
                            <label className="block text-sm font-bold mb-1">Ödeme Yöntemi</label>
                            <select
                                value={method}
                                onChange={e => setMethod(e.target.value as any)}
                                className="w-full p-2 border rounded-xl bg-white dark:bg-zinc-800"
                            >
                                <option value="CASH">Nakit</option>
                                <option value="CREDIT_CARD">Kredi Kartı</option>
                                <option value="HAVALE">Havale / EFT</option>
                            </select>
                        </div>
                    )}

                    {/* Installment Selection for Credit Card or Mail Order */}
                    {(method === 'CREDIT_CARD' || method === 'MAIL_ORDER' || type === 'MAIL_ORDER') && (
                        <div>
                            <label className="block text-sm font-bold mb-1">Taksit (Vade)</label>
                            <select
                                value={installment}
                                onChange={e => setInstallment(parseInt(e.target.value))}
                                className="w-full p-2 border rounded-xl bg-white dark:bg-zinc-800 font-bold"
                            >
                                <option value={1}>Tek Çekim</option>
                                <option value={2}>2 Taksit</option>
                                <option value={3}>3 Taksit</option>
                                <option value={6}>6 Taksit</option>
                                <option value={9}>9 Taksit</option>
                                <option value={12}>12 Taksit</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold mb-1">Açıklama</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-3 border rounded-xl outline-none focus:ring-2 ring-black dark:ring-white bg-gray-50 dark:bg-zinc-800"
                            placeholder="Opsiyonel..."
                        />
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 font-bold hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">İptal</button>
                        <button type="submit" className="flex-1 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold hover:opacity-90">Onayla</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CustomerStatement: React.FC = () => {
    const { lastUpdated } = useRefresh();
    const [accounts, setAccounts] = useState<CurrentAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Statement View State
    const [selectedAccount, setSelectedAccount] = useState<CurrentAccount | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
    const [statementLoading, setStatementLoading] = useState(false);

    // Modals
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showMailOrderModal, setShowMailOrderModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editNote, setEditNote] = useState('');

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: CurrentAccount } | null>(null);

    useEffect(() => {
        loadAccounts();
    }, [lastUpdated]);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const res = await tauriInvoke<CurrentAccount[]>('get_current_accounts');
            setAccounts(res || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadStatement = async (account: CurrentAccount) => {
        setStatementLoading(true);
        try {
            const res = await tauriInvoke<{ data: Transaction[], total: number }>('get_transactions_with_pagination', {
                page: 1,
                perPage: 1000,
                startDate: dateFrom,
                endDate: dateTo,
                transactionType: null,
                customerId: account.id
            });
            setTransactions(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setStatementLoading(false);
        }
    };

    const handleRightClick = (e: React.MouseEvent, account: CurrentAccount) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, account });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleViewStatement = () => {
        if (contextMenu) {
            setSelectedAccount(contextMenu.account);
            loadStatement(contextMenu.account);
            closeContextMenu();
        }
    };

    // Filtered Accounts
    const filteredAccounts = useMemo(() => {
        return accounts.filter(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.phone && a.phone.includes(searchTerm))
        );
    }, [accounts, searchTerm]);

    useEffect(() => {
        // Refresh statement if dates change and account selected
        if (selectedAccount) {
            loadStatement(selectedAccount);
        }
    }, [dateFrom, dateTo]);

    const handleProcessPayment = async (amount: number, description: string, method: 'CASH' | 'CREDIT_CARD' | 'MAIL_ORDER' | 'HAVALE', installment: number = 1) => {
        if (!selectedAccount) return;

        try {
            let finalDescription = description || (method === 'MAIL_ORDER' ? 'Mail Order Tahsilat' : 'Tahsilat');
            if ((method === 'MAIL_ORDER' || method === 'CREDIT_CARD') && installment > 1) {
                finalDescription += ` (${installment} Taksit)`;
            }

            // Create a negative transaction to represent payment (credit)
            const paymentItem: CartItem = {
                id: 'PAYMENT',
                sku: 'TAHSILAT',
                name: finalDescription,
                category: 'FINANCE',
                quantity: 1, // Inventory Logic Logic ignores negative price items for qty
                location: '',
                price: -Math.abs(amount), // Negative price reduces balance
                cartId: 'PAYMENT',
                cartQuantity: 1,
                lastUpdated: new Date().toISOString()
            };

            await tauriInvoke('process_sale', {
                cartItems: [paymentItem],
                paymentMethod: method,
                transactionType: 'COLLECTION', // Using COLLECTION type for clarity
                note: finalDescription,
                customerId: selectedAccount.id
            });

            // Refresh
            loadStatement(selectedAccount);
            setShowPaymentModal(false);
            setShowMailOrderModal(false);
            // Also refresh overall accounts to update balance in list
            loadAccounts();
        } catch (error) {
            console.error(error);
            alert('İşlem başarısız: ' + error);
        }
    };

    const handleEditTransaction = (tx: Transaction) => {
        setEditingTransaction(tx);
        setEditAmount(tx.total.toString());
        setEditNote(tx.note || '');
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        try {
            await tauriInvoke('update_transaction', {
                id: editingTransaction.id,
                total: parseFloat(editAmount),
                note: editNote
            });
            setShowEditModal(false);
            setEditingTransaction(null);
            loadStatement(selectedAccount!);
            loadAccounts();
            alert('İşlem güncellendi!');
        } catch (error) {
            console.error(error);
            alert('Hata: ' + error);
        }
    };

    const handleDeleteTransaction = async (txId: string) => {
        if (!confirm('Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
        try {
            await tauriInvoke('delete_transaction', { id: txId });
            loadStatement(selectedAccount!);
            loadAccounts();
            alert('İşlem silindi!');
        } catch (error) {
            console.error(error);
            alert('Hata: ' + error);
        }
    };

    if (selectedAccount) {
        // STATEMENT VIEW
        const totalDebt = transactions.reduce((acc, t) => acc + t.total, 0);

        return (
            <div className="h-full flex flex-col bg-white dark:bg-black p-6">
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    onSubmit={handleProcessPayment}
                    title={`${selectedAccount.name} - Tahsilat`}
                    type="PAYMENT"
                />
                <PaymentModal
                    isOpen={showMailOrderModal}
                    onClose={() => setShowMailOrderModal(false)}
                    onSubmit={handleProcessPayment}
                    title={`${selectedAccount.name} - Mail Order`}
                    type="MAIL_ORDER"
                />
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedAccount(null)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black uppercase">{selectedAccount.name}</h1>
                            <p className="text-gray-500 text-sm">Cari Ekstresi</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm font-bold p-2 outline-none border border-gray-200 dark:border-zinc-800 rounded-lg" />
                        <span className="text-gray-400 self-center">-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm font-bold p-2 outline-none border border-gray-200 dark:border-zinc-800 rounded-lg" />
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-xl font-bold text-sm uppercase hover:scale-105 transition-transform"
                    >
                        Yazdır
                    </button>
                </div>

                <style>{`
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { margin: 0; padding: 0; }
                        body * { visibility: hidden; }
                        #statement-printable, #statement-printable * { visibility: visible; }
                        #statement-printable {
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 100vw;
                            height: 100vh;
                            background: white;
                            color: black;
                            padding: 40px;
                            z-index: 9999;
                            overflow: visible;
                            display: block !important;
                        }
                    }
                `}</style>

                {/* Content */}
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto p-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-black uppercase text-gray-400 border-b border-gray-200 dark:border-zinc-800">
                                    <th className="p-3">Tarih</th>
                                    <th className="p-3">İşlem No</th>
                                    <th className="p-3">Tür</th>
                                    <th className="p-3">Açıklama</th>
                                    <th className="p-3 text-right">Tutar</th>
                                    <th className="p-3 text-center">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 ">
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-100 dark:hover:bg-zinc-800/50">
                                        <td className="p-3 font-mono text-sm">{new Date(tx.createdAt).toLocaleDateString('tr-TR')} {new Date(tx.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="p-3 font-mono text-xs text-gray-500">#{tx.id.slice(0, 8)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase 
                                                ${tx.transactionType === 'RETURN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    tx.transactionType === 'PURCHASE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        tx.transactionType === 'COLLECTION' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                                {tx.transactionType === 'RETURN' ? 'İADE' :
                                                    tx.transactionType === 'PURCHASE' ? 'ALIM (MAL KABUL)' :
                                                        tx.transactionType === 'COLLECTION' ? 'TAHSİLAT' : 'SATIŞ'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                                            {tx.items?.map(i => i.name).join(', ')} {tx.note && `(${tx.note})`}
                                        </td>
                                        <td className={`p-3 text-right font-mono font-bold ${tx.transactionType === 'RETURN' || tx.transactionType === 'COLLECTION' ? 'text-zinc-700 dark:text-zinc-300' : 'text-gray-900 dark:text-white'
                                            }`}>
                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.total)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleEditTransaction(tx)}
                                                    className="p-1.5 text-gray-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg transition-all"
                                                    title="Düzenle"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                    className="p-1.5 text-gray-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg transition-all"
                                                    title="Sil"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer / Actions */}
                    <div className="p-4 bg-white dark:bg-black border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                            Toplam Bakiye: <span className="font-mono">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalDebt)}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowMailOrderModal(true)} className="px-6 py-3 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                Mail Order
                            </button>
                            <button onClick={() => setShowPaymentModal(true)} className="px-6 py-3 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                Ödeme Yap (Tahsilat)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Printable Area - A4 Standard */}
                <div id="statement-printable" className="hidden">
                    <div className="mb-8 border-b-2 border-black pb-4">
                        <h1 className="text-3xl font-black uppercase mb-1">{selectedAccount.name}</h1>
                        <p className="font-mono text-gray-600">CARİ HESAP EKSTRESİ</p>
                        <div className="flex justify-between mt-4 text-sm font-mono">
                            <div>
                                <p><span className="font-bold">Telefon:</span> {selectedAccount.phone || '-'}</p>
                                <p><span className="font-bold">Adres:</span> {selectedAccount.address || '-'}</p>
                            </div>
                            <div className="text-right">
                                <p><span className="font-bold">Tarih:</span> {new Date().toLocaleDateString('tr-TR')}</p>
                                <p><span className="font-bold">Dönem:</span> {new Date(dateFrom).toLocaleDateString('tr-TR')} - {new Date(dateTo).toLocaleDateString('tr-TR')}</p>
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse mb-8 text-sm">
                        <thead>
                            <tr className="border-b-2 border-black">
                                <th className="py-2 text-left">TARİH</th>
                                <th className="py-2 text-left">İŞLEM TÜRÜ</th>
                                <th className="py-2 text-left">AÇIKLAMA</th>
                                <th className="py-2 text-right">TUTAR</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {transactions.map(tx => (
                                <tr key={tx.id} className="border-b border-gray-200">
                                    <td className="py-2">{new Date(tx.createdAt).toLocaleDateString('tr-TR')}</td>
                                    <td className="py-2 uppercase font-bold text-xs">
                                        {tx.transactionType === 'RETURN' ? 'İADE' :
                                            tx.transactionType === 'PURCHASE' ? 'ALIM (MAL KABUL)' :
                                                tx.transactionType === 'COLLECTION' ? 'TAHSİLAT' : 'SATIŞ'}
                                    </td>
                                    <td className="py-2">{tx.items?.map(i => i.name).join(', ')} {tx.note && `(${tx.note})`}</td>
                                    <td className="py-2 text-right font-bold">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-black">
                                <td colSpan={3} className="py-4 text-right font-black uppercase text-lg">Toplam Bakiye</td>
                                <td className="py-4 text-right font-black font-mono text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalDebt)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-12 flex justify-between px-10">
                        <div className="text-center">
                            <p className="font-bold mb-8 text-xs uppercase">Teslim Eden</p>
                            <div className="w-32 border-t border-black"></div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold mb-8 text-xs uppercase">Teslim Alan</p>
                            <div className="w-32 border-t border-black"></div>
                        </div>
                    </div>
                </div>

            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="h-full flex flex-col bg-white dark:bg-black p-6" onClick={closeContextMenu}>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black tracking-tight uppercase">Cari Hesaplar</h1>
                <input
                    type="text"
                    placeholder="Ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-100 dark:bg-zinc-900 px-4 py-2 rounded-xl outline-none focus:ring-2 ring-black dark:ring-white"
                />
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-xs font-black uppercase text-gray-400 border-b border-gray-200 dark:border-zinc-800">
                            <th className="p-4 pl-6">Cari Adı</th>
                            <th className="p-4">Tip</th>
                            <th className="p-4">Telefon</th>
                            <th className="p-4">Adres</th>
                            <th className="p-4 text-right pr-6">Bakiye</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">Yükleniyor...</td></tr>
                        ) : filteredAccounts.map(account => (
                            <tr
                                key={account.id}
                                onContextMenu={(e) => handleRightClick(e, account)}
                                className="hover:bg-white dark:hover:bg-black transition-colors cursor-context-menu"
                            >
                                <td className="p-4 pl-6 font-bold text-gray-900 dark:text-white">{account.name}</td>
                                <td className="p-4 text-sm text-gray-500 uppercase">{account.accountType}</td>
                                <td className="p-4 text-sm font-mono text-gray-500">{account.phone || '-'}</td>
                                <td className="p-4 text-sm text-gray-500 truncate max-w-xs">{account.address || '-'}</td>
                                <td className="p-4 pr-6 text-right font-mono font-bold text-gray-900 dark:text-white">
                                    {account.balance ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account.balance) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-gray-100 dark:border-zinc-700 py-1 min-w-[200px] z-50 overflow-hidden"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={handleViewStatement}
                        className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Cari Ekstre Görüntüle
                    </button>
                    <div className="border-t border-gray-200 dark:border-zinc-700 my-1"></div>
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">Cari Türü Değiştir</div>
                    {['CUSTOMER', 'SUPPLIER', 'BOTH'].map(type => (
                        <button
                            key={type}
                            onClick={async () => {
                                try {
                                    await tauriInvoke('update_current_account', {
                                        id: contextMenu.account.id,
                                        name: contextMenu.account.name,
                                        accountType: type,
                                        phone: contextMenu.account.phone || null,
                                        email: contextMenu.account.email || null,
                                        address: contextMenu.account.address || null,
                                        note: null,
                                        paymentTerm: 0
                                    });
                                    loadAccounts();
                                    closeContextMenu();
                                } catch (e) {
                                    console.error('Failed to update account type', e);
                                    alert('Güncelleme başarısız: ' + e);
                                }
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2
                                ${contextMenu.account.accountType === type ? 'font-bold text-black dark:text-white bg-gray-100 dark:bg-zinc-700' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            {contextMenu.account.accountType === type && (
                                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                            {type === 'CUSTOMER' ? 'Müşteri' : type === 'SUPPLIER' ? 'Tedarikçi' : 'Her İkisi'}
                        </button>
                    ))}
                </div>
            )}

            {/* Edit Transaction Modal */}
            {showEditModal && editingTransaction && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">İşlem Düzenle</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">İşlem Türü</label>
                                <div className="text-sm text-gray-500 bg-gray-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                                    {editingTransaction.transactionType === 'RETURN' ? 'İade' :
                                        editingTransaction.transactionType === 'COLLECTION' ? 'Tahsilat' : 'Satış'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Tutar (₺)</label>
                                <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-mono text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Açıklama</label>
                                <input
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                                    placeholder="Not ekleyin..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingTransaction(null); }}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerStatement;