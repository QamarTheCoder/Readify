const mongoose=require('mongoose');
let Schema=mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

let User=new Schema({
    email:{
        type:String,
        required:true
    }
})

User.plugin(passportLocalMongoose);

module.exports=mongoose.model('User',User)

