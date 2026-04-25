
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testAll() {
    console.log('Testing Summary Query (Admin)...');
    const { count: totalLeads, error: summaryError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true });
    
    if (summaryError) {
        console.error('Summary Query Error:', summaryError);
    } else {
        console.log('Summary Success. Total leads:', totalLeads);
    }

    console.log('\nTesting Logs Query (Admin)...');
    const { data: logs, error: logsError } = await supabase
        .from('email_logs')
        .select('*, campaigns(name, user_id), leads(email, company)')
        .limit(5);
    
    if (logsError) {
        console.error('Logs Query Error:', logsError);
    } else {
        console.log('Logs Success. Count:', logs ? logs.length : 0);
    }
}

testAll();
