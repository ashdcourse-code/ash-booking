bash

cat /home/claude/ash-deploy/functions/create-payment-intent.js
Output

const Stripe = require('stripe');
const twilio = require('twilio');

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
    const {
      amount,
      service,
      clientName,
      email,
      phone,
      date,
      time,
      notes
    } = body;

    // Validate
    if (!amount || !service || !clientName || !email || !phone || !date || !time) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Create Stripe payment intent
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'gbp',
      metadata: {
        service,
        clientName,
        email,
        phone,
        date,
        time,
        notes: notes || ''
      },
      receipt_email: email,
      description: `Booking fee — ${service} — ${clientName}`
    });

    // Send confirmation SMS via Twilio
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const apptDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const depositAmount = (amount / 100).toFixed(2);

      const message = `Hi ${clientName.split(' ')[0]}, your booking with Ash Dormer is confirmed! ${service} on ${apptDate} at ${time}. Booking fee paid: £${depositAmount}. Your full address will be sent separately. Cash payments preferred for balance on the day. Please note replies cannot be made to this number. For queries WhatsApp Ash on 07821530442 or email ash@ashdormer.com`;

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone.startsWith('+') ? phone : '+44' + phone.replace(/^0/, '')
      });
    } catch (smsError) {
      // SMS failure shouldn't block the payment
      console.error('SMS error:', smsError.message);
    }

    // Send confirmation email via Resend
    try {
      const apptDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const depositAmount = (amount / 100).toFixed(2);
      const totalMatch = body.price || (amount / 100);
      const balance = (totalMatch - (amount / 100)).toFixed(2);

      const emailHtml = `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1612;">
          <div style="padding: 2rem 0 1rem; border-bottom: 1px solid #e0d8cf;">
            <h1 style="font-family: Georgia, serif; font-size: 1.5rem; font-weight: 400; letter-spacing: 0.06em;">Ash Dormer</h1>
            <p style="font-size: 0.75rem; color: #6b6560; letter-spacing: 0.12em; text-transform: uppercase;">Permanent Makeup &amp; Beauty</p>
          </div>

          <div style="padding: 1.5rem 0;">
            <h2 style="font-family: Georgia, serif; font-size: 1.3rem; font-weight: 400; margin-bottom: 1rem;">You're booked in, ${clientName.split(' ')[0]}!</h2>
            <p style="font-size: 0.85rem; color: #6b6560; margin-bottom: 1.5rem;">Here's everything you need to know about your appointment.</p>

            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-bottom:1.5rem;">
              <tr style="border-bottom:1px solid #e0d8cf;">
                <td style="padding:0.6rem 0;color:#6b6560;">Treatment</td>
                <td style="padding:0.6rem 0;text-align:right;">${service}</td>
              </tr>
              <tr style="border-bottom:1px solid #e0d8cf;">
                <td style="padding:0.6rem 0;color:#6b6560;">Date</td>
                <td style="padding:0.6rem 0;text-align:right;">${apptDate}</td>
              </tr>
              <tr style="border-bottom:1px solid #e0d8cf;">
                <td style="padding:0.6rem 0;color:#6b6560;">Time</td>
                <td style="padding:0.6rem 0;text-align:right;">${time}</td>
              </tr>
              <tr style="border-bottom:1px solid #e0d8cf;">
                <td style="padding:0.6rem 0;color:#6b6560;">Location</td>
                <td style="padding:0.6rem 0;text-align:right;">106 Cedar Avenue, Hazlemere, HP15 7AW</td>
              </tr>
              <tr style="border-bottom:1px solid #e0d8cf;">
                <td style="padding:0.6rem 0;color:#6b6560;">Booking fee paid</td>
                <td style="padding:0.6rem 0;text-align:right;">£${depositAmount}</td>
              </tr>
              <tr>
                <td style="padding:0.6rem 0;color:#6b6560;">Balance due on the day</td>
                <td style="padding:0.6rem 0;text-align:right;font-weight:500;">£${balance}</td>
              </tr>
            </table>

            <div style="background:#fdf8f3;border:1px solid #e0d8cf;border-radius:4px;padding:1rem;font-size:0.8rem;line-height:1.6;margin-bottom:1.5rem;">
              <p style="margin-bottom:0.5rem;"><strong>Cash payments preferred</strong> for your balance on the day. Please bring the exact amount if you can. Bank transfer also available.</p>
              <p>A patch test is mandatory 48 hours before your appointment if you haven't had one recently. Please WhatsApp Ash on 07821 530442 to arrange.</p>
            </div>

            <div style="background:#fff8e1;border:1px solid #e0d8cf;border-radius:4px;padding:1rem;font-size:0.78rem;line-height:1.6;margin-bottom:1.5rem;">
              <p style="font-weight:500;margin-bottom:0.5rem;">You have agreed to the following booking policy:</p>
              <p style="margin-bottom:0.3rem;">Your booking fee is nonrefundable and nontransferable under any circumstances.</p>
              <p style="margin-bottom:0.3rem;">Cancellations within 48 hours forfeit the booking fee in full. A new booking fee is required to rebook.</p>
              <p style="margin-bottom:0.3rem;">You may reschedule once only, with more than 48 hours notice.</p>
              <p>No shows will require full balance payment before a new appointment can be booked.</p>
            </div>

            <p style="font-size:0.82rem;color:#6b6560;">Any questions? WhatsApp Ash directly on <strong>07821 530442</strong> or email <strong>ash@ashdormer.com</strong></p>
          </div>

          <div style="border-top:1px solid #e0d8cf;padding:1rem 0;font-size:0.72rem;color:#6b6560;">
            Ash Dormer Permanent Makeup &amp; Beauty · Hazlemere, Buckinghamshire HP15
          </div>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Ash Dormer Bookings <bookings@ashdormer.com>',
          to: email,
          subject: `Booking confirmed — ${service} on ${apptDate}`,
          html: emailHtml
        })
      });
    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
    };

  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
