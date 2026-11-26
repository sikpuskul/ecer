# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript (strict) + Tailwind CSS di frontend; Cloudflare Workers + Static Assets + Hono + Zod + Cloudflare D1 + Cloudflare R2 + Cloudflare Turnstile di backend; Google Apps Script + Google Docs + Google Drive + MailApp sebagai document generation & email engine (ditetapkan pada `PRD.md`).

## Users

1. **Peserta kegiatan (publik, tanpa akun)**: kader kesehatan, lintas sektor, lintas program, peserta pelatihan/workshop/sosialisasi/seminar, dan masyarakat umum. Mengakses melalui smartphone (sering menggunakan jaringan WiFi puskesmas dengan IP publik bersama), tablet, atau desktop untuk mengisi data sertifikat, memantau status penerbitan, mencari/mengunduh sertifikat miliknya, dan memverifikasi keaslian dokumen via QR Code.
2. **Administrator Puskesmas (multi-admin dengan hak akses setara)**: panitia atau pengelola administrasi Puskesmas Sumbermanjing Kulon yang mengelola kegiatan, template Google Docs, formulir dinamis, validasi kehadiran/approval, penerbitan sertifikat dan piagam, pemantauan job/email, laporan, serta audit log.

## Product Purpose

ECER adalah aplikasi web pengelolaan, penerbitan, distribusi, pencarian, pengunduhan mandiri, dan verifikasi keaslian sertifikat serta piagam penghargaan digital untuk **Puskesmas Sumbermanjing Kulon**.

Aplikasi ini menggantikan pembuatan sertifikat manual dengan alur terstandar, mencegah duplikasi peserta dan nomor dokumen, menyediakan arsip kegiatan terpusat, dan menjaga biaya operasional infrastruktur seminimal mungkin.

## Positioning

Satu origin terpadu yang menggabungkan pengalaman peserta tanpa login (mobile-first, berbahasa sederhana, privasi terlindungi) dengan mesin template Google Docs yang sudah akrab bagi staf puskesmas — tanpa menjadikan Google Drive publik dan tanpa menjadikan Apps Script sebagai database utama.

## Operating Context

- **Instansi**: Puskesmas Sumbermanjing Kulon (single organization).
- **Skala awal**: rata-rata maksimal 100 peserta per kegiatan.
- **Bahasa & zona waktu**: Bahasa Indonesia; penyimpanan timestamp dalam UTC, tampilan dan input dalam `Asia/Jakarta` (WIB).
- **Dokumen**: Sertifikat (terbuka bagi peserta kegiatan sesuai periode & validasi) dan Piagam Penghargaan (hanya diterbitkan admin, tidak tampil di dashboard publik, dapat diverifikasi via QR Code).
- **Distribusi**: Unduhan terotorisasi melalui backend (recovery code atau email OTP) serta pengiriman email lampiran PDF via Google Apps Script `MailApp` (dengan manajemen kuota harian akun Gmail personal).

## Capabilities and Constraints

- **Single source of truth**: Cloudflare D1 untuk seluruh data relasional dan job durable; Google Drive privat untuk snapshot template dan PDF; Cloudflare R2 untuk flyer dan aset ringan.
- **Tanpa akun peserta**: Akses PDF wajib melalui verifikasi tambahan (search key + recovery code atau email OTP) dengan temporary download grant berbasis cookie `HttpOnly`.
- **Out of scope v1**: Multi-tenant antarinstansi, aplikasi native Android/iOS, pembayaran online, LMS, absensi pegawai, video conference, drag-and-drop certificate designer, tanda tangan elektronik tersertifikasi (QR Code adalah verifikasi penerbitan, bukan TTE), dan integrasi WhatsApp API.
- **Terminologi publik**: Gunakan bahasa yang ramah masyarakat (_Isi Data Sertifikat_, _Cari Sertifikat_, _Unduh Sertifikat_, _Menunggu persetujuan panitia_); hindari jargon teknis pada halaman peserta.

## Brand Commitments

- **Nama aplikasi**: ECER — Sertifikat dan Piagam Digital.
- **Instansi penerbit**: Puskesmas Sumbermanjing Kulon.
- **Arah visual mengikat (`PRD.md` §29)**: _Modern Healthcare Editorial_ — profesional, hangat, bersih, natural, tidak generik AI, tanpa dominasi warna ungu, menggunakan palet hijau hutan puskesmas (`#123F38`, `#23634E`, `#D9EBE0`) dan tipografi tunggal `Plus Jakarta Sans`.

## Evidence on Hand

- Spesifikasi kebutuhan lengkap dan disetujui tersedia di `PRD.md` (v1.0.0).
- Aset logo resmi Puskesmas Sumbermanjing Kulon dan contoh flyer kegiatan belum tersedia di repository (wajib disediakan pemilik proyek; jangan memalsukan logo resmi).

## Product Principles

1. **Keamanan dan privasi sejak desain**: Minimalkan pengumpulan NIK, enkripsi data sensitif, cegah enumerasi, dan jangan pernah mengekspos file Google Drive secara publik.
2. **Kebenaran di sisi server**: Semua aturan periode, kuota, keunikan peserta, dan penomoran atomik ditegakkan oleh backend.
3. **Kemudahan bagi masyarakat**: Peserta dapat menyelesaikan pendaftaran dan pengunduhan sertifikat di layar ponsel kecil tanpa akun dan tanpa kebingungan teknis.
4. **Ketahanan terhadap batas kuota eksternal**: Kegagalan atau habisnya kuota email tidak boleh menggagalkan penyimpanan peserta maupun penerbitan PDF.
5. **Efisiensi biaya tanpa kompromi keamanan**: Maksimalkan Cloudflare Workers/D1/R2 Free Tier, namun jadikan keamanan kriptografi sebagai syarat mutlak.

## Accessibility & Inclusion

- Target kepatuhan: **WCAG 2.2 AA**.
- Dukungan penuh untuk perangkat mobile mulai dari viewport `320px`, touch target minimal `44px`, input mobile minimal `16px` (mencegah auto-zoom iOS), navigasi keyboard, visible focus, `prefers-reduced-motion`, dan indikator status yang tidak hanya bergantung pada warna.
