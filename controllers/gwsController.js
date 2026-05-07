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
	const {
		title,
		imageUrl,
		endTime,
		maxPlayers,
		depositRequirement,
		winnerSelectionType,
	} = req.body;

	if (!title || !imageUrl || !endTime || !maxPlayers || !depositRequirement) {
		return res.status(400).json({ message: "All giveaway fields are required." });
	}

	if (
		winnerSelectionType &&
		!["random", "highest_deposit"].includes(winnerSelectionType)
	) {
		return res.status(400).json({
			message: "winnerSelectionType must be random or highest_deposit.",
		});
	}

	try {
		const gws = new GWS({
			title,
			imageUrl,
			endTime,
			maxPlayers,
			depositRequirement,
			winnerSelectionType: winnerSelectionType || "random",
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
	const {
		name,
		csgoName,
		discordName,
		depositProofVideo,
		depositAmount,
	} = req.body;
	const userId = req.user.id;
	const applicationName = csgoName || name;
	const parsedDepositAmount = Number(depositAmount);

	if (
		!applicationName ||
		!discordName ||
		!depositProofVideo ||
		!Number.isFinite(parsedDepositAmount) ||
		parsedDepositAmount < 0
	) {
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
			name: applicationName,
			discordName,
			depositProofVideo,
			depositAmount: parsedDepositAmount,
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

exports.declineApplication = async (req, res) => {
	try {
		const application = await GiveawayApplication.findById(req.params.applicationId);
		if (!application) {
			return res.status(404).json({ message: "Application not found." });
		}

		application.status = "rejected";
		application.reviewedBy = req.user.id;
		application.reviewedAt = new Date();
		await application.save();

		return res.json({ message: "Application declined.", application });
	} catch (error) {
		return res.status(500).json({ message: "Failed to decline application." });
	}
};

exports.deleteApplication = async (req, res) => {
	try {
		const application = await GiveawayApplication.findByIdAndDelete(
			req.params.applicationId
		);
		if (!application) {
			return res.status(404).json({ message: "Application not found." });
		}

		return res.json({ message: "Application deleted.", applicationId: application._id });
	} catch (error) {
		return res.status(500).json({ message: "Failed to delete application." });
	}
};

exports.deleteGWS = async (req, res) => {
	try {
		const giveaway = await GWS.findByIdAndDelete(req.params.id);
		if (!giveaway) {
			return res.status(404).json({ message: "Giveaway not found." });
		}

		await GiveawayApplication.deleteMany({ giveaway: req.params.id });

		return res.json({ message: "Giveaway deleted.", giveawayId: giveaway._id });
	} catch (error) {
		return res.status(500).json({ message: "Failed to delete giveaway." });
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

const selectGiveawayWinner = async (gws) => {
	if (!gws.participants || gws.participants.length === 0) {
		return null;
	}
	const participantIds = gws.participants.map(
		(participant) => participant?._id || participant
	);

	if (gws.winnerSelectionType === "highest_deposit") {
		const highestDepositApplication = await GiveawayApplication.findOne({
			giveaway: gws._id,
			status: "approved",
			user: { $in: participantIds },
		})
			.sort({ depositAmount: -1, createdAt: 1 })
			.select("user");

		if (highestDepositApplication?.user) {
			return highestDepositApplication.user;
		}
	}

	const randomIndex = Math.floor(Math.random() * gws.participants.length);
	const participant = gws.participants[randomIndex];
	return participant?._id || participant;
};

exports.drawWinner = async (req, res) => {
	try {
		const gws = await GWS.findById(req.params.id).populate("participants", "csgoName");
		if (!gws || gws.participants.length === 0) {
			return res.status(400).json({ message: "No participants to draw from." });
		}

		const selectedWinnerId = await selectGiveawayWinner(gws);
		if (!selectedWinnerId) {
			return res.status(400).json({ message: "No eligible winner found." });
		}
		const winner = gws.participants.find(
			(participant) => participant._id.toString() === selectedWinnerId.toString()
		);
		if (!winner) {
			return res.status(400).json({ message: "No eligible winner found." });
		}

		gws.winner = winner._id;
		gws.state = "complete";
		await gws.save();

		res.json({
			message:
				gws.winnerSelectionType === "highest_deposit"
					? "Winner selected by highest deposit"
					: "Winner selected randomly",
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
		let currentUserApplications = [];
		if (currentUserId) {
			approvedApplications = await GiveawayApplication.find({
				user: currentUserId,
				status: "approved",
			}).select("giveaway status");

			currentUserApplications = await GiveawayApplication.find({
				user: currentUserId,
			}).select("giveaway status _id");
		}

		const approvedMap = new Map(
			approvedApplications.map((application) => [application.giveaway.toString(), true])
		);
		const applicationStatusMap = new Map(
			currentUserApplications.map((application) => [
				application.giveaway.toString(),
				{ status: application.status, applicationId: application._id.toString() },
			])
		);

		res.json(
			giveaways.map((giveaway) => ({
				...giveaway.toObject(),
				isApproved: approvedMap.get(giveaway._id.toString()) || false,
				applicationStatus: applicationStatusMap.get(giveaway._id.toString()) || null,
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

	const winner = await selectGiveawayWinner(gws);
	if (!winner) {
		gws.state = "complete";
		await gws.save();
		return;
	}

	gws.winner = winner;
	gws.state = "complete"; // IMPORTANT: set state to complete here
	await gws.save();
};
