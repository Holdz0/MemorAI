# 📅 Premium Ajanda

Kişisel görev yönetimi ve yapay zekâ destekli ajanda uygulaması. Hem web hem de Android APK olarak çalışır.

## ✨ Özellikler

- **Görev yönetimi** — öncelik, kategori, tarih/saat, açıklama
- **Hatırlatıcılar** — yerel bildirim ile (Android) görev saatinden önce hatırlat
- **Notlar** — serbest metin ve liste tipinde
- **Haftalık takvim görünümü** — mobilde gün seçici tasarım
- **AI Asistan** (OpenRouter / GPT-4o-mini) — doğal dille görev/not yönetimi
  - Eksik detayları seçenekli sorularla belirleme (ör. hatırlatıcı zamanı)
  - Görev oluşturma, güncelleme, tamamlama, silme
  - Sohbet geçmişi
- **Geçmiş görevler** — tamamlanıp silinen görevlerin tarih filtrelenebilir kaydı
- **Mobil-first tasarım** — app-shell, bottom-sheet modallar, tam ekran sayfalar
- **Android donanım geri tuşu** desteği

## 🛠 Teknoloji

- Saf HTML/CSS/JavaScript (build adımı yok)
- [Express.js](https://expressjs.com/) — web sürümü için API proxy
- [Capacitor](https://capacitorjs.com/) — Android APK için sarmalayıcı
- [OpenRouter](https://openrouter.ai/) — AI asistan API'si
- LocalStorage — veri kalıcılığı

## 🚀 Kurulum (Web)

```bash
npm install
cp .env.example .env
# .env dosyasını aç ve OPENROUTER_API_KEY'i kendi anahtarınla doldur
npm start
```

→ Tarayıcıda `http://localhost:3000` aç.

API anahtarı [openrouter.ai/keys](https://openrouter.ai/keys) adresinden ücretsiz alınabilir.

## 📱 Android APK Build

Gereksinimler: [Android Studio](https://developer.android.com/studio) + JDK 17+

```bash
npm install
npx cap sync android
npx cap open android
```

Android Studio açılınca: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk`

### Mobilde API anahtarı

Mobil sürümde sunucu proxy yoktur — kullanıcı kendi API anahtarını uygulama içinden girer:

1. Uygulamayı aç
2. Sağ üstteki ⚙️ Ayarlar
3. **Yapay Zekâ Asistanı** bölümünden anahtarını yapıştır → Kaydet

Anahtar yalnızca cihazda saklanır.

## 📁 Proje Yapısı

```
ajanda/
├── www/                    # Mobil + web ortak web dosyaları
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js          # Ana uygulama mantığı
│       └── ai.js           # AI asistan + OpenRouter entegrasyonu
├── android/                # Capacitor Android projesi
├── server.js               # Web sürümü için Express + proxy
├── capacitor.config.json
├── package.json
└── .env.example            # Ortam değişkeni şablonu
```

## 🔐 Güvenlik Notları

- API anahtarı ASLA koda gömme — `.env` dosyası kullan (gitignored)
- `.env` ve `*.keystore` dosyaları `.gitignore`'da
- Mobil sürümde kullanıcı kendi anahtarını girer; sunucu sürümünde anahtar tarayıcıya ulaşmaz (proxy üzerinden)

## 📄 Lisans

MIT
