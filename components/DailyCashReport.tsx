import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { inventoryService } from '../services/inventoryService';
import { financeService } from '../services/financeService';
import { useRefresh } from '../src/context/RefreshContext';

const ReportRow = ({ label, systemVal, stateKey, realizedValues, handleRealizedChange, formatCurrency }: {
    label: string,
    systemVal: number,
    stateKey: string,
    realizedValues: { [key: string]: string },
    handleRealizedChange: (key: string, val: string) => void,
    formatCurrency: (val: number) => string
}) => {
    const realized = parseFloat(realizedValues[stateKey]);
    const diff = isNaN(realized) ? 0 : realized - systemVal;
    const hasInput = realizedValues[stateKey] !== '';

    return (
        <tr className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
            <td className="p-4 font-medium text-gray-700 dark:text-gray-300">{label}</td>
            <td className="p-4 text-right font-mono font-medium text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-800/30">
                {formatCurrency(systemVal)}
            </td>
            <td className="p-4 text-right">
                <input
                    type="number"
                    value={realizedValues[stateKey]}
                    onChange={(e) => handleRealizedChange(stateKey, e.target.value)}
                    className="w-32 text-right p-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 ring-black dark:ring-white outline-none font-mono"
                    placeholder="0.00"
                />
            </td>
            <td className={`p-4 text-right font-mono font-bold ${hasInput ? (Math.abs(diff) < 0.01 ? 'text-green-500' : 'text-red-500') : 'text-gray-300'}`}>
                {hasInput ? formatCurrency(diff) : '-'}
            </td>
        </tr>
    );
};

