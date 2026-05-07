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
    const { clientName, phone, service, date, time, price, deposit } = JSON.parse(event.body);

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const apptDate = new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const balance = (price - deposit).toFixed(2);

    const message = `Hi ${clientName.split(' ')[0]}, this is a reminder that you have an appointment with Ash on ${apptDate} at ${time} · ${service} · Total: £${parseFloat(price).toFixed(2)} · Balance due: £${balance} · Cash payments preferred, please bring the exact amount if you can. Bank transfer also available. Cards accepted but subject to a 1.75% fee. Your address was confirmed in your booking confirmation. See you soon! Please note replies cannot be made to this number. For queries WhatsApp Ash on 07821530442 or email ash@ashdormer.com`;

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
