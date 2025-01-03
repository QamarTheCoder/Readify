if (process.env.NODE_ENV != 'production'){
    require('dotenv').config();
}
import('node-fetch').then(({ default: fetch }) => global.fetch = fetch);



const express=require('express')
const app=express();
const mongoose=require('mongoose');
const ejs=require('ejs')
const path=require('path')
const methodOverride=require('method-override')
const ejsMate=require('ejs-mate')
const User= require('./models/user.js')
const session = require('express-session');
const MongoStore = require('connect-mongo');
const Chat= require('./models/chat.js');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const multer  = require('multer')
// const {storage}=require('./cloudConfig.js')
const upload = multer({storage : multer.memoryStorage()})
const fs = require('fs');
const pdf = require('pdf-parse');
const axios = require('axios');
const wrapAsync=require('./utils/wrapAsync.js')
const ExpressError=require('./utils/expressError.js')
const { parse } = require('dotenv');
const { HfInference } =require('@huggingface/inference')

const hf = new HfInference(process.env.API_KEY_HUGGINGFACE)



const MONGO_URL=process.env.ATLAS_URL;
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
app.use(express.json());
app.engine('ejs',ejsMate) //for boilerplate
app.use(express.static(path.join(__dirname,'/public')))

const store=MongoStore.create({
  mongoUrl:MONGO_URL,
  crypto:{
    secret:process.env.SECRET
  },
  touchAfter:24*3600
})
store.on("error",()=>{
  console.log('ERROR IN STORE ',err);

})
const sessionOptions={
    store,
    secret:process.env.SECRET,
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
app.get('/dashboard',wrapAsync(async(req,res)=>{
    let userChats=await Chat.find({user:req.user._id})
    // console.log(req.user.id)
    // console.log(userChats)
    res.render('./home/upload.ejs',{user:req.user,userChats})
}))

app.post('/fdata', upload.single('file'), wrapAsync(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No file uploaded.');
      }
      let curretnfileextname = path.extname(req.file.originalname)
      let currentfilename=path.basename(req.file.originalname,curretnfileextname)
      if (path.extname(req.file.originalname) == '.pdf'){
        const data = await pdf(req.file.buffer);
        const extractedText = data.text;
          const chat = new Chat({
            name:currentfilename,
            processedData: extractedText,
            user: req.user._id, 
        });
    
        await chat.save();

        res.redirect(`/${chat._id}`);
      }
    
      if (path.extname(req.file.originalname) == '.mp3'){
        const audiodata=await hf.automaticSpeechRecognition({
            model: 'facebook/wav2vec2-large-960h-lv60-self',
            data: req.file.buffer
          })
        
        const chat = new Chat({
            name:currentfilename,
            processedData: audiodata.text,
            user: req.user._id,}) 
        await chat.save();
        res.redirect(`/${chat._id}`);
      }
      else{
        throw new ExpressError(401,'File Format Not Supported')
      }
      
    } catch (error) {
      console.error('Error processing file:', error);
      throw new ExpressError(401,'File Format Not Supported');
    }
  }));
  


// USER Login 
app.get('/',(req,res)=>{
    res.render('./user/login.ejs')
})
app.post('/',passport.authenticate('local',{failureRedirect:'/'}),(req,res)=>{
    let {username,password}=req.body;
    res.redirect('/dashboard')
})

//User Logout
app.get('/logout',(req,res)=>{
  req.logout(err=>{
    if (err){
      return next(err)
    }
    res.redirect('/')
  })

})


// USER signup
app.get('/signup',(req,res)=>{
    res.render('./user/signup.ejs')
})
app.post('/signup',wrapAsync(async(req,res)=>{
    let{email,username,password}=req.body;
    let newUser=new User({email,username})
    try {
        let ruser = await User.register(newUser, password);
        
        req.login(ruser, (err) => {
            if (err) {
                console.error('Error logging in:', err);
                return res.status(500).send('Error logging in.');
            }
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).send('Error during signup.');
    }
}))




//Individual Chats
app.get('/:chatId',wrapAsync(async(req,res,next)=>{

    let {chatId}=req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return next(); // Triggers the 404 handler below
  }

    if (chatId === 'favicon.ico') {
        return res.status(204).end(); // No Content
      }
    let specificChat=await Chat.findById(chatId);
    session.chatId=chatId;
    // console.log(specificChat.questions)
    let userChats=await Chat.find({user:req.user._id}) //i've to pass that because the boilerplate uses this
    res.render('./chat/indchat.ejs',{specificChat,userChats})
}))

app.post('/chatprocess',wrapAsync(async(req,res)=>{
    const { message } = req.body;
    let specificChat=await Chat.findById(session.chatId) 

    const botRes=await hf.questionAnswering({
        model: 'deepset/roberta-base-squad2',
        inputs: {
          question: message,
          context: specificChat.processedData
        }
      })
    console.log(botRes.answer)

    const botResponse = botRes.answer;  //Implement hugging face transformers Ai in here

    specificChat.questions.push({ question: message , answer:botResponse}); 
    await specificChat.save()
    res.json({ response: botResponse });
}))



//Error handling middelware & Upload it on render

app.all("*",(req,res,next)=>{
  next(new ExpressError(401,"Page Not Found") )
})

app.use((err,req,res,next)=>{
  let {status=500,message='Something Went Wrong'}=err;
  res.render('Error.ejs',{status,message})
})

app.listen(8080,()=>{
    console.log('Listening on port 8080')
})