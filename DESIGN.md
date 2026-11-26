---
name: ECER — Sertifikat dan Piagam Digital
description: Modern Healthcare Editorial design system untuk layanan sertifikat dan piagam digital Puskesmas Sumbermanjing Kulon.
colors:
  primary-forest: '#123F38'
  primary-green: '#23634E'
  accent-mint: '#D9EBE0'
  canvas: '#F5F7F6'
  surface: '#FFFFFF'
  text-primary: '#203F35'
  text-secondary: '#64748B'
  border: '#DFE7E2'
  warning: '#B45309'
  danger: '#B91C1C'
  success: '#15803D'
typography:
  display:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '2rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: '0em'
  label:
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.01em'
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  pill: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  base: '16px'
  lg: '24px'
  xl: '32px'
  2xl: '48px'
  3xl: '64px'
components:
  button-primary:
    backgroundColor: '{colors.primary-green}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '10px 16px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.primary-forest}'
    textColor: '{colors.surface}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '10px 16px'
    height: '44px'
  card-surface:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.lg}'
    padding: '24px'
  input-field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
    height: '44px'
  status-badge:
    backgroundColor: '{colors.accent-mint}'
    textColor: '{colors.primary-forest}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
---

# Design System: ECER — Sertifikat dan Piagam Digital

## Overview

**Creative North Star: "Layanan Publik Kesehatan yang Tenang dan Terpercaya"**

ECER dirancang dengan arah **Modern Healthcare Editorial** untuk Puskesmas Sumbermanjing Kulon. Antarmuka publik harus terasa hangat, bersih, terstruktur, dan langsung dipahami oleh kader kesehatan maupun masyarakat umum tanpa kesan portal birokrasi yang kaku ataupun tampilan dashboard generik buatan AI. Di sisi administrator, kepadatan informasi meningkat secara terukur dengan hierarki tipografi yang tegas dan ruang napas yang tetap terjaga.

Struktur visual bertumpu pada kanvas abu-hijau lembut (`#F5F7F6`), permukaan kartu putih bersih (`#FFFFFF`) dengan garis batas tipis berona hijau (`#DFE7E2`), serta aksen hijau hutan (`#123F38` dan `#23634E`) yang menenangkan dan berwibawa. Pemisahan konten mengutamakan whitespace dan struktur tipografi daripada bayangan berat, efek kaca, atau dekorasi berlebih.

**Key Characteristics:**

- Palet hijau hutan dan mint natural khas layanan kesehatan masyarakat, bebas dari warna ungu maupun gradasi neon.
- Tipografi tunggal `Plus Jakarta Sans` yang bersih dengan angka tabular (`tabular-nums`) untuk statistik dan nomor dokumen.
- Permukaan datar dengan garis batas halus (`1px solid #DFE7E2`) dan radius terukur (`6px`, `8px`, `12px`).
- Mobile-first dengan touch target minimal `44px` dan ukuran font input minimal `16px` pada perangkat mobile.

## Colors

Palet ECER berpusat pada rona hijau hutan yang menenangkan, dipadukan dengan kanvas netral berona hijau tipis agar halaman terasa sejuk dan mudah dipindai dalam waktu lama.

### Primary

- **Primary Forest** (`#123F38`): Digunakan untuk header instansi, state hover aksi utama, judul berpenekanan tinggi, dan teks pada latar Accent Mint.
- **Primary Green** (`#23634E`): Digunakan untuk tombol aksi utama (CTA), indikator navigasi aktif, focus ring, dan tautan interaktif utama.
- **Accent Mint** (`#D9EBE0`): Digunakan sebagai latar halus untuk badge status aktif, highlight bulan berjalan, dan permukaan ikon fungsional.

### Neutral

- **Canvas** (`#F5F7F6`): Latar utama halaman agar kartu putih memiliki separasi lembut tanpa membutuhkan bayangan tebal.
- **Surface** (`#FFFFFF`): Permukaan kartu kegiatan, formulir, modal, header sticky, dan panel tabel.
- **Text Primary** (`#203F35`): Teks utama (judul, isi, label input) dengan kontras tinggi (≥ 10:1 di atas Surface).
- **Text Secondary** (`#64748B`): Metadata kegiatan, teks bantuan formulir, dan keterangan waktu (memenuhi WCAG AA ≥ 4.5:1 di atas Surface).
- **Border** (`#DFE7E2`): Garis pemisah tipis berona hijau untuk kartu, input, tabel, dan pembatas seksi.

### Semantic Status

