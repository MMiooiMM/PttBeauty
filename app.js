var admin = require('firebase-admin');

const firebaseKey = require('./path/to/firebaseKey.json');
const lineKey = require('./path/to/lineKey.json');

admin.initializeApp({
  credential: admin.credential.cert(firebaseKey)
});

var db = admin.firestore();

// 引用linebot SDK
const line = require('@line/bot-sdk');

const client = new line.Client(lineKey);

// create Express app
// about Express itself: https://expressjs.com/
var express = require('express')
const app = express();

var request = require('request');

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
  if (event.message.text == '.') {
    var BeautyRef = db.collection('Beauty').get().then(snapshot => {
        var random = getRandomInt(snapshot._size)
        var index = 0;
        snapshot.forEach(doc => {
          if (index == random) {
            db.collection('Beauty').doc(doc.id).collection('images').get().then(snapshot2 => {
                var random = getRandomInt(snapshot2._size)
                var index = 0;
                snapshot2.forEach(doc => {
                  if (index == random) {
                    const echo2 = {
                      type: 'image',
                      originalContentUrl: doc.data().url,
                      previewImageUrl: doc.data().url
                    };
                    return client.replyMessage(event.replyToken, echo2);
                  }
                  index++;
                });
              })
              .catch(err => {
                console.log('Error getting documents', err);
              });
          }
          index++;
        });
      })
      .catch(err => {
        console.log('Error getting documents', err);
      });
  } else if (event.message.text == '..') {
    request('https://www.ptt.cc/bbs/Beauty/index.html', function (error, response, body) {
      var begin = 0;
      var end = 0;
      var stop = body.indexOf('r-list-sep');
      while (true) {
        begin = body.indexOf('r-ent', end);
        end = body.indexOf('meta', begin);
        if (begin > stop)
          break;
        const nrec = (body.indexOf('span', begin) > end) ? 0 : body.substring(body.indexOf('<span', begin) + 20, body.indexOf('</span>', begin));
        const title = body.substring(body.indexOf('html">', begin) + 6, body.indexOf('</a>', begin));
        const url = body.substring(body.indexOf('href="', begin) + 6, body.indexOf('html">', begin) + 4);
        db.collection('Beauty').where('url', '==', url).get().then(snap => {
          const size = snap.size; // will return the collection size
          if (size == 0) {
            db.collection('Beauty').add({
              nrec: nrec,
              title: title,
              url: url
            }).then((ref) => {
              request(`https://www.ptt.cc${url}`, function (error, response, body) {
                var _begin = 0;
                var _end = 0;
                while (true) {
                  _begin = body.indexOf('nofollow', _end);
                  _end = body.indexOf('</a>', _begin);
                  if (_begin == -1)
                    break;
                  ref.collection('images').add({
                    url: body.substring(_begin + 10, _end)
                  });
                }
              });
            });
          }
        });
      }
    });
  } else {
    return Promise.resolve(200);
  }
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}