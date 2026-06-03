<div align="center">

# 🧠 MemorAI

**Yapay zekâ destekli kişisel ajanda — görevler, notlar ve hatırlatıcılar tek bir yerde.**

Doğal dille konuş, AI senin için planlasın.

![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android-blue)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Capacitor-orange)
![AI](https://img.shields.io/badge/AI-GPT--4o--mini-success)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

</div>

---

## ✨ Özellikler

### 📋 Görev Yönetimi
- Öncelik (Düşük / Orta / Yüksek), kategori (İş / Kişisel / Okul / Sağlık), tarih, saat
- Arama + sıralama (tarih, öncelik, ad)
- Silinmiş görevi geri al (5 sn'lik undo)
- Liste ve **mobil için yeniden tasarlanmış haftalık görünüm** (gün seçici tasarım)

### 🤖 AI Asistan (OpenRouter + GPT-4o-mini)
- Doğal dille görev/not oluştur, güncelle, sil, listele
- **Eksik detayları seçenekli sorularla belirler** — örn. "yarın saat 15'te toplantı ekle" deyince hatırlatıcı zamanını butonlu seçeneklerle sorar
- Bağlamı kendi çıkarır — "okul ödevi" deyince kategoriyi otomatik seçer, sormaz
- Sohbet geçmişi (oturumlar arası kaydedilir)
- Tool-action rozetleri, kopyala butonu, öneri çipleri

### 🔔 Hatırlatıcılar (Android)
- Yerel bildirim — uygulama kapalıyken bile çalışır
- 9 hazır zaman seçeneği (tam zamanında, 5/10/15/30 dk önce, 1/2/3 saat önce, 1 gün önce)
- Tam saatinde (exact alarm) tetiklenir

### 📝 Notlar
- Serbest metin veya kontrol listesi tipi
- Düzenleme + arama

### 🗂️ Geçmiş Görevler
- Tamamlandıktan sonra silinen görevlerin kaydı
- Tarih aralığı filtreleme
- Tamamlanmadan silinenler kaydedilmez

### 📱 Mobil-First Tasarım
- **App-shell layout** — sadece görev listesi kayar, üst başlık/filtreler pinli
- Bottom-sheet modallar (görev ekle, detay)
- Tam ekran sayfalar (Ayarlar, Geçmiş)
- Donanım geri tuşu desteği + çift basışla çıkış
- iOS/Android güvenli alan (notch/gesture bar) desteği

---

## 🛠️ Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Saf HTML / CSS / JavaScript (build adımı yok) |
| **Mobil paketleme** | [Capacitor 6](https://capacitorjs.com/) |
| **Web sunucu** | [Express.js](https://expressjs.com/) (sadece web için proxy) |
| **AI** | [OpenRouter](https://openrouter.ai/) → GPT-4o-mini |
| **Bildirim** | `@capacitor/local-notifications` |
| **Veri** | LocalStorage (cihaz içi) |

---

## 🚀 Kurulum (Web)

```bash
git clone https://github.com/Holdz0/MemorAI.git
cd MemorAI
npm install
cp .env.example .env
# .env içine OpenRouter API anahtarını yaz
npm start
```

→ `http://localhost:3000`

API anahtarı: [openrouter.ai/keys](https://openrouter.ai/keys) (ücretsiz)

---

## 📱 Android APK Build

**Gereksinimler:** [Android Studio](https://developer.android.com/studio), JDK 17+

```bash
npm install
npx cap sync android
npx cap open android
```

Android Studio'da: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

APK çıktısı: `android/app/build/outputs/apk/debug/app-debug.apk`

### Mobilde API anahtarı

Mobil sürümde sunucu proxy yoktur — kullanıcı kendi anahtarını uygulama içinden girer:

1. Uygulamayı aç
2. Sağ üst → ⚙️ **Ayarlar**
3. **Yapay Zekâ Asistanı** bölümünden anahtarı yapıştır → **Kaydet**

Anahtar yalnızca cihazda (`localStorage`) saklanır.

---

## 📁 Proje Yapısı

```
MemorAI/
├── www/                       # Ortak web dosyaları (web + APK)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js             # Görev/not yönetimi, modallar, geri tuşu
│       └── ai.js              # AI asistan + OpenRouter
├── android/                   # Capacitor Android projesi
├── server.js                  # Web: Express + /api/chat proxy
├── capacitor.config.json
├── package.json
└── .env.example
```

---

## 🔐 Güvenlik

- API anahtarı kodda **asla** saklanmaz — `.env` (web) veya kullanıcı girişi (mobil) üzerinden alınır
- `.env`, `*.keystore`, `*.apk` ve `node_modules/` git'e dahil değildir
- Web sürümünde anahtar tarayıcıya **hiç ulaşmaz** — yalnızca sunucu üzerinden proxy'lenir
- Mobil sürümde anahtar cihaz `localStorage`'ında kalır, hiçbir yere gönderilmez (yalnızca doğrudan OpenRouter'a)

---

## 📋 Roadmap

- [ ] Tema seçimi (açık / koyu)
- [ ] Dışa/içe aktarma (JSON yedek)
- [ ] PWA desteği (web sürümü için)
- [ ] iOS APK desteği
- [ ] Çoklu dil desteği

---

## 📄 Lisans

MIT © [Holdz0](https://github.com/Holdz0)

---

<div align="center">

**🤝 Katkıda bulunmak ister misin?** Issue veya pull request açmaktan çekinme!

</div>
