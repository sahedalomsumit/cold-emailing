# OutreachOS

![OutreachOS Banner](outreachos_banner.png)

A professional, full-stack lead outreach automation platform designed to streamline your cold emailing workflow.

[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🚀 Key Features

- **⚡ Campaign Intelligence**: Create, orchestrate, and manage multi-stage outreach sequences with ease.
- **📊 Lead Lifecycle Tracking**: Intelligent lead management system tracking progress from initial contact to conversion.
- **🤖 Automated Sequences**: Power your outreach with automated follow-ups using `node-cron` and Zoho SMTP.
- **👁️ Live Template Preview**: Real-time email editor with dynamic variable substitution for personalized messaging.
- **📜 Detailed Activity Logs**: Maintain a comprehensive audit trail of every outreach event and status change.

## 🛠️ Tech Stack

- **Core**: React 18, Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Email Engine**: Zoho Mail (SMTP via Nodemailer)
- **Styling**: Tailwind CSS
- **Scheduler**: Node-cron
- **File Handling**: Multer (CSV processing)

---

## ⚙️ Quick Start

### 1. Database Setup
Execute the following schema in your [Supabase SQL Editor](https://app.supabase.com/):

```sql
-- Campaigns Table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  from_email text not null,
  sender_name text not null,
  follow_up_delays int[] default '{3, 7}',
  max_follow_ups int default 2,
  templates jsonb,
  active boolean default false,
  created_at timestamptz default now()
);

-- Leads Table
create table leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  email text not null,
  company text,
  status text default 'pending',
  follow_ups int default 0,
  last_contact timestamptz,
  created_at timestamptz default now()
);

-- Email Logs Table
create table email_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  type text, -- initial, follow_up_1, follow_up_2
  sent_at timestamptz default now(),
  status text -- sent, failed
);
```

### 2. Environment Configuration

Create `.env` files in both subdirectories:

**Server (`/server/.env`):**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
SMTP_HOST=smtp.zoho.eu
SMTP_PORT=465
SMTP_USER=sahedalomsumit@zohomail.eu
SMTP_PASS=your_zoho_app_password
PORT=4000
CLIENT_URL=http://localhost:5173
```

**Client (`/client/.env`):**
```env
VITE_API_URL=http://localhost:4000/api
```

### 3. Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/sahedalomsumit/OutreachOS.git
cd OutreachOS

# Setup Backend
cd server && npm install
npm run dev # Starts on port 4000

# Setup Frontend (Open new terminal)
cd client && npm install
npm run dev # Starts on port 5173
```

---

## 🚢 Deployment

### 1. Backend (Render)
1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub repository.
3. Set the following:
   - **Root Directory**: `(leave empty)`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
4. Add the following **Environment Variables**:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_KEY`: Your Supabase Anon Key
   - `BREVO_API_KEY`: Your Brevo API Key
   - `CLIENT_URL`: `https://sahedalomsumit.github.io/outreachos` (Your GH Pages URL)
   - `PORT`: `4000`

### 2. Frontend (GitHub Pages)
1. Go to your GitHub Repository **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Go to **Settings** > **Secrets and variables** > **Actions**.
4. Create a **New repository secret**:
   - Name: `VITE_API_URL`
     Value: `https://your-render-service-url.onrender.com/api`
   - Name: `VITE_SUPABASE_URL`
     Value: `your_supabase_url`
   - Name: `VITE_SUPABASE_ANON_KEY`
     Value: `your_supabase_anon_key`
5. Push to `main` branch to trigger the deployment.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

Built with ❤️ by [Sahed](https://sahedalomsumit.com)
