const twilio = require('twilio');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { clientName, phone, service } = JSON.parse(event.body);

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const message = `Hi ${clientName.split(' ')[0]}, thank you so much for coming in today! I hope you love your ${service}. I'd really appreciate it if you could take a minute to leave me a Google review — it makes a huge difference to a small business. ${process.env.GOOGLE_REVIEW_LINK} Thank you! Ash x Please note replies cannot be made to this number. For queries WhatsApp Ash on 07821530442`;

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : '+44' + phone.replace(/^0/, '')
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
