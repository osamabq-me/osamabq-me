
<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/header-dark.svg">
  <img alt="Osamah Al-Mekhlafi | Software Engineer | Full-Stack, Backend, Data & AI. Building technology for a safer, smarter, and more comfortable world." src="assets/header-light.svg" width="100%">
</picture>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/osamahalmekhlafi"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-6d28d9?style=for-the-badge&logo=linkedin&logoColor=white"></a>
  <a href="https://doi.org/10.1109/ICITCOM60176.2023.10442144"><img alt="IEEE Publication" src="https://img.shields.io/badge/IEEE_Publication-6d28d9?style=for-the-badge&logo=ieee&logoColor=white"></a>
</p>

Software engineer working across full-stack development, financial systems, data, and intelligent automation, with a strong foundation in backend engineering.

Currently a Software Developer in fintech, where I built a crypto payments and dividend platform end to end, from the React front end to the Spring Boot backend and on-chain payment verification. Previously the sole backend engineer on a five-person team building branch banking microservices. Computer Science valedictorian at Universitas Muhammadiyah Yogyakarta (UMY) and published IEEE research co-author.

Most of my professional work lives in private repositories due to employer confidentiality.

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/stack-dark.svg">
  <img alt="Technical Stack. Languages: Java, Python, C#/.NET, Kotlin, C++, SQL. Backend: Spring Boot, Spring Cloud, Swagger, REST APIs, Temenos, BNB Smart Chain, WalletConnect. Frontend and mobile: React, Vite, Flutter, Jetpack Compose. Databases: Oracle, MySQL, SQL Server, ER modeling. Data and ML: pandas, NumPy, scikit-learn, XGBoost, Plotly, Folium, Power BI. AI and automation: n8n, Claude Code, Cursor, OpenClaw. DevOps: Docker, nginx, Prometheus, Grafana, GitLab CI/CD, GitHub Actions. Security: Kali Linux, OWASP testing, JWT auth, Red Hat Linux. Embedded and IoT: Linux kernel modules, ARM cross-compiling, ADB." src="assets/stack-light.svg" width="100%">
</picture>
</p>

### Selected Work

<details>
<summary><b>Crypto Payments & Dividend Platform</b> · Fintech · 2025–present</summary>
<br>

A full-stack payments and dividend platform I built from scratch on my own: the public website, the admin back office and the backend.

- React (Vite) website and back office: a multi-step buying wizard, wallet and transaction history, live supply updates over server-sent events, and analytics with Excel/CSV export.
- On-chain payment verification: every blockchain transfer is checked against a BNB Smart Chain node, and users prove wallet ownership by signing a challenge (WalletConnect).
- Safe money movement: the same transfer can never be credited twice, even under concurrent retries; automatic demand-based pricing locks the buyer's price during payment.
- Dividend engine that snapshots every holder's balance and credits each holder proportionally in one transaction.
- Security and reliability: email verification, rotating JWT sessions in httpOnly cookies, CAPTCHA, new-device alerts, an email outbox with retries, and a reconciliation sweep that flags unmatched transfers.
- Java, Spring Boot, MySQL, Swagger/OpenAPI, monitored with Prometheus and Grafana, deployed with Docker and nginx.

*Employer project; source code is private.*

</details>

<details>
<summary><b>Wi-Fi Sensing on Android Devices</b> · IoT · Ongoing</summary>
<br>

Cross-compiled a Realtek USB Wi-Fi driver for Android 11 (Linux kernel 4.19) on Orange Pi boards and loaded it over ADB.

- Extended the devices' weak Wi-Fi range.
- Enabled monitor mode, so the devices capture Wi-Fi probe requests to estimate how many people are nearby (validated with airodump-ng).

*Employer project; source code is private.*

</details>

<details>
<summary><b>Branch Banking Microservices</b> · Banking · 2024–25</summary>
<br>

Backend for a bank's teller application, covering customer lookup, account opening, cash deposits and withdrawals, transaction fees, and multiple currencies. I was the sole backend engineer on a five-person team.

- Spring Boot microservices that replaced a legacy framework, integrated with Oracle and the Temenos core banking system.
- Documented APIs with Swagger/OpenAPI and delivered faster API responses.
- Ran development and CI/CD through GitLab from build to launch and handover.

*Employer project under NDA; source code is private.*

</details>

<details>
<summary><b>Customer Churn Prediction</b> · BNSP Data Science Certification · 2025</summary>
<br>

A machine learning project predicting which telecom customers are likely to leave and identifying factors associated with customer churn.

- Integrated data from SQL Server, Excel, and CSV; identified churn-related factors through hypothesis testing and feature engineering.
- Compared nine classification models on accuracy, precision, recall, F1 and ROC-AUC, using SMOTE for class imbalance, cross-validation and Random Forest tuning.
- Random Forest reached **85.84% accuracy**; Gradient Boosting caught **85.70%** and KNN **90.42%** of customers who churned (recall).

</details>

<details>
<summary><b>Community Data Platform</b> · Yemeni Students Union in Indonesia · 2024–26</summary>
<br>

The union's first comprehensive data study of Yemeni students across 58 Indonesian universities and 66 fields of study, combining student records, dashboards, and analysis.

- Cleaned and analyzed Arabic and English survey data with descriptive statistics and relational (bivariate and multivariate) analysis.
- Built interactive visualizations with Plotly and geographic maps with Folium and Leaflet.js.
- Findings contributed to the union's decision to establish a dedicated IT department; the study is being prepared for journal publication.

</details>

<details>
<summary><b>Contacts API & Android Application</b> · Course Project · 2023</summary>
<br>

A Spring Boot REST API backed by MySQL, integrated with a native Android application built using Kotlin and Jetpack Compose, with Retrofit handling client-server communication.

[View Android Application](https://github.com/osamabq-me/152_RestAPI)

</details>

<br>

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/overview-dark.svg">
  <img alt="GitHub overview: contributions over the last 12 months, total contributions, stars, forks, and programming language distribution." src="assets/overview-light.svg" width="100%">
</picture>
</p>

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/activity-dark.svg">
  <img alt="GitHub activity: total contributions, active days, streaks, and contribution activity over the last 31 days." src="assets/activity-light.svg" width="100%">
</picture>
</p>

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/langbars-dark.svg">
  <img alt="Programming languages by share of code across my GitHub repositories." src="assets/langbars-light.svg" width="100%">
</picture>
</p>

<p align="center">
  <img alt="Profile views" src="https://komarev.com/ghpvc/?username=osamabq-me&style=flat-square&label=Profile+views&color=6d28d9">
</p>
