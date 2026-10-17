const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const prisma = new PrismaClient();

// Simple test route
router.get("/test", (req, res) => {
  res.json({ message: "Auth route is working!" });
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current user",
      error: error.message,
    });
  }
});

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, avatar } = req.body;

    const updateData = {};

    if (typeof firstName === "string") updateData.firstName = firstName.trim();
    if (typeof lastName === "string") updateData.lastName = lastName.trim();
    if (typeof phone === "string") updateData.phone = phone.trim();
    if (typeof avatar === "string") updateData.avatar = avatar.trim();

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }

      updateData.email = normalizedEmail;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No profile fields provided",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
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

    await logAction({
      userId: req.user.id,
      action: "Updated",
      entity: "profile",
      entityId: req.user.id,
      metadata: { fields: Object.keys(updateData) },
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    console.log("Login attempt:", req.body.email);

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" },
    );

    const { password: _, ...userWithoutPassword } = user;

    await logAction({
      userId: user.id,
      action: "Signed in",
      entity: "authentication",
      entityId: user.id,
      metadata: { role: user.role },
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

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

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
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
        metadata: { username: user.username },
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

// Register route
router.post("/register", async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, phone, role } =
      req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or username already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: role || "CUSTOMER",
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    await logAction({
      userId: user.id,
      action: "Registered",
      entity: "user",
      entityId: user.id,
      metadata: { role: user.role, username: user.username },
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" },
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user, token },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

module.exports = router;