- **Success** (`#15803D`): Sertifikat terbit, dokumen valid, pengiriman email berhasil, dan status layanan sehat.
- **Warning** (`#B45309`): Menunggu persetujuan panitia, kuota hampir penuh, kuota email tertunda (`deferred_quota`), atau peringatan validasi template.
- **Danger** (`#B91C1C`): Dokumen dicabut (`revoked`), kegagalan penerbitan, error validasi formulir, dan aksi destruktif.

### Named Rules

**The Forest Restraint Rule.** Warna `Primary Green` (`#23634E`) dan `Primary Forest` (`#123F38`) digunakan secara selektif untuk aksi utama dan penanda identitas (≤ 15% luas layar) agar hierarki tindakan tetap langsung terbaca.

**The Semantic Pairing Rule.** Status dokumen dan kegiatan tidak pernah dibedakan oleh warna saja; setiap badge status wajib memadukan warna semantik dengan label teks Bahasa Indonesia yang jelas dan/atau ikon fungsional.

## Typography

**Display & Body Font:** Plus Jakarta Sans (fallback: `Inter, system-ui, sans-serif`)

**Character:** Geometris namun hangat dan ramah dibaca di layar ponsel maupun dokumen administratif. Satu keluarga font menjaga beban bundle rendah dan konsistensi antarhalaman publik serta admin.

### Hierarchy

- **Display** (`700`, `2rem` / `32px`, line-height `1.2`, tracking `-0.025em`): Judul halaman utama publik dan judul verifikasi dokumen.
- **Headline** (`600`, `1.5rem` / `24px`, line-height `1.3`, tracking `-0.02em`): Judul seksi utama dan judul halaman admin.
- **Title** (`600`, `1.125rem` / `18px`, line-height `1.4`, tracking `-0.01em`): Judul kartu kegiatan, judul panel formulir, dan judul dialog.
- **Body** (`400`, `0.9375rem` / `15px` desktop, `1rem` / `16px` input mobile, line-height `1.6`): Paragraf deskripsi, panduan, dan nilai isian data. Panjang baris maksimal `65–75ch`.
- **Label** (`500`, `0.8125rem` / `13px`, line-height `1.4`, tracking `0.01em`): Label field formulir, tombol, badge status, dan metadata tanggal/lokasi.

### Named Rules

**The Tabular Numerals Rule.** Seluruh statistik bulanan, nomor urut sertifikat, penghitung kuota, dan stempel waktu wajib menggunakan `font-variant-numeric: tabular-nums` agar kolom angka sejajar dan tidak bergeser saat nilai diperbarui.

**The No-Eyebrow Rule.** Jangan menambahkan label kicker/eyebrow kecil di atas setiap judul seksi; biarkan judul utama membawa bobot hierarkinya sendiri.

## Layout

ECER menggunakan skala spasi berbasis **4px** (`4`, `8`, `12`, `16`, `24`, `32`, `48`, `64`) dengan whitespace sebagai pemisah visual utama.

- **Max content width (Publik):** `1280px` terpusat dengan padding horizontal responsif (`16px` mobile, `24px` tablet, `32px` desktop).
- **Responsive breakpoints:**
  - Mobile small: `320px–479px` (1 kolom, header ringkas, tombol full-width pada aksi utama formulir).
  - Mobile: `480px–639px` (1 kolom).
  - Tablet: `640px–1023px` (2 kolom kartu kegiatan).
  - Desktop: `1024px–1439px` (3 kolom kartu kegiatan; admin menggunakan sidebar collapsible + topbar).
  - Large desktop: `≥ 1440px` (maksimal 4 kolom jika keterbacaan kartu tetap terjaga).
- **Publik vs Admin:** Halaman publik tidak memakai hero marketing satu layar penuh dan tidak memakai pola ERP. Halaman admin menggunakan sidebar collapsible di desktop dan drawer di mobile, serta menghindari pemaksaan tabel lebar pada layar ponsel.

## Elevation & Depth

Sistem ini menganut **permukaan datar berbatas halus (flat with subtle border)** sebagai default. Kedalaman ditunjukkan melalui kontras permukaan `Canvas` (`#F5F7F6`) terhadap `Surface` (`#FFFFFF`) dan garis tepi `1px solid #DFE7E2`.

### Shadow Vocabulary

