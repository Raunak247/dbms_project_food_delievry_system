const express = require("express");
const {
	placeOrder,
	getUserOrders,
	getOrderSummary,
	getTopUsers,
	getRecoveryLogs,
	updateOrderStatus
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", placeOrder);
router.get("/user/:userId", getUserOrders);
router.get("/summary", getOrderSummary);
router.get("/analytics/top-users", getTopUsers);
router.get("/recovery/logs", getRecoveryLogs);
router.patch("/:orderId/status", updateOrderStatus);

module.exports = router;
