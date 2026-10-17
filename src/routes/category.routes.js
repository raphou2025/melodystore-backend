const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const prisma = new PrismaClient();

router.get("/test", (req, res) => {
  res.json({ message: "Category route is working!" });
});

router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        products: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get categories",
      error: error.message,
    });
  }
});

router.post(
  "/",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { name, description, icon } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const category = await prisma.category.create({
        data: {
          name: String(name),
          description: description ? String(description) : null,
          icon: icon ? String(icon) : null,
        },
        include: { products: true },
      });

      await logAction({
        userId: req.user.id,
        action: "Created",
        entity: "category",
        entityId: category.id,
        metadata: { name: category.name },
      });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create category",
        error: error.message,
      });
    }
  },
);

router.put(
  "/:id",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, icon } = req.body;

      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          description:
            description !== undefined
              ? description
                ? String(description)
                : null
              : existing.description,
          icon:
            icon !== undefined ? (icon ? String(icon) : null) : existing.icon,
        },
        include: { products: true },
      });

      await logAction({
        userId: req.user.id,
        action: "Updated",
        entity: "category",
        entityId: category.id,
        metadata: { name: category.name },
      });

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update category",
        error: error.message,
      });
    }
  },
);

router.delete(
  "/:id",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const category = await prisma.category.findUnique({
        where: { id },
        include: { products: true },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      if (category.products.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Remove or reassign products before deleting this category",
        });
      }

      await prisma.category.delete({ where: { id } });

      await logAction({
        userId: req.user.id,
        action: "Deleted",
        entity: "category",
        entityId: id,
        metadata: { name: category.name },
      });

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete category",
        error: error.message,
      });
    }
  },
);

module.exports = router;