- **Subtle Lift** (`box-shadow: 0 1px 2px rgba(18, 63, 56, 0.06)`): Digunakan secara minimal pada kartu interaktif saat hover atau kontrol sticky.
- **Overlay Elevation** (`box-shadow: 0 10px 25px -5px rgba(18, 63, 56, 0.12)`): Digunakan hanya untuk dropdown, popover, toast, dan dialog konfirmasi.

### Named Rules

**The Flat-By-Default Rule.** Kartu, panel formulir, dan kotak statistik tampil datar tanpa bayangan berat pada kondisi diam. Hindari nested cards berlapis-lapis; gunakan pembatas garis tipis (`1px solid #DFE7E2`) atau spasi vertikal (`16px–24px`) di dalam kartu.

## Shapes

- **Small (`6px`)**: Checkbox, chip kecil, tombol ikon kompak, dan elemen mikro.
- **Medium (`8px`)**: Tombol utama/sekunder, input teks, select, dan alert inline.
- **Large (`12px`)**: Kartu kegiatan, panel formulir, dan dialog.
- **Pill (`9999px`)**: Hanya untuk badge status dan indikator ringkas.
- **Flyer thumbnail**: Rasio konsisten `16:9` dengan `object-fit` yang menjaga informasi poster tidak terdistorsi.

## Components

Komponen dirancang dengan karakter **tenang, tegas, dan mudah disentuh** menggunakan semantic CSS variables (`--color-*`, `--radius-*`, `--space-*`).

### Buttons

- **Shape:** Radius medium (`8px`), tinggi minimal `44px` untuk kontrol utama.
- **Primary:** Latar Primary Green (`#23634E`), teks Surface (`#FFFFFF`), padding `10px 16px`. Hover beralih ke Primary Forest (`#123F38`) dengan transisi `180ms ease-out`.
- **Secondary:** Latar Surface (`#FFFFFF`), border `1px solid #DFE7E2`, teks Text Primary (`#203F35`). Hover menggunakan latar halus `#F5F7F6`.
- **Focus:** Focus ring jelas (`2px solid #23634E` dengan `outline-offset: 2px`) yang muncul melalui `:focus-visible`.

### Cards / Containers

- **Corner Style:** Radius besar (`12px`).
- **Background:** Surface (`#FFFFFF`) di atas Canvas (`#F5F7F6`).
- **Border:** `1px solid #DFE7E2`.
- **Internal Padding:** `16px` pada mobile, `24px` pada tablet/desktop.

### Inputs / Fields

- **Style:** Latar Surface (`#FFFFFF`), border `1px solid #DFE7E2`, radius medium (`8px`), tinggi minimal `44px`, font-size minimal `16px` pada mobile.
- **Label:** Selalu terlihat di atas field (jangan mengandalkan placeholder sebagai pengganti label).
- **Focus:** Border berubah ke Primary Green (`#23634E`) dengan ring fokus lembut.
- **Error:** Border Danger (`#B91C1C`) disertai pesan error inline di bawah field yang terhubung melalui `aria-describedby`.

### Status Badges

- **Style:** Radius pill (`9999px`), padding `4px 10px`, font Label (`13px`, weight `500`), latar tint lembut (misalnya Accent Mint `#D9EBE0` dengan teks `#123F38` untuk aktif/sehat).

### Motion

- Transisi CSS ringan berdurasi `150–250ms` untuk hover, focus, dan perpindahan panel.
- Wajib menghormati `@media (prefers-reduced-motion: reduce)`.

## Do's and Don'ts

### Do:

- **Do** gunakan semantic CSS variables dari `src/styles/tokens.css` agar tema konsisten di seluruh komponen.
- **Do** sediakan loading state, empty state, error state, success state, dan disabled state pada setiap tampilan data.
- **Do** gunakan Bahasa Indonesia yang ramah masyarakat pada seluruh halaman publik (_Isi Data Sertifikat_, _Cari Sertifikat_, _Unduh Sertifikat_).
- **Do** pertahankan touch target minimal `44px` dan uji keterbacaan mulai viewport `320px`.
- **Do** gunakan ikon garis konsisten dari `lucide-react` hanya jika membantu pemindaian.

### Don't:

- **Don't** gunakan dominasi warna ungu, gradasi biru-ungu, warna neon, atau gradient text.
- **Don't** gunakan excessive glassmorphism, bayangan tebal, atau kartu bersarang (nested cards).
- **Don't** gunakan emoji sebagai ikon utama antarmuka.
- **Don't** buat hero marketing setinggi satu layar penuh pada dashboard publik.
- **Don't** tampilkan jargon teknis (seperti nama tabel, stack trace, atau kode internal mentah) kepada peserta.
