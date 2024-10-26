const mongoose=require('mongoose');
let Schema=mongoose.Schema;

const Chat=new Schema({
    name:{
        type:String,
        required:true,
    },
    processedData:{
        type:String,
        required:true,
    },
    user:{
        type:Schema.Types.ObjectId,
        ref:'User'
    },
    questions: [{
        question: {
            type: String,
            required: true
        },
        answer: {
            type: String,
            default: ""
        },
        askedAt: {
            type: Date,
            default: Date.now
        }
    }]
})

module.exports=mongoose.model('Chat',Chat);