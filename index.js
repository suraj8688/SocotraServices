 const express = require('express');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
      user: 'Socotra763@outlook.com',
      pass: 'Socotra123*',
    },
  });

const app = express();

app.use(express.json());

app.get('/api/helllo', (req, res) => {
    res.send('Hello, World!');
});


app.post('/api/sendEmail', async (req , res) => {
    const { id, transactionId, timestamp, data, type, username } = req.body;
    
    const policyNumber = data["policyLocator"];     // policyLocator  

    // Creating Authorization token

    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: 'alice.lee',
            password: "socotra",
            hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
        }),
    });

    const js_obj_auth = await response_auth.json();
    const string_json_auth = JSON.stringify(js_obj_auth);
    const parse_json_auth = JSON.parse(string_json_auth);

    const auth_token = parse_json_auth.authorizationToken;


    // Fetching policy from policyLocator

    const response_policy = await fetch("https://api.sandbox.socotra.com/policy/" + policyNumber, {
        method: 'GET',
        headers: {
            "Authorization": auth_token,
            "Content-type": "application/json; charset=UTF-8"
        },

    })

    const js_obj_policy = await response_policy.json();
    const string_json_policy = JSON.stringify(js_obj_policy);
    const parse_json_policy = JSON.parse(string_json_policy);

    const email = parse_json_policy.characteristics[0].fieldValues.email_field_example;

    const doc = parse_json_policy.documents[0].url;
    

    function sendEmail(to, subject, text) {
        const mailOptions = {
          from: 'Socotra763@outlook.com',
          to: to,
          subject: subject,
          text: text
        };
      
        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });
      }

      sendEmail('suraj.kumar@kmgin.com', 'Test', 'Quotation Schedule Document : '+doc);

    
   //console.log(req.body);

    res.status(200).json({ message: 'Request received successfully' });
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
