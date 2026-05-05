const express = require("express");
const {
	createGWS,
	submitApplication,
	getApplicationsByGiveaway,
	approveApplication,
	declineApplication,
	deleteApplication,
	deleteGWS,
	joinGWS,
	updateGWS,
	drawWinner,
	getAllGWS,
} = require("../controllers/gwsController");

const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", getAllGWS);
router.post("/", verifyToken, isAdmin, createGWS);
router.post("/:id/join", verifyToken, joinGWS);
router.post("/:id/applications", verifyToken, submitApplication);
router.get("/:id/applications", verifyToken, isAdmin, getApplicationsByGiveaway);
router.patch(
	"/applications/:applicationId/approve",
	verifyToken,
	isAdmin,
	approveApplication
);
router.patch(
	"/applications/:applicationId/decline",
	verifyToken,
	isAdmin,
	declineApplication
);
router.delete(
	"/applications/:applicationId",
	verifyToken,
	isAdmin,
	deleteApplication
);
router.delete("/:id", verifyToken, isAdmin, deleteGWS);
router.patch("/:id", verifyToken, isAdmin, updateGWS);
router.post("/:id/draw", verifyToken, isAdmin, drawWinner);

module.exports = router;
