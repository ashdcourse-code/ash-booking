bash

cat > /home/claude/ash-deploy/functions/create-payment-intent.js << 'EOF'
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body);
    const { amount, service, clientName, email, phone, date, time, notes, price } = body;

    if (!amount || !service || !clientName || !email || !phone || !date || !time) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Stripe
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'gbp',
      metadata: { service, clientName, email, phone, date, time, notes: notes || '' },
      receipt_email: email,
      description: `Booking fee — ${service} — ${clientName}`
    });

    // SMS via Twilio
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const apptDate = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const depositAmount = (amount / 100).toFixed(2);
      const totalPrice = price || (amount / 100);
      const balance = (totalPrice - (amount / 100)).toFixed(2);

      const message = `Hi ${clientName.split(' ')[0]}, your booking with Ash Dormer is confirmed! ${service} on ${apptDate} at ${time}. Booking fee paid: £${depositAmount}. Balance due on the day: £${balance}. Cash preferred. Full address will be sent separately. Please note replies cannot be made to this number. For queries WhatsApp Ash on 07821530442 or email ash@ashdormer.com`;

      const toNumber = phone.startsWith('+') ? phone : '+44' + phone.replace(/^0/, '');
      await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to: toNumber });
    } catch (smsErr) {
      console.error('SMS error:', smsErr.message);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ clientSecret: paymentIntent.client_secret }) };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
EOF
echo "Done"
Output

Done
