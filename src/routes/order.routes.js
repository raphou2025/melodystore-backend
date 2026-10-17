const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const prisma = new PrismaClient();

const formatLabel = (value) => {
  if (!value) return "Pending";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizeOrder = (order) => {
  const userName =
    [order.user?.firstName, order.user?.lastName].filter(Boolean).join(" ") ||
    order.user?.username ||
    "Customer";

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: {
      name: userName,
      email: order.user?.email || "",
    },
    items: (order.items || []).map((item) => ({
      name: item.product?.name || "Product",
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.total || item.quantity * item.price),
    })),
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    shipping: Number(order.shipping),
    status: formatLabel(order.status),
    paymentStatus: formatLabel(order.paymentStatus),
    paymentMethod: order.paymentMethod,
    shippingAddress:
      typeof order.shippingAddress === "object" && order.shippingAddress
        ? order.shippingAddress
        : {
            street: "",
            city: "",
            state: "",
            zip: "",
            country: "",
          },
    createdAt: order.createdAt,
  };
};

const getOrderQuery = () => ({
  orderBy: { createdAt: "desc" },
  include: {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
      },
    },
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    },
  },
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    if (
      !shippingAddress?.street ||
      !shippingAddress?.city ||
      !shippingAddress?.country
    ) {
      return res.status(400).json({
        success: false,
        message: "Street, city, and country are required",
      });
    }

    const normalizedItems = items.map((item) => ({
      productId: String(item.productId),
      quantity: Number(item.quantity),
    }));

    if (
      normalizedItems.some(
        (item) =>
          !item.productId ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Each cart item must have a valid product and quantity",
      });
    }

    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: normalizedItems.map((item) => item.productId) } },
      });
      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );

      for (const item of normalizedItems) {
        const product = productsById.get(item.productId);
        if (!product)
          throw new Error("One or more products are no longer available");
        if (product.stock < item.quantity) {
          throw new Error(`${product.name} does not have enough stock`);
        }
      }

      const orderItems = normalizedItems.map((item) => {
        const product = productsById.get(item.productId);
        const price = product.salePrice ?? product.price;
        return {
          productId: product.id,
          quantity: item.quantity,
          price,
          total: price * item.quantity,
        };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const createdOrder = await transaction.order.create({
        data: {
          userId: req.user.id,
          orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          status: "COMPLETED",
          subtotal,
          total: subtotal,
          tax: 0,
          shipping: 0,
          shippingAddress,
          paymentMethod: String(paymentMethod || "CASH_ON_DELIVERY"),
          paymentStatus: "PAID",
          notes: notes ? String(notes) : null,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      for (const item of normalizedItems) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return createdOrder;
    });

    await logAction({
      userId: req.user.id,
      action: "Completed",
      entity: "order",
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to place order",
    });
  }
});

router.get(
  "/",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const orders = await prisma.order.findMany(getOrderQuery());

      res.json({
        success: true,
        data: orders.map(normalizeOrder),
      });
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get orders",
        error: error.message,
      });
    }
  },
);

router.get(
  "/report",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const orders = await prisma.order.findMany(getOrderQuery());
      const normalizedOrders = orders.map(normalizeOrder);
      const totalRevenue = normalizedOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0,
      );
      const totalOrders = normalizedOrders.length;
      const deliveredOrders = normalizedOrders.filter(
        (order) => order.status === "Delivered",
      ).length;
      const pendingOrders = normalizedOrders.filter(
        (order) => order.status === "Pending",
      ).length;
      const shippedOrders = normalizedOrders.filter(
        (order) => order.status === "Shipped",
      ).length;
      const completedOrders = normalizedOrders.filter(
        (order) => order.status === "Completed",
      ).length;
      const statusBreakdown = normalizedOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          totalRevenue,
          totalOrders,
          averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
          deliveredOrders,
          pendingOrders,
          shippedOrders,
          completedOrders,
          statusBreakdown,
          orders: normalizedOrders,
          recentOrders: normalizedOrders.slice(0, 5),
        },
      });
    } catch (error) {
      console.error("Get order report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get order report",
        error: error.message,
      });
    }
  },
);

router.patch(
  "/:id/status",
  verifyToken,
  authorize("SUPER_ADMIN", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const validStatus = [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",
        "CANCELLED",
        "REFUNDED",
      ];

      if (!validStatus.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: req.params.id },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      await logAction({
        userId: req.user.id,
        action: "Updated",
        entity: "order",
        entityId: updatedOrder.id,
        metadata: {
          orderNumber: updatedOrder.orderNumber,
          status,
          customerId: updatedOrder.user?.id,
        },
      });

      res.json({
        success: true,
        data: normalizeOrder(updatedOrder),
      });
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update order status",
        error: error.message,
      });
    }
  },
);

module.exports = router;
