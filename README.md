# Kutip Smart Waste Collection System

Kutip is a smart web-based waste collection system developed under the SECP3106 Application Development (WBL) course. This project, created in collaboration with **Treom Tech Sdn Bhd**, aims to digitalize and automate urban waste collection processes using IoT, geolocation, and smart scheduling technologies.

## 📦 Project Overview

- **Project Name**: Kutip Smart Waste Collection System
- **Team**: GardeniaProMax
- **Client**: Treom Tech Sdn Bhd
- **Duration**: May–July 2025
- **Lecturer**: Assoc. Prof. Dr. Haza Nuzly Bin Abdull Hamed

## 👥 Team Members & Roles

| No. | Name             | Matric No     | Role & Module In-Charge                        | Contribution |
|-----|------------------|---------------|------------------------------------------------|--------------|
| 1   | Lee Yik Hong     | A21BE0376     | Module 1 – IoT Sensor Integration              | 20%          |
| 2   | Koh Li Hui       | A22EC0059     | Module 2 – Bin & Truck Management              | 20%          |
| 3   | Tiew Chuan Rong  | A22EC0112     | Module 3 & 5 – Scheduling & Authentication     | 20%          |
| 4   | Chen Pyng Haw    | A22EC0042     | Module 4 – Dashboard & Reporting               | 20%          |
| 5   | Wong Jun Ji      | A22EC0117     | System Debugging and Integration               | 20%          |

---

## 🧠 Problem Statement

Traditional waste collection in Malaysia is manual, inefficient, and lacks real-time insights. Fixed schedules and poor bin monitoring lead to fuel waste, overflowing bins, and high costs.

---

## 💡 Proposed Solution

Kutip resolves these challenges through:

- **Smart Bin Monitoring** via IoT & YOLOv8
- **Auto Scheduling** using K-Means clustering
- **Live Map Routing** with Mapbox API
- **Real-Time Dashboard & Reports**
- **Role-Based Authentication for Admins and Drivers**

---

## ⚙️ Tech Stack

| Category             | Tools/Technologies                                   |
|----------------------|------------------------------------------------------|
| Frontend             | Next.js, Tailwind CSS, Chart.js                      |
| Backend              | FastAPI (Python)                                     |
| Database             | Supabase (PostgreSQL), Storage                       |
| AI / CV              | YOLOv8, OpenCV, Tesseract OCR                        |
| APIs                 | Mapbox, Google Drive API                             |
| Authentication       | bcrypt, JWT                                          |
| Dev Tools            | Git, GitHub, Jira, Google Meet, WhatsApp            |

---

## 🧩 Key Modules

1. **IoT Sensor Integration**
   - YOLOv8 bin detection
   - OCR plate recognition
2. **Bin & Truck Management**
   - CRUD operations
   - Admin interface
3. **Scheduling & Routing**
   - K-Means based truck assignments
   - Mapbox-powered live route visualization
4. **Dashboard & Reporting**
   - KPIs: bins collected, missed pickups, live truck tracking
   - CSV/PDF exports
5. **Authentication**
   - Secure login
   - Role-based access control

---

## 🛠️ Installation (Localhost Setup)

1. **Install Node.js**  
   [Download here](https://nodejs.org/en)

2. **Clone Repository**
   ```bash
   git clone https://github.com/pynghaw/Kutip.git
   cd Kutip
   ```

3. **Set up `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_MAPBOX_TOKEN=...
   ```

4. **Install Packages**
   ```bash
   npm install
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

6. **Start Python Camera Server**
   ```bash
   pip install -r requirements.txt
   python camera_server.py
   ```

> Detailed installation steps available in the `User Manual` section of the full report.

---

## 🔐 User Credentials

### Admins
| Username       | Email             | Password |
|----------------|------------------|----------|
| Kyrie Irving   | kyrie@gmail.com  | 123456   |
| Michael Jordan | jordan@gmail.com | 123456   |

### Drivers
| Username       | Email             | Password |
|----------------|------------------|----------|
| Stephen Curry  | curry@gmail.com  | 123456   |
| Lebron James   | james@gmail.com  | 123456   |
| Kevin Durant   | durant@gmail.com | 123456   |

---

## 📊 Database Design

- **3NF-compliant ERD & EERD**
- Main Tables: `users`, `bins`, `trucks`, `truck_assignments`, `pickups`, `schedules`, `routes`
- Supports: Referential integrity, temporal tracking, role-based access

---

## 🌀 Agile & Jira Integration

- Scrum-based 5-sprint structure
- Sprint boards, backlog grooming, burndown charts
- Jira Project: [Link](https://pynghaw5.atlassian.net/jira/software/projects/SCRUM/summary)

---

## 📚 Documentation

- [SRS](https://docs.google.com/document/d/1pYm4IiyYmEs9h3uiuyQk6myMAneMsDlV/edit)
- [SDD](https://docs.google.com/document/d/12NmVvAw1J4rnXalhAYBqugvxFI2qkiR-1nwU6oYeYbU/edit)
- [STD](https://docs.google.com/document/d/1cC96Thgde6dp78PrVUUVVmaru8QSCgPS/edit)
- [UAT Report](https://docs.google.com/document/d/1U4i-j68sCVgHeW7Yre_Epdwo8z2HWc22-EdJQG3TIoE/edit)

---

## 📎 References

- [Project Repo](https://github.com/pynghaw/Kutip)
- [Treom Client Brief](mailto:irfan@treom.io)
- [Mapbox](https://docs.mapbox.com/)
- [Supabase Docs](https://supabase.com/docs)
- [YOLOv8](https://docs.ultralytics.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)

---

## 📩 Contact

For project-related inquiries:
```
📧 Email: irfan@treom.io  
📱 Telegram: @rolodex
```