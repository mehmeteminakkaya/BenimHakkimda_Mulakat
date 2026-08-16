<div align="center">

# 🎙️ BenimHakkımda — İnteraktif & Sesli AI Mülakat Koçu

[![Live Demo](https://img.shields.io/badge/Canl%C4%B1%20Demo-benimhakkimda--aim--lakat.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://benimhakkimda-aim-lakat.vercel.app/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Audio](https://img.shields.io/badge/Audio-Web%20Speech%20%7C%20Web%20Audio%20API-FF6F00?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Adayların teknik ve yetkinlik mülakatlarına sesli ve yazılı etkileşimle hazırlanmasını sağlayan yapay zekâ simülatörü.</strong><br>
  Yapay zekâ sorar, aday sesli yanıtlar; sistem STAR metodolojisi, özgüven, netlik ve teknik doğruluk analizi yapar.
</p>

[Canlı Demoyu Aç ↗](https://benimhakkimda-aim-lakat.vercel.app/) • [Nasıl Çalışır?](#-nas%C4%B1l-%C3%A7al%C4%B1%C5%9F%C4%B1r) • [Kurulum](#-yerel-kurulum) • [Geliştirici](#-geli%C5%9Ftirici)

---

</div>

## 🌟 Proje Özeti & Değer Vaadi

İş arayan ve mülakatlara hazırlanan adayların en büyük zorluğu, gerçek bir insan karşısında konuşuyormuş gibi pratik yapamamalarıdır.

**BenimHakkımda**, adaya gerçekçi bir mülakat odası simülasyonu sunar:
* 🎤 **Ses Tanıma (STT) & Ses Sentezi (TTS):** Aday konuşarak yanıt verir, yapay zekâ sesli olarak soru yöneltir.
* 🧠 **STAR Metodolojisi Değerlendirmesi:** *Durum (Situation), Görev (Task), Eylem (Action), Sonuç (Result)* uyumunu anlık puanlar.
* 📊 **Detaylı Yetkinlik Karnesi:** Netlik, özgünlük, kısalık, teknik doğruluk ve özgüven metrikleriyle geri bildirim raporu üretir.
* 🔒 **Kriptografik Sonuç Doğrulama:** Skor manipülasyonunu engelleyen HMAC token tabanlı veri imzalama motoru.

---

## 🏗️ Sistem Mimarisi

```mermaid
graph LR
    Aday([Aday / Kullanıcı]) <-->|Mikrofon & Hoparlör| UI[Web Arayüzü / Web Audio]
    UI <-->|JSON + HMAC Token| Express[Node.js / Express Backend]
    Express <-->|Prompt & Analiz| Gemini[Google Gemini 1.5 Flash API]
    Express --> Security[Rate Limiter & HMAC Token Signer]
    UI --> Vercel[Vercel Serverless Function / api/[...path].js]
```

---

## ✨ Temel Yetenekler

| Kategori | Özellik | Açıklama |
| :--- | :--- | :--- |
| 🎯 **Mülakat Türleri** | Çoklu Rol Desteği | Yazılım Mühendisliği, Proje Yönetimi, İK & Davranışsal Mülakatlar |
| 🗣️ **Sesli Etkileşim** | Web Speech API | Gerçek zamanlı konuşma tanıma ve doğal ses tonuyla geri seslendirme |
| 📈 **Puanlama Motoru** | Çok Katmanlı Skorlama | Teknik Doğruluk (%100), Özgüven, Netlik ve STAR uyum analizi |
| 📝 **Akıllı Gelişim Planı** | Kişiye Özel Rapor | Güçlü yönler, zayıf noktalar ve mülakatı kazanmak için aksiyon adımları |
| 🛡️ **Güvenlik & Hız** | Rate Limiting | DDoS ve kota aşımını engelleyen IP bazlı hız kısıtlayıcı |

---

## 🚀 Yerel Kurulum

### Ön Koşullar
* Node.js 18+
* [Google AI Studio Gemini API Key](https://aistudio.google.com/)

### Adımlar:
```bash
# 1. Projeyi klonlayın
git clone https://github.com/mehmeteminakkaya/Benimhakkimda.aim-lakat.git
cd Benimhakkimda.aim-lakat

# 2. Bağımlılıkları yükleyin
npm install

# 3. Ortam değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasına GEMINI_API_KEY bilginizi ekleyin

# 4. Sunucuyu başlatın
npm start
# veya geliştirme modu için:
npm run dev
```

Tarayıcınızda `http://localhost:3000` adresini açarak mülakata başlayabilirsiniz.

---

## 👨‍💻 Geliştirici & İletişim

**Mehmet Emin Akkaya**  
*İstinye Üniversitesi Bilgisayar Mühendisliği*

* 🌐 **Portfolyo:** [mehmeteminakkaya.com](https://mehmeteminakkaya.com)
* 💼 **LinkedIn:** [linkedin.com/in/mehmeteminakkaya](https://www.linkedin.com/in/mehmeteminakkaya/)
* 🐙 **GitHub:** [@mehmeteminakkaya](https://github.com/mehmeteminakkaya)
* 📬 **E-Posta:** [aktaha@gmail.com](mailto:aktaha@gmail.com)

---

<div align="center">
  <sub>Telif Hakkı © 2026 Mehmet Emin Akkaya. Tüm hakları saklıdır.</sub>
</div>
