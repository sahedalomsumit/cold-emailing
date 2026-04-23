require('dotenv').config();
const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_HEADERS = {
    'accept': 'application/json',
    'api-key': process.env.BREVO_API_KEY,
    'content-type': 'application/json'
};

async function test() {
    try {
        console.log('Using API Key:', process.env.BREVO_API_KEY ? 'Present' : 'Missing');
        const response = await axios.post(BREVO_API_URL, {
            sender: { name: "OutreachOS Test", email: "hello@outreach.sahedalomsumit.com" },
            to: [{ email: "sahedalomsumit@gmail.com", name: "Sahed" }],
            subject: "Test from Script",
            htmlContent: "<html><body><h1>It works!</h1></body></html>"
        }, { headers: BREVO_HEADERS });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

test();
