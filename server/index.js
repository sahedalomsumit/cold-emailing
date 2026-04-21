require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cron = require('node-cron');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Supabase Setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// --- ROOT ROUTE ---
app.get('/', (req, res) => {
    res.send('OutreachOS API is running...');
});

// --- BREVO API CONFIG ---
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_HEADERS = {
    'accept': 'application/json',
    'api-key': process.env.BREVO_API_KEY,
    'content-type': 'application/json'
};

// --- HELPERS ---
async function sendEmail({ to, name, company, subject, body }) {
    const personalizedSubject = subject.replace(/{{name}}/g, name).replace(/{{company}}/g, company);
    const personalizedBody = body.replace(/{{name}}/g, name).replace(/{{company}}/g, company);

    try {
        const response = await axios.post(BREVO_API_URL, {
            sender: { name: "OutreachOS", email: "outreach@outreachos.com" }, // Default if not specified
            to: [{ email: to, name: name }],
            subject: personalizedSubject,
            htmlContent: personalizedBody
        }, { headers: BREVO_HEADERS });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Brevo Email Error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

// --- CAMPAIGN ROUTES ---
app.get('/api/campaigns', async (req, res) => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/campaigns', async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, templates } = req.body;
    const { data, error } = await supabase.from('campaigns').insert([{
        name, from_email, sender_name, follow_up_delays, templates
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/campaigns/:id', async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, templates } = req.body;
    const { data, error } = await supabase.from('campaigns').update({
        name, from_email, sender_name, follow_up_delays, templates
    }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/campaigns/:id', async (req, res) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/api/campaigns/:id/activate', async (req, res) => {
    const { data, error } = await supabase.from('campaigns').update({ active: true }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.post('/api/campaigns/:id/pause', async (req, res) => {
    const { data, error } = await supabase.from('campaigns').update({ active: false }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// --- LEAD ROUTES ---
app.get('/api/campaigns/:id/leads', async (req, res) => {
    const { data, error } = await supabase.from('leads').select('*').eq('campaign_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/campaigns/:id/leads/import', upload.single('file'), async (req, res) => {
    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push({ ...data, campaign_id: req.params.id }))
        .on('end', async () => {
            const { data, error } = await supabase.from('leads').insert(results).select();
            fs.unlinkSync(req.file.path);
            if (error) return res.status(500).json({ error: error.message });
            res.json({ count: data.length });
        });
});

app.put('/api/leads/:id/status', async (req, res) => {
    const { status } = req.body;
    const { data, error } = await supabase.from('leads').update({ status }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/leads/:id', async (req, res) => {
    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- LOGS ---
app.get('/api/logs', async (req, res) => {
    const { data, error } = await supabase.from('email_logs').select('*, campaigns(name), leads(email, name)').order('sent_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- TEST EMAIL ---
app.post('/api/send-test', async (req, res) => {
    const { email, name, company, subject, body } = req.body;
    const result = await sendEmail({ to: email, name, company, subject, body });
    if (result.success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: result.error });
    }
});

// --- CRON JOB (09:00 AM UTC) ---
cron.schedule('0 9 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Starting daily outreach...`);
    
    // 1. Get active campaigns
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('active', true);
    if (!campaigns) return;

    let dailyCount = 0;
    const LIMIT = 250;

    for (const campaign of campaigns) {
        if (dailyCount >= LIMIT) {
            console.warn('Daily limit reached (250). Stopping outreach.');
            break;
        }

        // 2. Fetch leads for this campaign
        // Status not in (replied, bounced, completed)
        // follow_ups < max_follow_ups
        const { data: leads } = await supabase.from('leads')
            .select('*')
            .eq('campaign_id', campaign.id)
            .not('status', 'in', '("replied","bounced","completed")')
            .lt('follow_ups', campaign.max_follow_ups + 1); // follow_ups is 0 for initial, 1 for follow_up_1, etc.

        if (!leads) continue;

        for (const lead of leads) {
            if (dailyCount >= LIMIT) break;

            let shouldSend = false;
            let type = '';
            const now = new Date();

            if (!lead.last_contact) {
                // Initial email
                shouldSend = true;
                type = 'initial';
            } else {
                // Check follow up delay
                const lastContact = new Date(lead.last_contact);
                const diffDays = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
                const delayIndex = lead.follow_ups; // 0 means initial sent, next is follow_up_1 (delay [0])
                const requiredDelay = campaign.follow_up_delays[delayIndex];

                if (requiredDelay !== undefined && diffDays >= requiredDelay) {
                    shouldSend = true;
                    type = `follow_up_${lead.follow_ups + 1}`;
                }
            }

            if (shouldSend) {
                const template = campaign.templates[type];
                if (!template) continue;

                const result = await sendEmail({
                    to: lead.email,
                    name: lead.name,
                    company: lead.company,
                    subject: template.subject,
                    body: template.body
                });

                if (result.success) {
                    dailyCount++;
                    // Update lead
                    await supabase.from('leads').update({
                        status: type === 'initial' ? 'sent' : type,
                        follow_ups: lead.follow_ups + 1,
                        last_contact: now.toISOString()
                    }).eq('id', lead.id);

                    // Log
                    await supabase.from('email_logs').insert([{
                        lead_id: lead.id,
                        campaign_id: campaign.id,
                        type: type,
                        status: 'sent'
                    }]);
                } else {
                    // Log failure
                    await supabase.from('email_logs').insert([{
                        lead_id: lead.id,
                        campaign_id: campaign.id,
                        type: type,
                        status: 'failed'
                    }]);
                }
            }
        }
    }
    console.log(`[${new Date().toISOString()}] Outreach finished. Sent: ${dailyCount}`);
}, {
    timezone: "UTC"
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
