// Print service - Saves HTML file to Downloads and opens in default browser

import { open } from '@tauri-apps/plugin-shell';
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';

const getFullHtml = (content: string): string => {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yazdır - Nexus Inventory</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #000;
            background: #fff;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; }
        th { border-bottom: 2px solid #000; text-transform: uppercase; font-size: 10px; font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .font-mono { font-family: 'Courier New', monospace; }
        .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
        .footer { margin-top: 60px; display: flex; justify-content: space-between; }
        .signature-box { text-align: center; width: 200px; }
        .signature-box p { font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .signature-line { border-top: 1px solid #000; margin-top: 50px; }

        .print-actions {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
            background: #fff;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .print-btn {
            padding: 14px 28px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
            border: none;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .print-btn.primary { background: #000; color: #fff; }
        .print-btn.primary:hover { background: #333; transform: scale(1.05); }

        @media print {
            .print-actions { display: none !important; }
            body { padding: 20px; }
            @page { margin: 15mm; }
        }
    </style>
</head>
<body>
    <div class="print-actions">
        <button class="print-btn primary" onclick="window.print()">YAZDIR</button>
    </div>
    ${content}
</body>
</html>`;
};

export const printContent = async (content: string): Promise<void> => {
    const html = getFullHtml(content);
    const fileName = `Nexus_Yazdir_${Date.now()}.html`;

    try {
        // Try writing to Downloads folder
        const downloads = await downloadDir();
        const filePath = `${downloads}${fileName}`;

        await writeTextFile(filePath, html);
        console.log('Print file saved to:', filePath);

        // Open in default browser
        await open(filePath);
        return;

    } catch (error1) {
        console.error('Method 1 failed (downloadDir + writeTextFile):', error1);

        try {
            // Try with BaseDirectory
            await writeTextFile(fileName, html, { baseDir: BaseDirectory.Download });
            const downloads = await downloadDir();
            const filePath = `${downloads}${fileName}`;
            console.log('Print file saved to:', filePath);
            await open(filePath);
            return;

        } catch (error2) {
            console.error('Method 2 failed (BaseDirectory.Download):', error2);

            // Final fallback: browser download
            try {
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                alert('Dosya "İndirilenler" klasörüne kaydedildi.\nDosyayı tarayıcınızda açarak yazdırabilirsiniz.');
            } catch (error3) {
                console.error('All methods failed:', error3);
                alert('Yazdırma başarısız. Lütfen tekrar deneyin.');
            }
        }
    }
};
