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
    const { paymentIntentId, service, clientName, email, phone, date, time, notes, price, deposit, termsAgreedAt } = body;

    // Verify payment with Stripe
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payment not confirmed' }) };
    }

    // Save to Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    const termsWording = 'By placing this booking I understand that my booking fee is nonrefundable and nontransferable, cancellations within 48 hours forfeit the booking fee, I may only reschedule once with more than 48 hours notice, and no shows require full balance payment before rebooking. I understand that it is my responsibility to contact Ash via WhatsApp on 07821 530442 to arrange a patch test at least 48 hours prior to my appointment. Failure to do so may result in my appointment being cancelled and the loss of my booking fee.';

    const bookingData = {
      client_name: clientName,
      email,
      phone,
      service,
      date,
      time,
      total_price: price,
      deposit_paid: deposit,
      stripe_payment_id: paymentIntentId,
      status: 'confirmed',
      notes: notes || '',
      terms_agreed_at: termsAgreedAt,
      terms_wording: termsWording,
      created_at: new Date().toISOString()
    };

    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(bookingData)
    });

    if (!dbResponse.ok) {
      console.error('Supabase error:', await dbResponse.text());
    }

    // Send SMS confirmation via Twilio
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const apptDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const depositAmount = parseFloat(deposit).toFixed(2);
      const balance = (parseFloat(price) - parseFloat(deposit)).toFixed(2);

      const message = `Hi ${clientName.split(' ')[0]}, your booking with Ash Dormer is confirmed! ${service} on ${apptDate} at ${time}. Booking fee paid: £${depositAmount}. Balance due on the day: £${balance}. Cash preferred. Full address will be sent separately. IMPORTANT: Please WhatsApp Ash on 07821530442 to arrange your patch test at least 48 hours before your appointment. Failure to do so may result in cancellation and loss of your booking fee. Replies cannot be made to this number.`;

      const toNumber = phone.startsWith('+') ? phone : '+44' + phone.replace(/^0/, '');
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
    } catch (smsErr) {
      console.error('SMS error:', smsErr.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
