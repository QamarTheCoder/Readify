if (process.env.NODE_ENV != 'production'){
    require('dotenv').config();
}

const express=require('express')
const app=express();
const mongoose=require('mongoose');
const ejs=require('ejs')
const path=require('path')
const methodOverride=require('method-override')
const ejsMate=require('ejs-mate')
const User= require('./models/User.js')
const session = require('express-session');
const Chat= require('./models/chat.js');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const multer  = require('multer')
// const {storage}=require('./cloudConfig.js')
const upload = multer({storage : multer.memoryStorage()})
const fs = require('fs');
const pdf = require('pdf-parse');
const axios = require('axios');
const { parse } = require('dotenv');


const MONGO_URL='mongodb://127.0.0.1:27017/Pdf'
main().then(()=>{
    console.log('Connected to DB')
}).catch((err)=>{
    console.log(err)
})

async function main(){
    await mongoose.connect(MONGO_URL)
}

app.set('view engine','ejs') //this too for views and ejs stuff 
app.set('views',path.join(__dirname,'views')) //Views ejs and stuff
app.use(express.urlencoded({extended:true})) //to use POST method
app.engine('ejs',ejsMate) //for boilerplate
app.use(express.static(path.join(__dirname,'/public')))


const sessionOptions={
    secret:'Mysupasecretkey',
    resave:false,
    saveUninitialized:true
}

app.use(session(sessionOptions))

app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Chat route 
app.get('/dashboard',(req,res)=>{
    res.render('./home/chat.ejs',{user:req.user})
})


app.post('/fdata', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No file uploaded.');
      }
  
      // Extract text from PDF (or other formats)
      const data = await pdf(req.file.buffer); // Extract text from PDF
      const extractedText = data.text;
  
      // Save extracted data to the Chat model
    //   const chat = new Chat({
    //     processedData: extractedText, // Save extracted text here
    //     user: req.user._id, // Ensure the user is defined
    //     questions: [] // You can populate this later as needed
    //   });
  
    //   await chat.save();
      res.send(extractedText);
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).send('Error processing file.');
    }
  });
  


// USER Login 
app.get('/',(req,res)=>{
    res.render('./user/login.ejs')
})
app.post('/',passport.authenticate('local',{failureRedirect:'/'}),(req,res)=>{
    let {username,password}=req.body;
    res.redirect('/dashboard')
})

// USER signup
app.get('/signup',(req,res)=>{
    res.render('./user/signup.ejs')
})
app.post('/signup',async(req,res)=>{
    let{email,username,password}=req.body;
    let newUser=new User({email,username})
    let ruser=await User.register(newUser,password)
    res.redirect('/dashboard')
})

app.listen(8080,()=>{
    console.log('Listening on port 8080')
})