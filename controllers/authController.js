const { User } = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
	const {
		twitchUsername,
		discordUsername,
		csgoName,
		password,
		confirmPassword,
	} = req.body;

	if (!twitchUsername || !discordUsername || !csgoName || !password || !confirmPassword) {
		return res.status(400).json({ message: "All signup fields are required." });
	}

	if (password !== confirmPassword) {
		return res.status(400).json({ message: "Passwords do not match." });
	}

	const existingCsgo = await User.findOne({ csgoName });
	if (existingCsgo)
		return res.status(400).json({ message: "CSGO name already exists." });

	const existingTwitch = await User.findOne({ twitchUsername });
	if (existingTwitch)
		return res.status(400).json({ message: "Twitch username already exists." });

	const existingDiscord = await User.findOne({ discordUsername });
	if (existingDiscord)
		return res.status(400).json({ message: "Discord username already exists." });

	const hashed = await bcrypt.hash(password, 10);
	const newUser = new User({
		twitchUsername,
		discordUsername,
		csgoName,
		password: hashed,
	});
	await newUser.save();

	res.status(201).json({
		message: "User registered.",
		user: {
			id: newUser._id,
			twitchUsername: newUser.twitchUsername,
			discordUsername: newUser.discordUsername,
			csgoName: newUser.csgoName,
			kickUsername: newUser.csgoName,
			rainbetUsername: newUser.twitchUsername,
			role: newUser.role,
		},
	});
};

exports.login = async (req, res) => {
	const { csgoName, password } = req.body;

	if (!csgoName || !password) {
		return res.status(400).json({ message: "CSGO name and password are required." });
	}

	const user = await User.findOne({ csgoName });
	if (!user) return res.status(404).json({ message: "User not found." });

	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ message: "Invalid credentials." });

	const token = jwt.sign(
		{ id: user._id, role: user.role },
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);

	res.json({
		token,
		user: {
			id: user._id,
			twitchUsername: user.twitchUsername,
			discordUsername: user.discordUsername,
			csgoName: user.csgoName,
			kickUsername: user.csgoName,
			rainbetUsername: user.twitchUsername,
			role: user.role,
		},
	});
};
// Admin sets hit250 for a slot call — only admin allowed (isAdmin middleware)
exports.toggleHit250 = async (req, res) => {
	const { id } = req.params;

	try {
		const slotCall = await SlotCall.findById(id);
		if (!slotCall)
			return res.status(404).json({ message: "Slot call not found." });

		slotCall.hit250 = true;
		await slotCall.save();

		res.status(200).json({ message: "hit250 set to true", slotCall });
	} catch (err) {
		res.status(500).json({ message: "Failed to update hit250" });
	}
};

// User submits winnerSlot — verify ownership by comparing req.user.id with slotCall.user
exports.submitWinnerSlot = async (req, res) => {
	const { id } = req.params;
	const { winnerSlot } = req.body;

	if (!winnerSlot) {
		return res.status(400).json({ message: "Winner slot is required." });
	}

	try {
		const slotCall = await SlotCall.findById(id);
		if (!slotCall)
			return res.status(404).json({ message: "Slot call not found." });

		if (slotCall.user.toString() !== req.user.id) {
			return res.status(403).json({ message: "Unauthorized." });
		}

		if (!slotCall.hit250) {
			return res
				.status(400)
				.json({ message: "Not eligible for winner slot yet." });
		}

		slotCall.winnerSlot = winnerSlot;
		await slotCall.save();

		res.status(200).json({ message: "Winner slot submitted", slotCall });
	} catch (err) {
		res.status(500).json({ message: "Failed to submit winner slot" });
	}
};
