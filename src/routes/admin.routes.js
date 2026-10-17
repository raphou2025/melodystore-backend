const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { verifyToken, authorize } = require("../middleware/auth");
const { logAction } = require("../utils/activityLogger");

const router = express.Router();
const prisma = new PrismaClient();

const resources = {
  coupons: {
    model: "coupon",
    fields: [
      "code",
      "description",
      "type",
      "value",
      "usageLimit",
      "startsAt",
      "expiresAt",
      "isActive",
    ],
    dates: ["startsAt", "expiresAt"],
  },
  discounts: {
    model: "discount",
    fields: [
      "name",
      "description",
      "type",
      "value",
      "startsAt",
      "endsAt",
      "isActive",
    ],
    dates: ["startsAt", "endsAt"],
  },
  campaigns: {
    model: "emailCampaign",
    fields: ["name", "subject", "content", "status", "scheduledAt", "sentAt"],
    dates: ["scheduledAt", "sentAt"],
  },
  banners: {
    model: "banner",
    fields: [
      "title",
      "subtitle",
      "imageUrl",
      "linkUrl",
      "position",
      "isActive",
      "startsAt",
      "endsAt",
    ],
    dates: ["startsAt", "endsAt"],
  },
  pages: {
    model: "contentPage",
    fields: ["title", "slug", "content", "status"],
    dates: [],
  },
  posts: {
    model: "blogPost",
    fields: [
      "title",
      "slug",
      "excerpt",
      "content",
      "coverImage",
      "status",
      "publishedAt",
    ],
    dates: ["publishedAt"],
  },
  media: {
    model: "mediaAsset",
    fields: ["name", "url", "mimeType", "size"],
    dates: [],
  },
  testimonials: {
    model: "testimonial",
    fields: ["name", "role", "quote", "avatarUrl", "isActive"],
    dates: [],
  },
  notifications: {
    model: "notification",
    fields: ["title", "message", "type", "isRead"],
    dates: [],
  },
  backups: {
    model: "backupRecord",
    fields: ["name", "status", "size", "location"],
    dates: [],
  },
  activity: {
    model: "activityLog",
    fields: ["userId", "action", "entity", "entityId", "metadata"],
    dates: [],
  },
  security: {
    model: "activityLog",
    fields: ["userId", "action", "entity", "entityId", "metadata"],
    dates: [],
  },
};

const normalizeBody = (body, definition) => {
  const data = {};
  for (const field of definition.fields) {
    if (body[field] === undefined) continue;
    if (definition.dates.includes(field)) {
      data[field] = body[field] ? new Date(body[field]) : null;
    } else {
      data[field] = body[field];
    }
  }
  return data;
};

router.use(verifyToken, authorize("SUPER_ADMIN", "ADMIN", "STAFF"));

router.get("/:resource", async (req, res) => {
  const definition = resources[req.params.resource];
  if (!definition)
    return res
      .status(404)
      .json({ success: false, message: "Unknown admin resource" });

  try {
    const records = await prisma[definition.model].findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    console.error(`Get ${req.params.resource} error:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to load admin resource",
      error: error.message,
    });
  }
});

router.post("/:resource", async (req, res) => {
  const definition = resources[req.params.resource];
  if (!definition)
    return res
      .status(404)
      .json({ success: false, message: "Unknown admin resource" });

  try {
    const record = await prisma[definition.model].create({
      data: normalizeBody(req.body, definition),
    });
    await logAction({
      userId: req.user.id,
      action: "Created",
      entity: req.params.resource,
      entityId: record.id,
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error(`Create ${req.params.resource} error:`, error);
    res.status(400).json({
      success: false,
      message: "Failed to create admin record",
      error: error.message,
    });
  }
});

router.patch("/:resource/:id", async (req, res) => {
  const definition = resources[req.params.resource];
  if (!definition)
    return res
      .status(404)
      .json({ success: false, message: "Unknown admin resource" });

  try {
    const record = await prisma[definition.model].update({
      where: { id: req.params.id },
      data: normalizeBody(req.body, definition),
    });
    await logAction({
      userId: req.user.id,
      action: "Updated",
      entity: req.params.resource,
      entityId: record.id,
    });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error(`Update ${req.params.resource} error:`, error);
    res.status(400).json({
      success: false,
      message: "Failed to update admin record",
      error: error.message,
    });
  }
});

router.delete("/:resource/:id", async (req, res) => {
  const definition = resources[req.params.resource];
  if (!definition)
    return res
      .status(404)
      .json({ success: false, message: "Unknown admin resource" });

  try {
    await prisma[definition.model].delete({ where: { id: req.params.id } });
    await logAction({
      userId: req.user.id,
      action: "Deleted",
      entity: req.params.resource,
      entityId: req.params.id,
    });
    res.json({ success: true, message: "Admin record deleted" });
  } catch (error) {
    console.error(`Delete ${req.params.resource} error:`, error);
    res.status(400).json({
      success: false,
      message: "Failed to delete admin record",
      error: error.message,
    });
  }
});

module.exports = router;
