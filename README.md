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

## 🎯 Problem ve Hedef Kullanıcı

Öğrenciler ve yoğun çalışanlar görevlerini, notlarını ve hatırlatıcılarını çoğu zaman ayrı uygulamalara dağıtıyor. Yeni bir iş eklemek bile form doldurmayı gerektirdiği için kayıtlar eksik kalıyor ve işler unutuluyor. **MemorAI** bu üçünü tek bir yerde topluyor ve *"yarın 15:00'te diş doktoru"* gibi doğal dille yazılan bir isteği tarihli, hatırlatıcılı bir göreve çeviriyor.

**Kimin için:** Dersini, işini ve kişisel işlerini tek bir telefon ya da tarayıcıdan yönetmek isteyen **üniversite öğrencileri ve genç çalışanlar**.

## 📌 Proje Panosu

İş takibi GitHub Projects üzerinde yapılıyor → **[MemorAI — DevOps Panosu](https://github.com/users/Holdz0/projects/2)**

Sütunlar: **Yapılacak → Devam Ediyor → Tamamlandı**. Her kart bir issue; kısa açıklama ve kabul kriterleri kartın içinde, ilgili pull request kartın altında bağlı.

Bu çalışmada geliştirilen iki görev:

| Görev | Pull Request |
|-------|--------------|
| [#1 Açık/koyu tema seçimi](https://github.com/Holdz0/MemorAI/issues/1) | [#7](https://github.com/Holdz0/MemorAI/pull/7) |
| [#2 JSON yedek: dışa/içe aktarma](https://github.com/Holdz0/MemorAI/issues/2) | [#8](https://github.com/Holdz0/MemorAI/pull/8) |

---

## ✨ Özellikler

### 📋 Görev Yönetimi
- Öncelik (Düşük / Orta / Yüksek), kategori (İş / Kişisel / Okul / Sağlık), tarih, saat
- Arama + sıralama (tarih, öncelik, ad)
- Silinmiş görevi geri al (5 sn'lik undo)
- Liste ve **mobil için yeniden tasarlanmış haftalık görünüm** (gün seçici tasarım)

### 🤖 AI Asistan (OpenRouter)
- **Ana ekranda komut çubuğu** — "Asistana yaz…" kutusu ve öneri çipleri; yapılan işlemler, AI'nın soruları ve yanıt çubuğun altında görünür
- **Model seçimi** — Ayarlar → Model bölümünden OpenRouter modellerini ara ve seç (yalnızca tool calling destekleyenler; varsayılan GPT-4o-mini)
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

### ⚙️ Görünüm ve Veri
- **Açık / Koyu / Sistem** teması — seçim hatırlanır
- **JSON yedek** — görevler, notlar ve geçmiş tek dosyaya dışa aktarılır, başka cihazda içe aktarılır

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
| **AI** | [OpenRouter](https://openrouter.ai/) → seçilebilir model (varsayılan GPT-4o-mini) |
| **Bildirim** | `@capacitor/local-notifications` |
| **Veri** | LocalStorage (cihaz içi) |

---

## 🚀 Çalıştırma (Web)

**Gereksinim:** [Node.js](https://nodejs.org/) 20.12+

```bash
git clone https://github.com/Holdz0/MemorAI.git
cd MemorAI
npm install
npm start
```

→ Tarayıcıda **http://localhost:3000** adresini aç.

> **API anahtarı isteğe bağlıdır.** Anahtar olmadan görevler, notlar, tema ve yedek özellikleri tam çalışır; yalnızca AI asistanı yanıt vermez. Asistanı da denemek için `.env.example` dosyasını `.env` adıyla kopyala, içine [OpenRouter anahtarını](https://openrouter.ai/keys) (ücretsiz) yaz ve sunucuyu yeniden başlat.

**Testler:** `npm test`

---

## 🧪 Geliştirilen Özellikleri Deneme

### 1) Açık / Koyu Tema — [#1](https://github.com/Holdz0/MemorAI/issues/1) · [PR #7](https://github.com/Holdz0/MemorAI/pull/7)

1. Sağ üstteki ⚙️ **Ayarlar** ikonuna tıkla.
2. **Görünüm** bölümünde **Açık**'ı seç → ana ekran, pencereler ve ayarlar anında açık renge geçer.
3. Sayfayı yenile (F5) → seçim korunur, açılışta koyu ekran yanıp sönmez.
4. **Sistem**'i seç → uygulama işletim sisteminin temasını izler (Windows: *Ayarlar → Kişiselleştirme → Renkler → Modunuzu seçin*).

### 2) JSON Yedek — [#2](https://github.com/Holdz0/MemorAI/issues/2) · [PR #8](https://github.com/Holdz0/MemorAI/pull/8)

1. **+ Yeni görev** ile birkaç görev, **Notlar** sekmesinden bir not ekle.
2. ⚙️ **Ayarlar → Veri → Dışa Aktar** → `memorai-yedek-YYYY-MM-DD.json` dosyası iner.
3. Aynı adresi gizli pencerede aç (Ctrl+Shift+N) → liste boştur.
4. Orada **Ayarlar → Veri → İçe Aktar** → indirdiğin dosyayı seç → onayla → görevler ve notlar geri gelir.
5. **Bozuk dosya:** İçe Aktar ile projedeki `package.json`'ı seç → *"Geçersiz yedek dosyası — mevcut veri korundu"* mesajı çıkar, veriler değişmez.
6. Doğrulama mantığının otomatik testleri: `npm test`

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
│       ├── app.js             # Görev/not yönetimi, modallar, tema, geri tuşu
│       ├── backup.js          # JSON yedek: dışa/içe aktarma
│       └── ai.js              # AI asistan + OpenRouter
├── test/                      # node:test birim testleri (npm test)
├── android/                   # Capacitor Android projesi
├── server.js                  # Web: Express + /api/chat ve /api/models proxy
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

Güncel durum için [proje panosuna](https://github.com/users/Holdz0/projects/2) bak.

- [x] Tema seçimi (açık / koyu)
- [x] Dışa/içe aktarma (JSON yedek)
- [ ] PWA desteği (web sürümü için)
- [ ] GitHub Actions ile CI
- [ ] Çoklu dil desteği
- [ ] iOS desteği

---

## 📄 Lisans

MIT © [Holdz0](https://github.com/Holdz0)

---

<div align="center">

**🤝 Katkıda bulunmak ister misin?** Issue veya pull request açmaktan çekinme!

</div>