const DailyCashReport: React.FC = () => {
    const { lastUpdated } = useRefresh();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const [systemTotals, setSystemTotals] = useState({
        cash: 0,
        creditCard: 0,
        veresiye: 0,
        mailOrder: 0,
        returns: 0,
        expenses: 0,
        malKabul: 0
    });

    const [realizedValues, setRealizedValues] = useState<{ [key: string]: string }>({
        cash: '',
        creditCard: '',
        veresiye: '',
        mailOrder: '',
        returns: '',
        expenses: '',
        malKabul: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const txs = await inventoryService.getTransactionsByDateRange(date, date);

            // Finance records'ı da çek (mal kabul dahil)
            let financeRecords: any[] = [];
            try {
                financeRecords = await financeService.getRecords(date, date);
            } catch (e) {
                console.error('Finance records yüklenemedi:', e);
            }

            const newTotals = {
                cash: 0,
                creditCard: 0,
                veresiye: 0,
                mailOrder: 0,
                returns: 0,
                expenses: 0,
                malKabul: 0
            };

            txs.forEach(tx => {
                if (tx.transactionType === 'RETURN') {
                    const amount = Math.abs(tx.total);
                    newTotals.returns += amount;
                } else if (tx.transactionType === 'EXPENSE') {
                    newTotals.expenses += Math.abs(tx.total);
                } else if (tx.transactionType === 'PURCHASE') {
                    // Mal kabul - gider olarak kaydet
                    newTotals.malKabul += Math.abs(tx.total);
                } else {
                    // SALE, COLLECTION
                    const pm = (tx.paymentMethod || '').toString();
                    if (pm === 'VERESIYE') newTotals.veresiye += tx.total;
                    else if (pm === 'MAIL_ORDER') newTotals.mailOrder += tx.total;
                    else if (pm.startsWith('Kredi Kartı')) newTotals.creditCard += tx.total;
                    else newTotals.cash += tx.total;
                }
            });

            // Finance records'dan sadece manuel masrafları hesapla (mal kabul transactions'dan geliyor)
            financeRecords.forEach(record => {
                if (record.recordType === 'EXPENSE' && record.category !== 'MAL_KABUL') {
                    newTotals.expenses += Math.abs(record.amount);
                }
            });

            setSystemTotals(newTotals);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [date, lastUpdated]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    const handleRealizedChange = (key: string, val: string) => {
        setRealizedValues(prev => ({ ...prev, [key]: val }));
    };

    const totalSystemIncome = systemTotals.cash + systemTotals.creditCard + systemTotals.veresiye + systemTotals.mailOrder;
    const totalSystemExpense = systemTotals.returns + systemTotals.expenses + systemTotals.malKabul;
    const totalSystemNet = totalSystemIncome - totalSystemExpense;

    const totalRealizedIncome =
        (parseFloat(realizedValues.cash) || 0) +
        (parseFloat(realizedValues.creditCard) || 0) +
        (parseFloat(realizedValues.veresiye) || 0) +
        (parseFloat(realizedValues.mailOrder) || 0);

    const totalRealizedExpense =
        (parseFloat(realizedValues.returns) || 0) +
        (parseFloat(realizedValues.expenses) || 0) +
        (parseFloat(realizedValues.malKabul) || 0);

    const totalRealizedNet = totalRealizedIncome - totalRealizedExpense;
    const hasAnyRealizedInput = Object.values(realizedValues).some(v => v !== '');

    return (
        <div className="h-full overflow-hidden flex flex-col bg-white dark:bg-black p-6">
            {/* Print CSS - CustomerStatement'dan alındı */}
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; }
                    body * { visibility: hidden; }
                    #daily-report-printable, #daily-report-printable * { visibility: visible; }
                    #daily-report-printable {
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

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white uppercase">Günlük Kasa Raporu</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent text-gray-500 font-medium outline-none cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                        />
                        {loading && <span className="text-xs text-gray-400 animate-pulse">Güncelleniyor...</span>}
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-wider rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Yazdır / Kaydet
                </button>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-auto">
                <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 dark:bg-zinc-900">
                            <tr>
                                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-widest pl-6">İşlem Türü</th>
                                <th className="p-4 text-right text-xs font-black uppercase text-gray-500 tracking-widest">Sistem (Oto)</th>
                                <th className="p-4 text-right text-xs font-black uppercase text-gray-500 tracking-widest w-40">Gerçekleşen</th>
                                <th className="p-4 text-right text-xs font-black uppercase text-gray-500 tracking-widest">Fark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-black">
                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50"><td colSpan={4} className="p-2 text-[10px] font-bold uppercase text-gray-400 pl-6">Gelirler</td></tr>
                            <ReportRow label="Nakit Satış" systemVal={systemTotals.cash} stateKey="cash" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                            <ReportRow label="Kredi Kartı" systemVal={systemTotals.creditCard} stateKey="creditCard" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                            <ReportRow label="Veresiye Satış" systemVal={systemTotals.veresiye} stateKey="veresiye" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                            <ReportRow label="Mail Order" systemVal={systemTotals.mailOrder} stateKey="mailOrder" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />

                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50"><td colSpan={4} className="p-2 text-[10px] font-bold uppercase text-gray-400 pl-6 border-t border-gray-100 dark:border-zinc-800">Giderler</td></tr>
                            <ReportRow label="İadeler" systemVal={systemTotals.returns} stateKey="returns" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                            <ReportRow label="Mal Kabul" systemVal={systemTotals.malKabul} stateKey="malKabul" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                            <ReportRow label="Masraflar" systemVal={systemTotals.expenses} stateKey="expenses" realizedValues={realizedValues} handleRealizedChange={handleRealizedChange} formatCurrency={formatCurrency} />
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-zinc-900 border-t-2 border-gray-200 dark:border-zinc-800">
                            <tr>
                                <td className="p-4 font-black text-gray-900 dark:text-white uppercase pl-6">Genel Toplam</td>
                                <td className="p-4 text-right font-black font-mono text-lg text-gray-900 dark:text-white">
                                    {formatCurrency(totalSystemNet)}
                                </td>
                                <td className="p-4 text-right font-black font-mono text-lg text-gray-900 dark:text-white">
                                    {hasAnyRealizedInput ? formatCurrency(totalRealizedNet) : '-'}
                                </td>
                                <td className={`p-4 text-right font-black font-mono text-lg ${hasAnyRealizedInput ? ((totalRealizedNet - totalSystemNet) < 0 ? 'text-red-500' : 'text-green-500') : ''}`}>
                                    {hasAnyRealizedInput ? formatCurrency(totalRealizedNet - totalSystemNet) : '-'}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Printable Area - CustomerStatement yapısı */}
            <div id="daily-report-printable" className="hidden">
                <div className="mb-8 border-b-2 border-black pb-4 text-center">
                    <h1 className="text-3xl font-black uppercase mb-1">GÜNLÜK KASA RAPORU</h1>
                    <p className="font-mono text-gray-600">{new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <table className="w-full border-collapse mb-8 text-sm">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="py-2 text-center">AÇIKLAMA</th>
                            <th className="py-2 text-center">SİSTEM</th>
                            <th className="py-2 text-center">GERÇEKLEŞEN</th>
                            <th className="py-2 text-center">FARK</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono">
                        <tr className="border-b border-gray-200 bg-gray-100">
                            <td colSpan={4} className="py-1 font-bold text-xs uppercase text-center">GELİRLER</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Nakit Satış</td>
                            <td className="text-center">{formatCurrency(systemTotals.cash)}</td>
                            <td className="text-center">{realizedValues.cash ? formatCurrency(parseFloat(realizedValues.cash)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.cash ? formatCurrency(parseFloat(realizedValues.cash) - systemTotals.cash) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Kredi Kartı</td>
                            <td className="text-center">{formatCurrency(systemTotals.creditCard)}</td>
                            <td className="text-center">{realizedValues.creditCard ? formatCurrency(parseFloat(realizedValues.creditCard)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.creditCard ? formatCurrency(parseFloat(realizedValues.creditCard) - systemTotals.creditCard) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Veresiye</td>
                            <td className="text-center">{formatCurrency(systemTotals.veresiye)}</td>
                            <td className="text-center">{realizedValues.veresiye ? formatCurrency(parseFloat(realizedValues.veresiye)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.veresiye ? formatCurrency(parseFloat(realizedValues.veresiye) - systemTotals.veresiye) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Mail Order</td>
                            <td className="text-center">{formatCurrency(systemTotals.mailOrder)}</td>
                            <td className="text-center">{realizedValues.mailOrder ? formatCurrency(parseFloat(realizedValues.mailOrder)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.mailOrder ? formatCurrency(parseFloat(realizedValues.mailOrder) - systemTotals.mailOrder) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200 bg-gray-100">
                            <td colSpan={4} className="py-1 font-bold text-xs uppercase text-center">GİDERLER</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">İadeler</td>
                            <td className="text-center">{formatCurrency(systemTotals.returns)}</td>
                            <td className="text-center">{realizedValues.returns ? formatCurrency(parseFloat(realizedValues.returns)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.returns ? formatCurrency(parseFloat(realizedValues.returns) - systemTotals.returns) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Mal Kabul</td>
                            <td className="text-center">{formatCurrency(systemTotals.malKabul)}</td>
                            <td className="text-center">{realizedValues.malKabul ? formatCurrency(parseFloat(realizedValues.malKabul)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.malKabul ? formatCurrency(parseFloat(realizedValues.malKabul) - systemTotals.malKabul) : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 text-center">Masraflar</td>
                            <td className="text-center">{formatCurrency(systemTotals.expenses)}</td>
                            <td className="text-center">{realizedValues.expenses ? formatCurrency(parseFloat(realizedValues.expenses)) : '-'}</td>
                            <td className="text-center font-bold">{realizedValues.expenses ? formatCurrency(parseFloat(realizedValues.expenses) - systemTotals.expenses) : '-'}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black">
                            <td className="py-4 font-black uppercase text-lg text-center">GENEL TOPLAM (NET)</td>
                            <td className="py-4 text-center font-black font-mono text-lg">{formatCurrency(totalSystemNet)}</td>
                            <td className="py-4 text-center font-black font-mono text-lg">{hasAnyRealizedInput ? formatCurrency(totalRealizedNet) : '-'}</td>
                            <td className="py-4 text-center font-black font-mono text-lg">{hasAnyRealizedInput ? formatCurrency(totalRealizedNet - totalSystemNet) : '-'}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-12 flex justify-center">
                    <div className="text-center">
                        <p className="font-bold mb-8 text-xs uppercase">RAPORLAYAN</p>
                        <div className="w-32 border-t border-black"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyCashReport;
