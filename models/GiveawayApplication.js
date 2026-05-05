const mongoose = require("mongoose");

const giveawayApplicationSchema = new mongoose.Schema({
	giveaway: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "GWS",
		required: true,
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	name: { type: String, required: true },
	discordName: { type: String, required: true },
	depositProofImage: { type: String, required: true },
	status: {
		type: String,
		enum: ["pending", "approved", "rejected"],
		default: "pending",
	},
	reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	reviewedAt: { type: Date },
	createdAt: { type: Date, default: Date.now },
});

giveawayApplicationSchema.index({ giveaway: 1, user: 1 }, { unique: true });

const GiveawayApplication = mongoose.model(
	"GiveawayApplication",
	giveawayApplicationSchema
);

module.exports = GiveawayApplication;