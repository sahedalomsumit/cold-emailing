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

app.use(cors({
    origin: (origin, callback) => {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        
        // If no origin (like mobile apps or curl requests), allow it
        if (!origin) return callback(null, true);

        try {
            const allowedOrigin = new URL(clientUrl).origin;
            const currentOrigin = new URL(origin).origin;

            if (currentOrigin === allowedOrigin || currentOrigin.includes('localhost')) {
                callback(null, true);
            } else {
                console.warn(`CORS: Origin ${origin} not allowed. Expected ${allowedOrigin}`);
                callback(new Error('Not allowed by CORS'));
            }
        } catch (err) {
            callback(null, true); // Fallback to allow if URL parsing fails
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

const isSuperAdmin = (user) => {
    const ADMIN_EMAIL = 'sahedalomsumit@zohomail.eu';
    return user?.email === ADMIN_EMAIL || user?.user_metadata?.email === ADMIN_EMAIL;
};

const checkAdmin = (req, res, next) => {
    // "others can do everything" - so we allow all authenticated users to pass checkAdmin
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const checkSuperAdmin = (req, res, next) => {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ error: 'Access denied. Only the Super Administrator can run campaigns.' });
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
    console.log(`Sending email to ${to} using lead: ${lead?.email || 'N/A'}`);

    let personalizedSubject = subject
        .replace(/{{[\s]*name[\s]*}}/gi, safeName)
        .replace(/{{[\s]*company[\s]*}}/gi, safeCompany)
        .replace(/{{[\s]*email[\s]*}}/gi, lead?.email || to)
        .replace(/{{[\s]*phone[\s]*}}/gi, phone || '')
        .replace(/{{[\s]*website[\s]*}}/gi, website || '')
        .replace(/{{[\s]*reviews[\s]*}}/gi, reviews || '0')
        .replace(/{{[\s]*review_score[\s]*}}/gi, review_score || '0')
        .replace(/{{[\s]*instagram[\s]*}}/gi, instagram || '')
        .replace(/{{[\s]*facebook[\s]*}}/gi, facebook || '')
        .replace(/{{[\s]*twitter[\s]*}}/gi, twitter || '')
        .replace(/{{[\s]*linkedin[\s]*}}/gi, linkedin || '');

    let personalizedBody = body
        .replace(/{{[\s]*name[\s]*}}/gi, safeName)
        .replace(/{{[\s]*company[\s]*}}/gi, safeCompany)
        .replace(/{{[\s]*email[\s]*}}/gi, lead?.email || to)
        .replace(/{{[\s]*phone[\s]*}}/gi, phone || '')
        .replace(/{{[\s]*website[\s]*}}/gi, website || '')
        .replace(/{{[\s]*reviews[\s]*}}/gi, reviews || '0')
        .replace(/{{[\s]*review_score[\s]*}}/gi, review_score || '0')
        .replace(/{{[\s]*instagram[\s]*}}/gi, instagram || '')
        .replace(/{{[\s]*facebook[\s]*}}/gi, facebook || '')
        .replace(/{{[\s]*twitter[\s]*}}/gi, twitter || '')
        .replace(/{{[\s]*linkedin[\s]*}}/gi, linkedin || '')
        .replace(/\n/g, '<br/>');

    try {
        const mailOptions = {
            from: `"${fromName || "OutreachOS"}" <${process.env.SMTP_USER}>`,
            replyTo: fromEmail || process.env.SMTP_USER,
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
    if (!isSuperAdmin(req.user)) {
        query = query.eq('user_id', req.user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/campaigns/:id', authenticate, async (req, res) => {
    let query = supabase.from('campaigns').select('*').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) {
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
    const { name, from_email, sender_name, follow_up_delays, max_follow_ups, templates, lead_list_ids } = req.body;
    const { data, error } = await supabase.from('campaigns').insert([{
        name, from_email, sender_name, follow_up_delays, max_follow_ups, templates, lead_list_ids, user_id: req.user.id
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/campaigns/:id', authenticate, checkAdmin, async (req, res) => {
    const { name, from_email, sender_name, follow_up_delays, templates, lead_list_ids } = req.body;
    let query = supabase.from('campaigns').update({ name, from_email, sender_name, follow_up_delays, templates, lead_list_ids }).eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const campaign = data[0];
    if (campaign.active) {
        console.log(`Campaign ${campaign.name} updated while active. Triggering immediate check...`);
        processCampaign(campaign); // Run in background
    }
    
    res.json(campaign);
});

app.delete('/api/campaigns/:id', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('campaigns').delete().eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/api/campaigns/:id/activate', authenticate, checkSuperAdmin, async (req, res) => {
    try {
        // 1. Mark as active
        let query = supabase.from('campaigns').update({ active: true }).eq('id', req.params.id);
        if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
        const { data: campaignData, error } = await query.select().single();
        
        if (error) return res.status(500).json({ error: error.message });
        if (!campaignData) return res.status(404).json({ error: 'Campaign not found' });

        // 2. Start processing immediately
        console.log(`Auto-starting campaign ${campaignData.name} (${campaignData.id}) upon activation...`);
        const summary = await processCampaign(campaignData, true);
        
        res.json({ ...campaignData, summary });
    } catch (err) {
        console.error('Activation run crash:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/campaigns/:id/pause', authenticate, checkSuperAdmin, async (req, res) => {
    let query = supabase.from('campaigns').update({ active: false }).eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// --- LEAD LIST ROUTES ---
app.get('/api/lead-lists', authenticate, async (req, res) => {
    let query = supabase.from('lead_lists').select('*');
    if (!isSuperAdmin(req.user)) {
        query = query.eq('user_id', req.user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/lead-lists', authenticate, checkAdmin, async (req, res) => {
    const { name } = req.body;
    const { data, error } = await supabase.from('lead_lists').insert([{
        name, user_id: req.user.id
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/lead-lists/:id', authenticate, checkAdmin, async (req, res) => {
    const { name } = req.body;
    let query = supabase.from('lead_lists').update({ name }).eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Lead list not found' });
    res.json(data[0]);
});

app.delete('/api/lead-lists/:id', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('lead_lists').delete().eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/lead-lists/:id/leads', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('leads').delete().eq('list_id', req.params.id);
    if (!isSuperAdmin(req.user)) query = query.eq('user_id', req.user.id);
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- LEAD ROUTES ---
app.get('/api/lead-lists/:id/leads', authenticate, async (req, res) => {
    const { data, error } = await supabase.from('leads').select('*').eq('list_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/lead-lists/:id/leads', authenticate, checkAdmin, async (req, res) => {
    const leadData = { ...req.body, list_id: req.params.id, user_id: req.user.id };
    const { data, error } = await supabase.from('leads').insert([leadData]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.post('/api/lead-lists/:id/leads/import', authenticate, checkAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const results = [];
    const allowedColumns = ['email', 'company', 'website', 'phone', 'instagram', 'facebook', 'linkedin', 'reviews', 'review_score'];
    
    console.log(`Starting CSV import for list ${req.params.id}...`);
    
    fs.createReadStream(req.file.path)
        .pipe(csv({ mapHeaders: ({ header }) => header.toLowerCase().trim() }))
        .on('data', (data) => {
            if (data.email || data.phone) {
                const filteredData = {
                    list_id: req.params.id,
                    user_id: req.user.id
                };
                
                // Only include allowed columns
                allowedColumns.forEach(col => {
                    if (data[col] !== undefined) {
                        if (col === 'reviews') filteredData[col] = parseInt(data[col]) || 0;
                        else if (col === 'review_score') filteredData[col] = parseFloat(data[col]) || 0;
                        else filteredData[col] = data[col];
                    }
                });
                
                results.push(filteredData);
            }
        })
        .on('error', (err) => {
            console.error('CSV Stream Error:', err);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ error: 'Failed to process CSV file' });
        })
        .on('end', async () => {
            console.log(`CSV parsed. Found ${results.length} valid rows.`);
            if (results.length === 0) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: 'No valid leads found (Email or Phone required)' });
            }
            
            try {
                // Batch insert in chunks of 500 to be safe
                const CHUNK_SIZE = 500;
                let totalInserted = 0;
                for (let i = 0; i < results.length; i += CHUNK_SIZE) {
                    const chunk = results.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase.from('leads').insert(chunk);
                    if (error) throw error;
                    totalInserted += chunk.length;
                }
                
                console.log(`Successfully imported ${totalInserted} leads.`);
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                
                // Trigger any active campaigns using this list
                const { data: activeCampaigns } = await supabase.from('campaigns')
                    .select('*')
                    .eq('active', true)
                    .contains('lead_list_ids', [req.params.id]);
                
                if (activeCampaigns && activeCampaigns.length > 0) {
                    console.log(`Triggering ${activeCampaigns.length} campaigns for newly imported leads...`);
                    for (const campaign of activeCampaigns) {
                        processCampaign(campaign);
                    }
                }

                res.json({ count: totalInserted });
            } catch (error) {
                console.error('Supabase Import Error:', error.message);
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                res.status(500).json({ error: error.message });
            }
        });
});

app.get('/api/campaigns/:id/leads', authenticate, async (req, res) => {
    let cQuery = supabase.from('campaigns').select('id, lead_list_ids').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
    const { data: campaign } = await cQuery.single();
    if (!campaign) return res.status(403).json({ error: 'Access denied or campaign not found' });

    if (!campaign.lead_list_ids || campaign.lead_list_ids.length === 0) {
        return res.json([]);
    }

    const { data, error } = await supabase.from('leads').select('*').in('list_id', campaign.lead_list_ids).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/leads/:id/status', authenticate, checkAdmin, async (req, res) => {
    const { status } = req.body;
    let lQuery = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(403).json({ error: 'Access denied or lead not found' });

    const { data, error } = await supabase.from('leads').update({ status }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/leads/:id', authenticate, checkAdmin, async (req, res) => {
    let lQuery = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(403).json({ error: 'Access denied or lead not found' });

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.campaign_id;
    delete updateData.user_id;
    delete updateData.created_at;
    delete updateData.campaigns;

    const { data, error } = await supabase.from('leads').update(updateData).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.get('/api/leads/by-email/:email', authenticate, checkAdmin, async (req, res) => {
    let query = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('email', req.params.email);
    if (!isSuperAdmin(req.user)) query = query.eq('campaigns.user_id', req.user.id);
    const { data, error } = await query.limit(1);
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(data[0]);
});

app.delete('/api/leads/:id', authenticate, checkAdmin, async (req, res) => {
    let lQuery = supabase.from('leads').select('*, campaigns!inner(user_id)').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
    const { data: lead, error: leadError } = await lQuery.single();
    if (leadError || !lead) return res.status(403).json({ error: 'Access denied' });

    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- LOGS & REPLIES ---
app.get('/api/logs', authenticate, async (req, res) => {
    try {
        let query;
        if (isSuperAdmin(req.user)) {
            // Admins see everything, no need for complex inner joins that might fail if relationships aren't perfect
            query = supabase.from('email_logs').select('*, campaigns(name, user_id), leads(email, company)');
        } else {
            // Regular users only see their own logs via campaign link
            query = supabase.from('email_logs').select('*, campaigns!inner(name, user_id), leads(email, company)')
                .eq('campaigns.user_id', req.user.id);
        }

        // Use created_at if sent_at is missing, or try both
        const { data, error } = await query.order('sent_at', { ascending: false });
        
        if (error) {
            console.error('Supabase logs error:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (err) {
        console.error('Logs route crash:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campaigns/:id/logs', authenticate, async (req, res) => {
    try {
        let cQuery = supabase.from('campaigns').select('id').eq('id', req.params.id);
        if (!isSuperAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
        const { data: campaign } = await cQuery.single();
        if (!campaign) return res.status(403).json({ error: 'Access denied' });

        const { data, error } = await supabase.from('email_logs')
            .select('*, leads(email, company)')
            .eq('campaign_id', req.params.id)
            .order('sent_at', { ascending: false });
            
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campaigns/:id/reports', authenticate, async (req, res) => {
    try {
        const campaignId = req.params.id;
        
        // 1. Verify access
        let cQuery = supabase.from('campaigns').select('id, lead_list_ids').eq('id', campaignId);
        if (!isSuperAdmin(req.user)) cQuery = cQuery.eq('user_id', req.user.id);
        const { data: campaign } = await cQuery.single();
        if (!campaign) return res.status(403).json({ error: 'Access denied or campaign not found' });

        // 2. Fetch Lead Stats
        const { data: leadStats, error: lError } = await supabase.from('leads')
            .select('status')
            .in('list_id', campaign.lead_list_ids || [])
            .not('email', 'is', null)
            .neq('email', '');
        
        if (lError) throw lError;

        const leadCounts = {
            total: leadStats.length,
            pending: 0,
            sent: 0,
            replied: 0,
            bounced: 0,
            unsubscribed: 0,
            completed: 0
        };

        leadStats.forEach(l => {
            if (l.status.startsWith('follow_up')) leadCounts.sent++;
            else if (leadCounts[l.status] !== undefined) leadCounts[l.status]++;
            else leadCounts.pending++;
        });

        // 3. Fetch Log Stats (Sent vs Failed)
        const { data: logStats, error: logError } = await supabase.from('email_logs')
            .select('status, type, sent_at')
            .eq('campaign_id', campaignId);
        
        if (logError) throw logError;

        const emailStats = {
            sent: logStats.filter(l => l.status === 'sent').length,
            failed: logStats.filter(l => l.status === 'failed').length,
            types: {}
        };

        logStats.forEach(l => {
            emailStats.types[l.type] = (emailStats.types[l.type] || 0) + 1;
        });

        // 4. Timeline Data (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const timeline = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            timeline[d.toISOString().split('T')[0]] = { sent: 0, failed: 0 };
        }

        logStats.forEach(l => {
            const date = new Date(l.sent_at).toISOString().split('T')[0];
            if (timeline[date]) {
                timeline[date][l.status]++;
            }
        });

        res.json({
            leadCounts,
            emailStats,
            timeline: Object.entries(timeline).map(([date, counts]) => ({ date, ...counts })).reverse()
        });

    } catch (err) {
        console.error('Report Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leads/:id/reply', authenticate, checkAdmin, async (req, res) => {
    const { subject, body } = req.body;
    let lQuery = supabase.from('leads').select('*, campaigns!inner(*)').eq('id', req.params.id);
    if (!isSuperAdmin(req.user)) lQuery = lQuery.eq('campaigns.user_id', req.user.id);
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
        const isAdmin = isSuperAdmin(req.user);
        console.log(`Summary requested. User: ${req.user.email}, ID: ${req.user.id}, IsAdmin: ${isAdmin}`);
        
        let totalLeads = 0;
        let contacted = 0;
        let replied = 0;
        let totalLists = 0;
        let totalCampaigns = 0;
        let dailyCount = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isAdmin) {
            const [tRes, cRes, rRes, lRes, camRes, dRes] = await Promise.all([
                supabase.from('leads').select('*', { count: 'exact' }).limit(0),
                supabase.from('leads').select('*', { count: 'exact' }).neq('status', 'pending').limit(0),
                supabase.from('leads').select('*', { count: 'exact' }).eq('status', 'replied').limit(0),
                supabase.from('lead_lists').select('*', { count: 'exact' }).limit(0),
                supabase.from('campaigns').select('*', { count: 'exact' }).limit(0),
                supabase.from('email_logs').select('*', { count: 'exact' }).gte('sent_at', today.toISOString()).limit(0)
            ]);
            
            totalLeads = tRes.count || 0;
            contacted = cRes.count || 0;
            replied = rRes.count || 0;
            totalLists = lRes.count || 0;
            totalCampaigns = camRes.count || 0;
            dailyCount = dRes.count || 0;

            console.log("Admin summary raw counts:", { 
                leads: tRes.count, 
                campaigns: camRes.count, 
                daily: dRes.count,
                leadsError: tRes.error,
                campaignsError: camRes.error 
            });
        } else {
            const { data: userCampaigns } = await supabase.from('campaigns').select('id').eq('user_id', req.user.id);
            const campaignIds = userCampaigns?.map(c => c.id) || [];

            const [tRes, cRes, rRes, lRes, camRes, dRes] = await Promise.all([
                supabase.from('leads').select('*', { count: 'exact' }).eq('user_id', req.user.id).limit(0),
                supabase.from('leads').select('*', { count: 'exact' }).eq('user_id', req.user.id).neq('status', 'pending').limit(0),
                supabase.from('leads').select('*', { count: 'exact' }).eq('user_id', req.user.id).eq('status', 'replied').limit(0),
                supabase.from('lead_lists').select('*', { count: 'exact' }).eq('user_id', req.user.id).limit(0),
                supabase.from('campaigns').select('*', { count: 'exact' }).eq('user_id', req.user.id).limit(0),
                campaignIds.length > 0 
                    ? supabase.from('email_logs').select('*', { count: 'exact' }).in('campaign_id', campaignIds).gte('sent_at', today.toISOString()).limit(0)
                    : { count: 0 }
            ]);
            
            totalLeads = tRes.count || 0;
            contacted = cRes.count || 0;
            replied = rRes.count || 0;
            totalLists = lRes.count || 0;
            totalCampaigns = camRes.count || 0;
            dailyCount = dRes.count || 0;

            console.log("User summary raw counts:", { 
                leads: tRes.count, 
                campaigns: camRes.count, 
                daily: dRes.count,
                campaignIds: campaignIds.length
            });
        }

        console.log(`[Summary] Response for ${req.user.email}:`, { 
            totalLeads, contacted, replied, totalLists, totalCampaigns, dailyCount 
        });

        res.json({ 
            totalLeads, 
            contacted, 
            replied, 
            totalLists,
            totalCampaigns,
            dailyCount,
            replyRate: contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : 0 
        });
    } catch (err) { 
        console.error("Summary route crash:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/send-test', authenticate, checkAdmin, async (req, res) => {
    const { email, subject, body, fromEmail, fromName, leadData } = req.body;
    
    let finalLeadData = leadData;

    if (!finalLeadData) {
        const { data: testLead } = await supabase
            .from('leads')
            .select('*')
            .eq('email', 'sahedalomsumit@zohomail.eu')
            .limit(1);

        finalLeadData = (testLead && testLead.length > 0) ? testLead[0] : { 
            company: 'OutreachOS',
            email: 'sahedalomsumit@zohomail.eu',
            website: 'outreachos.com',
            phone: '+880123456789',
            reviews: 150,
            review_score: 4.9
        };
    }

    const replacements = {
        '{{company}}': finalLeadData.company || '',
        '{{email}}': finalLeadData.email || '',
        '{{website}}': finalLeadData.website || '',
        '{{phone}}': finalLeadData.phone || '',
        '{{reviews}}': finalLeadData.reviews || '0',
        '{{review_score}}': finalLeadData.review_score || '0',
        '{{instagram}}': finalLeadData.instagram || '',
        '{{facebook}}': finalLeadData.facebook || '',
        '{{linkedin}}': finalLeadData.linkedin || ''
    };

    let personalizedSubject = subject;
    let personalizedBody = body;

    Object.keys(replacements).forEach(tag => {
        const regex = new RegExp(tag, 'g');
        personalizedSubject = personalizedSubject.replace(regex, replacements[tag]);
        personalizedBody = personalizedBody.replace(regex, replacements[tag]);
    });

    const result = await sendEmail({ 
        to: email, 
        lead: finalLeadData, 
        subject: personalizedSubject, 
        body: personalizedBody, 
        fromEmail, 
        fromName 
    });

    if (result.success) res.json({ success: true });
    else res.status(500).json({ error: result.error });
});

// --- CRON JOB ---
// --- CAMPAIGN EXECUTION LOGIC ---
async function processCampaign(campaign, manual = false) {
    if (!campaign.active && !manual) return { processed: 0, errors: 0 };
    if (!campaign.lead_list_ids || campaign.lead_list_ids.length === 0) return { processed: 0, errors: 0 };

    console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

    const { data: leads, error: leadsError } = await supabase.from('leads')
        .select('*')
        .in('list_id', campaign.lead_list_ids)
        .not('status', 'in', '("replied","bounced","completed","unsubscribed")')
        .not('email', 'is', null)
        .neq('email', '')
        .lt('follow_ups', (campaign.max_follow_ups || 0) + 1);

    if (leadsError) {
        console.error(`Error fetching leads for campaign ${campaign.id}:`, leadsError.message);
        return { processed: 0, errors: 1 };
    }

    if (!leads || leads.length === 0) {
        console.log(`No eligible leads for campaign ${campaign.id}`);
        return { processed: 0, errors: 0 };
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
        try {
            // Determine email type and if it's time to send
            let type = 'initial';
            let shouldSend = false;

            if (!lead.last_contact || lead.follow_ups === 0) {
                // Initial email
                type = 'initial';
                shouldSend = true;
            } else {
                // Follow-up
                const followUpIndex = lead.follow_ups - 1; // 0-based index for delays array
                const delayDays = campaign.follow_up_delays ? campaign.follow_up_delays[followUpIndex] : null;
                
                if (delayDays !== null && delayDays !== undefined) {
                    const lastContact = new Date(lead.last_contact);
                    const now = new Date();
                    const diffTime = Math.abs(now - lastContact);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= delayDays) {
                        type = `follow_up_${lead.follow_ups}`;
                        shouldSend = true;
                    }
                }
            }

            if (shouldSend) {
                const template = campaign.templates[type];
                if (!template) {
                    console.warn(`No template found for type "${type}" in campaign ${campaign.id}`);
                    continue;
                }

                console.log(`Sending ${type} to ${lead.email}...`);
                const result = await sendEmail({ 
                    to: lead.email, 
                    lead, 
                    subject: template.subject, 
                    body: template.body, 
                    fromEmail: campaign.from_email, 
                    fromName: campaign.sender_name 
                });

                if (result.success) {
                    await supabase.from('leads').update({ 
                        status: type === 'initial' ? 'sent' : type, 
                        follow_ups: lead.follow_ups + 1, 
                        last_contact: new Date().toISOString() 
                    }).eq('id', lead.id);

                    await supabase.from('email_logs').insert([{ 
                        lead_id: lead.id, 
                        campaign_id: campaign.id, 
                        type, 
                        status: 'sent',
                        sent_at: new Date().toISOString()
                    }]);
                    
                    processedCount++;
                } else {
                    await supabase.from('email_logs').insert([{ 
                        lead_id: lead.id, 
                        campaign_id: campaign.id, 
                        type, 
                        status: 'failed',
                        error_message: result.error,
                        sent_at: new Date().toISOString()
                    }]);
                    errorCount++;
                }
                
                // Add a small delay between emails to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (err) {
            console.error(`Error processing lead ${lead.id}:`, err.message);
            errorCount++;
        }
    }

    // Update last run time
    await supabase.from('campaigns').update({ last_run: new Date().toISOString() }).eq('id', campaign.id);

    return { processed: processedCount, errors: errorCount };
}

// --- CAMPAIGN ROUTES (Continued) ---
app.post('/api/campaigns/:id/run', authenticate, checkSuperAdmin, async (req, res) => {
    console.log(`Manual run requested for campaign: ${req.params.id} by ${req.user.email}`);
    try {
        const { data: campaign, error } = await supabase.from('campaigns').select('*').eq('id', req.params.id).single();
        
        if (error) {
            console.error('Supabase error fetching campaign:', error.message);
            return res.status(404).json({ error: `Campaign not found: ${error.message}` });
        }
        
        if (!campaign) {
            console.warn('Campaign object is empty');
            return res.status(404).json({ error: 'Campaign not found' });
        }

        console.log(`Campaign found: ${campaign.name}. Starting processing...`);
        const summary = await processCampaign(campaign, true);
        console.log(`Processing complete. Summary:`, summary);
        res.json({ success: true, ...summary });
    } catch (err) {
        console.error('Manual run route crash:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- CRON JOB ---
// Runs every hour to check for follow-ups and new leads automatically
cron.schedule('0 * * * *', async () => {
    console.log('Running hourly campaign check...');
    const { data: campaigns } = await supabase.from('campaigns').select('*').eq('active', true);
    if (!campaigns) return;
    
    for (const campaign of campaigns) {
        await processCampaign(campaign);
    }
    console.log('Hourly check completed.');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
