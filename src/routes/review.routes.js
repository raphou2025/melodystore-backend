const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.get(
  "/",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const reviews = await prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
          product: { select: { id: true, name: true } },
        },
      });

      res.json({
        success: true,
        data: reviews,
        count: reviews.length,
      });
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get reviews",
        error: error.message,
      });
    }
  },
);

module.exports = router;
