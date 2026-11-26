
# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# ECER
Sertifikat dan Piagam Digital
Puskesmas Sumbermanjing Kulon

- Version: 1.0.0
- Status: Approved Requirements
- Project type: Full-stack web application
- Architecture: Modular Feature-Based Monorepo
- Target: Production Ready
- Language: Bahasa Indonesia
- Timezone: Asia/Jakarta

---

# 1. PROJECT OVERVIEW

ECER merupakan aplikasi berbasis web untuk mengelola,
menerbitkan, mendistribusikan, mencari, mengunduh, dan
memverifikasi sertifikat serta piagam penghargaan digital
yang diterbitkan oleh Puskesmas Sumbermanjing Kulon.

Aplikasi digunakan untuk kegiatan seperti:

- Pelatihan kader kesehatan.
- Pertemuan lintas sektoral.
- Pertemuan lintas program.
- Workshop.
- Sosialisasi kesehatan.
- Seminar.
- Bimbingan teknis.
- Penghargaan kader.
- Penghargaan mitra puskesmas.
- Kegiatan internal dan eksternal lainnya.

Peserta dapat mengisi formulir dan memperoleh sertifikat
tanpa membuat akun aplikasi.

Administrator dapat mengelola kegiatan, template Google
Docs, formulir dinamis, penomoran dokumen, data peserta,
piagam, pengiriman email, dan laporan.

Dokumen dibuat menggunakan Google Docs melalui Google
Apps Script, diekspor menjadi PDF, dan disimpan secara
private di Google Drive.

Cloudflare bertindak sebagai infrastruktur utama aplikasi.

---

# 2. PRODUCT OBJECTIVES

## 2.1 Tujuan utama

1. Mengurangi pekerjaan manual pembuatan sertifikat.
2. Mempercepat distribusi sertifikat kepada peserta.
3. Memungkinkan peserta mengunduh sertifikat secara mandiri.
4. Menstandarkan penerbitan sertifikat dan piagam.
5. Mencegah duplikasi dokumen dan nomor sertifikat.
6. Menyediakan arsip kegiatan terpusat.
7. Mempermudah verifikasi keaslian dokumen.
8. Meminimalkan biaya operasional infrastruktur.
9. Membangun aplikasi yang mudah dipelihara dan dikembangkan.
10. Menyediakan antarmuka modern, responsif dan aksesibel.

## 2.2 Target penggunaan

- Single organization: satu puskesmas.
- Multi-admin dengan hak akses yang sama.
- Rata-rata maksimal 100 peserta per kegiatan.
- Dashboard peserta bersifat publik.
- Tidak membutuhkan akun peserta.
- Dapat digunakan melalui smartphone, tablet, laptop,
  maupun desktop.

## 2.3 Out of scope versi pertama

- Multi-tenant antarinstansi.
- Aplikasi native Android dan iOS.
- Pembayaran online.
- LMS atau Learning Management System.
- Sistem absensi pegawai.
- Video conference.
- Visual certificate designer berbasis drag and drop.
- Tanda tangan elektronik tersertifikasi.
- Integrasi WhatsApp API.

QR Code berfungsi sebagai verifikasi penerbitan dokumen,
bukan pengganti tanda tangan elektronik tersertifikasi.

---

# 3. TECHNOLOGY STACK

## 3.1 Frontend

- React.
- TypeScript dengan strict mode.
- Vite.
- React Router.
- Tailwind CSS.
- shadcn/ui dengan komponen yang digunakan saja.
- Lucide React.
- React Hook Form.
- Zod.
- TanStack Query.

Gunakan versi stabil yang kompatibel.

Jangan menggunakan versi experimental, beta, atau canary
tanpa persetujuan pemilik proyek.

## 3.2 Backend

- Cloudflare Workers.
- Hono Framework.
- TypeScript.
- REST API.
- Zod server-side validation.
- Cloudflare D1.
- Cloudflare R2.
- Cloudflare Turnstile.
- Cloudflare Cron Triggers jika diperlukan.

## 3.3 Document generation engine

- Google Apps Script.
- Google Docs.
- Google Drive.
- MailApp.
- LockService.
- PropertiesService.

Gunakan Google Apps Script hanya untuk:

- Membaca template Google Docs.
- Ekstraksi placeholder.
- Membuat snapshot template.
- Mengganti placeholder.
- Membuat dokumen sementara.
- Menambahkan QR Code.
- Mengekspor PDF.
- Menyimpan PDF.
- Mengambil PDF untuk distribusi.
- Mengirim email.
- Mengelola file Google Drive yang menjadi tanggung jawabnya.

Jangan menjadikan Apps Script sebagai database utama.

## 3.4 Development tools

- VS Code.
- Codex atau Antigravity.
- Git.
- GitHub.
- npm.
- Wrangler CLI.
- Google CLASP.
- ESLint.
- Prettier.
- Vitest.
- Playwright.

## 3.5 Deployment

Gunakan Cloudflare Workers + Static Assets.

Frontend hasil build Vite dilayani melalui Static Assets.

