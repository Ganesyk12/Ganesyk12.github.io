# Bekasi Explorer

Landing page interaktif bergaya desktop **macOS / Windows** untuk 10 tempat instagramable di Bekasi.

## Fitur

- **Desktop + dock** dengan ikon animasi untuk tiap tempat.
- **Jendela aplikasi** bergaya macOS (traffic lights) dan Windows (caption buttons), bisa diganti lewat menu bar.
- **Deep link** ke tiap tempat: `#/tempat/rainbow-garden`, `#/tempat/curug-parigi`, dst.
- Animasi buka/tutup jendela, minimize ke dock, drag, maximize, dan pencarian tempat.
- Navigasi keyboard `←` / `→`, tombol `Esc` untuk menutup.
- Tema terang/gelap yang tersimpan otomatis.
- Responsif untuk mobile: sidebar horizontal dan jendela layar penuh.

## Struktur

| File | Keterangan |
| --- | --- |
| `index.html` | Kerangka desktop, menu bar, template jendela |
| `data.js` | Data 10 tempat (nama, deskripsi, alamat, jam, HTM, foto) |
| `script.js` | Render ikon, routing, animasi, interaksi jendela |
| `styles.css` | Tema, wallpaper, dock, jendela, layout responsif |
| `assets/` | Foto lokal tiap tempat |

## Menambah / mengubah tempat

Edit array di `data.js`, lalu tambahkan foto ke `assets/`. Ikon desktop dan dock dibuat otomatis dari data tersebut.

```js
{
  id: "nama-tempat",
  no: 11,
  name: "Nama Tempat",
  category: "Kafe",
  area: "Bekasi Timur",
  emoji: "☕",
  accent: "#f472b6",
  accent2: "#8b5cf6",
  image: "assets/nama-tempat.jpg",
  description: "Deskripsi singkat.",
  address: "Alamat lengkap.",
  hours: "08.00 – 22.00",
  ticket: "Gratis",
  mapsQuery: "Nama Tempat Bekasi"
}
```

## Menjalankan

Buka `index.html` langsung di browser, atau jalankan static server:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

---

Ganes Yudha Kusuma © 2023

<a href="https://app.daily.dev/ganesyk">
  <img src="https://api.daily.dev/devcards/c8106908a6af4dc4b696154831990392.png?r=ddb" width="400" alt="Ganes Yudha K's Dev Card" />
</a>

[Edit di Codeflow ⚡️](https://stackblitz.com/~/github.com/Ganesyk12/web-platform-h9v9um)

