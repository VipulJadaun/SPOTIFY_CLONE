var express = require('express');
var router = express.Router();
var passport = require('passport')
var localStrategy = require('passport-local')
var User = require('../models/userModel')
var songModel = require('../models/songModel')
var playlistModel = require('../models/playlistModel')
var mongoose = require('mongoose')
var multer = require('multer')
var id3 = require('node-id3')
var crypto = require('crypto')
var { Readable } = require('stream');
const userModel = require('../models/userModel');
passport.use(new localStrategy(User.authenticate()))


mongoose.connect('mongodb://0.0.0.0/SPOTIFY_CLONE').then(() => {
  console.log("connected user")
}).catch(err => {
  console.log(err)
})

const conn = mongoose.connection

var gfsBucket, gfsBucketPoster
conn.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "audio"
  })

  gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'poster'
  })
})



/* GET home page. */
router.get('/', isloggedIn, async function (req, res, next) {

  const currentUser = await userModel.findOne({
    _id: req.user._id
  }).populate('playList').populate({
    path: 'playList',
    populate: {
      path: 'songs',
      model: 'song'
    }
  })
  res.render('index', { currentUser });
});

router.get('/poster/:posterName', (req, res, next) => {
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res)
})

/* user authentication routes */
router.post('/register', async (req, res, next) => {



  var newUser = new User({
    username: req.body.username,
    email: req.body.email,
  })
  User.register(newUser, req.body.password)
    .then(async function (u) {

      const songs = await songModel.find()
      passport.authenticate('local')(req, res, async function () {
        const defaultPlaylist = await playlistModel.create({
          name: req.body.username,
          owner: req.user._id,
          songs: songs.map(songs => songs._id)
        })


        const newUser = await userModel.findOne({
          _id: req.user._id
        })

        newUser.playList.push(defaultPlaylist._id)
        await newUser.save()




        res.redirect('/')
      })
    })
    .catch(function (e) {
      res.send(e);
    })
})

router.get('/auth', (req, res, next) => {
  res.render('register');
})

router.get('/login', (req, res, next) => {
  res.render('login');
})

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}), function (req, res, next) { })

router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isloggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  else res.redirect('/auth');
}

function isAdmin(req, res, next) {
  if (req.user.isAdmin) return next();
  else return res.redirect('/')
}

/* user authentication routes */

router.get('/uploadMusic', isloggedIn, isAdmin, function (req, res, next) {
  console.log(req.user)
  res.render('uploadMusic');
});

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
router.post('/uploadMusic', isloggedIn, isAdmin, upload.array('song'), async (req, res, next) => {

  await Promise.all(req.files.map(async file => {
    const randomName = crypto.randomBytes(20).toString('hex')

    const songData = id3.read(file.buffer)
    Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
    Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'))
    await songModel.create({
      title: songData.title,
      artist: songData.artist,
      album: songData.album,
      size: file.size,
      poster: randomName + 'poster',
      fileName: randomName

    })
  }))

  res.send("songs upload")
})

router.get('/stream/:musicName', async (req, res, next) => {
  const currentSong = await songModel.findOne({
    fileName: req.params.musicName
  })

  console.log(currentSong)

  const stream = gfsBucket.openDownloadStreamByName(req.params.musicName)

  res.set('Content-Type', 'audio/mpeg')
  res.set('Content-Length', currentSong.size + 1)
  res.set('Content-Range', `bytes 0-${currentSong.size - 1}/${currentSong.size}`)
  res.set('Content-Ranges', 'bytes')
  res.status(206)
  stream.pipe(res)
})

router.get('/search', isloggedIn, function (req, res, next) {
  res.render('search');
});

router.post('/search', async function (req, res, next) {

  const searchMusic = await songModel.find({
    title: { $regex: req.body.search }
  })
  res.json({
    songs: searchMusic
  })
});

module.exports = router;
