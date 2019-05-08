let admin = require('firebase-admin');

const firebaseKey = require('./path/to/firebaseKey.json');
const lineKey = require('./path/to/lineKey.json');

admin.initializeApp({
  credential: admin.credential.cert(firebaseKey)
});

let db = admin.firestore();
const BeautyRef = db.collection('Beauty');
const LastResultRef = db.collection('LastResult');
const UrlListDoc = db.collection('UrlList').doc('acwR9G4oJI2DLfHj9lWS');
// 引用linebot SDK
const line = require('@line/bot-sdk');

const client = new line.Client(lineKey);

// create Express app
// about Express itself: https://expressjs.com/
let express = require('express')
const app = express();

//http://javascript.ruanyifeng.com/nodejs/express.html#toc6
// 加载hbs模块
let hbs = require('hbs');

// 指定模板文件的后缀名为html
app.set('view engine', 'html');

// 运行hbs模块
app.engine('html', hbs.__express);

let request = require('request');

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

app.get("/", function (request, response) {
  response.render('index');
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
  if (event.message.text.indexOf('抽') == 0) {
    let likes = parseInt(event.message.text.split(' ')[1]);
    if (isNaN(likes)) likes = 0;
    PickBeauty(likes).then(val => {
      return client.replyMessage(event.replyToken, {
        type: 'image',
        originalContentUrl: val,
        previewImageUrl: val
      });
    });
  } else if (event.message.text == '...6...') {
    let url = 'https://www.ptt.cc/bbs/Beauty/index.html';
    getPage(url, 10);
  } else if (event.message.text == '...16...') {
    RefreshUrlList();
  } else if (event.message.text.indexOf('測試') == 0) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: event.message.text
    });
  } else if (event.message.text.indexOf('@@') == 0) {
    let index = parseInt(event.message.text.split(' ')[1]);
    if (isNaN(index) || index > 10) index = 1;
    getLastResult(index).then(value => {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `https://www.ptt.cc${value}`
      });
    })
  } else if (event.message.text.indexOf('醜') == 0) {
    let index = parseInt(event.message.text.split(' ')[1]);
    if (isNaN(index) || index > 10) index = 1;
    getLastResult(index).then(value => {
      BeautyRef.where('url', '==', value).get().then(snapshot => {
        snapshot.forEach(doc => {
          BeautyRef.doc(doc.id).update({
            url: doc.data().url,
            nrec: doc.data().nrec,
            beauty: false
          })
        })
      })
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '移出 https://www.ptt.cc' + value
      });
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

function getImages(url) {
  return new Promise(resolve => {
    request(`https://www.ptt.cc${url}`, function (error, response, body) {
      let result = [];
      let _begin = 0;
      let _end = 0;
      while (true) {
        _begin = body.indexOf('nofollow', _end);
        _end = body.indexOf('</a>', _begin);
        if (_begin == -1)
          break;
        let images = body.substring(_begin + 10, _end);
        if (images.indexOf('imgur') != -1) {
          if (images.indexOf('jpg') != -1) {
            result.push(images);
          } else {
            result.push(images + '.jpg');
          }
        }
      }
      resolve(result);
    });
  });
}

function getPage(url, count) {
  if (count <= 0)
    return;
  getPrevPage(url).then(value => {
    getPage(value, count - 1);
  });
}

function getPrevPage(url) {
  console.log(url);
  return new Promise(resolve => {
    request(url, function (error, response, body) {
      getBeauty(url);
      let begin = body.indexOf('最舊') + 37;
      let end = body.indexOf('上頁') - 11;
      resolve(`https://www.ptt.cc${body.substring(begin, end)}`);
    });
  });
}

function PickBeauty(likes) {
  return new Promise(resolve => {
    UrlListDoc.get().then(doc => {
      let arr = doc.data().values;
      let likeArr = [];
      if (likes == 0) {
        likeArr = arr;
      } else {
        arr.forEach(value => {
          if (value.nrec >= likes || value.nrec == '爆')
            likeArr.push(value)
        });
      }
      let random = getRandomInt(likeArr.length);
      BeautyRef.where('url', '==', likeArr[random].url).limit(1).get().then(snapshot => {
        snapshot.forEach(doc => {
          getImages(doc.data().url).then(value => {
            let _random = getRandomInt(value.length);
            addLastResult(likeArr[random].url);
            resolve(value[_random]);
          });
        })
      })
    });
  });
}

function getBeauty(src) {
  request(src, function (error, response, body) {
    let begin = 0;
    let end = 0;
    let stop = body.indexOf('r-list-sep');
    while (true) {
      begin = body.indexOf('r-ent', end);
      end = body.indexOf('meta', begin);
      if ((begin > stop && stop != -1) || begin == -1)
        break;
      const nrec = (body.indexOf('span', begin) > end) ? 0 : body.substring(body.indexOf('<span', begin) + 20, body.indexOf('</span>', begin));
      const title = body.substring(body.indexOf('html">', begin) + 6, body.indexOf('</a>', begin));
      const url = body.substring(body.indexOf('href="', begin) + 6, body.indexOf('html">', begin) + 4);
      if (title.indexOf('正妹') == -1) {
        continue;
      }
      BeautyRef.where('url', '==', url).get().then(snap => {
        const size = snap.size; // will return the collection size
        console.log('title', title, 'size', size);
        if (size == 0) {
          BeautyRef.add({
            nrec: nrec,
            url: url,
            beauty: true
          });
        } else {
          snap.forEach(doc => {
            BeautyRef.doc(doc.id).update({
              nrec: nrec
            });
          });
        }
      });
    }
  });
}

function RefreshUrlList() {
  BeautyRef.get().then(snap => {
    let arr = [];
    snap.forEach(doc => {
      arr.push({
        url: doc.data().url,
        nrec: doc.data().nrec,
        beauty: doc.data().beauty
      });
    });
    UrlListDoc.update({
      values: arr
    });
  });
}

function addLastResult(url) {
  LastResultRef.add({
    url: url,
    date: new Date().getTime()
  });
}

function getLastResult(num) {
  return new Promise(resolve => {
    LastResultRef.orderBy('date', 'desc').limit(num).get().then(snapshot => {
      snapshot.forEach(doc => {
        if (--num == 0)
          resolve(doc.data().url);
      });
    });
  });
}