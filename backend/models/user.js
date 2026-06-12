import mongoose from "mongoose";    //schema
import bcrypt from "bcryptjs";     //hashing

const userSchema = new mongoose.Schema(
    {
        name : {type : String, required : true, trim: true},
        email : { 
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,

        },
        password : {type : String, required : true, minlength : 6},
        avatar : {type : String, default : ""},
        morningMotivation : {type : Boolean, default : false},
        pushSubscription: {
           type: Object,
         default: null
        },
    },
    
    {timestamps : true}
);

//presave hook to hash password before saving
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

//compare
userSchema.methods.matchPassword = function(plain) {
    return bcrypt.compare(plain, this.password);
};

//to not send to the client
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

export default mongoose.model("User", userSchema);
