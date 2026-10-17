const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const prisma = new PrismaClient();

const normalizeProduct = (product) => ({
  ...product,
  price: Number(product.price),
  salePrice: product.salePrice !== null ? Number(product.salePrice) : null,
  stock: Number(product.stock),
  images: Array.isArray(product.images) ? product.images : [],
});

router.get("/test", (req, res) => {
  res.json({ message: "Product route is working!" });
});

router.get("/", async (req, res) => {
  try {
    const { search, category } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { description: { contains: String(search), mode: "insensitive" } },
      ];
    }

    if (category) {
      where.categoryId = String(category);
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: products.map(normalizeProduct),
      count: products.length,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get products",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: normalizeProduct(product),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get product",
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
      const {
        name,
        description,
        price,
        salePrice,
        stock,
        categoryId,
        images,
        badge,
      } = req.body;

      if (!name || !description || !categoryId) {
        return res.status(400).json({
          success: false,
          message: "Name, description, and category are required",
        });
      }

      const categoryExists = await prisma.category.findUnique({
        where: { id: String(categoryId) },
      });

      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Selected category does not exist",
        });
      }

      const product = await prisma.product.create({
        data: {
          name: String(name),
          description: String(description),
          price: Number(price || 0),
          salePrice:
            salePrice !== undefined && salePrice !== null && salePrice !== ""
              ? Number(salePrice)
              : null,
          stock: Number(stock || 0),
          categoryId: String(categoryId),
          images: Array.isArray(images) ? images : [],
          badge: badge ? String(badge) : null,
        },
        include: { category: true },
      });

      await logAction({
        userId: req.user.id,
        action: "Created",
        entity: "product",
        entityId: product.id,
        metadata: { name: product.name },
      });

      res.status(201).json({
        success: true,
        data: normalizeProduct(product),
      });
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create product",
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
      const {
        name,
        description,
        price,
        salePrice,
        stock,
        categoryId,
        images,
        badge,
      } = req.body;

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          description: description ?? existing.description,
          price: price !== undefined ? Number(price) : existing.price,
          salePrice:
            salePrice !== undefined && salePrice !== null && salePrice !== ""
              ? Number(salePrice)
              : existing.salePrice,
          stock: stock !== undefined ? Number(stock) : existing.stock,
          categoryId: categoryId ?? existing.categoryId,
          images:
            images !== undefined
              ? Array.isArray(images)
                ? images
                : []
              : existing.images,
          badge:
            badge !== undefined
              ? badge
                ? String(badge)
                : null
              : existing.badge,
        },
        include: { category: true },
      });

      await logAction({
        userId: req.user.id,
        action: "Updated",
        entity: "product",
        entityId: product.id,
        metadata: { name: product.name },
      });

      res.json({
        success: true,
        data: normalizeProduct(product),
      });
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update product",
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
      const existing = await prisma.product.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      await prisma.product.delete({ where: { id } });

      await logAction({
        userId: req.user.id,
        action: "Deleted",
        entity: "product",
        entityId: id,
        metadata: { name: existing.name },
      });

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete product",
        error: error.message,
      });
    }
  },
);

module.exports = router;
