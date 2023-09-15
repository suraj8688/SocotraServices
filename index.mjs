import express from 'express';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

import { promisify } from 'util';
import AWS from 'aws-sdk';
import S3FS from 's3fs';



const s3fsImpl = new S3FS('cyclic-fair-rose-grasshopper-belt-eu-west-2');


const transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: 'Socotra763@outlook.com',
    pass: 'Socotra123*',
  },
});

const app = express();

app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.send('Hello, World!');
});

// Autocreate Exposure through excel Rater.

app.post('/api/excelAutofill', async (req, res) => {
  try {
    const expList = [];

    const docUrl = "https://docs.google.com/spreadsheets/d/1Jfs4KxItq4ur-AKe7ULMOa3RzyMWzdOd/edit?usp=sharing&ouid=103712775324188005401&rtpof=true&sd=true";

    const response_document = await fetch(docUrl);
    if (!response_document.ok) {
      throw new Error('Failed to download the document');
    }

    const documentBuffer = await response_document.buffer();

    const s3Key = `documents/excel_rater.xlsx`;
    await s3fsImpl.writeFile(s3Key, documentBuffer);

    const s3ReadStream = s3fsImpl.createReadStream(s3Key)

    const workbook = XLSX.readFile(s3ReadStream);
    const worksheet = workbook.Sheets['Worksheet']; // Replace 'Worksheet' with your sheet name

    const rowCount = worksheet['!ref'].split(':')[1].replace(/\D/g, '');
    console.log(rowCount);
    for (let row = 5; row <= rowCount; row++) {
      const peril1 = {
        name: 'Additional Coverages',
        fieldValues: {
          Deductible: worksheet[`AN${row}`] ? worksheet[`AN${row}`].v : null,
          Earthquake_Limit: worksheet[`AK${row}`] ? worksheet[`AK${row}`].v : null,
          Flood_Limit: worksheet[`AR${row}`] ? worksheet[`AR${row}`].v : null,
          Windstorm_Limit: row,
        },
      };

      const peril2 = {
        name: 'Fire and Perils',
        fieldValues: {
          Fire_Limit_Building: worksheet[`H${row}`] ? worksheet[`H${row}`].v : null,
          Fire_Limit_Contents: row,
          Stock_Limit: row,
          Personal_Property_of_others_Limit: row,
          Machinery_Or_Equipment_Breakdown_Limit: row,
          Electronic_Breakdown_Limit: row,
          Business_Interruption_or_Income_Limit: worksheet[`R${row}`] ? worksheet[`R${row}`].v : null,
          Deductible: worksheet[`J${row}`] ? worksheet[`J${row}`].v : null,
        },
      };

      const peril3 = {
        name: 'Other Coverages',
        fieldValues: {
          Glass_Limit: row,
          Deductible: row,
          Burglary_Limit: row,
          Money_Limit: row,
        },
      };

      const perilList = [peril1, peril2, peril3];

      const exposureFieldValues = {
        distance_from_Fire_station_in_miles: row,
        City_Town: worksheet[`F${row}`] ? worksheet[`F${row}`].v : null,
        address_1: worksheet[`B${row}`] ? worksheet[`B${row}`].v : null,
        business_established_year: row,
        address_2: row,
        no_of_stories: worksheet[`AC${row}`] ? worksheet[`AC${row}`].v : null,
        nature_of_business: row,
        area_of_the_property: worksheet[`Y${row}`] ? worksheet[`Y${row}`].v : null,
        security_system: row,
        type_of_construction: worksheet[`AG${row}`] ? worksheet[`AG${row}`].v : null,
        distance_to_fire_hydrant: row,
        ZIP_Code: row,
        sic_code: row,
        year_of_the_construction: worksheet[`W${row}`] ? worksheet[`W${row}`].v : null,
        does_property_have_basement: row,
        building_name: row,
        State: worksheet[`D${row}`] ? worksheet[`D${row}`].v : null,
        legal_entity: row,
        property_used_by: row,
        property_type: row,
        location_number: row,
      };

      const exposure = {
        exposureName: 'Commercial Building',
        perils: perilList,
        fieldValues: exposureFieldValues,
      };

      expList.push(exposure);
    }

    const response = {
      addExposures: expList,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// simple Auto external Rater

app.post('/api/externalRater', async (req, res) => {
  try {
    const { policyExposurePerils, policy, operation, tenantTimeZone, quoteLocator } = req.body;

    const vehicle_value = policy.exposures[0]?.characteristics[0]?.fieldValues?.vehicle_value;

    const yearlyPremium = parseInt(vehicle_value) * 0.65;

    const peril1 = policyExposurePerils[0].perilCharacteristicsLocator;
    const peril2 = policyExposurePerils[1].perilCharacteristicsLocator;

    const pricedPerilCharacteristics = {};

    const prop1 = peril1;
    const prop2 = peril2;

    pricedPerilCharacteristics[prop1] = {yearlyPremium};
    pricedPerilCharacteristics[prop2] = {yearlyPremium};
    
    res.status(201).json({
      pricedPerilCharacteristics
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

app.post('/api/sendEmail', async (req, res) => {
  try {
    const { id, transactionId, timestamp, data, type, username } = req.body;

    const policyNumber = data["policyLocator"]; // policyLocator

    // Creating Authorization token
    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'alice.lee',
        password: 'socotra',
        hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
      }),
    });

    if (!response_auth.ok) {
      throw new Error('Failed to authenticate with Socotra API');
    }

    const js_obj_auth = await response_auth.json();
    const auth_token = js_obj_auth.authorizationToken;

    // Fetching policy from policyLocator
    const response_policy = await fetch(`https://api.sandbox.socotra.com/policy/${policyNumber}`, {
      method: 'GET',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
    });

    if (!response_policy.ok) {
      throw new Error('Failed to fetch policy data from Socotra API');
    }

    const js_obj_policy = await response_policy.json();
    const email = js_obj_policy.characteristics[0]?.fieldValues?.email;
    const doc = js_obj_policy.documents[0]?.url;

    const documentType = js_obj_policy.documents[0]?.displayName;

    let subject = '';

    if (documentType === 'Quotation Schedule') {
      subject = 'Quotation Document';
    }
    else {
      subject = 'attachment';
    }

    if (!email || !doc) {
      throw new Error('Invalid policy data: missing email or document URL');
    }

    await sendEmail(email, subject, `${documentType} Document: ${doc}`);

    res.status(200).json({ message: 'Request received successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});



app.post('/api/policyIssue', async (req, res) => {
  try {
    const { id, transactionId, timestamp, data, type, username } = req.body;

    const policyNumber = data["policyLocator"]; // policyLocator

    // Creating Authorization token
    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'alice.lee',
        password: 'socotra',
        hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
      }),
    });

    if (!response_auth.ok) {
      throw new Error('Failed to authenticate with Socotra API');
    }

    const js_obj_auth = await response_auth.json();
    const auth_token = js_obj_auth.authorizationToken;

    // Fetching policy from policyLocator
    const response_policy = await fetch(`https://api.sandbox.socotra.com/policy/${policyNumber}`, {
      method: 'GET',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
    });

    if (!response_policy.ok) {
      throw new Error('Failed to fetch policy data from Socotra API');
    }

    const js_obj_policy = await response_policy.json();
    const email = js_obj_policy.characteristics[0]?.fieldValues?.email;
    const doc = js_obj_policy.documents[1]?.url;

    const documentType = js_obj_policy.documents[1]?.displayName;

    let subject = '';

    if (documentType === 'New Business Schedule') {
      subject = 'Policy Document';
    }
    else {
      subject = 'attachment';
    }

    if (!email || !doc) {
      throw new Error('Invalid policy data: missing email or document URL');
    }

    // Download the document from the URL
    const response_document = await fetch(doc);
    if (!response_document.ok) {
      throw new Error('Failed to download the document');
    }

    const documentBuffer = await response_document.buffer();

    // Convert the document to PDF format (you may need to use an appropriate library)
    // For example, if the document is already in PDF format, you may skip this step.

    // Save the document as a temporary file
    const s3Key = `documents/${policyNumber}/${documentType}.pdf`;
    await s3fsImpl.writeFile(s3Key, documentBuffer);

    // Send the email with the document attached from S3
    await sendEmailWithS3Attachment(email, subject, `${documentType}.pdf`, s3Key);


    res.status(200).json({ message: 'Request received successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});



app.post('/api/endorsementIssue', async (req, res) => {
  try {
    const { id, transactionId, timestamp, data, type, username } = req.body;

    const policyNumber = data["policyLocator"]; // policyLocator

    const locator = data["endorsementLocator"];

    // Creating Authorization token
    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'alice.lee',
        password: 'socotra',
        hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
      }),
    });

    if (!response_auth.ok) {
      throw new Error('Failed to authenticate with Socotra API');
    }

    const js_obj_auth = await response_auth.json();
    const auth_token = js_obj_auth.authorizationToken;

    // Fetching policy from policyLocator
    const response_policy = await fetch(`https://api.sandbox.socotra.com/policy/${policyNumber}`, {
      method: 'GET',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
    });

    if (!response_policy.ok) {
      throw new Error('Failed to fetch policy data from Socotra API');
    }

    const js_obj_policy = await response_policy.json();
    const email = js_obj_policy.characteristics[0]?.fieldValues?.email;


    // Fetching policy from Locator for endosement


    const response_Locator = await fetch("https://api.sandbox.socotra.com/endorsements/" + locator, {
      method: 'GET',
      headers: {
        "Authorization": auth_token,
        "Content-type": "application/json; charset=UTF-8"
      },

    })

    const js_obj_Locator = await response_Locator.json();
    const string_json_Locator = JSON.stringify(js_obj_Locator);
    const parse_json_Locator = JSON.parse(string_json_Locator);

    const doc = parse_json_Locator.documents[0]?.url;

    const documentType = parse_json_Locator.documents[0]?.displayName;

    let subject = '';

    if (documentType === 'Policy Change') {
      subject = 'Endorsement Document';
    }
    else {
      subject = 'attachment';
    }

    if (!email || !doc) {
      throw new Error('Invalid policy data: missing email or document URL');
    }

    // Download the document from the URL
    const response_document = await fetch(doc);
    if (!response_document.ok) {
      throw new Error('Failed to download the document');
    }

    const documentBuffer = await response_document.buffer();

    // Convert the document to PDF format (you may need to use an appropriate library)
    // For example, if the document is already in PDF format, you may skip this step.

    // Save the document as a temporary file
    const s3Key = `documents/${policyNumber}/${documentType}.pdf`;
    await s3fsImpl.writeFile(s3Key, documentBuffer);

    // Send the email with the document attached from S3
    await sendEmailWithS3Attachment(email, subject, `${documentType}.pdf`, s3Key);


    res.status(200).json({ message: 'Request received successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});


async function sendEmail(to, subject, text) {
  try {
    const mailOptions = {
      from: 'Socotra763@outlook.com',
      to: to,
      subject: subject,
      text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}


app.post('/api/autofill', async (req, res) => {

  try {
    // Access the request body data
    const { operationType, opertaion, updates, productName, policyholderLocator } = req.body;



    const address = updates.updateExposures[0].fieldValues.address_1;
    const city = updates.updateExposures[0].fieldValues.City_Town;
    const state = updates.updateExposures[0].fieldValues.State;
    const zip_code = updates.updateExposures[0].fieldValues.ZIP_Code;

    const exposure_locator = updates.updateExposures[0].exposureLocator;
    const exposure_name = updates.updateExposures[0].exposureName;

    const url2 = 'https://api.hazardhub.com/v1/risks?address=' + address + '&city=' + city + '&state=' + state + '&zip=' + zip_code;
    const options2 = {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + process.env.api_key,
      }
    };

    try {
      const response2 = await fetch(url2, options2);

      const js_obj2 = await response2.json();
      const string_json2 = JSON.stringify(js_obj2);
      const parse_json2 = JSON.parse(string_json2);

      const result2 = {
        nearest_fire_station: parse_json2.nearest_fire_station.title,
        crime_rate: parse_json2.crime.score,
        earthquake_score: parse_json2.earthquake.score,
        burglary_score: parse_json2.burglary.score,
        storm_score: parse_json2.convection_storm.score,
        drought_index:  parse_json2.drought_frequency_index.score
      }


      res.status(201).json({

        //fieldValues : result,
        updateExposures: [{
          exposureLocator: exposure_locator,
          exposureName: exposure_name,
          fieldValues: result2,
        }]
      });


    } catch (error) {
      console.error(error);
    }
  }
  catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }



});



app.post('/api/sendEmail2', async (req, res) => {
  try {
    const { id, transactionId, timestamp, data, type, username } = req.body;
    const policyNumber = data["policyLocator"];

    // Creating Authorization token
    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'alice.lee',
        password: 'socotra',
        hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
      }),
    });

    if (!response_auth.ok) {
      throw new Error('Failed to authenticate with Socotra API');
    }

    const js_obj_auth = await response_auth.json();
    const auth_token = js_obj_auth.authorizationToken;

    // Fetching policy from policyLocator
    const response_policy = await fetch(`https://api.sandbox.socotra.com/policy/${policyNumber}`, {
      method: 'GET',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
    });

    if (!response_policy.ok) {
      throw new Error('Failed to fetch policy data from Socotra API');
    }

    const js_obj_policy = await response_policy.json();
    const email = js_obj_policy.characteristics[0]?.fieldValues?.email;
    const docUrl = js_obj_policy.documents[0]?.url;
    const documentType = js_obj_policy.documents[0]?.displayName;

    let subject = '';

    if (documentType === 'Quotation Schedule') {
      subject = 'Quotation Document';
    } else {
      subject = 'Attachment';
    }

    if (!email || !docUrl) {
      throw new Error('Invalid policy data: missing email or document URL');
    }

    // Download the document from the URL
    const response_document = await fetch(docUrl);
    if (!response_document.ok) {
      throw new Error('Failed to download the document');
    }

    const documentBuffer = await response_document.buffer();

    // Convert the document to PDF format (you may need to use an appropriate library)
    // For example, if the document is already in PDF format, you may skip this step.

    // Save the document as a temporary file
    const s3Key = `documents/${policyNumber}/${documentType}.pdf`;
    await s3fsImpl.writeFile(s3Key, documentBuffer);

    // Send the email with the document attached from S3
    await sendEmailWithS3Attachment(email, subject, `${documentType}.pdf`, s3Key);


    res.status(200).json({ message: 'Request received successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});

async function sendEmailWithS3Attachment(to, subject, filename, s3Key) {
  try {
    const s3ReadStream = s3fsImpl.createReadStream(s3Key);

    const mailOptions = {
      from: 'Socotra763@outlook.com',
      to: to,
      subject: subject,
      text: 'Please find the attached document.',
      attachments: [
        {
          filename: filename,
          content: s3ReadStream,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

// renewal update endpoint

app.post('/api/renewal', async (req, res) => {
  try {
    const { id, transactionId, timestamp, data, type, username } = req.body;

    const policyNumber = data["policyLocator"]; // policyLocator

    // Creating Authorization token
    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'alice.lee',
        password: 'socotra',
        hostName: 'ravendra_socotra-configeditor.co.sandbox.socotra.com',
      }),
    });

    if (!response_auth.ok) {
      throw new Error('Failed to authenticate with Socotra API');
    }

    const js_obj_auth = await response_auth.json();
    const auth_token = js_obj_auth.authorizationToken;

    // Fetching policy from policyLocator
    const response_policy = await fetch(`https://api.sandbox.socotra.com/policy/${policyNumber}`, {
      method: 'GET',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
    });

    if (!response_policy.ok) {
      throw new Error('Failed to fetch policy data from Socotra API');
    }

    const js_obj_policy = await response_policy.json();
    
    let size = js_obj_policy.exposures[0]?.perils.length - 2;


    const flb = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Fire_Limit_Building);
    const de = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Deductible);
    const flc = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Fire_Limit_Contents);
    const sl = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Stock_Limit);
    const ppl = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Personal_Property_of_others_Limit);
    const ebl = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Electronic_Breakdown_Limit);
    const il = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Business_Interruption_or_Income_Limit);
    const mbl = parseInt(js_obj_policy.exposures[0]?.perils[size]?.characteristics[0]?.fieldValues?.Machinery_Or_Equipment_Breakdown_Limit);

    const flb2 = flb + (0.05)*flb; 
    const de2 = de; 
    const flc2 = flc + (0.05)*flc;
        const sl2 = sl + (0.05)*sl;
        const ppl2 = ppl + (0.05)*ppl;
        const ebl2 = ebl + (0.05)*ebl;
        const il2 = il + (0.05)*il;
        const mbl2 = mbl + (0.05)*mbl;

    if(flb2 + flc2 + sl2 + ppl2 + ebl2 + il2 + mbl2 < 25000000){
      
        const renewalLocator = data["renewalLocator"]; // policyLocator
    
        const perilUpdateRequest = {
          Fire_Limit_Building: flb2,
          Fire_Limit_Contents: flc2,
          Deductible: de2,
          Stock_Limit: sl2,
          Personal_Property_of_others_Limit: ppl2,
          Electronic_Breakdown_Limit: ebl2,
          Business_Interruption_or_Income_Limit: il2,
          Machinery_Or_Equipment_Breakdown_Limit: mbl2,
        }

    


    const response_renewal = await fetch(`https://api.sandbox.socotra.com//renewals/${renewalLocator}/update`, {
      method: 'PATCH',
      headers: {
        Authorization: auth_token,
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        renewalUpdate: {
          updateExposures: [{
            exposureLocator: js_obj_policy.exposures[0]?.locator,
            updatePerils: [{
              perilLocator: js_obj_policy.exposures[0]?.perils[size].locator,
              fieldValues: perilUpdateRequest
            }]
          }]
        }
      }),
    });
    }
  
    

res.status(200).send("Success");

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
});


// renewal fields update through autofill

app.post('/api/renewalAutofill', async (req, res) => {

  try {
    // Access the request body data
    const { operationType, opertaion, updates, productName, policyholderLocator } = req.body;



    const flb = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Fire_Limit_Building);
    const flc = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Fire_Limit_Contents);
    const de = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Deductible);
    const sl = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Stock_Limit);
    const mbl = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Machinery_Or_Equipment_Breakdown_Limit);
    const il = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Business_Interruption_or_Income_Limit);
    const ebl = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Electronic_Breakdown_Limit);
    const ppl = parseInt(updates.updateExposures[0]?.updatePerils[0]?.fieldValues?.Personal_Property_of_others_Limit);

    const flb2 = flb + (0.05)*flb;
    const flc2 = flc + (0.05)*flc;
    const sl2 = sl + (0.05)*sl;
    const ppl2 = ppl + (0.05)*ppl;
    const il2 = il + (0.05)*il;
    const ebl2 = ebl + (0.05)*ebl;
    const de2 = de + (0.05)*de;
    const mbl2 = mbl + (0.05)*mbl;

    const exposure_locator = updates.updateExposures[0].exposureLocator;
    const exposure_name = updates.updateExposures[0].exposureName;
    const peril_locator = updates.updateExposures[0]?.updatePerils[0]?.perilLocator;

    
    try {
      

      const result2 = {
        Fire_Limit_Building: flb2,
        Fire_Limit_Contents: flc2,
        Stock_Limit: sl2,
        Personal_Property_of_others_Limit: ppl2,
        Business_Interruption_or_Income_Limit: il2,
        Electronic_Breakdown_Limit: ebl2,
        Deductible: de2,
        Machinery_Or_Equipment_Breakdown_Limit: mbl2
      }


      res.status(201).json({

        //fieldValues : result,
        updateExposures: [{
          exposureLocator: exposure_locator,
          exposureName: exposure_name,
          updatePerils: [{
            perilLocator: peril_locator,
            fieldValues: result2
          }]
        }]
      });


    } catch (error) {
      console.error(error);
    }
  }
  catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }



});





app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
