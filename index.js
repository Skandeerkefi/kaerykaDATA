const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const app = express();
const PORT = 3000;

// Logging Middleware
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	const originalSend = res.send;
	res.send = function (body) {
		console.log(
			`[${new Date().toISOString()}] Response Headers:`,
			res.getHeaders()
		);
		return originalSend.call(this, body);
	};
	next();
});

// CORS Middleware
const allowedOrigins = [
	"http://localhost:5173",
	"https://king-eta-cyan.vercel.app",
	"https://kingrewardsroobet.vercel.app",
	"https://mister-tee.vercel.app/Leaderboards",
	"https://louiskhz.vercel.app",
	"https://tacopoju-dun.vercel.app",
	"https://www.tacopojurewards.com",
	"https://kaeryka.vercel.app",
	"https://www.kaerykarewards.com"
];

app.use(
	cors({
		origin: function (origin, callback) {
			// allow requests with no origin like curl or Postman
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			} else {
				return callback(new Error("CORS policy: This origin is not allowed"));
			}
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB Connection
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("❌ MongoDB connection error:", err));

const { SlotCall } = require("./models/SlotCall");

// Middleware
const { verifyToken, isAdmin } = require("./middleware/auth");

// Routes
const slotCallRoutes = require("./routes/slotCallRoutes");
const authRoutes = require("./routes/authRoutes");
const gwsRoutes = require("./routes/gwsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/gws", gwsRoutes);

// Slot Call Routes
app.use("/api/slot-calls", slotCallRoutes);

const leaderboardRoutes = require("./routes/leaderboard");
// Routes
app.use("/api/leaderboard", leaderboardRoutes);

// Basic health check endpoint
app.get("/health", (req, res) => {
	res
		.status(200)
		.json({ status: "OK", message: "Roobet Leaderboard API is running" });
});

// Start Server
app.listen(PORT, () =>
	console.log(`✅ Server is running at http://localhost:${PORT}`)
);