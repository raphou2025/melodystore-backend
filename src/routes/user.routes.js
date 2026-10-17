const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const prisma = new PrismaClient();

const formatRole = (role) => (role ? role.replace("_", " ") : "CUSTOMER");

router.get(
  "/",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      res.json({
        success: true,
        data: users.map((user) => ({
          ...user,
          roleLabel: formatRole(user.role),
        })),
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get users",
        error: error.message,
      });
    }
  },
);

router.patch(
  "/:id/role",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ["SUPER_ADMIN", "ADMIN", "STAFF", "CUSTOMER", "GUEST"];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role value",
        });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await logAction({
        userId: req.user.id,
        action: "Updated",
        entity: "user role",
        entityId: user.id,
        metadata: { role, username: user.username },
      });

      res.json({
        success: true,
        data: { ...user, roleLabel: formatRole(user.role) },
      });
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user role",
        error: error.message,
      });
    }
  },
);

router.patch(
  "/:id/status",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await logAction({
        userId: req.user.id,
        action: "Updated",
        entity: "user status",
        entityId: user.id,
        metadata: { isActive, username: user.username },
      });

      res.json({
        success: true,
        data: { ...user, roleLabel: formatRole(user.role) },
      });
    } catch (error) {
      console.error("Update user status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user status",
        error: error.message,
      });
    }
  },
);

router.delete(
  "/:id",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (req.user.id === id) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete your own account",
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await prisma.user.delete({ where: { id } });

      await logAction({
        userId: req.user.id,
        action: "Deleted",
        entity: "user",
        entityId: id,
        metadata: { username: existingUser.username },
      });

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
    }
  },
);

module.exports = router;
