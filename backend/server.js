import "dotenv/config";
import express from "express";
import cors from "cors";    
import {connectDB} from "./config/db.js";
import {notFound, errorHandler} from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import habitRoutes from "./routes/habits.js";
import logRoutes from "./routes/logs.js";
import aiRoutes from "./routes/ai.js";
import notificationRoutes from "./routes/notifications.js";
import "./scripts/streakReminder.js";


const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((s)=> s.trim())
    .filter(Boolean);


const corsOptions = {
    origin(origin, cb){
        //allow requests with no origin (like mobile apps or curl requests, serverr to server requests)
        if(!origin) return cb(null, true);
        //allow any localhost /127.0.0.1 origin in dev
        if(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){
            return cb(null, true);
        }
        //allow anything expilictily listed in CLIENT_URL
        if(allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
            
};

//middleware
app.use(cors(corsOptions));
//handle preflight requests for all routes
app.options("*", cors(corsOptions));
//limit json body to 1mb to prevent abuse for performace: json parsing
app.use(express.json({limits:"1mb"}));

//healthcheck route
app.get("/api/health", (req, res) => {
    res.json({status:"ok", time: new Date().toISOString()});
});

//routes for auth
app.use("/api/auth", authRoutes);
//routes for habits
app.use("/api/habits", habitRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notifications", notificationRoutes);


//handle errors centrally
app.use(notFound);
app.use(errorHandler);

//instead of starting server imi. we wait for the databse
const PORT = process.env.PORT || 8000;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port 8000`);
    });
});