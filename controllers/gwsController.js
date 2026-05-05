const GWS = require("../models/GWS");
const { User } = require("../models/User");
const GiveawayApplication = require("../models/GiveawayApplication");
const jwt = require("jsonwebtoken");
const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

const getCurrentUserIdFromRequest = (req) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) return null;

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		return decoded?.id || null;
	} catch {
		return null;
	}
};

exports.createGWS = async (req, res) => {
	const { title, imageUrl, endTime, maxPlayers, depositRequirement } = req.body;

	if (!title || !imageUrl || !endTime || !maxPlayers || !depositRequirement) {
		return res.status(400).json({ message: "All giveaway fields are required." });
	}

	try {
		const gws = new GWS({
			title,
			imageUrl,
			endTime,
			maxPlayers,
			depositRequirement,
			state: "active",
		});
		await gws.save();
		res.status(201).json({ message: "GWS created", gws });
	} catch (error) {
		res.status(500).json({ error: "Create GWS failed" });
	}
};

exports.submitApplication = async (req, res) => {
	const { id } = req.params;
	const { name, discordName, depositProofImage } = req.body;
	const userId = req.user.id;

	if (!name || !discordName || !depositProofImage) {
		return res.status(400).json({ message: "All application fields are required." });
	}

	const giveaway = await GWS.findById(id);
	if (!giveaway) {
		return res.status(404).json({ message: "Giveaway not found." });
	}

	const application = await GiveawayApplication.findOneAndUpdate(
		{ giveaway: id, user: userId },
		{
			giveaway: id,
			user: userId,
			name,
			discordName,
			depositProofImage,
			status: "pending",
		},
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	);

	return res.status(201).json({ message: "Application submitted.", application });
};

exports.getApplicationsByGiveaway = async (req, res) => {
	try {
		const applications = await GiveawayApplication.find({ giveaway: req.params.id })
			.populate("user", "csgoName twitchUsername discordUsername")
			.populate("reviewedBy", "csgoName");

		return res.json(applications);
	} catch (error) {
		return res.status(500).json({ message: "Failed to load applications." });
	}
};

exports.approveApplication = async (req, res) => {
	try {
		const application = await GiveawayApplication.findById(req.params.applicationId);
		if (!application) {
			return res.status(404).json({ message: "Application not found." });
		}

		application.status = "approved";
		application.reviewedBy = req.user.id;
		application.reviewedAt = new Date();
		await application.save();

		return res.json({ message: "Application approved.", application });
	} catch (error) {
		return res.status(500).json({ message: "Failed to approve application." });
	}
};

exports.joinGWS = async (req, res) => {
	const user = await User.findById(req.user.id);
	if (!user) {
		return res.status(404).json({ message: "User not found." });
	}

	const giveaway = await GWS.findById(req.params.id);
	if (!giveaway) return res.status(404).json({ message: "GWS not found" });

	const application = await GiveawayApplication.findOne({
		giveaway: req.params.id,
		user: req.user.id,
		status: "approved",
	});

	if (!application) {
		return res.status(403).json({
			message: "You need admin approval before joining this giveaway.",
		});
	}

	if (giveaway.state !== "active") {
		return res.status(400).json({ message: "Giveaway is not active." });
	}

	if (giveaway.participants.some((participant) => participant.toString() === req.user.id)) {
		return res.status(400).json({ message: "Already joined" });
	}

	if (giveaway.participants.length >= giveaway.maxPlayers) {
		return res.status(400).json({ message: "This giveaway is full." });
	}

	// ✅ Normal join logic
	try {
		giveaway.participants.push(req.user.id);
		giveaway.totalParticipants += 1;
		giveaway.totalEntries += 1;
		await giveaway.save();

		res.json({ message: "Joined GWS", gws: giveaway });
	} catch (error) {
		console.error("GWS join failed:", error);
		res.status(500).json({ message: "Join failed" });
	}
};

exports.updateGWS = async (req, res) => {
	const { winnerId, state } = req.body;

	try {
		const gws = await GWS.findById(req.params.id);
		if (!gws) return res.status(404).json({ message: "GWS not found" });

		if (winnerId) gws.winner = winnerId;
		if (state && ["active", "complete"].includes(state)) gws.state = state;

		await gws.save();
		res.json({ message: "GWS updated", gws });
	} catch {
		res.status(500).json({ error: "Failed to update GWS" });
	}
};
exports.drawWinner = async (req, res) => {
	try {
		const gws = await GWS.findById(req.params.id).populate("participants", "csgoName");
		if (!gws || gws.participants.length === 0) {
			return res.status(400).json({ message: "No participants to draw from." });
		}

		const randomIndex = Math.floor(Math.random() * gws.participants.length);
		const winner = gws.participants[randomIndex];

		gws.winner = winner._id;
		gws.state = "complete";
		await gws.save();

		res.json({
			message: "Winner selected",
			winner: { id: winner._id, csgoName: winner.csgoName },
			gws,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Failed to draw winner." });
	}
};
exports.getAllGWS = async (req, res) => {
	try {
		const currentUserId = getCurrentUserIdFromRequest(req);
		const giveaways = await GWS.find()
			.populate("winner", "csgoName")
			.populate("participants", "csgoName");

		let approvedApplications = [];
		if (currentUserId) {
			approvedApplications = await GiveawayApplication.find({
				user: currentUserId,
				status: "approved",
			}).select("giveaway status");
		}

		const approvedMap = new Map(
			approvedApplications.map((application) => [application.giveaway.toString(), true])
		);

		res.json(
			giveaways.map((giveaway) => ({
				...giveaway.toObject(),
				isApproved: approvedMap.get(giveaway._id.toString()) || false,
			}))
		);
	} catch (err) {
		console.error("❌ getAllGWS error:", err);
		res.status(500).json({ message: "Failed to fetch giveaways." });
	}
};
// Helper to auto-draw winner and update state
exports.drawWinnerAuto = async (gws) => {
	if (!gws.participants || gws.participants.length === 0) {
		gws.state = "complete";
		await gws.save();
		return;
	}

	const randomIndex = Math.floor(Math.random() * gws.participants.length);
	const winner = gws.participants[randomIndex];

	gws.winner = winner;
	gws.state = "complete"; // IMPORTANT: set state to complete here
	await gws.save();
};
