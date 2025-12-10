const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

app.use(express.json());

// MongoDB Connection
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("❌ MongoDB connection error:", err));

// Models
const { User } = require("./models/User");
const { SlotCall } = require("./models/SlotCall");

// Middleware
const { verifyToken, isAdmin } = require("./middleware/auth");

// Routes
const slotCallRoutes = require("./routes/slotCallRoutes");

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
	const { kickUsername, password, confirmPassword } = req.body;

	if (password !== confirmPassword) {
		return res.status(400).json({ message: "Passwords do not match." });
	}

	const existing = await User.findOne({ kickUsername });
	if (existing) {
		return res.status(400).json({ message: "Username already exists." });
	}

	const hashed = await bcrypt.hash(password, 10);
	const newUser = new User({ kickUsername, password: hashed });
	await newUser.save();

	res.status(201).json({ message: "User registered." });
});

app.post("/api/auth/login", async (req, res) => {
	const { kickUsername, password } = req.body;

	const user = await User.findOne({ kickUsername });
	if (!user) return res.status(404).json({ message: "User not found." });

	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ message: "Invalid credentials." });

	const token = jwt.sign(
		{ id: user._id, role: user.role, kickUsername: user.kickUsername },
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);

	res.json({
		token,
		user: { id: user._id, kickUsername: user.kickUsername, role: user.role },
	});
});

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