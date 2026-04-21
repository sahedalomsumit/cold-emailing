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

// Auth Middleware
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
};

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
async function sendEmail({ to, lead, subject, body }) {
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
        .replace(/{{linkedin}}/g, linkedin || '');

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
app.get('/api/campaigns', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('campaigns').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/campaigns/:id', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/campaigns', authenticate, async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, max_follow_ups, templates } = req.body;
    const { data, error } = await supabase.from('campaigns').insert([{
        name, from_email, sender_name, follow_up_delays, max_follow_ups, templates, user_id: req.user.id
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/campaigns/:id', authenticate, async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, templates } = req.body;
    const { data, error } = await supabase.from('campaigns').update({
        name, from_email, sender_name, follow_up_delays, templates
    }).eq('id', req.params.id).eq('user_id', req.user.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/campaigns/:id', authenticate, async (req, res) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/api/campaigns/:id/activate', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('campaigns').update({ active: true }).eq('id', req.params.id).eq('user_id', req.user.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.post('/api/campaigns/:id/pause', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('campaigns').update({ active: false }).eq('id', req.params.id).eq('user_id', req.user.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// --- LEAD ROUTES ---
app.get('/api/campaigns/:id/leads', authenticate, async (req, res) => {
    // Verify campaign ownership first
    const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!campaign) return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabase.from('leads').select('*').eq('campaign_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/campaigns/:id/leads/import', authenticate, upload.single('file'), async (req, res) => {
    // Verify campaign ownership
    const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!campaign) return res.status(403).json({ error: 'Access denied' });

    const results = [];
    let skippedCount = 0;

    fs.createReadStream(req.file.path)
        .pipe(csv({
            mapHeaders: ({ header }) => header.toLowerCase().trim()
        }))
        .on('data', (data) => {
            // Clean values (trim whitespace)
            const cleanData = {};
            Object.keys(data).forEach(key => {
                cleanData[key] = data[key] ? data[key].trim() : '';
            });

            // Validate mandatory fields: email and company
            if (cleanData.email && cleanData.company) {
                // Handle multiple emails separated by commas
                const emails = cleanData.email.split(',').map(e => e.trim()).filter(e => e !== '');
                
                emails.forEach(email => {
                    results.push({ 
                        ...cleanData,
                        email: email, // Set individual email
                        campaign_id: req.params.id, 
                        user_id: req.user.id,
                        // Ensure numeric fields are correctly typed
                        reviews: cleanData.reviews ? (parseInt(cleanData.reviews) || 0) : 0,
                        review_score: cleanData.review_score ? (parseFloat(cleanData.review_score) || 0) : 0
                    });
                });
            } else {
                skippedCount++;
            }
        })
        .on('end', async () => {
            if (results.length === 0) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: 'No valid leads found. Check that your CSV has "email" and "company" columns and they are not empty.' });
            }

            const { data, error } = await supabase.from('leads').insert(results).select();
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            
            if (error) {
                console.error('Supabase Insert Error:', error);
                return res.status(500).json({ error: `Database Error: ${error.message}` });
            }
            res.json({ count: data.length, skipped: skippedCount });
        });
});

app.put('/api/leads/:id/status', authenticate, async (req, res) => {
    const { status } = req.body;
    
    // Security: Verify lead belongs to a campaign owned by this user
    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*, campaigns!inner(user_id)')
        .eq('id', req.params.id)
        .eq('campaigns.user_id', req.user.id)
        .single();

    if (leadError || !lead) return res.status(403).json({ error: 'Access denied or lead not found' });

    const { data, error } = await supabase.from('leads').update({ status }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/leads/:id', authenticate, async (req, res) => {
    // Security: Verify lead belongs to a campaign owned by this user
    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*, campaigns!inner(user_id)')
        .eq('id', req.params.id)
        .eq('campaigns.user_id', req.user.id)
        .single();

    if (leadError || !lead) return res.status(403).json({ error: 'Access denied or lead not found' });

    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- LOGS ---
app.get('/api/logs', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('email_logs')
        .select('*, campaigns!inner(name, user_id), leads(email, name)')
        .eq('campaigns.user_id', req.user.id)
        .order('sent_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- SUMMARY STATS ---
app.get('/api/summary', authenticate, async (req, res) => {
    try {
        const { count: totalLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id);

        const { count: contacted } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .neq('status', 'pending');

        const { count: replied } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('status', 'replied');

        const { count: dailyCount } = await supabase
            .from('email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'sent')
            .gte('sent_at', new Date(new Date().setHours(0,0,0,0)).toISOString());

        // Note: dailyCount should ideally be filtered by user, but email_logs 
        // doesn't have user_id directly. We'd need a join or add user_id to logs.
        // For now, this is global which matches the Brevo limit concept.

        res.json({
            totalLeads: totalLeads || 0,
            contacted: contacted || 0,
            replied: replied || 0,
            replyRate: contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : 0,
            dailyCount: dailyCount || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TEST EMAIL ---
app.post('/api/send-test', authenticate, async (req, res) => {
    const { email, name, company, subject, body } = req.body;
    const result = await sendEmail({ 
        to: email, 
        lead: { name, company }, 
        subject, 
        body 
    });
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
                    lead: lead,
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
