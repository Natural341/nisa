//! Print Service Module
//! 
//! Fiş ve fatura yazdırma sistemi

use crate::models::Transaction;

/// Fiş formatı oluştur (text tabanlı - termal yazıcı uyumlu)
pub fn generate_receipt_text(transaction: &Transaction, currency: &str, store_name: &str) -> String {
    let width = 40; // Termal yazıcı genişliği
    let separator = "=".repeat(width);
    let thin_separator = "-".repeat(width);
    
    let mut lines = Vec::new();
    
    // Header
    lines.push(center_text(store_name, width));
    lines.push(separator.clone());
    
    // Transaction info
    let date = transaction.created_at.split('T').next().unwrap_or(&transaction.created_at);
    let time = transaction.created_at.split('T').nth(1)
        .map(|t| t.split('.').next().unwrap_or(t))
        .unwrap_or("");
    
    lines.push(format!("Tarih: {}  Saat: {}", date, time));
    lines.push(format!("Fiş No: {}", &transaction.id[..8]));
    lines.push(format!("Tür: {}", if transaction.transaction_type == "SALE" { "SATIŞ" } else { "İADE" }));
    lines.push(thin_separator.clone());
    
    // Items
    lines.push(format!("{:<20} {:>5} {:>12}", "ÜRÜN", "ADET", "TUTAR"));
    lines.push(thin_separator.clone());
    
    for item in &transaction.items {
        let item_total = item.price * item.cart_quantity as f64;
        let name = if item.name.len() > 18 {
            format!("{}...", &item.name[..15])
        } else {
            item.name.clone()
        };
        lines.push(format!("{:<20} {:>5} {:>10.2}{}", name, item.cart_quantity, item_total, currency));
    }
    
    lines.push(separator.clone());
    
    // Total
    lines.push(format!("{:>28} {:>10.2}{}", "TOPLAM:", transaction.total, currency));
    lines.push(format!("{:>28} {}", "ÖDEME:", match transaction.payment_method.as_str() {
        "CASH" => "NAKİT",
        "CARD" => "KART",
        "CREDIT" => "VERESİYE",
        _ => &transaction.payment_method,
    }));
    
    lines.push(separator.clone());
    
    // Footer
    lines.push(center_text("Teşekkürler!", width));
    lines.push(center_text("Bizi tercih ettiğiniz için", width));
    lines.push(center_text("teşekkür ederiz.", width));
    lines.push("".to_string());
    
    lines.join("\n")
}

/// HTML fatura formatı oluştur
pub fn generate_invoice_html(transaction: &Transaction, currency: &str, store_name: &str) -> String {
    let date = transaction.created_at.split('T').next().unwrap_or(&transaction.created_at);
    
    let items_html: String = transaction.items.iter().map(|item| {
        let item_total = item.price * item.cart_quantity as f64;
        format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td style="text-align:right">{:.2} {}</td>
                <td style="text-align:right">{:.2} {}</td>
            </tr>
        "#, item.name, item.cart_quantity, item.price, currency, item_total, currency)
    }).collect();
    
    format!(r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fatura - {id}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .header h1 {{ margin: 0; color: #333; }}
        .info {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th, td {{ padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }}
        th {{ background: #f5f5f5; }}
        .total {{ font-size: 1.2em; font-weight: bold; text-align: right; }}
        .footer {{ text-align: center; color: #666; margin-top: 30px; }}
        @media print {{ body {{ padding: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{store}</h1>
        <p>FATURA</p>
    </div>
    
    <div class="info">
        <div>
            <strong>Fatura No:</strong> {id}<br>
            <strong>Tarih:</strong> {date}
        </div>
        <div>
            <strong>Ödeme:</strong> {payment}<br>
            <strong>Tür:</strong> {type_name}
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Ürün</th>
                <th>Adet</th>
                <th style="text-align:right">Birim Fiyat</th>
                <th style="text-align:right">Tutar</th>
            </tr>
        </thead>
        <tbody>
            {items}
        </tbody>
    </table>
    
    <div class="total">
        TOPLAM: {total:.2} {currency}
    </div>
    
    <div class="footer">
        <p>Bizi tercih ettiğiniz için teşekkür ederiz.</p>
    </div>
</body>
</html>
    "#, 
        id = &transaction.id[..8],
        store = store_name,
        date = date,
        payment = match transaction.payment_method.as_str() {
            "CASH" => "Nakit",
            "CARD" => "Kredi Kartı",
            "CREDIT" => "Veresiye",
            _ => &transaction.payment_method,
        },
        type_name = if transaction.transaction_type == "SALE" { "Satış" } else { "İade" },
        items = items_html,
        total = transaction.total,
        currency = currency
    )
}

/// Text ortalama yardımcı fonksiyonu
fn center_text(text: &str, width: usize) -> String {
    if text.len() >= width {
        return text.to_string();
    }
    let padding = (width - text.len()) / 2;
    format!("{:>width$}", text, width = padding + text.len())
}
