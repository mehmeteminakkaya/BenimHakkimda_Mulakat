<div align="center">

# 🎙️ BenimHakkımda — İnteraktif & Sesli AI Mülakat Koçu

[![Live Demo](https://img.shields.io/badge/Canl%C4%B1%20Demo-benimhakkimda--mulakat.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://benimhakkimda-mulakat.vercel.app/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20S%C4%B1f%C4%B1r%20Ba%C4%9F%C4%B1ml%C4%B1l%C4%B1k-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![AI Engine](https://img.shields.io/badge/AI-NVIDIA%20NIM%20%7C%20LLaMA%203.1%208B-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://build.nvidia.com)
[![Audio](https://img.shields.io/badge/Audio-Web%20Speech%20%7C%20Web%20Audio%20API-FF6F00?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Adayların teknik ve yetkinlik mülakatlarına sesli ve yazılı etkileşimle hazırlanmasını sağlayan yapay zekâ simülatörü.</strong><br>
  Yapay zekâ sorar, aday sesli yanıtlar; sistem STAR metodolojisi, özgüven, netlik ve teknik doğruluk analizi yapar.
</p>

[Canlı Demoyu Aç ↗](https://benimhakkimda-mulakat.vercel.app/) • [Nasıl Çalışır?](#-nas%C4%B1l-%C3%A7al%C4%B1%C5%9F%C4%B1r) • [Kurulum](#-yerel-kurulum) • [Geliştirici](#-geli%C5%9Ftirici)

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
    UI <-->|JSON + HMAC Token| Server[Node.js http — sıfır bağımlılık / server.js]
    Server <-->|Prompt & Analiz| NIM[NVIDIA NIM API — LLaMA 3.1 8B Instruct]
    Server --> Security[Rate Limiter & HMAC Token Signer]
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
* [NVIDIA NIM API Key](https://build.nvidia.com/) (`nvapi-...`)

### Adımlar:
```bash
# 1. Projeyi klonlayın
git clone https://github.com/mehmeteminakkaya/BenimHakkimda_Mulakat.git
cd BenimHakkimda_Mulakat

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasına NVIDIA_API_KEY bilginizi ekleyin

# 3. Sunucuyu başlatın
npm start
```

> **Not:** Proje **hiçbir npm bağımlılığı kullanmaz** — `server.js` yalnızca Node'un yerleşik
> `node:http`, `node:fs`, `node:crypto` modülleriyle yazılmıştır. `npm install` adımına gerek yoktur
> ve `package.json` içinde `start` dışında script bulunmaz.

Tarayıcınızda `http://localhost:5178` adresini açarak mülakata başlayabilirsiniz
(port `.env` içindeki `PORT` ile değiştirilebilir).

### Statik dosyalar

Arayüz dosyaları (`index.html`, `script.js`, `styles.css`) **yalnızca `public/` klasöründe** bulunur.
Vercel bu klasörü output directory olarak servis eder, yerel sunucu da aynı klasörden okur — böylece
geliştirme ve prodüksiyon her zaman aynı kodu çalıştırır. Kök dizine ikinci bir kopya çıkarmayın.

---

## 👨‍💻 Geliştirici & İletişim

**Mehmet Emin Akkaya**  
*İstinye Üniversitesi Bilgisayar Mühendisliği*

* 🌐 **Portfolyo:** [mehmeteminakkaya.com](https://mehmeteminakkaya.com)
* 💼 **LinkedIn:** [linkedin.com/in/mehmeteminakkaya](https://www.linkedin.com/in/mehmeteminakkaya/)
* 🐙 **GitHub:** [@mehmeteminakkaya](https://github.com/mehmeteminakkaya)
* 📬 **E-Posta:** [mehmeteminakkaya12@gmail.com](mailto:mehmeteminakkaya12@gmail.com)

---

<div align="center">
  <sub>Telif Hakkı © 2026 Mehmet Emin Akkaya. Tüm hakları saklıdır.</sub>
</div>
