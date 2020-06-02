var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({
    extended: false
});
var express = require('express');
var app = express();
var request = require('request');
var {
    google
} = require('googleapis');
var SlackBot = require('slackbots');
let privatekey = require("./key.js"); //Your pivatekey here
var hdate = require('human-date'); //Used for human readable dates, can also be done with replace and splice method

// configure a JWT auth client
let jwtClient = new google.auth.JWT(
    privatekey.client_email,
    null,
    privatekey.private_key,
    ['https://www.googleapis.com/auth/calendar']);
//authenticate request
jwtClient.authorize(function(err, tokens) {
    if (err) {
        console.log(err);
        return;
    } else {
        console.log("Successfully connected!");
    }
});
let calendar = google.calendar('v3');


//Uncomment if using NGROK or other local port as server
//const server = app.listen(port, () => {
//});


// create a Slackbot
var bot = new SlackBot({
    token: '', //Set XOXB Token
    name: 'NAMEOFBOT'
});


//Startup message
//bot.on('start', function() {
//    bot.postMessageToChannel('channel', 'message!');
//    
//});

//The /plan-afspraak command
app.post('/plan-afspraak', urlencodedParser, (req, res) => {
    res.status(200).end() // best practice to respond with empty 200 status code
    var reqBody = req.body
    var responseURL = "" //Set responseurl
    if (reqBody.token != "") { // Set request token
        res.status(403).end("Access forbidden")
    } else {
        //Dates are hardcoded for showcase purposes
        var message = {
            "text": "Kies een van de volgende data",
            "attachments": [{
                "text": "",
                "fallback": "Shame... buttons aren't supported in this land",
                "callback_id": "button_tutorial",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [{
                        "name": "2019-06-11T11:00:00", //Enddate
                        "text": "Dinsdag 11 Juni 10:00-11:00",
                        "type": "button",
                        "value": "2019-06-11T10:00:00" //Begindate
                    },
                    {
                        "name": "2019-06-12T11:00:00", //Enddate
                        "text": "Woensdag 12 Juni 10:00-11:00",
                        "type": "button",
                        "value": "2019-06-12T10:00:00" //Begindate
                    },
                    {
                        "name": "2019-06-13T11:00:00", //Enddate
                        "text": "Donderdag 13 Juni 10:00-11:00",
                        "type": "button",
                        "value": "2019-06-13T10:00:00" //Begindate
                    }
                ]
            }]
        }

        sendMessageToSlackResponseURL(responseURL, message)
    }
});

//When using Dialogflow without library:
// app.post('/botoutput', (req, res) => {
//     //   Get intentName
//       let intentName = req.body.queryResult.intent.displayName.split("_");
//When bot sees message
bot.on('message', function(data) {
    //Including "afspraken"
    if (data.text && data.text.includes("afspraken")) {
        //List all events
        calendar.events.list({
            auth: jwtClient,
            calendarId: 'primary' //Set primary if there is only one calendar
        }, function(err, response) {
            if (err) {
                return;
            }
            var events = response.data.items;
            if (events.length == 0) {} else {
                //Loop through event
                for (let event of response.data.items) {
                    //Get event
                    var message = ':date: ' + event.summary + ' :alarm_clock: ' + hdate.prettyPrint(event.start.dateTime) + " " + event.start.dateTime.slice(11, 16);
                    var params = {
                        icon_emoji: ':calendar:'
                    };
                    //Show event in Slack
                    bot.postMessageToChannel('channel', message, params);

                }
            }
        });
    };
});


//Get response on button click
app.post('/slack/actions', urlencodedParser, (req, res) => {
    res.status(200).end() // best practice to respond with 200 status
    var actionJSONPayload = JSON.parse(req.body.payload) // parse URL-encoded payload JSON string

    //Insert event
    calendar.events.insert({
        auth: jwtClient,
        calendarId: 'primary', //Set primary if there is only one calendar
        resource: {
            'summary': '',
            'description': '',
            'start': {
                'dateTime': actionJSONPayload.actions[0].value, //Begindate from button
                'timeZone': 'GMT+02:00',
            },
            'end': {
                'dateTime': actionJSONPayload.actions[0].name, //Enddate from button
                'timeZone': 'GMT+02:00',
            },
        },
    }, function(err, res) {
        if (err) {
            console.log('Error: ' + err);
            return;
        }
    });

    var params = {
        icon_emoji: ':calendar:'
    };
    //Set message
    var message = ":calendar: Je afspraak op " + hdate.prettyPrint(actionJSONPayload.actions[0].value) + " om :alarm_clock: " + actionJSONPayload.actions[0].value.slice(11, 16) + " staat vast!";
    //Sendmessage
    bot.postMessageToChannel('planbot', message, params);
});

//Send message
function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
    var postOptions = {
        uri: responseURL,
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        json: JSONmessage
    }
    request(postOptions, (error, response, body) => {
        if (error) {
            console.log(error);
        }
    })
}