require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const nodemailer = require('nodemailer');
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
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigin = process.env.CLIENT_URL?.replace(/\/$/, '');
        if (!origin || origin.startsWith(allowedOrigin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Auth & Admin Middleware
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
};

const isUserAdmin = (user) => {
    const ADMIN_EMAIL = 'sahedalomsumit@gmail.com';
    return user?.email === ADMIN_EMAIL || user?.user_metadata?.email === ADMIN_EMAIL;
};

const checkAdmin = (req, res, next) => {
    if (!isUserAdmin(req.user)) {
        return res.status(403).json({ error: 'Access denied. Only the administrator can perform this action.' });
    }
    next();
};

// --- ROOT ROUTE ---
app.get('/', (req, res) => {
    res.send('OutreachOS API is running...');
});

// --- SMTP CONFIG (Zoho Mail) ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.eu',
    port: process.env.SMTP_PORT || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// --- HELPERS ---
async function sendEmail({ to, lead, subject, body, fromName, fromEmail }) {
    const { name, company, phone, website, reviews, review_score, instagram, facebook, twitter, linkedin } = lead || {};
    const safeName = name || 'there';
    const safeCompany = company || 'your company';
    
    let personalizedSubject = subject
        .replace(/{{name}}/g, safeName)
        .replace(/{{company}}/g, safeCompany)
        .replace(/{{email}}/g, lead?.email || to)
        .replace(/{{phone}}/g, phone || '')
        .replace(/{{website}}/g, website || '')
        .replace(/{{reviews}}/g, reviews || '0')
        .replace(/{{review_score}}/g, review_score || '0')
        .replace(/{{instagram}}/g, instagram || '')
        .replace(/{{facebook}}/g, facebook || '')
        .replace(/{{twitter}}/g, twitter || '')
        .replace(/{{linkedin}}/g, linkedin || '');

    let personalizedBody = body
        .replace(/{{name}}/g, safeName)
        .replace(/{{company}}/g, safeCompany)
        .replace(/{{email}}/g, lead?.email || to)
        .replace(/{{phone}}/g, phone || '')
        .replace(/{{website}}/g, website || '')
        .replace(/{{reviews}}/g, reviews || '0')
        .replace(/{{review_score}}/g, review_score || '0')
        .replace(/{{instagram}}/g, instagram || '')
        .replace(/{{facebook}}/g, facebook || '')
        .replace(/{{twitter}}/g, twitter || '')
        .replace(/{{linkedin}}/g, linkedin || '')
        .replace(/\n/g, '<br/>');

    try {
        const mailOptions = {
            from: `"${fromName || "OutreachOS"}" <${fromEmail || process.env.SMTP_USER}>`,
            to: to,
            subject: personalizedSubject,
            html: `<html><body>${personalizedBody}</body></html>`
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, data: info };
    } catch (error) {
        console.error('Email Error:', error.message);
        return { success: false, error: error.message };
    }
}

// --- CAMPAIGN ROUTES ---
app.get('/api/campaigns', authenticate, async (req, res) => {
    let query = supabase.from('campaigns').select('*');
    if (!isUserAdmin(req.user)) {
        query = query.eq('user_id', req.user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/campaigns/:id', authenticate, async (req, res) => {
    let query = supabase.from('campaigns').select('*').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) {
        query = query.eq('user_id', req.user.id);
    }
    const { data, error } = await query.single();
    if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ error: 'Campaign not found' });
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.post('/api/campaigns', authenticate, checkAdmin, async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, max_follow_ups, templates } = req.body;
    const { data, error } = await supabase.from('campaigns').insert([{
        name, from_email, sender_name, follow_up_delays, max_follow_ups, templates, user_id: req.user.id
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/campaigns/:id', authenticate, checkAdmin, async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, templates } = req.body;
    let query = supabase.from('campaigns').update({ name, from_email, sender_name, follow_up_delays, templates }).eq('id', req.params.id);
    if (!isUserAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json(data[0]);
});

app.delete('/api/campaigns/:id', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('campaigns').delete().eq('id', req.params.id);
    if (!isUserAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/api/campaigns/:id/activate', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('campaigns').update({ active: true }).eq('id', req.params.id);
    if (!isUserAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.post('/api/campaigns/:id/pause', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('campaigns').update({ active: false }).eq('id', req.params.id);
    if (!isUserAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// --- LEAD ROUTES ---
app.get('/api/campaigns/:id/leads', authenticate, async (req, res) => {
    let cQuery = supabase.from('campaigns').select('id').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
    const { data: campaign } = await cQuery.single();
    if (!campaign) return res.status(403).json({ error: 'Access denied or campaign not found' });

    const { data, error } = await supabase.from('leads').select('*').eq('campaign_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/campaigns/:id/leads', authenticate, checkAdmin, async (req, res) => {
    let cQuery = supabase.from('campaigns').select('id, user_id').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
    const { data: campaign } = await cQuery.single();
    if (!campaign) return res.status(403).json({ error: 'Access denied' });

    const leadData = { ...req.body, campaign_id: req.params.id, user_id: campaign.user_id };
    const { data, error } = await supabase.from('leads').insert([leadData]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.post('/api/campaigns/:id/leads/import', authenticate, checkAdmin, upload.single('file'), async (req, res) => {
    let cQuery = supabase.from('campaigns').select('id, user_id').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
    const { data: campaign } = await cQuery.single();
    if (!campaign) return res.status(403).json({ error: 'Access denied' });

    const results = [];
    fs.createReadStream(req.file.path).pipe(csv({ mapHeaders: ({ header }) => header.toLowerCase().trim() }))
        .on('data', (data) => {
            if (data.email && data.company) {
                results.push({ ...data, campaign_id: req.params.id, user_id: campaign.user_id, reviews: parseInt(data.reviews) || 0, review_score: parseFloat(data.review_score) || 0 });
            }
        })
        .on('end', async () => {
            if (results.length === 0) return res.status(400).json({ error: 'No valid leads found' });
            const { data, error } = await supabase.from('leads').insert(results).select();
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            if (error) return res.status(500).json({ error: error.message });
            res.json({ count: data.length });
        });
});

app.put('/api/leads/:id/status', authenticate, checkAdmin, async (req, res) => {
    const { status } = req.body;
    let lQuery = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(403).json({ error: 'Access denied or lead not found' });

    const { data, error } = await supabase.from('leads').update({ status }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/leads/:id', authenticate, checkAdmin, async (req, res) => {
    let lQuery = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(403).json({ error: 'Access denied' });

    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- LOGS & REPLIES ---
app.get('/api/logs', authenticate, async (req, res) => {
    let query = supabase.from('email_logs').select('*, campaigns!inner(name, user_id), leads(email, name)');
    if (!isUserAdmin(req.user)) query = query.eq('campaigns.user_id', req.user.id);
    const { data, error } = await query.order('sent_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/campaigns/:id/logs', authenticate, async (req, res) => {
    let cQuery = supabase.from('campaigns').select('id').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
    const { data: campaign } = await cQuery.single();
    if (!campaign) return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabase.from('email_logs').select('*, leads(email, name)').eq('campaign_id', req.params.id).order('sent_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/leads/:id/reply', authenticate, checkAdmin, async (req, res) => {
    const { subject, body } = req.body;
    let lQuery = supabase.from('leads').select('*, campaigns!inner(*)').eq('id', req.params.id);
    if (!isUserAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(404).json({ error: 'Lead not found' });

    const campaign = lead.campaigns;
    const result = await sendEmail({ to: lead.email, lead: lead, subject, body, fromEmail: campaign.from_email, fromName: campaign.sender_name });

    if (result.success) {
        await supabase.from('email_logs').insert([{ lead_id: lead.id, campaign_id: campaign.id, type: 'manual_reply', status: 'sent' }]);
        await supabase.from('leads').update({ status: 'replied' }).eq('id', lead.id);
        res.json({ success: true });
    } else {
        res.status(500).json({ error: result.error });
    }
});

// --- SUMMARY & TEST ---
app.get('/api/summary', authenticate, async (req, res) => {
    try {
        const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
        const { count: contacted } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).neq('status', 'pending');
        const { count: replied } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('status', 'replied');
        res.json({ totalLeads: totalLeads || 0, contacted: contacted || 0, replied: replied || 0, replyRate: contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/send-test', authenticate, checkAdmin, async (req, res) => {
    const { email, name, company, subject, body, fromEmail, fromName } = req.body;
    const result = await sendEmail({ to: email, lead: { name, company }, subject, body, fromEmail, fromName });
    if (result.success) res.json({ success: true });
    else res.status(500).json({ error: result.error });
});

// --- CRON JOB ---
cron.schedule('0 9 * * *', async () => {
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('active', true);
    if (!campaigns) return;
    for (const campaign of campaigns) {
        const { data: leads } = await supabase.from('leads').select('*').eq('campaign_id', campaign.id).not('status', 'in', '("replied","bounced","completed")').lt('follow_ups', campaign.max_follow_ups + 1);
        if (!leads) continue;
        for (const lead of leads) {
            let type = lead.last_contact ? `follow_up_${lead.follow_ups + 1}` : 'initial';
            const template = campaign.templates[type];
            if (!template) continue;
            const result = await sendEmail({ to: lead.email, lead, subject: template.subject, body: template.body, fromEmail: campaign.from_email, fromName: campaign.sender_name });
            if (result.success) {
                await supabase.from('leads').update({ status: type === 'initial' ? 'sent' : type, follow_ups: lead.follow_ups + 1, last_contact: new Date().toISOString() }).eq('id', lead.id);
                await supabase.from('email_logs').insert([{ lead_id: lead.id, campaign_id: campaign.id, type, status: 'sent' }]);
            }
        }
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
