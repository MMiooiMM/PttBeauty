const admin = require('firebase-admin');

var firebaseKey = require('./path/to/firebaseKey.json');
var lineKey = require('./path/to/lineKey.json');

admin.initializeApp({
  credential: admin.credential.cert(firebaseKey)
});

/*
  修正下列錯誤訊息：
  // Old:
  const date = snapshot.get('created_at');
  // New:
  const timestamp = snapshot.get('created_at');
  const date = timestamp.toDate();
  解決辦法：
  https://stackoverflow.com/questions/50799024/how-to-set-timestampsinsnapshots-setting-with-firebase-admin-for-nodejs
*/

const settings = {
  /* your settings... */
  timestampsInSnapshots: true
};

admin.firestore().settings(settings);

var db = admin.firestore();

// 引用linebot SDK
const line = require('@line/bot-sdk');

const client = new line.Client(lineKey);

// create Express app
// about Express itself: https://expressjs.com/
var express = require('express')
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(lineKey), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
function handleEvent(event) {
  if (event.replyToken == '00000000000000000000000000000000' || event.replyToken == 'ffffffffffffffffffffffffffffffff') {
    return Promise.resolve(200);
  }
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
  // create a echoing text message
  const echo = {
    type: 'text',
    text: event.message.text
  };
  if (event.message.text == '抽') {
    const echo2 = {
      type: 'image',
      originalContentUrl: 'https://i.imgur.com/uDlV8Le.jpg',
      previewImageUrl: 'https://i.imgur.com/uDlV8Le.jpg'
    };
    return client.replyMessage(event.replyToken, echo2);
  }

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});