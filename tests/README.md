# Kitap doğrulama testi

`node tests/kitap-dogrulama.js` (playwright gerekir).

- `golden81.json`: KKYY 164-14'ten çıkarılan nişangah/uçuş (Cetvel-F1) ve metro (Cetvel-F2) satırları.
- Testte ayrıca 81 mm kitap örnekleri, Cetvel-D, 81 TAÇ yöntemi, 106 mm Çizelge 4-58 ve Cetvel 4-3 kontrol edilir.
- Bir tabloda kitapla uyuşmayan satır olursa ilgili mühimmat, BH ve mesafe yazdırılır; çıkış kodu 1 olur.
