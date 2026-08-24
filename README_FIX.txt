FIX PACKAGE

Frontend sudah menggunakan Content-Type text/plain untuk Google Apps Script agar tidak terkena CORS preflight.

Jika masih Failed to fetch:
1. Deploy ulang Apps Script sebagai Web App.
2. Pastikan Execute as: Me.
3. Pastikan Who has access: Anyone.
4. Update URL /exec pada index.html jika deployment ID berubah.