Backend menggunakan route /api/v1/*.

Konfigurasi SPA fallback tidak boleh mengintersepsi API.

Gunakan single origin untuk frontend dan API agar
pengaturan cookie, CORS, dan autentikasi lebih sederhana.

## 3.6 Environments

- Local development.
- Staging.
- Production.

Setiap environment harus memiliki:

- D1 database terpisah.
- R2 bucket terpisah.
- Secret terpisah.
- Google Drive folder terpisah.
- Apps Script deployment yang sesuai.
- Konfigurasi email yang sesuai.

Staging tidak boleh mengirim email kepada peserta asli.

---

# 4. SYSTEM ARCHITECTURE

Browser
  |
  v
Cloudflare Workers + Static Assets
  |
  +-- React Frontend
  |
  +-- Hono REST API
       |
       +-- Authentication Service
       +-- Event Management Service
       +-- Template Service
       +-- Dynamic Form Service
       +-- Participant Service
       +-- Certificate Service
       +-- Award Service
       +-- Numbering Service
       +-- Verification Service
       +-- Job Service
       +-- Email Service
       +-- Reporting Service
       |
       +-- Cloudflare D1
       +-- Cloudflare R2
       |
       +-- Signed Apps Script Integration
            |
            +-- Google Docs
            +-- Google Drive
            +-- MailApp

## 4.1 Architecture principles

- D1 merupakan single source of truth.
- Frontend tidak mengakses database secara langsung.
- Frontend tidak mengakses Apps Script secara langsung.
- Semua business rules divalidasi oleh backend.
- Semua integrasi eksternal melalui dedicated adapter.
- Google Drive hanya menyimpan template dan file dokumen.
- R2 hanya digunakan untuk flyer dan aset aplikasi.
- Jangan menyimpan binary PDF dalam D1.
- Jangan menyimpan base64 PDF secara permanen dalam D1.
- Jangan menggunakan Google Drive public sharing untuk PDF.
- Gunakan asynchronous job untuk operasi yang lambat.
- Gunakan idempotency untuk mencegah penerbitan ganda.
- Operasi generation dan email harus independen.

---

# 5. USER ROLES

## 5.1 Public visitor / peserta

Tidak membutuhkan login.

Hak akses:

- Melihat dashboard publik.
- Melihat statistik kegiatan.
- Memilih bulan dan tahun.
- Mencari kegiatan.
- Melihat detail kegiatan.
- Mengisi formulir sertifikat.
- Melakukan validasi kehadiran.
- Melihat status penerbitan miliknya.
- Preview sertifikat miliknya.
- Mengunduh sertifikat miliknya.
- Mencari sertifikat melalui key yang ditentukan.
- Memverifikasi keaslian dokumen melalui QR Code.

Tidak diperbolehkan:

- Melihat daftar peserta.
- Mengakses data peserta lain.
- Melakukan perubahan data setelah submit.
- Membuat piagam.
- Mengakses dashboard admin.
- Mengakses Google Drive file secara langsung.
- Mengunduh sertifikat di luar periode yang berlaku.

## 5.2 Administrator

Semua administrator memiliki hak akses yang sama.

Hak akses:

- Login dan logout.
- Mengelola akun administrator.
- Mengelola kegiatan.
- Mengelola template.
- Mengelola formulir.
- Mengelola data peserta.
- Mengelola whitelist peserta.
- Memverifikasi peserta.
- Membuat sertifikat.
- Membuat piagam.
- Melakukan bulk generation.
- Mengoreksi data peserta.
- Regenerate dokumen.
- Mencabut dokumen.
- Mengirim dan mengirim ulang email.
- Mengelola nomor dokumen.
- Mengelola laporan.
- Export Excel dan CSV.
- Mengelola pengaturan aplikasi.
- Mengelola retensi data.
- Melihat audit log.

Administrator tidak boleh:

- Menghapus atau menonaktifkan akun admin aktif terakhir.
- Melihat password asli administrator lain.
- Melihat nilai secret integrasi melalui dashboard.
- Menghapus audit log melalui fitur CRUD biasa.

---

# 6. INFORMATION ARCHITECTURE

## 6.1 Public pages

/
  Dashboard publik.

/kegiatan/:slug
  Detail kegiatan.

/kegiatan/:slug/daftar
  Formulir sertifikat dinamis.

/kegiatan/:slug/status
  Status pengajuan dengan session/token yang sah.

/kegiatan/:slug/cari
  Pencarian sertifikat.

/sertifikat/preview/:publicId
  Preview yang membutuhkan otorisasi akses.

/verifikasi/:verificationCode
  Verifikasi keaslian sertifikat dan piagam.

/panduan
  Panduan penggunaan.

/privasi
  Kebijakan privasi.

/admin/login
  Halaman login administrator.

## 6.2 Admin pages

/admin
  Dashboard administrator.

/admin/kegiatan
  Daftar kegiatan.

/admin/kegiatan/baru
  Membuat kegiatan.

/admin/kegiatan/:id
  Detail dan pengelolaan kegiatan.

/admin/kegiatan/:id/edit
  Edit kegiatan.

/admin/kegiatan/:id/formulir
  Dynamic form builder.

/admin/kegiatan/:id/peserta
  Daftar peserta.

/admin/kegiatan/:id/sertifikat
  Sertifikat kegiatan.

/admin/kegiatan/:id/piagam
  Piagam kegiatan.

/admin/template
  Library template.

/admin/template/baru
  Import template.

/admin/template/:id
  Detail dan konfigurasi template.

/admin/sertifikat
  Seluruh sertifikat.

/admin/piagam
  Seluruh piagam.

/admin/piagam/baru
  Generate piagam.

/admin/email
  Email delivery monitor.

/admin/jobs
  Monitoring generation jobs.

/admin/penomoran
  Pengaturan penomoran.

/admin/laporan
  Statistik dan export.

/admin/pengguna
  Manajemen administrator.

/admin/pengaturan
  Pengaturan aplikasi.

/admin/audit-log
  Riwayat aktivitas administrator.

Gunakan lazy loading untuk route administrator.

Jangan memuat seluruh modul admin pada dashboard publik.

---

# 7. PUBLIC DASHBOARD

## 7.1 Header

Tampilkan:

- Logo puskesmas.
- Nama aplikasi.
- Nama instansi.
- Navigasi kegiatan.
- Panduan.
- Tombol login administrator.

Jangan membuat halaman publik seperti dashboard ERP.

Gunakan layout publik yang sederhana dan mudah dipahami.

## 7.2 Month and year navigation

Dashboard secara default menampilkan bulan dan tahun
berjalan berdasarkan timezone Asia/Jakarta.

Komponen navigasi:

- Tombol bulan sebelumnya.
- Nama bulan dan tahun.
- Tombol bulan berikutnya.
- Month/year picker.
- Tombol kembali ke bulan sekarang.

Contoh:

  < Oktober 2026 >     [Bulan ini]

Navigasi harus mendukung perpindahan tahun secara otomatis.

Desember 2026 berikutnya menjadi Januari 2027.

Simpan pilihan bulan dan tahun melalui URL query parameter.

Contoh:

  /?month=11&year=2026

Kegiatan yang memiliki beberapa hari ditampilkan apabila
rentang tanggal kegiatan beririsan dengan bulan terpilih.

## 7.3 Monthly statistics

Tampilkan tiga indikator:

1. Total kegiatan yang telah dipublikasikan.
2. Total kegiatan yang sedang aktif menerima pendaftaran
   atau menyediakan pengunduhan.
3. Total sertifikat yang berhasil diterbitkan dan tidak
   dicabut untuk kegiatan pada bulan terpilih.

Statistik mengikuti filter bulan dan tahun.

Sertifikat yang diregenerate tidak dihitung sebagai
sertifikat tambahan.

Piagam tidak dimasukkan dalam statistik publik.

Jelaskan definisi statistik dalam tooltip atau info singkat.

## 7.4 Event filters

- Search nama kegiatan.
- Filter jenis kegiatan.
- Filter status kegiatan.
- Filter bulan dan tahun.
- Reset filter.

Gunakan pagination apabila jumlah kegiatan meningkat.

Gunakan server-side filtering.

## 7.5 Event card

Setiap kegiatan ditampilkan dalam bentuk kartu.

Elemen kartu:

- Flyer atau foto kegiatan.
- Jenis kegiatan.
- Status kegiatan.
- Judul kegiatan.
- Tanggal kegiatan.
- Lokasi kegiatan jika tersedia.
- Periode pengisian.
- Periode pengunduhan.
- Informasi kuota jika admin mengaktifkannya.
- Tombol isi data sertifikat.
- Input pencarian sertifikat.
- Tombol cari sertifikat.

Input pencarian menggunakan label dinamis berdasarkan
key yang ditentukan administrator.

Contoh:

  Masukkan NIK
  Masukkan nomor peserta
  Masukkan kode registrasi

Setelah key ditemukan, lakukan verifikasi tambahan
sebelum memberikan akses PDF.

Gunakan thumbnail dengan aspect ratio konsisten.

Flyer tidak boleh terdistorsi.

Sediakan placeholder image apabila flyer belum tersedia.

## 7.6 Event card states

UPCOMING:

- Kartu ditampilkan jika sudah dipublikasikan.
- Tombol isi data disabled apabila belum masuk periode.
- Tombol pencarian disabled jika belum masuk periode unduh.

ACTIVE:

- Tombol isi data aktif jika periode pengisian terbuka.
- Tombol pencarian aktif jika periode unduh terbuka.

REGISTRATION_CLOSED:

- Tombol isi data disabled.
- Tombol pencarian tetap aktif jika periode unduh terbuka.

QUOTA_FULL:

- Tombol isi data disabled.
- Pencarian tetap tersedia dalam periode pengunduhan.

CLOSED:

- Kartu tetap ditampilkan pada bulan kegiatan.
- Tombol isi data disabled.
- Tombol pencarian disabled.
- Tampilkan alasan penutupan.

ARCHIVED:

- Tetap tampil sebagai riwayat publik jika kegiatan
  sebelumnya telah dipublikasikan.
- Semua tindakan publik disabled.
- Admin tetap dapat melihat arsip sesuai retensi data.

DRAFT:

- Tidak boleh ditampilkan pada dashboard publik.

Status tombol tidak boleh hanya ditentukan oleh frontend.

Backend harus menolak request yang melanggar periode
atau status kegiatan.

---

# 8. EVENT MANAGEMENT

## 8.1 Event fields

Data kegiatan minimal:

- ID kegiatan.
- Slug unik.
- Judul kegiatan.
- Jenis kegiatan.
- Deskripsi.
- Penyelenggara.
- Lokasi kegiatan.
- Flyer.
- Tanggal mulai kegiatan.
- Tanggal selesai kegiatan.
- Waktu publikasi.
- Waktu mulai pengisian.
- Waktu akhir pengisian.
- Waktu mulai pengunduhan.
- Waktu akhir pengunduhan.
- Kuota peserta.
- Metode validasi peserta.
- Metode penerbitan sertifikat.
- Template sertifikat.
- Template piagam.
- Konfigurasi pencarian sertifikat.
- Konfigurasi penomoran.
- Konfigurasi email.
- Status publikasi.
- Created by.
- Updated by.
- Created at.
- Updated at.

## 8.2 Event categories

Kategori dapat dikelola administrator.

Seed kategori awal:

- Pelatihan.
- Workshop.
- Sosialisasi.
- Seminar.
- Pertemuan lintas sektor.
- Pertemuan lintas program.
- Bimbingan teknis.
- Penghargaan.
- Lainnya.

Jangan hardcode kategori pada komponen frontend.

## 8.3 Lifecycle

Gunakan status lifecycle yang tersimpan:

- draft
- published
- closed
- archived

Status scheduled, active, registration_closed,
download_only, dan completed dihitung berdasarkan
timestamp dan konfigurasi kegiatan.

Jangan menggunakan cron sebagai satu-satunya mekanisme
untuk menentukan status kegiatan.

Semua API publik harus menghitung eligibility aktual
pada saat request diterima.

## 8.4 Time rules

Gunakan UTC untuk penyimpanan timestamp.

Gunakan Asia/Jakarta untuk tampilan dan input admin.

Gunakan interval waktu:

  start_at <= now < end_at

Periode pengisian dan pengunduhan terpisah.

Admin dapat menutup kegiatan secara manual kapan saja.

Penutupan manual mengesampingkan semua periode publik.

Admin dapat membuka kembali kegiatan melalui tindakan
yang tercatat dalam audit log.

Perubahan periode harus langsung berlaku di backend.

## 8.5 Event duplication

Administrator dapat menduplikasi kegiatan.

Data yang disalin:

- Informasi dasar.
- Konfigurasi formulir.
- Template references.
- Pengaturan penerbitan.
- Pengaturan pencarian.
- Pengaturan penomoran.
- Konfigurasi email.

Data yang tidak boleh disalin:

- Peserta.
- Dokumen terbit.
- Nomor yang sudah digunakan.
- Audit log.
- Job.
- Riwayat email.
- PIN kegiatan lama.

Hasil duplikasi selalu berstatus draft.

---

# 9. ATTENDANCE VALIDATION

Admin dapat memilih metode validasi per kegiatan.

## 9.1 Open registration

Peserta dapat langsung mengisi formulir tanpa validasi
kehadiran tambahan.

Tetap gunakan Turnstile, rate limiting, dan duplicate check.

## 9.2 Event PIN

Admin menentukan PIN kegiatan.

PIN diberikan panitia kepada peserta ketika kegiatan
berlangsung.

PIN harus:

- Disimpan dalam bentuk hash.
- Tidak dikirim dalam response API publik.
- Memiliki rate limit percobaan.
- Dapat diganti oleh administrator.

Jangan mencatat PIN asli dalam log.

## 9.3 Participant whitelist

Admin dapat:

- Menambahkan peserta manual.
- Mengimpor CSV atau Excel.
- Memilih field yang menjadi whitelist key.
- Melihat status penggunaan whitelist.
- Menghapus whitelist yang belum digunakan.

Contoh whitelist key:

- NIK.
- Nomor peserta.
- Nomor registrasi.
- Email.

Whitelist harus diperiksa sebelum data peserta diterima.

## 9.4 Manual approval

Peserta mengisi formulir.

Pengajuan masuk ke status pending_review.

Administrator dapat:

- Approve.
- Reject.
- Melihat detail.
- Mengoreksi data sebelum approval.
- Memberikan alasan penolakan.

Approval adalah metode penerbitan, terpisah dari metode
validasi kehadiran.

## 9.5 Participant quota

Kuota dapat diaktifkan atau dinonaktifkan.

Jika aktif:

- Default rekomendasi: 100 peserta.
- Pengajuan yang diterima, termasuk pending review,
  menggunakan satu slot kuota.
- Penolakan atau pembatalan sebelum sertifikat diterbitkan
  dapat melepaskan slot.
- Pengajuan duplikat tidak menambah kuota.

Gunakan operasi database atomik atau conditional writes
untuk mencegah overbooking akibat concurrent requests.

---

# 10. GOOGLE DOCS TEMPLATE MANAGEMENT

## 10.1 Template types

- certificate
- award

Library template bersifat reusable.

Satu template dapat digunakan pada beberapa kegiatan.

Satu kegiatan dapat menggunakan beberapa template.

Template sertifikat dan piagam tidak boleh tertukar.

## 10.2 Import workflow

1. Admin memilih tambah template.
2. Admin memasukkan nama template.
3. Admin memilih jenis template.
4. Admin memasukkan URL Google Docs.
5. Backend melakukan validasi format URL.
6. Backend mengambil document ID.
7. Backend meminta Apps Script membaca dokumen.
8. Apps Script memeriksa izin akses.
9. Apps Script mengekstrak placeholder.
10. Backend menyimpan hasil ekstraksi.
11. Admin mengonfigurasi mapping field.
12. Admin melakukan test generation.
13. Template dapat dipublikasikan.

Jangan mengambil URL arbitrer dari input pengguna.

Hanya izinkan format URL Google Docs yang valid.

Gunakan document ID sebagai parameter integrasi.

## 10.3 Placeholder syntax

Gunakan format:

  {{nama_lengkap}}
  {{nik}}
  {{nomor_sertifikat}}
  {{nama_kegiatan}}
  {{tanggal_kegiatan}}
  {{instansi}}
  {{jabatan}}
  {{nama_kepala_puskesmas}}
  {{qr_code}}

Standar placeholder:

- lowercase.
- snake_case.
- Tidak menggunakan spasi.
- Tidak menggunakan karakter khusus selain underscore.
- Panjang nama dibatasi.
- Placeholder tidak boleh dieksekusi sebagai kode.
- Placeholder yang sama dapat muncul lebih dari sekali.

Pola:

  \{\{([a-z][a-z0-9_]{0,63})\}\}

## 10.4 Placeholder detection

Deteksi placeholder pada:

- Body.
- Paragraph.
- Table.
- Table cell.
- Header.
- Footer.
- Document tabs yang didukung.

Untuk versi awal, gunakan template Google Docs single-tab
agar hasil rendering dan ekspor konsisten.

Placeholder harus ditulis dalam satu text run dengan
format yang konsisten.

Jika placeholder terpecah oleh perubahan format yang
tidak didukung, tampilkan warning pada template validation.

Sistem harus mendeteksi placeholder yang tidak valid,
belum memiliki mapping, atau tidak dapat dirender.

Google Docs drawing dan text di dalam gambar bukan
placeholder yang dapat diedit secara otomatis.

## 10.5 Placeholder sources

Setiap placeholder memiliki source:

- participant_input
- event_data
- admin_input
- static_value
- system_generated
- document_number
- verification_qr

Contoh:

| Placeholder | Source |
|-------------|--------|
| nama_lengkap | participant_input |
| nik | participant_input |
| nama_kegiatan | event_data |
| tanggal_kegiatan | event_data |
| nama_kepala_puskesmas | static_value |
| nomor_sertifikat | document_number |
| tanggal_terbit | system_generated |
| qr_code | verification_qr |

Mapping harus menggunakan allowlist data yang tersedia.

Jangan menggunakan eval atau expression executor.

## 10.6 Template versioning

Setiap perubahan template menghasilkan versi baru.

Simpan:

- Template ID.
- Version number.
- Google Docs source ID.
- Google Docs snapshot ID.
- Placeholder schema.
- Created by.
- Created at.
- Validation status.

Ketika template dipublikasikan, buat snapshot Google Docs
yang dikelola aplikasi.

Dokumen yang sudah terbit harus menyimpan template_version_id.

Perubahan dokumen sumber tidak boleh diam-diam mengubah
dokumen yang telah diterbitkan.

Refresh template dilakukan secara manual oleh administrator.

## 10.7 Template test generation

Admin dapat melakukan test generation menggunakan dummy data.

Dokumen hasil pengujian harus:

- Tidak menggunakan nomor produksi.
- Tidak dihitung sebagai sertifikat terbit.
- Tidak dikirim ke peserta.
- Memiliki label preview/test.
- Dihapus sesuai kebijakan file sementara.

## 10.8 Multiple templates per event

Admin dapat menautkan beberapa template pada satu kegiatan.

Setiap template memiliki:

- Jenis dokumen.
- Nama kategori.
- Urutan.
- Eligibility rule.
- Status aktif.
- Versi template.

Contoh kategori:

- Peserta.
- Narasumber.
- Panitia.
- Moderator.
- Kader berprestasi.

Pemilihan template sertifikat harus ditentukan oleh aturan
kegiatan dan kategori peserta yang tervalidasi.

Peserta tidak boleh memilih kategori penghargaan atau
narasumber secara bebas jika kategori membutuhkan otorisasi.

Default: satu sertifikat per kategori yang diizinkan
untuk setiap peserta dalam satu kegiatan.

Piagam hanya dapat diterbitkan oleh administrator.

---

# 11. DYNAMIC FORM BUILDER

## 11.1 Overview

Form builder dibangun berdasarkan hasil ekstraksi
placeholder Google Docs.

Administrator dapat:

- Mengubah label field.
- Mengubah tipe field.
- Menambahkan deskripsi.
- Menambahkan placeholder input.
- Mengatur urutan.
- Mengatur required/optional.
- Mengatur validation rules.
- Menentukan pilihan dropdown.
- Menambahkan field manual.
- Mengatur default value.
- Menentukan field unique.
- Menentukan field pencarian.
- Menyembunyikan field yang bersumber dari sistem.
- Melihat preview formulir.

Tidak semua placeholder menjadi input peserta.

Placeholder dengan source system_generated, event_data,
static_value, dan document_number tidak boleh dapat
diubah oleh peserta.

## 11.2 Supported field types

- text
- textarea
- number
- email
- tel
- date
- select
- radio
- checkbox
- nik

Checkbox mendukung nilai boolean atau beberapa opsi.

Tipe NIK harus menggunakan string, bukan number.

## 11.3 Field properties

- id
- field_key
- label
- input_type
- source
- description
- placeholder
- required
- unique
- searchable
- sensitive
- options
- default_value
- min_length
- max_length
- min_value
- max_value
- pattern
- sort_order
- is_active

Field key harus stabil setelah formulir dipublikasikan.

Perubahan label tidak boleh merusak mapping data.

## 11.4 Additional fields

Admin dapat menambahkan field yang tidak ada dalam
template Google Docs.

Contoh:

- Email.
- NIK.
- Nomor telepon.
- Kode peserta.
- Persetujuan pemrosesan data.

Field tambahan digunakan untuk validasi, pencarian,
pengiriman email, dan pelaporan.

## 11.5 Validation

Frontend dan backend harus menggunakan shared schema
atau aturan validasi yang konsisten.

NIK:

- Tepat 16 digit.
- Disimpan sebagai string.
- Jangan mengklaim NIK valid secara kependudukan hanya
  karena jumlah digitnya benar.

Email:

- Validasi format.
- Trim whitespace.
- Verifikasi kepemilikan jika digunakan untuk recovery.
- Jangan menganggap pemeriksaan format sebagai verifikasi.

Nama:

- Mendukung spasi, gelar, tanda baca, dan karakter Unicode.
- Jangan otomatis mengubah seluruh nama menjadi uppercase
  kecuali mapping template memang mengaturnya.

Number:

- Harus memenuhi batas minimum dan maksimum.

Date:

- Validasi tanggal yang benar.

Options:

- Nilai harus cocok dengan pilihan yang diizinkan.

Regex yang ditentukan admin harus dibatasi agar tidak
menyebabkan excessive processing atau ReDoS.

Unknown fields harus ditolak atau diabaikan secara
konsisten oleh backend.

## 11.6 Form versioning

Setiap perubahan form yang telah dipublikasikan membuat
versi baru.

Participant submission menyimpan form_version_id.

Form yang sudah digunakan tidak boleh dimutasi secara
destruktif.

## 11.7 Form rendering

Form peserta menggunakan layout mobile-first.

- Label selalu terlihat.
- Required indicator jelas.
- Keyboard sesuai tipe input.
- Error tampil di bawah field.
- Fokus diarahkan ke field yang invalid.
- Jangan menghapus input ketika terjadi error jaringan.
- Tampilkan loading state saat submit.
- Cegah double submit.
- Tampilkan persetujuan pemrosesan data.
- Jangan menampilkan field admin kepada peserta.

Jangan menyimpan NIK atau data sensitif ke localStorage.

---

# 12. PARTICIPANT REGISTRATION

## 12.1 User workflow

1. Peserta membuka dashboard.
2. Peserta memilih kegiatan.
3. Peserta menekan tombol Isi Data Sertifikat.
4. Sistem memeriksa periode dan kuota.
5. Peserta menyelesaikan validasi kehadiran.
6. Peserta mengisi formulir.
7. Peserta menyetujui pemberitahuan privasi.
8. Peserta memeriksa kembali data.
9. Peserta melakukan submit.
10. Backend melakukan validasi.
11. Backend melakukan duplicate check.
12. Backend menyimpan pengajuan.
13. Sistem mengeluarkan recovery code.
14. Sistem memproses pengajuan sesuai issuance mode.
15. Peserta melihat status pengajuan.
16. Jika PDF berhasil, peserta dapat preview dan download
    apabila periode unduh telah dibuka.
17. Sistem mengirim PDF melalui email secara terpisah.

Recovery code harus dapat disimpan peserta dan tidak
ditampilkan kembali secara publik.

## 12.2 Duplicate prevention

Admin menentukan unique key per kegiatan.

Default rekomendasi: NIK jika benar-benar diperlukan.

Alternatif:

- Nomor peserta.
- Nomor registrasi.
- Email.

Gunakan normalized value.

Gunakan keyed HMAC untuk unique lookup key yang sensitif.

Buat unique database constraint:

  event_id + unique_key_hash

Jangan hanya memeriksa duplikat dengan SELECT dari frontend.

Jika data sudah terdaftar:

- Jangan membuat peserta baru.
- Jangan membuat nomor dokumen baru.
- Tampilkan pesan generik.
- Arahkan ke recovery atau hubungi administrator.

Response tidak boleh memudahkan enumerasi NIK peserta.

## 12.3 Submission statuses

- submitted
- pending_review
- approved
- rejected
- cancelled

Status pengajuan harus terpisah dari status PDF
dan status email.

## 12.4 Data correction

Peserta tidak dapat memperbarui data sendiri.

Administrator dapat:

- Mengoreksi data.
- Melihat riwayat perubahan.
- Memperbarui unique lookup key setelah validasi.
- Regenerate sertifikat.

Perubahan data peserta harus tercatat dalam audit log.

---

# 13. CERTIFICATE GENERATION

## 13.1 Issuance modes

AUTO:

Sertifikat diterbitkan setelah submission dan validasi
kehadiran berhasil.

MANUAL_APPROVAL:

Sertifikat diterbitkan setelah administrator menyetujui
pengajuan.

Admin memilih issuance mode per kegiatan.

## 13.2 Generation workflow

1. Participant submission diterima.
2. Eligibility dan status diperiksa.
3. Sistem menentukan template yang digunakan.
4. Sistem menentukan nomor sertifikat.
5. Sistem membuat document record.
6. Sistem membuat unique verification code.
7. Sistem membuat generation job.
8. Job diklaim secara atomik oleh processor.
9. Worker mengirim signed request ke Apps Script.
10. Apps Script membuka snapshot template.
11. Apps Script membuat salinan sementara.
12. Apps Script mengganti semua placeholder.
13. Apps Script menambahkan QR Code.
14. Apps Script menyimpan perubahan Google Docs.
15. Apps Script mengekspor PDF.
16. PDF disimpan ke private Google Drive folder.
17. Apps Script mencatat hasil berdasarkan job ID.
18. Apps Script mengembalikan metadata PDF.
19. Worker mengupdate status document.
20. Worker membuat email job jika email tersedia.
21. File Google Docs sementara dibersihkan.
22. Peserta dapat mengambil PDF melalui backend.

## 13.3 Generation status

- queued
- processing
- ready
- failed
- revoked

Generation job memiliki status terpisah:

- queued
- processing
- retry_wait
- succeeded
- failed
- cancelled
- needs_review

Gunakan transition rules yang eksplisit.

## 13.4 Job processing strategy

Gunakan durable job table di D1 sebagai strategi awal
yang hemat biaya dan mudah dipantau.

Setelah submit:

- Simpan pekerjaan secara durable terlebih dahulu.
- Kembalikan HTTP 202 Accepted jika belum selesai.
- Coba proses satu job segera jika aman dalam batas runtime.
- Frontend melakukan polling status dengan backoff.

Gunakan Cron Trigger sebagai recovery processor untuk
pekerjaan yang belum selesai.

Jangan mengandalkan waitUntil sebagai satu-satunya
jaminan keberhasilan job.

Cron processor:

- Memproses batch kecil.
- Menggunakan conditional claim.
- Memiliki lease_expires_at.
- Memiliki attempts.
- Memiliki next_attempt_at.
- Mendeteksi abandoned jobs.
- Menghentikan retry setelah batas tercapai.

Jika batas Cloudflare Free tidak mencukupi, evaluasi
Cloudflare Queues atau strategi scheduler lain.

Jangan mengaktifkan layanan berbayar secara otomatis.

## 13.5 Idempotency

Gunakan idempotency key yang konsisten untuk generation.

Contoh:

  document_id + revision_number

Retry request tidak boleh menghasilkan nomor baru.

Apps Script harus mengenali job yang telah diproses
dan mengembalikan hasil sebelumnya apabila tersedia.

Gunakan LockService untuk mencegah concurrent processing
job yang sama pada Apps Script.

Sediakan rekonsiliasi apabila file sudah dibuat tetapi
response Apps Script tidak diterima oleh Worker.

Jangan mengklaim exactly-once processing lintas layanan.

Gunakan idempotent retries dan reconciliation untuk
mendapatkan perilaku effectively-once.

## 13.6 Generation result

Metadata hasil:

- Document ID.
- Job ID.
- Google Drive file ID.
- Filename.
- MIME type.
- File size.
- Revision number.
- SHA-256 checksum jika tersedia.
- Generation timestamp.

Jangan mengirimkan Google Drive file ID kepada frontend
publik.

## 13.7 Filename

Format default:

  Sertifikat_[NamaPeserta]_[NomorDokumen].pdf

Untuk piagam:

  Piagam_[NamaPenerima]_[NomorDokumen].pdf

Sanitize filename.

Jangan memasukkan NIK atau data pribadi lain yang tidak
diperlukan ke nama file.

---

# 14. DOCUMENT NUMBERING ENGINE

## 14.1 Configurable numbering

Admin dapat menentukan:

- Prefix.
- Suffix.
- Separator.
- Digits padding.
- Starting number.
- Nomor urut.
- Kode kegiatan.
- Kode jenis dokumen.
- Bulan numerik.
- Bulan Romawi.
- Tahun.
- Reset strategy.

## 14.2 Number format tokens

Gunakan token yang terpisah dari placeholder Google Docs.

- {SEQ}
- {EVENT_CODE}
- {DOC_TYPE}
- {MONTH}
- {MONTH_ROMAN}
- {YEAR}
- {ORG_CODE}

Contoh format:

  {SEQ}/SERT/{ORG_CODE}/{MONTH_ROMAN}/{YEAR}

Contoh hasil:

  001/SERT/PKM-SMK/XI/2026

Contoh piagam:

  001/PIAGAM/PKM-SMK/XI/2026

Format di atas merupakan contoh, bukan nomor surat resmi
yang wajib digunakan.

## 14.3 Reset strategies

- never
- monthly
- yearly
- per_event

Counter sertifikat dan piagam dapat dipisahkan.

Admin dapat melihat preview nomor sebelum konfigurasi
dipublikasikan.

## 14.4 Atomic sequence

Gunakan atomic database operation, misalnya UPSERT
counter dengan RETURNING, sesuai dukungan D1.

Jangan menggunakan:

  SELECT MAX(number) + 1

Nomor dokumen harus memiliki unique constraint.

Nomor yang sudah dialokasikan tidak digunakan ulang
walaupun generation gagal atau dokumen dicabut.

Gap nomor akibat kegagalan proses diperbolehkan dan
harus dapat diaudit.

## 14.5 Regeneration

Jika sertifikat diperbaiki:

- Nomor sertifikat tetap.
- Verification code tetap.
- Revision number bertambah.
- File PDF baru dibuat.
- Current revision diperbarui setelah PDF baru berhasil.
- File lama menjadi superseded.
- Riwayat perubahan dicatat.

Nomor baru hanya dibuat untuk penerbitan dokumen baru.

---

# 15. PDF STORAGE AND DELIVERY

## 15.1 Google Drive storage

Gunakan Google Drive private.

Struktur folder:

ECER/
  production/
    templates/
      snapshots/
    certificates/
      2026/
        event-id/
    awards/
      2026/
        event-id/
    temporary/
  staging/
    templates/
    certificates/
    awards/
    temporary/

Gunakan ID internal pada struktur folder.

Hindari NIK sebagai nama folder.

Google Drive file harus:

- Restricted.
- Tidak menggunakan anyone with the link.
- Dikelola oleh akun Google khusus aplikasi.
- Tidak dibagikan langsung kepada peserta.

## 15.2 Download authorization

Endpoint download harus memeriksa:

- Document ID valid.
- Document status ready.
- Document tidak revoked.
- Current revision tersedia.
- Download authorization valid.
- Kegiatan tidak ditutup manual.
- Kegiatan tidak diarsipkan.
- Waktu berada dalam periode unduh.

Administrator yang telah login dapat mengunduh dokumen
di luar periode publik.

## 15.3 PDF transfer

Worker mengambil PDF melalui signed Apps Script request.

Apps Script memeriksa document/file mapping yang sah.

Apps Script tidak boleh menyediakan arbitrary Drive
file download berdasarkan ID tanpa validasi.

Apps Script dapat mengembalikan PDF sebagai base64 JSON
untuk file sertifikat berukuran kecil.

Worker melakukan decoding dan mengirim response:

- Content-Type: application/pdf
- Content-Disposition: inline atau attachment
- Cache-Control: private, no-store
- X-Content-Type-Options: nosniff

Tetapkan batas awal PDF, misalnya 2 MiB, dan validasi
melalui staging load test.

Jika decoding base64 melampaui CPU/memory Workers Free,
evaluasi Google Drive API authenticated streaming.

Jangan menjadikan public sharing sebagai workaround.

## 15.4 PDF preview

Gunakan native browser PDF viewer jika tersedia.

Pada perangkat yang tidak mendukung inline preview:

- Tampilkan informasi dokumen.
- Sediakan tombol download.

Jangan memasang PDF.js pada bundle publik secara default
kecuali diperlukan.

## 15.5 Download restrictions

Periode download hanya mengontrol akses melalui aplikasi.

PDF yang sudah diunduh atau diterima melalui attachment
email tidak dapat ditarik kembali dari perangkat peserta.

Pencabutan dokumen mengubah hasil verifikasi keaslian,
bukan menghapus salinan PDF milik penerima.

---

# 16. CERTIFICATE SEARCH AND RECOVERY

## 16.1 Search key

Administrator dapat memilih:

- NIK.
- Nomor peserta.
- Email.
- Nomor registrasi.
- Field unik lainnya.

Setiap kegiatan dapat memiliki key yang berbeda.

Search key harus required dan dapat dinormalisasi.

## 16.2 Additional verification

NIK atau search key tunggal tidak boleh memberikan
akses langsung ke PDF.

Gunakan salah satu:

A. Search key + recovery code.

B. Search key + email OTP yang dikirim ke alamat email
   yang tersimpan pada data peserta.

Recovery code direkomendasikan sebagai metode utama
karena tidak menggunakan kuota email tambahan.

OTP digunakan untuk recovery jika peserta kehilangan kode.

Pencocokan alamat email saja bukan bukti kepemilikan email.

## 16.3 Recovery code

- Dibuat dengan cryptographically secure random generator.
- Minimal 128-bit entropy.
- Disimpan dalam bentuk hash.
- Tampilkan setelah submission berhasil.
- Dapat disalin atau disimpan peserta.
- Tidak dimasukkan ke URL query parameter.
- Tidak dicatat dalam log.
- Dapat dirotasi melalui proses recovery yang sah.

## 16.4 Email OTP

Jika digunakan:

- OTP memiliki masa berlaku singkat.
- Default rekomendasi: 5 menit.
- Maksimal percobaan: 5.
- Resend cooldown: 60 detik.
- Simpan OTP sebagai keyed HMAC.
- OTP hanya dapat digunakan satu kali.
- Terapkan rate limit per IP dan lookup key.
- Gunakan response generik untuk mencegah enumerasi.
- Perhitungkan pemakaian kuota email harian.

## 16.5 Download grant

Setelah verifikasi berhasil, buat temporary download grant.

Default:

- TTL 10 menit.
- Terikat pada document ID.
- Terikat pada tujuan preview/download.
- Simpan token hash dalam D1.
- Utamakan cookie HttpOnly untuk browser.
- Jangan menyimpan token pada localStorage.
- Validasi ulang periode unduh setiap request.

Gunakan token yang dapat dicabut jika data dokumen berubah.

Temporary grant tidak boleh memberikan akses ke
dokumen peserta lain.

## 16.6 Search response

Jangan menampilkan nama lengkap, NIK, email lengkap,
atau informasi peserta sebelum verifikasi berhasil.

Gunakan pesan generik seperti:

  Jika data sesuai, ikuti langkah verifikasi untuk
  mengakses sertifikat Anda.

---

# 17. QR CODE VERIFICATION

## 17.1 QR content

QR Code mengarah ke:

  https://APP_DOMAIN/verifikasi/:verificationCode

Verification code harus menggunakan nilai acak yang
tidak dapat ditebak.

Jangan menggunakan NIK atau database integer ID
sebagai verification code.

## 17.2 QR generation

Generate QR secara lokal menggunakan library yang sesuai.

Worker dapat menghasilkan QR image berukuran kecil
dan mengirimkannya ke Apps Script.

Apps Script menyisipkan image pada placeholder:

  {{qr_code}}

Jangan menggunakan layanan QR generator publik yang
menerima data pribadi.

## 17.3 Verification page

Halaman menampilkan:

- Status dokumen.
- Nomor sertifikat atau piagam.
- Nama penerima sesuai kebijakan privasi.
- Nama kegiatan.
- Jenis dokumen.
- Tanggal terbit.
- Instansi penerbit.
- Informasi revisi jika relevan.

Default tampilkan nama yang dimasking.

Administrator dapat mengatur tampilan nama lengkap jika
terdapat dasar pemrosesan dan pemberitahuan yang sesuai.

Jangan tampilkan:

- NIK.
- Email.
- Nomor telepon.
- Alamat.
- Recovery code.
- Google Drive file ID.
- Tombol download tanpa otorisasi.

## 17.4 Verification states

VALID:
  Dokumen terdaftar dan masih berlaku.

REVOKED:
  Dokumen telah dicabut oleh penerbit.

NOT_FOUND:
  Dokumen tidak ditemukan.

UNAVAILABLE:
  Informasi tidak dapat ditampilkan sesuai retensi data.

## 17.5 Verification availability

Halaman verifikasi tetap dapat diakses setelah periode
pengisian dan download berakhir.

Halaman verifikasi tunduk pada kebijakan retensi data.

Tambahkan noindex agar halaman verifikasi tidak
diindeks mesin pencari.

---

# 18. AWARD MANAGEMENT

Piagam hanya dapat dibuat oleh administrator.

## 18.1 Generation methods

- Manual single recipient.
- Bulk import CSV.
- Bulk import Excel.
- Import dari peserta kegiatan.

## 18.2 Manual generation

Admin memilih:

- Kegiatan.
- Template piagam.
- Kategori penghargaan.
- Penerima.
- Data placeholder.
- Penomoran.
- Opsi kirim email.

Tampilkan preview data sebelum generation.

## 18.3 Bulk import

Workflow:

1. Download contoh template CSV/XLSX.
2. Upload file.
3. Validasi header.
4. Mapping kolom.
5. Validasi setiap baris.
6. Tampilkan error dan duplicate warnings.
7. Preview data valid.
8. Admin mengonfirmasi.
9. Sistem membuat batch generation jobs.
10. Sistem menampilkan progress.
11. Admin dapat retry baris yang gagal.

Gunakan batas awal maksimal 100 baris per batch.

Jangan memproses seluruh file dalam satu request panjang.

File import tidak boleh menjalankan macro atau formula.

## 18.4 Award visibility

Piagam tidak ditampilkan pada dashboard publik.

Piagam tidak dapat dicari melalui public certificate
search.

Piagam dapat:

- Diunduh admin.
- Dikirim melalui attachment email.
- Diverifikasi melalui QR Code.

Piagam tidak mengurangi kuota pendaftaran peserta.

## 18.5 Award duplicate handling

Gunakan idempotency berdasarkan:

- Event ID.
- Template/kategori.
- Recipient identity.
- Issuance batch identifier.

Jika identitas penerima yang sama terdeteksi pada
kategori yang sama, tampilkan warning.

Admin dapat menerbitkan penghargaan berbeda jika
memang memiliki kategori atau alasan penerbitan berbeda.

---

# 19. EMAIL DELIVERY

## 19.1 Email provider

Gunakan Google Apps Script MailApp.

Akun awal: Gmail personal.

Rancang berdasarkan keterbatasan:

- Daily recipient quota.
- Apps Script execution quota.
- Concurrent execution limits.
- Attachment size limits.

Periksa kuota aktual melalui:

  MailApp.getRemainingDailyQuota()

Jangan hardcode asumsi bahwa kuota selalu tersedia.

## 19.2 Email structure

Subject default:

  Sertifikat Kegiatan - {{nama_kegiatan}}

Email body default:

  Yth. {{nama_lengkap}},

  Terima kasih telah mengikuti kegiatan
  {{nama_kegiatan}} yang diselenggarakan oleh
  Puskesmas Sumbermanjing Kulon.

  Sertifikat Anda terlampir dalam email ini.

  Terima kasih.

  Puskesmas Sumbermanjing Kulon

Attachment:

- PDF sertifikat atau piagam.

Email template dapat dikonfigurasi oleh admin.

Gunakan placeholder allowlist.

## 19.3 Email status

- queued
- processing
- sent
- failed
- deferred_quota
- retry_wait
- needs_review
- cancelled

Status sent berarti MailApp menerima operasi pengiriman.

Status sent bukan bukti email telah dibaca atau berhasil
masuk ke inbox penerima.

## 19.4 Quota management

Jika kuota email habis:

- Jangan menggagalkan PDF generation.
- Jangan menggagalkan participant submission.
- Simpan email job sebagai deferred_quota.
- Informasikan status pada dashboard admin.
- Jadwalkan retry berdasarkan kuota aktual.
- Prioritaskan pengiriman dokumen.
- Batasi OTP dan resend agar kuota tidak cepat habis.

Kuota reset tidak boleh diasumsikan selalu pada
pukul 00.00 WIB.

## 19.5 Retry strategy

Default:

- Retry 1: 5 menit.
- Retry 2: 30 menit.
- Retry 3: 2 jam.
- Setelah batas percobaan, tandai failed.

Quota exhaustion bukan permanent failure.

Jangan retry email yang sudah sent tanpa tindakan
admin yang eksplisit.

Jika terjadi timeout setelah MailApp kemungkinan sudah
mengirim email, tandai needs_review.

MailApp tidak menyediakan transactional exactly-once
delivery lintas layanan.

## 19.6 Admin email monitor

Tampilkan:

- Nama kegiatan.
- Nama penerima.
- Email tujuan sesuai hak akses.
- Jenis dokumen.
- Status.
- Jumlah percobaan.
- Waktu terakhir percobaan.
- Waktu berhasil.
- Error category.
- Retry action.
- Resend action.
- Cancel action.

Setiap manual resend memiliki audit log.

## 19.7 Email distribution rules

Email attachment dapat dikirim setelah PDF ready.

Periode download mengatur akses aplikasi, bukan
kemampuan membuka attachment email.

Jika kegiatan memiliki embargo distribusi, tahan email
sampai release_at atau download_start_at.

Admin dapat menentukan opsi tersebut pada kegiatan.

---

# 20. ADMIN DASHBOARD

## 20.1 Summary cards

Tampilkan:

- Total kegiatan.
- Kegiatan aktif.
- Kegiatan terjadwal.
- Total peserta.
- Pending approval.
- Sertifikat terbit.
- Piagam terbit.
- Generation jobs gagal.
- Email terkirim.
- Email pending/gagal.

Gunakan metric cards secara proporsional.

Jangan membuat terlalu banyak kartu statistik tanpa
hierarki visual.

## 20.2 Charts

Tampilkan jika data tersedia:

- Kegiatan per bulan.
- Sertifikat terbit per bulan.
- Distribusi jenis kegiatan.
- Status generation.
- Status email.

Gunakan chart library ringan yang dimuat hanya pada admin.

Jangan memuat chart library pada dashboard publik.

## 20.3 Recent activities

Tampilkan:

- Kegiatan baru.
- Pengajuan terbaru.
- Dokumen yang baru diterbitkan.
- Approval yang menunggu.
- Generation failure.
- Email failure.

## 20.4 Quick actions

- Buat kegiatan.
- Tambah template.
- Generate piagam.
- Verifikasi peserta.
- Lihat job gagal.

---

# 21. ADMIN EVENT EDITOR

Gunakan segmented form atau tab.

## Tab 1: Informasi kegiatan

- Nama.
- Jenis.
- Deskripsi.
- Flyer.
- Tanggal.
- Lokasi.
- Penyelenggara.

## Tab 2: Periode dan kuota

- Waktu publikasi.
- Periode pengisian.
- Periode pengunduhan.
- Kuota.
- Release email.

## Tab 3: Validasi dan penerbitan

- Metode kehadiran.
- PIN.
- Whitelist.
- Issuance mode.
- Eligibility rule.

## Tab 4: Template

- Template sertifikat.
- Template piagam.
- Versi template.
- Kategori dokumen.
- Preview.

## Tab 5: Formulir

- Placeholder mapping.
- Dynamic fields.
- Field order.
- Field validation.
- Form preview.

## Tab 6: Pencarian dan penomoran

- Unique participant key.
- Search key.
- Recovery method.
- Numbering configuration.
- Number preview.

## Tab 7: Email dan publikasi

- Subject.
- Body.
- Auto email.
- Embargo distribusi.
- Preview kegiatan.
- Publication checklist.

Sediakan save draft.

Sediakan warning untuk unsaved changes.

Sebelum publish, backend harus memastikan:

- Template tersedia.
- Template telah tervalidasi.
- Form schema valid.
- Unique key telah dikonfigurasi.
- Search key valid.
- Periode valid.
- Numbering rule valid.
- Placeholder memiliki mapping.
- Validation method lengkap.
- Konfigurasi email sesuai.

---

# 22. REPORTING AND EXPORT

Administrator dapat melakukan filter:

- Rentang tanggal.
- Kegiatan.
- Jenis kegiatan.
- Status peserta.
- Status dokumen.
- Status email.
- Kategori dokumen.

Export:

- CSV.
- XLSX.

Export minimal:

- Daftar peserta per kegiatan.
- Daftar sertifikat.
- Daftar piagam.
- Rekap nomor dokumen.
- Rekap pengiriman email.

Default export tidak menyertakan NIK lengkap.

Export data sensitif membutuhkan pilihan eksplisit
dan audit log.

Lindungi CSV/XLSX dari formula injection.

Nilai yang diawali karakter formula harus diperlakukan
sebagai text data.

Untuk dataset besar, gunakan pagination atau bounded
batch processing.

---

# 23. DATABASE DESIGN

Database menggunakan Cloudflare D1 dengan SQL migration.

## 23.1 General conventions

- Gunakan UUID sebagai ID.
- Gunakan snake_case.
- Gunakan parameterized SQL.
- Aktifkan dan verifikasi foreign key constraints.
- Gunakan UTC timestamps.
- Gunakan CHECK constraints jika sesuai.
- Gunakan unique constraints untuk business rules.
- Buat index untuk query yang sering digunakan.
- Gunakan JSON TEXT hanya untuk data dinamis.
- Hindari menyimpan data PDF binary di database.
- Hindari query SELECT * pada endpoint produksi.

## 23.2 Table: admins

- id TEXT PRIMARY KEY
- username TEXT UNIQUE
- display_name TEXT
- password_hash TEXT
- password_algorithm TEXT
- is_active INTEGER
- last_login_at TEXT
- created_at TEXT
- updated_at TEXT

## 23.3 Table: admin_sessions

- id TEXT PRIMARY KEY
- admin_id TEXT REFERENCES admins
- token_hash TEXT UNIQUE
- expires_at TEXT
- last_activity_at TEXT
- revoked_at TEXT
- created_at TEXT

## 23.4 Table: event_categories

- id TEXT PRIMARY KEY
- name TEXT
- slug TEXT UNIQUE
- is_active INTEGER
- created_at TEXT

## 23.5 Table: events

- id TEXT PRIMARY KEY
- category_id TEXT REFERENCES event_categories
- slug TEXT UNIQUE
- event_code TEXT UNIQUE
- title TEXT
- description TEXT
- organizer TEXT
- location TEXT
- flyer_key TEXT
- event_start_at TEXT
- event_end_at TEXT
- publish_at TEXT
- registration_start_at TEXT
- registration_end_at TEXT
- download_start_at TEXT
- download_end_at TEXT
- email_release_at TEXT
- quota INTEGER NULL
- attendance_mode TEXT
- issuance_mode TEXT
- lifecycle_status TEXT
- unique_key_field TEXT
- search_key_field TEXT
- event_pin_hash TEXT
- email_config_json TEXT
- retention_config_json TEXT
- created_by TEXT REFERENCES admins
- updated_by TEXT REFERENCES admins
- created_at TEXT
- updated_at TEXT

## 23.6 Table: templates

- id TEXT PRIMARY KEY
- name TEXT
- description TEXT
- document_type TEXT
- google_doc_id TEXT
- is_active INTEGER
- created_by TEXT REFERENCES admins
- created_at TEXT
- updated_at TEXT

## 23.7 Table: template_versions

- id TEXT PRIMARY KEY
- template_id TEXT REFERENCES templates
- version_number INTEGER
- snapshot_doc_id TEXT
- placeholders_json TEXT
- mapping_schema_json TEXT
- validation_status TEXT
- created_by TEXT REFERENCES admins
- created_at TEXT

Unique:

- template_id + version_number

## 23.8 Table: event_templates

- id TEXT PRIMARY KEY
- event_id TEXT REFERENCES events
- template_version_id TEXT REFERENCES template_versions
- numbering_rule_id TEXT REFERENCES numbering_rules
- category_name TEXT
- eligibility_json TEXT
- sort_order INTEGER
- is_active INTEGER

## 23.9 Table: form_versions

- id TEXT PRIMARY KEY
- event_id TEXT REFERENCES events
- version_number INTEGER
- schema_json TEXT
- status TEXT
- created_by TEXT REFERENCES admins
- created_at TEXT

Unique:

- event_id + version_number

## 23.10 Table: participants

- id TEXT PRIMARY KEY
- event_id TEXT REFERENCES events
- form_version_id TEXT REFERENCES form_versions
- unique_key_hash TEXT
- search_key_hash TEXT
- encrypted_data TEXT
- email_encrypted TEXT
- recovery_code_hash TEXT
- submission_status TEXT
- consent_version TEXT
- consented_at TEXT
- submitted_at TEXT
- approved_by TEXT NULL
- approved_at TEXT NULL
- created_at TEXT
- updated_at TEXT

Unique:

- event_id + unique_key_hash

Index:

- event_id + search_key_hash
- event_id + submission_status

## 23.11 Table: event_whitelist

- id TEXT PRIMARY KEY
- event_id TEXT REFERENCES events
- whitelist_key_hash TEXT
- encrypted_data TEXT
- used_by_participant_id TEXT NULL
- created_at TEXT

Unique:

- event_id + whitelist_key_hash

## 23.12 Table: numbering_rules

- id TEXT PRIMARY KEY
- name TEXT
- document_type TEXT
- format_pattern TEXT
- sequence_padding INTEGER
- starting_number INTEGER
- reset_strategy TEXT
- organization_code TEXT
- is_active INTEGER
- created_at TEXT
- updated_at TEXT

## 23.13 Table: numbering_counters

- id TEXT PRIMARY KEY
- rule_id TEXT REFERENCES numbering_rules
- scope_key TEXT
- current_value INTEGER
- updated_at TEXT

Unique:

- rule_id + scope_key

## 23.14 Table: documents

Gunakan satu tabel dokumen dengan document_type.

- id TEXT PRIMARY KEY
- public_id TEXT UNIQUE
- event_id TEXT REFERENCES events
- participant_id TEXT NULL REFERENCES participants
- event_template_id TEXT REFERENCES event_templates
- template_version_id TEXT REFERENCES template_versions
- numbering_rule_id TEXT REFERENCES numbering_rules
- document_type TEXT
- document_number TEXT UNIQUE
- verification_code TEXT UNIQUE
- issuance_key TEXT UNIQUE
- recipient_data_encrypted TEXT
- current_revision_id TEXT NULL
- document_status TEXT
- issued_at TEXT NULL
- revoked_at TEXT NULL
- revoked_reason TEXT NULL
- created_by TEXT NULL REFERENCES admins
- created_at TEXT
- updated_at TEXT

## 23.15 Table: document_revisions

- id TEXT PRIMARY KEY
- document_id TEXT REFERENCES documents
- revision_number INTEGER
- template_version_id TEXT REFERENCES template_versions
- data_snapshot_encrypted TEXT
- drive_file_id TEXT
- filename TEXT
- mime_type TEXT
- file_size INTEGER
- checksum TEXT
- revision_status TEXT
- created_by TEXT NULL
- created_at TEXT

Unique:

- document_id + revision_number

## 23.16 Table: generation_jobs

- id TEXT PRIMARY KEY
- document_id TEXT REFERENCES documents
- revision_number INTEGER
- idempotency_key TEXT UNIQUE
- job_status TEXT
- attempts INTEGER
- max_attempts INTEGER
- next_attempt_at TEXT
- lease_expires_at TEXT
- claimed_by TEXT
- error_code TEXT
- safe_error_message TEXT
- created_at TEXT
- updated_at TEXT

## 23.17 Table: email_jobs

- id TEXT PRIMARY KEY
- document_id TEXT REFERENCES documents
- revision_id TEXT REFERENCES document_revisions
- recipient_email_encrypted TEXT
- email_template_json TEXT
- idempotency_key TEXT UNIQUE
- job_status TEXT
- attempts INTEGER
- next_attempt_at TEXT
- lease_expires_at TEXT
- sent_at TEXT
- error_code TEXT
- safe_error_message TEXT
- created_at TEXT
- updated_at TEXT

OTP email dapat menggunakan job purpose terpisah atau
dedicated recovery delivery mechanism.

## 23.18 Table: download_grants

- id TEXT PRIMARY KEY
- document_id TEXT REFERENCES documents
- token_hash TEXT UNIQUE
- expires_at TEXT
- revoked_at TEXT
- created_at TEXT

## 23.19 Table: verification_challenges

- id TEXT PRIMARY KEY
- participant_id TEXT REFERENCES participants
- challenge_type TEXT
- code_hash TEXT
- attempts INTEGER
- expires_at TEXT
- consumed_at TEXT
- created_at TEXT

## 23.20 Table: app_settings

- setting_key TEXT PRIMARY KEY
- setting_value TEXT
- updated_by TEXT REFERENCES admins
- updated_at TEXT

Jangan menyimpan secret di app_settings.

## 23.21 Table: audit_logs

- id TEXT PRIMARY KEY
- admin_id TEXT NULL REFERENCES admins
- actor_type TEXT
- action TEXT
- entity_type TEXT
- entity_id TEXT
- change_summary_json TEXT
- request_id TEXT
- created_at TEXT

Jangan menyimpan password, recovery code, OTP, PIN,
secret, NIK lengkap, atau email lengkap di audit log.

## 23.22 Table: integration_replays

- nonce_hash TEXT PRIMARY KEY
- expires_at TEXT
- created_at TEXT

Gunakan untuk pencegahan replay pada integrasi.

Apps Script juga harus memiliki mekanisme validasi
nonce sendiri untuk request Worker ke Apps Script.

## 23.23 Required indexes

- events(lifecycle_status, publish_at)
- events(event_start_at, event_end_at)
- participants(event_id, submission_status)
- participants(event_id, search_key_hash)
- documents(event_id, document_status)
- documents(participant_id)
- documents(document_type, issued_at)
- generation_jobs(job_status, next_attempt_at)
- email_jobs(job_status, next_attempt_at)
- admin_sessions(expires_at)
- download_grants(expires_at)
- audit_logs(entity_type, entity_id)
- audit_logs(created_at)

## 23.24 ERD relationships

admins 1:N admin_sessions
admins 1:N audit_logs

event_categories 1:N events

events 1:N form_versions
events 1:N participants
events 1:N event_whitelist
events 1:N event_templates
events 1:N documents

templates 1:N template_versions
template_versions 1:N event_templates

form_versions 1:N participants
participants 1:N documents

numbering_rules 1:N numbering_counters
numbering_rules 1:N event_templates

documents 1:N document_revisions
documents 1:N generation_jobs
documents 1:N email_jobs
documents 1:N download_grants

participants 1:N verification_challenges

Generate ERD Mermaid yang aktual pada docs/DATABASE.md
setelah SQL migration selesai.

---

# 24. REST API SPECIFICATION

Base URL:

  /api/v1

## 24.1 Public API

GET /public/dashboard
  Monthly statistics.

GET /public/events
  Published events dengan filter dan pagination.

GET /public/events/:slug
  Detail kegiatan dan computed eligibility.

GET /public/events/:slug/form
  Active participant form schema.

POST /public/events/:slug/register
  Participant submission.

POST /public/events/:slug/search
  Start recovery/search process.

POST /public/recovery/verify
  Verify recovery code atau email OTP.

POST /public/recovery/resend
  Resend OTP dengan rate limiting.

GET /public/submissions/:publicId/status
  Status pengajuan dengan grant/session.

GET /public/documents/:publicId/preview
  Authorized PDF preview.

GET /public/documents/:publicId/download
  Authorized PDF download.

GET /public/verify/:verificationCode
  Public document verification.

## 24.2 Authentication API

POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/change-password

## 24.3 Admin dashboard API

GET /admin/dashboard
GET /admin/dashboard/statistics
GET /admin/dashboard/activities

## 24.4 Admin event API

GET    /admin/events
POST   /admin/events
GET    /admin/events/:id
PATCH  /admin/events/:id
DELETE /admin/events/:id

POST /admin/events/:id/publish
POST /admin/events/:id/close
POST /admin/events/:id/reopen
POST /admin/events/:id/archive
POST /admin/events/:id/duplicate

GET  /admin/events/:id/form
PUT  /admin/events/:id/form
POST /admin/events/:id/form/publish

GET  /admin/events/:id/templates
PUT  /admin/events/:id/templates

GET  /admin/events/:id/whitelist
POST /admin/events/:id/whitelist
POST /admin/events/:id/whitelist/import

Event deletion hanya diperbolehkan untuk draft yang belum
memiliki participant atau document records.

## 24.5 Admin template API

GET    /admin/templates
POST   /admin/templates/import
GET    /admin/templates/:id
PATCH  /admin/templates/:id
DELETE /admin/templates/:id

POST /admin/templates/:id/refresh
POST /admin/templates/:id/validate
POST /admin/templates/:id/test-generate

GET /admin/templates/:id/versions

Template yang pernah digunakan tidak boleh dihapus
secara destruktif.

## 24.6 Admin participants API

GET   /admin/events/:id/participants
GET   /admin/participants/:id
PATCH /admin/participants/:id

POST /admin/participants/:id/approve
POST /admin/participants/:id/reject
POST /admin/participants/:id/cancel
POST /admin/participants/:id/recovery-reset

POST /admin/participants/bulk-approve

## 24.7 Admin documents API

GET  /admin/documents
GET  /admin/documents/:id
GET  /admin/documents/:id/download

POST /admin/documents/:id/regenerate
POST /admin/documents/:id/revoke
POST /admin/documents/:id/send-email

GET /admin/documents/:id/revisions

## 24.8 Admin awards API

GET  /admin/awards
POST /admin/awards/generate
POST /admin/awards/import/validate
POST /admin/awards/import/confirm
POST /admin/awards/from-participants

## 24.9 Admin jobs API

GET  /admin/jobs/generation
POST /admin/jobs/generation/:id/retry
POST /admin/jobs/generation/:id/cancel

GET  /admin/jobs/email
POST /admin/jobs/email/:id/retry
POST /admin/jobs/email/:id/resend
POST /admin/jobs/email/:id/cancel

GET /admin/jobs/summary

## 24.10 Admin numbering API

GET    /admin/numbering
POST   /admin/numbering
PATCH  /admin/numbering/:id
POST   /admin/numbering/preview

## 24.11 Admin storage API

POST   /admin/storage/flyer
DELETE /admin/storage/flyer/:id

GET /public/assets/flyers/:assetId

## 24.12 Admin settings API

GET   /admin/settings
PATCH /admin/settings

GET  /admin/categories
POST /admin/categories
PATCH /admin/categories/:id

GET   /admin/users
POST  /admin/users
PATCH /admin/users/:id
POST  /admin/users/:id/reset-password

GET /admin/audit-logs

## 24.13 Admin reports API

GET /admin/reports/summary
GET /admin/reports/participants
GET /admin/reports/documents
GET /admin/reports/email

POST /admin/reports/export

## 24.14 API response format

Success:

{
  "success": true,
  "data": {},
  "requestId": "uuid"
}

Paginated:

{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  },
  "requestId": "uuid"
}

Error:

{
  "success": false,
  "error": {
    "code": "REGISTRATION_CLOSED",
    "message": "Periode pengisian telah berakhir."
  },
  "requestId": "uuid"
}

Jangan mengembalikan stack trace kepada client.

## 24.15 HTTP status codes

- 200: Success.
- 201: Resource created.
- 202: Job accepted.
- 400: Invalid request.
- 401: Authentication required.
- 403: Access denied.
- 404: Not found.
- 409: Conflict.
- 422: Validation error.
- 429: Rate limit exceeded.
- 500: Internal server error.
- 503: External service unavailable.

Gunakan pagination default 20 dan maksimal 100.

## 24.16 Error codes

- VALIDATION_ERROR
- UNAUTHORIZED
- FORBIDDEN
- EVENT_NOT_FOUND
- EVENT_CLOSED
- REGISTRATION_NOT_STARTED
- REGISTRATION_CLOSED
- DOWNLOAD_NOT_STARTED
- DOWNLOAD_CLOSED
- QUOTA_FULL
- INVALID_ATTENDANCE
- DUPLICATE_PARTICIPANT
- INVALID_RECOVERY
- TEMPLATE_INVALID
- TEMPLATE_ACCESS_DENIED
- GENERATION_PENDING
- GENERATION_FAILED
- DOCUMENT_REVOKED
- EMAIL_QUOTA_EXCEEDED
- RATE_LIMITED
- INTEGRATION_UNAVAILABLE

Public recovery errors harus menggunakan pesan generik
yang tidak mengungkap keberadaan data pribadi.

---

# 25. GOOGLE APPS SCRIPT INTEGRATION

## 25.1 Integration actions

Gunakan Apps Script Web App dengan doPost(e).

Action allowlist:

- health
- inspect_template
- snapshot_template
- generate_document
- get_generation_result
- fetch_pdf
- send_email
- get_email_quota
- delete_managed_file

Jangan menggunakan action yang mengeksekusi arbitrary code.

## 25.2 Request envelope

{
  "version": "1",
  "action": "generate_document",
  "timestamp": 1780000000,
  "nonce": "secure-random-value",
  "requestId": "uuid",
  "payload": {},
  "signature": "hmac-sha256"
}

Gunakan deterministic canonical representation
yang didokumentasikan untuk signing payload.

Contoh signed content:

  version + timestamp + nonce + action + payload_hash

Secret disimpan pada:

- Cloudflare Worker Secrets.
- Google Apps Script Script Properties.

Jangan mengirim secret asli dalam request.

## 25.3 Request verification

Apps Script harus:

1. Parse request secara aman.
2. Validasi request size.
3. Validasi action allowlist.
4. Validasi signature HMAC-SHA256.
5. Validasi timestamp freshness.
6. Validasi nonce/replay protection.
7. Validasi payload.
8. Validasi managed file/folder access.
9. Menjalankan action yang diminta.

Default timestamp tolerance: 5 menit.

Jangan bergantung pada arbitrary HTTP request headers
karena Apps Script Web App tidak mengekspos seluruh
request headers melalui doPost event object.

Gunakan signed envelope pada request body.

## 25.4 Apps Script deployment

Deploy menggunakan akun Google yang memiliki akses
ke folder dan template aplikasi.

Jika deployment membutuhkan akses anonymous untuk
komunikasi server-to-server:

- Pastikan semua action tanpa pengecualian membutuhkan
  signature yang valid.
- Jangan menyediakan action sensitif tanpa otorisasi.
- Batasi cakupan Drive folder dan file.
- Jangan mengandalkan kerahasiaan URL deployment.
- Catat metadata request tanpa data sensitif.

Uji apakah opsi deployment tersedia pada akun Google
yang dipilih.

## 25.5 Integration response

{
  "success": true,
  "requestId": "uuid",
  "data": {
    "jobId": "uuid",
    "driveFileId": "internal-file-id",
    "filename": "sertifikat.pdf",
    "mimeType": "application/pdf",
    "fileSize": 100000
  }
}

Apps Script ContentService dapat memiliki keterbatasan
custom HTTP status.

Worker harus memvalidasi JSON envelope dan tidak hanya
mengandalkan HTTP status.

Handle Google ContentService redirects secara aman.

Jangan meneruskan signed request ke host yang tidak
diizinkan.

## 25.6 Apps Script security

- Gunakan minimal OAuth scopes yang diperlukan.
- Gunakan akun khusus aplikasi.
- Jangan menggunakan akun Google bersama yang tidak
  memiliki pengelolaan akses jelas.
- Validasi folder ownership atau managed membership.
- Jangan mengambil file berdasarkan arbitrary URL.
- Jangan mengirim email ke alamat yang tidak terkait job.
- Jangan mengekspor dokumen ke folder publik.
- Jangan mengirim NIK ke log Apps Script.
- Jangan mengembalikan raw exception ke public API.

## 25.7 Apps Script modular files

Main.gs
  Routing action.

Auth.gs
  Signature verification dan replay protection.

TemplateService.gs
  Inspeksi dan snapshot template.

PlaceholderService.gs
  Deteksi dan replacement placeholder.

DocumentService.gs
  Document generation.

DriveService.gs
  Managed file dan folder operations.

QrService.gs
  QR image insertion.

EmailService.gs
  Email delivery dan quota.

JobRegistry.gs
  Job result lookup dan idempotency.

Response.gs
  Standard response.

Config.gs
  Script properties.

Utils.gs
  Shared utilities.

---

# 26. AUTHENTICATION AND SECURITY

## 26.1 Admin authentication

Gunakan username dan password.

Gunakan server-side session dengan opaque random token.

Tidak perlu JWT untuk aplikasi single-origin ini.

Session cookie:

- HttpOnly.
- Secure pada HTTPS.
- SameSite=Lax atau Strict.
- Path=/.
- Gunakan __Host- prefix pada production jika memenuhi
  persyaratan cookie.

Simpan hanya token hash di database.

Default session policy:

- Idle timeout: 30 menit.
- Absolute timeout: 12 jam.
- Logout mencabut session server-side.

## 26.2 Password security

Gunakan password hashing dengan salt per administrator.

Pilih password KDF yang aman dan kompatibel dengan
Cloudflare Workers.

Prioritaskan implementasi terpercaya berbasis Argon2id
atau PBKDF2-HMAC-SHA256 sesuai platform constraints.

Jangan menggunakan SHA-256 biasa untuk password.

Benchmark parameter KDF pada staging dan target plan.

Jangan melemahkan KDF agar sekadar memenuhi Workers
Free CPU limit.

Jika KDF aman tidak dapat dijalankan secara konsisten
pada free tier, jadikan hal tersebut deployment blocker
dan evaluasi alternatif authentication provider atau
peningkatan plan dengan persetujuan pemilik proyek.

Password policy:

- Minimum 12 karakter.
- Dukung password panjang.
- Jangan memaksa komposisi simbol yang tidak diperlukan.
- Tolak password umum yang lemah jika memungkinkan.
- Tidak menyimpan password asli.

## 26.3 Admin bootstrap

Administrator awal dibuat melalui secure CLI/bootstrap.

Tidak boleh ada default password dalam repository.

Nonaktifkan bootstrap setelah admin awal berhasil dibuat.

Password reset administrator lain melalui temporary
password atau mekanisme reset aman.

Cabut session aktif setelah password direset.

## 26.4 CSRF protection

Untuk authenticated mutations:

- Validasi Origin.
- Gunakan CSRF token bila diperlukan.
- Gunakan SameSite cookie.
- Tolak cross-origin mutation yang tidak sah.

CORS default: same-origin.

Jangan menggunakan wildcard credentials.

## 26.5 Turnstile

Gunakan Cloudflare Turnstile untuk:

- Login admin.
- Participant registration.
- Public search/recovery.
- OTP request.

Turnstile token harus divalidasi pada backend.

Turnstile bukan pengganti rate limiting.

Gunakan test key resmi pada local development.

## 26.6 Rate limiting

Terapkan per route dan identity yang sesuai.

Default awal:

- Login: 5 percobaan gagal per 15 menit.
- Public search: 10 request per menit.
- Registration: 5 request per 5 menit per client.
- OTP resend: 1 request per 60 detik.
- Download: 10 request per menit per grant.
- Verification: 30 request per menit.

Angka tersebut configurable dan harus diuji.

Pertimbangkan peserta menggunakan WiFi puskesmas yang
memiliki public IP yang sama.

Jangan mengandalkan IP sebagai satu-satunya identifier.

Gunakan kombinasi:

- IP yang diperoleh secara terpercaya.
- Lookup key hash.
- Session.
- Event.
- Challenge.

Gunakan mekanisme rate limiting yang sesuai plan
Cloudflare dan fallback atomik jika diperlukan.

## 26.7 Security headers

- Content-Security-Policy.
- X-Content-Type-Options: nosniff.
- Referrer-Policy: no-referrer.
- Permissions-Policy.
- Strict-Transport-Security pada production.
- Frame restrictions melalui CSP.

CSP harus mendukung Turnstile dan PDF preview yang
digunakan tanpa membuka wildcard berlebihan.

## 26.8 Input security

- SQL injection protection.
- XSS protection.
- CSRF protection.
- SSRF protection.
- File validation.
- MIME validation.
- Filename sanitization.
- Maximum request size.
- Maximum string length.
- Safe template replacement.
- HTML sanitization jika rich text digunakan.
- CSV formula injection prevention.

Hindari dangerouslySetInnerHTML.

Jangan mengevaluasi input admin sebagai JavaScript.

---

# 27. DATA PRIVACY AND RETENTION

Aplikasi memproses data pribadi peserta.

Terapkan privacy by design dan data minimization.

Perhatikan kewajiban perlindungan data pribadi yang
berlaku bagi instansi.

## 27.1 Sensitive data

- NIK.
- Nama lengkap.
- Email.
- Nomor telepon.
- Alamat.
- Data identitas lainnya.

Jangan meminta NIK jika nomor peserta atau kode
registrasi sudah mencukupi.

## 27.2 Encryption

Gunakan AES-GCM dengan unique random IV untuk sensitive
participant data yang membutuhkan perlindungan tambahan.

Gunakan dedicated encryption key pada Worker Secrets.

Untuk pencarian exact match, gunakan keyed HMAC dengan
dedicated lookup key.

Jangan menggunakan hash NIK tanpa secret karena ruang
nilai NIK dapat ditebak.

Gunakan key terpisah untuk:

- Data encryption.
- Lookup HMAC.
- Apps Script signing.

Sediakan key version metadata dan rotation strategy.

## 27.3 Consent and privacy notice

Sebelum submit, tampilkan pemberitahuan:

- Identitas penyelenggara.
- Tujuan pemrosesan.
- Data yang dikumpulkan.
- Pengiriman PDF melalui email.
- Informasi penyimpanan data.
- Periode retensi.
- Informasi verifikasi publik.
- Kontak administrator.

Catat privacy notice version dan timestamp persetujuan.

Pemilik proyek menentukan dasar pemrosesan yang sesuai;
checkbox persetujuan bukan pengganti seluruh kewajiban
hukum instansi.

## 27.4 Retention

Admin dapat menentukan:

- Retensi participant data.
- Retensi PDF.
- Retensi superseded revisions.
- Retensi template snapshots.
- Retensi audit log.
- Retensi job history.

Saran awal:

- Participant data: 24 bulan.
- PDF: 24 bulan.
- Superseded PDF: 90 hari.
- Job logs: 90 hari.
- Temporary files: 24 jam.

Nilai tersebut merupakan konfigurasi awal yang harus
disetujui instansi sesuai kebijakan kearsipan.

Jangan menghapus arsip resmi secara otomatis sebelum
kebijakan retensi disetujui.

Sediakan dry-run retention cleanup.

Cleanup harus:

- Menghapus atau menganonimkan data sesuai kebijakan.
- Menghapus file terkait pada Google Drive.
- Menghapus file R2 yang tidak lagi digunakan.
- Mencabut download grant terkait.
- Menjaga metadata verifikasi minimal jika memiliki
  dasar retensi yang sah.
- Membuat laporan hasil cleanup.

## 27.5 Logging restrictions

Jangan mencatat:

- Raw request body yang mengandung data pribadi.
- NIK.
- Password.
- OTP.
- Recovery code.
- PIN.
- Session token.
- Encryption key.
- Apps Script shared secret.
- PDF base64.

Gunakan request ID dan error category.

---

# 28. FLYER STORAGE WITH CLOUDFLARE R2

## 28.1 Supported formats

- JPEG.
- PNG.
- WebP.

Jangan mendukung SVG upload pada versi awal.

## 28.2 Image processing

- Max upload awal: 5 MiB.
- Target hasil optimasi: 150-500 KiB.
- Resize client-side jika memungkinkan.
- Max width rekomendasi: 1600 px.
- Buang EXIF metadata melalui proses re-encoding.
- Validasi kembali ukuran dan signature di backend.

Target rasio flyer pada kartu: 16:9.

Gunakan object-fit yang sesuai agar informasi penting
pada poster tidak terpotong.

## 28.3 Object key

  flyers/{eventId}/{uuid}.webp

Jangan menggunakan filename asli sebagai object key.

## 28.4 Access

Gunakan Worker untuk melayani flyer yang telah
dipublikasikan.

Public flyer dapat menggunakan cache.

Flyer draft tidak boleh tersedia secara publik.

Cache key harus menggunakan object version.

Jangan mencampur public flyer cache dengan private PDF.

## 28.5 Cleanup

Ketika flyer diganti:

- Simpan flyer baru.
- Update database setelah upload berhasil.
- Hapus flyer lama jika tidak lagi direferensikan.

R2 digunakan untuk aset ringan.

Jangan menyimpan backup database berisi data pribadi
pada public bucket.

---

# 29. UI/UX DESIGN SYSTEM

## 29.1 Design direction

Modern Healthcare Editorial.

Desain harus:

- Profesional.
- Hangat.
- Bersih.
- Modern.
- Natural.
- Mudah dipahami masyarakat.
- Tidak terlihat seperti generic AI dashboard.
- Tidak terlalu dekoratif.
- Tidak menyerupai dashboard enterprise yang kaku.

## 29.2 Visual anti-patterns

DILARANG:

- Dominasi warna ungu.
- Gradient biru-ungu.
- Neon colors yang tidak diperlukan.
- Excessive glassmorphism.
- Excessive shadows.
- Excessive rounded cards.
- Gradient text.
- Decorative icons tanpa fungsi.
- Excessive animation.
- Terlalu banyak nested cards.
- Semua section dibuat seperti kotak statistik.
- Hero marketing yang menghabiskan satu layar.
- Emoji sebagai icon utama UI.

## 29.3 Color palette

Primary forest:
  #123F38

Primary green:
  #23634E

Accent mint:
  #D9EBE0

Canvas:
  #F5F7F6

Surface:
  #FFFFFF

Text primary:
  #203F35

Text secondary:
  #64748B

Border:
  #DFE7E2

Warning:
  #B45309

Danger:
  #B91C1C

Success:
  #15803D

Gunakan semantic CSS variables.

Jangan hardcode warna di setiap komponen.

Pastikan contrast memenuhi WCAG AA.

## 29.4 Typography

Primary font:

  Plus Jakarta Sans

Fallback:

  Inter, system-ui, sans-serif

Gunakan satu font family utama.

Gunakan font lokal/self-hosted jika memungkinkan.

Heading harus jelas namun tidak berlebihan.

Ukuran body utama 14-16 px.

Input mobile minimal 16 px untuk menghindari
zoom otomatis pada browser tertentu.

## 29.5 Spacing

Gunakan spacing system berbasis 4 px.

- 4
- 8
- 12
- 16
- 24
- 32
- 48
- 64

Gunakan whitespace sebagai pemisah visual utama.

## 29.6 Border radius

- Small: 6 px.
- Medium: 8 px.
- Large: 12 px.
- Pill: hanya untuk status atau komponen yang sesuai.

## 29.7 Responsive breakpoints

Mobile small:
  320-479 px

Mobile:
  480-639 px

Tablet:
  640-1023 px

Desktop:
  1024-1439 px

Large desktop:
  1440 px ke atas

## 29.8 Public dashboard layout

Mobile:

- Header compact.
- Statistics compact.
- Month navigation.
- Search dan filter.
- Satu kolom event card.

Tablet:

- Dua kolom event card.

Desktop:

- Tiga kolom event card.
- Max content width sekitar 1280 px.

Large desktop:

- Maksimal empat kolom jika readability tetap baik.

## 29.9 Admin layout

Desktop:

- Sidebar collapsible.
- Topbar.
- Breadcrumb.
- Main content.
- Contextual actions.

Mobile:

- Drawer/sidebar.
- Compact header.
- Stacked forms.
- Responsive data presentation.

Jangan memaksakan tabel desktop ke layar smartphone.

Gunakan horizontal scroll terkontrol atau mobile row card
sesuai konteks data.

## 29.10 Accessibility

Target WCAG 2.2 AA.

- Keyboard navigation.
- Visible focus.
- Semantic HTML.
- Accessible labels.
- Proper heading hierarchy.
- Reduced motion support.
- Error messages yang dapat dibaca screen reader.
- Status tidak hanya dibedakan oleh warna.
- Touch target minimal sekitar 44 px untuk kontrol utama.
- Contrast yang memadai.

## 29.11 Loading and feedback

Setiap halaman harus memiliki:

- Loading state.
- Empty state.
- Error state.
- Success state.
- Disabled state.
- Retry state jika relevan.

Gunakan skeleton seperlunya.

Gunakan toast untuk feedback singkat.

Gunakan inline error untuk masalah formulir.

Gunakan confirmation dialog untuk destructive action.

## 29.12 Animation

- Durasi sekitar 150-250 ms.
- CSS transitions sebagai default.
- Jangan memasang animation library besar hanya untuk
  animasi sederhana.
- Hormati prefers-reduced-motion.

## 29.13 Public terminology

Gunakan bahasa yang dipahami masyarakat.

Contoh:

- Isi Data Sertifikat.
- Cari Sertifikat.
- Unduh Sertifikat.
- Sertifikat sedang dibuat.
- Menunggu persetujuan panitia.
- Pengisian belum dibuka.
- Periode unduh telah berakhir.
- Kegiatan telah ditutup.

Hindari technical jargon pada halaman peserta.

---

# 30. PROJECT FOLDER STRUCTURE

Gunakan struktur berikut sebagai baseline.

ecer/
├── AGENTS.md
├── PRD.md
├── DESIGN.md
├── PRODUCT.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── eslint.config.js
├── .gitignore
├── .env.example
├── .dev.vars.example
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── ROADMAP.md
│   ├── CHANGELOG.md
│   └── decisions/
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   └── AdminLayout.tsx
│   │
│   ├── features/
│   │   ├── public-dashboard/
│   │   ├── public-events/
│   │   ├── registration/
│   │   ├── certificate-search/
│   │   ├── document-preview/
│   │   ├── verification/
│   │   ├── authentication/
│   │   ├── admin-dashboard/
│   │   ├── events/
│   │   ├── templates/
│   │   ├── form-builder/
│   │   ├── participants/
│   │   ├── certificates/
│   │   ├── awards/
│   │   ├── numbering/
│   │   ├── email/
│   │   ├── jobs/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── settings/
│   │   └── audit-log/
│   │
│   ├── components/
│   │   ├── ui/
│   │   └── common/
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   └── assets/
│
├── worker/
│   ├── index.ts
│   ├── app.ts
│   ├── env.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── csrf.ts
│   │   ├── error-handler.ts
│   │   ├── rate-limit.ts
│   │   └── security.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── events/
│   │   ├── templates/
│   │   ├── forms/
│   │   ├── participants/
│   │   ├── certificates/
│   │   ├── awards/
│   │   ├── documents/
│   │   ├── numbering/
│   │   ├── verification/
│   │   ├── recovery/
│   │   ├── storage/
│   │   ├── jobs/
│   │   ├── email/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── settings/
│   │   └── audit/
│   │
│   ├── integrations/
│   │   └── google-apps-script/
│   │       ├── client.ts
│   │       ├── signing.ts
│   │       ├── schemas.ts
│   │       └── types.ts
│   │
│   ├── database/
│   ├── cron/
│   ├── security/
│   └── utils/
│
├── shared/
│   ├── schemas/
│   ├── types/
│   ├── constants/
│   └── utils/
│
├── apps-script/
│   ├── appsscript.json
│   ├── .claspignore
│   ├── Main.gs
│   ├── Auth.gs
│   ├── TemplateService.gs
│   ├── PlaceholderService.gs
│   ├── DocumentService.gs
│   ├── DriveService.gs
│   ├── QrService.gs
│   ├── EmailService.gs
│   ├── JobRegistry.gs
│   ├── Response.gs
│   ├── Config.gs
│   └── Utils.gs
│
├── migrations/
├── scripts/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/
└── .github/
    └── workflows/

## 30.1 Frontend feature structure

Contoh:

features/events/
  pages/
  components/
  hooks/
  api.ts
  schemas.ts
  types.ts
  index.ts

Jangan membuat folder kosong yang tidak diperlukan.

Feature module hanya dibuat ketika dibutuhkan.

## 30.2 Backend module structure

Contoh:

worker/modules/events/
  routes.ts
  service.ts
  repository.ts
  schema.ts
  types.ts

Responsibilities:

routes.ts:
  HTTP request/response dan middleware.

service.ts:
  Business logic.

repository.ts:
  SQL query dan persistence.

schema.ts:
  Runtime validation.

types.ts:
  Module-specific TypeScript types.

Jangan menempatkan SQL query langsung di route handler.

## 30.3 Shared module

Gunakan shared/ untuk:

- Request schemas.
- Response schemas.
- DTO types.
- Common constants.
- Pure utility functions.

Jangan mengimpor database binding atau backend secret
ke frontend shared code.

## 30.4 Code quality

- TypeScript strict mode.
- Hindari any.
- Hindari duplicated logic.
- Gunakan named exports jika konsisten.
- Gunakan meaningful variable names.
- Jangan melakukan premature abstraction.
- Jangan membuat generic repository tanpa kebutuhan.
- Hindari circular dependencies.
- Pisahkan UI dan business logic.
- Satu komponen memiliki tanggung jawab yang jelas.
- Refactor file yang terlalu besar secara natural.
- File 300-400 baris menjadi sinyal review,
  bukan batas absolut.
- Jangan memecah file secara artifisial.

---

# 31. PERFORMANCE AND COST EFFICIENCY

## 31.1 Target

Gratis semaksimal mungkin.

Tidak ada jaminan layanan pihak ketiga akan gratis
selamanya.

Jangan mengaktifkan paket berbayar tanpa persetujuan.

## 31.2 Frontend optimization

- Route-based code splitting.
- Lazy load admin modules.
- Lazy load chart/export dependencies.
- Optimize images.
- Cache public data dengan aman.
- Debounce search.
- Hindari unnecessary re-render.
- Hindari excessive global state.
- Gunakan TanStack Query untuk server state.
- Gunakan local component state untuk UI state.
- Jangan polling seluruh dashboard tanpa kebutuhan.

## 31.3 Backend optimization

- Indexed queries.
- Pagination.
- Select required columns.
- Avoid N+1 queries.
- Batch related operations jika aman.
- Bounded job processing.
- Short-lived public response cache.
- Jangan cache sensitive responses.
- Invalidate cache setelah publish/update/close.
- Backend authorization selalu real-time untuk aksi sensitif.

## 31.4 D1 optimization

- Monitor rows read dan rows written.
- Gunakan index untuk filter utama.
- Jangan menyimpan raw large document content.
- Jangan mengupdate counter statistik pada setiap render.
- Gunakan aggregation query yang efisien.
- Gunakan materialized statistics hanya jika pengukuran
  menunjukkan kebutuhan.

## 31.5 Apps Script optimization

- Gunakan batch kecil.
- Hindari repeated Drive listing.
- Cache metadata non-sensitive bila sesuai.
- Gunakan idempotency registry.
- Bersihkan temporary files.
- Monitor execution quota.
- Hindari long synchronous bulk generation.
- Jangan generate ulang PDF pada setiap download.

## 31.6 Performance targets

Target awal, diukur melalui staging:

- LCP publik <= 2.5 detik pada kondisi pengujian wajar.
- CLS <= 0.1.
- INP <= 200 ms pada data pengukuran yang memadai.
- Initial public JS budget sekitar 250 KiB gzip.
- Typical indexed API request di luar integrasi Google:
  p95 <= 800 ms pada target load test.
- Generation PDF memiliki progress/status yang jelas.
- Tidak ada blank screen selama proses generation.

Durasi generation Google tidak boleh dijanjikan secara
tetap karena bergantung pada kuota dan layanan eksternal.

## 31.7 Quota monitoring

Dashboard admin menyediakan informasi:

- Email quota jika tersedia.
- Jumlah generation jobs.
- Failed integrations.
- Estimated PDF storage usage.
- R2 asset usage jika dapat diperoleh.
- Last successful integration check.

Data penggunaan Cloudflare yang tidak tersedia secara
langsung tidak boleh ditampilkan sebagai angka aktual.

Gunakan label estimated jika berdasarkan estimasi.

---

# 32. ENVIRONMENT VARIABLES

## 32.1 Cloudflare bindings

DB
  Cloudflare D1.

FLYER_BUCKET
  Cloudflare R2.

## 32.2 Configuration variables

APP_NAME
APP_BASE_URL
APP_ENV
APP_TIMEZONE
ORGANIZATION_NAME
ORGANIZATION_CODE
TURNSTILE_SITE_KEY
GAS_WEB_APP_URL

## 32.3 Worker secrets

GAS_SHARED_SECRET
DATA_ENCRYPTION_KEY
LOOKUP_HMAC_KEY
TURNSTILE_SECRET_KEY

Tambahkan secret lain hanya jika dibutuhkan.

## 32.4 Apps Script properties

GAS_SHARED_SECRET
APP_BASE_URL
APP_ENV
DRIVE_ROOT_FOLDER_ID
TEMPLATE_SNAPSHOT_FOLDER_ID
TEMP_FOLDER_ID
JOB_REGISTRY_ID

Jangan menaruh secret pada:

- GitHub repository.
- Vite client environment.
- Source code.
- README.
- Frontend bundle.
- Screenshot.
- AI Agent prompt log.

## 32.5 Gitignore

.env
.env.local
.env.production
.dev.vars
.dev.vars.*
.clasp.json
.clasprc.json
node_modules/
dist/
.wrangler/
coverage/
playwright-report/
test-results/

Tetap commit file example tanpa secret.

---

# 33. AI AGENT SKILLS

Gunakan skill secara selektif.

## 33.1 Primary skill: Impeccable

Repository:

https://github.com/pbakaus/impeccable

Install pada project root sesuai petunjuk resmi.

  npx impeccable install

Tujuan:

- Visual design.
- Design language.
- Typography.
- Color system.
- Layout.
- Responsive adaptation.
- UI audit.
- Menghindari generic AI design.

Gunakan pada tahap design foundation dan UI review.

Jangan menjalankan full visual audit setelah setiap
perubahan backend.

## 33.2 React Best Practices

Repository:

https://github.com/vercel-labs/agent-skills

Tujuan:

- React architecture.
- Rendering optimization.
- Bundle optimization.
- Data fetching.
- Performance review.

Gunakan ketika:

- Membuat feature React.
- Memperbaiki performance.
- Melakukan frontend review.

Jangan menerapkan aturan yang hanya relevan untuk
Next.js pada proyek React + Vite.

## 33.3 Web Design Guidelines

Repository:

https://github.com/vercel-labs/agent-skills

Tujuan:

- Accessibility.
- Forms.
- Interaction.
- Interface consistency.
- Responsive behavior.
- Web interface review.

Gunakan setelah modul UI selesai atau sebelum release.

## 33.4 Skill usage policy

- Jangan membaca semua skill pada setiap task.
- Pilih skill sesuai kebutuhan.
- Hindari skill dengan aturan yang saling bertentangan.
- PRD.md dan AGENTS.md menjadi project-level authority.
- Verifikasi skill installer dari repository resmi.
- Review hook sebelum mengaktifkannya.
- Jangan memberi skill akses secret produksi.

---

# 34. AI AGENT WORKING RULES

Buat AGENTS.md berdasarkan bagian ini.

## 34.1 Before coding

1. Baca PRD.md sesuai bagian yang relevan.
2. Baca AGENTS.md.
3. Baca dokumentasi modul terkait.
4. Periksa git status.
5. Identifikasi file yang perlu diubah.
6. Buat rencana kerja singkat.
7. Implementasikan satu scope yang jelas.

Jangan langsung membuat seluruh aplikasi sekaligus.

## 34.2 Context efficiency

- Jangan melakukan full repository scan berulang.
- Gunakan targeted file search.
- Baca file yang relevan saja.
- Gunakan ROADMAP.md sebagai progress tracker.
- Gunakan ARCHITECTURE.md sebagai repository map.
- Jangan mengulang konteks PRD secara verbatim.
- Jangan membaca node_modules.
- Jangan membaca dist kecuali debugging build.
- Jangan membaca file binary atau generated output.
- Hindari output terminal yang terlalu panjang.
- Gunakan ringkasan hasil test.

## 34.3 Editing rules

- Jangan rewrite file yang tidak berkaitan.
- Jangan menghapus fitur yang telah berjalan.
- Jangan membuat duplikasi komponen.
- Jangan mengubah public API contract diam-diam.
- Jangan mengubah schema database tanpa migration.
- Jangan mengganti technology stack tanpa alasan.
- Jangan menginstal dependency yang tidak diperlukan.
- Jangan memperbaiki unrelated code dalam task yang sama.
- Jangan menambahkan mock data pada production build.
- Jangan menggunakan TODO untuk menggantikan fitur inti.

## 34.4 Dependency policy

Sebelum menambah dependency:

1. Periksa dependency yang sudah tersedia.
2. Evaluasi native browser atau platform API.
3. Evaluasi bundle impact.
4. Periksa lisensi dan kompatibilitas.
5. Dokumentasikan alasan jika dependency signifikan.

## 34.5 Security policy

- Jangan mencetak secret.
- Jangan membaca secret production tanpa kebutuhan.
- Jangan memasukkan secret ke commit.
- Jangan mematikan security validation agar test lulus.
- Jangan mengganti private file menjadi public.
- Jangan melemahkan password hashing.
- Jangan bypass Turnstile pada production.
- Jangan menggunakan real participant data dalam test.

## 34.6 After coding

Jalankan pengujian yang relevan:

- Typecheck.
- Lint.
- Unit test.
- Integration test.
- Build jika diperlukan.

Update:

- ROADMAP.md.
- CHANGELOG.md.
- API.md jika kontrak berubah.
- DATABASE.md jika schema berubah.
- ARCHITECTURE.md jika struktur berubah.

Laporkan secara singkat:

- Ringkasan perubahan.
- File yang diubah.
- Hasil pengujian.
- Blocker.
- Keputusan teknis.
- Langkah berikutnya.

## 34.7 Approval boundaries

AI Agent boleh:

- Membuat dan mengedit source code lokal.
- Membuat migration lokal.
- Menjalankan test lokal.
- Menyiapkan konfigurasi.
- Menyiapkan deployment scripts.

AI Agent harus meminta persetujuan sebelum:

- Deploy production.
- Push ke main jika belum diizinkan.
- Menjalankan migration production.
- Menghapus database.
- Menghapus Google Drive files produksi.
- Mengirim email ke peserta asli.
- Mengaktifkan layanan berbayar.
- Mengubah domain produksi.
- Mengubah arsitektur inti.
- Menghapus data pengguna.

---

# 35. GIT AND GITHUB WORKFLOW

Gunakan private GitHub repository.

Branches:

main:
  Production-ready code.

dev:
  Integration dan development.

feature/*:
  Pengembangan fitur.

fix/*:
  Bug fixes.

Contoh:

  feature/dynamic-form
  feature/certificate-generation
  fix/download-window

Commit convention:

- feat:
- fix:
- refactor:
- perf:
- test:
- docs:
- chore:
- security:

Jangan melakukan force push ke main.

Jangan commit secret atau participant data.

Gunakan GitHub Actions untuk:

- npm ci.
- Typecheck.
- Lint.
- Unit tests.
- Build.
- Integration tests jika environment tersedia.

Deployment:

- dev dapat menuju staging.
- main menuju production setelah approval.
- Production migrations membutuhkan approval.
- Apps Script deployment dikelola secara terpisah.

---

# 36. TESTING STRATEGY

## 36.1 Unit tests

- Placeholder parser.
- Field normalization.
- Dynamic form validation.
- Number formatting.
- Roman month conversion.
- Period eligibility.
- Event status computation.
- HMAC signature.
- OTP verification.
- Filename sanitization.
- Document status transitions.

## 36.2 Integration tests

- Admin login.
- Session expiration.
- Event CRUD.
- Template import.
- Form versioning.
- Participant submission.
- Concurrent duplicate submission.
- Concurrent quota enforcement.
- Atomic numbering.
- Job claim.
- Job retry.
- Apps Script signed integration.
- Generation reconciliation.
- Private PDF authorization.
- Email queue.
- Document regeneration.
- Document revocation.
- Retention cleanup.

Gunakan mock Apps Script untuk test standar.

Gunakan dedicated staging Apps Script untuk real
integration smoke test.

## 36.3 E2E tests

Public scenario:

- Open dashboard.
- Navigate months.
- Select event.
- Fill dynamic form.
- Submit.
- Receive recovery code.
- View document status.
- Preview PDF.
- Download PDF.
- Search and recover certificate.
- Verify QR destination.

Admin scenario:

- Login.
- Create event.
- Import template.
- Configure form.
- Publish event.
- Approve participant.
- Generate document.
- Regenerate document.
- Generate award.
- Retry failed job.
- Export report.
- Close event.
- Logout.

## 36.4 Responsive tests

Test viewport:

- 320 px.
- 375 px.
- 390 px.
- 768 px.
- 1024 px.
- 1366 px.
- 1920 px.

Pastikan:

- Tidak ada unwanted horizontal overflow.
- Semua kontrol utama dapat diakses.
- Form dapat digunakan.
- Dialog tidak terpotong.
- Event cards konsisten.
- Admin navigation berfungsi.

## 36.5 Security tests

- Invalid session.
- Expired session.
- Unauthorized admin route.
- CSRF attempt.
- Invalid Turnstile token.
- Invalid PIN.
- Search enumeration.
- Invalid recovery code.
- OTP brute force.
- Invalid HMAC signature.
- Replay request.
- Unauthorized document ID.
- Download outside allowed period.
- Revoked document access.
- SQL injection.
- XSS payload.
- Malicious upload.
- CSV formula injection.

## 36.6 Load tests

Target staging:

- 100 participant registrations per event.
- Burst test dengan concurrent requests yang realistis.
- Duplicate registration race.
- Number allocation race.
- Limited Google generation concurrency.
- Email quota exhaustion.
- Temporary Apps Script unavailable.

Keberhasilan tidak mengharuskan 100 PDF dibuat
secara simultan.

Semua submission valid harus tersimpan atau menerima
error yang jelas, tanpa kehilangan data diam-diam.

---

# 37. ACCEPTANCE CRITERIA

## AC-01 Public dashboard

Given pengguna membuka dashboard,
when halaman berhasil dimuat,
then bulan dan tahun berjalan ditampilkan,
dan statistik sesuai bulan tersebut.

## AC-02 Month navigation

Given bulan Desember 2026 dipilih,
when pengguna menekan bulan berikutnya,
then Januari 2027 ditampilkan.

## AC-03 Closed event

Given periode pengisian dan unduh telah berakhir,
when kegiatan ditampilkan,
then kartu tetap terlihat,
dan seluruh tindakan publik dinonaktifkan.

## AC-04 Server-side period enforcement

Given peserta memanggil API secara manual setelah
periode pengisian berakhir,
then backend menolak submission.

## AC-05 Dynamic placeholder

Given Google Docs memiliki {{nama_lengkap}},
when admin melakukan import,
then placeholder terdeteksi dan dapat dipetakan.

## AC-06 Additional field

Given NIK tidak terdapat pada Google Docs,
when admin menambahkan field manual,
then NIK dapat digunakan sebagai unique/search key.

## AC-07 Form versioning

Given form telah digunakan peserta,
when admin memperbarui konfigurasi,
then versi lama tetap tersimpan.

## AC-08 Duplicate prevention

Given dua request bersamaan menggunakan unique key sama,
then hanya satu participant record diterima.

## AC-09 Quota enforcement

Given kuota kegiatan adalah 100,
when beberapa peserta mendaftar pada slot terakhir,
then jumlah peserta tidak melampaui kuota.

## AC-10 Automatic issuance

Given submission valid dan issuance mode AUTO,
then generation job dibuat dan dapat diproses.

## AC-11 Manual approval

Given issuance mode MANUAL_APPROVAL,
then PDF tidak diterbitkan sebelum admin approve.

## AC-12 Unique numbering

Given beberapa dokumen diterbitkan bersamaan,
then setiap document number unik.

## AC-13 Generation idempotency

Given generation request yang sama diulang,
then tidak ada nomor sertifikat tambahan.

## AC-14 PDF download

Given peserta memiliki grant yang valid,
dan periode download terbuka,
then PDF dapat diunduh.

## AC-15 Unauthorized PDF

Given pengguna mengetahui document public ID saja,
then PDF tidak dapat diunduh tanpa otorisasi.

## AC-16 Search security

Given pengguna memasukkan NIK tanpa recovery code
atau OTP yang sah,
then PDF dan data pribadi tidak diberikan.

## AC-17 Email failure

Given kuota email habis,
then PDF tetap dapat diterbitkan,
dan email masuk deferred quota queue.

## AC-18 Regeneration

Given admin mengoreksi nama peserta,
when dokumen diregenerate,
then nomor sertifikat tetap sama,
dan revision number bertambah.

## AC-19 QR verification

Given verification code valid,
then halaman verifikasi menampilkan status dokumen
tanpa mengungkap NIK atau email.

## AC-20 Revocation

Given dokumen telah dicabut,
then download ditolak,
dan halaman verifikasi menampilkan status revoked.

## AC-21 Award restriction

Given pengguna tidak login sebagai admin,
then API penerbitan piagam tidak dapat digunakan.

## AC-22 Award bulk import

Given admin mengimpor 100 baris data,
then baris invalid ditampilkan,
dan baris valid dapat diproses secara batch.

## AC-23 Private Google Drive

Given PDF berhasil diterbitkan,
then file Google Drive tetap restricted.

## AC-24 Admin authentication

Given session sudah expired,
then seluruh protected admin APIs menolak request.

## AC-25 Auditability

Given admin mengubah data atau mencabut dokumen,
then tindakan tercatat pada audit log.

## AC-26 Responsive interface

Given pengguna membuka aplikasi pada viewport 320 px,
then fitur utama tetap dapat digunakan tanpa overflow
yang tidak diinginkan.

## AC-27 Job recovery

Given processor berhenti ketika generation sedang berjalan,
then abandoned job dapat direkonsiliasi dan diproses
kembali tanpa menerbitkan nomor baru.

## AC-28 Template reproducibility

Given template sumber Google Docs telah berubah,
then dokumen lama tetap memiliki referensi snapshot
dan versi template yang digunakan saat penerbitan.

## AC-29 Privacy

Given public API response diperiksa,
then tidak ada NIK lengkap, email pribadi, Drive file ID,
atau secret yang tidak diperlukan.

## AC-30 Deployment safety

Given staging sedang diuji,
then tidak ada email atau perubahan data produksi.

---

# 38. IMPLEMENTATION ROADMAP

Jangan mengimplementasikan seluruh fase sekaligus.

## Phase 0 - Project foundation

Deliverables:

- Initialize repository.
- Setup React + Vite + TypeScript.
- Setup Cloudflare Workers + Hono.
- Setup Tailwind CSS.
- Setup ESLint dan Prettier.
- Setup shared schemas.
- Setup environment configuration.
- Setup Wrangler.
- Setup testing tools.
- Create AGENTS.md.
- Create architecture documents.
- Create ROADMAP.md.
- Create DESIGN.md.
- Install relevant AI Agent skills.

Acceptance:

- Frontend berjalan lokal.
- Worker health endpoint berjalan.
- Typecheck berhasil.
- Build berhasil.
- Tidak ada secret dalam repository.

## Phase 1 - Security and Google integration feasibility

Deliverables:

- D1 local setup.
- R2 local setup.
- Secure session authentication.
- Password KDF benchmark.
- Signed Apps Script integration.
- Template read test.
- PDF export test.
- Private PDF transfer test.
- QR insertion test.
- MailApp quota test.
- Apps Script timeout/retry test.

Acceptance:

- Authentication aman dalam batas target runtime.
- PDF dapat dibuat dan diunduh tanpa public Drive sharing.
- Integration rejects invalid signature.
- Integration is compatible with target free tier.

Jadikan phase ini technical gate sebelum pembangunan
seluruh business modules.

## Phase 2 - Database and core admin

Deliverables:

- SQL migrations.
- Admin dashboard.
- Admin layout.
- User management.
- Settings management.
- Category management.
- Audit log.

## Phase 3 - Event management

Deliverables:

- Event CRUD.
- Event editor.
- Flyer upload.
- Lifecycle management.
- Registration/download periods.
- Quota configuration.
- Duplicate event.
- Publication validation.

## Phase 4 - Templates and dynamic forms

Deliverables:

- Template import.
- Placeholder extraction.
- Snapshot versioning.
- Placeholder mapping.
- Dynamic form builder.
- Field validation.
- Form versioning.
- Template test generation.

## Phase 5 - Public interface and participants

Deliverables:

- Public dashboard.
- Monthly statistics.
- Month/year navigation.
- Event filters.
- Event cards.
- Dynamic form renderer.
- Attendance PIN.
- Whitelist.
- Duplicate prevention.
- Participant quota.
- Manual approval.

## Phase 6 - Document generation

Deliverables:

- Numbering engine.
- Document table.
- Generation jobs.
- Apps Script PDF generation.
- Drive private storage.
- Status polling.
- QR Code.
- Idempotency.
- Regeneration.
- Revocation.

## Phase 7 - PDF delivery and recovery

Deliverables:

- Recovery code.
- Email OTP.
- Search authorization.
- Download grants.
- PDF preview.
- Private download.
- Verification page.
- Download period enforcement.

## Phase 8 - Email delivery

Deliverables:

- Email template.
- PDF attachment.
- Job queue.
- Quota management.
- Retry.
- Resend.
- Email monitor.

## Phase 9 - Awards

Deliverables:

- Manual generation.
- Bulk import.
- Import from participants.
- Award categories.
- Admin-only distribution.
- Award verification.

## Phase 10 - Reports and operations

Deliverables:

- Dashboard statistics.
- Charts.
- CSV/XLSX export.
- Job monitoring.
- Retention configuration.
- Cleanup scripts.
- Backup and recovery documentation.

## Phase 11 - Quality assurance

Deliverables:

- Responsive audit.
- Impeccable UI review.
- Accessibility audit.
- React performance audit.
- Security review.
- Load testing.
- Integration testing.
- Bug fixes.

## Phase 12 - Staging and production release

Deliverables:

- GitHub repository.
- CI workflow.
- Staging deployment.
- Staging acceptance testing.
- Production bindings.
- Production Google Drive folders.
- Production Apps Script deployment.
- Database migrations.
- Custom domain.
- Backup.
- Operational documentation.

Production deployment membutuhkan persetujuan pemilik.

---

# 39. BACKUP AND RECOVERY

Dokumentasikan prosedur:

- D1 database export/backup.
- Google Drive PDF backup.
- Template snapshot backup.
- R2 flyer backup.
- Secret rotation.
- Restore testing.
- Deployment rollback.
- Migration recovery.

Jangan menyimpan backup data peserta pada GitHub.

Backup harus memiliki access control dan encryption
yang sesuai.

Penghapusan melalui retensi harus memperhitungkan
siklus retensi backup.

Lakukan restore test sebelum production launch.

---

# 40. DEFINITION OF DONE

Fitur dinyatakan selesai apabila:

- Functional requirement terpenuhi.
- Acceptance criteria terpenuhi.
- Tidak ada TypeScript error.
- Tidak ada lint error yang belum ditangani.
- Relevant tests lulus.
- API validation tersedia.
- Authentication dan authorization tersedia.
- Loading state tersedia.
- Empty state tersedia.
- Error state tersedia.
- Responsive behavior telah diuji.
- Dokumentasi diperbarui.
- Tidak ada hardcoded secret.
- Tidak ada mock production data.
- Tidak ada known critical security issue.
- Tidak ada data pribadi yang bocor melalui API.
- Tidak ada perubahan di luar scope tanpa alasan.
- Fitur dapat dipelihara secara modular.

---

# 41. INITIAL INSTRUCTIONS FOR AI AGENT

Anda bertindak sebagai senior full-stack engineer,
software architect, security engineer, dan UI/UX engineer
untuk membangun ECER.

Gunakan dokumen PRD ini sebagai single source of truth
untuk business requirements.

Jangan langsung mengimplementasikan seluruh fitur.

Tugas pertama:

1. Baca seluruh PRD.md satu kali.
2. Analisis kelayakan arsitektur.
3. Identifikasi technical risks.
4. Verifikasi dokumentasi resmi platform.
5. Periksa batas Cloudflare Workers Free.
6. Periksa batas D1 dan R2.
7. Periksa Google Apps Script integration constraints.
8. Buat AGENTS.md yang ringkas.
9. Buat PRODUCT.md dan DESIGN.md.
10. Buat docs/ARCHITECTURE.md.
11. Buat docs/DATABASE.md.
12. Buat docs/API.md.
13. Buat docs/SECURITY.md.
14. Buat docs/ROADMAP.md.
15. Buat initial implementation plan.
16. Inisialisasi hanya Phase 0.
17. Jalankan local health check.
18. Laporkan hasil dan technical blockers.
19. Jangan masuk Phase 1 tanpa persetujuan.

Jika terdapat perubahan yang diperlukan terhadap PRD,
buat Architecture Decision Record pada docs/decisions/.

Jelaskan alasan, trade-off, dampak biaya, dan dampak
keamanan sebelum mengubah arsitektur utama.

Prioritaskan:

1. Security.
2. Correctness.
3. Maintainability.
4. User experience.
5. Performance.
6. Cost efficiency.
7. Token efficiency.

Jangan mengorbankan keamanan demi biaya gratis.

END OF PRODUCT REQUIREMENTS DOCUMENT.
