var mongoose = require('mongoose')

const playListSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    poster: {
        type: String,
        default: '../images/musicicon.png'
    },
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'song'
    }]

})

module.exports = mongoose.model('playlist', playListSchema)